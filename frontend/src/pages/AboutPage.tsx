import { ExternalLink, Database, Brain, Radio } from 'lucide-react'

export default function AboutPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="card section-gap-lg">
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy-800)', marginBottom: 4 }}>5G Slice Advisor</h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 24 }}>
          AI-assisted 5G network slice recommendations, explained simply.
        </p>

        <div className="alert alert-info" style={{ marginBottom: 24 }}>
          <Radio size={18} />
          <div>
            <strong>NC-02 Hackathon Project</strong><br />
            This prototype demonstrates how machine learning can help developers and network engineers
            identify a suitable 5G network slice for their application's connectivity requirements.
          </div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--navy-800)' }}>How It Works</h2>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {[
            { num: '1', title: 'Describe Your Application', desc: 'Enter your requirements using the structured form or describe them in plain English.' },
            { num: '2', title: 'ML-Powered Prediction', desc: 'A trained Random Forest classifier analyzes your requirements and predicts the most suitable 5G slice.' },
            { num: '3', title: 'AI-Generated Explanation', desc: 'The LLM explains why this slice was recommended, connecting it to your specific needs.' },
            { num: '4', title: 'Explore What-If Scenarios', desc: 'Adjust parameters to see how changes affect the recommendation.' },
          ].map(step => (
            <div key={step.num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>{step.num}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy-800)' }}>{step.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--navy-800)' }}>5G Network Slice Categories</h2>
        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {[
            {
              name: 'URLLC', full: 'Ultra-Reliable Low-Latency Communications',
              desc: 'Designed for applications demanding extremely low latency (<1ms) and ultra-high reliability (99.999%+). Examples: industrial control systems, autonomous vehicle communication, remote surgery, emergency telemetry.',
              cls: 'urllc',
            },
            {
              name: 'eMBB', full: 'Enhanced Mobile Broadband',
              desc: 'Optimized for applications needing high data throughput and bandwidth. Examples: 4K/8K video streaming, virtual/augmented reality, cloud gaming, large file transfers.',
              cls: 'embb',
            },
            {
              name: 'mMTC', full: 'Massive Machine-Type Communications',
              desc: 'Built for scenarios with massive numbers of connected devices sending small, infrequent data packets. Examples: smart city sensors, smart parking, utility meters, environmental monitoring, agricultural IoT.',
              cls: 'mmtc',
            },
          ].map(s => (
            <div key={s.name} style={{ padding: 16, background: `var(--${s.cls}-bg)`, borderRadius: 'var(--radius-md)', border: `1px solid var(--${s.cls}-border)` }}>
              <span className={`slice-badge ${s.cls}`} style={{ marginBottom: 8, display: 'inline-flex' }}>{s.name}</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-700)', marginBottom: 4 }}>{s.full}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--navy-800)' }}>Architecture</h2>
        <div className="grid-3" style={{ marginBottom: 24 }}>
          {[
            { icon: <Database size={20} />, title: 'Data & ML', items: ['HuggingFace Dataset', 'Scikit-learn Random Forest', 'Pandas preprocessing', 'Joblib persistence'] },
            { icon: <Brain size={20} />, title: 'Backend', items: ['FastAPI (Python)', 'Prediction API', 'Qualcomm Cloud AI LLM', 'Template fallback'] },
            { icon: <Radio size={20} />, title: 'Frontend', items: ['React + TypeScript', 'Vite build', 'Recharts visualizations', 'Responsive design'] },
          ].map(col => (
            <div key={col.title} className="card" style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--accent)', marginBottom: 8 }}>{col.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{col.title}</div>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {col.items.map(item => <li key={item} style={{ marginBottom: 4 }}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--navy-800)' }}>⚠ Limitations & Disclaimers</h2>
        <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>This is a <strong>prototype</strong> for demonstration purposes only, not production network-provisioning advice.</li>
          <li>The model was trained on <strong>synthetic data</strong> from the Electric Sheep Africa catalog. It may not reflect real-world 5G network behavior.</li>
          <li>Predictions represent pattern-matching on training data labels, not objectively verified optimal slice assignments.</li>
          <li>No connection to a real 5G network is made. No slice is actually provisioned.</li>
          <li>The LLM explains the ML prediction — it does not override or change the prediction.</li>
          <li>Model confidence scores are internal estimates, not guaranteed probabilities.</li>
          <li>Always consult with your network operator for production deployments.</li>
        </ul>

        <div style={{ marginTop: 24, padding: 16, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)' }}>
          <strong>Dataset Attribution:</strong>{' '}
          <a href="https://huggingface.co/datasets/electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria" target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria <ExternalLink size={11} />
          </a>
          <br />Published by Electric Sheep Africa on Hugging Face.
        </div>
      </div>
    </div>
  )
}
