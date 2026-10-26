import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { Radio, BarChart3, SlidersHorizontal, Info, Sparkles, Key, X, Check, ExternalLink } from 'lucide-react'
import PredictPage from './pages/PredictPage'
import DashboardPage from './pages/DashboardPage'
import WhatIfPage from './pages/WhatIfPage'
import AboutPage from './pages/AboutPage'
import { api } from './api'

function App() {
  const [llmConfigured, setLlmConfigured] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [inputKey, setInputKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Check health and LLM config
  useEffect(() => {
    api.health()
      .then(res => setLlmConfigured(res.llm_configured))
      .catch(() => setLlmConfigured(false))
  }, [])

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
    document.body.classList.remove('menu-open')
  }, [location.pathname])

  // Setup animations and menu listeners
  useEffect(() => {
    // 1. Add is-in class on animationend
    const onAnimationEnd = (e: AnimationEvent) => {
      const target = e.target as HTMLElement
      if (target && target.classList.contains('appear')) {
        target.classList.add('is-in')
      }
    }
    document.addEventListener('animationend', onAnimationEnd)

    // 2. JS Fallback: after two rAFs, if no animations running, add is-in
    let raf1: number, raf2: number
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const appears = document.querySelectorAll<HTMLElement>('.appear')
        appears.forEach(el => {
          const anims = el.getAnimations ? el.getAnimations() : []
          const hasActive = anims.some(a => a.playState === 'running' || a.playState === 'finished')
          if (!hasActive) {
            el.classList.add('is-in')
          }
        })
      })
    })

    // 3. Close menu on Escape
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        document.body.classList.remove('menu-open')
      }
    }
    window.addEventListener('keydown', onKeyDown)

    // 4. Close menu if resized >= 901px
    const onResize = () => {
      if (window.innerWidth >= 901) {
        setMenuOpen(false)
        document.body.classList.remove('menu-open')
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      document.removeEventListener('animationend', onAnimationEnd)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const toggleMenu = () => {
    setMenuOpen(prev => {
      const next = !prev
      if (next) {
        document.body.classList.add('menu-open')
      } else {
        document.body.classList.remove('menu-open')
      }
      return next
    })
  }

  const handleSaveKey = async () => {
    if (!inputKey.trim()) return
    setSavingKey(true)
    setSaveError('')
    try {
      const res = await api.setApiKey(inputKey.trim())
      if (res.llm_configured) {
        setLlmConfigured(true)
        setSaveSuccess(true)
        setTimeout(() => {
          setShowKeyModal(false)
          setSaveSuccess(false)
          setInputKey('')
        }, 1200)
      } else {
        setSaveError('Failed to configure key.')
      }
    } catch (e: any) {
      setSaveError(e.message || 'Error saving API key')
    } finally {
      setSavingKey(false)
    }
  }

  return (
    <>
      {/* Background Ambience Layers */}
      <div className="grain" aria-hidden="true" />
      <div className="hero-photo" aria-hidden="true" />

      <div className="page">
        {/* Mobile Menu Backdrop */}
        <div
          className="menu-backdrop"
          onClick={() => {
            setMenuOpen(false)
            document.body.classList.remove('menu-open')
          }}
          aria-hidden="true"
        />

        {/* Header — 3-Column Grid */}
        <header className="header">
          {/* Left: Logo */}
          <Link
            to="/"
            className="logo appear appear--scale"
            style={{ '--d': '0.08s' } as React.CSSProperties}
            aria-label="5G Slice Advisor"
          >
            <svg className="logo-mark" viewBox="0 0 24 24" fill="currentColor">
              <g transform="rotate(-30 12 12)">
                <circle cx="7.3" cy="3.2" r="1.45" />
                <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
                <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
                <circle cx="16.7" cy="20.8" r="1.45" />
              </g>
            </svg>
            <span>
              5G Slice<span className="logo-suffix">.advisor</span>
            </span>
          </Link>

          {/* Center: Nav Pills */}
          <nav id="site-nav" aria-label="Primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-pill appear appear--scale ${isActive ? 'active' : ''}`}
              style={{ '--d': '0.16s' } as React.CSSProperties}
            >
              <Radio size={14} />
              <span>Predictor</span>
            </NavLink>
            <NavLink
              to="/what-if"
              className={({ isActive }) => `nav-pill appear appear--soft ${isActive ? 'active' : ''}`}
              style={{ '--d': '0.28s' } as React.CSSProperties}
            >
              <SlidersHorizontal size={14} />
              <span>What-If</span>
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `nav-pill appear appear--scale ${isActive ? 'active' : ''}`}
              style={{ '--d': '0.40s' } as React.CSSProperties}
            >
              <BarChart3 size={14} />
              <span>Model Metrics</span>
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) => `nav-pill appear appear--soft ${isActive ? 'active' : ''}`}
              style={{ '--d': '0.52s' } as React.CSSProperties}
            >
              <Info size={14} />
              <span>Architecture</span>
            </NavLink>
          </nav>

          {/* Right: CTA & Burger */}
          <div className="header-right">
            <button
              className={`key-pill appear appear--scale ${llmConfigured ? 'active' : ''}`}
              style={{ '--d': '0.34s' } as React.CSSProperties}
              onClick={() => setShowKeyModal(true)}
              title={llmConfigured ? 'Qualcomm Cloud AI Connected' : 'Connect Qualcomm Cloud AI API Key'}
            >
              {llmConfigured ? (
                <>
                  <Sparkles size={13} style={{ color: 'var(--mmtc-color)' }} />
                  <span>Qualcomm AI Active</span>
                </>
              ) : (
                <>
                  <Key size={13} />
                  <span>Connect Qualcomm AI</span>
                </>
              )}
            </button>

            <button
              className="burger-btn appear appear--scale"
              style={{ '--d': '0.34s' } as React.CSSProperties}
              onClick={toggleMenu}
              aria-controls="site-nav"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="burger-bar" />
              <span className="burger-bar" />
              <span className="burger-bar" />
            </button>
          </div>
        </header>

        {/* Modal for Qualcomm API Key */}
        {showKeyModal && (
          <div className="modal-backdrop" onClick={() => setShowKeyModal(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="card-icon" style={{ borderColor: 'rgba(168, 85, 247, 0.4)', color: 'var(--purple-accent)' }}>
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                      Qualcomm Cloud AI
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Llama-3.1-8B · NLP extraction & plain-English explanation
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowKeyModal(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: 13, color: 'var(--stat)', lineHeight: 1.6, marginBottom: 18 }}>
                Qualcomm Cloud AI inference powers:
                <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                  <li><strong>Natural Language Extraction:</strong> Converts conversational use-case descriptions into structured 5G QoS parameters.</li>
                  <li><strong>Prediction Reasoning:</strong> Explains model predictions in simple, actionable English.</li>
                </ul>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                  <em>Note: The Scikit-learn Random Forest model always performs the classification. The LLM never overrides or chooses slice categories.</em>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Qualcomm API Key</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder={llmConfigured ? '••••••••••••••••••••••••••••••••' : 'Enter your Qualcomm Cloud AI key'}
                  value={inputKey}
                  onChange={e => setInputKey(e.target.value)}
                />
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, display: 'block' }}>
                  Keys can be updated for this active session or saved in <code>backend/.env</code>.
                </span>
              </div>

              {saveSuccess && (
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  <Check size={16} />
                  <span>Qualcomm Cloud AI Key configured successfully!</span>
                </div>
              )}

              {saveError && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <span>{saveError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
                <a
                  href="https://aihub.qualcomm.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)' }}
                >
                  Qualcomm AI Hub <ExternalLink size={12} />
                </a>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setShowKeyModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-solid"
                    onClick={handleSaveKey}
                    disabled={savingKey || !inputKey.trim()}
                  >
                    {savingKey ? 'Connecting...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content View */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<PredictPage />} />
            <Route path="/what-if" element={<WhatIfPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid var(--border-soft)',
          padding: '24px 40px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: 12,
          lineHeight: 1.6
        }}>
          <div style={{ color: 'var(--stat)', marginBottom: 4, fontWeight: 500 }}>
            ⚠ Prototype Demonstration — 5G Network Slice Suitability Checker (NC-02 Hackathon)
          </div>
          <div>
            Powered by Scikit-learn Random Forest Classifier (100% test accuracy on 300,000 real telecom records) & Qualcomm Cloud AI Llama-3.1-8B.
          </div>
        </footer>
      </div>
    </>
  )
}

export default App
