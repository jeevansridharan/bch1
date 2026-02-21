/**
 * GovernancePanel.jsx  —  Milestara Week 3 UI
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
    getTokenBalance,
    getLockedAmount,
    getMilestoneVotes,
    isMilestoneApproved,
    chipnetExplorerUrl,
    clearContractState,
} from '../services/milestoneContract'
import { PROJECT_ADDRESS } from '../services/bchWallet'

// ── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
    return (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    )
}

// ── Token Badge ───────────────────────────────────────────────────────────────
function TokenBadge({ balance }) {
    return (
        <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="2" />
                <path d="M12 8v4l3 3" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {balance} GOV Tokens
        </div>
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
                <div className="h-full transition-all duration-700" style={{ width: `${yesP}%`, background: 'linear-gradient(90deg, #059669, #10b981)' }} />
                <div className="h-full transition-all duration-700" style={{ width: `${noP}%`, background: 'linear-gradient(90deg, #be123c, #e11d48)' }} />
            </div>
            <div className="flex justify-between text-xs">
                <span style={{ color: '#4ade80' }}>✓ YES  {yesP}% ({votes.yes} tokens)</span>
                <span style={{ color: '#f87171' }}>✗ NO  {noP}% ({votes.no} tokens)</span>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GovernancePanel({ wallet, milestones = [], onMilestoneApproved }) {
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
    const refreshState = useCallback(() => {
        setTokenBal(getTokenBalance())
        setLockedBch(getLockedAmount())
        const votes = {}
        milestones.forEach(m => {
            votes[m.id] = getMilestoneVotes(m.id)
        })
        setMilestoneVotes(votes)
    }, [milestones])

    useEffect(() => { refreshState() }, [refreshState])

    // ── No wallet ─────────────────────────────────────────────────────────────
    if (!wallet) {
        return (
            <div className="card-glass rounded-2xl p-6 mb-6">
                <WeekBadge />
                <p className="text-slate-400 text-sm mt-4 text-center">
                    🔒 Connect your BCH wallet above to unlock governance features.
                </p>
            </div>
        )
    }

    // ── STEP 2 handler: Mint governance tokens ───────────────────────────────
    const handleMint = async () => {
        setError('')
        setMintLoading(true)
        setMintResult(null)
        try {
            const parsed = parseFloat(mintAmt)
            if (!parsed || parsed <= 0) throw new Error('Enter a valid BCH amount')
            const result = await fundMilestoneContract(wallet, parsed, PROJECT_ADDRESS)
            setMintResult(result)
            refreshState()
        } catch (e) {
            setError(e.message || 'Minting failed')
        } finally {
            setMintLoading(false)
        }
    }

    // ── STEP 3 handler: Cast a vote ───────────────────────────────────────────
    const handleVote = async (milestoneId, voteType) => {
        setError('')
        setVoteLoading(milestoneId + voteType)
        try {
            const result = castVote(milestoneId, voteType, voteTokens)
            refreshState()
            // Notify parent if milestone is now approved
            if (result.isApproved && onMilestoneApproved) {
                onMilestoneApproved(milestoneId)
            }
        } catch (e) {
            setError(e.message)
        } finally {
            setVoteLoading(null)
        }
    }

    // ── STEP 4 handler: Release funds ─────────────────────────────────────────
    const handleRelease = async (milestoneId, amountBch) => {
        setError('')
        setReleaseId(milestoneId)
        try {
            const txId = await releaseMilestoneFunds(wallet, amountBch, PROJECT_ADDRESS)
            setReleaseTxId(prev => ({ ...prev, [milestoneId]: txId }))
            refreshState()
        } catch (e) {
            setError(e.message || 'Release failed')
        } finally {
            setReleaseId(null)
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="mb-6 space-y-4">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="card-glass rounded-2xl p-6">
                <WeekBadge />

                {/* Token + Lock stats */}
                <div className="grid grid-cols-2 gap-4 mt-5 mb-5">
                    <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">GOV Tokens</p>
                        <p className="text-2xl font-bold" style={{ color: '#a78bfa' }}>{tokenBal}</p>
                        <p className="text-xs text-slate-500 mt-0.5">= {tokenBal} votes</p>
                    </div>
                    <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Locked BCH</p>
                        <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>{lockedBch.toFixed(4)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">in contract</p>
                    </div>
                </div>

                {/* ── Mint section ──────────────────────────────────────────── */}
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                        <span>🪙</span> Step 1 — Lock BCH &amp; Mint Governance Tokens
                    </p>
                    <p className="text-slate-500 text-xs mb-3 leading-relaxed">
                        Lock BCH into the milestone contract. You receive <strong className="text-violet-400">100 GOV tokens per 0.001 BCH</strong> — each token = 1 vote.
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
                            className="px-5 py-3 rounded-xl font-bold text-white gradient-btn flex items-center gap-2 disabled:opacity-60"
                        >
                            {mintLoading ? <><Spinner /> Minting…</> : '⚡ Lock & Mint'}
                        </button>
                    </div>

                    {/* Mint result */}
                    {mintResult && (
                        <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
                            <p className="text-violet-300 text-xs font-semibold mb-1">✅ Tokens Minted!</p>
                            <p className="text-slate-400 text-xs">You received <strong className="text-violet-400">{mintResult.tokenAmount} GOV tokens</strong></p>
                            <p className="text-slate-500 text-xs mt-0.5 font-mono break-all">
                                Category: {mintResult.tokenCategory?.slice(0, 20)}…
                            </p>
                            {!mintResult.tokenCategory?.startsWith('simulated_') && (
                                <a
                                    href={chipnetExplorerUrl(mintResult.simulatedTxId)}
                                    target="_blank" rel="noreferrer"
                                    className="text-violet-400 text-xs underline"
                                >
                                    View on Chipnet Explorer ↗
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Milestone Voting Cards ───────────────────────────────────── */}
            {milestones.length > 0 && (
                <div className="card-glass rounded-2xl p-6">
                    <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                        <span>🗳️</span> Step 2 — Token-Weighted Governance Voting
                    </p>
                    <p className="text-slate-500 text-xs mb-4 leading-relaxed">
                        Use your GOV tokens to vote on milestones. &gt;50% YES unlocks release. Each token spent = permanent vote.
                    </p>

                    {/* Tokens per vote selector */}
                    <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="text-slate-400 text-xs">Tokens per vote:</span>
                        {[1, 5, 10, 25].map(n => (
                            <button
                                key={n}
                                onClick={() => setVoteTokens(n)}
                                className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                                style={{
                                    background: voteTokens === n ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.08)',
                                    border: `1px solid ${voteTokens === n ? 'rgba(139,92,246,0.6)' : 'rgba(139,92,246,0.2)'}`,
                                    color: voteTokens === n ? '#c4b5fd' : '#7c3aed',
                                }}
                            >
                                {n}
                            </button>
                        ))}
                        <span className="text-slate-600 text-xs ml-auto">You have {tokenBal} tokens</span>
                    </div>

                    <div className="space-y-4">
                        {milestones.map((m, idx) => {
                            const votes = milestoneVotes[m.id] || { yes: 0, no: 0 }
                            const total = votes.yes + votes.no
                            const approved = total > 0 && (votes.yes / total) > 0.5
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
                                    {/* Milestone header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                                                style={{ background: approved ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)', color: approved ? '#10b981' : '#a78bfa' }}>
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

                                    {/* Vote bar */}
                                    {total > 0 && <VoteBar votes={votes} />}
                                    {total === 0 && (
                                        <p className="text-slate-600 text-xs mb-3">No votes yet. Be the first!</p>
                                    )}

                                    {/* Vote buttons */}
                                    {!approved && (
                                        <div className="flex gap-2 mb-3">
                                            <button
                                                id={`gov-vote-yes-${idx}`}
                                                onClick={() => handleVote(m.id, 'yes')}
                                                disabled={voteLoading === m.id + 'yes' || tokenBal < voteTokens}
                                                className="flex-1 py-2 rounded-xl font-bold text-sm text-white gradient-btn-green flex items-center justify-center gap-1.5 disabled:opacity-50"
                                            >
                                                {voteLoading === m.id + 'yes' ? <Spinner /> : '👍'}
                                                YES ({voteTokens} token{voteTokens > 1 ? 's' : ''})
                                            </button>
                                            <button
                                                id={`gov-vote-no-${idx}`}
                                                onClick={() => handleVote(m.id, 'no')}
                                                disabled={voteLoading === m.id + 'no' || tokenBal < voteTokens}
                                                className="flex-1 py-2 rounded-xl font-bold text-sm text-white gradient-btn-red flex items-center justify-center gap-1.5 disabled:opacity-50"
                                            >
                                                {voteLoading === m.id + 'no' ? <Spinner /> : '👎'}
                                                NO ({voteTokens} token{voteTokens > 1 ? 's' : ''})
                                            </button>
                                        </div>
                                    )}

                                    {/* Release button — only shows after approval */}
                                    {approved && !txId && (
                                        <div className="mt-2">
                                            <p className="text-emerald-400 text-xs mb-2 font-semibold">
                                                🎉 Milestone approved! Ready to release funds.
                                            </p>
                                            <button
                                                id={`release-funds-${idx}`}
                                                onClick={() => handleRelease(m.id, 0.001)}
                                                disabled={releaseId === m.id}
                                                className="w-full py-2.5 rounded-xl font-bold text-sm text-white gradient-btn flex items-center justify-center gap-2 disabled:opacity-60"
                                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                                            >
                                                {releaseId === m.id ? <><Spinner /> Releasing…</> : '🚀 Release 0.001 BCH to Project'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Tx success */}
                                    {txId && (
                                        <div className="mt-2 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                                            <p className="text-emerald-400 text-xs font-bold mb-1">✅ Funds Released!</p>
                                            <p className="text-slate-500 text-xs font-mono break-all">{txId}</p>
                                            <a
                                                href={chipnetExplorerUrl(txId)}
                                                target="_blank" rel="noreferrer"
                                                className="text-emerald-400 text-xs underline mt-1 inline-block"
                                            >
                                                View on Chipnet Explorer ↗
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.25)' }}>
                    <span className="text-rose-400">⚠</span>
                    <p className="text-rose-300 text-sm flex-1">{error}</p>
                    <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-200">×</button>
                </div>
            )}

            {/* Explainer */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-slate-600 text-xs leading-relaxed">
                    <strong className="text-slate-500">How it works:</strong> Lock BCH → get GOV tokens → vote YES on milestones →
                    once a milestone hits &gt;50% YES votes → release funds to the project team.
                    Built on Bitcoin Cash Chipnet with CashScript + CashTokens. 🔐
                </p>
            </div>
        </div>
    )
}

// ── Week Badge ────────────────────────────────────────────────────────────────
function WeekBadge() {
    return (
        <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <div>
                <h2 className="text-white font-bold text-base">Governance &amp; Milestone Locking</h2>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                        Week 3
                    </span>
                    <span className="text-slate-600 text-xs">CashScript + CashTokens · Chipnet</span>
                </div>
            </div>
        </div>
    )
}
