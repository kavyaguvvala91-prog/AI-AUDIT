import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCcw, GitBranch } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import SectionHeader from '../components/SectionHeader.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import Alert from '../components/Alert.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { axisStyle, gridStyle, tooltipStyle, COLORS } from '../charts/theme.js'
import { getRetraining, triggerRetraining } from '../api/endpoints.js'
import { mockRetraining } from '../utils/mock.js'

export default function RetrainingPage() {
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const datasetId = localStorage.getItem('currentDatasetId')

  const load = () => {
    if (!datasetId) {
      setData(mockRetraining)
      return Promise.resolve()
    }
    return getRetraining(datasetId)
      .then((response) => setData(response.data))
      .catch(() => setData(mockRetraining))
  }

  useEffect(() => {
    load()
  }, [])

  const latestComparison = useMemo(() => {
    const latest = data?.retrainingHistory?.[data.retrainingHistory.length - 1]
    return latest?.comparison || data?.retraining?.payload?.data?.comparison || []
  }, [data])

  if (!data) return <LoadingSpinner message="Loading retraining telemetry..." />

  const lineData = (data.modelVersions || []).map((item) => ({
    version: item.version,
    score: Number(((item.metrics?.f1_score ?? item.metrics?.accuracy ?? item.metrics?.r2 ?? 0) * 100).toFixed(1)),
  }))

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="Auto Retrain"
        title="Retraining Dashboard"
        subtitle="Model versioning, drift-triggered retraining, and performance improvement tracking"
      />

      {message && <Alert type="success" message={message} onClose={() => setMessage('')} />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Active Version</div>
          <div className="mt-3 text-2xl font-display text-text">{data.currentModel?.version || 'v1'}</div>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Model Type</div>
          <div className="mt-3 text-lg font-display text-text">{data.currentModel?.modelType || 'Unknown'}</div>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Last Retrain</div>
          <div className="mt-3 text-sm font-mono text-text">{data.retrainingHistory?.at(-1)?.createdAt ? new Date(data.retrainingHistory.at(-1).createdAt).toLocaleString() : 'Not yet'}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!datasetId) {
              setMessage('Demo mode: manual retraining trigger simulated.')
              return
            }
            setBusy(true)
            triggerRetraining(datasetId, {})
              .then(() => {
                setMessage('Manual retraining request completed.')
                return load()
              })
              .finally(() => setBusy(false))
          }}
          className="bg-panel border border-border rounded-lg p-4 text-left hover:border-accent/40 transition-colors"
        >
          <div className="flex items-center gap-2 text-accent">
            <RefreshCcw size={16} className={busy ? 'animate-spin' : ''} />
            <span className="font-display">Trigger Retraining</span>
          </div>
          <div className="mt-3 text-xs text-textDim font-mono">Manual fallback when you want to promote a fresh version immediately.</div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Version Performance Trend">
          <LineChart data={lineData}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="version" {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={(value) => `${value}%`} />
            <Tooltip {...tooltipStyle} formatter={(value) => [`${value}%`]} />
            <Line type="monotone" dataKey="score" stroke={COLORS.success} strokeWidth={2} dot />
          </LineChart>
        </ChartPanel>

        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={16} className="text-accent" />
            <span className="font-display text-text">Performance Improvement</span>
          </div>
          <div className="space-y-3">
            {latestComparison.map((item) => {
              const value = typeof item.new_value === 'number' ? Math.max(0, Math.min(1, item.new_value)) : 0
              return (
                <ProgressBar
                  key={item.metric}
                  label={`${item.metric} (${item.delta >= 0 ? '+' : ''}${item.delta ?? 0})`}
                  value={value}
                  max={1}
                  color={item.delta >= 0 ? 'success' : 'warning'}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border text-sm font-display text-text">Retraining History</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-textDim font-mono">
              <tr>
                <th className="text-left px-5 py-3">Reason</th>
                <th className="text-left px-5 py-3">From</th>
                <th className="text-left px-5 py-3">To</th>
                <th className="text-left px-5 py-3">Drift</th>
                <th className="text-left px-5 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {(data.retrainingHistory || []).map((item, index) => (
                <tr key={`${item.createdAt}-${index}`} className="border-t border-border">
                  <td className="px-5 py-3 text-text">{item.reason}</td>
                  <td className="px-5 py-3 text-textDim">{item.previousVersion || '-'}</td>
                  <td className="px-5 py-3 text-text">{item.newVersion || '-'}</td>
                  <td className="px-5 py-3 text-textDim">{item.driftScore ?? '-'}</td>
                  <td className="px-5 py-3 text-textDim">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
