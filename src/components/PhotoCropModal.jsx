import { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../lib/cropImage'
import { THEME } from '../theme'

export default function PhotoCropModal({ file, onCancel, onCropped }) {
  const [imageSrc] = useState(() => URL.createObjectURL(file))
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => () => URL.revokeObjectURL(imageSrc), [imageSrc])

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), [])

  async function handleValidate() {
    if (!croppedAreaPixels) return
    setProcessing(true)
    try {
      const cropped = await getCroppedImg(imageSrc, croppedAreaPixels, file.name)
      onCropped(cropped)
    } catch {
      alert('Erreur lors du recadrage.')
      setProcessing(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div style={{ padding: '16px 20px', background: 'var(--bg-card)', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 10 }}>Déplace et zoome pour cadrer la photo</p>
        <input type="range" min={1} max={3} step={0.01} value={zoom}
          onChange={e => setZoom(parseFloat(e.target.value))}
          style={{ width: '100%', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} disabled={processing} style={{
            flex: 1, padding: 13, borderRadius: 12, border: '0.5px solid var(--border)',
            background: 'transparent', fontSize: 14, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer'
          }}>
            Annuler
          </button>
          <button onClick={handleValidate} disabled={processing} style={{
            flex: 1, padding: 13, borderRadius: 12, border: 'none',
            background: 'var(--gradient)', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: processing ? 'not-allowed' : 'pointer'
          }}>
            {processing ? 'Traitement...' : '✅ Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}
