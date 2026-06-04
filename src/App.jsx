import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePushNotifications } from './hooks/usePush'
import { Spinner } from './components/UI'
import BottomNav from './components/BottomNav'
import LoginPage from './pages/LoginPage'

// Pages — chargées dynamiquement
import { lazy, Suspense, useState, useEffect } from 'react'
const CalendrierPage  = lazy(() => import('./pages/CalendrierPage'))
const RpePage         = lazy(() => import('./pages/RpePage'))
const MonRpePage      = lazy(() => import('./pages/MonRpePage'))
const JoueursPage     = lazy(() => import('./pages/JoueursPage'))
const FicheJoueurPage = lazy(() => import('./pages/FicheJoueurPage'))
const MaFichePage     = lazy(() => import('./pages/MaFichePage'))
const MessagesPage    = lazy(() => import('./pages/MessagesPage'))
const DashboardPage   = lazy(() => import('./pages/DashboardPage'))
const RessourcesPage  = lazy(() => import('./pages/RessourcesPage'))
const StaffPage       = lazy(() => import('./pages/StaffPage'))
const StatsPage       = lazy(() => import('./pages/StatsPage'))

function AppContent() {
  const { user, profile, loading, isCoach, isAdjoint, isJoueur } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  usePushNotifications(user, profile)

  if (loading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}><Spinner /></div>
  if (!user) return <LoginPage />

  // Route par défaut selon le rôle
  const defaultRoute = isJoueur ? '/mon-rpe' : '/calendrier'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#F4F6F9', paddingBottom: 80 }}>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Navigate to={defaultRoute} replace />} />
          <Route path="/calendrier"    element={<CalendrierPage />} />
          <Route path="/rpe"           element={isCoach || isAdjoint ? <RpePage /> : <Navigate to="/" />} />
          <Route path="/mon-rpe"       element={isJoueur ? <MonRpePage /> : <Navigate to="/rpe" />} />
          <Route path="/joueurs"       element={<JoueursPage />} />
          <Route path="/joueurs/:id"   element={<FicheJoueurPage />} />
          <Route path="/ma-fiche"      element={isJoueur ? <MaFichePage /> : <Navigate to="/" />} />
          <Route path="/messages"      element={<MessagesPage setUnreadCount={setUnreadCount} />} />
          <Route path="/dashboard"     element={<DashboardPage />} />
          <Route path="/ressources"    element={<RessourcesPage />} />
          <Route path="/staff"         element={isCoach ? <StaffPage /> : <Navigate to="/" />} />
          <Route path="/stats/:id"     element={isCoach || isAdjoint ? <StatsPage /> : <Navigate to="/" />} />
          <Route path="*"              element={<Navigate to={defaultRoute} replace />} />
        </Routes>
      </Suspense>
      <BottomNav unreadCount={unreadCount} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}
