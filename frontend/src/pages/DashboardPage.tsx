import { useState, useEffect } from 'react'
import { BarChart3, AlertTriangle, Database, FlaskConical, CheckCircle2, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api, type ModelInfo } from '../api'

const SLICE_COLORS: Record<string, string> = {
  URLLC: '#dc2626',
  eMBB: '#2563eb',
  mMTC: '#059669',
}

export default function DashboardPage() {
  const [info, setInfo] = useState<ModelInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getModelInfo()
      .then(setInfo)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span>Loading model metrics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="alert alert-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Cannot load model information:</strong> {error}
            <br />Ensure the backend is running and the model has been trained.
          </div>
        </div>
      </div>
    )
  }

  if (!info) return null

  const featureData = Object.entries(info.feature_importance).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value: +(value * 100).toFixed(1),
  })).sort((a, b) => b.value - a.value)

  const classDistData = Object.entries(info.class_distribution).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <div>
      {/* Header */}
      <div className="card section-gap">
        <div className="card-header" style={{ marginBottom: 12 }}>
          <div className="card-icon" style={{ background: 'var(--green-100)', color: 'var(--green-600)' }}>
            <BarChart3 size={18} />
          </div>
          <div>
            <div className="card-title">Model Evaluation Dashboard</div>
            <div className="card-subtitle">Training results and performance metrics</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="slice-badge mmtc">v{info.model_version}</span>
          </div>
        </div>

        <div className="alert alert-info">
          <Database size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Dataset:</strong> {info.dataset_source}<br />
            <span style={{ fontSize: 12 }}>{info.dataset_note}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid-4 section-gap">
        <div className="card stat-card">
          <div className="stat-value">{info.total_rows_used.toLocaleString()}</div>
          <div className="stat-label">Rows Used</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{info.num_features}</div>
          <div className="stat-label">Input Features</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--green-600)' }}>
            {(info.test_metrics.accuracy * 100).toFixed(1)}%
          </div>
          <div className="stat-label">Test Accuracy</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {(info.test_metrics.macro_f1 * 100).toFixed(1)}%
          </div>
          <div className="stat-label">Macro F1</div>
        </div>
      </div>

      {/* Split & Training Info */}
      <div className="grid-2 section-gap">
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--navy-800)' }}>
            <FlaskConical size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
            Data Split
          </h3>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Training', info.split_sizes.train],
                ['Validation', info.split_sizes.validation],
                ['Test', info.split_sizes.test],
              ].map(([label, count]) => (
                <tr key={String(label)} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                  <td style={{ padding: '8px 0', fontWeight: 500 }}>{label}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {Number(count).toLocaleString()} ({((Number(count) / info.total_rows_used) * 100).toFixed(1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Model Parameters</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
              {Object.entries(info.model_params).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--gray-50)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{key.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: 500 }}>{String(val)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span><Clock size={12} style={{ verticalAlign: -2 }} /> Trained: {new Date(info.trained_at).toLocaleString()}</span>
            <span>⏱ {info.training_time_seconds}s</span>
          </div>
        </div>

        {/* Per-Class Metrics */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--navy-800)' }}>
            <CheckCircle2 size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
            Per-Class Metrics
          </h3>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Class</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Precision</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Recall</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {info.class_names.map(cls => (
                <tr key={cls} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                  <td style={{ padding: '8px 0' }}>
                    <span className={`slice-badge ${cls.toLowerCase()}`} style={{ fontSize: 11 }}>{cls}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {(info.test_metrics.per_class_precision[cls] * 100).toFixed(1)}%
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {(info.test_metrics.per_class_recall[cls] * 100).toFixed(1)}%
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {info.class_distribution[cls]?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Confusion Matrix */}
          <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Confusion Matrix</h4>
          <table className="confusion-matrix">
            <thead>
              <tr>
                <th></th>
                {info.class_names.map(c => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {info.class_names.map((cls, i) => (
                <tr key={cls}>
                  <th>{cls}</th>
                  {info.test_metrics.confusion_matrix[i].map((val, j) => (
                    <td key={j} className={i === j ? 'cm-diagonal' : ''}>
                      {val.toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>Rows = Actual, Columns = Predicted</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2 section-gap">
        {/* Feature Importance */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--navy-800)' }}>Feature Importance (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={featureData} layout="vertical" margin={{ left: 80, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" fontSize={12} tickLine={false} />
              <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} width={100} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Class Distribution */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--navy-800)' }}>Class Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={classDistData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} tickFormatter={(v: any) => `${(Number(v || 0) / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => Number(v || 0).toLocaleString()} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={48}>
                {classDistData.map((entry) => (
                  <Cell key={entry.name} fill={SLICE_COLORS[entry.name] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Ranges */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--navy-800)' }}>Feature Ranges (Training Data)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)' }}>Feature</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)' }}>Min</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)' }}>Max</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)' }}>Mean</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)' }}>Std Dev</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(info.feature_ranges).map(([feat, r]) => (
                <tr key={feat} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{feat.replace(/_/g, ' ')}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.min.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.max.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.mean.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.std.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
