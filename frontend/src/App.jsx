/**
 * App.jsx — Root component with routing.
 * All routes require authentication (consultant or admin).
 */
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login         from './pages/Login'
import Dashboard     from './pages/Dashboard'
import ChecklistView from './pages/ChecklistView'
import History       from './pages/History'
import Navbar        from './components/Navbar'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppShell({ children }) {
  return (
    <div className="layout">
      <Navbar />
      <div className="main-content">{children}</div>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

        {/* Protected — consultant / admin */}
        <Route path="/" element={
          <ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>
        } />
        <Route path="/projects/:projectId/checklists/:checklistId" element={
          <ProtectedRoute><AppShell><ChecklistView /></AppShell></ProtectedRoute>
        } />
        <Route path="/projects/:projectId/history" element={
          <ProtectedRoute><AppShell><History /></AppShell></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}