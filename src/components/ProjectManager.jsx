/**
 * src/components/ProjectManager.jsx
 *
 * ── What this component does ──────────────────────────────────────────────────
 * 1. On mount → fetchProjects() → displays all projects from Supabase
 * 2. On form submit → createProject() → inserts new row → optimistically
 *    prepends new project to React state (no page reload needed)
 * 3. Handles loading, error, and empty states
 *
 * ── How to use ────────────────────────────────────────────────────────────────
 * Drop <ProjectManager walletAddress="0x..." /> into any page.
 * The walletAddress prop is set as the owner_wallet of each new project.
 *
 * ── Dependencies ─────────────────────────────────────────────────────────────
 * npm install @supabase/supabase-js  (already installed in this project)
 */

import React, { useState, useEffect, useCallback } from 'react'
import { createProject, fetchProjects } from '../lib/db/projects'
import { Plus, FolderKanban, AlertCircle, Loader2, RefreshCw } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => parseFloat(n || 0).toFixed(8)
const date = (s) => new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const EMPTY_FORM = { title: '', description: '', goal_amount: '', owner_wallet: '' }

// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectManager({ walletAddress = '' }) {

    // ── State ─────────────────────────────────────────────────────────────────
    const [projects, setProjects] = useState([])          // rows from Supabase
    const [loading, setLoading] = useState(true)        // fetch in flight
    const [submitting, setSubmitting] = useState(false)       // insert in flight
    const [error, setError] = useState(null)        // fetch/insert error
    const [formError, setFormError] = useState(null)        // form validation msg
    const [form, setForm] = useState({            // controlled form
        ...EMPTY_FORM,
        owner_wallet: walletAddress,                            // pre-fill wallet
    })

    // ── Fetch all projects on mount ───────────────────────────────────────────

    /**
     * loadProjects
     * Calls fetchProjects() and stores rows in state.
     * Wrapped in useCallback so it is stable across re-renders
     * and safe to pass to the refresh button.
     */
    const loadProjects = useCallback(async () => {
        setLoading(true)
        setError(null)

        const { data, error: fetchErr } = await fetchProjects()

        if (fetchErr) {
            setError(fetchErr.message)
            setProjects([])
        } else {
            setProjects(data)   // data is always an array (never null)
        }

        setLoading(false)
    }, [])

    // Run once when component mounts
    useEffect(() => {
        loadProjects()
    }, [loadProjects])

    // Pre-fill wallet when prop changes (e.g. user connects wallet after mount)
    useEffect(() => {
        setForm(prev => ({ ...prev, owner_wallet: walletAddress }))
    }, [walletAddress])

    // ── Form handlers ─────────────────────────────────────────────────────────

    const handleChange = (e) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
        setFormError(null)          // clear inline error on every keystroke
    }

    /**
     * handleSubmit
     *
     * 1. Validates the form locally (fail fast — no wasted network calls)
     * 2. Calls createProject() which does INSERT … RETURNING *
     * 3. On success: prepends the new row to state → appears instantly in table
     * 4. On failure: shows the error from Supabase
     */
    const handleSubmit = async (e) => {
        e.preventDefault()
        setFormError(null)

        // ── Validation ────────────────────────────────────────────────────────
        if (!form.title.trim()) return setFormError('Project title is required.')
        if (!form.goal_amount) return setFormError('Funding goal is required.')
        if (Number(form.goal_amount) <= 0) return setFormError('Funding goal must be greater than 0.')
        if (!form.owner_wallet.trim()) return setFormError('Wallet address is required.')

        setSubmitting(true)

        // ── Insert into Supabase ──────────────────────────────────────────────
        const { data: newProject, error: insertErr } = await createProject({
            title: form.title,
            description: form.description,
            goal_amount: Number(form.goal_amount),
            owner_wallet: form.owner_wallet,
            status: 'active',
        })

        setSubmitting(false)

        if (insertErr) {
            setFormError(insertErr.message)
            return
        }

        // ── Optimistic prepend ────────────────────────────────────────────────
        // Supabase returned the full inserted row (with server-generated id + created_at).
        // Prepend it to local state so it appears instantly at the top of the list
        // without requiring a full re-fetch.
        setProjects(prev => [newProject, ...prev])

        // Reset form (keep wallet)
        setForm({ ...EMPTY_FORM, owner_wallet: walletAddress })
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#f1f5f9' }}>

            {/* ━━━━━━━━━━━━━━━━━ CREATE FORM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div style={{
                background: 'rgba(15,17,35,0.9)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px', padding: '28px', marginBottom: '28px',
            }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} color="#10b981" /> Create New Project
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                    {/* Title */}
                    <div>
                        <label style={labelStyle}>Project Title *</label>
                        <input
                            name="title"
                            value={form.title}
                            onChange={handleChange}
                            placeholder="e.g. Bitcoin Cash Community Hub"
                            required
                            style={inputStyle}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label style={labelStyle}>Description</label>
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            placeholder="What is this project about?"
                            rows={3}
                            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                        />
                    </div>

                    {/* Goal Amount */}
                    <div>
                        <label style={labelStyle}>Funding Goal (BCH) *</label>
                        <input
                            type="number"
                            name="goal_amount"
                            value={form.goal_amount}
                            onChange={handleChange}
                            placeholder="0.05"
                            step="0.000001"
                            min="0.000001"
                            required
                            style={inputStyle}
                        />
                    </div>

                    {/* Wallet */}
                    <div>
                        <label style={labelStyle}>Owner Wallet Address *</label>
                        <input
                            name="owner_wallet"
                            value={form.owner_wallet}
                            onChange={handleChange}
                            placeholder="bchtest:..."
                            required
                            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}
                        />
                    </div>

                    {/* Form error */}
                    {formError && (
                        <div style={{
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px',
                        }}>
                            <AlertCircle size={15} color="#f87171" />
                            <span style={{ color: '#f87171', fontSize: '0.83rem' }}>{formError}</span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            padding: '12px', borderRadius: '10px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                            fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: '8px',
                            opacity: submitting ? 0.7 : 1, transition: 'all 0.2s',
                            boxShadow: '0 0 20px rgba(16,185,129,0.25)',
                        }}
                    >
                        {submitting
                            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</>
                            : <><Plus size={16} /> Create Project</>
                        }
                    </button>

                </form>
            </div>

            {/* ━━━━━━━━━━━━━━━━━ PROJECT LIST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div style={{
                background: 'rgba(15,17,35,0.9)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px', padding: '28px',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <FolderKanban size={18} color="#10b981" />
                        All Projects
                        <span style={{
                            fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '999px',
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399',
                        }}>
                            {loading ? '…' : projects.length}
                        </span>
                    </h2>
                    <button
                        onClick={loadProjects}
                        disabled={loading}
                        title="Refresh"
                        style={{
                            padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.04)', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.78rem', transition: 'all 0.2s',
                        }}
                    >
                        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>

                {/* Error */}
                {!loading && error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '12px', padding: '20px', display: 'flex', gap: '12px',
                    }}>
                        <AlertCircle size={18} color="#f87171" style={{ flexShrink: 0 }} />
                        <div>
                            <p style={{ color: '#f87171', fontWeight: 700, marginBottom: '4px' }}>Could not load projects</p>
                            <p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{error}</p>
                            <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '8px' }}>
                                → Check your .env keys · Make sure schema.sql was run in Supabase
                            </p>
                        </div>
                    </div>
                )}

                {/* Loading skeleton */}
                {loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{
                                height: '60px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)',
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }} />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && projects.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <p style={{ color: '#475569', fontSize: '0.9rem' }}>No projects yet.</p>
                        <p style={{ color: '#334155', fontSize: '0.8rem', marginTop: '4px' }}>
                            Use the form above to create your first project.
                        </p>
                    </div>
                )}

                {/* Project table */}
                {!loading && !error && projects.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                            <thead>
                                <tr>
                                    {['Title', 'Goal (BCH)', 'Raised (BCH)', 'Status', 'Created'].map(h => (
                                        <th key={h} style={{
                                            textAlign: 'left', padding: '8px 12px', color: '#475569',
                                            fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase',
                                            letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((p, i) => (
                                    <tr
                                        key={p.id}
                                        style={{
                                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.06)'}
                                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                                    >
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{p.title}</span>
                                            {p.description && (
                                                <p style={{ color: '#475569', fontSize: '0.72rem', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                                    {p.description}
                                                </p>
                                            )}
                                        </td>
                                        <td style={tdStyle}>{fmt(p.goal_amount)}</td>
                                        <td style={{ ...tdStyle, color: '#10b981', fontWeight: 700 }}>{fmt(p.raised_amount)}</td>
                                        <td style={tdStyle}>
                                            <StatusBadge status={p.status} />
                                        </td>
                                        <td style={{ ...tdStyle, color: '#475569' }}>{date(p.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Keyframe animations */}
            <style>{`
                @keyframes spin  { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
            `}</style>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const map = {
        active: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', color: '#34d399' },
        funded: { bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.3)', color: '#10b981' },
        completed: { bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.3)', color: '#06b6d4' },
        cancelled: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', color: '#f87171' },
    }
    const s = map[status] ?? map.active
    return (
        <span style={{
            fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
        }}>
            {status}
        </span>
    )
}

// ── Inline style constants ────────────────────────────────────────────────────

const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '0.875rem',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#f1f5f9', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
}

const labelStyle = {
    display: 'block', marginBottom: '6px', fontSize: '0.78rem',
    fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
}

const tdStyle = {
    padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle',
}
