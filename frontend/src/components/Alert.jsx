import React from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

const config = {
  success: { icon: CheckCircle, cls: 'border-success/30 bg-success/5 text-success' },
  warning: { icon: AlertTriangle, cls: 'border-warning/30 bg-warning/5 text-warning' },
  error: { icon: XCircle, cls: 'border-danger/30 bg-danger/5 text-danger' },
  info: { icon: Info, cls: 'border-accent/30 bg-accent/5 text-accent' },
}

export default function Alert({ type = 'info', message, onClose }) {
  const { icon: Icon, cls } = config[type]
  return (
    <div className={`flex items-start gap-3 border rounded-lg p-4 text-sm font-mono animate-slide-up ${cls}`}>
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <span className="flex-1 text-text">{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-textDim hover:text-text">✕</button>
      )}
    </div>
  )
}
