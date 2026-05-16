import React, { useEffect, useRef, useState } from 'react'
import { RadioTower, Siren } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import SectionHeader from '../components/SectionHeader.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import Badge from '../components/Badge.jsx'
import { axisStyle, gridStyle, tooltipStyle, COLORS } from '../charts/theme.js'
import { getRealtimeSimulation } from '../api/endpoints.js'
import { mockRealtime } from '../utils/mock.js'

export default function RealtimePage() {
  const [feed, setFeed] = useState([])
  const [summary, setSummary] = useState(null)
  const cursorRef = useRef(0)
  const datasetId = localStorage.getItem('currentDatasetId')

  useEffect(() => {
    let cancelled = false
    const seed = datasetId ? null : mockRealtime

    if (seed) {
      setFeed(seed.events)
      setSummary(seed.summary)
      return undefined
    }

    const tick = () => {
      getRealtimeSimulation(datasetId, {
        cursor: cursorRef.current,
        batchSize: 12,
      }).then((response) => {
        if (cancelled) return
        const payload = response.data
        cursorRef.current = payload.next_cursor || 0
        setSummary(payload.summary || {})
        setFeed((current) => [...current, ...(payload.events || [])].slice(-40))
      }).catch(() => {
        if (cancelled) return
        setFeed(mockRealtime.events)
        setSummary(mockRealtime.summary)
      })
    }

    tick()
    const timer = setInterval(tick, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [datasetId])

  if (!summary) return <LoadingSpinner message="Starting realtime simulation..." />

  const trendData = feed.map((item) => ({
    idx: item.index,
    confidence: Number(((item.confidence || 0) * 100).toFixed(1)),
    drift: Number(((item.drift_score || 0) * 100).toFixed(1)),
  }))

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="Realtime"
        title="Real-Time Monitoring Dashboard"
        subtitle="Polling-based production simulation with streaming predictions, drift movement, and anomaly alerts"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-accent"><RadioTower size={16} /><span className="font-display">Live Feed</span></div>
          <div className="mt-3 text-2xl font-display text-text">{feed.length}</div>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Drift</div>
          <div className="mt-3 text-2xl font-display text-warning">{((summary.drift_score || 0) * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Anomaly Rate</div>
          <div className="mt-3 text-2xl font-display text-danger">{((summary.anomaly_rate || 0) * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Fairness Alert</div>
          <div className="mt-3 text-lg font-display text-text">{summary.fairness_flag ? 'Triggered' : 'Stable'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Streaming Confidence and Drift">
          <LineChart data={trendData}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="idx" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="confidence" stroke={COLORS.accent} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="drift" stroke={COLORS.warning} strokeWidth={2} dot={false} />
          </LineChart>
        </ChartPanel>

        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Siren size={16} className="text-danger" />
            <span className="font-display text-text">Live Prediction Feed</span>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-auto pr-1">
            {feed.slice().reverse().map((item) => (
              <div key={`${item.index}-${item.prediction}`} className="rounded-md border border-border bg-surface px-3 py-3 flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm text-text font-display">{`Row #${item.index} to ${String(item.prediction)}`}</div>
                  <div className="text-xs text-textDim font-mono">confidence {(item.confidence || 0).toFixed(3)} | drift {(item.drift_score || 0).toFixed(3)}</div>
                </div>
                <div className="flex gap-2">
                  {item.anomaly_flag && <Badge variant="danger">Anomaly</Badge>}
                  {item.fairness_flag && <Badge variant="warning">Fairness</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
