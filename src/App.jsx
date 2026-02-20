import React, { useState } from 'react'
import Navbar from './components/Navbar'
import ProjectForm from './components/ProjectForm'
import Dashboard from './components/Dashboard'

export default function App() {
  const [project, setProject] = useState(null)

  // Called when user submits the creation form
  const handleProjectCreate = (projectData) => {
    setProject({
      ...projectData,
      fundedAmount: 0,
    })
  }

  // Simulate adding a random BCH contribution
  const handleFund = (amount) => {
    setProject(prev => ({
      ...prev,
      fundedAmount: prev.fundedAmount + amount,
    }))
  }

  // Vote yes or no on a milestone; auto-approve if yes > no
  const handleVote = (milestoneId, voteType) => {
    setProject(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => {
        if (m.id !== milestoneId) return m
        const updatedVotes = {
          ...m.votes,
          [voteType]: m.votes[voteType] + 1,
        }
        const status = updatedVotes.yes > updatedVotes.no ? 'Approved' : 'Pending'
        return { ...m, votes: updatedVotes, status }
      }),
    }))
  }

  // Reset back to the form
  const handleReset = () => {
    setProject(null)
  }

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 20% 10%, rgba(124,58,237,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.06) 0%, transparent 60%), #0a0b14' }}>
      <Navbar />

      {/* Decorative orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute top-32 left-1/4 w-80 h-80 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-40 right-1/4 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #06b6d4, transparent)', filter: 'blur(80px)' }} />
      </div>

      <main className="relative z-10 px-4 py-12">
        {project === null ? (
          <ProjectForm onProjectCreate={handleProjectCreate} />
        ) : (
          <Dashboard
            project={project}
            onFund={handleFund}
            onVote={handleVote}
            onReset={handleReset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 mt-4">
        <p className="text-slate-600 text-sm">
          Built for{' '}
          <span className="font-semibold" style={{ color: '#10b981' }}>Bitcoin Cash</span>
          {' '}· Milestara v0.2 · Week 2 — Chipnet Integration
        </p>
      </footer>
    </div>
  )
}
