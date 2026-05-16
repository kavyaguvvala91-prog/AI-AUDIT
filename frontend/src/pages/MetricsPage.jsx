import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend
} from 'recharts'
import { Activity, Cpu, Clock, TrendingUp } from 'lucide-react'
import SectionHeader from '../components/SectionHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { axisStyle, gridStyle, tooltipStyle, PALETTE, COLORS } from '../charts/theme.js'
import { mockMetrics } from '../utils/mock.js'
import { getMetrics } from '../api/endpoints.js'
import { pct } from '../utils/format.js'

export default function MetricsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const datasetId = localStorage.getItem('currentDatasetId')
    if (!datasetId) {
      setData(mockMetrics)
      setLoading(false)
      return
    }

    getMetrics(datasetId)
      .then((r) => {
        if (r.data?.model_id) {
          localStorage.setItem('currentModelId', r.data.model_id)
        }
        setData(r.data)
      })
      .catch(() => setData(mockMetrics))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Loading model metrics..." />

  const isClassification = data.problem_type === 'classification'
  const metricsBar = isClassification
    ? [
        { name: 'Accuracy', value: data.accuracy ?? 0 },
        { name: 'Precision', value: data.precision ?? 0 },
        { name: 'Recall', value: data.recall ?? 0 },
        { name: 'F1 Score', value: data.f1_score ?? 0 },
      ]
    : [
        { name: 'RMSE', value: data.rmse ?? 0 },
        { name: 'MAE', value: data.mae ?? 0 },
        { name: 'R2', value: data.r2 ?? 0 },
      ]

  const metricsPie = metricsBar.map((metric) => ({
    name: metric.name,
    value: +(metric.value * 100).toFixed(1),
  }))

  const radarData = metricsBar.map((metric) => ({
    subject: metric.name,
    value: +(metric.value * 100).toFixed(1),
  }))

  const featureImportanceRows = Object.entries(data.feature_importance || {})
    .map(([feature, importance]) => ({
      feature,
      importance: +(importance * 100).toFixed(1),
    }))
    .slice(0, 10)

  const hasFeatureImportance = featureImportanceRows.length > 0
  const hasTrainingHistory = Array.isArray(data.history) && data.history.length > 0

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="Step 03"
        title="Model Metrics"
        subtitle={`Model: ${data.model_type} - ${isClassification ? 'Classification' : 'Regression'} workflow`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isClassification ? (
          <>
            <StatCard label="Accuracy" value={pct(data.accuracy ?? 0)} icon={Activity} accent />
            <StatCard label="F1 Score" value={pct(data.f1_score ?? 0)} icon={TrendingUp} />
            <StatCard label="Precision" value={pct(data.precision ?? 0)} icon={Cpu} />
            <StatCard label="Recall" value={pct(data.recall ?? 0)} icon={Clock} />
          </>
        ) : (
          <>
            <StatCard label="RMSE" value={data.rmse?.toFixed?.(4) ?? '0.0000'} icon={Activity} accent />
            <StatCard label="MAE" value={data.mae?.toFixed?.(4) ?? '0.0000'} icon={TrendingUp} />
            <StatCard label="R2" value={pct(data.r2 ?? 0)} icon={Cpu} />
            <StatCard label="Model Type" value={data.model_type} icon={Clock} />
          </>
        )}
      </div>

      <div className="bg-panel border border-border rounded-lg p-5 space-y-4">
        <p className="text-xs font-mono text-textDim uppercase tracking-widest mb-2">Metric Overview</p>
        {metricsBar.map((metric) => (
          <ProgressBar
            key={metric.name}
            label={metric.name}
            value={metric.value}
            max={1}
            color={metric.value >= 0.85 ? 'success' : metric.value >= 0.7 ? 'accent' : 'warning'}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPanel title="Metrics Comparison - Bar">
          <BarChart data={metricsBar.map((metric) => ({ name: metric.name, value: +(metric.value * 100).toFixed(1) }))}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="name" {...axisStyle} />
            <YAxis domain={[0, 100]} {...axisStyle} />
            <Tooltip {...tooltipStyle} formatter={(value) => [`${value}%`]} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {metricsBar.map((_, index) => (
                <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartPanel>

        <ChartPanel title="Metrics Breakdown - Pie">
          <PieChart>
            <Pie
              data={metricsPie}
              cx="50%"
              cy="50%"
              outerRadius={90}
              dataKey="value"
              label={({ name, value }) => `${name} ${value}%`}
              labelLine={false}
            >
              {metricsPie.map((_, index) => (
                <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPanel title="Training History - Line" height={220}>
          {hasTrainingHistory ? (
            <LineChart data={data.history}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="epoch" {...axisStyle} label={{ value: 'Epoch', position: 'insideBottom', fill: '#7a7a9a', fontSize: 10 }} />
              <YAxis domain={[0.6, 1]} {...axisStyle} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <Tooltip {...tooltipStyle} formatter={(value) => `${(value * 100).toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: '#7a7a9a' }} />
              <Line type="monotone" dataKey="train_acc" stroke={COLORS.accent} strokeWidth={2} dot={false} name="Train Acc" />
              <Line type="monotone" dataKey="val_acc" stroke={COLORS.success} strokeWidth={2} dot={{ r: 3, fill: COLORS.success }} name="Val Acc" />
            </LineChart>
          ) : (
            <div className="h-full flex items-center justify-center text-center px-6">
              <p className="text-xs text-textDim font-mono">
                Training history is not returned by the current AI engine yet.
              </p>
            </div>
          )}
        </ChartPanel>

        <ChartPanel title={hasFeatureImportance ? 'Feature Importance' : 'Performance Radar'} height={220}>
          {hasFeatureImportance ? (
            <BarChart data={featureImportanceRows} layout="vertical" margin={{ left: 24, right: 12 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis type="number" {...axisStyle} tickFormatter={(value) => `${value}%`} />
              <YAxis type="category" dataKey="feature" {...axisStyle} width={100} />
              <Tooltip {...tooltipStyle} formatter={(value) => [`${value}%`]} />
              <Bar dataKey="importance" fill={COLORS.accent} radius={[0, 3, 3, 0]} />
            </BarChart>
          ) : (
            <RadarChart data={radarData}>
              <PolarGrid stroke={COLORS.border} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#7a7a9a', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
              <Radar dataKey="value" stroke={COLORS.accent} fill={COLORS.accent} fillOpacity={0.15} />
            </RadarChart>
          )}
        </ChartPanel>
      </div>

      {data.confusion_matrix && (
        <div className="bg-panel border border-border rounded-lg p-5">
          <p className="text-xs font-mono text-textDim uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1 h-3 bg-accent rounded-full" />
            Confusion Matrix
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {[
              { label: 'True Negative', val: data.confusion_matrix[0][0], color: 'success' },
              { label: 'False Positive', val: data.confusion_matrix[0][1], color: 'danger' },
              { label: 'False Negative', val: data.confusion_matrix[1][0], color: 'warning' },
              { label: 'True Positive', val: data.confusion_matrix[1][1], color: 'accent' },
            ].map(({ label, val, color }) => (
              <div key={label} className={`border rounded-lg p-3 bg-${color}/5 border-${color}/20`}>
                <div className={`text-xl font-display font-bold text-${color}`}>{val?.toLocaleString()}</div>
                <div className="text-xs text-textDim font-mono">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
