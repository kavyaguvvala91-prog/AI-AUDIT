import React from 'react'

export default function LoadingSpinner({ message = 'Processing...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-2 border-accent/20 rounded-full" />
        <div className="absolute inset-0 border-2 border-transparent border-t-accent rounded-full animate-spin" />
        <div className="absolute inset-2 border border-transparent border-t-accentDim rounded-full animate-spin" style={{ animationDuration: '0.6s' }} />
      </div>
      <span className="text-textDim text-sm font-mono">{message}</span>
    </div>
  )
}
