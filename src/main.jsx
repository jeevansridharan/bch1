// ── MetaMask / window.ethereum guard ─────────────────────────────────────────
// mainnet-js depends on ethers.js which tries to detect an injected EVM provider.
// This app is BCH-only — set ethereum to null before any module loads so those
// probes fail silently instead of flooding the console with MetaMask errors.
if (typeof window !== 'undefined') {
    if (!window.ethereum) {
        try {
            Object.defineProperty(window, 'ethereum', {
                value: null,
                writable: false,
                configurable: true,
            })
        } catch {
            // Already defined — ignore
        }
    }
    // Suppress uncaught promise rejections from MetaMask extension probes
    window.addEventListener('unhandledrejection', (event) => {
        const msg = event?.reason?.message ?? ''
        if (
            msg.includes('MetaMask') ||
            msg.includes('ethereum') ||
            msg.includes('Could not establish connection')
        ) {
            event.preventDefault()
        }
    })
}

// ── EventEmitter max listeners ────────────────────────────────────────────────
// mainnet-js and cashscript both use Node.js EventEmitter (polyfilled in
// the browser). The default limit is 10. The BCH WebSocket internals
// legitimately attach several listeners per connection. Raising the limit
// prevents the MaxListenersExceededWarning spam in the console.
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
    // polyfill process.env so EventEmitter can read its settings
    window.process = window.process || { env: {} }
}
// Increase global EventEmitter limit for the polyfilled events module
import('events').then(({ EventEmitter }) => {
    EventEmitter.defaultMaxListeners = 30
}).catch(() => { /* not available in this environment — ignore */ })

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
