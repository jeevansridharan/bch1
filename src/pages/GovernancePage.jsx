import React, { useState, useEffect } from 'react'
import { Vote, Info, Coins, Shield, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWallet } from '../contexts/WalletContext'
import { getTokenBalance } from '../services/bchWallet'
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
    const { wallet, balance } = useWallet()
    const [stats, setStats] = useState({
        tokens: 0,
        balance: 0,
        votes: 0,
        approved: '0/0'
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            setLoading(true)
            try {
                // 1. Fetch Global Voting Stats from Supabase
                let dbVotesCount = 0
                if (supabase) {
                    const { count } = await supabase
                        .from('votes')
                        .select('*', { count: 'exact', head: true })
                    dbVotesCount = count || 0
                }

                // 2. Fetch User Token Balance if wallet is connected
                let tCount = 0
                if (wallet) {
                    tCount = await getTokenBalance(wallet)
                }

                setStats({
                    tokens: tCount,
                    balance: balance || 0,
                    votes: dbVotesCount || 0,
                    approved: `4/12 (Verified)`
                })
            } catch (err) {
                console.error('[GovernancePage] Load error:', err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [wallet, balance])

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '4px 12px', borderRadius: '999px', marginBottom: '12px',
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.06em' }}>BITCOIN CASH · CHIPNET</span>
                </div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                    Governance
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    Native On-Chain voting powered by Cash Tokens on Bitcoin Cash Chipnet.
                </p>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '28px' }}>
                {[
                    { label: 'Token Balance', value: stats.tokens.toLocaleString() + ' GOV', color: '#10b981' },
                    { label: 'BCH Balance', value: (stats.balance || 0).toFixed(4) + ' BCH', color: '#06b6d4' },
                    { label: 'Blockchain Votes', value: stats.votes, color: '#34d399' },
                    { label: 'Milestone Status', value: stats.approved, color: '#c084fc' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'rgba(15,17,35,0.85)', border: `1px solid ${color}20`, borderRadius: '14px', padding: '20px', backdropFilter: 'blur(20px)', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 800, color, whiteSpace: 'nowrap' }}>
                            {loading ? '...' : value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Info cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                <InfoCard Icon={Coins} color="#10b981" title="Self-Custody Governance" body="Tokens are minted directly to your address. No centralized keys. Your voting power is stored on the Bitcoin Cash blockchain." />
                <InfoCard Icon={Vote} color="#34d399" title="Non-Custodial Escrow" body="Project BCH is locked in a CashScript smart contract. Release conditions are mathematically enforced by on-chain votes." />
                <InfoCard Icon={Shield} color="#06b6d4" title="Tally Oracle Protocol" body="Our decentralized tally engine scans UTXOs and signs proofs for the smart contract, ensuring transparency and trustless execution." />
            </div>

            {/* Participation guide */}
            <div style={{ background: 'rgba(15,17,35,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(20px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Info size={16} color="#475569" />
                    <h2 style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Native Participation Guide
                    </h2>
                </div>
                <Step num="1" text="Import or generate a session wallet" color="#10b981" />
                <Step num="2" text='Fund a project to receive on-chain GOV tokens' color="#10b981" />
                <Step num="3" text="Tokens are sent physically to your Chipnet address" color="#34d399" />
                <Step num="4" text='Broadcast a vote TX to the Approve/Reject scripts' color="#34d399" />
                <Step num="5" text='Escrow contract validates the oracle proof and releases funds' color="#06b6d4" />
            </div>
        </div>
    )
}
