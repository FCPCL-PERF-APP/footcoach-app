// Dessine la zone recadrée (coordonnées fournies par react-easy-crop) sur un canvas et
// retourne un File JPEG — évite d'uploader la photo brute telle que prise/choisie.
export default function getCroppedImg(imageSrc, cropPixels, fileName) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = imageSrc
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = cropPixels.width
      canvas.height = cropPixels.height
      const ctx = canvas.getContext('2d')
      // Le JPEG ne supporte pas la transparence : sans ce fond blanc, toute zone
      // transparente de la source (PNG) ou hors des bords de l'image lors du zoom/
      // déplacement serait aplatie en noir par canvas.toBlob().
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(
        image,
        cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
        0, 0, cropPixels.width, cropPixels.height
      )
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Le recadrage a échoué.')); return }
        resolve(new File([blob], fileName, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.92)
    }
    image.onerror = () => reject(new Error("Impossible de charger l'image."))
  })
}
