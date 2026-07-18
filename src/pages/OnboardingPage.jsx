import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import PushToggle from '../components/PushToggle'
import { THEME } from '../theme'
import { Hand, Calendar, Heart, Radio, MessageCircle, Home, Bell, Target, ArrowLeft, ArrowRight, Rocket, MapPin } from 'lucide-react'

const STEPS = [
  {
    icon: Hand,
    title: 'Bienvenue dans l\'app FC PCL !',
    desc: 'Ton coach Romain GICQUEL t\'a invité à rejoindre l\'application officielle du FC PCL. En quelques minutes, tu seras prêt à l\'utiliser.',
    color: 'var(--primary)',
  },
  {
    icon: Calendar,
    title: 'Ton calendrier',
    desc: 'Consulte tous les matchs et entraînements à venir. Confirme ta présence directement depuis l\'app avec Présent, Absent ou Blessé.',
    color: 'var(--primary)',
    image: 'Agenda'
  },
  {
    icon: Heart,
    title: 'Ton RPE',
    desc: 'Après chaque séance ou match, remplis ton RPE (évaluation de l\'effort perçu). Ça prend 2 minutes et aide ton coach à gérer ta charge de travail.',
    color: 'var(--danger)',
    image: 'Mon RPE'
  },
  {
    icon: Radio,
    title: 'Ton Footbar',
    desc: 'Si tu as accès à des données GPS ou de tracking, saisis tes statistiques physiques : distance, sprints, vitesse max...',
    color: 'var(--success)',
    image: 'Plus → Mon Footbar'
  },
  {
    icon: MessageCircle,
    title: 'Messages',
    desc: 'Communique directement avec ton coach et tes coéquipiers. Le canal groupe est accessible à toute l\'équipe.',
    color: 'var(--warning)',
    image: 'Messages'
  },
  {
    icon: Home,
    title: 'Ton dashboard',
    desc: 'Retrouve un résumé de toutes tes données — RPE, présences, Footbar, objectifs et blessures — en un seul endroit.',
    color: 'var(--primary)',
    image: 'Dashboard'
  },
  {
    icon: Bell,
    title: 'Active tes notifications',
    desc: 'Reçois une alerte pour les convocations, les rappels RPE et les messages de ton coach. Tu peux les désactiver à tout moment depuis ton profil.',
    color: 'var(--primary)',
    pushStep: true,
  },
  {
    icon: Target,
    title: 'Tu es prêt !',
    desc: 'L\'application est là pour t\'aider à progresser. Ton coach suit tes données pour mieux personnaliser ton entraînement.',
    color: 'var(--success)',
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function finish() {
    // Marque l'onboarding comme complété
    if (profile?.id) {
      await supabase.from('joueurs').update({ onboarding_done: true }).eq('id', profile.id)

      // Message de bienvenue automatique dans la messagerie privée
      try {
        // Trouver le coach principal
        const { data: coach } = await supabase.from('staff')
          .select('auth_id, nom, prenom')
          .eq('role', 'coach')
          .maybeSingle()

        if (coach?.auth_id) {
          const myAuthId = profile?.auth_id || profile?.id
          await supabase.from('messages').insert({
            expediteur_id: coach.auth_id,
            expediteur_nom: `${coach.nom} ${coach.prenom}`,
            expediteur_role: 'coach',
            destinataire_id: myAuthId,
            groupe: false,
            contenu: `⚽ Bienvenue sur l'app FC PCL ${profile.prenom} ! Tu peux dès maintenant indiquer tes présences, remplir ton RPE après chaque séance et suivre tes stats. N'hésite pas à me contacter ici si tu as des questions. Bonne saison ! 💪`
          })
        }
      } catch (err) {
        console.error('Erreur message bienvenue:', err)
      }
    }
    navigate('/mon-dashboard')
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gradient)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      {/* Logo */}
      <div style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', background: '#fff', padding: 5, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <img src="/icons/logo.jpg" alt="FC PCL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>

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
              background: i <= step ? 'var(--primary)' : 'var(--border)',
              transition: 'background .3s'
            }} />
          ))}
        </div>

        {/* Icone */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `${current.color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <current.icon size={30} color={current.color} strokeWidth={1.8} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
          {current.title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: current.image || current.pushStep ? 16 : 28 }}>
          {current.desc}
        </p>

        {/* Activation des notifications */}
        {current.pushStep && (
          <div style={{ textAlign: 'left', background: 'var(--bg-secondary)', borderRadius: 12, padding: '4px 14px', marginBottom: 24 }}>
            <PushToggle />
          </div>
        )}

        {/* Chemin de navigation */}
        {current.image && (
          <div style={{ background: 'var(--primary-bg)', borderRadius: 10, padding: '8px 14px', marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={12} color={'var(--primary)'} />
            <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{current.image}</p>
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, padding: 12, borderRadius: 10,
              border: '0.5px solid var(--border)', background: 'transparent',
              fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
            }}><ArrowLeft size={13} /> Retour</button>
          )}
          <button onClick={isLast ? finish : () => setStep(s => s + 1)} style={{
            flex: 2, padding: 12, borderRadius: 10,
            border: 'none', background: 'var(--gradient)',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            {isLast ? <><Rocket size={14} /> Commencer !</> : <>Suivant <ArrowRight size={14} /></>}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button onClick={finish} style={{ marginTop: 10, background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
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
