/**
 * pages/GovernancePage.jsx
 * Token governance overview — standalone page for the Week 3 GOV system.
 */

import React from 'react'
import { Vote, Info, Coins, Shield, ChevronRight } from 'lucide-react'

// ── Info card ─────────────────────────────────────────────────────────────────
function InfoCard({ Icon, title, body, color }) {
    return (
        <div style={{
            background: 'rgba(15,17,35,0.85)',
            border: `1px solid ${color}20`,
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            gap: '16px',
            backdropFilter: 'blur(20px)',
        }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={color} />
            </div>
            <div>
                <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px' }}>{title}</p>
                <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.6 }}>{body}</p>
            </div>
        </div>
    )
}

// ── Step row ──────────────────────────────────────────────────────────────────
function Step({ num, text, color }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${color}20`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color }}>{num}</span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{text}</p>
            <ChevronRight size={14} color="#334155" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function GovernancePage() {
    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '4px 12px', borderRadius: '999px', marginBottom: '12px',
                    background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em' }}>WEEK 3 · CASHTOKENS</span>
                </div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                    Governance
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    Token-weighted milestone voting powered by CashTokens on Bitcoin Cash
                </p>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '28px' }}>
                {[
                    { label: 'GOV Tokens', value: '0', color: '#7c3aed' },
                    { label: 'Votes Cast', value: '0', color: '#10b981' },
                    { label: 'Approved', value: '0/0', color: '#06b6d4' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'rgba(15,17,35,0.85)', border: `1px solid ${color}20`, borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</p>
                        <p style={{ fontSize: '1.75rem', fontWeight: 800, color }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Info cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                <InfoCard Icon={Coins} color="#7c3aed" title="How GOV Tokens Work" body="Lock BCH into a milestone contract → receive 100 GOV tokens per 0.001 BCH. Each token equals 1 vote on any active milestone." />
                <InfoCard Icon={Vote} color="#10b981" title="Token-Weighted Voting" body="Cast votes using your GOV tokens. Tokens spent on voting are permanently consumed. If a milestone reaches >50% YES votes it is approved." />
                <InfoCard Icon={Shield} color="#06b6d4" title="CashScript Smart Contracts" body="Funds are locked in a CashScript contract on Chipnet. Release only happens after milestone approval — the contract enforces the owner signature." />
            </div>

            {/* How to vote — step guide */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Info size={16} color="#475569" />
                    <h2 style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        How to Participate in Governance
                    </h2>
                </div>
                <Step num="1" text="Go to Projects → create or open a project" color="#7c3aed" />
                <Step num="2" text='Connect your BCH wallet and click "Lock & Mint" to receive GOV tokens' color="#7c3aed" />
                <Step num="3" text="Select how many tokens to use per vote (1, 5, 10, or 25)" color="#10b981" />
                <Step num="4" text='Vote YES or NO on each milestone using your GOV tokens' color="#10b981" />
                <Step num="5" text='Once >50% YES → Release Funds button appears → click to send BCH to project' color="#06b6d4" />
            </div>
        </div>
    )
}
