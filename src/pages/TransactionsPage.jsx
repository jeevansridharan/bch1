/**
 * pages/TransactionsPage.jsx
 * On-chain transaction history — reads from Supabase transactions table.
 */

import React, { useState, useEffect } from 'react'
import { ArrowUpRight, ArrowDownLeft, RotateCcw, ExternalLink, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Badge per type ────────────────────────────────────────────────────────────
const TYPE_META = {
    funding: { label: 'Funding', color: '#10b981', Icon: ArrowDownLeft },
    release: { label: 'Release', color: '#7c3aed', Icon: ArrowUpRight },
    refund: { label: 'Refund', color: '#f59e0b', Icon: RotateCcw },
}

function TxRow({ tx }) {
    const meta = TYPE_META[tx.type] ?? TYPE_META.funding
    const explorerUrl = `https://chipnet.imaginary.cash/tx/${tx.tx_hash}`
    const date = new Date(tx.created_at).toLocaleString()

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            transition: 'background 0.15s',
        }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            {/* Type icon */}
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${meta.color}15`, border: `1px solid ${meta.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <meta.Icon size={18} color={meta.color} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>{meta.label}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}25` }}>
                        {tx.type.toUpperCase()}
                    </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                    {tx.tx_hash}
                </p>
            </div>

            {/* Amount */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '1rem', fontWeight: 800, color: meta.color }}>
                    {parseFloat(tx.amount).toFixed(6)}
                </p>
                <p style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>BCH</p>
            </div>

            {/* Date */}
            <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                    <Clock size={11} />
                    <span style={{ fontSize: '0.7rem' }}>{date}</span>
                </div>
                <a href={explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#7c3aed', fontSize: '0.7rem', textDecoration: 'none', fontWeight: 600 }}>
                    Explorer <ExternalLink size={10} />
                </a>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
    const [txs, setTxs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*, projects(title)')
                    .order('created_at', { ascending: false })
                    .limit(50)
                if (error) throw error
                setTxs(data ?? [])
            } catch (e) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                    Transactions
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    All on-chain BCH activity recorded on Chipnet
                </p>
            </div>

            {/* Table */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', backdropFilter: 'blur(20px)', overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Transaction History
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#334155' }}>
                        {txs.length} record{txs.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Body */}
                {loading && (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#475569' }}>
                        <div className="animate-spin" style={{ width: '24px', height: '24px', border: '2px solid transparent', borderTop: '2px solid #7c3aed', borderRadius: '50%', margin: '0 auto 12px' }} />
                        Loading transactions…
                    </div>
                )}

                {error && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#f87171', fontSize: '0.875rem' }}>
                        ⚠ {error}
                    </div>
                )}

                {!loading && !error && txs.length === 0 && (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <ArrowLeftRight size={36} color="#1e293b" style={{ margin: '0 auto 16px', display: 'block' }} />
                        <p style={{ color: '#334155', fontWeight: 600, fontSize: '0.9rem' }}>No transactions yet</p>
                        <p style={{ color: '#1e293b', fontSize: '0.8rem', marginTop: '4px' }}>Fund a project on the Projects page to see activity here</p>
                    </div>
                )}

                {!loading && !error && txs.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </div>
        </div>
    )
}
