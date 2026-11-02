import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { normaliserChemin, doitEnregistrer } from '../lib/pageVues'

// Enregistre discrètement chaque page ouverte (chemin + rôle) pour la page
// « Adoption de l'app ». Une erreur (hors ligne, table absente) est ignorée.
export default function SuiviPages() {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const dernieres = useRef(new Map())
  const role = profile?.role

  useEffect(() => {
    if (!role) return
    const chemin = normaliserChemin(pathname)
    if (!doitEnregistrer(dernieres.current, chemin)) return
    supabase.from('page_vues').insert({ role, path: chemin }).then(() => {}, () => {})
  }, [pathname, role])

  return null
}
