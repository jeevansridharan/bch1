/**
 * pages/DashboardPage.jsx
 * Overview stats + quick-access cards for the Milestara dashboard.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import {
    FolderKanban, Vote, ArrowLeftRight,
    TrendingUp, Zap, Shield, ChevronRight,
    Bitcoin
} from 'lucide-react'

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accentColor, Icon }) {
    return (
        <div style={{
            background: 'rgba(15,17,35,0.85)',
            border: `1px solid ${accentColor}30`,
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backdropFilter: 'blur(20px)',
            transition: 'transform 0.2s, box-shadow 0.2s',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${accentColor}20` }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${accentColor}15`, border: `1px solid ${accentColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={accentColor} />
                </div>
            </div>
            <div>
                <p style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '0.75rem', color: accentColor, fontWeight: 600, marginTop: '4px' }}>{sub}</p>
            </div>
        </div>
    )
}

// ── Quick action card ─────────────────────────────────────────────────────────
function QuickAction({ to, Icon, title, description, color }) {
    return (
        <Link to={to} style={{ textDecoration: 'none' }}>
            <div style={{
                background: 'rgba(15,17,35,0.85)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
            }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + '40'; e.currentTarget.style.background = `rgba(15,17,35,0.95)` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(15,17,35,0.85)' }}
            >
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem', marginBottom: '2px' }}>{title}</p>
                    <p style={{ color: '#475569', fontSize: '0.78rem' }}>{description}</p>
                </div>
                <ChevronRight size={16} color="#334155" />
            </div>
        </Link>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    return (
        <div>
            {/* ── Page header ──────────────────────────────────────────────── */}
            <div style={{ marginBottom: '36px' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '4px 12px', borderRadius: '999px', marginBottom: '12px',
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.8)' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.06em' }}>LIVE · CHIPNET TESTNET</span>
                </div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                    Welcome to Milestara
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                    Milestone-based funding platform on Bitcoin Cash
                </p>
            </div>

            {/* ── Stats grid ────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '32px' }}>
                <StatCard label="Total Projects" value="0" sub="Active on Chipnet" accentColor="#7c3aed" Icon={FolderKanban} />
                <StatCard label="BCH Raised" value="0.000" sub="Test BCH (tBCH)" accentColor="#10b981" Icon={Bitcoin} />
                <StatCard label="Votes Cast" value="0" sub="Governance tokens" accentColor="#06b6d4" Icon={Vote} />
            </div>

            {/* ── Quick actions ─────────────────────────────────────────────── */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                    Quick Actions
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <QuickAction to="/projects" Icon={FolderKanban} title="Create or Browse Projects" description="Fund a milestone-based project on Chipnet" color="#7c3aed" />
                    <QuickAction to="/governance" Icon={Vote} title="Governance Voting" description="Use GOV tokens to vote on milestones" color="#10b981" />
                    <QuickAction to="/transactions" Icon={ArrowLeftRight} title="Transaction History" description="View all on-chain BCH transactions" color="#06b6d4" />
                </div>
            </div>

            {/* ── How it works ──────────────────────────────────────────────── */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', backdropFilter: 'blur(20px)' }}>
                <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} color="#7c3aed" /> How Milestara Works
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
                    {[
                        { step: '01', title: 'Create Project', desc: 'Define milestones and funding target in BCH', color: '#7c3aed', Icon: FolderKanban },
                        { step: '02', title: 'Fund & Get Tokens', desc: 'Lock BCH → receive governance tokens (1 = 1 vote)', color: '#10b981', Icon: TrendingUp },
                        { step: '03', title: 'Vote & Release', desc: 'Approve milestones via token voting → release funds', color: '#06b6d4', Icon: Shield },
                    ].map(({ step, title, desc, color, Icon }) => (
                        <div key={step}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                <Icon size={18} color={color} />
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: color, letterSpacing: '0.1em', marginBottom: '4px' }}>STEP {step}</div>
                            <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px' }}>{title}</p>
                            <p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.5 }}>{desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
