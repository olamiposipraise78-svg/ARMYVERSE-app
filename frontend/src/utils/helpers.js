export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function cn(...args) {
  return args.filter(Boolean).join(' ')
}

export function truncate(str, len = 120) {
  if (!str) return ''
  if (str.length <= len) return str
  return str.slice(0, len).trimEnd() + '…'
}

export function isImageUrl(url) {
  return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url || '')
}
