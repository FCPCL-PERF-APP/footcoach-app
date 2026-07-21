import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, authHeaders } from '../lib/supabase'
import { Sentry } from '../lib/sentry'

// La mise à jour de last_seen passe par une route serveur (droits admin) plutôt qu'un
// update direct depuis le navigateur : côté staff, la policy RLS "staff_update_coach_only"
// ne permet qu'aux coachs de modifier une ligne staff, donc un adjoint/éducateur/
// préparateur qui se connecte ne pouvait jamais mettre à jour sa propre ligne. Appelée
// en tâche de fond, sans bloquer le chargement du profil si elle échoue.
function touchLastSeen() {
  authHeaders()
    .then(headers => fetch('/api/touch-last-seen', { method: 'POST', headers }))
    .catch(err => console.error('Erreur touchLastSeen:', err))
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setNeedsOnboarding(false); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Contexte utilisateur minimal pour Sentry — jamais `profile` tel quel, qui contient
  // potentiellement email/téléphone (PII à ne pas envoyer à un service tiers).
  useEffect(() => {
    Sentry.setUser(profile ? { id: profile.id || user?.id, role: profile.role, type: profile.type } : null)
  }, [profile, user])

  async function fetchProfile(userId) {
    setProfileError(null)
    try {
      const now = new Date().toISOString()

      // 1. Cherche dans staff
      const { data: staffData } = await supabase
        .from('staff').select('*').eq('auth_id', userId).maybeSingle()

      if (staffData) {
        // last_seen mis à jour via une route serveur (droits admin), pas un update
        // direct depuis le navigateur : la policy RLS "staff_update_coach_only" ne
        // permet qu'aux coachs de modifier une ligne staff, donc un adjoint/éducateur/
        // préparateur qui se connecte ne pouvait jamais mettre à jour sa propre ligne
        // (échec silencieux, RLS bloque sans erreur) — son statut restait "jamais
        // connecté" malgré une utilisation normale de l'appli.
        touchLastSeen()
        setProfile({ ...staffData, last_seen: now, type: 'staff' })
        setNeedsOnboarding(false)
        setLoading(false)
        return
      }

      // 2. Cherche dans joueurs
      const { data: joueurData } = await supabase
        .from('joueurs').select('*').eq('auth_id', userId).maybeSingle()

      if (joueurData) {
        touchLastSeen()
        setProfile({ ...joueurData, last_seen: now, type: 'joueur', role: 'joueur' })
        // Vérifie si onboarding nécessaire
        setNeedsOnboarding(!joueurData.onboarding_done)
        setLoading(false)
        return
      }

      // 3. Fallback par email
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser?.email) {
        const { data: staffByEmail } = await supabase
          .from('staff').select('*').eq('email', authUser.email).maybeSingle()
        if (staffByEmail) {
          await supabase.from('staff').update({ auth_id: userId, last_seen: now }).eq('id', staffByEmail.id)
          setProfile({ ...staffByEmail, auth_id: userId, last_seen: now, type: 'staff' })
          setNeedsOnboarding(false)
          setLoading(false)
          return
        }

        const { data: joueurByEmail } = await supabase
          .from('joueurs').select('*').eq('email', authUser.email).maybeSingle()
        if (joueurByEmail) {
          await supabase.from('joueurs').update({ auth_id: userId, last_seen: now }).eq('id', joueurByEmail.id)
          setProfile({ ...joueurByEmail, auth_id: userId, last_seen: now, type: 'joueur', role: 'joueur' })
          setNeedsOnboarding(!joueurByEmail.onboarding_done)
          setLoading(false)
          return
        }
      }

      // Compte authentifié mais sans fiche joueur/staff correspondante (ni par auth_id
      // ni par email) : cas légitime distinct d'une erreur réseau/serveur, marqué comme
      // tel pour que l'UI puisse afficher un message clair plutôt qu'un dashboard cassé.
      setProfile({ type: 'joueur', role: 'joueur', orphan: true })
    } catch (err) {
      console.error('fetchProfile error:', err)
      setProfileError('Impossible de charger ton profil. Vérifie ta connexion et réessaie.')
      setProfile(null)
    }
    setLoading(false)
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setNeedsOnboarding(false)
    window.location.href = '/'
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`
    })
    if (error) throw error
  }

  // 'admin' a un accès complet équivalent à 'coach' (voir StaffPage.jsx ROLES), 'preparateur' et
  // 'gardien' sont des rôles staff à accès restreint équivalents à 'adjoint'.
  const isCoach   = profile?.role === 'coach' || profile?.role === 'admin'
  const isAdjoint = profile?.role === 'adjoint' || profile?.role === 'gardien' || profile?.role === 'preparateur'
  const isStaff   = isCoach || isAdjoint
  const isJoueur  = profile?.type === 'joueur' || (!isCoach && !isAdjoint)
  const canEdit    = isCoach
  const canComment = isStaff

  function retryProfile() {
    if (user) { setLoading(true); fetchProfile(user.id) }
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, needsOnboarding, profileError, retryProfile,
      signIn, signOut, resetPassword,
      isCoach, isStaff, isAdjoint, isJoueur,
      canEdit, canComment, canViewAll: isStaff
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
