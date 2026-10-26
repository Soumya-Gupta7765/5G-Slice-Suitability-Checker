import { useState, useEffect } from 'react'
import { Send, MessageSquareText, FileText, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { api, type PredictionRequest, type PredictionResponse, type FeatureSchema } from '../api'

const SLICE_INFO: Record<string, { full: string; icon: string; desc: string }> = {
  URLLC: {
    full: 'Ultra-Reliable Low-Latency Communications',
    icon: '⚡',
    desc: 'Time-critical applications like emergency telemetry, industrial control, and autonomous systems.',
  },
  eMBB: {
    full: 'Enhanced Mobile Broadband',
    icon: '📡',
    desc: 'High-bandwidth applications like VR, video streaming, and cloud gaming.',
  },
  mMTC: {
    full: 'Massive Machine-Type Communications',
    icon: '🔗',
    desc: 'Large-scale IoT: smart parking, smart meters, and environmental sensors.',
  },
}

export default function PredictPage() {
  const [tab, setTab] = useState<'form' | 'nlp'>('form')
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
        setError(res.error || 'Extraction failed. Please fill in the form manually.')
        setTab('form')
      }
    } catch (e: any) {
      setError(e.message || 'LLM service unavailable. Please use the structured form.')
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
      <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="alert alert-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Backend unavailable:</strong> {schemaError}
            <br />Make sure the backend is running at <code>http://localhost:8000</code> and the model is trained.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Slice Category Reference */}
      <div className="grid-3 section-gap">
        {Object.entries(SLICE_INFO).map(([key, info]) => (
          <div key={key} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div className={`slice-icon ${key.toLowerCase()}`} style={{ width: 48, height: 48, fontSize: 22, margin: '0 auto 10px' }}>
              {info.icon}
            </div>
            <div className={`slice-badge ${key.toLowerCase()}`} style={{ marginBottom: 8 }}>{key}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{info.full}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{info.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 24 }}>
        {/* Input Panel */}
        <div>
          <div className="card section-gap">
            <div className="card-header">
              <div className="card-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                <Send size={18} />
              </div>
              <div>
                <div className="card-title">Predict Slice</div>
                <div className="card-subtitle">Enter your application requirements</div>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="tabs">
              <button className={`tab ${tab === 'form' ? 'active' : ''}`} onClick={() => setTab('form')}>
                <FileText size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                Structured Form
              </button>
              <button className={`tab ${tab === 'nlp' ? 'active' : ''}`} onClick={() => setTab('nlp')}>
                <MessageSquareText size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                Natural Language
              </button>
            </div>

            {extracted && (
              <div className="alert alert-success" style={{ marginBottom: 16 }}>
                <Sparkles size={16} />
                <span>Requirements extracted from your description. Review and adjust the values below, then click Predict.</span>
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
                  <label className="form-label">Describe your application</label>
                  <textarea
                    className="form-textarea"
                    value={nlpText}
                    onChange={e => setNlpText(e.target.value)}
                    placeholder="E.g. My application monitors patients in moving ambulances. It sends vital signs to a hospital and requires very low latency and highly reliable communication."
                    style={{ minHeight: 160 }}
                  />
                </div>
                <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleExtract} disabled={extracting || nlpText.length < 10}>
                  {extracting ? <><Loader2 size={18} className="spinner" /> Extracting...</> : <><Sparkles size={18} /> Extract Requirements</>}
                </button>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Uses Qualcomm Cloud AI to extract structured requirements. You can review and adjust before predicting.
                </p>
              </div>
            ) : (
              <div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Application Name <span className="form-sublabel">(optional)</span></label>
                    <input className="form-input" value={formData.app_name || ''} onChange={e => updateField('app_name', e.target.value)} placeholder="My 5G App" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Use Case</label>
                    <select className="form-select" value={formData.use_case} onChange={e => updateField('use_case', e.target.value)}>
                      {schema?.use_case_values.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Application Description <span className="form-sublabel">(optional, helps LLM explain)</span></label>
                  <input className="form-input" value={formData.app_description || ''} onChange={e => updateField('app_description', e.target.value)} placeholder="Brief description of your application" />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Throughput <span className="form-sublabel">(Mbps)</span></label>
                    <input className="form-input" type="number" min={0} step={0.1} value={formData.throughput_mbps} onChange={e => updateField('throughput_mbps', parseFloat(e.target.value) || 0)} />
                    {schema?.feature_ranges.throughput_mbps && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Training range: {schema.feature_ranges.throughput_mbps.min.toFixed(1)} – {schema.feature_ranges.throughput_mbps.max.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Latency <span className="form-sublabel">(ms)</span></label>
                    <input className="form-input" type="number" min={0} step={0.1} value={formData.latency_ms} onChange={e => updateField('latency_ms', parseFloat(e.target.value) || 0)} />
                    {schema?.feature_ranges.latency_ms && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Training range: {schema.feature_ranges.latency_ms.min.toFixed(1)} – {schema.feature_ranges.latency_ms.max.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Reliability <span className="form-sublabel">(%)</span></label>
                    <input className="form-input" type="number" min={0} max={100} step={0.01} value={formData.reliability_percent} onChange={e => updateField('reliability_percent', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Active Connections</label>
                    <input className="form-input" type="number" min={0} step={1} value={formData.active_connections} onChange={e => updateField('active_connections', parseInt(e.target.value) || 0)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Bandwidth Allocated <span className="form-sublabel">(MHz)</span></label>
                  <input className="form-input" type="number" min={0} step={1} value={formData.bandwidth_allocated_mhz} onChange={e => updateField('bandwidth_allocated_mhz', parseInt(e.target.value) || 0)} />
                </div>

                <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handlePredict} disabled={loading || !formData.use_case}>
                  {loading ? <><Loader2 size={18} className="spinner" /> Predicting...</> : <><Send size={18} /> Get Recommendation</>}
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
              <div className="prototype-badge" style={{ marginBottom: 12 }}>⚠ Prototype Recommendation</div>
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
                  <div key={i} className="alert alert-warning">
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Probability Bars */}
            <div className="card section-gap">
              <div className="card-title" style={{ marginBottom: 16, fontSize: 15 }}>Model Scores</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                These scores reflect the model's internal confidence, not guaranteed real-world probabilities.
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
                      <div className={`prob-bar-fill ${cls.toLowerCase()}`} style={{ width: `${prob * 100}%` }} />
                    </div>
                  </div>
                ))}
            </div>

            {/* Feature Importance */}
            <div className="card section-gap">
              <div className="card-title" style={{ marginBottom: 12, fontSize: 15 }}>Key Factors</div>
              {Object.entries(result.feature_importance)
                .sort(([, a], [, b]) => b - a)
                .map(([feat, imp]) => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, minWidth: 180, color: 'var(--navy-700)' }}>
                      {feat.replace(/_/g, ' ')}
                    </span>
                    <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 999 }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${imp * 100}%`,
                        background: 'var(--accent)',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>
                      {(imp * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>

            {/* Explanation */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="card-title" style={{ fontSize: 15 }}>Explanation</div>
                {result.llm_used ? (
                  <span className="slice-badge embb" style={{ fontSize: 11 }}>
                    <Sparkles size={12} /> AI-Generated
                  </span>
                ) : (
                  <span className="slice-badge mmtc" style={{ fontSize: 11 }}>Template-Based</span>
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
