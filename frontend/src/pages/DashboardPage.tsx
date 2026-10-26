import { useState, useEffect } from 'react'
import { BarChart3, AlertTriangle, Database, FlaskConical, CheckCircle2, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api, type ModelInfo } from '../api'

const SLICE_COLORS: Record<string, string> = {
  URLLC: '#ff3b30',
  eMBB: '#007aff',
  mMTC: '#30d158',
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
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
        <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px', border: '2px solid rgba(255, 255, 255, 0.2)', borderTopColor: '#ffffff', borderRadius: '50%' }} />
        <span>Loading model evaluation telemetry...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ maxWidth: 640, margin: '40px auto' }}>
        <div className="alert alert-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Unable to load model metadata:</strong> {error}
            <br />Verify that the backend is active and the model pipeline has been trained.
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
        <div className="card-header" style={{ marginBottom: 16 }}>
          <div className="card-icon" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}>
            <BarChart3 size={18} />
          </div>
          <div>
            <div className="card-title">Model Evaluation Dashboard</div>
            <div className="card-subtitle">Random Forest architecture, validation metrics, and dataset distribution</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="slice-badge mmtc">v{info.model_version}</span>
          </div>
        </div>

        <div className="alert alert-info">
          <Database size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong>Dataset Source:</strong> {info.dataset_source}<br />
            <span style={{ fontSize: 12, opacity: 0.85 }}>{info.dataset_note}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid-4 section-gap">
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em' }}>
            {info.total_rows_used.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Dataset Records
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em' }}>
            {info.num_features}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Input Features
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--mmtc-color)', letterSpacing: '-0.03em' }}>
            {(info.test_metrics.accuracy * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Test Accuracy
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--embb-color)', letterSpacing: '-0.03em' }}>
            {(info.test_metrics.macro_f1 * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Macro F1 Score
          </div>
        </div>
      </div>

      {/* Split & Training Info */}
      <div className="grid-2 section-gap">
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FlaskConical size={16} />
            <span>Dataset Partitioning</span>
          </h3>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Training Split (70%)', info.split_sizes.train],
                ['Validation Split (15%)', info.split_sizes.validation],
                ['Held-Out Test Split (15%)', info.split_sizes.test],
              ].map(([label, count]) => (
                <tr key={String(label)} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <td style={{ padding: '10px 0', fontWeight: 500, color: '#ffffff' }}>{label}</td>
                  <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                    {Number(count).toLocaleString()} ({((Number(count) / info.total_rows_used) * 100).toFixed(1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginBottom: 10 }}>Hyperparameters</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12 }}>
              {Object.entries(info.model_params).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ color: 'var(--muted)' }}>{key.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: 500, color: '#ffffff' }}>{String(val)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
            <span><Clock size={12} style={{ verticalAlign: -2 }} /> Trained: {new Date(info.trained_at).toLocaleString()}</span>
            <span>⏱ Elapsed: {info.training_time_seconds}s</span>
          </div>
        </div>

        {/* Per-Class Metrics */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>Per-Class Classification Metrics</span>
          </h3>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--muted)', fontWeight: 500 }}>Slice</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--muted)', fontWeight: 500 }}>Precision</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--muted)', fontWeight: 500 }}>Recall</th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--muted)', fontWeight: 500 }}>Support</th>
              </tr>
            </thead>
            <tbody>
              {info.class_names.map(cls => (
                <tr key={cls} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <td style={{ padding: '10px 0' }}>
                    <span className={`slice-badge ${cls.toLowerCase()}`} style={{ fontSize: 11 }}>{cls}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500, color: '#ffffff' }}>
                    {(info.test_metrics.per_class_precision[cls] * 100).toFixed(1)}%
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500, color: '#ffffff' }}>
                    {(info.test_metrics.per_class_recall[cls] * 100).toFixed(1)}%
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                    {info.class_distribution[cls]?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Confusion Matrix */}
          <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 22, marginBottom: 10, color: '#ffffff' }}>
            Confusion Matrix (45,000 Test Records)
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px', color: 'var(--muted)' }}></th>
                {info.class_names.map(c => (
                  <th key={c} style={{ padding: '6px', color: 'var(--muted)' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {info.class_names.map((cls, i) => (
                <tr key={cls}>
                  <th style={{ padding: '6px', color: 'var(--muted)', textAlign: 'left' }}>{cls}</th>
                  {info.test_metrics.confusion_matrix[i].map((val, j) => (
                    <td
                      key={j}
                      style={{
                        padding: '8px',
                        background: i === j ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        border: '1px solid var(--border-soft)',
                        color: i === j ? '#ffffff' : 'var(--muted)',
                        fontWeight: i === j ? 600 : 400,
                      }}
                    >
                      {val.toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
            Rows = True Slice, Columns = Predicted Slice
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2 section-gap">
        {/* Feature Importance */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#ffffff' }}>
            Global Feature Importance (%)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={featureData} layout="vertical" margin={{ left: 80, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis type="number" fontSize={12} stroke="var(--muted)" tickLine={false} />
              <YAxis dataKey="name" type="category" fontSize={12} stroke="var(--muted)" tickLine={false} width={110} />
              <Tooltip
                contentStyle={{ background: '#111111', borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 8, color: '#ffffff' }}
                formatter={(v: any) => [`${v}%`, 'Importance']}
              />
              <Bar dataKey="value" fill="#ffffff" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Class Distribution */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#ffffff' }}>
            Class Distribution in Dataset
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={classDistData} margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis dataKey="name" fontSize={12} stroke="var(--muted)" tickLine={false} />
              <YAxis fontSize={12} stroke="var(--muted)" tickLine={false} tickFormatter={(v: any) => `${(Number(v || 0) / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#111111', borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 8, color: '#ffffff' }}
                formatter={(v: any) => [Number(v || 0).toLocaleString(), 'Samples']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={44}>
                {classDistData.map((entry) => (
                  <Cell key={entry.name} fill={SLICE_COLORS[entry.name] || '#ffffff'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Ranges */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#ffffff' }}>
          Feature Bounds (Standardization & Training References)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--muted)' }}>Feature</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--muted)' }}>Min</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--muted)' }}>Max</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--muted)' }}>Mean</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', color: 'var(--muted)' }}>Std Dev</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(info.feature_ranges).map(([feat, r]) => (
                <tr key={feat} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#ffffff' }}>{feat.replace(/_/g, ' ')}</td>
                  <td style={{ textAlign: 'right', padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--stat)' }}>{r.min.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--stat)' }}>{r.max.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--stat)' }}>{r.mean.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--stat)' }}>{r.std.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
