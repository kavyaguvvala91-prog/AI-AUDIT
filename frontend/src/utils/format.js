export const pct = (v) => `${(v * 100).toFixed(1)}%`
export const round2 = (v) => (v ?? 0).toFixed(2)
export const formatNum = (n) => n?.toLocaleString() ?? '—'

export const statusColor = (score) => {
  if (score < 0.1) return 'text-success'
  if (score < 0.2) return 'text-warning'
  return 'text-danger'
}

export const statusLabel = (score) => {
  if (score < 0.1) return 'Healthy'
  if (score < 0.2) return 'Warning'
  return 'Critical'
}
