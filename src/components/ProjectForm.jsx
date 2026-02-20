import React, { useState } from 'react'

export default function ProjectForm({ onProjectCreate }) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [fundingTarget, setFundingTarget] = useState('')
    const [milestoneInput, setMilestoneInput] = useState('')
    const [milestones, setMilestones] = useState([])
    const [errors, setErrors] = useState({})

    const addMilestone = () => {
        const trimmed = milestoneInput.trim()
        if (!trimmed) return
        setMilestones(prev => [...prev, trimmed])
        setMilestoneInput('')
    }

    const removeMilestone = (index) => {
        setMilestones(prev => prev.filter((_, i) => i !== index))
    }

    const handleMilestoneKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            addMilestone()
        }
    }

    const validate = () => {
        const newErrors = {}
        if (!title.trim()) newErrors.title = 'Project title is required'
        if (!description.trim()) newErrors.description = 'Description is required'
        if (!fundingTarget || Number(fundingTarget) <= 0) newErrors.fundingTarget = 'Enter a valid funding target'
        if (milestones.length === 0) newErrors.milestones = 'Add at least one milestone'
        return newErrors
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const validationErrors = validate()
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors)
            return
        }
        setErrors({})
        onProjectCreate({
            title: title.trim(),
            description: description.trim(),
            fundingTarget: Number(fundingTarget),
            milestones: milestones.map((m, i) => ({
                id: i,
                title: m,
                status: 'Pending',
                votes: { yes: 0, no: 0 },
            })),
        })
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-sm font-medium" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                    Create New Project
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Launch Your Project</h1>
                <p className="text-slate-400">Define your project, set a funding target, and outline milestones for community governance.</p>
            </div>

            <form onSubmit={handleSubmit} className="card-glass rounded-2xl p-8 space-y-6">
                {/* Project Title */}
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Project Title
                    </label>
                    <input
                        id="project-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Decentralized Exchange on BCH"
                        className="input-web3"
                    />
                    {errors.title && <p className="mt-1.5 text-xs text-rose-400">{errors.title}</p>}
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Description
                    </label>
                    <textarea
                        id="project-description"
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your project vision, goals, and why the community should fund it..."
                        className="input-web3 resize-none"
                    />
                    {errors.description && <p className="mt-1.5 text-xs text-rose-400">{errors.description}</p>}
                </div>

                {/* Funding Target */}
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Funding Target (BCH)
                    </label>
                    <div className="relative">
                        <input
                            id="funding-target"
                            type="number"
                            min="0"
                            step="0.01"
                            value={fundingTarget}
                            onChange={(e) => setFundingTarget(e.target.value)}
                            placeholder="0.00"
                            className="input-web3 pr-16"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: '#10b981' }}>BCH</span>
                    </div>
                    {errors.fundingTarget && <p className="mt-1.5 text-xs text-rose-400">{errors.fundingTarget}</p>}
                </div>

                {/* Milestones */}
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Project Milestones
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="milestone-input"
                            type="text"
                            value={milestoneInput}
                            onChange={(e) => setMilestoneInput(e.target.value)}
                            onKeyDown={handleMilestoneKeyDown}
                            placeholder="e.g. Deploy Smart Contract"
                            className="input-web3 flex-1"
                        />
                        <button
                            type="button"
                            id="add-milestone-btn"
                            onClick={addMilestone}
                            className="px-4 py-2 rounded-xl font-semibold text-sm text-white gradient-btn flex-shrink-0"
                        >
                            + Add
                        </button>
                    </div>
                    {errors.milestones && <p className="mt-1.5 text-xs text-rose-400">{errors.milestones}</p>}

                    {/* Milestone List */}
                    {milestones.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {milestones.map((m, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                                            {index + 1}
                                        </span>
                                        <span className="text-slate-200 text-sm font-medium">{m}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeMilestone(index)}
                                        className="text-slate-500 hover:text-rose-400 transition-colors text-lg leading-none"
                                        aria-label="Remove milestone"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    id="create-project-btn"
                    className="w-full py-3.5 rounded-xl font-bold text-white gradient-btn text-base mt-2"
                >
                    🚀 Create Project
                </button>
            </form>
        </div>
    )
}
