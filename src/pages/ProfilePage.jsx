import React, { useState, useEffect } from 'react'
import { Copy, CheckCircle, Wallet, Shield, ExternalLink, LogOut, Key } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { getLockedAmount } from '../services/milestoneContract'
import { transferGovTokens } from '../services/govService'

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value, mono = false, color = '#94a3b8' }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: '0.82rem', color, fontWeight: 700, fontFamily: mono ? 'monospace' : 'inherit', maxWidth: '260px', wordBreak: 'break-all', textAlign: 'right' }}>
                {value}
            </span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
    const { wallet, address, balance, disconnect } = useWallet()
    const [tokens, setTokens] = useState(0)
    const [locked, setLocked] = useState(0)
    const [loading, setLoading] = useState(false)
    const [showWif, setShowWif] = useState(false)
    const [copied, setCopied] = useState(false)

    // Token transfer state
    const [recipient, setRecipient] = useState('')
    const [sendAmount, setSendAmount] = useState('')
    const [txLoading, setTxLoading] = useState(false)
    const [txStatus, setTxStatus] = useState({ type: '', msg: '', txId: '' })

    useEffect(() => {
        const loadStats = async () => {
            if (wallet) {
                setLoading(true)
                try {
                    const { getTokenBalance } = await import('../services/bchWallet')
                    const tks = await getTokenBalance(wallet)
                    setTokens(tks)
                    setLocked(getLockedAmount())
                } catch (err) {
                    console.error('[ProfilePage] Stats fail:', err)
                } finally {
                    setLoading(false)
                }
            }
        }
        loadStats()
    }, [wallet])

    const handleCopy = () => {
        if (!address) return
        navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDisconnect = () => {
        disconnect()
        setTokens(0)
        setLocked(0)
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                    Profile
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Your non-custodial wallet identity</p>
            </div>

            {/* Wallet card */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px', padding: '28px', backdropFilter: 'blur(20px)', marginBottom: '20px' }}>
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(16,185,129,0.4)' }}>
                        <Wallet size={26} color="white" />
                    </div>
                    <div>
                        <p style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.1rem' }}>BCH Wallet</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: address ? '#10b981' : '#475569', boxShadow: address ? '0 0 6px rgba(16,185,129,0.8)' : 'none' }} />
                            <span style={{ fontSize: '0.75rem', color: address ? '#10b981' : '#475569', fontWeight: 600 }}>
                                {address ? 'Non-Custodial · Chipnet' : 'Session Inactive'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Details */}
                {address ? (
                    <>
                        <InfoRow label="Wallet Address" value={address} mono color="#10b981" />
                        <InfoRow label="BCH Balance" value={`${(balance || 0).toFixed(8)} BCH`} color="#10b981" />
                        <InfoRow label="Network" value="Bitcoin Cash Chipnet (Testnet)" color="#34d399" />
                        <InfoRow label="GOV Tokens" value={`${tokens} tokens`} color="#10b981" />
                        <InfoRow label="Locked BCH" value={`${locked.toFixed(8)} BCH`} color="#34d399" />

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button
                                onClick={handleCopy}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                    background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                                    border: copied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(16,185,129,0.25)',
                                    color: copied ? '#10b981' : '#34d399', fontWeight: 700, fontSize: '0.82rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s',
                                }}
                            >
                                {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy Address</>}
                            </button>
                            <a
                                href={`https://chipnet.imaginary.cash/address/${address}`}
                                target="_blank" rel="noreferrer"
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                    background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
                                    color: '#06b6d4', fontWeight: 700, fontSize: '0.82rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    textDecoration: 'none', transition: 'all 0.2s',
                                }}
                            >
                                <ExternalLink size={14} /> View on Explorer
                            </a>
                        </div>

                        {/* Secret Recovery Section */}
                        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(244,63,94,0.03)', border: '1px solid rgba(244,63,94,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Key size={14} color="#f43f5e" />
                                <span style={{ color: '#f43f5e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Backup Key (WIF)</span>
                            </div>

                            {!showWif ? (
                                <button
                                    onClick={() => setShowWif(true)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px dashed rgba(244,63,94,0.3)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Reveal Secret Recovery Key
                                </button>
                            ) : (
                                <div style={{ wordBreak: 'break-all', fontSize: '0.75rem', color: '#fda4af', border: '1px solid rgba(244,63,94,0.2)', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace' }}>
                                    {wallet?.privateKeyWif}
                                    <p style={{ marginTop: '10px', fontSize: '10px', color: '#f43f5e', fontWeight: 600 }}>⚠️ NEVER share this key. Anyone with this key can steal your funds.</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '16px' }}>
                            Go to <strong style={{ color: '#10b981' }}>Projects</strong> and connect your wallet to see your profile details.
                        </p>
                    </div>
                )}
            </div>

            {/* Security card */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Shield size={16} color="#fbbf24" />
                    <h2 style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Security Protocol
                    </h2>
                </div>
                {[
                    'Self-Custody: You own your keys. We never store them on any server.',
                    'Persistent Identity: Your wallet is saved in your browser until you disconnect.',
                    'Burner-to-Account: By backing up your Recovery Key, you can restore this wallet anywhere.',
                    'Chipnet Only: This wallet operates on the test network for safety.',
                ].map((note, i) => (
                    <p key={i} style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.7 }}>• {note}</p>
                ))}
            </div>

            {/* Disconnect */}
            {address && (
                <button
                    onClick={handleDisconnect}
                    style={{
                        width: '100%', padding: '12px', borderRadius: '12px', cursor: 'pointer',
                        background: 'rgba(225,29,72,0.07)', border: '1px solid rgba(225,29,72,0.2)',
                        color: '#f87171', fontWeight: 700, fontSize: '0.875rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
                    }}
                >
                    <LogOut size={16} /> Disconnect &amp; Remove Wallet
                </button>
            )}

            {/* ── Token Transfer Section ────────────────────────────────────────── */}
            {address && (
                <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)', marginTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <CheckCircle size={16} color="#10b981" />
                        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Send GOV Tokens
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>Recipient Address</label>
                            <input
                                type="text"
                                placeholder="bchtest:..."
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                style={{
                                    background: 'rgba(15,17,35,0.6)', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '10px', padding: '10px 14px', color: '#f1f5f9', fontSize: '0.85rem', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>Amount (GOV)</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={sendAmount}
                                onChange={(e) => setSendAmount(e.target.value)}
                                style={{
                                    background: 'rgba(15,17,35,0.6)', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '10px', padding: '10px 14px', color: '#f1f5f9', fontSize: '0.85rem', outline: 'none'
                                }}
                            />
                        </div>

                        <button
                            onClick={async () => {
                                if (!recipient || !sendAmount || txLoading) return
                                setTxLoading(true)
                                setTxStatus({ type: '', msg: '', txId: '' })
                                try {
                                    const res = await transferGovTokens(wallet, recipient, parseInt(sendAmount))
                                    setTxStatus({ type: 'success', msg: `Sent ${sendAmount} tokens!`, txId: res.txId })
                                    setSendAmount('')
                                    // Stats are auto-refreshed by useEffect [wallet] if we triggered an on-chain change
                                } catch (err) {
                                    setTxStatus({ type: 'error', msg: err.message })
                                } finally {
                                    setTxLoading(false)
                                }
                            }}
                            disabled={txLoading || !recipient || !sendAmount}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '12px', cursor: 'pointer',
                                background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none',
                                color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                                opacity: (txLoading || !recipient || !sendAmount) ? 0.5 : 1, transition: 'all 0.2s',
                                marginTop: '8px'
                            }}
                        >
                            {txLoading ? 'Broadcasting...' : 'Transfer Tokens'}
                        </button>

                        {txStatus.msg && (
                            <div style={{
                                marginTop: '12px', padding: '10px', borderRadius: '8px', fontSize: '0.8rem',
                                background: txStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${txStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                color: txStatus.type === 'success' ? '#10b981' : '#f87171'
                            }}>
                                {txStatus.msg}
                                {txStatus.txId && (
                                    <div style={{ marginTop: '4px' }}>
                                        <a href={`https://chipnet.imaginary.cash/tx/${txStatus.txId}`} target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>
                                            View TX ↗
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
