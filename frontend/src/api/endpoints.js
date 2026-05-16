import client from './client.js'

const inFlightRequests = new Map()

const withInFlightDedup = (key, factory) => {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)
  }

  const request = Promise.resolve()
    .then(factory)
    .finally(() => {
      inFlightRequests.delete(key)
    })

  inFlightRequests.set(key, request)
  return request
}

const unwrapEnvelopeData = (payload = {}) => payload?.data || payload || {}

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
    shape: {
      rows: body.row_count || 0,
      cols: body.column_count || 0,
    },
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
    auc_roc: metrics.accuracy ?? 0,
    training_time_s: 0,
    history: [],
    confusion_matrix: null,
    feature_importance: metrics.feature_importance || {},
    problem_type: metrics.problem_type || 'unknown',
    target_column: body.target_column || null,
  }
}

const buildConfidenceDistribution = (predictions = []) => {
  const buckets = [
    { range: '0.5-0.6', min: 0.5, max: 0.6, count: 0 },
    { range: '0.6-0.7', min: 0.6, max: 0.7, count: 0 },
    { range: '0.7-0.8', min: 0.7, max: 0.8, count: 0 },
    { range: '0.8-0.9', min: 0.8, max: 0.9, count: 0 },
    { range: '0.9-1.0', min: 0.9, max: 1.000001, count: 0 },
  ]

  predictions.forEach((row) => {
    const score = row?.confidence
    if (typeof score !== 'number') return
    const bucket = buckets.find((item) => score >= item.min && score < item.max)
    if (bucket) {
      bucket.count += 1
    }
  })

  return buckets.map(({ range, count }) => ({ range, count }))
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
  }))

  const biasFeatures = Object.entries(biasPayload.group_metrics || {})
    .filter(([, value]) => value?._bias_flagged)
    .map(([key]) => key)

  return {
    drift_score: driftPayload.drift_score ?? 0,
    anomaly_count: anomalyPayload.total_anomalies ?? 0,
    anomaly_rate: anomalyPayload.anomaly_rate ?? 0,
    confidence_mean: Number(confidenceMean.toFixed(4)),
    confidence_std: Number(Math.sqrt(confidenceVariance).toFixed(4)),
    bias_score: biasPayload.bias_detected ? 0.1 : 0,
    bias_features: biasFeatures,
    feature_importance,
    drift_history: driftPayload.drift_score != null
      ? [{ day: 'Current', score: driftPayload.drift_score }]
      : [],
    confidence_dist: buildConfidenceDistribution(predictionRows),
  }
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

export const getAnalysis = (datasetId) =>
  withInFlightDedup(`analysis:${datasetId}`, () =>
    client.post(`/analysis/${datasetId}/run`).then(({ data }) => ({
      data: buildAnalysisPayload(data?.data?.analysis?.payload || {}),
    }))
  )

export const getDatasetList = () => client.get('/datasets')

export const getMetrics = async (datasetId) => {
  return withInFlightDedup(`metrics:${datasetId}`, async () => {
    const datasetResponse = await client.get(`/datasets/${datasetId}`)
    const dataset = datasetResponse.data?.data
    const existingPayload = dataset?.automl?.payload

    if (existingPayload && hasUsableMetrics(existingPayload)) {
      return { data: buildMetricsPayload(existingPayload) }
    }

    const analysisPayload = unwrapEnvelopeData(dataset?.analysis?.payload || {})

    const targetColumn =
      dataset?.targetColumn ||
      analysisPayload.suggested_target ||
      dataset?.columns?.[dataset.columns.length - 1]

    const trainingResponse = await client.post(`/analysis/${datasetId}/automl`, {
      targetColumn,
      config: {},
    })

    return {
      data: buildMetricsPayload(trainingResponse.data?.data?.automl?.payload || {}),
    }
  })
}

export const trainModel = (datasetId, config) =>
  client.post(`/analysis/${datasetId}/automl`, config)

export const getMonitoring = async (datasetId) => {
  return withInFlightDedup(`monitoring:${datasetId}`, async () => {
    const datasetResponse = await client.get(`/datasets/${datasetId}`)
    const dataset = datasetResponse.data?.data || {}
    const automlPayload = unwrapEnvelopeData(dataset?.automl?.payload || {})
    const modelId = automlPayload.model_id || localStorage.getItem('currentModelId')

    const jobs = []

    if (!dataset?.predictions?.payload && modelId) {
      jobs.push(
        client.post(`/analysis/${datasetId}/predict`, {
          modelId,
        })
      )
    }

    if (!dataset?.anomaly?.payload) {
      jobs.push(
        client.post(`/monitoring/${datasetId}/anomaly`, {})
      )
    }

    await Promise.all(jobs)

    const monitoringResponse = await client.get(`/monitoring/${datasetId}/results`)

    return {
      data: buildMonitoringPayload(
        monitoringResponse.data?.data || {},
        dataset,
      ),
    }
  })
}

export const getDriftReport = (datasetId) =>
  client.get(`/monitoring/${datasetId}/results`)

export const getBiasReport = (datasetId) =>
  client.get(`/monitoring/${datasetId}/results`)
