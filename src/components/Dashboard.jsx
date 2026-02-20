import React from 'react'
import ProgressBar from './ProgressBar'
import MilestoneCard from './MilestoneCard'
import WalletPanel from './WalletPanel'

export default function Dashboard({ project, onFund, onVote, onReset }) {
    const { title, description, fundingTarget, fundedAmount, milestones } = project
    const approvedCount = milestones.filter(m => m.status === 'Approved').length

    return (
        <div className="max-w-3xl mx-auto">
            {/* ── Page header ───────────────────────────────────────────────── */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <div
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 text-xs font-semibold"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 5px rgba(52,211,153,0.9)' }} />
                        Live Dashboard · Chipnet
                    </div>
                    <h1 className="text-3xl font-bold text-white">{title}</h1>
                </div>
                <button
                    id="reset-project-btn"
                    onClick={onReset}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                    ← New Project
                </button>
            </div>

            {/* ── Stats Row ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card-glass rounded-2xl p-5">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Target</p>
                    <p className="text-2xl font-bold text-white">{fundingTarget.toFixed(2)}</p>
                    <p className="text-emerald-400 text-sm font-semibold mt-0.5">BCH</p>
                </div>
                <div className="card-glass rounded-2xl p-5 glow-green">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Raised</p>
                    <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>{fundedAmount.toFixed(4)}</p>
                    <p className="text-emerald-400 text-sm font-semibold mt-0.5">BCH</p>
                </div>
                <div className="card-glass rounded-2xl p-5">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Milestones</p>
                    <p className="text-2xl font-bold text-white">{approvedCount}/{milestones.length}</p>
                    <p className="text-violet-400 text-sm font-semibold mt-0.5">Approved</p>
                </div>
            </div>

            {/* ── Project info + progress ────────────────────────────────────── */}
            <div className="card-glass rounded-2xl p-8 mb-6">
                <div className="mb-6">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">About</h2>
                    <p className="text-slate-300 leading-relaxed">{description}</p>
                </div>
                <hr className="section-divider" />
                <ProgressBar current={fundedAmount} target={fundingTarget} />
            </div>

            {/* ── BCH Wallet Panel (Week 2) ─────────────────────────────────── */}
            <WalletPanel onRealFund={onFund} />

            {/* ── Milestones Section ────────────────────────────────────────── */}
            <div className="card-glass rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white">Milestones</h2>
                        <p className="text-slate-500 text-sm mt-0.5">Vote to approve or reject each milestone</p>
                    </div>
                    <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
                    >
                        {approvedCount}/{milestones.length} done
                    </div>
                </div>

                <div className="space-y-4">
                    {milestones.map((milestone, index) => (
                        <MilestoneCard
                            key={milestone.id}
                            milestone={milestone}
                            index={index}
                            onVote={onVote}
                        />
                    ))}
                </div>

                {approvedCount === milestones.length && milestones.length > 0 && (
                    <div
                        className="mt-6 p-4 rounded-xl text-center"
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}
                    >
                        <p className="text-emerald-400 font-bold text-lg">🎉 All milestones approved!</p>
                        <p className="text-slate-400 text-sm mt-1">The project is governance-complete.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
