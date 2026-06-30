import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/',        label: 'Dashboard',    icon: '⊞' },
  { to: '/checkin', label: 'Check In',     icon: '↓' },
  { to: '/guests',  label: 'Guest Search', icon: '⌕' },
  { to: '/reports', label: 'Reports',      icon: '↗' },
]

export default function Layout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-ink-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-ink-900 border-r border-ink-700 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-ink-700">
          <p className="text-xs font-mono text-amber-500 tracking-widest uppercase">Hotel</p>
          <p className="text-lg font-semibold text-white mt-0.5">PMS</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-ink-800'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-ink-700">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
            aria-label="Sign out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
