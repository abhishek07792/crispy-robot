import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import apiClient from '../api/client'

interface User {
  id: string
  email: string
  role: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('vapt_token')
    if (!token) { setIsLoading(false); return }
    try {
      const res = await apiClient.get('/auth/me')
      setUser(res.data.user)
    } catch {
      localStorage.removeItem('vapt_token')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password })
    localStorage.setItem('vapt_token', res.data.token)
    setUser(res.data.user)
  }

  const register = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/register', { email, password })
    localStorage.setItem('vapt_token', res.data.token)
    setUser(res.data.user)
  }

  const logout = async () => {
    try { await apiClient.post('/auth/logout') } catch { /* ignore */ }
    localStorage.removeItem('vapt_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
