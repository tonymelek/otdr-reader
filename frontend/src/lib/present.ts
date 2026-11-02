export type Fact = { label: string; value: string }

export function blockOf(
  params: Record<string, unknown> | undefined,
  name: string,
): Record<string, unknown> {
  const value = params?.[name]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export function textOf(value: unknown): string {
  if (value == null) return ''
  const text = String(value).replaceAll('\u0000', '').trim()
  if (!text || text === 'undefined') return ''
  return text.replace(/(\d+)\.0(?=\s|$)/g, '$1')
}

export function formatWhen(value: unknown): string {
  const text = textOf(value)
  if (!/^\d{10,}$/.test(text)) return text
  const n = Number(text)
  if (!Number.isFinite(n)) return text
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(n * 1000))
}

export function withUnit(value: unknown, unit: string): string {
  const text = textOf(value)
  if (!text) return ''
  return text.includes(unit) ? text : `${text} ${unit}`
}

export function eventKind(value: unknown): string {
  const text = textOf(value)
  const words = text.replace(/^[\w\u0000]{0,12}9999LS\s*/i, '').trim()
  if (/reflection/i.test(words)) return 'Reflection'
  if (/loss|drop|gain/i.test(words)) return 'Loss'
  if (/end/i.test(words)) return 'End'
  return words || text
}

export function wavelengthOf(fileName: string, fixed?: Record<string, unknown>): string {
  const fromFile = fixed ? textOf(fixed.wavelength) : ''
  if (fromFile) return fromFile.includes('nm') ? fromFile : `${fromFile} nm`
  const match = fileName.match(/(\d{3,4})/)
  return match ? `${match[1]} nm` : fileName
}

export function facts(pairs: Array<[string, unknown]>): Fact[] {
  return pairs.flatMap(([label, value]) => {
    const text = textOf(value)
    return text ? [{ label, value: text }] : []
  })
}

export function sampleTrace(points: number[][], kmValue: number): number | null {
  if (points.length === 0 || !Number.isFinite(kmValue)) return null
  if (kmValue <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (kmValue >= last[0]) return last[1]
  let lo = 0
  let hi = points.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid][0] <= kmValue) lo = mid
    else hi = mid
  }
  const left = points[lo]
  const right = points[hi]
  const span = right[0] - left[0]
  if (span === 0) return left[1]
  const t = (kmValue - left[0]) / span
  return left[1] + t * (right[1] - left[1])
}

export function sectionBetween(
  points: number[][],
  a: number | null,
  b: number | null,
): { distanceKm: number; lossDb: number; slopeDbPerKm: number } | null {
  if (a == null || b == null) return null
  const left = Math.min(a, b)
  const right = Math.max(a, b)
  const near = sampleTrace(points, left)
  const far = sampleTrace(points, right)
  if (near == null || far == null) return null
  const distanceKm = right - left
  const lossDb = near - far
  return {
    distanceKm,
    lossDb,
    slopeDbPerKm: distanceKm >= 0.0005 ? lossDb / distanceKm : Number.NaN,
  }
}

export function km(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return `${value.toFixed(3)} km`
}

export function rangeOf(value: unknown): string {
  const text = textOf(value)
  const match = text.match(/^(-?\d+(?:\.\d+)?)(?:\s*km)?$/)
  if (!match) return text
  const n = Number(match[1])
  if (!Number.isFinite(n)) return text
  return `${n.toFixed(3)} km`
}

export const EVENT_COLUMNS: Array<[string, string, (value: unknown) => string]> = [
  ['number', '#', (value) => textOf(value)],
  ['distance', 'Distance', (value) => textOf(value)],
  ['splice', 'Loss', (value) => textOf(value)],
  ['slope', 'Slope', (value) => textOf(value)],
  ['refl loss', 'Reflectance', (value) => textOf(value)],
  ['event type', 'Type', eventKind],
]
