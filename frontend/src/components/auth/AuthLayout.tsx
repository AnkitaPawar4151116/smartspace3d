import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { RoomIllustration } from './RoomIllustration'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

const highlights = [
  'See medicine stock across every warehouse',
  'Find the nearest store when yours is out of stock',
  'Use near-expiry batches first to cut waste',
]

// Two-column layout shared by login, register and forgot-password:
// brand panel on the left (hidden on small screens), form card on the right.
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <Logo />
        <div className="auth-brand-body">
          <p className="eyebrow">Medicine inventory · SDG 3 · 12</p>
          <h2>Right medicine. Right place.</h2>
          <p className="auth-brand-text">
            When a store runs out, SmartSpace shows which nearby warehouse has the stock, so patients are not turned
            away and medicines do not expire unused.
          </p>
          <ul className="check-list">
            {highlights.map((item) => (
              <li key={item}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <RoomIllustration />
      </aside>

      <main className="auth-main">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
        {footer && <p className="auth-footer">{footer}</p>}
      </main>
    </div>
  )
}
