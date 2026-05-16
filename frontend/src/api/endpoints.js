import client from './client.js'

const inFlightRequests = new Map()

const withInFlightDedup = (key, factory) => {
  if (inFlightRequests.has(key)) return inFlightRequests.get(key)

  const request = Promise.resolve()
    .then(factory)
    .finally(() => inFlightRequests.delete(key))

  inFlightRequests.set(key, request)
  return request
}

const unwrapEnvelopeData = (payload = {}) => payload?.data || payload || {}
const getDataset = async (datasetId) => (await client.get(`/datasets/${datasetId}`)).data?.data || {}
const sensitiveAttributePriority = [
  { label: 'gender', patterns: ['gender', 'sex'] },
  { label: 'income', patterns: ['income', 'salary', 'wage', 'earnings', 'income_band'] },
  { label: 'age', patterns: ['age', 'age_group', 'age_band'] },
  { label: 'race', patterns: ['race', 'ethnicity', 'ethnic'] },
  { label: 'region', patterns: ['region', 'state', 'country', 'zip', 'zipcode', 'postal'] },
]

const normalizeKey = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')

const hasUsableMetrics = (payload = {}) => {
  const body = unwrapEnvelopeData(payload)
  const metrics = body?.metrics
  if (!metrics) return false
  return [
    metrics.accuracy,
    metrics.precision,
    metrics.recall,
    metrics.f1_score,
    metrics.rmse,
    metrics.mae,
    metrics.r2,
  ].some((value) => typeof value === 'number')
}

const buildAnalysisPayload = (payload = {}) => {
  const body = unwrapEnvelopeData(payload)
  return {
    dataset_id: body.dataset_id || null,
    filename: body.file_path?.split(/[\\/]/).pop() || 'dataset.csv',
    shape: { rows: body.row_count || 0, cols: body.column_count || 0 },
    numeric_columns: body.numeric_columns || [],
    categorical_columns: body.categorical_columns || [],
    missing_values: body.missing_summary || {},
    target_column: body.suggested_target || 'Not detected',
    problem_type: body.problem_type || 'unknown',
    class_distribution: body.class_distribution || {},
    column_stats: body.column_stats || [],
    monthly_trend: [],
  }
}

const buildMetricsPayload = (payload = {}) => {
  const body = unwrapEnvelopeData(payload)
  const metrics = body.metrics || {}
  return {
    model_id: body.model_id || null,
    model_type: metrics.model_type || 'Unknown Model',
    accuracy: metrics.accuracy ?? 0,
    precision: metrics.precision ?? 0,
    recall: metrics.recall ?? 0,
    f1_score: metrics.f1_score ?? 0,
    rmse: metrics.rmse ?? null,
    mae: metrics.mae ?? null,
    r2: metrics.r2 ?? null,
    auc_roc: metrics.accuracy ?? 0,
    training_time_s: metrics.training_time_s ?? 0,
    history: [],
    confusion_matrix: null,
    feature_importance: metrics.feature_importance || {},
    problem_type: metrics.problem_type || 'unknown',
    target_column: body.target_column || null,
    leaderboard: metrics.leaderboard || [],
  }
}

const buildConfidenceDistribution = (predictions = []) => {
  const buckets = [
    { range: '0.0-0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.000001, count: 0 },
  ]

  predictions.forEach((row) => {
    const score = row?.confidence
    if (typeof score !== 'number') return
    const bucket = buckets.find((item) => score >= item.min && score < item.max)
    if (bucket) bucket.count += 1
  })

  return buckets.map(({ range, count }) => ({ range, count }))
}

const inferSensitiveAttributes = (columns = [], targetColumn) => {
  const normalizedTarget = normalizeKey(targetColumn)
  const available = new Map(columns.map((column) => [normalizeKey(column), column]))
  const matches = []

  for (const priority of sensitiveAttributePriority) {
    for (const [normalized, original] of available.entries()) {
      if (normalized === normalizedTarget) continue
      if (priority.patterns.some((pattern) => normalized.includes(pattern))) {
        matches.push(original)
      }
    }
  }

  return matches.filter((column, index) => matches.indexOf(column) === index).slice(0, 3)
}

const buildSuspiciousPredictions = (predictions = [], anomalyIndices = []) => {
  const anomalySet = new Set(anomalyIndices)

  return predictions
    .filter((row) => anomalySet.has(row.row_index) || (typeof row?.confidence === 'number' && row.confidence < 0.6))
    .sort((left, right) => (left?.confidence ?? 1) - (right?.confidence ?? 1))
    .slice(0, 6)
    .map((row) => ({
      row_index: row.row_index,
      prediction: row.prediction,
      confidence: row.confidence ?? null,
      flagged_as_anomaly: anomalySet.has(row.row_index),
    }))
}

const buildMonitoringPayload = (monitoringData = {}, dataset = {}) => {
  const results = monitoringData.results || {}
  const driftPayload = unwrapEnvelopeData(results.drift?.payload || {})
  const biasPayload = unwrapEnvelopeData(results.bias?.payload || {})
  const anomalyPayload = unwrapEnvelopeData(results.anomaly?.payload || {})
  const predictionPayload = unwrapEnvelopeData(results.predictions?.payload || {})
  const predictionRows = predictionPayload.predictions || []
  const confidenceValues = predictionRows
    .map((row) => row?.confidence)
    .filter((value) => typeof value === 'number')

  const confidenceMean = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 0
  const confidenceVariance = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + ((value - confidenceMean) ** 2), 0) / confidenceValues.length
    : 0

  const automlPayload = unwrapEnvelopeData(dataset.automl?.payload || {})
  const featureImportanceMap = automlPayload.metrics?.feature_importance || {}
  const featureImportance = Object.entries(featureImportanceMap).map(([feature, importance]) => ({
    feature,
    importance,
  })).sort((left, right) => right.importance - left.importance)

  const biasFeatures = Object.entries(biasPayload.group_metrics || {})
    .filter(([, value]) => value?._bias_flagged)
    .map(([key]) => key)

  const lowConfidenceCount = confidenceValues.filter((value) => value < 0.6).length
  const columnDrift = Object.entries(driftPayload.column_drift || {})
    .map(([feature, score]) => ({ feature, score: Number(score) }))
    .sort((left, right) => right.score - left.score)
  const fairnessGroups = Object.entries(biasPayload.group_summary || {}).flatMap(([attribute, rows]) =>
    (rows || []).map((row) => ({
      attribute,
      group: row.group,
      count: row.count,
      positive_rate: row.positive_rate,
      parity_gap: row.parity_gap,
      severity: row.severity,
    }))
  )
  const anomalyIndices = anomalyPayload.anomaly_indices || []
  const suspiciousPredictions = buildSuspiciousPredictions(predictionRows, anomalyIndices)

  return {
    drift_score: driftPayload.drift_score ?? 0,
    drift_threshold: driftPayload.threshold ?? 0.2,
    drift_detected: Boolean(driftPayload.drifted),
    top_drift_columns: columnDrift.slice(0, 6),
    anomaly_count: anomalyPayload.total_anomalies ?? 0,
    anomaly_rate: anomalyPayload.anomaly_rate ?? 0,
    anomaly_indices: anomalyIndices,
    suspicious_predictions: suspiciousPredictions,
    confidence_mean: Number(confidenceMean.toFixed(4)),
    confidence_std: Number(Math.sqrt(confidenceVariance).toFixed(4)),
    confidence_min: confidenceValues.length ? Number(Math.min(...confidenceValues).toFixed(4)) : null,
    confidence_max: confidenceValues.length ? Number(Math.max(...confidenceValues).toFixed(4)) : null,
    low_confidence_count: lowConfidenceCount,
    low_confidence_rate: confidenceValues.length ? Number((lowConfidenceCount / confidenceValues.length).toFixed(4)) : 0,
    bias_score: biasPayload.bias_detected ? 1 - (biasPayload.fairness_score ?? 0.9) : 0,
    fairness_score: biasPayload.fairness_score ?? null,
    bias_detected: Boolean(biasPayload.bias_detected),
    bias_features: biasFeatures,
    fairness_groups: fairnessGroups,
    sensitive_attributes: biasPayload.sensitive_attributes || [],
    feature_importance,
    drift_history: driftPayload.drift_score != null
      ? [{ day: 'Current', score: driftPayload.drift_score }]
      : [],
    confidence_dist: buildConfidenceDistribution(predictionRows),
    target_column: dataset?.targetColumn || null,
    reference_dataset_id: localStorage.getItem('currentReferenceDatasetId') || null,
    prediction_summary: predictionPayload.summary || {},
  }
}

const ensureAnalysis = async (datasetId, dataset) => {
  if (dataset?.analysis?.payload) return dataset
  await client.post(`/analysis/${datasetId}/run`)
  return getDataset(datasetId)
}

const ensureTraining = async (datasetId, dataset) => {
  const existingPayload = dataset?.automl?.payload
  if (existingPayload && hasUsableMetrics(existingPayload)) return dataset

  const analysisPayload = unwrapEnvelopeData(dataset?.analysis?.payload || {})
  const targetColumn =
    dataset?.targetColumn ||
    analysisPayload.suggested_target ||
    dataset?.columns?.[dataset.columns.length - 1]

  await client.post(`/analysis/${datasetId}/automl`, { targetColumn, config: {} })
  return getDataset(datasetId)
}

export const uploadDataset = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)

  return client.post('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      const total = event.total || event.loaded || 1
      const percentage = Math.round((event.loaded * 100) / total)
      onProgress?.(percentage)
    },
  })
}

export const loadDemoDataset = () =>
  client.get('/demo/load', { timeout: 180000 }).then(({ data }) => ({ data: data?.data || {} }))

export const analyzeDemoDataset = () =>
  client.get('/demo/analyze', { timeout: 180000 }).then(({ data }) => ({ data: data?.data || {} }))

export const launchDemoGovernance = () =>
  client.get('/demo/governance', { timeout: 180000 }).then(({ data }) => ({ data: data?.data || {} }))

export const getAnalysis = (datasetId) =>
  withInFlightDedup(`analysis:${datasetId}`, () =>
    client.post(`/analysis/${datasetId}/run`).then(({ data }) => ({
      data: buildAnalysisPayload(data?.data?.analysis?.payload || {}),
    }))
  )

export const getDatasetList = () => client.get('/datasets')

export const getMetrics = async (datasetId) => withInFlightDedup(`metrics:${datasetId}`, async () => {
  let dataset = await getDataset(datasetId)
  dataset = await ensureTraining(datasetId, await ensureAnalysis(datasetId, dataset))
  const payload = dataset?.automl?.payload || {}
  const built = buildMetricsPayload(payload)
  if (built.model_id) localStorage.setItem('currentModelId', built.model_id)
  return { data: built }
})

export const trainModel = (datasetId, config) => client.post(`/analysis/${datasetId}/automl`, config)

export const getMonitoring = async (datasetId) => withInFlightDedup(`monitoring:${datasetId}`, async () => {
  let dataset = await getDataset(datasetId)
  dataset = await ensureAnalysis(datasetId, dataset)
  dataset = await ensureTraining(datasetId, dataset)
  const automlPayload = unwrapEnvelopeData(dataset?.automl?.payload || {})
  const modelId = automlPayload.model_id || localStorage.getItem('currentModelId')
  const targetColumn =
    localStorage.getItem('currentTargetColumn') ||
    dataset?.targetColumn ||
    automlPayload.target_column ||
    unwrapEnvelopeData(dataset?.analysis?.payload || {}).suggested_target ||
    null
  const referenceDatasetId = localStorage.getItem('currentReferenceDatasetId')
  const sensitiveAttributes = inferSensitiveAttributes(dataset?.columns || [], targetColumn)
  const jobs = []

  if (!dataset?.predictions?.payload && modelId) {
    jobs.push(client.post(`/analysis/${datasetId}/predict`, { modelId }))
  }
  if (!dataset?.anomaly?.payload) {
    jobs.push(client.post(`/monitoring/${datasetId}/anomaly`, {}))
  }
  if (!dataset?.drift?.payload && referenceDatasetId) {
    jobs.push(client.post(`/monitoring/${datasetId}/drift`, { referenceDatasetId }))
  }
  if (!dataset?.bias?.payload && targetColumn && sensitiveAttributes.length) {
    jobs.push(client.post(`/monitoring/${datasetId}/bias`, {
      targetColumn,
      sensitiveAttributes,
    }))
  }
  await Promise.allSettled(jobs)
  dataset = await getDataset(datasetId)
  const monitoringResponse = await client.get(`/monitoring/${datasetId}/results`)
  return {
    data: buildMonitoringPayload(monitoringResponse.data?.data || {}, dataset),
  }
})

export const getQuality = async (datasetId) => withInFlightDedup(`quality:${datasetId}`, async () => {
  const dataset = await getDataset(datasetId)
  const response = dataset?.quality?.payload
    ? { data: { data: { quality: dataset.quality } } }
    : await client.post(`/mlops/${datasetId}/quality`)
  return {
    data: unwrapEnvelopeData(response.data?.data?.quality?.payload || response.data?.data?.quality || response.data?.data),
  }
})

export const getExplainability = async (datasetId, rowIndex = 0, topN = 5) =>
  withInFlightDedup(`explain:${datasetId}:${rowIndex}:${topN}`, async () => {
    const response = await client.post(`/mlops/${datasetId}/explanations`, { rowIndex, topN })
    return {
      data: unwrapEnvelopeData(response.data?.data?.explanations?.payload || {}),
    }
  })

export const getComparison = async (datasetId) => withInFlightDedup(`comparison:${datasetId}`, async () => {
  await ensureTraining(datasetId, await getDataset(datasetId))
  const response = await client.get(`/mlops/${datasetId}/comparison`)
  return { data: response.data?.data || {} }
})

export const getRetraining = (datasetId) =>
  client.get(`/mlops/${datasetId}/retraining`).then(({ data }) => ({ data: data?.data || {} }))

export const triggerRetraining = (datasetId, body = {}) =>
  client.post(`/mlops/${datasetId}/retrain`, body).then(({ data }) => ({ data: data?.data || {} }))

export const getRealtimeSimulation = (datasetId, body = {}) =>
  client.post(`/mlops/${datasetId}/simulate`, body).then(({ data }) => ({
    data: unwrapEnvelopeData(data?.data?.simulation?.payload || data?.data?.simulation || {}),
  }))

export const getFairness = (datasetId) =>
  client.get(`/mlops/${datasetId}/fairness`).then(({ data }) => ({ data: data?.data || {} }))

export const getInsights = (datasetId, preferredProvider) =>
  client.post(`/mlops/${datasetId}/insights`, { preferredProvider }).then(({ data }) => ({
    data: data?.data || {},
  }))

export const getRemediation = (datasetId, preferredProvider) =>
  client.post(`/remediation/${datasetId}/recommend`, { preferredProvider }).then(({ data }) => ({
    data: unwrapEnvelopeData(data?.data?.remediation?.payload || data?.data?.remediation || {}),
  }))

export const getGovernanceDashboard = (datasetId, body = {}) =>
  client.post(`/governance/${datasetId}/dashboard`, body, { timeout: 180000 }).then(({ data }) => ({
    data: data?.data || {},
  }))

export const runAutoFix = (datasetId, body = {}) =>
  client.post(`/remediation/${datasetId}/autofix`, body).then(({ data }) => ({
    data: unwrapEnvelopeData(data?.data?.autoFix?.payload || data?.data?.autoFix || {}),
  }))

export const rollbackModel = (datasetId, body) =>
  client.post(`/model/${datasetId}/rollback`, body).then(({ data }) => ({ data: data?.data || {} }))

export const generateGovernanceInsights = (datasetId, preferredProvider) =>
  client.post(`/insights/${datasetId}/generate`, { preferredProvider }).then(({ data }) => ({
    data: data?.data || {},
  }))

export const downloadGovernanceReport = async (datasetId, format = 'json', preferredProvider) => {
  const response = await client.post(`/governance/${datasetId}/report?format=${format}`, { preferredProvider }, {
    responseType: 'blob',
  })
  return response.data
}

export const getDriftReport = (datasetId) => client.get(`/monitoring/${datasetId}/results`)
export const getBiasReport = (datasetId) => client.get(`/monitoring/${datasetId}/results`)
