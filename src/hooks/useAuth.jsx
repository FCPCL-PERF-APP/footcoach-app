import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      // Cherche dans staff avec auth_id
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('auth_id', userId)
        .maybeSingle()

      if (staffData && !staffError) {
        setProfile({ ...staffData, type: 'staff' })
        setLoading(false)
        return
      }

      // Cherche dans joueurs avec auth_id
      const { data: joueurData, error: joueurError } = await supabase
        .from('joueurs')
        .select('*')
        .eq('auth_id', userId)
        .maybeSingle()

      if (joueurData && !joueurError) {
        setProfile({ ...joueurData, type: 'joueur', role: 'joueur' })
        setLoading(false)
        return
      }

      // Fallback — cherche par email dans auth.users
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser?.email) {
        const { data: staffByEmail } = await supabase
          .from('staff')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle()

        if (staffByEmail) {
          // Met à jour auth_id automatiquement
          await supabase.from('staff').update({ auth_id: userId }).eq('id', staffByEmail.id)
          setProfile({ ...staffByEmail, auth_id: userId, type: 'staff' })
          setLoading(false)
          return
        }

        const { data: joueurByEmail } = await supabase
          .from('joueurs')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle()

        if (joueurByEmail) {
          await supabase.from('joueurs').update({ auth_id: userId }).eq('id', joueurByEmail.id)
          setProfile({ ...joueurByEmail, auth_id: userId, type: 'joueur', role: 'joueur' })
          setLoading(false)
          return
        }
      }

      // Aucun profil trouvé
      setProfile({ type: 'joueur', role: 'joueur' })
    } catch (err) {
      console.error('fetchProfile error:', err)
      setProfile({ type: 'joueur', role: 'joueur' })
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

  const isCoach   = profile?.role === 'coach'
  const isAdjoint = profile?.role === 'adjoint' || profile?.role === 'gardien'
  const isStaff   = isCoach || isAdjoint
  const isJoueur  = profile?.type === 'joueur' || (!isCoach && !isAdjoint)
  const canEdit    = isCoach
  const canComment = isStaff

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
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
