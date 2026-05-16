import client from './client.js'

/**
 * api/governance.js
 * ──────────────────
 * Centralized API calls for AI governance, remediation, auto-fix, and reporting features.
 * Provides clean abstractions for frontend components to interact with backend governance endpoints.
 */

/**
 * Get remediation assessment for a model/dataset
 * @param {string} datasetId - Dataset identifier
 * @param {object} monitoringContext - Current monitoring metrics
 * @param {object} qualityContext - Data quality scores
 * @param {object} trainingContext - Model training info
 * @param {string} preferredProvider - 'openai' | 'gemini'
 */
export const getRemediationAssessment = async (
  datasetId,
  monitoringContext = {},
  qualityContext = {},
  trainingContext = {},
  preferredProvider = null
) => {
  try {
    const response = await client.post('/advanced/remediation/recommend', {
      monitoring_context: monitoringContext,
      quality_context: qualityContext,
      training_context: trainingContext,
      preferred_provider: preferredProvider,
    })
    return {
      success: true,
      data: response.data?.data || {},
    }
  } catch (error) {
    console.error('Remediation assessment failed:', error)
    return {
      success: false,
      error: error.message,
      data: {},
    }
  }
}

/**
 * Execute auto-fix operations
 * @param {string} datasetId - Dataset identifier
 * @param {object} autoFixRequest - Contains file path, model ID, contexts, approval flag
 */
export const executeAutoFix = async (datasetId, autoFixRequest = {}) => {
  try {
    const response = await client.post('/advanced/remediation/autofix', {
      file_path: autoFixRequest.filePath,
      target_column: autoFixRequest.targetColumn,
      current_model_id: autoFixRequest.currentModelId,
      monitoring_context: autoFixRequest.monitoringContext || {},
      quality_context: autoFixRequest.qualityContext || {},
      training_context: autoFixRequest.trainingContext || {},
      approval_granted: autoFixRequest.approvalGranted || false,
      config: autoFixRequest.config || {},
    })
    return {
      success: true,
      data: response.data?.data || {},
    }
  } catch (error) {
    console.error('Auto-fix execution failed:', error)
    return {
      success: false,
      error: error.message,
      data: {},
    }
  }
}

/**
 * Generate a downloadable governance report
 * @param {string} datasetId - Dataset identifier
 * @param {string} format - 'pdf' | 'json'
 * @param {object} remediationContext - Results from remediation assessment
 * @param {string} preferredProvider - LLM provider preference
 */
export const downloadGovernanceReport = async (
  datasetId,
  format = 'json',
  remediationContext = {},
  preferredProvider = null
) => {
  try {
    const response = await client.post(
      `/advanced/governance/report?format=${format}`,
      {
        monitoring_context: remediationContext.monitoring_context || {},
        quality_context: remediationContext.quality_context || {},
        explanation_context: remediationContext.explanation_context || {},
        training_context: remediationContext.training_context || {},
        preferred_provider: preferredProvider,
      },
      {
        responseType: 'blob',
      }
    )

    // Trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `governance-report-${new Date().toISOString().split('T')[0]}.${format}`)
    document.body.appendChild(link)
    link.click()
    link.parentElement.removeChild(link)

    return {
      success: true,
      message: `Report downloaded as ${format.toUpperCase()}`,
    }
  } catch (error) {
    console.error('Report download failed:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Generate AI insights using LLM
 * @param {object} context - Comprehensive context about model, monitoring, quality
 * @param {string} preferredProvider - LLM provider preference
 */
export const generateGovernanceInsights = async (context = {}, preferredProvider = null) => {
  try {
    const response = await client.post('/advanced/insights/generate', {
      context,
      preferred_provider: preferredProvider,
    })
    return {
      success: true,
      data: response.data?.data || {},
    }
  } catch (error) {
    console.error('Insight generation failed:', error)
    return {
      success: false,
      error: error.message,
      data: {},
    }
  }
}

/**
 * Retrain the model
 * @param {string} datasetId - Dataset identifier
 * @param {object} retrainRequest - Contains file path, target column, drift info
 */
export const retrainModel = async (datasetId, retrainRequest = {}) => {
  try {
    const response = await client.post('/advanced/model/retrain', {
      file_path: retrainRequest.filePath,
      target_column: retrainRequest.targetColumn,
      current_model_id: retrainRequest.currentModelId,
      drift_score: retrainRequest.driftScore,
      config: retrainRequest.config || {},
    })
    return {
      success: true,
      data: response.data?.data || {},
    }
  } catch (error) {
    console.error('Retraining failed:', error)
    return {
      success: false,
      error: error.message,
      data: {},
    }
  }
}

/**
 * Rollback to a previous model version
 * @param {string} targetModelId - Model ID to rollback to
 * @param {string} targetVersion - Optional specific version
 */
export const rollbackModel = async (targetModelId, targetVersion = null) => {
  try {
    const response = await client.post('/advanced/model/rollback', {
      target_model_id: targetModelId,
      target_version: targetVersion,
    })
    return {
      success: true,
      data: response.data?.data || {},
    }
  } catch (error) {
    console.error('Rollback failed:', error)
    return {
      success: false,
      error: error.message,
      data: {},
    }
  }
}

/**
 * Get data quality assessment
 * @param {string} filePath - Path to CSV file
 */
export const getDataQuality = async (filePath) => {
  try {
    const response = await client.get(`/advanced/quality?file_path=${encodeURIComponent(filePath)}`)
    return {
      success: true,
      data: response.data?.data || {},
    }
  } catch (error) {
    console.error('Quality assessment failed:', error)
    return {
      success: false,
      error: error.message,
      data: {},
    }
  }
}

/**
 * Build governance context from monitoring and quality data
 * @param {object} monitoring - Drift, bias, anomaly data
 * @param {object} quality - Quality assessment results
 * @param {object} training - Training metrics and model info
 */
export const buildGovernanceContext = (monitoring = {}, quality = {}, training = {}) => {
  return {
    monitoring_context: {
      drift: monitoring.drift || {},
      bias: monitoring.bias || {},
      anomaly: monitoring.anomaly || {},
      confidence_summary: monitoring.confidence || {},
    },
    quality_context: quality || {},
    training_context: training || {},
  }
}

/**
 * Export governance data for external use
 * @param {object} governanceReport - Report object
 * @param {string} format - 'json' | 'csv'
 */
export const exportGovernanceData = (governanceReport, format = 'json') => {
  const data = format === 'json' ? JSON.stringify(governanceReport, null, 2) : convertToCSV(governanceReport)

  const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `governance-export.${format}`)
  document.body.appendChild(link)
  link.click()
  link.parentElement.removeChild(link)
}

/**
 * Helper: Convert governance report to CSV format
 */
function convertToCSV(report) {
  const rows = [['Finding', 'Severity', 'Risk Score', 'Recommended Action']]

  const findings = report?.findings || []
  findings.forEach((finding) => {
    rows.push([
      finding.title,
      finding.severity,
      finding.risk_score,
      finding.recommended_action,
    ])
  })

  return rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
}
