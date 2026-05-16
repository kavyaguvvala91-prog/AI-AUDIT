import React from 'react'

export default function ProgressBar({ value, max = 1, color = 'accent', label, showPct = true }) {
  const pct = Math.min((value / max) * 100, 100)
  const colorMap = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs font-mono text-textDim">
          <span>{label}</span>
          {showPct && <span className="text-text">{pct.toFixed(1)}%</span>}
        </div>
      )}
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color]} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
