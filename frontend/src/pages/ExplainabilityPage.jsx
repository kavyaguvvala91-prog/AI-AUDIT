import React, { useEffect, useState } from 'react'
import { Brain, Sparkles } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import SectionHeader from '../components/SectionHeader.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import Alert from '../components/Alert.jsx'
import { axisStyle, gridStyle, tooltipStyle, PALETTE } from '../charts/theme.js'
import { getExplainability, getInsights } from '../api/endpoints.js'
import { mockExplainability, mockInsights } from '../utils/mock.js'

export default function ExplainabilityPage() {
  const [data, setData] = useState(null)
  const [insights, setInsights] = useState(mockInsights)
  const [error, setError] = useState('')

  useEffect(() => {
    const datasetId = localStorage.getItem('currentDatasetId')
    if (!datasetId) {
      setData(mockExplainability)
      return
    }

    Promise.allSettled([
      getExplainability(datasetId, 0, 6),
      getInsights(datasetId),
    ]).then(([explainResult, insightResult]) => {
      if (explainResult.status === 'fulfilled') {
        setData(explainResult.value.data)
      } else {
        setError('Explainability report unavailable, showing demo explanation.')
        setData(mockExplainability)
      }

      if (insightResult.status === 'fulfilled') {
        setInsights(insightResult.value.data)
      }
    })
  }, [])

  if (!data) return <LoadingSpinner message="Building SHAP and LIME explanations..." />

  const localChart = (data.local_explanation || []).map((item) => ({
    feature: item.feature,
    contribution: Number((item.contribution || 0).toFixed(3)),
  }))
  const globalChart = (data.global_explanation || []).map((item) => ({
    feature: item.feature,
    contribution: Math.abs(Number((item.contribution || 0).toFixed(3))),
  }))

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="XAI"
        title="Explainable AI Dashboard"
        subtitle="Local and global reasoning for model behavior, feature importance, and confidence analysis"
      />

      {error && <Alert type="warning" message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Prediction</div>
          <div className="mt-3 text-2xl font-display text-text">{String(data.prediction || 'N/A')}</div>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Confidence</div>
          <div className="mt-3 text-2xl font-display text-accent">{((data.confidence_score || 0) * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Model</div>
          <div className="mt-3 text-lg font-display text-text">{data.model_type}</div>
        </div>
        <div className="bg-panel border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Methods</div>
          <div className="mt-3 text-lg font-display text-text">{(data.explanation_methods || []).join(' + ')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Local Explanation">
          <BarChart data={localChart}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="feature" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="contribution" radius={[4, 4, 0, 0]}>
              {localChart.map((_, index) => (
                <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartPanel>

        <ChartPanel title="Global Feature Importance">
          <BarChart data={globalChart}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="feature" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="contribution" fill={PALETTE[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-accent" />
            <span className="font-display text-text">Prediction Reasoning</span>
          </div>
          <div className="space-y-3">
            {(data.reasoning || []).map((item) => (
              <div key={item} className="rounded-md border border-border bg-surface px-3 py-3 text-sm text-textDim">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-success" />
            <span className="font-display text-text">AI Insight Generator</span>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-textDim font-mono mb-3">
            {insights.provider} / {insights.model}
          </p>
          <p className="text-sm leading-7 text-textDim">{insights.text}</p>
        </div>
      </div>
    </div>
  )
}
