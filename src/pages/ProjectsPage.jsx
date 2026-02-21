/**
 * pages/ProjectsPage.jsx
 * Create a project + BCH wallet funding — integrates existing components.
 */

import React, { useState } from 'react'
import ProjectForm from '../components/ProjectForm'
import Dashboard from '../components/Dashboard'

export default function ProjectsPage() {
    const [project, setProject] = useState(null)

    const handleProjectCreate = (projectData) => {
        setProject({ ...projectData, fundedAmount: 0 })
    }

    const handleFund = (amount) => {
        setProject(prev => ({ ...prev, fundedAmount: prev.fundedAmount + amount }))
    }

    const handleVote = (milestoneId, voteType) => {
        setProject(prev => ({
            ...prev,
            milestones: prev.milestones.map(m => {
                if (m.id !== milestoneId) return m
                const updatedVotes = { ...m.votes, [voteType]: m.votes[voteType] + 1 }
                return { ...m, votes: updatedVotes, status: updatedVotes.yes > updatedVotes.no ? 'Approved' : 'Pending' }
            }),
        }))
    }

    const handleReset = () => setProject(null)

    return (
        <div>
            {/* Page header */}
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '6px' }}>
                    Projects
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    Create milestone-based funding projects on Bitcoin Cash Chipnet
                </p>
            </div>

            {project === null
                ? <ProjectForm onProjectCreate={handleProjectCreate} />
                : <Dashboard project={project} onFund={handleFund} onVote={handleVote} onReset={handleReset} />
            }
        </div>
    )
}
