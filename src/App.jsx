import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CheckIn from './pages/CheckIn'
import GuestSearch from './pages/GuestSearch'
import Reports from './pages/Reports'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

function WelcomeSplash({ onFinish }) {
  useEffect(() => {
    const timer = window.setTimeout(onFinish, 2400)
    return () => window.clearTimeout(timer)
  }, [onFinish])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.45 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center px-6"
      >
        <p className="text-xs font-mono uppercase tracking-[0.35em] text-amber-500 mb-3">Hotel PMS</p>
        <motion.h1
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="text-3xl sm:text-4xl font-semibold text-white"
        >
          Welcome Back Malhar!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-3 text-sm text-gray-400"
        >
          Preparing your dashboard...
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="checkin" element={<CheckIn />} />
        <Route path="checkin/:roomId" element={<CheckIn />} />
        <Route path="guests" element={<GuestSearch />} />
        <Route path="reports" element={<Reports />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false)

  useEffect(() => {
    const today = new Date().toDateString()
    const lastShown = window.localStorage.getItem('pms_welcome_shown_date')

    if (lastShown !== today) {
      window.localStorage.setItem('pms_welcome_shown_date', today)
      setShowWelcomeSplash(true)
    }
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <AnimatePresence>
          {showWelcomeSplash && <WelcomeSplash onFinish={() => setShowWelcomeSplash(false)} />}
        </AnimatePresence>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1C1C28', color: '#E2E2F0', border: '1px solid #3A3A52' },
            success: { iconTheme: { primary: '#34D399', secondary: '#0A0A0F' } },
            error:   { iconTheme: { primary: '#FB7185', secondary: '#0A0A0F' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
