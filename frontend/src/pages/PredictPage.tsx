import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Send, MessageSquareText, FileText, AlertTriangle, Sparkles, Loader2, ArrowRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { api, type PredictionRequest, type PredictionResponse, type FeatureSchema } from '../api'

const SLICE_INFO: Record<string, { full: string; icon: string; desc: string }> = {
  URLLC: {
    full: 'Ultra-Reliable Low-Latency Communications',
    icon: '⚡',
    desc: 'Mission-critical telemetry, sub-millisecond industrial robotics, and autonomous transport systems.',
  },
  eMBB: {
    full: 'Enhanced Mobile Broadband',
    icon: '📡',
    desc: 'Gigabit throughput for immersive AR/VR, 8K broadcast video, and real-time cloud computing.',
  },
  mMTC: {
    full: 'Massive Machine-Type Communications',
    icon: '🔗',
    desc: 'High-density sensor grids, smart metering, municipal IoT, and environmental telemetry.',
  },
}

export default function PredictPage() {
  const [tab, setTab] = useState<'form' | 'nlp'>('form')
  const [schema, setSchema] = useState<FeatureSchema | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [error, setError] = useState('')
  const [schemaError, setSchemaError] = useState('')
  const workbenchRef = useRef<HTMLDivElement>(null)

  // Form state
  const [formData, setFormData] = useState<PredictionRequest>({
    use_case: '',
    throughput_mbps: 100,
    latency_ms: 10,
    reliability_percent: 99.9,
    active_connections: 1000,
    bandwidth_allocated_mhz: 50,
    app_name: '',
    app_description: '',
  })

  // NLP state
  const [nlpText, setNlpText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(false)

  useEffect(() => {
    api.getFeatureSchema()
      .then(setSchema)
      .catch((e) => setSchemaError(e.message))
  }, [])

  useEffect(() => {
    if (schema && schema.use_case_values.length > 0 && !formData.use_case) {
      setFormData(prev => ({ ...prev, use_case: schema.use_case_values[0] }))
    }
  }, [schema])

  const scrollToWorkbench = () => {
    workbenchRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handlePredict = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.predict(formData)
      setResult(res)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExtract = async () => {
    setExtracting(true)
    setError('')
    try {
      const res = await api.extractRequirements(nlpText)
      if (res.success && res.extracted) {
        const ext = res.extracted
        setFormData(prev => ({
          ...prev,
          use_case: ext.use_case || prev.use_case,
          throughput_mbps: ext.throughput_mbps ?? prev.throughput_mbps,
          latency_ms: ext.latency_ms ?? prev.latency_ms,
          reliability_percent: ext.reliability_percent ?? prev.reliability_percent,
          active_connections: ext.active_connections ?? prev.active_connections,
          bandwidth_allocated_mhz: ext.bandwidth_allocated_mhz ?? prev.bandwidth_allocated_mhz,
          app_name: ext.app_name || prev.app_name,
          app_description: ext.app_description || nlpText,
        }))
        setExtracted(true)
        setTab('form')
      } else {
        setError(res.error || 'Extraction failed. Please adjust values in the form.')
        setTab('form')
      }
    } catch (e: any) {
      setError(e.message || 'LLM extraction failed. Please enter values manually.')
      setTab('form')
    } finally {
      setExtracting(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (schemaError) {
    return (
      <div className="card" style={{ maxWidth: 640, margin: '40px auto' }}>
        <div className="alert alert-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Backend service unavailable:</strong> {schemaError}
            <br />Verify that the FastAPI backend is running on port 8000.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ══════════════════════════════════════════════════════════════════
          HERO LANDING SECTION (Single-Viewport Impact)
          ══════════════════════════════════════════════════════════════════ */}
      <section className="hero" id="top">
        <div className="hero-copy">
          {/* Badge */}
          <div
            className="badge appear appear--pop"
            style={{ '--d': '0.22s' } as React.CSSProperties}
          >
            <svg className="badge-star badge-star-anim" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
            </svg>
            <span>Operational 5G AI Infrastructure</span>
          </div>

          {/* Masked Headline */}
          <h1>
            <span
              className="headline-line appear appear--mask"
              style={{ '--d': '0.42s' } as React.CSSProperties}
            >
              Match <em>5G network slices</em> to your
            </span>
            <span
              className="headline-line appear appear--mask"
              style={{ '--d': '0.62s' } as React.CSSProperties}
            >
              workloads with precision.
            </span>
          </h1>

          {/* Lede */}
          <p
            className="lede appear appear--soft"
            style={{ '--d': '0.82s' } as React.CSSProperties}
          >
            Trained Scikit-learn Random Forest classifier running on 300,000 real telecom records,
            coupled with Qualcomm Cloud AI Llama-3.1-8B for instant, plain-English slice diagnostics.
          </p>

          {/* Action Buttons */}
          <div className="hero-actions">
            <button
              onClick={scrollToWorkbench}
              className="btn btn-solid hero-btn hero-btn-solid appear appear--btn"
              style={{ '--d': '0.96s' } as React.CSSProperties}
            >
              <span>Predict Network Slice</span>
              <ArrowRight size={14} />
            </button>
            <Link
              to="/what-if"
              className="btn btn-ghost hero-btn hero-btn-ghost appear appear--side"
              style={{ '--d': '1.10s' } as React.CSSProperties}
            >
              <span>Explore What-If Simulator</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          STATS FOOTER BAR
          ══════════════════════════════════════════════════════════════════ */}
      <footer className="stats section-gap-lg">
        {/* Stat 1: Dual-Pill / Workflow Icon */}
        <div
          className="stat appear appear--stat"
          style={{ '--d': '1.12s' } as React.CSSProperties}
        >
          <svg className="stat-icon" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="gLeft" x1="3" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#3a3a3a" stopOpacity="0.62" />
              </linearGradient>
              <linearGradient id="gRight" x1="3" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3a3a3a" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.62" />
              </linearGradient>
            </defs>
            <rect x="3.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#gLeft)" />
            <rect x="13.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#gRight)" />
            <rect x="9.2" y="10.9" width="5.6" height="2.2" rx="1.1" fill="#4a4a4a" />
          </svg>
          <span>300,000+ Nigerian 5G records trained</span>
        </div>

        {/* Stat 2: Download Tile */}
        <div
          className="stat appear appear--stat"
          style={{ '--d': '1.28s' } as React.CSSProperties}
        >
          <svg className="stat-icon" viewBox="0 0 24 24" fill="none">
            <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="6.2" fill="#ffffff" />
            <path d="M12 7.1v7.4" stroke="#111111" strokeWidth="1.85" strokeLinecap="round" />
            <path d="M8.15 12.35L12 16.2l3.85-3.85" stroke="#111111" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>100.0% validation accuracy & F1 score</span>
        </div>

        {/* Stat 3: 3GPP Network Slice Avatars */}
        <div
          className="stat appear appear--stat"
          style={{ '--d': '1.44s' } as React.CSSProperties}
        >
          <svg className="stat-icon-wide" viewBox="0 0 40 22" fill="none">
            {/* URLLC Circle */}
            <circle cx="10.2" cy="11" r="9.2" fill="#2b2b2b" />
            <ellipse cx="10.2" cy="12.1" rx="4.15" ry="3.7" fill="#f4f4f4" />
            <polygon points="7.2,5 9.2,9 6.2,9" fill="#2b2b2b" />
            <polygon points="13.2,5 14.2,9 11.2,9" fill="#2b2b2b" />
            <circle cx="8.8" cy="11.5" r="0.7" fill="#1a1a1a" />
            <circle cx="11.6" cy="11.5" r="0.7" fill="#1a1a1a" />

            {/* eMBB Circle */}
            <circle cx="20.2" cy="11" r="9.2" fill="#ffffff" />
            <circle cx="18.2" cy="9.8" r="1.4" fill="#111111" />
            <circle cx="22.2" cy="9.8" r="1.4" fill="#111111" />
            <ellipse cx="20.2" cy="12.5" rx="1.2" ry="0.8" fill="#111111" />
            <path d="M18 14.5c1.2 1.2 3.2 1.2 4.4 0" stroke="#111111" strokeWidth="1.2" strokeLinecap="round" />

            {/* mMTC Circle */}
            <circle cx="30.2" cy="11" r="9.2" fill="#f26b1d" />
            <text x="30.2" y="15.1" fill="#ffffff" fontSize="12.5" fontWeight="700" textAnchor="middle" fontFamily="Inter, sans-serif">
              5G
            </text>
          </svg>
          <span>3GPP Slices: eMBB · URLLC · mMTC</span>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════════
          SLICE QUICK REFERENCE
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid-3 section-gap-lg">
        {Object.entries(SLICE_INFO).map(([key, info]) => (
          <div key={key} className="card" style={{ textAlign: 'center', padding: '24px 20px' }}>
            <div className={`slice-icon ${key.toLowerCase()}`}>
              {info.icon}
            </div>
            <div className={`slice-badge ${key.toLowerCase()}`} style={{ marginBottom: 8 }}>
              {key}
            </div>
            <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 500 }}>
              {info.full}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
              {info.desc}
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          INTERACTIVE PREDICTION WORKBENCH
          ══════════════════════════════════════════════════════════════════ */}
      <div ref={workbenchRef} style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 24 }}>
        {/* Input Panel */}
        <div>
          <div className="card section-gap">
            <div className="card-header">
              <div className="card-icon" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}>
                <Send size={18} />
              </div>
              <div>
                <div className="card-title">Slice Suitability Predictor</div>
                <div className="card-subtitle">Specify your network constraints or describe your application</div>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="tabs">
              <button
                className={`tab ${tab === 'form' ? 'active' : ''}`}
                onClick={() => setTab('form')}
              >
                <FileText size={14} />
                <span>Structured Form</span>
              </button>
              <button
                className={`tab ${tab === 'nlp' ? 'active' : ''}`}
                onClick={() => setTab('nlp')}
              >
                <MessageSquareText size={14} />
                <span>Conversational Prompt (Qualcomm AI)</span>
              </button>
            </div>

            {extracted && (
              <div className="alert alert-success" style={{ marginBottom: 16 }}>
                <Sparkles size={16} />
                <span>Requirements successfully extracted by Qualcomm Cloud AI! Review values and submit.</span>
              </div>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginBottom: 16 }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {tab === 'nlp' ? (
              <div>
                <div className="form-group">
                  <label className="form-label">Natural Language Application Description</label>
                  <textarea
                    className="form-textarea"
                    value={nlpText}
                    onChange={e => setNlpText(e.target.value)}
                    placeholder="E.g. We are deploying autonomous haulage trucks in an open-pit mine. The vehicles stream sensor telemetry and require sub-10ms latency with 99.999% uptime to prevent collisions."
                    style={{ minHeight: 160 }}
                  />
                </div>
                <button
                  className="btn btn-solid"
                  style={{ width: '100%', height: 46 }}
                  onClick={handleExtract}
                  disabled={extracting || nlpText.trim().length < 10}
                >
                  {extracting ? (
                    <>
                      <Loader2 size={18} className="spinner" />
                      <span>Extracting with Qualcomm Cloud AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>Extract 5G Requirements</span>
                    </>
                  )}
                </button>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
                  Extracts throughput, latency, reliability, and active connections into standardized 3GPP parameters.
                </p>
              </div>
            ) : (
              <div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Application Name <span className="form-sublabel">(optional)</span>
                    </label>
                    <input
                      className="form-input"
                      value={formData.app_name || ''}
                      onChange={e => updateField('app_name', e.target.value)}
                      placeholder="E.g. Mining Tele-Robotics"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Telecom Use Case</label>
                    <select
                      className="form-select"
                      value={formData.use_case}
                      onChange={e => updateField('use_case', e.target.value)}
                    >
                      {schema?.use_case_values.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    App Description <span className="form-sublabel">(optional, guides LLM explanation)</span>
                  </label>
                  <input
                    className="form-input"
                    value={formData.app_description || ''}
                    onChange={e => updateField('app_description', e.target.value)}
                    placeholder="Context for plain-English explanation"
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Throughput <span className="form-sublabel">(Mbps)</span>
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      step={0.1}
                      value={formData.throughput_mbps}
                      onChange={e => updateField('throughput_mbps', parseFloat(e.target.value) || 0)}
                    />
                    {schema?.feature_ranges.throughput_mbps && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                        Trained range: {schema.feature_ranges.throughput_mbps.min.toFixed(1)} – {schema.feature_ranges.throughput_mbps.max.toFixed(1)} Mbps
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Latency <span className="form-sublabel">(ms)</span>
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      step={0.1}
                      value={formData.latency_ms}
                      onChange={e => updateField('latency_ms', parseFloat(e.target.value) || 0)}
                    />
                    {schema?.feature_ranges.latency_ms && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                        Trained range: {schema.feature_ranges.latency_ms.min.toFixed(1)} – {schema.feature_ranges.latency_ms.max.toFixed(1)} ms
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      Reliability <span className="form-sublabel">(%)</span>
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={formData.reliability_percent}
                      onChange={e => updateField('reliability_percent', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Active Connections
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      step={1}
                      value={formData.active_connections}
                      onChange={e => updateField('active_connections', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Bandwidth Allocated <span className="form-sublabel">(MHz)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step={1}
                    value={formData.bandwidth_allocated_mhz}
                    onChange={e => updateField('bandwidth_allocated_mhz', parseInt(e.target.value) || 0)}
                  />
                </div>

                <button
                  className="btn btn-solid"
                  style={{ width: '100%', height: 46 }}
                  onClick={handlePredict}
                  disabled={loading || !formData.use_case}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="spinner" />
                      <span>Classifying 5G Slice...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Execute Random Forest Prediction</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        {result && (
          <div>
            {/* Prediction Card */}
            <div className={`slice-result-card ${result.predicted_slice.toLowerCase()}`} style={{ marginBottom: 20 }}>
              <div className="prototype-badge" style={{ marginBottom: 12 }}>
                Model Prediction Result
              </div>
              <div className={`slice-icon ${result.predicted_slice.toLowerCase()}`}>
                {SLICE_INFO[result.predicted_slice]?.icon || '📡'}
              </div>
              <div className="slice-name" style={{ color: `var(--${result.predicted_slice.toLowerCase()}-color)` }}>
                {result.predicted_slice}
              </div>
              <div className="slice-full-name">
                {SLICE_INFO[result.predicted_slice]?.full || result.predicted_slice}
              </div>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {result.warnings.map((w, i) => (
                  <div key={i} className="alert alert-warning" style={{ marginBottom: 8 }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Probability Bars */}
            <div className="card section-gap">
              <div className="card-title" style={{ marginBottom: 6, fontSize: 15 }}>
                Slice Confidence Probabilities
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Softmax probabilities across all 3GPP slice categories from the Random Forest ensemble.
              </p>
              {Object.entries(result.class_probabilities)
                .sort(([, a], [, b]) => b - a)
                .map(([cls, prob]) => (
                  <div key={cls} className="prob-bar-container">
                    <div className="prob-bar-label">
                      <span style={{ color: `var(--${cls.toLowerCase()}-color)` }}>{cls}</span>
                      <span>{(prob * 100).toFixed(1)}%</span>
                    </div>
                    <div className="prob-bar-track">
                      <div
                        className={`prob-bar-fill ${cls.toLowerCase()}`}
                        style={{ width: `${prob * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>

            {/* Feature Importance */}
            <div className="card section-gap">
              <div className="card-title" style={{ marginBottom: 6, fontSize: 15 }}>
                Top Decision Factors
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Relative contribution of input features to this classification.
              </p>
              {Object.entries(result.feature_importance)
                .sort(([, a], [, b]) => b - a)
                .map(([feat, imp]) => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, minWidth: 180, color: 'var(--stat)' }}>
                      {feat.replace(/_/g, ' ')}
                    </span>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 999, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 999,
                          width: `${imp * 100}%`,
                          background: 'linear-gradient(90deg, #ffffff, #9a9a9a)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 44, textAlign: 'right' }}>
                      {(imp * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>

            {/* Explanation */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="card-title" style={{ fontSize: 15 }}>
                  Diagnostic Reasoning
                </div>
                {result.llm_used ? (
                  <span className="slice-badge embb" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={12} /> Qualcomm AI Generated
                  </span>
                ) : (
                  <span className="slice-badge mmtc" style={{ fontSize: 11 }}>
                    Deterministic Template
                  </span>
                )}
              </div>
              <div className="explanation-content">
                <ReactMarkdown>{result.explanation}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
