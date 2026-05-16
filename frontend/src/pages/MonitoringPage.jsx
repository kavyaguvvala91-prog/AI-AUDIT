import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'
import { AlertTriangle, Shield, Zap, TrendingUp, Eye } from 'lucide-react'
import SectionHeader from '../components/SectionHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import Badge from '../components/Badge.jsx'
import Alert from '../components/Alert.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { axisStyle, gridStyle, tooltipStyle, PALETTE, COLORS } from '../charts/theme.js'
import { mockMonitoring } from '../utils/mock.js'
import { getMonitoring } from '../api/endpoints.js'
import { pct, statusColor, statusLabel } from '../utils/format.js'

const emptyMonitoring = {
  drift_score: 0,
  anomaly_count: 0,
  anomaly_rate: 0,
  confidence_mean: 0,
  confidence_std: 0,
  bias_score: 0,
  bias_features: [],
  feature_importance: [],
  drift_history: [],
  confidence_dist: [],
}

export default function MonitoringPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const datasetId = localStorage.getItem('currentDatasetId')
    if (!datasetId) {
      setData(mockMonitoring)
      setLoading(false)
      return
    }

    getMonitoring(datasetId)
      .then((response) => {
        setData(response.data)
        setError(null)
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message ||
          'Monitoring could not be generated for this dataset yet. Make sure analysis and training completed successfully.'
        )
        setData(emptyMonitoring)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Loading monitoring data..." />

  const biasData = [
    { name: 'Detected', value: data.bias_features.length },
    { name: 'Clean', value: Math.max(0, 8 - data.bias_features.length) },
  ]

  const hasFeatureImportance = Array.isArray(data.feature_importance) && data.feature_importance.length > 0
  const hasDriftHistory = Array.isArray(data.drift_history) && data.drift_history.length > 0
  const hasConfidenceDistribution = Array.isArray(data.confidence_dist) && data.confidence_dist.length > 0

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="Step 04"
        title="AI Monitoring"
        subtitle="Real-time drift, anomaly, and bias detection across the model pipeline"
      />

      {error && (
        <Alert
          type="warning"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <div className={`border rounded-lg px-5 py-3 flex items-center gap-3 ${
        data.drift_score < 0.1 ? 'border-success/30 bg-success/5' :
        data.drift_score < 0.2 ? 'border-warning/30 bg-warning/5' :
        'border-danger/30 bg-danger/5'
      }`}>
        <Eye size={16} className={statusColor(data.drift_score)} />
        <span className="text-xs font-mono text-textDim">System Status:</span>
        <span className={`text-sm font-display font-bold ${statusColor(data.drift_score)}`}>
          {statusLabel(data.drift_score)}
        </span>
        <Badge variant={data.drift_score < 0.1 ? 'success' : data.drift_score < 0.2 ? 'warning' : 'danger'}>
          Drift: {(data.drift_score * 100).toFixed(0)}%
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Drift Score" value={pct(data.drift_score)} icon={TrendingUp} accent={data.drift_score > 0.1} />
        <StatCard label="Anomalies" value={data.anomaly_count} icon={AlertTriangle} />
        <StatCard label="Confidence" value={pct(data.confidence_mean)} icon={Zap} accent />
        <StatCard label="Bias Score" value={pct(data.bias_score)} icon={Shield} />
      </div>

      <ChartPanel title="Feature Importance - Bar" height={280}>
        {hasFeatureImportance ? (
          <BarChart data={data.feature_importance} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis type="number" {...axisStyle} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="feature" {...axisStyle} width={80} />
            <Tooltip {...tooltipStyle} formatter={(value) => [`${(value * 100).toFixed(1)}%`]} />
            <Bar dataKey="importance" fill={COLORS.accent} radius={[0, 3, 3, 0]}>
              {data.feature_importance.map((_, index) => (
                <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <div className="flex items-center justify-center h-full text-center px-6">
            <p className="text-textDim text-xs font-mono">
              Feature importance will appear when the trained model provides it for this dataset.
            </p>
          </div>
        )}
      </ChartPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPanel title="Drift Score History - Line">
          {hasDriftHistory ? (
            <LineChart data={data.drift_history}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="day" {...axisStyle} />
              <YAxis domain={[0, 0.3]} {...axisStyle} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <Tooltip {...tooltipStyle} formatter={(value) => [`${(value * 100).toFixed(1)}%`]} />
              <Line type="monotone" dataKey="score" stroke={COLORS.warning} strokeWidth={2} dot={{ fill: COLORS.warning, r: 3 }} />
            </LineChart>
          ) : (
            <div className="flex items-center justify-center h-full text-center px-6">
              <p className="text-textDim text-xs font-mono">
                Drift history is only available after comparing this dataset to a reference dataset.
              </p>
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="Confidence Distribution - Bar">
          {hasConfidenceDistribution ? (
            <BarChart data={data.confidence_dist}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="range" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill={COLORS.success} radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-center px-6">
              <p className="text-textDim text-xs font-mono">
                Confidence distribution will appear after prediction results are generated for this dataset.
              </p>
            </div>
          )}
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPanel title="Bias Detection - Pie">
          <PieChart>
            <Pie
              data={biasData}
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={40}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              <Cell fill={COLORS.danger} />
              <Cell fill={COLORS.success} />
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ChartPanel>

        <div className="bg-panel border border-border rounded-lg p-5 space-y-4">
          <p className="text-xs font-mono text-textDim uppercase tracking-widest flex items-center gap-2">
            <span className="w-1 h-3 bg-danger rounded-full" />
            Bias Indicators
          </p>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-textDim font-mono mb-2">Flagged Features</p>
              <div className="flex flex-wrap gap-2">
                {data.bias_features.length > 0 ? data.bias_features.map((feature) => (
                  <Badge key={feature} variant="danger">{feature}</Badge>
                )) : (
                  <span className="text-textDim text-xs font-mono">No bias indicators available yet</span>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <ProgressBar label="Bias Score" value={data.bias_score} max={1} color="danger" />
              <ProgressBar label="Anomaly Rate" value={data.anomaly_rate} max={0.05} color="warning" />
              <ProgressBar label="Mean Confidence" value={data.confidence_mean} max={1} color="accent" />
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-textDim font-mono mb-2">Confidence Std Dev</p>
            <span className="font-display font-bold text-text">{(data.confidence_std * 100).toFixed(1)}%</span>
            <span className="text-xs text-textDim font-mono ml-2">variance in predictions</span>
          </div>
        </div>
      </div>
    </div>
  )
}
