import React from 'react'
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'
import Badge from './Badge.jsx'

/**
 * RiskAlertCard.jsx
 * ──────────────────
 * Displays a single AI risk/finding with severity badge, action, and risk score.
 * Used in governance insights to highlight issues requiring attention.
 */
const severityIcons = {
  high: <AlertTriangle className="w-5 h-5 text-red-500" />,
  medium: <AlertCircle className="w-5 h-5 text-yellow-500" />,
  low: <CheckCircle className="w-5 h-5 text-green-500" />,
}

const severityBgClass = {
  high: 'bg-red-50 border-l-4 border-red-500',
  medium: 'bg-yellow-50 border-l-4 border-yellow-500',
  low: 'bg-green-50 border-l-4 border-green-500',
}

const severityTone = {
  high: 'danger',
  medium: 'warning',
  low: 'success',
}

export default function RiskAlertCard({ finding, onAutoFixClick = null }) {
  const { code, title, severity, risk_score, rationale, recommended_action, auto_fix_available } = finding || {}

  if (!finding) return null

  return (
    <div className={`rounded-lg p-4 ${severityBgClass[severity] || 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3 flex-1">
          {severityIcons[severity]}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-600 mt-1">{code?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge text={severity.toUpperCase()} tone={severityTone[severity]} />
          <span className="text-lg font-bold text-gray-900 ml-2">{risk_score}</span>
        </div>
      </div>

      {/* Rationale */}
      <p className="text-sm text-gray-700 mb-3 pl-8">{rationale}</p>

      {/* Recommended Action */}
      <div className="bg-white bg-opacity-60 rounded p-2 mb-3 pl-8">
        <p className="text-sm font-medium text-gray-800">Recommended Action:</p>
        <p className="text-sm text-gray-700 mt-1">{recommended_action}</p>
      </div>

      {/* Auto-Fix Button (if available) */}
      {auto_fix_available && onAutoFixClick && (
        <div className="flex justify-end pl-8">
          <button
            onClick={() => onAutoFixClick(finding)}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Enable Auto-Fix
          </button>
        </div>
      )}
    </div>
  )
}
