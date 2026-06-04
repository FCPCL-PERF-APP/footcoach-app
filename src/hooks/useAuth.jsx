import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Récupère la session active
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // Écoute les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    // Cherche d'abord dans staff
    const { data: staffData } = await supabase
      .from('staff')
      .select('*')
      .eq('auth_id', userId)
      .single()

    if (staffData) {
      setProfile({ ...staffData, type: 'staff' })
      setLoading(false)
      return
    }

    // Sinon cherche dans joueurs
    const { data: joueurData } = await supabase
      .from('joueurs')
      .select('*')
      .eq('auth_id', userId)
      .single()

    if (joueurData) {
      setProfile({ ...joueurData, type: 'joueur' })
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
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  // Droits selon le rôle
  const isCoach = profile?.role === 'coach'
  const isStaff = ['coach', 'adjoint', 'gardien'].includes(profile?.role)
  const isAdjoint = ['adjoint', 'gardien'].includes(profile?.role)
  const isJoueur = profile?.type === 'joueur'

  const canEdit = isCoach
  const canComment = isStaff
  const canViewAll = isStaff

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signOut, resetPassword,
      isCoach, isStaff, isAdjoint, isJoueur,
      canEdit, canComment, canViewAll
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
