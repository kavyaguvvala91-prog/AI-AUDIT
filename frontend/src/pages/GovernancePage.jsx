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

const solutionBlueprints = {
  drift_retrain: {
    owner: 'MLOps + Data Science',
    timeline: 'Next 24 hours',
    validation: 'Drift score falls below threshold and refreshed model outperforms the current champion.',
    checklist: [
      'Rebuild the reference baseline from the latest trusted cohort.',
      'Retrain with fresh labelled data and compare against the current production model.',
      'Promote only after drift and metric checks both pass.',
    ],
  },
  quality_cleanup: {
    owner: 'Data Engineering',
    timeline: 'Before next training run',
    validation: 'Missing-value, outlier, and invalid-row rates return to the acceptable quality band.',
    checklist: [
      'Patch missing values and standardize the fields with high variance.',
      'Remove or quarantine malformed records before they reach training.',
      'Re-run quality scoring and confirm readiness before retraining.',
    ],
  },
  bias_rebalance: {
    owner: 'Responsible AI + Modeling',
    timeline: 'Before release approval',
    validation: 'Parity gaps shrink across sensitive groups without unacceptable performance loss.',
    checklist: [
      'Rebalance the training sample or adjust thresholds for impacted groups.',
      'Run fairness evaluation on the repaired model and compare by group.',
      'Document the fairness trade-offs before shipping the new version.',
    ],
  },
}

const defaultSolutionBlueprint = {
  owner: 'Model Governance Team',
  timeline: 'As soon as practical',
  validation: 'Risk score and supporting evidence improve after remediation is applied.',
  checklist: [
    'Investigate the root cause behind the alert.',
    'Apply the recommended mitigation and record the change.',
    'Re-run monitoring before closing the incident.',
  ],
}

const formatTimestamp = (value) => {
  if (!value) return 'Live'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

const buildSolutionCards = (data) => {
  const recommendations = data.recommendations || []
  const monitoring = data.monitoring || {}

  if (recommendations.length > 0) {
    return recommendations.map((item) => {
      const blueprint = solutionBlueprints[item.code] || defaultSolutionBlueprint
      return {
        ...item,
        owner: blueprint.owner,
        timeline: blueprint.timeline,
        validation: blueprint.validation,
        checklist: blueprint.checklist,
      }
    })
  }

  const fallback = []

  if (monitoring.drift?.drifted) {
    fallback.push({
      code: 'drift_followup',
      title: 'Production drift needs intervention',
      severity: monitoring.drift.severity || 'high',
      risk_score: Math.round((monitoring.drift.score || 0) * 100),
      rationale: 'Feature distributions are moving away from the established baseline.',
      recommended_action: 'Refresh the baseline, retrain on newer data, and validate the new model before release.',
      auto_fix_available: false,
      owner: 'MLOps + Data Science',
      timeline: 'Next 24 hours',
      validation: 'Drift returns below the accepted threshold.',
      checklist: defaultSolutionBlueprint.checklist,
    })
  }

  if (monitoring.bias?.bias_detected) {
    fallback.push({
      code: 'fairness_followup',
      title: 'Fairness risk needs targeted remediation',
      severity: monitoring.bias.severity || 'medium',
      risk_score: Math.round((1 - (monitoring.bias.fairness_score || 0.8)) * 100),
      rationale: 'Protected-group parity has moved outside the acceptable range.',
      recommended_action: 'Audit the affected groups, rebalance the training set, and retest before promotion.',
      auto_fix_available: false,
      owner: 'Responsible AI + Modeling',
      timeline: 'Before release approval',
      validation: 'Parity gaps improve without severe performance regression.',
      checklist: defaultSolutionBlueprint.checklist,
    })
  }

  return fallback
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
  const solutionCards = buildSolutionCards(data)
  const immediatePlan = solutionCards.slice(0, 3).map((item, index) => ({
    step: index + 1,
    title: item.title,
    action: item.recommended_action,
    owner: item.owner,
    timeline: item.timeline,
  }))

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

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-accent" />
                <span className="font-display text-text">Solutions for Current Problems</span>
              </div>
              <div className="mt-1 text-xs text-textDim font-mono">
                Concrete remediation plans for the governance issues currently affecting this model.
              </div>
            </div>
            <Badge variant={solutionCards.length ? 'warning' : 'success'}>
              {solutionCards.length ? `${solutionCards.length} solution plans` : 'No open issues'}
            </Badge>
          </div>

          <div className="space-y-4">
            {solutionCards.length ? solutionCards.map((item) => (
              <div key={item.code} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-text">{item.title}</div>
                    <div className="mt-1 text-xs font-mono text-textDim">Problem code: {item.code}</div>
                  </div>
                  <Badge variant={severityVariant[item.severity] || 'warning'}>
                    {item.severity}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Problem</div>
                    <p className="mt-2 text-textDim leading-6">{item.rationale}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Solution</div>
                    <p className="mt-2 text-text leading-6">{item.recommended_action}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="rounded-md border border-border px-3 py-3">
                    <div className="text-textDim">Owner</div>
                    <div className="mt-1 text-text">{item.owner}</div>
                  </div>
                  <div className="rounded-md border border-border px-3 py-3">
                    <div className="text-textDim">Target Window</div>
                    <div className="mt-1 text-text">{item.timeline}</div>
                  </div>
                  <div className="rounded-md border border-border px-3 py-3">
                    <div className="text-textDim">Risk Score</div>
                    <div className="mt-1 text-text">{item.risk_score}/100</div>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-border bg-panel px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">How to validate the fix</div>
                  <p className="mt-2 text-sm text-textDim leading-6">{item.validation}</p>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono">Execution checklist</div>
                  <div className="mt-3 space-y-2">
                    {item.checklist.map((step) => (
                      <div key={step} className="flex items-start gap-3 rounded-md border border-border px-3 py-3">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                        <span className="text-sm text-textDim leading-6">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {item.auto_fix_available && (
                  <div className="mt-4">
                    <Badge variant="accent">Auto-fix available for part of this workflow</Badge>
                  </div>
                )}
              </div>
            )) : (
              <div className="text-sm text-textDim">No active governance issues need remediation right now.</div>
            )}
          </div>
        </div>

        <div className="bg-panel border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-warning" />
            <span className="font-display text-text">Immediate Response Plan</span>
          </div>
          <p className="text-sm text-textDim leading-7">
            Use this sequence when the monitoring signals on the current model need action before release or continued production use.
          </p>

          <div className="mt-5 space-y-3">
            {immediatePlan.length ? immediatePlan.map((item) => (
              <div key={item.step} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full border border-accent/30 bg-accent/10 flex items-center justify-center text-accent font-mono text-xs">
                      0{item.step}
                    </div>
                    <div className="font-display text-text">{item.title}</div>
                  </div>
                  <Badge variant="default">{item.timeline}</Badge>
                </div>
                <p className="mt-3 text-sm text-textDim leading-6">{item.action}</p>
                <div className="mt-3 text-xs font-mono text-textDim">Owner: {item.owner}</div>
              </div>
            )) : (
              <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-sm text-textDim">
                No urgent response plan is needed. The current governance signals are inside the expected operating band.
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-border">
            <div className="text-xs uppercase tracking-[0.2em] text-textDim font-mono mb-3">Release Gate</div>
            <div className="space-y-2 text-sm text-textDim">
              <div>1. Confirm drift, fairness, and quality checks pass after remediation.</div>
              <div>2. Compare the remediated model against the current version using the same evaluation slice.</div>
              <div>3. Publish only when the risk score drops and validation evidence is attached.</div>
            </div>
          </div>
        </div>
      </div>

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
              <div className="mt-3 text-xs font-mono text-textDim">
                Owner: {(solutionBlueprints[item.code] || defaultSolutionBlueprint).owner} • Target: {(solutionBlueprints[item.code] || defaultSolutionBlueprint).timeline}
              </div>
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
