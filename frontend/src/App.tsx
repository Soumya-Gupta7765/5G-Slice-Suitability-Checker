import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Link } from 'react-router-dom'
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

  useEffect(() => {
    api.health()
      .then(res => setLlmConfigured(res.llm_configured))
      .catch(() => setLlmConfigured(false))
  }, [])

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
    <div className="app-container">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="header-brand">
            <div className="header-logo">5G</div>
            <div>
              <div className="header-title">5G Slice Advisor</div>
              <div className="header-subtitle">AI-assisted 5G network slice recommendations, explained simply.</div>
            </div>
          </Link>
          <nav className="header-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Radio size={16} /> Predict
            </NavLink>
            <NavLink to="/what-if" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <SlidersHorizontal size={16} /> What-If
            </NavLink>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <BarChart3 size={16} /> Model
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Info size={16} /> About
            </NavLink>

            <button
              className={`key-btn ${llmConfigured ? 'active' : ''}`}
              onClick={() => setShowKeyModal(true)}
              title={llmConfigured ? 'Qualcomm Cloud AI Connected' : 'Connect Qualcomm Cloud AI API Key'}
              style={{ marginLeft: 8 }}
            >
              {llmConfigured ? (
                <><Sparkles size={14} style={{ color: 'var(--green-600)' }} /> Qualcomm AI Active</>
              ) : (
                <><Key size={14} /> Connect Qualcomm AI</>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Modal for Qualcomm API Key */}
      {showKeyModal && (
        <div className="modal-backdrop" onClick={() => setShowKeyModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="card-icon" style={{ background: 'var(--purple-100)', color: 'var(--purple-600)' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--navy-800)' }}>
                    Qualcomm Cloud AI Settings
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    AI-powered NLP extraction & plain-English explanation
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              Qualcomm Cloud AI powers:
              <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                <li><strong>Step 1:</strong> Natural-language requirement extraction into structured fields.</li>
                <li><strong>Step 8:</strong> Natural-language explanation of predictions in simple English.</li>
              </ul>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <em>Note: The Random Forest ML model always executes the actual classification. The LLM never overrides or chooses slice categories.</em>
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
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Keys are stored only in server memory for this session or can be placed in <code>backend/.env</code>.
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <a
                href="https://aihub.qualcomm.com"
                target="_blank"
                rel="noopener"
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                Qualcomm AI Hub <ExternalLink size={12} />
              </a>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowKeyModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
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

      <main className="main-content">
        <Routes>
          <Route path="/" element={<PredictPage />} />
          <Route path="/what-if" element={<WhatIfPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <div className="footer-disclaimer">
          ⚠ Prototype — This is a demonstration tool, not verified network-provisioning advice.
        </div>
        <p className="footer-text">
          5G Slice Advisor © 2026 — Built for the NC-02 Hackathon. 
          Model trained on synthetic data from the Electric Sheep Africa catalog on Hugging Face.
          Predictions are based on pattern recognition and should not be used for production network configuration.
        </p>
      </footer>
    </div>
  )
}

export default App
