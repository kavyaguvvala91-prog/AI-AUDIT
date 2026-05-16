import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, X, ArrowRight, Sparkles } from 'lucide-react'
import Alert from '../components/Alert.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import { launchDemoGovernance, uploadDataset } from '../api/endpoints.js'

const ACCEPTED = '.csv,text/csv'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState(null) // { type, message }
  const [pendingAction, setPendingAction] = useState('upload')
  const inputRef = useRef()
  const navigate = useNavigate()

  const validate = (f) => {
    if (!f) return 'No file selected.'
    if (!f.name.endsWith('.csv')) return 'Only CSV files are supported.'
    if (f.size > 100 * 1024 * 1024) return 'File must be under 100 MB.'
    return null
  }

  const handleFile = (f) => {
    const err = validate(f)
    if (err) { setStatus({ type: 'error', message: err }); return }
    setFile(f)
    setStatus(null)
    setProgress(0)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const handleUpload = async () => {
    if (!file) return
    setPendingAction('upload')
    setUploading(true)
    setProgress(0)
    setStatus(null)
    try {
      const response = await uploadDataset(file, setProgress)
      const dataset = response?.data?.data
      if (dataset?._id) {
        localStorage.setItem('currentDatasetId', dataset._id)
      }
      localStorage.removeItem('currentReferenceDatasetId')
      if (dataset?.targetColumn) {
        localStorage.setItem('currentTargetColumn', dataset.targetColumn)
      } else {
        localStorage.removeItem('currentTargetColumn')
      }
      localStorage.removeItem('currentModelId')
      setProgress(100)
      setStatus({ type: 'success', message: `"${file.name}" uploaded successfully. Redirecting to analysis...` })
      setTimeout(() => navigate('/analysis'), 1800)
    } catch (err) {
      setStatus({
        type: 'error',
        message: err?.response?.data?.message || 'Upload failed. Please check the backend services and try again.',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDemoLaunch = async () => {
    setPendingAction('demo')
    setUploading(true)
    setProgress(15)
    setStatus({ type: 'success', message: 'Preparing the built-in loan prediction demo...' })

    try {
      const response = await launchDemoGovernance()
      const demo = response?.data || {}

      if (demo.currentDatasetId) {
        localStorage.setItem('currentDatasetId', demo.currentDatasetId)
      }
      if (demo.referenceDatasetId) {
        localStorage.setItem('currentReferenceDatasetId', demo.referenceDatasetId)
      }
      if (demo.targetColumn) {
        localStorage.setItem('currentTargetColumn', demo.targetColumn)
      }
      if (demo.currentModelId) {
        localStorage.setItem('currentModelId', demo.currentModelId)
      }

      setFile(null)
      setProgress(100)
      setStatus({
        type: 'success',
        message: 'Loan prediction demo is ready. Opening the governance dashboard...',
      })
      setTimeout(() => navigate('/governance'), 1200)
    } catch (err) {
      setStatus({
        type: 'error',
        message: err?.response?.data?.message || 'Demo dataset launch failed. Please check the backend services and try again.',
      })
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const reset = () => { setFile(null); setStatus(null); setProgress(0) }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <SectionHeader
        tag="Step 01"
        title="Upload Dataset"
        subtitle="Provide a CSV file to begin the AI audit pipeline"
      />

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-accent bg-accent/5 shadow-glow'
            : file
            ? 'border-success/40 bg-success/5'
            : 'border-border bg-panel hover:border-accentDim hover:bg-accent/5'
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !file && inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-success/10 border border-success/30 flex items-center justify-center">
              <FileText size={24} className="text-success" />
            </div>
            <div>
              <p className="font-display font-bold text-text">{file.name}</p>
              <p className="text-textDim text-xs font-mono mt-1">
                {(file.size / 1024).toFixed(1)} KB — CSV
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); reset() }}
              className="text-xs text-textDim hover:text-danger font-mono flex items-center gap-1 transition-colors"
            >
              <X size={12} /> Remove file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${dragging ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`}>
              <Upload size={22} className={dragging ? 'text-accent' : 'text-muted'} />
            </div>
            <div>
              <p className="font-display font-bold text-text text-sm">
                {dragging ? 'Drop your CSV here' : 'Drag & drop or click to browse'}
              </p>
              <p className="text-textDim text-xs font-mono mt-1">Supports .csv files up to 100 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      {uploading && (
        <div className="mt-4 space-y-2">
          <ProgressBar value={progress} max={100} label={pendingAction === 'demo' ? 'Preparing demo...' : 'Uploading...'} showPct />
        </div>
      )}

      {/* Status Alert */}
      {status && (
        <div className="mt-4">
          <Alert type={status.type} message={status.message} onClose={() => setStatus(null)} />
        </div>
      )}

      <div className="mt-6 space-y-4">
        {file && !uploading && !status && (
          <button
            onClick={handleUpload}
            className="w-full flex items-center justify-center gap-2 bg-accent text-void font-display font-bold py-3 rounded-lg hover:bg-accent/90 transition-all shadow-glow"
          >
            <Upload size={16} />
            Begin Upload & Analysis
            <ArrowRight size={16} />
          </button>
        )}

        {!uploading && (
          <div className="rounded-xl border border-border bg-panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-display text-textDim uppercase tracking-widest">Demo Dataset</p>
                <h3 className="mt-2 font-display text-lg text-text">Try Demo Loan Dataset</h3>
                <p className="mt-2 text-sm text-textDim">
                  Load a built-in loan approval scenario with bias, drift, confidence, and governance insights already wired into the dashboard.
                </p>
              </div>
              <div className="w-11 h-11 rounded-full border border-accent/30 bg-accent/10 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-accent" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {['Loan approval predictions', 'Gender fairness signals', 'Income drift scenario', 'Governance-ready charts'].map((item) => (
                <span key={item} className="text-[11px] font-mono px-2 py-1 rounded-full bg-surface border border-border text-textDim">
                  {item}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDemoLaunch}
              className="mt-5 w-full flex items-center justify-center gap-2 border border-accent/30 bg-accent/10 text-accent font-display font-bold py-3 rounded-lg hover:bg-accent/15 transition-all"
            >
              <Sparkles size={16} />
              Try Demo Loan Dataset
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Hints */}
      <div className="mt-8 bg-panel border border-border rounded-lg p-5 space-y-2">
        <p className="text-xs font-display text-textDim uppercase tracking-widest mb-3">Requirements</p>
        {[
          'First row must be column headers',
          'Target column auto-detected or specify in settings',
          'Numeric and categorical columns handled automatically',
          'Missing values imputed during preprocessing',
        ].map((t, i) => (
          <div key={i} className="flex items-start gap-2 text-xs font-mono text-textDim">
            <span className="text-accent mt-0.5">›</span>
            {t}
          </div>
        ))}
      </div>
    </div>
  )
}
