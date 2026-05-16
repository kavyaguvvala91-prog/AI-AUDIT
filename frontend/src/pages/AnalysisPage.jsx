import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'
import { Database, Layers, AlertCircle, Target } from 'lucide-react'
import SectionHeader from '../components/SectionHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import Badge from '../components/Badge.jsx'
import ChartPanel from '../charts/ChartPanel.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { axisStyle, gridStyle, tooltipStyle, PALETTE, COLORS } from '../charts/theme.js'
import { mockAnalysis } from '../utils/mock.js'
import { getAnalysis } from '../api/endpoints.js'
import { formatNum } from '../utils/format.js'

export default function AnalysisPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const datasetId = localStorage.getItem('currentDatasetId')
    if (!datasetId) {
      setData(mockAnalysis)
      setLoading(false)
      return
    }

    getAnalysis(datasetId)
      .then((response) => {
        const payload = response.data
        if (payload?.target_column && payload.target_column !== 'Not detected') {
          localStorage.setItem('currentTargetColumn', payload.target_column)
        }
        setData(payload)
      })
      .catch(() => setData(mockAnalysis))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Loading dataset analysis..." />

  const missingData = Object.entries(data.missing_values || {})
    .map(([col, count]) => ({ col, count }))
    .filter((item) => item.count > 0)

  const classData = Object.entries(data.class_distribution || {})
    .map(([name, value]) => ({ name, value }))

  const hasMonthlyTrend = Array.isArray(data.monthly_trend) && data.monthly_trend.length > 0

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        tag="Step 02"
        title="Dataset Analysis"
        subtitle={`Inspecting: ${data.filename} - auto-detected ${data.problem_type}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Rows" value={formatNum(data.shape.rows)} icon={Database} accent />
        <StatCard label="Columns" value={data.shape.cols} icon={Layers} />
        <StatCard label="Numeric Features" value={data.numeric_columns.length} />
        <StatCard label="Categorical Features" value={data.categorical_columns.length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-panel border border-border rounded-lg p-4">
          <p className="text-xs text-textDim font-mono uppercase tracking-widest mb-3">Target Column</p>
          <div className="flex items-center gap-2">
            <Target size={14} className="text-accent" />
            <span className="font-display font-bold text-accent">{data.target_column}</span>
          </div>
          <p className="text-xs text-textDim font-mono mt-2">{data.problem_type}</p>
        </div>

        <div className="bg-panel border border-border rounded-lg p-4 col-span-2">
          <p className="text-xs text-textDim font-mono uppercase tracking-widest mb-3">Numeric Columns</p>
          <div className="flex flex-wrap gap-2">
            {data.numeric_columns.map((column) => (
              <Badge key={column} variant="accent">{column}</Badge>
            ))}
          </div>

          <p className="text-xs text-textDim font-mono uppercase tracking-widest mb-2 mt-3">Categorical Columns</p>
          <div className="flex flex-wrap gap-2">
            {data.categorical_columns.map((column) => (
              <Badge key={column}>{column}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPanel title="Class Distribution - Bar">
          <BarChart data={classData}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="name" {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" fill={COLORS.accent} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartPanel>

        <ChartPanel title="Class Distribution - Pie">
          <PieChart>
            <Pie
              data={classData}
              cx="50%"
              cy="50%"
              outerRadius={90}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {classData.map((_, index) => (
                <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartPanel title="Monthly Record Trend - Line">
          {hasMonthlyTrend ? (
            <LineChart data={data.monthly_trend}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="month" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke={COLORS.accent} strokeWidth={2} dot={{ fill: COLORS.accent, r: 3 }} />
            </LineChart>
          ) : (
            <div className="flex items-center justify-center h-full text-center px-6">
              <div>
                <AlertCircle size={20} className="text-textDim mx-auto mb-2" />
                <p className="text-textDim text-xs font-mono">
                  Monthly trend is unavailable because the current dataset analysis does not include date-based trend data.
                </p>
              </div>
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="Missing Values per Column">
          {missingData.length > 0 ? (
            <BarChart data={missingData}>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="col" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill={COLORS.warning} radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle size={20} className="text-success mx-auto mb-2" />
                <p className="text-success text-xs font-mono">No missing values detected</p>
              </div>
            </div>
          )}
        </ChartPanel>
      </div>

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className="w-1 h-3 bg-accent rounded-full" />
          <span className="text-xs font-mono text-textDim uppercase tracking-widest">Numeric Column Statistics</span>
        </div>

        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border text-textDim">
              {['Column', 'Mean', 'Std Dev', 'Min', 'Max'].map((heading) => (
                <th key={heading} className="text-left px-4 py-2">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.column_stats || []).map((row, index) => (
              <tr key={index} className="border-b border-border/50 hover:bg-border/30 transition-colors">
                <td className="px-4 py-2 text-accent">{row.name}</td>
                <td className="px-4 py-2 text-text">{row.mean?.toFixed?.(2)}</td>
                <td className="px-4 py-2 text-text">{row.std?.toFixed?.(2)}</td>
                <td className="px-4 py-2 text-textDim">{row.min}</td>
                <td className="px-4 py-2 text-textDim">{row.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
