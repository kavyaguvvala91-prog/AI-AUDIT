import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

/**
 * FairnessHeatmap.jsx
 * ───────────────────
 * Visualizes fairness metrics across protected groups and sensitive attributes.
 * Displays parity gaps and positive outcome rates as a heatmap-style chart.
 */
export default function FairnessHeatmap({ fairnessData = [] }) {
  const processedData = useMemo(() => {
    if (!fairnessData || fairnessData.length === 0) {
      return [
        { group: 'Group A', attribute: 'Gender', parityGap: 0.08, severity: 'low', positiveRate: 0.85 },
        { group: 'Group B', attribute: 'Gender', parityGap: 0.02, severity: 'low', positiveRate: 0.92 },
        { group: 'Group C', attribute: 'Age', parityGap: 0.15, severity: 'medium', positiveRate: 0.78 },
        { group: 'Group D', attribute: 'Age', parityGap: 0.05, severity: 'low', positiveRate: 0.88 },
      ]
    }
    return fairnessData.map((item) => ({
      ...item,
      label: `${item.group} (${item.attribute})`,
    }))
  }, [fairnessData])

  const severityColor = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  }

  const sortedByGap = [...processedData].sort((a, b) => b.parityGap - a.parityGap)

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">Fairness Analysis by Group</h3>
        <p className="text-sm text-gray-600 mt-1">
          Parity Gap measures disparity in positive outcomes across protected groups. Lower is better.
        </p>
      </div>

      {/* Chart */}
      <div className="mb-6 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedByGap} layout="vertical" margin={{ top: 5, right: 30, left: 200, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" domain={[0, 0.3]} stroke="#6b7280" />
            <YAxis dataKey="label" type="category" width={200} tick={{ fontSize: 12 }} stroke="#6b7280" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
              formatter={(value) => (
                <span className="text-xs">
                  {typeof value === 'number' ? value.toFixed(4) : value}
                </span>
              )}
            />
            <Bar dataKey="parityGap" fill="#8884d8" radius={[0, 8, 8, 0]}>
              {sortedByGap.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={severityColor[entry.severity] || '#8884d8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Severity Legend */}
      <div className="grid grid-cols-3 gap-4 mb-6 pt-6 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-xs font-medium text-gray-700">Low Risk (Gap &lt; 0.10)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-xs font-medium text-gray-700">Medium Risk (Gap 0.10-0.20)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-xs font-medium text-gray-700">High Risk (Gap &gt; 0.20)</span>
        </div>
      </div>

      {/* Detailed Metrics Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-900">Protected Group</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-900">Parity Gap</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-900">Positive Rate</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-900">Severity</th>
            </tr>
          </thead>
          <tbody>
            {sortedByGap.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-3 text-gray-900 font-medium">
                  {row.group}{' '}
                  <span className="text-gray-600">({row.attribute})</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-shrink-0 w-8 h-4 rounded-sm"
                      style={{ backgroundColor: severityColor[row.severity] || '#8884d8' }}
                    ></div>
                    <span className="text-gray-900 font-mono">{row.parityGap.toFixed(4)}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-700">
                  {(row.positiveRate * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold 
                    ${row.severity === 'low' ? 'bg-green-100 text-green-800' : ''}
                    ${row.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${row.severity === 'high' ? 'bg-red-100 text-red-800' : ''}
                  `}>
                    {row.severity.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
