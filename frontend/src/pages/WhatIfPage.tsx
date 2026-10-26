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
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label" style={{ fontSize: 12 }}>{label}</label>
          <select className="form-select" value={value} onChange={e => setter(e.target.value)} style={{ padding: '8px 10px', fontSize: 13 }}>
            {schema?.use_case_values.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )
    }
    return (
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ fontSize: 12 }}>{label}</label>
        <input
          className="form-input"
          type="number"
          value={value}
          onChange={e => setter(field === 'active_connections' || field === 'bandwidth_allocated_mhz' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
          style={{ padding: '8px 10px', fontSize: 13 }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="card section-gap">
        <div className="card-header">
          <div className="card-icon" style={{ background: 'var(--purple-100)', color: 'var(--purple-600)' }}>
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <div className="card-title">What-If Simulator</div>
            <div className="card-subtitle">Adjust requirements and see how the recommendation changes</div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <div className="comparison-grid">
          {/* Original */}
          <div className="card" style={{ background: 'var(--gray-50)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--navy-700)' }}>📌 Original Requirements</h3>
            {renderInputGroup('Use Case', 'use_case', 'select', v => setOriginal(p => ({ ...p, use_case: v })), original.use_case)}
            {renderInputGroup('Throughput (Mbps)', 'throughput_mbps', 'number', v => setOriginal(p => ({ ...p, throughput_mbps: v })), original.throughput_mbps)}
            {renderInputGroup('Latency (ms)', 'latency_ms', 'number', v => setOriginal(p => ({ ...p, latency_ms: v })), original.latency_ms)}
            {renderInputGroup('Reliability (%)', 'reliability_percent', 'number', v => setOriginal(p => ({ ...p, reliability_percent: v })), original.reliability_percent)}
            {renderInputGroup('Active Connections', 'active_connections', 'number', v => setOriginal(p => ({ ...p, active_connections: v })), original.active_connections)}
            {renderInputGroup('Bandwidth (MHz)', 'bandwidth_allocated_mhz', 'number', v => setOriginal(p => ({ ...p, bandwidth_allocated_mhz: v })), original.bandwidth_allocated_mhz)}
          </div>

          <div className="comparison-arrow">
            <ArrowRight size={28} />
          </div>

          {/* Modified */}
          <div className="card" style={{ background: 'var(--blue-50)', border: '1px solid var(--blue-200)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-700)' }}>🔧 Modified Requirements</h3>
              <button className="btn btn-ghost btn-sm" onClick={resetModified}>
                <RotateCcw size={14} /> Reset
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

        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 20 }} onClick={handleCompare} disabled={loading}>
          {loading ? <><Loader2 size={18} className="spinner" /> Comparing...</> : <><SlidersHorizontal size={18} /> Compare Predictions</>}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--navy-800)' }}>Comparison Results</h3>

          <div className="comparison-grid" style={{ marginBottom: 24 }}>
            <div className={`slice-result-card ${result.original.predicted_slice.toLowerCase()}`} style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>ORIGINAL</div>
              <div className={`slice-icon ${result.original.predicted_slice.toLowerCase()}`} style={{ width: 48, height: 48, fontSize: 20, margin: '0 auto 8px' }}>
                {SLICE_INFO[result.original.predicted_slice]?.icon}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: `var(--${result.original.predicted_slice.toLowerCase()}-color)` }}>
                {result.original.predicted_slice}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Score: {((result.original.class_probabilities[result.original.predicted_slice] || 0) * 100).toFixed(1)}%
              </div>
            </div>

            <div className="comparison-arrow" style={{ fontSize: 28 }}>
              {result.slice_changed ? '🔄' : '✅'}
            </div>

            <div className={`slice-result-card ${result.modified.predicted_slice.toLowerCase()}`} style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>MODIFIED</div>
              <div className={`slice-icon ${result.modified.predicted_slice.toLowerCase()}`} style={{ width: 48, height: 48, fontSize: 20, margin: '0 auto 8px' }}>
                {SLICE_INFO[result.modified.predicted_slice]?.icon}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: `var(--${result.modified.predicted_slice.toLowerCase()}-color)` }}>
                {result.modified.predicted_slice}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Score: {((result.modified.class_probabilities[result.modified.predicted_slice] || 0) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {result.slice_changed ? (
            <div className="alert alert-warning">
              <AlertTriangle size={16} />
              <span>The recommended slice changed from <strong>{result.original.predicted_slice}</strong> to <strong>{result.modified.predicted_slice}</strong>.</span>
            </div>
          ) : (
            <div className="alert alert-success">
              <Sparkles size={16} />
              <span>The recommendation remains <strong>{result.original.predicted_slice}</strong> despite the changes.</span>
            </div>
          )}

          {/* Changes Table */}
          {Object.keys(result.changes).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Changes Made</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)' }}>Parameter</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)' }}>Original</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>→</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)' }}>Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.changes).map(([key, val]) => (
                    <tr key={key} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{key.replace(/_/g, ' ')}</td>
                      <td style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)' }}>{String(val.from)}</td>
                      <td style={{ textAlign: 'center', padding: '8px 12px' }}>→</td>
                      <td style={{ padding: '8px 12px', color: 'var(--accent)', fontWeight: 500 }}>{String(val.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Explanation */}
          <div className="explanation-content" style={{ background: 'var(--gray-50)', padding: 16, borderRadius: 'var(--radius-md)' }}>
            <ReactMarkdown>{result.explanation}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
