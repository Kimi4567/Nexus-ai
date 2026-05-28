'use client'
import { useState, useEffect, createContext, useContext } from 'react'

interface User {
  name: string
  email: string
  plan: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => boolean
  register: (name: string, email: string, password: string) => boolean
  logout: () => void
  isAuth: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null, login: () => false, register: () => false, logout: () => {}, isAuth: false
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('nexus_user')
    if (saved) setUser(JSON.parse(saved))
  }, [])

  const login = (email: string, password: string) => {
    if (password.length < 6) return false
    const u = { name: email.split('@')[0], email, plan: 'Pro' }
    setUser(u)
    localStorage.setItem('nexus_user', JSON.stringify(u))
    return true
  }

  const register = (name: string, email: string, password: string) => {
    if (password.length < 8) return false
    const u = { name, email, plan: 'Starter' }
    setUser(u)
    localStorage.setItem('nexus_user', JSON.stringify(u))
    return true
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('nexus_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuth: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
