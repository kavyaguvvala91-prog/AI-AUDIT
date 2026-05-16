import React from 'react'

export default function SectionHeader({ title, subtitle, tag }) {
  return (
    <div className="mb-6">
      {tag && (
        <span className="text-accent text-xs font-mono uppercase tracking-widest border border-accent/30 px-2 py-0.5 rounded mb-2 inline-block">
          {tag}
        </span>
      )}
      <h2 className="text-xl font-display font-bold text-text">{title}</h2>
      {subtitle && <p className="text-textDim text-sm mt-1 font-mono">{subtitle}</p>}
    </div>
  )
}
