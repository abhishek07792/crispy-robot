import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Shield, History, Plus, LogOut, ShieldCheck, Menu, X
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/assessments/new', icon: Plus, label: 'New Assessment' },
  { to: '/assessments', icon: History, label: 'History' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-navy-950">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-navy-900 border-r border-navy-700/50 flex flex-col transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-700/50">
          <div className="p-2 rounded-lg bg-accent-500/20">
            <ShieldCheck className="w-5 h-5 text-accent-400" />
          </div>
          <div>
            <p className="font-bold text-sm text-white leading-none">VAPT Framework</p>
            <p className="text-xs text-navy-400 mt-0.5">Risk Analysis Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent-500/20 text-accent-400 border border-accent-500/30'
                    : 'text-navy-300 hover:text-white hover:bg-navy-800'
                }`
              }>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-navy-700/50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-navy-800/50 mb-2">
            <div className="w-7 h-7 rounded-full bg-accent-500/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-accent-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-navy-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-navy-300 hover:text-critical hover:bg-critical/10 transition-all duration-150">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-navy-900 border-b border-navy-700/50">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent-400" />
          <span className="font-bold text-sm">VAPT Framework</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-navy-300 hover:text-white">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 lg:pl-64">
        <div className="min-h-screen p-5 pt-16 lg:pt-5">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
