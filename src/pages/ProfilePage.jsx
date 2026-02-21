/**
 * pages/ProfilePage.jsx
 * Wallet identity + account overview.
 */

import React, { useState, useEffect } from 'react'
import { Copy, CheckCircle, Wallet, Shield, ExternalLink, LogOut } from 'lucide-react'
import { createOrLoadWallet, disconnectWallet } from '../services/bchWallet'
import { getTokenBalance, getLockedAmount } from '../services/milestoneContract'

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
    const [address, setAddress] = useState('')
    const [copied, setCopied] = useState(false)
    const [tokens, setTokens] = useState(0)
    const [locked, setLocked] = useState(0)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const savedWif = localStorage.getItem('milestara_chipnet_wif')
        if (savedWif) {
            ; (async () => {
                setLoading(true)
                try {
                    const w = await createOrLoadWallet()
                    setAddress(w.cashaddr)
                } catch (e) {
                    console.error(e)
                } finally {
                    setLoading(false)
                }
            })()
        }
        setTokens(getTokenBalance())
        setLocked(getLockedAmount())
    }, [])

    const handleCopy = () => {
        if (!address) return
        navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDisconnect = () => {
        disconnectWallet()
        setAddress('')
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
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Your wallet identity on Milestara</p>
            </div>

            {/* Wallet card */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '16px', padding: '28px', backdropFilter: 'blur(20px)', marginBottom: '20px' }}>
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}>
                        <Wallet size={26} color="white" />
                    </div>
                    <div>
                        <p style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.1rem' }}>BCH Wallet</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: address ? '#10b981' : '#475569', boxShadow: address ? '0 0 6px rgba(16,185,129,0.8)' : 'none' }} />
                            <span style={{ fontSize: '0.75rem', color: address ? '#10b981' : '#475569', fontWeight: 600 }}>
                                {address ? 'Connected · Chipnet' : 'Not connected'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Details */}
                {address ? (
                    <>
                        <InfoRow label="Wallet Address" value={address} mono color="#a78bfa" />
                        <InfoRow label="Network" value="BCH Chipnet (Testnet)" color="#10b981" />
                        <InfoRow label="GOV Tokens" value={`${tokens} tokens`} color="#7c3aed" />
                        <InfoRow label="Locked BCH" value={`${locked.toFixed(6)} BCH`} color="#10b981" />

                        {/* Copy + explorer buttons */}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button
                                onClick={handleCopy}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                    background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.1)',
                                    border: copied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(139,92,246,0.25)',
                                    color: copied ? '#10b981' : '#a78bfa', fontWeight: 700, fontSize: '0.82rem',
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
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '16px' }}>
                            Go to <strong style={{ color: '#a78bfa' }}>Projects</strong> and click <strong style={{ color: '#a78bfa' }}>Connect Wallet</strong> to get started.
                        </p>
                    </div>
                )}
            </div>

            {/* Security card */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Shield size={16} color="#f59e0b" />
                    <h2 style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Security Notes
                    </h2>
                </div>
                {[
                    'Your private key (WIF) is stored only in this browser\'s localStorage.',
                    'This is a TESTNET wallet. Never use real mainnet BCH here.',
                    'Clearing browser data will permanently delete your wallet.',
                    'The anon Supabase key is public — RLS policies protect your data.',
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
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(225,29,72,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(225,29,72,0.07)'}
                >
                    <LogOut size={16} /> Disconnect &amp; Clear Wallet
                </button>
            )}
        </div>
    )
}
