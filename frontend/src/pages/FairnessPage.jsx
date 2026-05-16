import React, { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import SectionHeader from '../components/SectionHeader.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ScoreGauge from '../components/ScoreGauge.jsx'
import { getFairness } from '../api/endpoints.js'
import { mockFairness } from '../utils/mock.js'

const toneClass = {
  low: 'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-danger/10 text-danger border-danger/20',
}

export default function FairnessPage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const datasetId = localStorage.getItem('currentDatasetId')
    if (!datasetId) {
      setData(mockFairness)
      return
    }
    getFairness(datasetId)
      .then((response) => setData(response.data))
      .catch(() => setData(mockFairness))
  }, [])

  if (!data) return <LoadingSpinner message="Loading fairness audit..." />

  const sections = Object.entries(data.group_summary || {})

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="Fairness"
        title="Bias and Fairness Dashboard"
        subtitle="Group-wise parity review across sensitive attributes such as gender, income band, or region"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="bg-panel border border-border rounded-lg p-6 flex items-center justify-center">
          <ScoreGauge value={Math.round((data.fairness_score || 0) * 100)} label="Fairness Score" />
        </div>

        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={16} className="text-warning" />
            <span className="font-display text-text">Bias Severity: {data.bias_severity}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {sections.map(([attribute, groups]) => (
              <div key={attribute} className="rounded-lg border border-border bg-surface p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono mb-3">{attribute}</div>
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div key={group.group} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-text">{group.group}</span>
                        <span className={`px-2 py-1 text-[10px] uppercase tracking-[0.2em] border rounded ${toneClass[group.severity]}`}>{group.severity}</span>
                      </div>
                      <div className="mt-2 text-xs text-textDim font-mono">
                        count {group.count} | positive rate {(group.positive_rate * 100).toFixed(1)}% | parity gap {(group.parity_gap * 100).toFixed(1)}%
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-border overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${group.positive_rate * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
