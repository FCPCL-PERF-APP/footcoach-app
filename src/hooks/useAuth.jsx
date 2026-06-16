import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

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

  async function fetchProfile(userId) {
    try {
      // 1. Cherche dans staff
      const { data: staffData } = await supabase
        .from('staff').select('*').eq('auth_id', userId).maybeSingle()

      if (staffData) {
        setProfile({ ...staffData, type: 'staff' })
        setNeedsOnboarding(false)
        setLoading(false)
        return
      }

      // 2. Cherche dans joueurs
      const { data: joueurData } = await supabase
        .from('joueurs').select('*').eq('auth_id', userId).maybeSingle()

      if (joueurData) {
        setProfile({ ...joueurData, type: 'joueur', role: 'joueur' })
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
          await supabase.from('staff').update({ auth_id: userId }).eq('id', staffByEmail.id)
          setProfile({ ...staffByEmail, auth_id: userId, type: 'staff' })
          setNeedsOnboarding(false)
          setLoading(false)
          return
        }

        const { data: joueurByEmail } = await supabase
          .from('joueurs').select('*').eq('email', authUser.email).maybeSingle()
        if (joueurByEmail) {
          await supabase.from('joueurs').update({ auth_id: userId }).eq('id', joueurByEmail.id)
          setProfile({ ...joueurByEmail, auth_id: userId, type: 'joueur', role: 'joueur' })
          setNeedsOnboarding(!joueurByEmail.onboarding_done)
          setLoading(false)
          return
        }
      }

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
    setNeedsOnboarding(false)
    window.location.href = '/'
  }


  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`
    })
    if (error) throw error
  }

  const isCoach   = profile?.role === 'coach'
  const isAdjoint = profile?.role === 'adjoint' || profile?.role === 'gardien'
  const isStaff   = isCoach || isAdjoint
  const isJoueur = profile?.type === 'joueur' && !isCoach && !isAdjoint
  const canEdit    = isCoach
  const canComment = isStaff

  return (
    <AuthContext.Provider value={{
      user, profile, loading, needsOnboarding,
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
