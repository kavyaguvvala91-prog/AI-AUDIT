import React from 'react'
import { ResponsiveContainer } from 'recharts'

export default function ChartPanel({ title, children, height = 240 }) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 hover:border-accent/20 transition-colors">
      {title && (
        <div className="text-xs font-mono text-textDim uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-1 h-3 bg-accent rounded-full inline-block" />
          {title}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}
