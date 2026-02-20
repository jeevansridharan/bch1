import React from 'react'

export default function Navbar() {
    return (
        <nav className="sticky top-0 z-50 nav-glow" style={{ background: 'rgba(10, 11, 20, 0.9)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.8)' }}></div>
                    </div>
                    <div>
                        <span className="text-xl font-bold tracking-tight" style={{ background: 'linear-gradient(135deg, #a78bfa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Milestara
                        </span>
                        <div className="text-xs text-slate-500 font-medium -mt-0.5">BCH Milestone Funding</div>
                    </div>
                </div>

                {/* Network Badge */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.8)', animation: 'pulse 2s infinite' }}></div>
                    <span className="text-emerald-400 text-sm font-semibold">Bitcoin Cash</span>
                    <span className="text-slate-500 text-xs">Testnet</span>
                </div>
            </div>
        </nav>
    )
}
