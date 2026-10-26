import { useState, useEffect } from 'react'
import { SlidersHorizontal, ArrowRight, AlertTriangle, Loader2, Sparkles, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { api, type PredictionRequest, type WhatIfResponse, type FeatureSchema } from '../api'

const SLICE_INFO: Record<string, { full: string; icon: string }> = {
  URLLC: { full: 'Ultra-Reliable Low-Latency Communications', icon: '⚡' },
  eMBB: { full: 'Enhanced Mobile Broadband', icon: '📡' },
  mMTC: { full: 'Massive Machine-Type Communications', icon: '🔗' },
}

export default function WhatIfPage() {
  const [schema, setSchema] = useState<FeatureSchema | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<WhatIfResponse | null>(null)

  const defaultValues: PredictionRequest = {
    use_case: '',
    throughput_mbps: 100,
    latency_ms: 10,
    reliability_percent: 99.9,
    active_connections: 1000,
    bandwidth_allocated_mhz: 50,
  }

  const [original, setOriginal] = useState<PredictionRequest>({ ...defaultValues })
  const [modified, setModified] = useState<PredictionRequest>({ ...defaultValues })

  useEffect(() => {
    api.getFeatureSchema().then(s => {
      setSchema(s)
      if (s.use_case_values.length > 0) {
        setOriginal(prev => ({ ...prev, use_case: s.use_case_values[0] }))
        setModified(prev => ({ ...prev, use_case: s.use_case_values[0] }))
      }
    }).catch(e => setError(e.message))
  }, [])

  const handleCompare = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.whatIf(original, modified)
      setResult(res)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const resetModified = () => {
    setModified({ ...original })
    setResult(null)
  }

  const renderInputGroup = (
    label: string,
    field: keyof PredictionRequest,
    type: 'number' | 'select',
    setter: (val: any) => void,
    value: any,
  ) => {
    if (type === 'select') {
      return (
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label" style={{ fontSize: 12 }}>{label}</label>
          <select
            className="form-select"
            value={value}
            onChange={e => setter(e.target.value)}
            style={{ height: 38, fontSize: 13 }}
          >
            {schema?.use_case_values.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )
    }
    return (
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label" style={{ fontSize: 12 }}>{label}</label>
        <input
          className="form-input"
          type="number"
          value={value}
          onChange={e => setter(field === 'active_connections' || field === 'bandwidth_allocated_mhz' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
          style={{ height: 38, fontSize: 13 }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="card section-gap">
        <div className="card-header">
          <div className="card-icon" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}>
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <div className="card-title">What-If Sensitivity Simulator</div>
            <div className="card-subtitle">Perturb QoS parameters and observe slice boundary shifts in real time</div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} /> <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
          {/* Original */}
          <div className="card" style={{ background: 'rgba(12, 12, 12, 0.8)', border: '1px solid var(--border-soft)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#ffffff', letterSpacing: '-0.01em' }}>
              Original QoS Requirements
            </h3>
            {renderInputGroup('Use Case', 'use_case', 'select', v => setOriginal(p => ({ ...p, use_case: v })), original.use_case)}
            {renderInputGroup('Throughput (Mbps)', 'throughput_mbps', 'number', v => setOriginal(p => ({ ...p, throughput_mbps: v })), original.throughput_mbps)}
            {renderInputGroup('Latency (ms)', 'latency_ms', 'number', v => setOriginal(p => ({ ...p, latency_ms: v })), original.latency_ms)}
            {renderInputGroup('Reliability (%)', 'reliability_percent', 'number', v => setOriginal(p => ({ ...p, reliability_percent: v })), original.reliability_percent)}
            {renderInputGroup('Active Connections', 'active_connections', 'number', v => setOriginal(p => ({ ...p, active_connections: v })), original.active_connections)}
            {renderInputGroup('Bandwidth (MHz)', 'bandwidth_allocated_mhz', 'number', v => setOriginal(p => ({ ...p, bandwidth_allocated_mhz: v })), original.bandwidth_allocated_mhz)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--muted)', padding: '0 8px' }}>
            <ArrowRight size={24} />
          </div>

          {/* Modified */}
          <div className="card" style={{ background: 'rgba(18, 18, 18, 0.9)', border: '1px solid rgba(255, 255, 255, 0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em' }}>
                Modified Target Requirements
              </h3>
              <button
                className="btn btn-ghost"
                onClick={resetModified}
                style={{ height: 30, padding: '0 10px', fontSize: 12 }}
              >
                <RotateCcw size={12} /> <span>Reset</span>
              </button>
            </div>
            {renderInputGroup('Use Case', 'use_case', 'select', v => setModified(p => ({ ...p, use_case: v })), modified.use_case)}
            {renderInputGroup('Throughput (Mbps)', 'throughput_mbps', 'number', v => setModified(p => ({ ...p, throughput_mbps: v })), modified.throughput_mbps)}
            {renderInputGroup('Latency (ms)', 'latency_ms', 'number', v => setModified(p => ({ ...p, latency_ms: v })), modified.latency_ms)}
            {renderInputGroup('Reliability (%)', 'reliability_percent', 'number', v => setModified(p => ({ ...p, reliability_percent: v })), modified.reliability_percent)}
            {renderInputGroup('Active Connections', 'active_connections', 'number', v => setModified(p => ({ ...p, active_connections: v })), modified.active_connections)}
            {renderInputGroup('Bandwidth (MHz)', 'bandwidth_allocated_mhz', 'number', v => setModified(p => ({ ...p, bandwidth_allocated_mhz: v })), modified.bandwidth_allocated_mhz)}
          </div>
        </div>

        <button
          className="btn btn-solid"
          style={{ width: '100%', height: 46, marginTop: 24 }}
          onClick={handleCompare}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="spinner" />
              <span>Simulating Model Boundaries...</span>
            </>
          ) : (
            <>
              <SlidersHorizontal size={18} />
              <span>Simulate What-If Comparison</span>
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Scenario Comparison Analysis
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', marginBottom: 24 }}>
            {/* Original Result Card */}
            <div className={`slice-result-card ${result.original.predicted_slice.toLowerCase()}`} style={{ padding: 24 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                BASELINE SLICE
              </div>
              <div className={`slice-icon ${result.original.predicted_slice.toLowerCase()}`} style={{ width: 44, height: 44, fontSize: 20, margin: '0 auto 8px' }}>
                {SLICE_INFO[result.original.predicted_slice]?.icon}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: `var(--${result.original.predicted_slice.toLowerCase()}-color)` }}>
                {result.original.predicted_slice}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Confidence: {((result.original.class_probabilities[result.original.predicted_slice] || 0) * 100).toFixed(1)}%
              </div>
            </div>

            <div style={{ fontSize: 24, textAlign: 'center', padding: '0 8px' }}>
              {result.slice_changed ? '🔄' : '✅'}
            </div>

            {/* Modified Result Card */}
            <div className={`slice-result-card ${result.modified.predicted_slice.toLowerCase()}`} style={{ padding: 24 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                MODIFIED SLICE
              </div>
              <div className={`slice-icon ${result.modified.predicted_slice.toLowerCase()}`} style={{ width: 44, height: 44, fontSize: 20, margin: '0 auto 8px' }}>
                {SLICE_INFO[result.modified.predicted_slice]?.icon}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: `var(--${result.modified.predicted_slice.toLowerCase()}-color)` }}>
                {result.modified.predicted_slice}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Confidence: {((result.modified.class_probabilities[result.modified.predicted_slice] || 0) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {result.slice_changed ? (
            <div className="alert alert-warning" style={{ marginBottom: 20 }}>
              <AlertTriangle size={16} />
              <span>
                <strong>Slice Boundary Crossed:</strong> Recommendation changed from <strong>{result.original.predicted_slice}</strong> to <strong>{result.modified.predicted_slice}</strong>.
              </span>
            </div>
          ) : (
            <div className="alert alert-success" style={{ marginBottom: 20 }}>
              <Sparkles size={16} />
              <span>
                <strong>Stable Slice Allocation:</strong> The recommendation remains <strong>{result.original.predicted_slice}</strong> within tolerance.
              </span>
            </div>
          )}

          {/* Changes Table */}
          {Object.keys(result.changes).length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 10 }}>
                Parameter Alterations
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--muted)' }}>Parameter</th>
                      <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--muted)' }}>Original</th>
                      <th style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--muted)' }}>→</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--muted)' }}>Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.changes).map(([key, val]) => (
                      <tr key={key} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: '#ffffff' }}>{key.replace(/_/g, ' ')}</td>
                        <td style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--muted)' }}>{String(val.from)}</td>
                        <td style={{ textAlign: 'center', padding: '10px 14px', color: 'var(--muted)' }}>→</td>
                        <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 600 }}>{String(val.to)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="card" style={{ background: 'rgba(10, 10, 10, 0.6)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>
              Sensitivity & Impact Explanation
            </div>
            <div className="explanation-content">
              <ReactMarkdown>{result.explanation}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
