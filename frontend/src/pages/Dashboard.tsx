import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../hooks/useAuth'
import { useInventoryData } from '../hooks/useInventoryData'
import { computeDashboard } from '../utils/dashboardStats'
import { findLowStock } from '../utils/lowStock'

interface Feature {
  title: string
  description: string
  icon: ReactNode
  to: string
  adminOnly?: boolean
}

const iconProps = {
  viewBox: '0 0 24 24',
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const features: Feature[] = [
  {
    title: 'Find Stock',
    description: 'Out of stock locally? Find the nearest warehouse that has it.',
    to: '/lookup',
    icon: (<svg {...iconProps}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>),
  },
  {
    title: 'SDG Impact',
    description: 'Your numbers against SDG 3, 9 and 12, with a CSV report.',
    to: '/impact',
    icon: (<svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 4" /></svg>),
  },
  {
    title: 'Waste Alerts',
    description: 'Batches close to expiry, with transfer suggestions.',
    to: '/alerts',
    icon: (<svg {...iconProps}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>),
  },
  {
    title: '3D Packing View',
    description: 'See how cartons fit inside a warehouse room, in 3D.',
    to: '/packing',
    icon: (<svg {...iconProps}><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 22V12M3 7l9 5 9-5" /></svg>),
  },
  {
    title: 'Stock Batches',
    description: 'Cartons per warehouse with batch numbers and expiry dates.',
    to: '/stock',
    icon: (<svg {...iconProps}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>),
  },
  {
    title: 'Medicine Catalogue',
    description: 'Medicines with carton size, weight and handling rules.',
    to: '/medicines',
    icon: (<svg {...iconProps}><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3.3 7.5L12 12l8.7-4.5" /><path d="M12 22V12" /></svg>),
  },
  {
    title: 'Warehouses',
    description: 'Warehouse locations on a map, with room dimensions.',
    to: '/warehouses',
    icon: (<svg {...iconProps}><path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21V12h6v9" /></svg>),
  },
  {
    title: 'Import from Excel',
    description: 'Upload an .xlsx or .csv of medicines or stock.',
    to: '/import',
    adminOnly: true,
    icon: (<svg {...iconProps}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>),
  },
]

// A horizontal bar with its value written next to it (so it is not colour-only).
function Bar({ label, valueText, percent, color }: { label: string; valueText: string; percent: number; color: string }) {
  return (
    <div className="bar-row">
      <div className="bar-label">
        <span>{label}</span>
        <span className="bar-value">{valueText}</span>
      </div>
      <div className="bar-track" role="img" aria-label={`${label}: ${valueText}`}>
        <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color }} />
      </div>
    </div>
  )
}

export function Dashboard() {
  const { user, role } = useAuth()
  const { warehouses, medicines, stock, loading, error } = useInventoryData()

  const stats = useMemo(() => computeDashboard(warehouses, medicines, stock), [warehouses, medicines, stock])
  const lowStockCount = useMemo(() => findLowStock(medicines, stock).length, [medicines, stock])

  const displayName = user?.displayName?.trim()
  const firstName = displayName ? displayName.split(' ')[0] : ''
  const expiryTotal = stats.expiry.expired + stats.expiry.d30 + stats.expiry.d90 + stats.expiry.ok
  const share = (value: number) => (expiryTotal === 0 ? 0 : (value / expiryTotal) * 100)

  return (
    <AppShell>
      <section className="dash-hero">
        <div>
          <p className="eyebrow">{role === 'admin' ? 'Admin dashboard' : 'Dashboard'}</p>
          <h1>{firstName ? `Welcome, ${firstName}` : 'Welcome'}</h1>
          <p className="dash-email">
            Signed in as <strong>{user?.email ?? 'unknown email'}</strong>
          </p>
          <p className="dash-lead">
            SmartSpace tracks medicines across multiple warehouses, shows the nearest store with stock when yours
            runs out, and flags batches close to expiry to reduce waste (SDG 3 and SDG 12).
          </p>
          <span className="badge badge-success">{role === 'admin' ? 'Admin account' : 'User account'}</span>
        </div>
      </section>

      {error && <div className="alert alert-error" role="alert">Could not load data: {error}</div>}

      <section aria-labelledby="overview-heading">
        <div className="section-head">
          <h2 id="overview-heading">Overview</h2>
          <p>Live numbers from your warehouses and stock.</p>
        </div>

        {loading ? (
          <p className="warehouse-meta" role="status">Loading numbers…</p>
        ) : (
          <>
            <div className="stat-grid stat-grid-4">
              <div className="stat"><span className="stat-value">{warehouses.length}</span><span className="stat-label">warehouses</span></div>
              <div className="stat"><span className="stat-value">{medicines.length}</span><span className="stat-label">medicines in the catalogue</span></div>
              <div className="stat">
                <span className="stat-value">{stats.totalCartons.toLocaleString()}</span>
                <span className="stat-label">cartons in stock ({stats.totalUnits.toLocaleString()} units)</span>
              </div>
              <div className="stat">
                <span className="stat-value">{stats.averageUtilizationPct === null ? '—' : `${stats.averageUtilizationPct.toFixed(1)}%`}</span>
                <span className="stat-label">average room space used</span>
              </div>
            </div>

            <div className="chart-grid">
              <div className="panel">
                <h2>Space used per warehouse</h2>
                {stats.perWarehouse.length === 0 ? (
                  <p className="warehouse-meta">No warehouses yet.</p>
                ) : (
                  stats.perWarehouse.map((item) => (
                    <Bar
                      key={item.id}
                      label={item.name}
                      valueText={item.utilizationPct === null ? 'room size not set' : `${item.utilizationPct.toFixed(1)}%${item.unplaced > 0 ? ` · ${item.unplaced} cartons do not fit` : ''}`}
                      percent={item.utilizationPct ?? 0}
                      color="#10b981"
                    />
                  ))
                )}
              </div>

              <div className="panel">
                <h2>Stock by shelf life</h2>
                {expiryTotal === 0 ? (
                  <p className="warehouse-meta">No stock yet.</p>
                ) : (
                  <>
                    <div className="stack-bar" role="img" aria-label="Share of cartons by remaining shelf life">
                      <span style={{ width: `${share(stats.expiry.expired)}%`, background: '#b42318' }} />
                      <span style={{ width: `${share(stats.expiry.d30)}%`, background: '#ef4444' }} />
                      <span style={{ width: `${share(stats.expiry.d90)}%`, background: '#f59e0b' }} />
                      <span style={{ width: `${share(stats.expiry.ok)}%`, background: '#10b981' }} />
                    </div>
                    <ul className="legend legend-col">
                      <li><span className="legend-dot" style={{ background: '#b42318' }} />Expired: {stats.expiry.expired.toLocaleString()} cartons</li>
                      <li><span className="legend-dot" style={{ background: '#ef4444' }} />Within 30 days: {stats.expiry.d30.toLocaleString()}</li>
                      <li><span className="legend-dot" style={{ background: '#f59e0b' }} />31 to 90 days: {stats.expiry.d90.toLocaleString()}</li>
                      <li><span className="legend-dot" style={{ background: '#10b981' }} />More than 90 days: {stats.expiry.ok.toLocaleString()}</li>
                    </ul>
                    {stats.atRiskBatches > 0 && (
                      <p className="map-hint"><Link to="/alerts">{stats.atRiskBatches} batch{stats.atRiskBatches === 1 ? '' : 'es'} need attention →</Link></p>
                    )}
                    {lowStockCount > 0 && (
                      <p className="map-hint"><Link to="/alerts">{lowStockCount} medicine{lowStockCount === 1 ? ' is' : 's are'} low on stock →</Link></p>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="features-heading">
        <div className="section-head">
          <h2 id="features-heading">Modules</h2>
        </div>
        <div className="feature-grid">
          {features
            .filter((feature) => !feature.adminOnly || role === 'admin')
            .map((feature) => (
              <article key={feature.title} className="feature-card feature-ready">
                <span className="feature-icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <Link to={feature.to} className="btn btn-outline btn-inline btn-sm">Open</Link>
              </article>
            ))}
        </div>
      </section>
    </AppShell>
  )
}
