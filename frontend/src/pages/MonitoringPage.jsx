import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
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
  drift_threshold: 0.2,
  drift_detected: false,
  top_drift_columns: [],
  anomaly_count: 0,
  anomaly_rate: 0,
  anomaly_indices: [],
  suspicious_predictions: [],
  confidence_mean: 0,
  confidence_std: 0,
  confidence_min: null,
  confidence_max: null,
  low_confidence_count: 0,
  low_confidence_rate: 0,
  bias_score: 0,
  fairness_score: null,
  bias_detected: false,
  bias_features: [],
  fairness_groups: [],
  sensitive_attributes: [],
  feature_importance: [],
  drift_history: [],
  confidence_dist: [],
  target_column: null,
  reference_dataset_id: null,
  prediction_summary: {},
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

  const formatOptionalPct = (value) => (typeof value === 'number' ? pct(value) : 'N/A')
  const biasData = [
    { name: 'Detected', value: data.bias_features.length },
    { name: 'Clean', value: Math.max(0, 8 - data.bias_features.length) },
  ]

  const hasFeatureImportance = Array.isArray(data.feature_importance) && data.feature_importance.length > 0
  const hasDriftHistory = Array.isArray(data.drift_history) && data.drift_history.length > 0
  const hasConfidenceDistribution = Array.isArray(data.confidence_dist) && data.confidence_dist.length > 0
  const hasTopDriftColumns = Array.isArray(data.top_drift_columns) && data.top_drift_columns.length > 0
  const hasFairnessGroups = Array.isArray(data.fairness_groups) && data.fairness_groups.length > 0
  const hasSuspiciousPredictions = Array.isArray(data.suspicious_predictions) && data.suspicious_predictions.length > 0
  const predictionMix = Object.entries(data.prediction_summary?.value_counts || {})

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="Step 04"
        title="AI Monitoring"
        subtitle="Loan-model drift, fairness, anomaly, and confidence signals with the details needed for review"
      />

      {error && (
        <Alert
          type="warning"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <div className={`border rounded-lg px-5 py-3 flex flex-wrap items-center gap-3 ${
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
        {data.target_column && <Badge variant="default">Target: {data.target_column}</Badge>}
        {data.reference_dataset_id && <Badge variant="accent">Reference Ready</Badge>}
        {data.sensitive_attributes?.map((attribute) => (
          <Badge key={attribute} variant="warning">{attribute}</Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Drift Score"
          value={pct(data.drift_score)}
          sub={`Threshold ${pct(data.drift_threshold)}`}
          icon={TrendingUp}
          accent={data.drift_score > 0.1}
        />
        <StatCard
          label="Anomalies"
          value={data.anomaly_count}
          sub={pct(data.anomaly_rate)}
          icon={AlertTriangle}
          accent={data.anomaly_count > 0}
        />
        <StatCard
          label="Confidence"
          value={pct(data.confidence_mean)}
          sub={`${data.low_confidence_count} low-confidence rows`}
          icon={Zap}
          accent={data.low_confidence_count > 0}
        />
        <StatCard
          label="Fairness Score"
          value={formatOptionalPct(data.fairness_score)}
          sub={data.bias_detected ? 'Bias signal detected' : 'No major parity gap'}
          icon={Shield}
          accent={data.bias_detected}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPanel title="Top Drifted Features" height={280}>
          {hasTopDriftColumns ? (
            <BarChart data={data.top_drift_columns} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis type="number" {...axisStyle} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <YAxis type="category" dataKey="feature" {...axisStyle} width={90} />
              <Tooltip {...tooltipStyle} formatter={(value) => [`${(value * 100).toFixed(2)}%`, 'PSI']} />
              <Bar dataKey="score" fill={COLORS.warning} radius={[0, 3, 3, 0]}>
                {data.top_drift_columns.map((_, index) => (
                  <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <div className="flex items-center justify-center h-full text-center px-6">
              <p className="text-textDim text-xs font-mono">
                Drift detail appears after this dataset is compared with a reference baseline.
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
            Monitoring Summary
          </p>

          <div className="space-y-2">
            <ProgressBar label="Bias Score" value={data.bias_score} max={1} color="danger" />
            <ProgressBar label="Anomaly Rate" value={data.anomaly_rate} max={0.1} color="warning" />
            <ProgressBar label="Low Confidence Rate" value={data.low_confidence_rate} max={1} color="accent" />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border text-xs font-mono">
            <div>
              <div className="text-textDim">Confidence Range</div>
              <div className="mt-1 text-text">
                {data.confidence_min == null || data.confidence_max == null
                  ? 'N/A'
                  : `${pct(data.confidence_min)} to ${pct(data.confidence_max)}`}
              </div>
            </div>
            <div>
              <div className="text-textDim">Confidence Std Dev</div>
              <div className="mt-1 text-text">{pct(data.confidence_std)}</div>
            </div>
          </div>

          <div>
            <p className="text-xs text-textDim font-mono mb-2">Flagged Bias Attributes</p>
            <div className="flex flex-wrap gap-2">
              {data.bias_features.length > 0 ? data.bias_features.map((feature) => (
                <Badge key={feature} variant="danger">{feature}</Badge>
              )) : (
                <span className="text-textDim text-xs font-mono">No bias indicators available yet</span>
              )}
            </div>
          </div>

          {predictionMix.length > 0 && (
            <div>
              <p className="text-xs text-textDim font-mono mb-2">Prediction Mix</p>
              <div className="flex flex-wrap gap-2">
                {predictionMix.map(([label, count]) => (
                  <Badge key={label} variant="default">{label}: {count}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-text">Fairness Group Breakdown</div>
              <div className="mt-1 text-xs text-textDim font-mono">
                Positive-rate parity across the sensitive groups detected for this loan dataset
              </div>
            </div>
            <Badge variant={data.bias_detected ? 'danger' : 'success'}>
              {data.bias_detected ? 'Bias detected' : 'Stable'}
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            {hasFairnessGroups ? data.fairness_groups.map((item) => (
              <div key={`${item.attribute}-${item.group}`} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-textDim font-mono">{item.attribute}</div>
                    <div className="mt-2 font-display text-text">{item.group}</div>
                  </div>
                  <Badge variant={item.severity === 'high' ? 'danger' : item.severity === 'medium' ? 'warning' : 'success'}>
                    {item.severity}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <div className="text-textDim">Rows</div>
                    <div className="mt-1 text-text">{item.count}</div>
                  </div>
                  <div>
                    <div className="text-textDim">Positive Rate</div>
                    <div className="mt-1 text-text">{pct(item.positive_rate || 0)}</div>
                  </div>
                  <div>
                    <div className="text-textDim">Parity Gap</div>
                    <div className="mt-1 text-text">{pct(item.parity_gap || 0)}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-textDim text-sm">
                Fairness details will appear after bias monitoring runs with a target column and sensitive attributes.
              </div>
            )}
          </div>
        </div>

        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-text">Risky Prediction Rows</div>
              <div className="mt-1 text-xs text-textDim font-mono">
                Rows flagged as anomalies or low-confidence outcomes that need manual review
              </div>
            </div>
            <Badge variant={hasSuspiciousPredictions ? 'warning' : 'success'}>
              {hasSuspiciousPredictions ? `${data.suspicious_predictions.length} flagged` : 'Clean'}
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            {hasSuspiciousPredictions ? data.suspicious_predictions.map((item) => (
              <div key={`${item.row_index}-${item.prediction}`} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-text">Row #{item.row_index}</div>
                  <Badge variant={item.flagged_as_anomaly ? 'danger' : 'warning'}>
                    {item.flagged_as_anomaly ? 'anomaly' : 'low confidence'}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-textDim">
                  Prediction: <span className="text-text">{String(item.prediction)}</span>
                </div>
                <div className="mt-1 text-sm text-textDim">
                  Confidence: <span className="text-text">{item.confidence == null ? 'N/A' : pct(item.confidence)}</span>
                </div>
              </div>
            )) : (
              <div className="text-textDim text-sm">
                No suspicious prediction rows are currently flagged.
              </div>
            )}
          </div>

          {data.anomaly_indices.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-textDim font-mono mb-2">Anomaly Row Indices</p>
              <div className="flex flex-wrap gap-2">
                {data.anomaly_indices.slice(0, 12).map((index) => (
                  <Badge key={index} variant="danger">#{index}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
