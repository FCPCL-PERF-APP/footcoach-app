import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { THEME } from '../theme'
import { Hand, Calendar, Users, Heart, BarChart3, MessageCircle, Trophy, ArrowLeft, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    icon: Hand,
    titre: 'Bienvenue Coach !',
    desc: "Bienvenue sur l'app FC PCL. Ce guide rapide te présente les fonctionnalités essentielles pour bien démarrer la saison.",
    tips: []
  },
  {
    icon: Calendar,
    titre: 'L\'Agenda',
    desc: "Crée tous tes événements de la saison : matchs, entraînements, et séances récurrentes.",
    tips: [
      '📅 Onglet Agenda → "+ Ajouter" pour créer un événement',
      '🔁 Bouton "🔁" pour créer toutes les séances de la saison en une fois',
      '📢 Clique sur un match pour accéder aux convocations et présences',
    ]
  },
  {
    icon: Users,
    titre: 'Les Joueurs',
    desc: "Gère ta liste de joueurs et invite-les sur l'app pour qu'ils puissent remplir leur RPE et consulter l'agenda.",
    tips: [
      '➕ Joueurs → "+ Ajouter" pour créer une fiche',
      '📧 Sur la fiche → envoie une invitation email au joueur',
      '✅ Le joueur reçoit un email, crée son mot de passe et se connecte',
      '📸 Il peut modifier sa photo de profil directement depuis l\'app',
    ]
  },
  {
    icon: Heart,
    titre: 'RPE & Footbar',
    desc: "Après chaque séance ou match, tes joueurs remplissent leur RPE. Tu accèdes aux données en temps réel.",
    tips: [
      '❤️ RPE équipe → vois les données de tous les joueurs par événement',
      '⚠️ L\'onglet "Manquants" te montre qui n\'a pas encore rempli',
      '🔔 Les rappels sont envoyés automatiquement chaque matin à 8h',
      '📊 Dashboard → alertes automatiques si surcharge ou baisse de forme',
    ]
  },
  {
    icon: BarChart3,
    titre: 'Stats & Analyse',
    desc: "Après chaque match, saisis les stats pour suivre les performances individuelles et collectives.",
    tips: [
      '⚽ Agenda → match → "📊 Stats" pour saisir les données',
      '🗺️ Onglet "Compo" pour placer tes joueurs sur le terrain',
      '📐 Menu Plus → CPA pour créer tes schémas de coups de pied arrêtés',
      '🏆 Menu Plus → Classements pour voir les tops buteurs et passeurs',
    ]
  },
  {
    icon: MessageCircle,
    titre: 'Communication',
    desc: "Communique avec tes joueurs via la messagerie intégrée — canal groupe ou messages privés.",
    tips: [
      '💬 Messages → canal groupe pour toute l\'équipe',
      '📢 Convocations → sélectionne les joueurs et envoie une notification push',
      '📊 Sondages → crée un vote rapide pour tes joueurs',
      '📝 Ressources → partage des vidéos ou PDF de travail',
    ]
  },
  {
    icon: Trophy,
    titre: 'Tout est prêt !',
    desc: "Tu as tout ce qu'il faut pour gérer ta saison comme un pro. Bonne saison au FC PCL !",
    tips: [
      '📦 Menu Plus → Archive saison en fin de saison pour repartir propre',
      '🌙 Bouton lune pour le mode sombre',
      '👤 Ton profil pour modifier ta photo et activer les notifications',
    ]
  },
]

export default function OnboardingCoachPage() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const { profile } = useAuth()

  async function finish() {
    navigate('/calendrier')
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gradient)', display: 'flex', flexDirection: 'column', padding: '40px 20px 30px' }}>

      {/* Progress bar */}
      <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 4, height: 4, marginBottom: 32 }}>
        <div style={{ background: '#fff', borderRadius: 4, height: '100%', width: `${progress}%`, transition: 'width .3s' }} />
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ marginBottom: 20 }}><current.icon size={64} color="#fff" strokeWidth={1.5} /></div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 12 }}>{current.titre}</h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', textAlign: 'center', marginBottom: 28, lineHeight: 1.6, maxWidth: 340 }}>{current.desc}</p>

        {current.tips.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 16, padding: '16px 20px', width: '100%', maxWidth: 380 }}>
            {current.tips.map((tip, i) => (
              <p key={i} style={{ fontSize: 13, color: '#fff', marginBottom: i < current.tips.length - 1 ? 10 : 0, lineHeight: 1.5 }}>{tip}</p>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32 }}>
        <button onClick={() => step > 0 ? setStep(s => s - 1) : null}
          style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', fontSize: 14, cursor: step > 0 ? 'pointer' : 'not-allowed', opacity: step > 0 ? 1 : 0.3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Précédent
        </button>

        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{step + 1} / {STEPS.length}</span>

        {isLast ? (
          <button onClick={finish}
            style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#fff', color: 'var(--primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            C'est parti !
          </button>
        ) : (
          <button onClick={() => setStep(s => s + 1)}
            style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            Suivant <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Skip */}
      {!isLast && (
        <button onClick={finish}
          style={{ marginTop: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer', textAlign: 'center' }}>
          Passer le tutoriel
        </button>
      )}
    </div>
  )
}
