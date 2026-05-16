import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Bell, Settings, ChevronRight } from 'lucide-react'

const breadcrumbs = {
  '/': ['Overview'],
  '/upload': ['Upload', 'Dataset'],
  '/analysis': ['Analysis', 'Dashboard'],
  '/metrics': ['Model', 'Metrics'],
  '/monitoring': ['AI', 'Monitoring'],
  '/governance': ['Executive', 'Governance'],
}

export default function Navbar() {
  const { pathname } = useLocation()
  const crumbs = breadcrumbs[pathname] || ['Dashboard']
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="h-14 bg-surface border-b border-border px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs font-mono text-textDim">
        <span className="text-muted">~/</span>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={10} className="text-muted" />}
            <span className={i === crumbs.length - 1 ? 'text-text' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted font-mono">{now}</span>
        <button className="text-textDim hover:text-text transition-colors">
          <Bell size={15} />
        </button>
        <button className="text-textDim hover:text-text transition-colors">
          <Settings size={15} />
        </button>
        <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent text-xs font-display">
          A
        </div>
      </div>
    </header>
  )
}
