/**
 * src/pages/LandingPage.jsx
 * Professional marketing landing page for Milestara.
 * Standalone page — no sidebar Layout wrapper.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'

// ── Palette ───────────────────────────────────────────────────────────────────
const GREEN = '#10b981'
const GREEN_DARK = '#059669'
const GREEN_BRIGHT = '#34d399'
const BG = '#0a0a0f'
const CARD_BG = 'rgba(15,17,35,0.85)'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT_PRIMARY = '#f1f5f9'
const TEXT_MUTED = '#64748b'

// ── Utility: animated number ──────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = '' }) {
    const [display, setDisplay] = useState(0)
    const raf = useRef(null)

    useEffect(() => {
        const parsed = parseFloat(String(target).replace(/[^0-9.]/g, '')) || 0
        const duration = 1200
        const start = performance.now()
        const step = (now) => {
            const progress = Math.min((now - start) / duration, 1)
            const ease = 1 - Math.pow(1 - progress, 3)
            setDisplay(parsed * ease)
            if (progress < 1) raf.current = requestAnimationFrame(step)
        }
        raf.current = requestAnimationFrame(step)
        return () => raf.current && cancelAnimationFrame(raf.current)
    }, [target])

    const raw = parseFloat(String(target).replace(/[^0-9.]/g, '')) || 0
    const isDecimal = String(target).includes('.')
    return (
        <span>
            {isDecimal ? display.toFixed(3) : Math.round(display).toLocaleString()}
            {suffix}
        </span>
    )
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
    const navigate = useNavigate()
    const [scrolled, setScrolled] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handler)
        return () => window.removeEventListener('scroll', handler)
    }, [])

    const scrollTo = (id) => {
        setMobileOpen(false)
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }

    return (
        <nav style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            transition: 'all 0.3s ease',
            background: scrolled ? 'rgba(10,10,15,0.95)' : 'transparent',
            backdropFilter: scrolled ? 'blur(20px)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(16,185,129,0.15)' : '1px solid transparent',
            boxShadow: scrolled ? '0 4px 32px rgba(0,0,0,0.4)' : 'none',
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: '72px', justifyContent: 'space-between' }}>

                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <div style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 0 18px rgba(16,185,129,0.35)`,
                        fontSize: '18px', fontWeight: 800, color: '#fff',
                    }}>M</div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: '-0.02em', lineHeight: 1 }}>Milestara</div>
                        <div style={{
                            fontSize: '0.6rem', fontWeight: 700, color: GREEN,
                            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                            borderRadius: '999px', padding: '1px 7px', letterSpacing: '0.08em',
                            marginTop: '3px', display: 'inline-block',
                        }}>BCH CHIPNET</div>
                    </div>
                </div>

                {/* Desktop Nav Links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {[
                        { label: 'How it Works', id: 'how-it-works' },
                        { label: 'Projects', id: 'features' },
                        { label: 'Governance', id: 'features' },
                        { label: 'Docs', id: null, to: '/docs' },
                    ].map(({ label, id, to }) => (
                        <button
                            key={label}
                            onClick={() => to ? navigate(to) : id ? scrollTo(id) : null}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: TEXT_MUTED, fontSize: '0.875rem', fontWeight: 500,
                                padding: '8px 14px', borderRadius: '8px',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = TEXT_PRIMARY; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = TEXT_MUTED; e.currentTarget.style.background = 'none' }}
                        >{label}</button>
                    ))}
                </div>

                {/* Launch App */}
                <button
                    onClick={() => navigate('/projects')}
                    style={{
                        padding: '10px 22px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`,
                        color: '#fff', fontWeight: 700, fontSize: '0.875rem',
                        boxShadow: `0 0 20px rgba(16,185,129,0.3)`,
                        transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 0 30px rgba(16,185,129,0.5)` }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 0 20px rgba(16,185,129,0.3)` }}
                >
                    Launch App →
                </button>
            </div>
        </nav>
    )
}

// ── Hero Section ──────────────────────────────────────────────────────────────
function Hero() {
    const navigate = useNavigate()
    return (
        <section style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden', padding: '120px 24px 80px',
            background: BG,
        }}>
            {/* Ambient glow orbs */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                    position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
                    width: '700px', height: '500px', borderRadius: '50%',
                    background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                }} />
                <div style={{
                    position: 'absolute', top: '30%', left: '10%',
                    width: '400px', height: '400px', borderRadius: '50%',
                    background: 'radial-gradient(ellipse, rgba(6,182,212,0.06) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                }} />
                <div style={{
                    position: 'absolute', bottom: '10%', right: '10%',
                    width: '350px', height: '350px', borderRadius: '50%',
                    background: 'radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                }} />
                {/* Grid overlay */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px',
                }} />
            </div>

            <div style={{ position: 'relative', zIndex: 1, maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
                {/* Live badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '6px 16px', borderRadius: '999px', marginBottom: '32px',
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', background: GREEN,
                        boxShadow: `0 0 8px ${GREEN}`,
                        animation: 'pulse-dot 2s ease-in-out infinite',
                    }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: GREEN_BRIGHT, letterSpacing: '0.08em' }}>
                        LIVE ON CHIPNET TESTNET
                    </span>
                </div>

                {/* Main heading */}
                <h1 style={{
                    fontSize: 'clamp(2.4rem, 6vw, 4.2rem)', fontWeight: 900,
                    lineHeight: 1.1, letterSpacing: '-0.04em',
                    marginBottom: '24px', color: TEXT_PRIMARY,
                }}>
                    Milestone-Based Funding{' '}
                    <span style={{
                        background: `linear-gradient(135deg, ${GREEN}, ${GREEN_BRIGHT})`,
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}>
                        on Bitcoin Cash
                    </span>
                </h1>

                {/* Subheading */}
                <p style={{
                    fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8',
                    lineHeight: 1.7, maxWidth: '620px', margin: '0 auto 40px',
                    fontWeight: 400,
                }}>
                    Lock funds in smart contracts. Release only when milestones are verified
                    by community governance and oracle approval.
                </p>

                {/* CTA Buttons */}
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate('/projects')}
                        style={{
                            padding: '14px 32px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                            background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`,
                            color: '#fff', fontWeight: 700, fontSize: '1rem',
                            boxShadow: `0 0 30px rgba(16,185,129,0.35), 0 4px 16px rgba(0,0,0,0.3)`,
                            transition: 'all 0.25s ease', letterSpacing: '-0.01em',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 45px rgba(16,185,129,0.55), 0 8px 24px rgba(0,0,0,0.4)` }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 0 30px rgba(16,185,129,0.35), 0 4px 16px rgba(0,0,0,0.3)` }}
                    >
                        🚀 Launch App
                    </button>
                    <button
                        onClick={() => navigate('/docs')}
                        style={{
                            padding: '14px 32px', borderRadius: '12px', cursor: 'pointer',
                            background: 'transparent', border: `1.5px solid rgba(16,185,129,0.35)`,
                            color: GREEN_BRIGHT, fontWeight: 600, fontSize: '1rem',
                            transition: 'all 0.25s ease', letterSpacing: '-0.01em',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; e.currentTarget.style.borderColor = `rgba(16,185,129,0.6)` }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `rgba(16,185,129,0.35)` }}
                    >
                        View Docs ↗
                    </button>
                </div>

                {/* Decorative chain visual */}
                <div style={{ marginTop: '72px', display: 'flex', justifyContent: 'center', gap: '0' }}>
                    {['Lock BCH', '→', 'Community Vote', '→', 'Oracle Release'].map((label, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center',
                            fontSize: i % 2 === 1 ? '1.1rem' : '0.72rem',
                            fontWeight: i % 2 === 1 ? 400 : 700,
                            color: i % 2 === 1 ? 'rgba(16,185,129,0.4)' : TEXT_MUTED,
                            padding: i % 2 === 1 ? '0 8px' : '8px 16px',
                            background: i % 2 === 1 ? 'none' : 'rgba(255,255,255,0.03)',
                            border: i % 2 === 1 ? 'none' : '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '8px',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                        }}>{label}</div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.3); }
                }
            `}</style>
        </section>
    )
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar() {
    const [stats, setStats] = useState({ projects: 0, bchRaised: '0.000', members: 852, votes: 0 })
    const [loading, setLoading] = useState(true)
    const [visible, setVisible] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.3 })
        if (ref.current) obs.observe(ref.current)
        return () => obs.disconnect()
    }, [])

    useEffect(() => {
        if (!supabaseConfigured || !supabase) { setLoading(false); return }
        ;(async () => {
            try {
                const [projRes, voteRes] = await Promise.all([
                    supabase.from('projects').select('raised_amount', { count: 'exact' }),
                    supabase.from('votes').select('id', { count: 'exact' }),
                ])
                const totalRaised = (projRes.data ?? []).reduce((s, p) => s + parseFloat(p.raised_amount || 0), 0)
                setStats({ projects: projRes.count ?? 0, bchRaised: totalRaised.toFixed(3), members: 852, votes: voteRes.count ?? 0 })
            } catch { }
            setLoading(false)
        })()
    }, [])

    const items = [
        { label: 'Total Funded', value: stats.bchRaised, suffix: ' BCH', color: GREEN },
        { label: 'Active Projects', value: stats.projects, suffix: '', color: GREEN_BRIGHT },
        { label: 'Community Members', value: stats.members, suffix: '+', color: '#06b6d4' },
        { label: 'Votes Cast', value: stats.votes, suffix: '', color: '#a78bfa' },
    ]

    return (
        <section id="stats" ref={ref} style={{
            background: 'rgba(10,10,15,0.95)',
            borderTop: '1px solid rgba(16,185,129,0.1)',
            borderBottom: '1px solid rgba(16,185,129,0.1)',
            padding: '40px 24px',
        }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0' }}>
                {items.map(({ label, value, suffix, color }, i) => (
                    <div key={label} style={{
                        textAlign: 'center', padding: '20px 24px',
                        borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}>
                        <div style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, color, lineHeight: 1, marginBottom: '8px' }}>
                            {loading || !visible ? (
                                <div style={{ width: '80px', height: '36px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', display: 'inline-block', animation: 'pulse-skeleton 1.5s ease-in-out infinite' }} />
                            ) : (
                                <AnimatedNumber target={value} suffix={suffix} />
                            )}
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                    </div>
                ))}
            </div>
            <style>{`@keyframes pulse-skeleton { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </section>
    )
}

// ── How It Works ──────────────────────────────────────────────────────────────
function HowItWorks() {
    const steps = [
        {
            num: '01',
            title: 'Create Project',
            desc: 'Define milestones, set funding targets, and lock BCH in a CashScript escrow contract on the Chipnet testnet.',
            icon: '📋',
            color: GREEN,
        },
        {
            num: '02',
            title: 'Community Votes',
            desc: 'GOV token holders review milestone evidence and vote on completion. Token-weighted governance ensures fair decisions.',
            icon: '🗳️',
            color: GREEN_BRIGHT,
        },
        {
            num: '03',
            title: 'Oracle Release',
            desc: 'Once verified, an oracle signature automatically releases the escrowed funds directly to the project creator.',
            icon: '⚡',
            color: '#06b6d4',
        },
    ]

    return (
        <section id="how-it-works" style={{ padding: '100px 24px', background: BG }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                {/* Section heading */}
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <div style={{
                        display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
                        color: GREEN, background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        borderRadius: '999px', padding: '4px 14px', letterSpacing: '0.1em',
                        marginBottom: '16px', textTransform: 'uppercase',
                    }}>How It Works</div>
                    <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, color: TEXT_PRIMARY, letterSpacing: '-0.03em', marginBottom: '16px' }}>
                        Simple. Trustless. Transparent.
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
                        Three steps to fully trustless milestone-based funding on Bitcoin Cash.
                    </p>
                </div>

                {/* Steps */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '24px', position: 'relative' }}>
                    {/* Connector line */}
                    <div style={{
                        position: 'absolute', top: '52px', left: 'calc(16.67% + 24px)', right: 'calc(16.67% + 24px)',
                        height: '1px',
                        background: `linear-gradient(90deg, ${GREEN}40, ${GREEN_BRIGHT}40, #06b6d440)`,
                        zIndex: 0,
                    }} />

                    {steps.map(({ num, title, desc, icon, color }) => (
                        <div key={num} style={{
                            background: CARD_BG, border: `1px solid ${color}20`,
                            borderRadius: '20px', padding: '36px 28px',
                            backdropFilter: 'blur(20px)',
                            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                            position: 'relative', zIndex: 1,
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 16px 48px ${color}20` }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                        >
                            {/* Step number badge */}
                            <div style={{
                                width: '52px', height: '52px', borderRadius: '14px',
                                background: `${color}15`, border: `1.5px solid ${color}35`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.4rem', marginBottom: '20px',
                                boxShadow: `0 0 20px ${color}20`,
                            }}>{icon}</div>

                            <div style={{
                                fontSize: '0.65rem', fontWeight: 800, color,
                                letterSpacing: '0.12em', marginBottom: '10px', textTransform: 'uppercase',
                            }}>STEP {num}</div>

                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: TEXT_PRIMARY, marginBottom: '12px', letterSpacing: '-0.02em' }}>
                                {title}
                            </h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.65 }}>
                                {desc}
                            </p>

                            {/* Bottom accent */}
                            <div style={{
                                position: 'absolute', bottom: 0, left: '28px', right: '28px', height: '2px',
                                background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
                                borderRadius: '999px',
                            }} />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

// ── Features Section ──────────────────────────────────────────────────────────
function Features() {
    const features = [
        {
            icon: '📜',
            title: 'CashScript Smart Contracts',
            desc: 'Battle-tested CashScript contracts hold funds in escrow with verifiable, transparent on-chain logic. No central custodian.',
            color: GREEN,
        },
        {
            icon: '🔮',
            title: 'Oracle-Protected Releases',
            desc: 'An independent oracle validates milestone completion off-chain, then co-signs the release transaction on-chain.',
            color: '#06b6d4',
        },
        {
            icon: '🏛️',
            title: 'Token-Weighted Governance',
            desc: 'GOV tokens represent voting power. Every BCH funded earns tokens — aligning stakeholder incentives with project success.',
            color: '#a78bfa',
        },
        {
            icon: '🧪',
            title: 'Chipnet Testnet Live',
            desc: 'Battle-test your funding proposals risk-free on the BCH Chipnet before mainnet deployment. Real contracts, real feedback.',
            color: GREEN_BRIGHT,
        },
    ]

    return (
        <section id="features" style={{
            padding: '100px 24px',
            background: `linear-gradient(180deg, ${BG} 0%, rgba(10,12,20,1) 100%)`,
        }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <div style={{
                        display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
                        color: '#a78bfa', background: 'rgba(167,139,250,0.1)',
                        border: '1px solid rgba(167,139,250,0.25)',
                        borderRadius: '999px', padding: '4px 14px', letterSpacing: '0.1em',
                        marginBottom: '16px', textTransform: 'uppercase',
                    }}>Platform Features</div>
                    <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 900, color: TEXT_PRIMARY, letterSpacing: '-0.03em', marginBottom: '16px' }}>
                        Built for Trustless Funding
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
                        Every component engineered for transparency, security, and decentralisation.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '20px' }}>
                    {features.map(({ icon, title, desc, color }) => (
                        <div key={title} style={{
                            background: CARD_BG, border: `1px solid ${BORDER}`,
                            borderRadius: '20px', padding: '32px',
                            backdropFilter: 'blur(20px)',
                            display: 'flex', gap: '20px', alignItems: 'flex-start',
                            transition: 'all 0.25s ease',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}35`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${color}15` }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                        >
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '14px', flexShrink: 0,
                                background: `${color}12`, border: `1.5px solid ${color}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem',
                            }}>{icon}</div>
                            <div>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: TEXT_PRIMARY, marginBottom: '8px', letterSpacing: '-0.02em' }}>{title}</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.65 }}>{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

// ── CTA Banner ────────────────────────────────────────────────────────────────
function CTABanner() {
    const navigate = useNavigate()
    return (
        <section style={{ padding: '80px 24px', background: BG }}>
            <div style={{ maxWidth: '780px', margin: '0 auto', textAlign: 'center' }}>
                <div style={{
                    background: `linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.05))`,
                    border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: '24px', padding: '60px 40px',
                    position: 'relative', overflow: 'hidden',
                }}>
                    {/* Glow */}
                    <div style={{
                        position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
                        width: '400px', height: '300px',
                        background: 'radial-gradient(ellipse, rgba(16,185,129,0.12) 0%, transparent 70%)',
                        filter: 'blur(30px)', pointerEvents: 'none',
                    }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, color: TEXT_PRIMARY, letterSpacing: '-0.03em', marginBottom: '16px' }}>
                            Ready to fund your vision?
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, marginBottom: '36px', maxWidth: '440px', margin: '0 auto 36px' }}>
                            Launch a milestone-based project on Chipnet today — no trust required, just code.
                        </p>
                        <button
                            onClick={() => navigate('/projects')}
                            style={{
                                padding: '14px 36px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`,
                                color: '#fff', fontWeight: 700, fontSize: '1rem',
                                boxShadow: `0 0 30px rgba(16,185,129,0.4)`,
                                transition: 'all 0.25s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 45px rgba(16,185,129,0.6)` }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 0 30px rgba(16,185,129,0.4)` }}
                        >Get Started →</button>
                    </div>
                </div>
            </div>
        </section>
    )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
    return (
        <footer style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(8,8,12,1)',
            padding: '48px 24px 32px',
        }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '32px', marginBottom: '40px' }}>
                    {/* Brand */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px',
                                background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '15px', fontWeight: 800, color: '#fff',
                            }}>M</div>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: TEXT_PRIMARY }}>Milestara</span>
                        </div>
                        <p style={{ color: TEXT_MUTED, fontSize: '0.825rem', maxWidth: '240px', lineHeight: 1.6 }}>
                            Milestone-based crowdfunding secured by Bitcoin Cash smart contracts.
                        </p>
                    </div>

                    {/* Links */}
                    <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Platform</div>
                            {['Projects', 'Governance', 'Transactions', 'Dashboard'].map(l => (
                                <div key={l} style={{ marginBottom: '10px' }}>
                                    <a href={`/${l.toLowerCase()}`} style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.color = GREEN}
                                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                    >{l}</a>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Community</div>
                            {[
                                { label: 'GitHub', href: 'https://github.com/jeevansridharan/bch1' },
                                { label: 'Twitter', href: 'https://twitter.com/jovan_0406' },
                                { label: 'Contact', href: 'mailto:contact@milestara.io' },
                            ].map(({ label, href }) => (
                                <div key={label} style={{ marginBottom: '10px' }}>
                                    <a href={href} target="_blank" rel="noopener noreferrer"
                                        style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.color = GREEN}
                                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                    >{label} ↗</a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '24px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
                }}>
                    <span style={{ fontSize: '0.78rem', color: TEXT_MUTED }}>
                        © {new Date().getFullYear()} Milestara. All rights reserved.
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: `linear-gradient(135deg, ${GREEN_DARK}, ${GREEN})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: '#fff' }}>₿</div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: TEXT_MUTED }}>Built on Bitcoin Cash</span>
                    </div>
                </div>
            </div>
        </footer>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
    return (
        <div style={{ background: BG, minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
            <Navbar />
            <Hero />
            <StatsBar />
            <HowItWorks />
            <Features />
            <CTABanner />
            <Footer />
        </div>
    )
}
