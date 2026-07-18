// Composants UI réutilisables
import { ChevronRight } from 'lucide-react'
import { THEME } from '../theme'

export function IconTile({ icon: Icon, color = 'var(--primary)', bg = 'var(--primary-bg)', size = 20, tileSize = 36 }) {
  return (
    <div style={{
      width: tileSize, height: tileSize, borderRadius: THEME.radiusMd * 0.6,
      background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      <Icon size={size} strokeWidth={2} />
    </div>
  )
}

export function ListRow({ icon: Icon, label, sublabel, onClick, trailing, iconColor = 'var(--primary)', iconBg = 'var(--primary-bg)', last = false }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 0', cursor: onClick ? 'pointer' : 'default',
      borderBottom: last ? 'none' : `0.5px solid var(--border)`
    }}>
      {Icon && <IconTile icon={Icon} color={iconColor} bg={iconBg} size={16} tileSize={30} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div>}
      </div>
      {trailing !== undefined ? trailing : (onClick && <ChevronRight size={16} color="var(--text-muted)" />)}
    </div>
  )
}

export function StatTile({ label, value, sub, color = 'var(--primary)' }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: `0.5px solid var(--border)`, borderRadius: THEME.radiusMd, padding: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14,
      border: '0.5px solid var(--border)',
      padding: '12px 14px', marginBottom: 10,
      ...style
    }}>
      {children}
    </div>
  )
}

export function PageHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h1>
      {action}
    </div>
  )
}

export function Badge({ type = 'match', children }) {
  const colors = {
    match:   { bg: 'var(--primary-bg)', color: 'var(--primary)' },
    seance:  { bg: 'var(--success-bg)', color: 'var(--success)' },
    coach:   { bg: 'var(--primary-bg)', color: 'var(--primary)' },
    adjoint: { bg: 'var(--success-bg)', color: 'var(--success)' },
    gardien: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
    joueur:  { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
    alert:   { bg: 'var(--danger-bg)', color: 'var(--danger)' },
    warn:    { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  }
  const c = colors[type] || colors.match
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 500,
      padding: '2px 8px', borderRadius: 8,
      background: c.bg, color: c.color
    }}>
      {children}
    </span>
  )
}

export function Avatar({ initials, bg = '#B5D4F4', color = '#0C447C', size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 600, flexShrink: 0
    }}>
      {initials}
    </div>
  )
}

export function Button({ children, onClick, variant = 'default', size = 'md', disabled = false, style = {} }) {
  const variants = {
    default: { background: 'transparent', color: 'var(--text-primary)', border: '0.5px solid var(--border)' },
    primary: { background: 'var(--primary)', color: '#fff', border: '1px solid var(--primary)' },
    success: { background: 'var(--success)', color: '#fff', border: '1px solid var(--success)' },
    danger:  { background: 'var(--danger)', color: '#fff', border: '1px solid var(--danger)' },
  }
  const sizes = {
    sm: { padding: '4px 10px', fontSize: 11, borderRadius: 8 },
    md: { padding: '8px 14px', fontSize: 13, borderRadius: 10 },
    lg: { padding: '12px 16px', fontSize: 14, borderRadius: 12 },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', fontWeight: 500,
        opacity: disabled ? 0.6 : 1,
        transition: 'opacity .15s',
        ...variants[variant],
        ...sizes[size],
        ...style
      }}
    >
      {children}
    </button>
  )
}

export function Input({ label, value, onChange, type = 'text', placeholder, disabled = false, style = {} }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, fontWeight: 500 }}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%', padding: '8px 10px',
          border: '0.5px solid var(--border)', borderRadius: 10,
          fontSize: 13, background: disabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
          color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
          ...style
        }}
      />
    </div>
  )
}

export function Select({ label, value, onChange, options = [], disabled = false }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, fontWeight: 500 }}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', padding: '8px 10px',
          border: '0.5px solid var(--border)', borderRadius: 10,
          fontSize: 13, background: 'var(--bg-card)', color: 'var(--text-primary)',
          outline: 'none', boxSizing: 'border-box'
        }}
      >
        {options.map(opt => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt}</option>
        ))}
      </select>
    </div>
  )
}

export function Textarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, fontWeight: 500 }}>{label}</label>}
      <textarea
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', padding: '8px 10px',
          border: '0.5px solid var(--border)', borderRadius: 10,
          fontSize: 13, background: 'var(--bg-card)', color: 'var(--text-primary)',
          outline: 'none', boxSizing: 'border-box',
          resize: 'vertical', fontFamily: 'inherit'
        }}
      />
    </div>
  )
}

export function BarChart({ data, maxValue = 5 }) {
  // data = [{ label, value, color }]
  return (
    <div>
      {data.map(({ label, value, color = 'var(--primary)' }) => (
        <div key={label} style={{ marginBottom: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
            <span>{label}</span>
            <span>{typeof value === 'number' ? value.toFixed(1) : value}</span>
          </div>
          <div style={{ height: 7, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, background: color,
              width: `${Math.min(100, (value / maxValue) * 100).toFixed(0)}%`,
              transition: 'width .5s'
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ReadonlyBanner({ name, role }) {
  return (
    <div style={{
      background: 'var(--primary-bg)', border: '0.5px solid var(--primary)',
      borderRadius: 10, padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 12
    }}>
      <span style={{ fontSize: 16 }}>👁</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>{name}</div>
        <div style={{ fontSize: 10, color: 'var(--primary)' }}>Mode consultation — vous pouvez commenter les fiches joueurs</div>
      </div>
    </div>
  )
}

export function AlertCard({ type = 'red', title, message }) {
  const colors = {
    red:    { border: 'var(--danger)', bg: 'var(--danger-bg)' },
    orange: { border: '#D85A30', bg: '#FDF5EE' },
    yellow: { border: 'var(--warning)', bg: 'var(--warning-bg)' },
  }
  const c = colors[type] || colors.red
  return (
    <div style={{
      borderLeft: `3px solid ${c.border}`,
      borderRadius: 8, padding: '10px 12px',
      marginBottom: 8, background: c.bg
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{message}</div>
    </div>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 32, height: 32, border: '3px solid var(--border)',
        borderTop: '3px solid var(--primary)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
