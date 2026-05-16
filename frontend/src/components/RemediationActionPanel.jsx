import React, { useState } from 'react'
import { Wrench, CheckCircle, AlertCircle, Play, Clock } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner.jsx'

/**
 * RemediationActionPanel.jsx
 * ──────────────────────────
 * Displays recommended remediation actions and allows triggering auto-fix.
 * Shows action status (not applied, applied, in-progress) with details.
 */
const actionIcons = {
  retrain_model: <Play className="w-5 h-5" />,
  clean_missing_values: <Wrench className="w-5 h-5" />,
  rebalance_training_data: <Wrench className="w-5 h-5" />,
  quarantine_anomalies: <AlertCircle className="w-5 h-5" />,
  route_to_human_review: <Clock className="w-5 h-5" />,
  tune_regularization: <Wrench className="w-5 h-5" />,
}

const actionLabels = {
  retrain_model: 'Retrain Model',
  clean_missing_values: 'Fix Missing Values',
  rebalance_training_data: 'Rebalance Data',
  quarantine_anomalies: 'Quarantine Anomalies',
  route_to_human_review: 'Human Review',
  tune_regularization: 'Adjust Regularization',
}

export default function RemediationActionPanel({ actions = [], onExecuteAutoFix = null, isLoading = false }) {
  const [expandedIndex, setExpandedIndex] = useState(null)

  if (!actions || actions.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <p className="text-center text-gray-500 py-8">No remediation actions required at this time.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-bold text-gray-900">Remediation Actions</h3>
        <span className="ml-auto text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
          {actions.length} action{actions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Executing remediation..." />
      ) : (
        <div className="space-y-3">
          {actions.map((action, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Action Header */}
              <button
                onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`flex-shrink-0 ${
                      action.applied
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {action.applied ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      actionIcons[action.action] || <Wrench className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">
                      {actionLabels[action.action] || action.action.replace(/_/g, ' ')}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Status: <span className={action.applied ? 'text-green-600 font-medium' : 'text-gray-600'}>
                        {action.applied ? 'Applied' : 'Not Applied'}
                      </span>
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedIndex === idx ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>

              {/* Expanded Details */}
              {expandedIndex === idx && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <p className="text-sm text-gray-700 mb-3">{action.details}</p>
                  {onExecuteAutoFix && !action.applied && (
                    <button
                      onClick={() => onExecuteAutoFix(action)}
                      className="text-xs px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                    >
                      Execute Action
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Button */}
      {onExecuteAutoFix && actions.some((a) => !a.applied) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => onExecuteAutoFix({ bulk: true })}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            Execute All Recommended Actions
          </button>
        </div>
      )}
    </div>
  )
}
