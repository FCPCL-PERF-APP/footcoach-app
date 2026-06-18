import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePush } from './hooks/usePush'
import { Spinner } from './components/UI'
import BottomNav from './components/BottomNav'
import AppHeader from './components/AppHeader'
import LoginPage from './pages/LoginPage'
import { useState } from 'react'
import { THEME } from './theme'

import CalendrierPage      from './pages/CalendrierPage'
import CalendrierVisuelPage from './pages/CalendrierVisuelPage'
import RpePage             from './pages/RpePage'
import MonRpePage          from './pages/MonRpePage'
import FootbarPage         from './pages/FootbarPage'
import MonFootbarPage      from './pages/MonFootbarPage'
import JoueursPage         from './pages/JoueursPage'
import FicheJoueurPage     from './pages/FicheJoueurPage'
import NouveauJoueurPage   from './pages/NouveauJoueurPage'
import ImportJoueursPage   from './pages/ImportJoueursPage'
import MaFichePage         from './pages/MaFichePage'
import MesObjectifsPage from './pages/MesObjectifsPage'
import MessagesPage        from './pages/MessagesPage'
import DashboardPage       from './pages/DashboardPage'
import DashboardStatsPage from './pages/DashboardStatsPage'
import DashboardJoueurPage from './pages/DashboardJoueurPage'
import RessourcesPage      from './pages/RessourcesPage'
import StaffPage           from './pages/StaffPage'
import StatsConnexionPage from './pages/StatsConnexionPage'
import StatsPage           from './pages/StatsPage'
import ConvocationsPage    from './pages/ConvocationsPage'
import PresencesMatchPage  from './pages/PresencesMatchPage'
import ChargeHebdoPage     from './pages/ChargeHebdoPage'
import ComparatifJoueursPage from './pages/ComparatifJoueursPage'
import BilanSaisonPage     from './pages/BilanSaisonPage'
import CorrelationPage     from './pages/CorrelationPage'
import BlessuresPage       from './pages/BlessuresPage'
import ObjectifsPage       from './pages/ObjectifsPage'
import OnboardingPage      from './pages/OnboardingPage'
import MonBilanPage from './pages/MonBilanPage'
import MonProfilJoueurPage from './pages/MonProfilJoueurPage'
import SetPasswordPage from './pages/SetPasswordPage'
import ProfilCoachPage     from './pages/ProfilCoachPage'
import ArchiveSaisonPage   from './pages/ArchiveSaisonPage'
import ClassementButeursPage from './pages/ClassementButeursPage'
import ExportDonneesPage   from './pages/ExportDonneesPage'
import RadarJoueurPage     from './pages/RadarJoueurPage'
import BadgesJoueurPage from './pages/BadgesJoueurPage'
import SondagePage from './pages/SondagePage'
import CPAPage from './pages/CPAPage'
import ExportFicheJoueurPage from './pages/ExportFicheJoueurPage'
import OnboardingCoachPage from './pages/OnboardingCoachPage'
import SearchPage from './pages/SearchPage'

function AppContent() {
  const { user, profile, loading, needsOnboarding, isCoach, isAdjoint, isJoueur } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  usePush(user, profile)

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: THEME.gradient }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/icons/logo.jpg" alt="FC PCL" style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 16, objectFit: 'cover' }} />
        <Spinner />
      </div>
    </div>
  )

  if (!user) return <LoginPage />

  // Onboarding automatique pour les nouveaux joueurs
  if (needsOnboarding && isJoueur) return <OnboardingPage />

  const defaultRoute = isJoueur ? '/mon-dashboard' : '/calendrier'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: THEME.bgPage }}>
      <AppHeader />
      <div style={{ paddingBottom: 80 }}>
        <Routes>
          <Route path="/"                       element={<Navigate to={defaultRoute} replace />} />
          <Route path="/calendrier"             element={<CalendrierPage />} />
          <Route path="/calendrier-visuel"      element={<CalendrierVisuelPage />} />
          <Route path="/rpe"                    element={isCoach || isAdjoint ? <RpePage /> : <Navigate to="/" />} />
          <Route path="/mon-rpe"                element={isJoueur ? <MonRpePage /> : <Navigate to="/rpe" />} />
<Route path="/cpa" element={<CPAPage />} />
          <Route path="/footbar"                element={isCoach || isAdjoint ? <FootbarPage /> : <Navigate to="/" />} />
          <Route path="/mon-footbar"            element={isJoueur ? <MonFootbarPage /> : <Navigate to="/footbar" />} />
          <Route path="/joueurs"                element={<JoueursPage />} />
          <Route path="/joueurs/nouveau"        element={isCoach ? <NouveauJoueurPage /> : <Navigate to="/" />} />
          <Route path="/joueurs/import"         element={isCoach ? <ImportJoueursPage /> : <Navigate to="/" />} />
          <Route path="/joueurs/:id"            element={<FicheJoueurPage />} />
          <Route path="/joueurs/:id/blessures"  element={<BlessuresPage />} />
          <Route path="/joueurs/:id/objectifs"  element={<ObjectifsPage />} />
<Route path="/export-fiche/:id" element={isCoach ? <ExportFicheJoueurPage /> : <Navigate to="/" />} />
<Route path="/onboarding-coach" element={<OnboardingCoachPage />} />
<Route path="/search" element={<SearchPage />} />
          <Route path="/ma-fiche"               element={isJoueur ? <MaFichePage /> : <Navigate to="/" />} />
<Route path="/mes-objectifs" element={isJoueur ? <MesObjectifsPage /> : <Navigate to="/" />} />
          <Route path="/messages"               element={<MessagesPage setUnreadCount={setUnreadCount} />} />
          <Route path="/dashboard"              element={<DashboardPage />} />
          <Route path="/mon-dashboard"          element={isJoueur ? <DashboardJoueurPage /> : <Navigate to="/dashboard" />} />
          <Route path="/ressources"             element={<RessourcesPage />} />
          <Route path="/staff"                  element={isCoach ? <StaffPage /> : <Navigate to="/" />} />
          <Route path="/stats/:id"              element={isCoach || isAdjoint ? <StatsPage /> : <Navigate to="/" />} />
          <Route path="/convocations/:id"       element={isCoach ? <ConvocationsPage /> : <Navigate to="/" />} />
          <Route path="/presences/:id"          element={isCoach || isAdjoint ? <PresencesMatchPage /> : <Navigate to="/" />} />
          <Route path="/charge-hebdo"           element={isCoach ? <ChargeHebdoPage /> : <Navigate to="/" />} />
          <Route path="/comparatif"             element={isCoach ? <ComparatifJoueursPage /> : <Navigate to="/" />} />
          <Route path="/bilan-saison"           element={isCoach ? <BilanSaisonPage /> : <Navigate to="/" />} />
          <Route path="/correlation"            element={isCoach ? <CorrelationPage /> : <Navigate to="/" />} />
<Route path="/mes-objectifs" element={isJoueur ? <MesObjectifsPage /> : <Navigate to="/" />} />
<Route path="/mes-badges" element={isJoueur ? <BadgesJoueurPage /> : <Navigate to="/" />} />
<Route path="/sondages" element={<SondagePage />} />
          <Route path="/onboarding"             element={<OnboardingPage />} />
<Route path="/mon-bilan" element={isJoueur ? <MonBilanPage /> : <Navigate to="/" />} />
<Route path="/mon-profil-joueur" element={isJoueur ? <MonProfilJoueurPage /> : <Navigate to="/" />} />
<Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/mon-profil"             element={isCoach ? <ProfilCoachPage /> : <Navigate to="/" />} />
          <Route path="/archive-saison"         element={isCoach ? <ArchiveSaisonPage /> : <Navigate to="/" />} />
<Route path="/classement" element={isCoach ? <ClassementButeursPage /> : <Navigate to="/" />} />
<Route path="/stats-connexion" element={isCoach ? <StatsConnexionPage /> : <Navigate to="/" />} />
<Route path="/stats-matchs" element={isCoach ? <DashboardStatsPage /> : <Navigate to="/" />} />
<Route path="/export" element={isCoach ? <ExportDonneesPage /> : <Navigate to="/" />} />
<Route path="/joueurs/:id/radar" element={isCoach ? <RadarJoueurPage /> : <Navigate to="/" />} />
<Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </Routes>
      </div>
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
