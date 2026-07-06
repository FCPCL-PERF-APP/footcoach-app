import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePush } from './hooks/usePush'
import { Spinner } from './components/UI'
import BottomNav from './components/BottomNav'
import AppHeader from './components/AppHeader'
import LoginPage from './pages/LoginPage'
import { lazy, Suspense, useState } from 'react'
import { THEME } from './theme'

const CalendrierPage         = lazy(() => import('./pages/CalendrierPage'))
const CalendrierVisuelPage   = lazy(() => import('./pages/CalendrierVisuelPage'))
const RpePage                = lazy(() => import('./pages/RpePage'))
const MonRpePage             = lazy(() => import('./pages/MonRpePage'))
const FootbarPage            = lazy(() => import('./pages/FootbarPage'))
const MonFootbarPage         = lazy(() => import('./pages/MonFootbarPage'))
const JoueursPage            = lazy(() => import('./pages/JoueursPage'))
const FicheJoueurPage        = lazy(() => import('./pages/FicheJoueurPage'))
const NouveauJoueurPage      = lazy(() => import('./pages/NouveauJoueurPage'))
const ImportJoueursPage      = lazy(() => import('./pages/ImportJoueursPage'))
const MaFichePage            = lazy(() => import('./pages/MaFichePage'))
const MesObjectifsPage       = lazy(() => import('./pages/MesObjectifsPage'))
const MessagesPage           = lazy(() => import('./pages/MessagesPage'))
const DashboardPage          = lazy(() => import('./pages/DashboardPage'))
const DashboardStatsPage     = lazy(() => import('./pages/DashboardStatsPage'))
const DashboardJoueurPage    = lazy(() => import('./pages/DashboardJoueurPage'))
const RessourcesPage         = lazy(() => import('./pages/RessourcesPage'))
const StaffPage              = lazy(() => import('./pages/StaffPage'))
const StatsConnexionPage     = lazy(() => import('./pages/StatsConnexionPage'))
const StatsPage              = lazy(() => import('./pages/StatsPage'))
const ConvocationsPage       = lazy(() => import('./pages/ConvocationsPage'))
const PresencesMatchPage     = lazy(() => import('./pages/PresencesMatchPage'))
const ChargeHebdoPage        = lazy(() => import('./pages/ChargeHebdoPage'))
const ComparatifJoueursPage  = lazy(() => import('./pages/ComparatifJoueursPage'))
const BilanSaisonPage        = lazy(() => import('./pages/BilanSaisonPage'))
const CorrelationPage        = lazy(() => import('./pages/CorrelationPage'))
const BlessuresPage          = lazy(() => import('./pages/BlessuresPage'))
const ObjectifsPage          = lazy(() => import('./pages/ObjectifsPage'))
const OnboardingPage         = lazy(() => import('./pages/OnboardingPage'))
const MonBilanPage           = lazy(() => import('./pages/MonBilanPage'))
const MonProfilJoueurPage    = lazy(() => import('./pages/MonProfilJoueurPage'))
const SetPasswordPage        = lazy(() => import('./pages/SetPasswordPage'))
const ProfilCoachPage        = lazy(() => import('./pages/ProfilCoachPage'))
const ArchiveSaisonPage      = lazy(() => import('./pages/ArchiveSaisonPage'))
const ClassementButeursPage  = lazy(() => import('./pages/ClassementButeursPage'))
const ExportDonneesPage      = lazy(() => import('./pages/ExportDonneesPage'))
const RadarJoueurPage        = lazy(() => import('./pages/RadarJoueurPage'))
const BadgesJoueurPage       = lazy(() => import('./pages/BadgesJoueurPage'))
const SondagePage            = lazy(() => import('./pages/SondagePage'))
const CPAPage                = lazy(() => import('./pages/CPAPage'))
const ExportFicheJoueurPage  = lazy(() => import('./pages/ExportFicheJoueurPage'))
const OnboardingCoachPage    = lazy(() => import('./pages/OnboardingCoachPage'))
const SearchPage             = lazy(() => import('./pages/SearchPage'))
const FunPage                = lazy(() => import('./pages/FunPage'))

const routeFallback = (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
    <Spinner />
  </div>
)

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
  if (needsOnboarding && isJoueur) return (
    <Suspense fallback={routeFallback}>
      <OnboardingPage />
    </Suspense>
  )

  const defaultRoute = isJoueur ? '/mon-dashboard' : '/calendrier'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: THEME.bgPage }}>
      <AppHeader />
      <div style={{ paddingBottom: 80 }}>
        <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/"                       element={<Navigate to={defaultRoute} replace />} />
          <Route path="/calendrier"             element={<CalendrierPage />} />
          <Route path="/calendrier-visuel"      element={<CalendrierVisuelPage />} />
<Route path="/fun" element={<FunPage />} />
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
        </Suspense>
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
