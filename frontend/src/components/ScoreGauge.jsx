import React from 'react'

export default function ScoreGauge({ value = 0, label = 'Score', suffix = '/100' }) {
  const clamped = Math.max(0, Math.min(100, value))
  const tone =
    clamped >= 85 ? 'var(--gauge-good, #6ef7a8)' :
    clamped >= 70 ? 'var(--gauge-mid, #f7c96e)' :
    'var(--gauge-bad, #f76e6e)'

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="w-36 h-36 rounded-full grid place-items-center border border-border shadow-panel"
        style={{
          background: `conic-gradient(${tone} ${clamped * 3.6}deg, rgba(30,30,48,0.9) 0deg)`,
        }}
      >
        <div className="w-24 h-24 rounded-full bg-surface border border-border flex flex-col items-center justify-center">
          <div className="text-2xl font-display text-text">{clamped}</div>
          <div className="text-[10px] font-mono text-textDim">{suffix}</div>
        </div>
      </div>
      <div className="text-xs uppercase tracking-[0.25em] text-textDim font-mono">{label}</div>
    </div>
  )
}
