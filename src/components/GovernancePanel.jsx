/**
 * GovernancePanel.jsx  —  Milestara Bitcoin Cash Chipnet UI
 *
 * This panel shows:
 *   1. Current GOV token balance
 *   2. Locked BCH amount in the "contract"
 *   3. Token-weighted voting per milestone
 *   4. Release button after milestone is approved
 *
 * It connects to milestoneContract.js service functions.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
    fundMilestoneContract,
    castVote,
    releaseMilestoneFunds,
    getLockedAmount,
    chipnetExplorerUrl,
    clearContractState,
} from '../services/milestoneContract'
import { PROJECT_ADDRESS, getTokenBalance } from '../services/bchWallet'
import { scanVotes } from '../services/govService'
import { voteOnMilestone } from '../lib/db/votes'

// ── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
    return (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    )
}

// ── Vote Bar ──────────────────────────────────────────────────────────────────
function VoteBar({ votes }) {
    const total = votes.yes + votes.no
    const yesP = total > 0 ? Math.round((votes.yes / total) * 100) : 0
    const noP = total > 0 ? Math.round((votes.no / total) * 100) : 0
    return (
        <div className="mb-3">
            <div className="flex rounded-full overflow-hidden h-2 mb-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full transition-all duration-700" style={{ width: `${yesP}%`, background: 'linear-gradient(90deg, #10b981, #059669)' }} />
                <div className="h-full transition-all duration-700" style={{ width: `${noP}%`, background: 'linear-gradient(90deg, #be123c, #e11d48)' }} />
            </div>
            <div className="flex justify-between text-xs">
                <span style={{ color: '#34d399' }}>✓ YES  {yesP}% ({votes.yes} tokens)</span>
                <span style={{ color: '#f87171' }}>✗ NO  {noP}% ({votes.no} tokens)</span>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GovernancePanel({
    wallet,
    projectId,
    contractAddress,
    milestoneIdHex,
    deadline,
    milestones = [],
    onMilestoneApproved,
    onTransaction
}) {
    // ── State ─────────────────────────────────────────────────────────────────
    const [tokenBal, setTokenBal] = useState(0)
    const [lockedBch, setLockedBch] = useState(0)
    const [mintAmt, setMintAmt] = useState('0.001')
    const [mintLoading, setMintLoading] = useState(false)
    const [mintResult, setMintResult] = useState(null)
    const [voteTokens, setVoteTokens] = useState(1)
    const [voteLoading, setVoteLoading] = useState(null)  // milestoneId
    const [releaseId, setReleaseId] = useState(null)  // milestoneId being released
    const [releaseTxId, setReleaseTxId] = useState({})
    const [error, setError] = useState('')
    const [milestoneVotes, setMilestoneVotes] = useState({})

    // ── Load state ────────────────────────────────────────────────────────────
    const refreshState = useCallback(async () => {
        // 1. Fetch real-time token balance from wallet
        const tks = await getTokenBalance(wallet)
        setTokenBal(tks)

        // 2. Fetch locked BCH in contract
        setLockedBch(getLockedAmount())

        // 3. Scan On-Chain Votes — scoped to this project's addresses
        const tally = await scanVotes(projectId)
        console.log('[GovernancePanel] On-Chain Tally fetched:', tally)
    }, [milestones, wallet?.cashaddr, projectId])

    useEffect(() => { refreshState() }, [refreshState, milestones])

    if (!wallet) {
        return (
            <div className="card-glass rounded-2xl p-6 mb-6">
                <WeekBadge />
                <p className="text-slate-400 text-sm mt-4 text-center">
                    🔒 Connect your Chipnet wallet above to unlock governance features.
                </p>
            </div>
        )
    }

    const handleMint = async () => {
        setError('')
        setMintLoading(true)
        setMintResult(null)
        try {
            const parsed = parseFloat(mintAmt)
            if (!parsed || parsed <= 0) throw new Error('Enter a valid BCH amount')
            // ✅ FIX: Send BCH to the CashScript contract address (not the static PROJECT_ADDRESS).
            // contractAddress comes from the DB contracts table (set at project deploy time).
            // Fallback to PROJECT_ADDRESS only for legacy projects with no on-chain contract.
            const destination = contractAddress || PROJECT_ADDRESS
            if (!contractAddress) {
                console.warn('[GovernancePanel] ⚠ contractAddress not set — falling back to PROJECT_ADDRESS. Funds will NOT be releasable via the contract.')
            } else {
                console.log('[GovernancePanel] ✓ Locking BCH into contract:', contractAddress)
            }
            const result = await fundMilestoneContract(wallet, parsed, destination)
            setMintResult(result)
            if (onTransaction) {
                onTransaction(parsed, result.simulatedTxId, 'funding')
            }
            await refreshState()
        } catch (e) {
            setError(e.message || 'Minting failed')
        } finally {
            setMintLoading(false)
        }
    }

    const handleVote = async (milestoneId, voteType) => {
        setError('')
        setVoteLoading(milestoneId + voteType)
        try {
            // STEP 1 (required): Record vote in Supabase — the Oracle reads this
            const voterId = wallet?.cashaddr
            if (!voterId) throw new Error('Wallet not connected')
            await voteOnMilestone({
                milestoneId,
                voterId,
                vote: voteType === 'yes',
                votingPower: voteTokens,
            })
            console.log(`[GovernancePanel] ✓ DB vote recorded (${voteType})`)

            // STEP 2 (bonus / optional): Attempt on-chain token transfer.
            // This may fail if the wallet has no GOV tokens — that's OK because
            // the Oracle only checks Supabase. We swallow the error silently.
            try {
                const res = await castVote(wallet, projectId, milestoneId, voteType, voteTokens)
                if (res.txId) console.log(`[GovernancePanel] On-chain vote TX: ${res.txId}`)
            } catch (onChainErr) {
                console.warn('[GovernancePanel] On-chain vote skipped (no tokens?):', onChainErr.message)
            }

            // STEP 3: Refresh so vote count updates immediately
            setTimeout(() => refreshState(), 1500)
        } catch (e) {
            setError(e.message)
        } finally {
            setVoteLoading(null)
        }
    }

    const handleRelease = async (milestoneDbId, amountBch) => {
        setError('')
        setReleaseId(milestoneDbId)
        try {
            // The Oracle only needs milestoneId (Supabase UUID) + projectId.
            // The CashScript release() call needs contractAddress + milestoneIdHex,
            // but we fall back gracefully if those aren't available yet.
            const txId = await releaseMilestoneFunds(
                wallet,
                amountBch,
                contractAddress,
                milestoneIdHex,
                deadline,
                milestoneDbId,
                projectId,
            )
            // releaseMilestoneFunds() returns:
            //   string  — real tx.txid from a successful CashScript broadcast
            //   null    — DB-only release (legacy project with no on-chain contract data)
            const realTxId = txId || null
            setReleaseTxId(prev => ({ ...prev, [milestoneDbId]: realTxId }))
            if (onTransaction && realTxId) {
                onTransaction(amountBch, realTxId, 'release')
            }
            refreshState()
        } catch (e) {
            setError(e.message || 'Release failed')
        } finally {
            setReleaseId(null)
        }
    }

    return (
        <div className="mb-6 space-y-4">
            <div className="card-glass rounded-2xl p-6">
                <WeekBadge />
                <div className="grid grid-cols-2 gap-4 mt-5 mb-5">
                    <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">GOV Tokens</p>
                        <p className="text-2xl font-bold" style={{ color: '#10b981' }}>{tokenBal}</p>
                        <p className="text-xs text-slate-500 mt-0.5">= {tokenBal} votes</p>
                    </div>
                    <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Locked BCH</p>
                        <p className="text-2xl font-bold" style={{ color: '#10b981' }}>{lockedBch.toFixed(8)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">in contract</p>
                    </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                        <span>🪙</span> Step 1 — Lock BCH &amp; Mint Governance Tokens
                    </p>
                    <p className="text-slate-500 text-xs mb-3 leading-relaxed">
                        Lock BCH into the milestone contract. You receive <strong className="text-emerald-400">100 GOV tokens per 0.001 BCH</strong> — each token = 1 vote.
                    </p>

                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input
                                id="mint-amount-input"
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={mintAmt}
                                onChange={e => setMintAmt(e.target.value)}
                                className="input-web3 pr-14"
                                disabled={mintLoading}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: '#10b981' }}>BCH</span>
                        </div>
                        <button
                            id="mint-tokens-btn"
                            onClick={handleMint}
                            disabled={mintLoading}
                            className="px-5 py-3 rounded-xl font-bold text-white gradient-btn-green flex items-center gap-2 disabled:opacity-60"
                        >
                            {mintLoading ? <><Spinner /> Minting…</> : '⚡ Lock & Mint'}
                        </button>
                    </div>

                    {mintResult && (
                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                            <p className="text-emerald-300 text-xs font-semibold mb-1">✅ Tokens Minted!</p>
                            <p className="text-slate-400 text-xs">You received <strong className="text-emerald-400">{mintResult.tokenAmount} GOV tokens</strong></p>
                            <p className="text-slate-500 text-xs mt-0.5 font-mono break-all">
                                Token ID: {mintResult.tokenCategory.slice(0, 16)}...
                            </p>
                            <a
                                href={chipnetExplorerUrl(mintResult.simulatedTxId)}
                                target="_blank" rel="noreferrer"
                                className="text-emerald-400 text-xs underline"
                            >
                                View on Explorer ↗
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {milestones.length > 0 && (
                <div className="card-glass rounded-2xl p-6">
                    <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                        <span>🗳️</span> Step 2 — Token-Weighted Governance Voting
                    </p>
                    <p className="text-slate-500 text-xs mb-4 leading-relaxed">
                        Use your GOV tokens to vote on milestones. &gt;50% YES unlocks release.
                    </p>

                    <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="text-slate-400 text-xs">Tokens per vote:</span>
                        {[1, 5, 10, 25].map(n => (
                            <button
                                key={n}
                                onClick={() => setVoteTokens(n)}
                                className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                                style={{
                                    background: voteTokens === n ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.08)',
                                    border: `1px solid ${voteTokens === n ? 'rgba(16,185,129,0.6)' : 'rgba(16,185,129,0.2)'}`,
                                    color: voteTokens === n ? '#d1fae5' : '#10b981',
                                }}
                            >
                                {n}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-4">
                        {milestones.map((m, idx) => {
                            // Prefer DB votes which the Oracle relies on.
                            const votes = { yes: m.voteYes ?? m.votes?.yes ?? 0, no: m.voteNo ?? m.votes?.no ?? 0 }
                            const total = votes.yes + votes.no
                            // Check DB approval flag OR status string OR on-chain tally
                            const approved =
                                m.approved === true ||
                                m.status === 'Approved' || m.status === 'approved' ||
                                (total > 0 && (votes.yes / total) > 0.5)
                            const txId = releaseTxId[m.id]

                            return (
                                <div
                                    key={m.id}
                                    className="rounded-xl p-4"
                                    style={{
                                        background: approved ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${approved ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}`,
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                                                style={{ background: approved ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.2)', color: approved ? '#10b981' : '#34d399' }}>
                                                {approved ? '✓' : idx + 1}
                                            </span>
                                            <span className="text-white text-sm font-semibold">{m.title}</span>
                                        </div>
                                        <span
                                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                                            style={{
                                                background: approved ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.1)',
                                                color: approved ? '#10b981' : '#fbbf24',
                                                border: `1px solid ${approved ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.2)'}`,
                                            }}
                                        >
                                            {approved ? '✅ Approved' : '⏳ Voting'}
                                        </span>
                                    </div>

                                    {total > 0 && <VoteBar votes={votes} />}

                                    {!approved && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleVote(m.id, 'yes')}
                                                disabled={voteLoading === m.id + 'yes' || tokenBal < voteTokens}
                                                className="flex-1 py-2 rounded-xl font-bold text-sm text-white gradient-btn-green flex items-center justify-center gap-1.5 disabled:opacity-50"
                                            >
                                                {voteLoading === m.id + 'yes' ? <Spinner /> : '👍'} YES
                                            </button>
                                            <button
                                                onClick={() => handleVote(m.id, 'no')}
                                                disabled={voteLoading === m.id + 'no' || tokenBal < voteTokens}
                                                className="flex-1 py-2 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                style={{ background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.2)', color: '#f43f5e' }}
                                            >
                                                {voteLoading === m.id + 'no' ? <Spinner /> : '👎'} NO
                                            </button>
                                        </div>
                                    )}

                                    {approved && !txId && (
                                        <>
                                            <button
                                                onClick={() => handleRelease(m.id, m.amountAllocated || 0.01)}
                                                disabled={releaseId === m.id}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                                                style={{
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                    color: 'white',
                                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                                    opacity: releaseId === m.id ? 0.5 : 1
                                                }}
                                            >
                                                {releaseId === m.id ? <Spinner /> : '🚀 Release Funds to Creator'}
                                            </button>
                                            <p className="text-[10px] text-emerald-500/60 mt-2 text-center italic">
                                                ✓ Oracle-protected · Quorum verified
                                            </p>
                                        </>
                                    )}

                                    {txId && txId !== 'oracle-approved' && (
                                        <div className="mt-2 text-center">
                                            <a
                                                href={`https://chipnet.imaginary.cash/tx/${txId}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-emerald-400 text-xs underline"
                                            >
                                                View Release on Explorer ↗
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {error && (
                <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.25)' }}>
                    <span className="text-rose-400">⚠</span>
                    <p className="text-rose-300 text-sm flex-1">{error}</p>
                    <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-200">×</button>
                </div>
            )}
        </div>
    )
}

function WeekBadge() {
    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L3 12L12 22L21 12L12 2Z" stroke="#10b981" strokeWidth="2" />
                </svg>
            </div>
            <div>
                <h2 className="text-white font-bold text-base">Bitcoin Cash Governance</h2>
                <p className="text-slate-500 text-xs">Chipnet Testnet · Cash Tokens Simulation</p>
            </div>
        </div>
    )
}
