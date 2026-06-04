// Composants UI réutilisables

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '0.5px solid #E5E7EB',
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
      <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111' }}>{title}</h1>
      {action}
    </div>
  )
}

export function Badge({ type = 'match', children }) {
  const colors = {
    match:   { bg: '#E6F1FB', color: '#185FA5' },
    seance:  { bg: '#EAF3DE', color: '#3B6D11' },
    coach:   { bg: '#E6F1FB', color: '#185FA5' },
    adjoint: { bg: '#EAF3DE', color: '#3B6D11' },
    gardien: { bg: '#FAEEDA', color: '#854F0B' },
    joueur:  { bg: '#F3F4F6', color: '#6B7280' },
    alert:   { bg: '#FCEBEB', color: '#A32D2D' },
    warn:    { bg: '#FAEEDA', color: '#854F0B' },
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
    default: { background: 'transparent', color: '#374151', border: '0.5px solid #D1D5DB' },
    primary: { background: '#185FA5', color: '#fff', border: '1px solid #185FA5' },
    success: { background: '#3B6D11', color: '#fff', border: '1px solid #3B6D11' },
    danger:  { background: '#A32D2D', color: '#fff', border: '1px solid #A32D2D' },
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
      {label && <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3, fontWeight: 500 }}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%', padding: '8px 10px',
          border: '0.5px solid #D1D5DB', borderRadius: 10,
          fontSize: 13, background: disabled ? '#F9FAFB' : '#fff',
          color: '#111', outline: 'none', boxSizing: 'border-box',
          ...style
        }}
      />
    </div>
  )
}

export function Select({ label, value, onChange, options = [], disabled = false }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3, fontWeight: 500 }}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', padding: '8px 10px',
          border: '0.5px solid #D1D5DB', borderRadius: 10,
          fontSize: 13, background: '#fff', color: '#111',
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
      {label && <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3, fontWeight: 500 }}>{label}</label>}
      <textarea
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%', padding: '8px 10px',
          border: '0.5px solid #D1D5DB', borderRadius: 10,
          fontSize: 13, background: '#fff', color: '#111',
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
      {data.map(({ label, value, color = '#185FA5' }) => (
        <div key={label} style={{ marginBottom: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7280', marginBottom: 2 }}>
            <span>{label}</span>
            <span>{typeof value === 'number' ? value.toFixed(1) : value}</span>
          </div>
          <div style={{ height: 7, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
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
      background: '#E6F1FB', border: '0.5px solid #185FA5',
      borderRadius: 10, padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 12
    }}>
      <span style={{ fontSize: 16 }}>👁</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#185FA5' }}>{name}</div>
        <div style={{ fontSize: 10, color: '#185FA5' }}>Mode consultation — vous pouvez commenter les fiches joueurs</div>
      </div>
    </div>
  )
}

export function AlertCard({ type = 'red', title, message }) {
  const colors = {
    red:    { border: '#A32D2D', bg: '#FDF1F1' },
    orange: { border: '#D85A30', bg: '#FDF5EE' },
    yellow: { border: '#BA7517', bg: '#FDFAEE' },
  }
  const c = colors[type] || colors.red
  return (
    <div style={{
      borderLeft: `3px solid ${c.border}`,
      borderRadius: 8, padding: '10px 12px',
      marginBottom: 8, background: c.bg
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#555' }}>{message}</div>
    </div>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 32, height: 32, border: '3px solid #E5E7EB',
        borderTop: '3px solid #185FA5', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
