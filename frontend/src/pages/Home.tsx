import { Link } from 'react-router-dom'
import { Logo } from '../components/auth/Logo'
import { StockFinder } from '../components/home/StockFinder'
import { useAuth } from '../hooks/useAuth'
import './Home.css'

const goals = [
  {
    code: 'SDG 3',
    title: 'Good Health & Well-being',
    text: 'Access to essential medicines (target 3.8). When a local store runs out, patients and clinics are pointed to the nearest warehouse that has stock.',
    color: '#4c9f38',
  },
  {
    code: 'SDG 12',
    title: 'Responsible Consumption',
    text: 'Less waste (targets 12.3 and 12.5). Batches close to expiry are flagged to be used first, so stock is dispatched before it is thrown away.',
    color: '#bf8b2e',
  },
  {
    code: 'SDG 9',
    title: 'Industry, Innovation & Infrastructure',
    text: 'A resilient, data-driven supply network: every warehouse’s location and stock level feeds one shared view.',
    color: '#f36d25',
  },
  {
    code: 'SDG 2',
    title: 'Zero Hunger',
    text: 'The same engine can track food grain (dhanya) and perishables, cutting food loss from poor handling. Planned as the next module.',
    color: '#dda63a',
  },
]

const steps = [
  { title: 'Order arrives', text: 'A user asks for a medicine and a quantity, for example 1,200 units.' },
  { title: 'Check local stock', text: 'The system checks the nearest warehouse first.' },
  { title: 'Find the next best store', text: 'If stock is short, it ranks other warehouses by distance and splits the order if needed.' },
  { title: 'Reduce waste', text: 'Batches nearing expiry are marked “use first” so they are dispatched sooner.' },
]

export function Home() {
  const { user, loading } = useAuth()

  return (
    <div className="home">
      <header className="home-nav">
        <div className="home-nav-inner">
          <Logo />
          <nav className="home-nav-links" aria-label="Main">
            <a href="#finder">Try the finder</a>
            <a href="#sdg">SDG impact</a>
            {!loading && user ? (
              <Link to="/dashboard" className="btn btn-primary btn-inline btn-sm">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="home-signin">Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-inline btn-sm">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-hero-inner">
            <p className="eyebrow">Built for SDG 3 · SDG 12 · SDG 9</p>
            <h1>
              The right medicine, from the <span className="hl">nearest warehouse</span>, before it expires.
            </h1>
            <p className="home-lead">
              When one store has no stock, patients should not be turned away. Our inventory system tracks medicines
              across every warehouse, shows where stock is and which store is closest, and flags batches at risk of
              going to waste.
            </p>
            <div className="home-cta">
              <a href="#finder" className="btn btn-primary btn-inline">Try the stock finder</a>
              <Link to="/register" className="btn btn-outline btn-inline">Create an account</Link>
            </div>
          </div>
        </section>

        <section className="home-section" id="problem">
          <div className="home-container">
            <div className="section-head">
              <h2>The problem we are solving</h2>
              <p>Two failures that happen in the same supply chain.</p>
            </div>
            <div className="problem-grid">
              <article className="problem-card">
                <h3>Shortage in one place</h3>
                <p>A clinic needs 1,200 units. Its store has none, and nobody knows that another warehouse nearby has plenty.</p>
              </article>
              <article className="problem-card">
                <h3>Waste in another</h3>
                <p>Elsewhere, stock sits unused until it expires. Without visibility, medicines and food are wasted while others go without.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="home-section home-section-tint" id="finder">
          <div className="home-container">
            <div className="section-head">
              <h2>Try the nearest-stock finder</h2>
              <p>Change the medicine, quantity or location to see which warehouse would fulfil the order.</p>
            </div>
            <StockFinder />
          </div>
        </section>

        <section className="home-section" id="how">
          <div className="home-container">
            <div className="section-head">
              <h2>How it works</h2>
            </div>
            <ol className="steps">
              {steps.map((step, index) => (
                <li key={step.title} className="step">
                  <span className="step-number" aria-hidden="true">{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="home-section home-section-tint" id="sdg">
          <div className="home-container">
            <div className="section-head">
              <h2>Connected to the Sustainable Development Goals</h2>
              <p>How efficient, location-aware inventory supports the UN 2030 agenda.</p>
            </div>
            <div className="sdg-grid">
              {goals.map((goal) => (
                <article key={goal.code} className="sdg-card" style={{ borderTopColor: goal.color }}>
                  <span className="sdg-code" style={{ background: goal.color }}>{goal.code}</span>
                  <h3>{goal.title}</h3>
                  <p>{goal.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-container">
          <Logo />
          <p>A college project focused on medicine inventory management and the UN Sustainable Development Goals.</p>
        </div>
      </footer>
    </div>
  )
}
