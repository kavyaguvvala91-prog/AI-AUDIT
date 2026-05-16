import React, { useEffect, useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import SectionHeader from '../components/SectionHeader.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import Alert from '../components/Alert.jsx'
import ScoreGauge from '../components/ScoreGauge.jsx'
import { axisStyle, gridStyle, tooltipStyle, PALETTE } from '../charts/theme.js'
import { getQuality } from '../api/endpoints.js'
import { mockQuality } from '../utils/mock.js'

export default function QualityPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const datasetId = localStorage.getItem('currentDatasetId')
    if (!datasetId) {
      setData(mockQuality)
      return
    }
    getQuality(datasetId)
      .then((response) => setData(response.data))
      .catch((err) => {
        setError(err?.response?.data?.message || 'Quality report unavailable, showing demo state.')
        setData(mockQuality)
      })
  }, [])

  if (!data) return <LoadingSpinner message="Generating quality report..." />

  const summaryData = Object.entries(data.summary || {}).map(([name, value]) => ({
    name: name.replace('_pct', '').replace('_', ' '),
    value: Number((value * 100).toFixed(1)),
  }))

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="MLOps"
        title="Data Quality Dashboard"
        subtitle="Pre-training quality checks for missing data, outliers, imbalance, duplicates, and invalid values"
      />

      {error && <Alert type="warning" message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="bg-panel border border-border rounded-lg p-6 flex items-center justify-center">
          <ScoreGauge value={data.quality_score} label="Dataset Quality" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data.issues || []).map((issue) => (
            <div key={issue.issue} className="bg-panel border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-warning" />
                  <span className="font-display text-text">{issue.issue}</span>
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-textDim font-mono">{issue.severity}</span>
              </div>
              <p className="text-sm text-text mb-1">{(issue.value * 100).toFixed(1)}%</p>
              <p className="text-xs text-textDim font-mono">{issue.recommendation}</p>
            </div>
          ))}

          <div className="bg-panel border border-border rounded-lg p-4 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={16} className="text-success" />
              <span className="font-display text-text">Improvement Recommendations</span>
            </div>
            <div className="grid gap-3">
              {(data.recommendations || []).map((item) => (
                <div key={item} className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-textDim">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ChartPanel title="Issue Distribution">
        <BarChart data={summaryData}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="name" {...axisStyle} />
          <YAxis {...axisStyle} tickFormatter={(value) => `${value}%`} />
          <Tooltip {...tooltipStyle} formatter={(value) => [`${value}%`]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {summaryData.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ChartPanel>
    </div>
  )
}
