/**
 * src/App.jsx — root with React Router
 * LandingPage renders at / (standalone, no sidebar).
 * DocsPage renders at /docs (standalone, no sidebar).
 * All app pages share the sidebar Layout under /dashboard, /projects, etc.
 */

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Layout from './layouts/Layout'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import GovernancePage from './pages/GovernancePage'
import TransactionsPage from './pages/TransactionsPage'
import ProfilePage from './pages/ProfilePage'
import DocsPage from './pages/DocsPage'

import { WalletProvider } from './contexts/WalletContext'

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Routes>
          {/* Landing page — standalone, no sidebar */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/docs" element={<DocsPage />} />

          {/* All app pages share the sidebar Layout */}
          <Route element={<Layout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="governance" element={<GovernancePage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* Catch-all → redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  )
}
