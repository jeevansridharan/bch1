import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { initializeWallet, getBalance, disconnectWallet as serviceDisconnect } from '../services/bchWallet'

const WalletContext = createContext()

export function WalletProvider({ children }) {
    const [wallet, setWallet] = useState(null)
    const [address, setAddress] = useState('')
    const [balance, setBalance] = useState(() => {
        const cached = localStorage.getItem('milestara_chipnet_balance')
        return cached !== null ? parseFloat(cached) : null
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const refreshBalance = useCallback(async (w) => {
        const targetWallet = w || wallet
        if (!targetWallet) return
        try {
            const bal = await getBalance(targetWallet)
            if (bal !== null) {
                setBalance(bal)
                localStorage.setItem('milestara_chipnet_balance', bal.toString())
            }
        } catch (e) {
            console.error('[WalletContext] Balance refresh failed:', e)
        }
    }, [wallet])

    const connect = useCallback(async (wif = null) => {
        setLoading(true)
        setError('')
        try {
            const w = await initializeWallet(wif)
            setWallet(w)
            setAddress(w.cashaddr)
            await refreshBalance(w)
            return w
        } catch (e) {
            setError(e.message)
            throw e
        } finally {
            setLoading(false)
        }
    }, [refreshBalance])

    const disconnect = useCallback(() => {
        serviceDisconnect()
        setWallet(null)
        setAddress('')
        setBalance(null)
        localStorage.removeItem('milestara_chipnet_balance')
    }, [])

    // Auto-connect on mount if WIF exists
    useEffect(() => {
        const storedWif = localStorage.getItem('milestara_chipnet_wif')
        if (storedWif && !wallet) {
            connect()
        }
    }, [connect, wallet])

    // Periodic refresh
    useEffect(() => {
        if (wallet) {
            const interval = setInterval(() => refreshBalance(wallet), 15000)
            return () => clearInterval(interval)
        }
    }, [wallet, refreshBalance])

    return (
        <WalletContext.Provider value={{
            wallet,
            address,
            balance,
            loading,
            error,
            connect,
            disconnect,
            refreshBalance
        }}>
            {children}
        </WalletContext.Provider>
    )
}

export function useWallet() {
    const context = useContext(WalletContext)
    if (!context) throw new Error('useWallet must be used within a WalletProvider')
    return context
}
