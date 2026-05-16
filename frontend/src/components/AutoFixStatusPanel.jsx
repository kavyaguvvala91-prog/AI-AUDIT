import React from 'react'
import { Zap, CheckCircle, AlertCircle, Clock, Undo2 } from 'lucide-react'
import Badge from './Badge.jsx'

/**
 * AutoFixStatusPanel.jsx
 * ──────────────────────
 * Shows the status of auto-fix operations, executed actions, and rollback options.
 * Displays execution logs and retraining history.
 */
export default function AutoFixStatusPanel({ autoFixResult = null, onRollback = null }) {
  if (!autoFixResult) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <p className="text-center text-gray-500 py-8">No auto-fix operations to display.</p>
      </div>
    )
  }

  const {
    executed,
    approval_required,
    actions = [],
    execution_logs = [],
    retraining = null,
    rollback_target_model_id,
  } = autoFixResult

  const appliedActions = actions.filter((a) => a.applied)
  const deferredActions = actions.filter((a) => !a.applied)

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Auto-Fix Status</h3>
        </div>
        <Badge
          text={executed ? 'EXECUTED' : 'PENDING'}
          tone={executed ? 'success' : 'warning'}
        />
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-xs font-semibold text-green-900">Applied Actions</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{appliedActions.length}</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-xs font-semibold text-yellow-900">Deferred Actions</p>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{deferredActions.length}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <p className="text-xs font-semibold text-blue-900">Total Actions</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{actions.length}</p>
        </div>
      </div>

      {/* Applied Actions List */}
      {appliedActions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Applied Actions:</h4>
          <div className="space-y-2">
            {appliedActions.map((action, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-green-50 p-2 rounded">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="font-medium">{action.action.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deferred Actions List */}
      {deferredActions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Deferred Actions (Require Manual Review):</h4>
          <div className="space-y-2">
            {deferredActions.map((action, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-yellow-50 p-2 rounded">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                <span className="font-medium">{action.action.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Status */}
      {approval_required && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Approval Required:</span> Enable auto-execution by granting approval in system settings.
          </p>
        </div>
      )}

      {/* Retraining Result */}
      {retraining && retraining.triggered && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-sm font-semibold text-green-900 mb-2">Retraining Triggered</h4>
          <div className="text-xs text-green-800 space-y-1">
            <p>
              <span className="font-medium">New Model ID:</span> {retraining.new_model_id}
            </p>
            <p>
              <span className="font-medium">Version:</span> {retraining.new_version}
            </p>
            {retraining.comparison && retraining.comparison.length > 0 && (
              <div className="mt-2">
                <p className="font-medium mb-1">Metric Changes:</p>
                <ul className="space-y-1">
                  {retraining.comparison.slice(0, 3).map((delta, idx) => (
                    <li key={idx} className="text-green-700">
                      {delta.metric}: {delta.old_value} → {delta.new_value} ({delta.delta > 0 ? '+' : ''}{delta.delta})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Execution Logs */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Execution Logs:</h4>
        <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
          {execution_logs.length > 0 ? (
            execution_logs.map((log, idx) => (
              <p key={idx} className="text-gray-400">
                <span className="text-gray-600">&gt;</span> {log}
              </p>
            ))
          ) : (
            <p className="text-gray-600">No logs available</p>
          )}
        </div>
      </div>

      {/* Rollback Option */}
      {rollback_target_model_id && onRollback && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => onRollback(rollback_target_model_id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
          >
            <Undo2 className="w-5 h-5" />
            Rollback to Previous Model
          </button>
        </div>
      )}
    </div>
  )
}
