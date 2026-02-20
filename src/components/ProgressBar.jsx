import React from 'react'

export default function ProgressBar({ current, target }) {
    const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0
    const displayPct = percentage.toFixed(1)

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-300">Funding Progress</span>
                <span className="text-sm font-bold" style={{ color: percentage >= 100 ? '#10b981' : '#a78bfa' }}>
                    {displayPct}%
                </span>
            </div>
            <div className="progress-track">
                <div
                    className="progress-fill"
                    style={{ width: `${percentage}%` }}
                    role="progressbar"
                    aria-valuenow={percentage}
                    aria-valuemin="0"
                    aria-valuemax="100"
                />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>{current.toFixed(4)} BCH raised</span>
                <span>Goal: {target.toFixed(4)} BCH</span>
            </div>
        </div>
    )
}
