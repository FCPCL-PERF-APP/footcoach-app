import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { THEME } from '../theme'

const STEPS = [
  {
    icon: '👋',
    title: 'Bienvenue dans l\'app FC PCL !',
    desc: 'Ton coach Romain GICQUEL t\'a invité à rejoindre l\'application officielle du FC PCL. En quelques minutes, tu seras prêt à l\'utiliser.',
    color: THEME.primary,
  },
  {
    icon: '📅',
    title: 'Ton calendrier',
    desc: 'Consulte tous les matchs et entraînements à venir. Confirme ta présence directement depuis l\'app avec ✅ Présent, ❌ Absent ou 🤕 Blessé.',
    color: '#185FA5',
    image: '📅 → Agenda'
  },
  {
    icon: '❤️',
    title: 'Ton RPE',
    desc: 'Après chaque séance ou match, remplis ton RPE (évaluation de l\'effort perçu). Ça prend 2 minutes et aide ton coach à gérer ta charge de travail.',
    color: '#A32D2D',
    image: '❤️ → Mon RPE'
  },
  {
    icon: '📡',
    title: 'Ton Footbar',
    desc: 'Si tu as accès à des données GPS ou de tracking, saisis tes statistiques physiques : distance, sprints, vitesse max...',
    color: '#3B6D11',
    image: '☰ Plus → Mon Footbar'
  },
  {
    icon: '💬',
    title: 'Messages',
    desc: 'Communique directement avec ton coach et tes coéquipiers. Le canal groupe est accessible à toute l\'équipe.',
    color: '#854F0B',
    image: '💬 → Messages'
  },
  {
    icon: '🏠',
    title: 'Ton dashboard',
    desc: 'Retrouve un résumé de toutes tes données — RPE, présences, Footbar, objectifs et blessures — en un seul endroit.',
    color: THEME.primary,
    image: '🏠 → Dashboard'
  },
  {
    icon: '🎯',
    title: 'Tu es prêt !',
    desc: 'L\'application est là pour t\'aider à progresser. Ton coach suit tes données pour mieux personnaliser ton entraînement.',
    color: '#3B6D11',
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const { profile } = useAuth()
  const navigate = useNavigate()

 async function finish() {
    try {
      if (profile?.id) {
        await supabase.from('joueurs').update({ onboarding_done: true }).eq('id', profile.id)
      }
    } catch (err) {
      console.error('Erreur onboarding:', err)
    }
    navigate('/mon-dashboard')
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div style={{
      minHeight: '100vh',
      background: THEME.gradient,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      {/* Logo */}
      <img src="/icons/logo.jpg" alt="FC PCL"
        style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', objectFit: 'cover', marginBottom: 20 }} />

      {/* Carte */}
      <div style={{
        background: '#fff', borderRadius: 20,
        padding: '32px 24px', width: '100%', maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        textAlign: 'center'
      }}>
        {/* Étapes */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 4, flex: 1, borderRadius: 2,
              background: i <= step ? THEME.primary : '#E5E7EB',
              transition: 'background .3s'
            }} />
          ))}
        </div>

        {/* Icone */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `${current.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 16px'
        }}>
          {current.icon}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 10 }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: current.image ? 16 : 28 }}>
          {current.desc}
        </p>

        {/* Chemin de navigation */}
        {current.image && (
          <div style={{ background: '#F0F4FF', borderRadius: 10, padding: '8px 14px', marginBottom: 24, display: 'inline-block' }}>
            <p style={{ fontSize: 12, color: THEME.primary, fontWeight: 600 }}>📍 {current.image}</p>
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, padding: 12, borderRadius: 10,
              border: '0.5px solid #D1D5DB', background: 'transparent',
              fontSize: 13, cursor: 'pointer', color: '#6B7280'
            }}>← Retour</button>
          )}
          <button onClick={isLast ? finish : () => setStep(s => s + 1)} style={{
            flex: 2, padding: 12, borderRadius: 10,
            border: 'none', background: THEME.gradient,
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>
            {isLast ? '🚀 Commencer !' : 'Suivant →'}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button onClick={finish} style={{ marginTop: 10, background: 'none', border: 'none', fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }}>
            Passer l'introduction
          </button>
        )}
      </div>

      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginTop: 20 }}>
        {step + 1} / {STEPS.length}
      </p>
    </div>
  )
}
