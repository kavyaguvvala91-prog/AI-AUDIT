import React from 'react'

/**
 * RiskGauge.jsx
 * ─────────────
 * Displays a circular gauge for overall risk score (0-100).
 * Color-coded based on risk level: Green (low), Yellow (medium), Red (high).
 */
export default function RiskGauge({ score = 50, label = 'Overall Risk Score' }) {
  const validScore = Math.min(Math.max(score, 0), 100)
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (validScore / 100) * circumference
  
  const getRiskColor = (value) => {
    if (value >= 75) return { stroke: '#ef4444', bg: '#fee2e2', label: 'High' }
    if (value >= 40) return { stroke: '#f59e0b', bg: '#fef3c7', label: 'Medium' }
    return { stroke: '#10b981', bg: '#ecfdf5', label: 'Low' }
  }

  const riskColor = getRiskColor(validScore)

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200 flex flex-col items-center">
      {/* Label */}
      <h3 className="text-sm font-semibold text-gray-600 mb-6 text-center">{label}</h3>

      {/* Gauge SVG */}
      <div className="relative w-40 h-40 mb-4">
        <svg width="160" height="160" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="80"
            cy="80"
            r="45"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="80"
            cy="80"
            r="45"
            fill="none"
            stroke={riskColor.stroke}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
          {/* Center text */}
          <text
            x="80"
            y="85"
            textAnchor="middle"
            fontSize="32"
            fontWeight="bold"
            fill={riskColor.stroke}
          >
            {validScore}
          </text>
          <text
            x="80"
            y="105"
            textAnchor="middle"
            fontSize="12"
            fill="#6b7280"
          >
            out of 100
          </text>
        </svg>
      </div>

      {/* Risk Level Badge */}
      <div
        className={`px-4 py-2 rounded-full font-semibold text-sm ${
          validScore >= 75
            ? 'bg-red-100 text-red-800'
            : validScore >= 40
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
        }`}
      >
        {riskColor.label} Risk
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mt-4 text-center max-w-xs">
        {validScore >= 75
          ? 'Immediate action required to mitigate risks'
          : validScore >= 40
            ? 'Monitor closely and plan remediation'
            : 'Model is performing within acceptable parameters'}
      </p>

      {/* Risk Threshold Indicators */}
      <div className="mt-6 w-full pt-6 border-t border-gray-200">
        <div className="text-xs font-semibold text-gray-700 mb-3">Risk Levels</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-700">Low</span>
            </div>
            <span className="text-gray-600 text-xs font-mono">0–39</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-gray-700">Medium</span>
            </div>
            <span className="text-gray-600 text-xs font-mono">40–74</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-700">High</span>
            </div>
            <span className="text-gray-600 text-xs font-mono">75–100</span>
          </div>
        </div>
      </div>
    </div>
  )
}
