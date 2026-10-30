import { useState, useEffect } from 'react'
import { Send, Sparkles, AlertTriangle, Loader2, X } from 'lucide-react'
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

const FEATURE_LABELS: Record<string, string> = {
  use_case: 'Telecom Use Case',
  throughput_mbps: 'Throughput (Mbps)',
  latency_ms: 'Latency (ms)',
  reliability_percent: 'Reliability (%)',
  active_connections: 'Active Connections',
  bandwidth_allocated_mhz: 'Bandwidth Allocated (MHz)',
}

const EXAMPLE_PROMPT =
  'Autonomous haulage trucks in an open-pit mine stream sensor telemetry to a control centre. They need sub-10 ms latency, 99.999% reliability and around 400 concurrent connections.'

function formatFeatureValue(field: string, value: unknown) {
  if (field === 'use_case') {
    const text = String(value || '').replace(/_/g, ' ')
    return text || '—'
  }
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  if (field === 'active_connections' || field === 'bandwidth_allocated_mhz') {
    return num.toLocaleString()
  }
  return String(num)
}

export default function PredictPage() {
  const [schema, setSchema] = useState<FeatureSchema | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [error, setError] = useState('')
  const [schemaError, setSchemaError] = useState('')

  // Form state
  const [formData, setFormData] = useState<PredictionRequest>({
    use_case: '',
    throughput_mbps: 100,
    latency_ms: 10,
    reliability_percent: 99.9,
    active_connections: 1000,
    bandwidth_allocated_mhz: 50,
  })

  // NLP state
  const [nlpText, setNlpText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(false)
  const [showExample, setShowExample] = useState(true)

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
        }))
        setExtracted(true)
      } else {
        setError(res.error || 'Extraction failed. Please adjust values in the form.')
      }
    } catch (e: any) {
      setError(e.message || 'LLM extraction failed. Please enter values manually.')
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
          HERO LANDING SECTION
          ══════════════════════════════════════════════════════════════════ */}
      <section className="hero" id="top">
        <div className="hero-copy">
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

          <p
            className="lede appear appear--soft"
            style={{ '--d': '0.82s' } as React.CSSProperties}
          >
            Trained Scikit-learn Random Forest classifier running on 300,000 real telecom records,
            coupled with Qualcomm Cloud AI Llama-3.1-8B for instant, plain-English slice diagnostics.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SLICE QUICK REFERENCE — compact logo + abbreviation, expands on hover
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid-3 section-gap-lg">
        {Object.entries(SLICE_INFO).map(([key, info]) => (
          <div key={key} className="card slice-tile" tabIndex={0}>
            <div className={`slice-icon ${key.toLowerCase()}`}>{info.icon}</div>
            <div className={`slice-badge ${key.toLowerCase()}`}>{key}</div>
            <div className="slice-tile-detail">
              <div className={`slice-badge ${key.toLowerCase()}`} style={{ alignSelf: 'center' }}>
                {key}
              </div>
              <div className="slice-tile-detail-name">{info.full}</div>
              <div className="slice-tile-detail-desc">{info.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          WORKBENCH — input left, prediction right
          ══════════════════════════════════════════════════════════════════ */}
      <div className="workbench">
        {/* ── Input Panel ─────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}>
              <Send size={18} />
            </div>
            <div>
              <div className="card-title">Slice Suitability Predictor</div>
              <div className="card-subtitle">Describe your application or set the network constraints</div>
            </div>
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

          {/* Natural language (optional) */}
          <div className="form-group">
            <label className="form-label">
              Describe your application <span className="form-sublabel">(optional)</span>
            </label>
            <textarea
              className="form-textarea"
              value={nlpText}
              onChange={e => setNlpText(e.target.value)}
              placeholder="E.g. We are deploying autonomous haulage trucks in an open-pit mine. The vehicles stream sensor telemetry and require sub-10ms latency with 99.999% uptime to prevent collisions."
              style={{ minHeight: 120 }}
            />
            {showExample && !nlpText && (
              <div className="example-chip">
                <button
                  type="button"
                  className="example-chip-text"
                  onClick={() => setNlpText(EXAMPLE_PROMPT)}
                >
                  <strong>Example:</strong> {EXAMPLE_PROMPT}
                  <span className="example-chip-cta">Use this</span>
                </button>
                <button
                  type="button"
                  className="example-chip-close"
                  onClick={() => setShowExample(false)}
                  aria-label="Remove example"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <button
              className="btn btn-ghost"
              style={{ width: '100%', height: 42, marginTop: 10 }}
              onClick={handleExtract}
              disabled={extracting || nlpText.trim().length < 10}
            >
              {extracting ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Extracting with Qualcomm Cloud AI...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Autofill Constraints from Description</span>
                </>
              )}
            </button>
          </div>

          <div className="form-divider">
            <span>Network Constraints</span>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Telecom Use Case</label>
              <select
                className="form-select"
                value={formData.use_case}
                onChange={e => updateField('use_case', e.target.value)}
              >
                {schema?.use_case_values.map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
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
                <span className="form-hint">
                  Trained range: {schema.feature_ranges.throughput_mbps.min.toFixed(1)} – {schema.feature_ranges.throughput_mbps.max.toFixed(1)} Mbps
                </span>
              )}
            </div>
          </div>

          <div className="grid-2">
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
                <span className="form-hint">
                  Trained range: {schema.feature_ranges.latency_ms.min.toFixed(1)} – {schema.feature_ranges.latency_ms.max.toFixed(1)} ms
                </span>
              )}
            </div>
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
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Active Connections</label>
              <input
                className="form-input"
                type="number"
                min={0}
                step={1}
                value={formData.active_connections}
                onChange={e => updateField('active_connections', parseInt(e.target.value) || 0)}
              />
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

        {/* ── Output Panel (always visible) ───────────────────────────── */}
        <div>
          {result ? (
            <div
              className={`slice-result-card ${result.predicted_slice.toLowerCase()}`}
              style={{ marginBottom: 20 }}
            >
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
          ) : (
            <div className="slice-result-card pending" style={{ marginBottom: 20 }}>
              <div className="prototype-badge" style={{ marginBottom: 12 }}>
                Model Prediction Result
              </div>
              <div className="slice-result-pending">Enter details to see the prediction</div>
              <p className="slice-result-pending-sub">
                Describe your application or fill the network constraints on the left, then run the classifier.
              </p>
            </div>
          )}

          {/* Warnings */}
          {result && result.warnings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {result.warnings.map((w, i) => (
                <div key={i} className="alert alert-warning" style={{ marginBottom: 8 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Probability table */}
          <div className="card section-gap">
            <div className="card-title" style={{ marginBottom: 6, fontSize: 15 }}>
              Slice Confidence Probabilities
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              Softmax probabilities across all 3GPP slice categories from the Random Forest ensemble.
            </p>
            {(result
              ? Object.entries(result.class_probabilities).sort(([, a], [, b]) => b - a)
              : Object.keys(SLICE_INFO).map(name => [name, 0] as [string, number])
            ).map(([cls, prob]) => (
              <div key={cls} className="prob-bar-container">
                <div className="prob-bar-label">
                  <span style={{ color: `var(--${cls.toLowerCase()}-color)` }}>{cls}</span>
                  <span>{result ? `${((prob as number) * 100).toFixed(1)}%` : '—'}</span>
                </div>
                <div className="prob-bar-track">
                  <div
                    className={`prob-bar-fill ${cls.toLowerCase()}`}
                    style={{ width: result ? `${(prob as number) * 100}%` : 0 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Key features table — visible before and after prediction */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 6, fontSize: 15 }}>
              Key Prediction Features
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              {result
                ? 'Inputs used by the classifier with their relative decision weight.'
                : 'Inputs the classifier will use, with their current values.'}
            </p>
            {Object.entries(FEATURE_LABELS).map(([field, label]) => {
              const importance = result?.feature_importance?.[field]
              return (
                <div key={field} className="feature-row">
                  <span className="feature-row-label">{label}</span>
                  <span className="feature-row-value">
                    {formatFeatureValue(field, (formData as unknown as Record<string, unknown>)[field])}
                  </span>
                  <span className="feature-row-weight">
                    {importance !== undefined ? `${(importance * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Explanation */}
          {result && (
            <div className="card section-gap">
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
          )}
        </div>
      </div>
    </div>
  )
}
