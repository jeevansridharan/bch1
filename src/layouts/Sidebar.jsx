/**
 * Sidebar.jsx — Milestara left navigation sidebar
 * Collapsible · Active route highlighting · Smooth transitions
 */

import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    FolderKanban,
    Vote,
    ArrowLeftRight,
    UserCircle,
    ChevronLeft,
    ChevronRight,
    Zap,
} from 'lucide-react'

// ── Nav items definition ──────────────────────────────────────────────────────
const NAV_ITEMS = [
    { to: '/', label: 'Dashboard', Icon: LayoutDashboard },
    { to: '/projects', label: 'Projects', Icon: FolderKanban },
    { to: '/governance', label: 'Governance', Icon: Vote },
    { to: '/transactions', label: 'Transactions', Icon: ArrowLeftRight },
    { to: '/profile', label: 'Profile', Icon: UserCircle },
]

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false)

    const toggle = () => {
        const next = !collapsed
        setCollapsed(next)
        window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: next } }))
    }
    const location = useLocation()

    return (
        <aside
            style={{
                width: collapsed ? '72px' : '240px',
                minHeight: '100vh',
                background: 'linear-gradient(180deg, #0d0e1f 0%, #0a0b14 60%, #0d0f1e 100%)',
                borderRight: '1px solid rgba(139,92,246,0.12)',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 50,
                transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
                overflow: 'hidden',
            }}
        >
            {/* ── Logo ─────────────────────────────────────────────────────── */}
            <div
                style={{
                    padding: collapsed ? '20px 0' : '20px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    borderBottom: '1px solid rgba(139,92,246,0.1)',
                    minHeight: '72px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                }}
            >
                {/* Logo icon */}
                <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 0 20px rgba(124,58,237,0.4)',
                }}>
                    <Zap size={18} color="white" strokeWidth={2.5} />
                </div>

                {/* Brand name — hidden when collapsed */}
                {!collapsed && (
                    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                            Milestara
                        </span>
                        <div style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: '#10b981',
                            letterSpacing: '0.08em',
                            marginTop: '1px',
                        }}>
                            BCH · CHIPNET
                        </div>
                    </div>
                )}
            </div>

            {/* ── Nav items ────────────────────────────────────────────────── */}
            <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {NAV_ITEMS.map(({ to, label, Icon }) => {
                    // Exact match for dashboard, prefix match for others
                    const isActive = to === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(to)

                    return (
                        <NavLink
                            key={to}
                            to={to}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: collapsed ? '12px 0' : '11px 14px',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                borderRadius: '10px',
                                textDecoration: 'none',
                                transition: 'all 0.2s ease',
                                background: isActive
                                    ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.15))'
                                    : 'transparent',
                                border: isActive
                                    ? '1px solid rgba(139,92,246,0.3)'
                                    : '1px solid transparent',
                                position: 'relative',
                            }}
                            title={collapsed ? label : undefined}
                        >
                            {/* Active left bar */}
                            {isActive && (
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '3px',
                                    height: '60%',
                                    background: 'linear-gradient(180deg, #7c3aed, #4f46e5)',
                                    borderRadius: '0 3px 3px 0',
                                    boxShadow: '0 0 8px rgba(124,58,237,0.6)',
                                }} />
                            )}

                            <Icon
                                size={20}
                                color={isActive ? '#a78bfa' : '#475569'}
                                strokeWidth={isActive ? 2.5 : 2}
                                style={{ flexShrink: 0, transition: 'color 0.2s' }}
                            />

                            {!collapsed && (
                                <span style={{
                                    fontSize: '0.875rem',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? '#e2e8f0' : '#64748b',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    transition: 'color 0.2s',
                                    letterSpacing: '-0.01em',
                                }}>
                                    {label}
                                </span>
                            )}
                        </NavLink>
                    )
                })}
            </nav>

            {/* ── Network badge ─────────────────────────────────────────────── */}
            {!collapsed && (
                <div style={{
                    margin: '0 8px 12px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(16,185,129,0.07)',
                    border: '1px solid rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <div style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#10b981',
                        boxShadow: '0 0 6px rgba(16,185,129,0.8)',
                        flexShrink: 0,
                    }} />
                    <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>Chipnet Live</div>
                        <div style={{ fontSize: '0.65rem', color: '#475569' }}>BCH Testnet</div>
                    </div>
                </div>
            )}

            {/* ── Collapse toggle ───────────────────────────────────────────── */}
            <button
                onClick={() => toggle()}
                style={{
                    margin: '0 8px 16px',
                    padding: '10px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    color: '#475569',
                }}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {collapsed
                    ? <ChevronRight size={16} />
                    : <><ChevronLeft size={16} /><span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Collapse</span></>
                }
            </button>
        </aside>
    )
}
