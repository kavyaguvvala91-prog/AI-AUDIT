import React, { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Upload, BarChart2, Eye, Shield, Cpu } from 'lucide-react'

const HeroScene = lazy(() => import('../three/HeroScene.jsx'))

const features = [
  { icon: Upload, label: 'Upload Datasets', desc: 'Drag & drop CSV files for instant ingestion' },
  { icon: BarChart2, label: 'Deep Analysis', desc: 'Auto-detect features, types, distributions' },
  { icon: Cpu, label: 'ML Training', desc: 'Auto-select and train the best model' },
  { icon: Eye, label: 'Live Monitoring', desc: 'Track drift, anomalies, and confidence' },
  { icon: Shield, label: 'Bias Detection', desc: 'Audit AI fairness across feature groups' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-void text-text overflow-x-hidden">
      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 scan-line opacity-50" />

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between border-b border-border/50 bg-void/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full border border-accent/50 flex items-center justify-center">
            <Cpu size={12} className="text-accent" />
          </div>
          <span className="font-display text-sm font-bold text-accent tracking-widest">AI AUDIT</span>
        </div>
        <Link
          to="/upload"
          className="text-xs font-mono text-textDim hover:text-accent transition-colors border border-border hover:border-accent/40 px-3 py-1.5 rounded"
        >
          Launch App →
        </Link>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center">
        {/* 3D Canvas */}
        <div className="absolute inset-0 z-0">
          <Suspense fallback={<div className="w-full h-full bg-void" />}>
            <HeroScene />
          </Suspense>
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-void via-void/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 z-10 bg-gradient-to-t from-void to-transparent" />

        {/* Content */}
        <div className="relative z-20 px-8 md:px-16 max-w-2xl pt-20">
          <div className="mb-6 inline-flex items-center gap-2 border border-accent/30 bg-accent/5 text-accent text-xs font-mono px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Hackathon 2025 — AI Fairness Track
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight mb-4">
            <span className="text-text">AI Audit</span>
            <br />
            <span className="text-accent glow-text">Dashboard</span>
          </h1>

          <p className="text-textDim font-mono text-sm leading-relaxed mb-8 max-w-md">
            Upload any dataset. Train ML models automatically. Monitor for drift, bias, and anomalies in real time. Full transparency into your AI pipeline.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to="/upload"
              className="flex items-center gap-2 bg-accent text-void font-display font-bold text-sm px-6 py-3 rounded-md hover:bg-accent/90 transition-all shadow-glowStrong"
            >
              <Upload size={15} />
              Upload Dataset
            </Link>
            <Link
              to="/analysis"
              className="flex items-center gap-2 text-text font-mono text-sm px-6 py-3 rounded-md border border-border hover:border-accent/40 hover:text-accent transition-all"
            >
              View Demo
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-8 md:px-16 py-20">
        <div className="text-center mb-12">
          <span className="text-accent text-xs font-mono uppercase tracking-widest border border-accent/30 px-3 py-1 rounded-full">
            Core Capabilities
          </span>
          <h2 className="font-display text-3xl font-bold text-text mt-4">
            Everything you need to audit AI
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {features.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="bg-panel border border-border rounded-lg p-5 hover:border-accent/30 hover:shadow-glow transition-all group"
            >
              <div className="w-8 h-8 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                <Icon size={15} className="text-accent" />
              </div>
              <div className="font-display text-sm font-bold text-text mb-1">{label}</div>
              <div className="text-textDim text-xs font-mono leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-8 py-16 text-center border-t border-border">
        <p className="text-textDim font-mono text-xs mb-2">Ready to audit your model?</p>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 text-accent font-display font-bold hover:glow-text transition-all"
        >
          Get Started <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  )
}
