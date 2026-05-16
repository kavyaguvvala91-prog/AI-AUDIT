import React, { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import SectionHeader from '../components/SectionHeader.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { axisStyle, gridStyle, tooltipStyle, COLORS } from '../charts/theme.js'
import { getComparison } from '../api/endpoints.js'
import { mockMetrics } from '../utils/mock.js'

export default function ComparisonPage() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const datasetId = localStorage.getItem('currentDatasetId')
    if (!datasetId) {
      setData({
        currentModel: { modelType: mockMetrics.model_type },
        leaderboard: mockMetrics.leaderboard,
        bestModel: mockMetrics.model_type,
        versions: [],
      })
      return
    }

    getComparison(datasetId)
      .then((response) => setData(response.data))
      .catch(() => setData({
        currentModel: { modelType: mockMetrics.model_type },
        leaderboard: mockMetrics.leaderboard,
        bestModel: mockMetrics.model_type,
        versions: [],
      }))
  }, [])

  if (!data) return <LoadingSpinner message="Comparing model candidates..." />

  const chartRows = (data.leaderboard || []).map((item) => ({
    model: item.model_type.replace('Classifier', '').replace('Regressor', ''),
    score: Number((((item.metrics?.f1_score ?? item.metrics?.accuracy ?? (1 - (item.metrics?.rmse ?? 0))) || 0) * 100).toFixed(1)),
    precision: Number((((item.metrics?.precision ?? item.metrics?.r2 ?? 0) || 0) * 100).toFixed(1)),
    recall: Number((((item.metrics?.recall ?? item.metrics?.r2 ?? 0) || 0) * 100).toFixed(1)),
    f1: Number((((item.metrics?.f1_score ?? item.metrics?.r2 ?? 0) || 0) * 100).toFixed(1)),
  }))

  const best = chartRows[0]

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="AutoML"
        title="Model Comparison Dashboard"
        subtitle="Leaderboard-driven training with automatic best-model selection"
      />

      <div className="bg-panel border border-border rounded-lg p-5 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Best Model</div>
          <div className="mt-2 text-2xl font-display text-text">{data.bestModel || best?.model || 'N/A'}</div>
        </div>
        <div className="flex items-center gap-2 text-success">
          <Trophy size={18} />
          <span className="font-mono text-sm">Leaderboard winner</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Candidate Leaderboard">
          <BarChart data={chartRows}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="model" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="score" fill={COLORS.accent} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>

        <ChartPanel title="Metric Radar">
          <RadarChart data={[
            { subject: 'Score', value: best?.score || 0 },
            { subject: 'Precision', value: best?.precision || 0 },
            { subject: 'Recall', value: best?.recall || 0 },
            { subject: 'F1', value: best?.f1 || 0 },
          ]}>
            <PolarGrid stroke={COLORS.border} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: COLORS.textDim, fontSize: 10, fontFamily: 'JetBrains Mono' }} />
            <Legend />
            <Radar name="Best Model" dataKey="value" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.2} />
          </RadarChart>
        </ChartPanel>
      </div>

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border text-sm font-display text-text">Leaderboard Table</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-textDim font-mono">
              <tr>
                <th className="text-left px-5 py-3">Model</th>
                <th className="text-left px-5 py-3">Selection Metric</th>
                <th className="text-left px-5 py-3">Ranking Score</th>
                <th className="text-left px-5 py-3">Train Time</th>
              </tr>
            </thead>
            <tbody>
              {(data.leaderboard || []).map((item, index) => (
                <tr key={item.model_type} className="border-t border-border">
                  <td className="px-5 py-3 text-text">{index === 0 ? `${item.model_type} (Best)` : item.model_type}</td>
                  <td className="px-5 py-3 text-textDim">{item.selection_metric}</td>
                  <td className="px-5 py-3 text-text">{item.ranking_score}</td>
                  <td className="px-5 py-3 text-textDim">{item.training_time_s ?? 0}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
