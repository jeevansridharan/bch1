/**
 * src/layouts/Layout.jsx — App shell
 *
 * The sidebar tracks its own collapsed state internally via a custom event.
 * Layout listens for it and adjusts the main area's left margin accordingly.
 */

import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

const SIDEBAR_EXPANDED = 240
const SIDEBAR_COLLAPSED = 72

export default function Layout() {
    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_EXPANDED)

    // Listen for sidebar toggle events broadcast by Sidebar.jsx
    useEffect(() => {
        const handler = (e) => setSidebarWidth(e.detail.collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED)
        window.addEventListener('sidebar-toggle', handler)
        return () => window.removeEventListener('sidebar-toggle', handler)
    }, [])

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0b14' }}>

            <Sidebar />

            <main
                style={{
                    marginLeft: `${sidebarWidth}px`,
                    flex: 1,
                    minHeight: '100vh',
                    transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
                    overflowX: 'hidden',
                    background: 'radial-gradient(ellipse at 20% 10%, rgba(124,58,237,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.05) 0%, transparent 60%), #0a0b14',
                }}
            >
                {/* Decorative ambient orbs */}
                <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '10%', left: '40%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.06), transparent)', filter: 'blur(80px)' }} />
                    <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.05), transparent)', filter: 'blur(80px)' }} />
                </div>

                <div style={{ position: 'relative', zIndex: 1, padding: '32px 36px', maxWidth: '1100px', margin: '0 auto' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
