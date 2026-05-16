import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Upload,
  BarChart2,
  Activity,
  Eye,
  Home,
  Cpu,
  Siren,
} from 'lucide-react'

const links = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/analysis', icon: BarChart2, label: 'Analysis' },
  { to: '/metrics', icon: Activity, label: 'Metrics' },
  { to: '/monitoring', icon: Eye, label: 'Monitoring' },
  { to: '/governance', icon: Siren, label: 'Governance' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-accent/50 flex items-center justify-center bg-accent/5">
            <Cpu size={14} className="text-accent" />
          </div>
          <div>
            <div className="text-xs font-display font-bold text-accent tracking-wide">AI AUDIT</div>
            <div className="text-[10px] text-textDim font-mono">SELF-MONITORING PLATFORM</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted">
          Demo Flow
        </div>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-mono transition-all duration-150 group ${
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-textDim hover:text-text hover:bg-border/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={14} className={isActive ? 'text-accent' : 'text-muted group-hover:text-textDim'} />
                {label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <div className="text-[10px] text-muted font-mono">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-slow" />
            Hackathon Demo Ready
          </div>
          <div>Curated flow: upload to governance</div>
        </div>
      </div>
    </aside>
  )
}
