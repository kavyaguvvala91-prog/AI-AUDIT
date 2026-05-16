import React from 'react'
import { BookOpen, Lightbulb, Info } from 'lucide-react'

/**
 * GovernanceInsightsPanel.jsx
 * ───────────────────────────
 * Displays LLM-generated governance insights and explanations.
 * Shows human-readable summaries of AI risks, fairness issues, drift, and recommendations.
 */
export default function GovernanceInsightsPanel({ narrative = '', provider = 'openai', model = 'gpt-4' }) {
  const displayText = narrative || `
    This is a placeholder insight summary. In production, this section displays AI-generated governance recommendations.
    
    Key Areas Analyzed:
    • Model Health: Overall performance metrics and stability
    • Data Drift: Changes in input distribution compared to baseline
    • Fairness & Bias: Disparities across protected groups
    • Confidence: Prediction certainty and reliability
    • Anomalies: Out-of-distribution samples
    
    Recommended Actions:
    1. Monitor the identified drift patterns
    2. Validate model performance on fresh data
    3. Consider retraining if drift exceeds thresholds
    4. Review fairness metrics across all segments
  `

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-bold text-gray-900">AI Governance Insights</h3>
            <p className="text-xs text-gray-600 mt-1">
              Powered by {provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} • {model}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full">
          <Info className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-medium text-blue-700">LLM-Generated</span>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border border-blue-100">
        <div className="prose prose-sm max-w-none">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {displayText}
          </p>
        </div>
      </div>

      {/* Key Takeaways */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Drift Analysis */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-xs font-bold text-yellow-900 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
            Data Drift Alert
          </h4>
          <p className="text-xs text-yellow-800">
            Detected changes in feature distribution. Monitor retraining triggers.
          </p>
        </div>

        {/* Fairness Analysis */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="text-xs font-bold text-purple-900 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
            Fairness Assessment
          </h4>
          <p className="text-xs text-purple-800">
            Review outcome disparities across protected groups. Consider rebalancing.
          </p>
        </div>

        {/* Confidence Analysis */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
            Model Confidence
          </h4>
          <p className="text-xs text-blue-800">
            Average confidence is stable. Consider escalation thresholds.
          </p>
        </div>

        {/* Recommendation Priority */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-xs font-bold text-green-900 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-600 rounded-full"></span>
            Priority Actions
          </h4>
          <p className="text-xs text-green-800">
            1) Validate drift 2) Review fairness 3) Consider retraining
          </p>
        </div>
      </div>

      {/* Model Attribution */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <BookOpen className="w-4 h-4" />
          <span>
            Insights generated using {provider === 'gemini' ? 'Google Gemini AI' : 'OpenAI GPT'} with fallback to
            rule-based analysis if unavailable.
          </span>
        </div>
      </div>
    </div>
  )
}
