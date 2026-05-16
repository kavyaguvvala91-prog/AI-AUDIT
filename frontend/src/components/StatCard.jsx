import React from 'react'

export default function StatCard({ label, value, sub, accent = false, icon: Icon }) {
  return (
    <div className={`bg-panel border rounded-lg p-4 flex flex-col gap-1 transition-all duration-200 hover:border-accent/40 ${accent ? 'border-accent/30 shadow-glow' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <span className="text-textDim text-xs font-mono uppercase tracking-widest">{label}</span>
        {Icon && <Icon size={14} className="text-accentDim" />}
      </div>
      <span className={`text-2xl font-display font-bold ${accent ? 'text-accent glow-text' : 'text-text'}`}>
        {value}
      </span>
      {sub && <span className="text-textDim text-xs">{sub}</span>}
    </div>
  )
}
