import React from 'react'
import { Zap, CheckCircle, Clock, AlertCircle } from 'lucide-react'

/**
 * ModelHealthTimeline.jsx
 * ───────────────────────
 * Displays the progression of AI governance steps: Detection → Explanation → Recommendation → Auto-Fix.
 * Shows status (completed, pending, standby) and timing information for each step.
 */
const statusIcons = {
  completed: <CheckCircle className="w-6 h-6 text-green-500" />,
  pending: <Clock className="w-6 h-6 text-blue-500" />,
  standby: <AlertCircle className="w-6 h-6 text-gray-400" />,
}

const statusColors = {
  completed: 'bg-green-100 border-green-500',
  pending: 'bg-blue-100 border-blue-500',
  standby: 'bg-gray-100 border-gray-400',
}

const lineColors = {
  completed: 'bg-green-500',
  pending: 'bg-blue-400',
  standby: 'bg-gray-300',
}

export default function ModelHealthTimeline({ timeline = [] }) {
  const steps = timeline || [
    { step: 'Detection', status: 'completed', time: 'Live' },
    { step: 'Explanation', status: 'completed', time: 'Live' },
    { step: 'Recommendation', status: 'completed', time: 'Live' },
    { step: 'Auto-Fix', status: 'standby', time: 'Manual trigger' },
  ]

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold text-gray-900">Governance Pipeline</h3>
      </div>

      {/* Timeline */}
      <div className="relative">
        {steps.map((item, idx) => (
          <div key={idx} className="flex items-start mb-6 last:mb-0">
            {/* Vertical line connector */}
            {idx < steps.length - 1 && (
              <div className={`absolute left-3 top-12 w-1 h-8 ${lineColors[item.status]}`}></div>
            )}

            {/* Status circle */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 ${statusColors[item.status]} flex items-center justify-center relative z-10 bg-white`}>
              {statusIcons[item.status]}
            </div>

            {/* Content */}
            <div className="ml-6 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">{item.step}</h4>
                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {item.time}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1 capitalize">{item.status.replace('_', ' ')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-700">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-gray-700">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-gray-700">Standby</span>
        </div>
      </div>
    </div>
  )
}
