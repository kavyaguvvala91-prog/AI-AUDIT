import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  Download,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import SectionHeader from '../components/SectionHeader.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import Alert from '../components/Alert.jsx'
import Badge from '../components/Badge.jsx'
import ScoreGauge from '../components/ScoreGauge.jsx'
import StatCard from '../components/StatCard.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import { axisStyle, gridStyle, tooltipStyle, PALETTE, COLORS } from '../charts/theme.js'
import { downloadGovernanceReport, getGovernanceDashboard, runAutoFix } from '../api/endpoints.js'
import { mockGovernance } from '../utils/mock.js'
import { pct } from '../utils/format.js'

const severityVariant = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  warning: 'warning',
}

const providerLabel = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  'rule-based': 'Rule-based',
}

const formatTimestamp = (value) => {
  if (!value) return 'Live'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

export default function GovernancePage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const datasetId = localStorage.getItem('currentDatasetId')
  const referenceDatasetId = localStorage.getItem('currentReferenceDatasetId')

  const loadDashboard = useCallback(async () => {
    if (!datasetId) {
      setData(mockGovernance)
      return
    }

    try {
      const response = await getGovernanceDashboard(
        datasetId,
        referenceDatasetId ? { referenceDatasetId } : {}
      )
      setData(response.data)
      setError('')
    } catch (err) {
      setError(err?.response?.data?.message || 'Governance dashboard unavailable, showing demo state.')
      setData(mockGovernance)
    }
  }, [datasetId, referenceDatasetId])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  if (!data) return <LoadingSpinner message="Building governance dashboard..." />

  const drift = data.monitoring?.drift || {}
  const bias = data.monitoring?.bias || {}
  const anomaly = data.monitoring?.anomaly || {}
  const confidence = data.monitoring?.confidence || {}
  const featureImportance = data.charts?.feature_importance || []
  const fairnessHeatmap = bias.heatmap || []
  const recommendations = data.recommendations || []
  const alerts = data.alerts || []
  const warnings = data.warnings || []
  const pipeline = data.pipeline || []
  const autoFixAvailable = data.auto_fix?.available_count || 0
  const insights = data.insights || {}

  const handleDownload = async (format) => {
    if (!datasetId) {
      setMessage(`Demo mode: ${format.toUpperCase()} report download simulated.`)
      return
    }

    setBusy(true)
    try {
      const blob = await downloadGovernanceReport(datasetId, format)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `governance-report.${format}`
      link.click()
      window.URL.revokeObjectURL(url)
      setMessage(`${format.toUpperCase()} governance report downloaded.`)
    } catch {
      setError('Report download failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleAutoFix = async () => {
    if (!datasetId) {
      setMessage('Demo mode: auto-fix simulated.')
      return
    }

    setBusy(true)
    try {
      await runAutoFix(datasetId, { approvalGranted: true })
      setMessage('Auto-fix executed. Governance dashboard refreshed.')
      await loadDashboard()
    } catch (err) {
      setError(err?.response?.data?.message || 'Auto-fix could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="Executive Control"
        title="AI Governance Dashboard"
        subtitle="One intelligent control room for model health, drift, fairness, anomalies, confidence, remediation, and LLM-generated governance insight"
      />

      {message && <Alert type="success" message={message} onClose={() => setMessage('')} />}
      {error && <Alert type="warning" message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
        <div className="bg-panel border border-border rounded-lg p-6">
          <ScoreGauge value={data.summary?.model_health_score || 0} label="Model Health" />
          <div className="mt-6 pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-textDim">Risk Level</span>
              <Badge variant={severityVariant[data.summary?.risk_level] || 'warning'}>
                {data.summary?.risk_level || 'medium'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-textDim">Status</span>
              <span className="text-sm font-display text-text">{data.summary?.status || 'action_required'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-textDim">Auto-Fix Ready</span>
              <span className="text-sm font-display text-accent">{autoFixAvailable}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-[0.2em] text-textDim">Insights</span>
              <Badge variant={insights.provider === 'rule-based' ? 'warning' : 'accent'}>
                {providerLabel[insights.provider] || 'OpenAI'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Overall Risk"
            value={`${data.summary?.overall_risk_score || 0}/100`}
            sub="Composite governance risk"
            accent={(data.summary?.overall_risk_score || 0) >= 60}
            icon={ShieldAlert}
          />
          <StatCard
            label="Drift Score"
            value={pct(drift.score || 0)}
            sub={drift.affected_features?.length ? `${drift.affected_features.length} shifted features` : 'Baseline comparison pending'}
            accent={drift.drifted}
            icon={TrendingUp}
          />
          <StatCard
            label="Fairness Score"
            value={bias.fairness_score ? pct(bias.fairness_score) : 'N/A'}
            sub={bias.affected_groups?.length ? `${bias.affected_groups.length} affected groups` : 'No group disparity flagged'}
            accent={bias.bias_detected}
            icon={Shield}
          />
          <StatCard
            label="Low Confidence"
            value={confidence.low_confidence_count || 0}
            sub={confidence.low_confidence_rate ? pct(confidence.low_confidence_rate) : 'No review pressure'}
            accent={(confidence.low_confidence_count || 0) > 0}
            icon={Zap}
          />
          <StatCard
            label="Anomalies"
            value={anomaly.count || 0}
            sub={anomaly.rate ? pct(anomaly.rate) : 'No anomaly spikes'}
            accent={(anomaly.count || 0) > 0}
            icon={AlertTriangle}
          />
          <div className="bg-panel border border-border rounded-lg p-4 col-span-2 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Governance Controls</div>
                <div className="mt-2 text-sm text-textDim">
                  Download evidence, trigger recommended remediation, and review the active monitoring scope.
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => handleDownload('json')}
                  disabled={busy}
                  className="px-4 py-2 rounded-md border border-border bg-surface text-text text-sm flex items-center gap-2"
                >
                  <Download size={14} /> JSON
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('pdf')}
                  disabled={busy}
                  className="px-4 py-2 rounded-md border border-border bg-surface text-text text-sm flex items-center gap-2"
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  type="button"
                  onClick={handleAutoFix}
                  disabled={busy || autoFixAvailable === 0}
                  className="px-4 py-2 rounded-md border border-accent/20 bg-accent/10 text-accent text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Wrench size={14} /> Run Auto-Fix
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(data.dataset?.sensitive_attributes || []).map((item) => (
                <Badge key={item} variant="accent">{item}</Badge>
              ))}
              {data.dataset?.target_column && <Badge variant="default">Target: {data.dataset.target_column}</Badge>}
              {data.dataset?.model_type && <Badge variant="default">{data.dataset.model_type}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {alerts.slice(0, 3).map((item, index) => (
            <div key={`${item.title}-${index}`} className="bg-panel border border-border rounded-lg p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-display text-text">{item.title}</div>
                <Badge variant={severityVariant[item.severity] || 'warning'}>{item.severity}</Badge>
              </div>
              <p className="mt-2 text-sm text-textDim">{item.detail}</p>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-warning font-mono mb-3">Coverage Notes</div>
          <div className="grid gap-2">
            {warnings.map((item) => (
              <div key={item} className="text-sm text-textDim">{item}</div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartPanel title="Drift Trend">
          {drift.trend?.length ? (
            <LineChart data={drift.trend}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="label" {...axisStyle} />
              <YAxis {...axisStyle} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <Tooltip {...tooltipStyle} formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Drift']} />
              <Line type="monotone" dataKey="score" stroke={COLORS.warning} strokeWidth={2} dot={{ fill: COLORS.warning, r: 3 }} />
            </LineChart>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-mono text-textDim">
              Drift history will appear after repeated baseline comparisons.
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="Anomaly Activity">
          {anomaly.trend?.length ? (
            <AreaChart data={anomaly.trend}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="label" {...axisStyle} />
              <YAxis {...axisStyle} tickFormatter={(value) => `${(value * 100).toFixed(1)}%`} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value, name) => [name === 'rate' ? `${(value * 100).toFixed(2)}%` : value, name === 'rate' ? 'Rate' : 'Count']}
              />
              <Area type="monotone" dataKey="rate" stroke={COLORS.danger} fill="rgba(247,110,110,0.18)" strokeWidth={2} />
            </AreaChart>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-mono text-textDim">
              Anomaly activity will populate after a completed detection run.
            </div>
          )}
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartPanel title="Confidence Distribution">
          {confidence.distribution?.length ? (
            <BarChart data={confidence.distribution}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="range" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {confidence.distribution.map((_, index) => (
                  <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-mono text-textDim">
              Confidence buckets will appear once predictions are generated.
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="Top Drifted Features">
          {drift.affected_features?.length ? (
            <BarChart data={drift.affected_features} layout="vertical" margin={{ left: 70 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis type="number" {...axisStyle} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <YAxis type="category" dataKey="feature" {...axisStyle} width={90} />
              <Tooltip {...tooltipStyle} formatter={(value) => [`${(value * 100).toFixed(2)}%`, 'Shift']} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} fill={COLORS.warning} />
            </BarChart>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-mono text-textDim">
              No feature-level drift breakdown is available yet.
            </div>
          )}
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="font-display text-text">Fairness Heatmap</div>
              <div className="text-xs text-textDim font-mono mt-1">
                Group-wise parity gap and positive outcome rate across detected sensitive attributes
              </div>
            </div>
            <Badge variant={bias.bias_detected ? 'danger' : 'success'}>
              {bias.bias_detected ? 'bias detected' : 'stable'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fairnessHeatmap.length ? fairnessHeatmap.map((item) => {
              const variant =
                item.parity_gap >= 0.2 ? 'border-danger/30 bg-danger/10' :
                item.parity_gap >= 0.1 ? 'border-warning/30 bg-warning/10' :
                'border-success/30 bg-success/10'

              return (
                <div key={`${item.attribute}-${item.group}`} className={`rounded-lg border p-4 ${variant}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-textDim font-mono">{item.attribute}</div>
                      <div className="mt-2 font-display text-text">{item.group}</div>
                    </div>
                    <Badge variant={severityVariant[item.severity] || 'warning'}>{item.severity}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <div className="text-textDim">Parity Gap</div>
                      <div className="mt-1 text-text">{pct(item.parity_gap || 0)}</div>
                    </div>
                    <div>
                      <div className="text-textDim">Positive Rate</div>
                      <div className="mt-1 text-text">{pct(item.positive_rate || 0)}</div>
                    </div>
                  </div>
                </div>
              )
            }) : (
              <div className="text-sm text-textDim">No fairness group breakdown is available yet.</div>
            )}
          </div>
        </div>

        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={16} className="text-accent" />
            <span className="font-display text-text">AI Governance Insight</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant={insights.provider === 'rule-based' ? 'warning' : 'accent'}>
              {providerLabel[insights.provider] || 'OpenAI'}
            </Badge>
            <Badge variant="default">{insights.model || 'governance-model'}</Badge>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-7 text-textDim whitespace-pre-wrap">
            {insights.text || 'Governance insight is being prepared.'}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono mb-3">Governance Pipeline</div>
            <div className="space-y-2">
              {pipeline.map((step) => (
                <div key={step.step} className="rounded-md border border-border bg-surface px-3 py-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-text">{step.step}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-textDim">{formatTimestamp(step.time)}</span>
                    <Badge variant={step.status === 'completed' ? 'success' : step.status === 'pending' ? 'warning' : 'default'}>
                      {step.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartPanel title="Feature Importance">
          {featureImportance.length ? (
            <BarChart data={featureImportance}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="feature" {...axisStyle} />
              <YAxis {...axisStyle} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
              <Tooltip {...tooltipStyle} formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Importance']} />
              <Bar dataKey="importance" radius={[4, 4, 0, 0]}>
                {featureImportance.map((_, index) => (
                  <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-mono text-textDim">
              Feature importance is unavailable until a model with importances is trained.
            </div>
          )}
        </ChartPanel>

        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-warning" />
            <span className="font-display text-text">Suspicious Predictions</span>
          </div>

          <div className="space-y-3">
            {anomaly.suspicious_predictions?.length ? anomaly.suspicious_predictions.map((item) => (
              <div key={`${item.row_index}-${item.prediction}`} className="rounded-md border border-border bg-surface px-4 py-3">
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
              <div className="text-sm text-textDim">No suspicious prediction sample is available yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-panel border border-border rounded-lg p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-danger" />
            <span className="font-display text-text">AI Recommendations</span>
          </div>
          <Badge variant={recommendations.length ? 'warning' : 'success'}>
            {recommendations.length} action{recommendations.length === 1 ? '' : 's'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {recommendations.length ? recommendations.map((item) => (
            <div key={item.code} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-display text-text">{item.title}</div>
                <Badge variant={severityVariant[item.severity] || 'warning'}>{item.severity}</Badge>
              </div>
              <div className="mt-2 text-xs font-mono text-textDim">Risk score {item.risk_score}/100</div>
              <p className="mt-3 text-sm text-textDim">{item.rationale}</p>
              <p className="mt-3 text-sm text-text">{item.recommended_action}</p>
              {item.auto_fix_available && (
                <div className="mt-3">
                  <Badge variant="accent">auto-fix available</Badge>
                </div>
              )}
            </div>
          )) : (
            <div className="text-sm text-textDim">No immediate governance action is required right now.</div>
          )}
        </div>
      </div>
    </div>
  )
}
