import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePush } from './hooks/usePush'
import SyncStatusBanner from './components/SyncStatusBanner'
import { Spinner } from './components/UI'
import BottomNav from './components/BottomNav'
import AppHeader from './components/AppHeader'
import SuiviPages from './components/SuiviPages'
import { peutAcceder } from './lib/droits'
import LoginPage from './pages/LoginPage'
import { lazy, Suspense, useEffect } from 'react'

const CalendrierPage         = lazy(() => import('./pages/CalendrierPage'))
const CalendrierVisuelPage   = lazy(() => import('./pages/CalendrierVisuelPage'))
const RpePage                = lazy(() => import('./pages/RpePage'))
const FootbarPage            = lazy(() => import('./pages/FootbarPage'))
const MonSuiviPage           = lazy(() => import('./pages/MonSuiviPage'))
const JoueursPage            = lazy(() => import('./pages/JoueursPage'))
const FicheJoueurPage        = lazy(() => import('./pages/FicheJoueurPage'))
const NouveauJoueurPage      = lazy(() => import('./pages/NouveauJoueurPage'))
const ImportJoueursPage      = lazy(() => import('./pages/ImportJoueursPage'))
const MaFichePage            = lazy(() => import('./pages/MaFichePage'))
const MesObjectifsPage       = lazy(() => import('./pages/MesObjectifsPage'))
const MessagesPage           = lazy(() => import('./pages/MessagesPage'))
const DashboardPage          = lazy(() => import('./pages/DashboardPage'))
const DashboardStatsPage     = lazy(() => import('./pages/DashboardStatsPage'))
const AnalysePage            = lazy(() => import('./pages/AnalysePage'))
const DashboardJoueurPage    = lazy(() => import('./pages/DashboardJoueurPage'))
const RessourcesPage         = lazy(() => import('./pages/RessourcesPage'))
const StaffPage              = lazy(() => import('./pages/StaffPage'))
const StatsConnexionPage     = lazy(() => import('./pages/StatsConnexionPage'))
const StatsPage              = lazy(() => import('./pages/StatsPage'))
const ConvocationsPage       = lazy(() => import('./pages/ConvocationsPage'))
const PresencesMatchPage     = lazy(() => import('./pages/PresencesMatchPage'))
const PresencesRecapPage     = lazy(() => import('./pages/PresencesRecapPage'))
const ChargeHebdoPage        = lazy(() => import('./pages/ChargeHebdoPage'))
const ComparatifJoueursPage  = lazy(() => import('./pages/ComparatifJoueursPage'))
const BilanSaisonPage        = lazy(() => import('./pages/BilanSaisonPage'))
const CorrelationPage        = lazy(() => import('./pages/CorrelationPage'))
const BlessuresPage          = lazy(() => import('./pages/BlessuresPage'))
const ObjectifsPage          = lazy(() => import('./pages/ObjectifsPage'))
const OnboardingPage         = lazy(() => import('./pages/OnboardingPage'))
const MonBilanPage           = lazy(() => import('./pages/MonBilanPage'))
const SetPasswordPage        = lazy(() => import('./pages/SetPasswordPage'))
const ProfilCoachPage        = lazy(() => import('./pages/ProfilCoachPage'))
const ArchiveSaisonPage      = lazy(() => import('./pages/ArchiveSaisonPage'))
const ClassementButeursPage  = lazy(() => import('./pages/ClassementButeursPage'))
const ChampionnatPage         = lazy(() => import('./pages/ChampionnatPage'))
const MatchLivePage           = lazy(() => import('./pages/MatchLivePage'))
const ExportDonneesPage      = lazy(() => import('./pages/ExportDonneesPage'))
const RadarJoueurPage        = lazy(() => import('./pages/RadarJoueurPage'))
const BadgesJoueurPage       = lazy(() => import('./pages/BadgesJoueurPage'))
const SondagePage            = lazy(() => import('./pages/SondagePage'))
const CPAPage                = lazy(() => import('./pages/CPAPage'))
const ExportFicheJoueurPage  = lazy(() => import('./pages/ExportFicheJoueurPage'))
const OnboardingCoachPage    = lazy(() => import('./pages/OnboardingCoachPage'))
const SearchPage             = lazy(() => import('./pages/SearchPage'))
const TirageAuSortPage       = lazy(() => import('./pages/TirageAuSortPage'))
const CalendrierGeneralPage  = lazy(() => import('./pages/CalendrierGeneralPage'))
const FunPage                = lazy(() => import('./pages/FunPage'))

const routeFallback = (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
    <Spinner />
  </div>
)

function AppContent() {
  const { user, profile, loading, needsOnboarding, profileError, retryProfile, signOut, isCoach, isAdjoint, isJoueur, isStaff } = useAuth()
  // autoSync : à chaque ouverture / retour au premier plan, vérifie que l'abonnement de cet
  // appareil existe toujours et est bien enregistré en base (et le recrée sinon) —
  // sans ça, un abonnement expiré ou supprimé restait mort jusqu'à une réactivation
  // manuelle des notifications. (Avant, on passait ici l'objet `user` entier au lieu
  // de son id.)
  usePush(user?.id, { autoSync: true })

  // Une fois l'app stable quelques secondes, on lève le garde-fou anti-boucle de
  // ErrorBoundary : une future erreur de chunk (ex. après un nouveau déploiement)
  // pourra de nouveau déclencher un rechargement automatique.
  useEffect(() => {
    const t = setTimeout(() => sessionStorage.removeItem('fc-chunk-reload'), 5000)
    return () => clearTimeout(t)
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gradient)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 16, background: '#fff', padding: 6, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <img src="/icons/logo.png" alt="FC PCL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <Spinner />
      </div>
    </div>
  )

  // /set-password doit rester accessible même sans session : un lien d'invitation
  // expiré ne déclenche jamais SIGNED_IN, donc `user` resterait null indéfiniment
  // et on serait renvoyé vers LoginPage avant même d'afficher le message d'erreur.
  if (!user && window.location.pathname === '/set-password') {
    return (
      <Suspense fallback={routeFallback}>
        <SetPasswordPage />
      </Suspense>
    )
  }

  if (!user) return <LoginPage />

  // Erreur réseau/serveur lors du chargement du profil : on évite de laisser l'utilisateur
  // entrer dans l'app avec un profil vide qui casserait silencieusement plusieurs pages.
  if (profileError) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gradient)', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 16, padding: 24, maxWidth: 340 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
        <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{profileError}</p>
        <button onClick={retryProfile} style={{ marginTop: 10, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--gradient)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Réessayer
        </button>
        <button onClick={signOut} style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  )

  // Compte authentifié mais sans fiche joueur/staff associée (ni par auth_id, ni par
  // email) : afficher un message clair plutôt qu'un dashboard joueur cassé (profil sans id).
  if (profile?.orphan) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--gradient)', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 16, padding: 24, maxWidth: 340 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
        <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{profile.archived ? 'Accès désactivé' : 'Compte non lié'}</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{profile.archived
          ? "Tu ne fais plus partie de l'effectif : ton accès à l'appli est désactivé. Contacte ton coach si tu reviens."
          : "Ton compte n'est pas encore associé à une fiche joueur ou staff. Contacte ton coach pour qu'il vérifie ton accès."}</p>
        <button onClick={signOut} style={{ marginTop: 14, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--gradient)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  )

  // Onboarding automatique pour les nouveaux joueurs
  if (needsOnboarding && isJoueur) return (
    <Suspense fallback={routeFallback}>
      <OnboardingPage />
    </Suspense>
  )

  const defaultRoute = isJoueur ? '/mon-dashboard' : '/calendrier'
  // Accès aux pages : niveaux définis dans src/lib/droits.js (testés).
  const droits = { isCoach, isAdjoint, isStaff, isJoueur }
  const garde = (chemin, page, repli = '/') => peutAcceder(chemin, droits) ? page : <Navigate to={repli} replace />

  return (
    <div style={{ maxWidth: 'var(--app-max-width)', margin: '0 auto', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <AppHeader />
      <SuiviPages />
      <SyncStatusBanner />
      <div style={{ paddingBottom: 80 }}>
        <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/"                       element={<Navigate to={defaultRoute} replace />} />
          <Route path="/calendrier"             element={<CalendrierPage />} />
          <Route path="/calendrier-visuel"      element={<CalendrierVisuelPage />} />
          <Route path="/calendrier-general"     element={<CalendrierGeneralPage />} />
<Route path="/fun" element={<FunPage />} />
          <Route path="/rpe" element={garde('/rpe', <RpePage />)} />
<Route path="/cpa" element={<CPAPage />} />
          <Route path="/footbar" element={garde('/footbar', <FootbarPage />)} />
          <Route path="/mon-suivi" element={garde('/mon-suivi', <MonSuiviPage />, '/rpe')} />
          <Route path="/mon-rpe"                element={<Navigate to="/mon-suivi" replace />} />
          <Route path="/mon-footbar"            element={<Navigate to="/mon-suivi" replace />} />
          <Route path="/joueurs"                element={<JoueursPage />} />
          <Route path="/joueurs/nouveau" element={garde('/joueurs/nouveau', <NouveauJoueurPage />)} />
          <Route path="/joueurs/import" element={garde('/joueurs/import', <ImportJoueursPage />)} />
          <Route path="/joueurs/:id"            element={<FicheJoueurPage />} />
          <Route path="/joueurs/:id/blessures"  element={<BlessuresPage />} />
          <Route path="/joueurs/:id/objectifs"  element={<ObjectifsPage />} />
          <Route path="/export-fiche/:id" element={garde('/export-fiche/:id', <ExportFicheJoueurPage />)} />
<Route path="/onboarding-coach" element={<OnboardingCoachPage />} />
<Route path="/search" element={<SearchPage />} />
          <Route path="/ma-fiche" element={garde('/ma-fiche', <MaFichePage />)} />
          <Route path="/mes-objectifs" element={garde('/mes-objectifs', <MesObjectifsPage />)} />
          <Route path="/messages"               element={<MessagesPage />} />
          <Route path="/dashboard" element={garde('/dashboard', <DashboardPage />, '/mon-dashboard')} />
          <Route path="/mon-dashboard" element={garde('/mon-dashboard', <DashboardJoueurPage />, '/dashboard')} />
          <Route path="/ressources"             element={<RessourcesPage />} />
          <Route path="/staff"                  element={<StaffPage />} />
          <Route path="/stats/:id" element={garde('/stats/:id', <StatsPage />)} />
          <Route path="/convocations/:id" element={garde('/convocations/:id', <ConvocationsPage />)} />
          <Route path="/presences/:id" element={garde('/presences/:id', <PresencesMatchPage />)} />
          <Route path="/presences-recap" element={garde('/presences-recap', <PresencesRecapPage />)} />
          <Route path="/charge-hebdo" element={garde('/charge-hebdo', <ChargeHebdoPage />)} />
          <Route path="/comparatif" element={garde('/comparatif', <ComparatifJoueursPage />)} />
          <Route path="/bilan-saison" element={garde('/bilan-saison', <BilanSaisonPage />)} />
          <Route path="/correlation" element={garde('/correlation', <CorrelationPage />)} />
          <Route path="/mes-badges" element={garde('/mes-badges', <BadgesJoueurPage />)} />
<Route path="/sondages" element={<SondagePage />} />
          <Route path="/onboarding"             element={<OnboardingPage />} />
          <Route path="/mon-bilan" element={garde('/mon-bilan', <MonBilanPage />)} />
<Route path="/mon-profil-joueur" element={<Navigate to="/ma-fiche?onglet=compte" replace />} />
<Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/mon-profil" element={garde('/mon-profil', <ProfilCoachPage />)} />
          <Route path="/tirage-au-sort" element={garde('/tirage-au-sort', <TirageAuSortPage />)} />
          <Route path="/archive-saison" element={garde('/archive-saison', <ArchiveSaisonPage />)} />
          <Route path="/classement" element={garde('/classement', <ClassementButeursPage />)} />
<Route path="/championnat" element={<ChampionnatPage />} />
<Route path="/match-live/:id" element={<MatchLivePage />} />
          <Route path="/stats-connexion" element={garde('/stats-connexion', <StatsConnexionPage />)} />
          <Route path="/stats-matchs" element={garde('/stats-matchs', <DashboardStatsPage />)} />
          <Route path="/analyse" element={garde('/analyse', <AnalysePage />)} />
          <Route path="/export" element={garde('/export', <ExportDonneesPage />)} />
          <Route path="/joueurs/:id/radar" element={garde('/joueurs/:id/radar', <RadarJoueurPage />)} />
<Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </Routes>
        </Suspense>
      </div>
      <BottomNav />
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
