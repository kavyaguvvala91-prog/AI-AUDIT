import React from 'react'

const variants = {
  default: 'bg-border text-textDim',
  accent: 'bg-accent/10 text-accent border border-accent/30',
  success: 'bg-success/10 text-success border border-success/30',
  warning: 'bg-warning/10 text-warning border border-warning/30',
  danger: 'bg-danger/10 text-danger border border-danger/30',
}

export default function Badge({ children, variant = 'default' }) {
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${variants[variant]}`}>
      {children}
    </span>
  )
}
