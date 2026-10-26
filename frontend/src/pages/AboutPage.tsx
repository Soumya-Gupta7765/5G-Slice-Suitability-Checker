import { ExternalLink, Database, Brain, Radio, ShieldAlert } from 'lucide-react'

export default function AboutPage() {
  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div className="card section-gap-lg">
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em', marginBottom: 8 }}>
          5G Slice <span style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--muted)' }}>Infrastructure</span> & Architecture
        </h1>
        <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.5 }}>
          AI-assisted 5G network slice determination, validated against 300,000 empirical telecom records.
        </p>

        <div className="alert alert-info" style={{ marginBottom: 28 }}>
          <Radio size={18} />
          <div>
            <strong>NC-02 Hackathon Prototype</strong><br />
            This platform pairs a strictly deterministic Scikit-learn Random Forest classifier with Qualcomm Cloud AI
            (Llama-3.1-8B) to map application QoS constraints into optimal 3GPP 5G network slices.
          </div>
        </div>

        {/* 4-Step Pipeline */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Decision Pipeline Workflow
        </h2>
        <div style={{ display: 'grid', gap: 14, marginBottom: 32 }}>
          {[
            {
              num: '1',
              title: 'Requirement Ingestion & NLP Extraction',
              desc: 'Enter application QoS constraints via structured sliders or describe operational workloads in conversational English. Qualcomm Cloud AI extracts normalized numerical features.',
            },
            {
              num: '2',
              title: 'Deterministic Random Forest Classification',
              desc: 'An ensemble of 200 decision trees evaluates throughput, latency, reliability, active connections, and bandwidth against trained decision surfaces.',
            },
            {
              num: '3',
              title: 'Diagnostic Reasoning & Explainability',
              desc: 'Qualcomm Cloud AI synthesizes the exact feature importance weights into a plain-English explanation detailing why this slice meets application tolerances.',
            },
            {
              num: '4',
              title: 'Sensitivity Simulation (What-If)',
              desc: 'Inspect boundary shifts and tolerance thresholds by tweaking variables in real time to understand trade-offs before provisioning.',
            },
          ].map(step => (
            <div
              key={step.num}
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                padding: '14px 18px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-soft)',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, #ffffff, #9a9a9a)',
                  color: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {step.num}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#ffffff', marginBottom: 2 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 3GPP Slice Categories */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#ffffff', letterSpacing: '-0.02em' }}>
          3GPP 5G Network Slice Categories
        </h2>
        <div style={{ display: 'grid', gap: 14, marginBottom: 32 }}>
          {[
            {
              name: 'URLLC',
              full: 'Ultra-Reliable Low-Latency Communications',
              desc: 'Architected for zero-compromise reliability (99.999%+) and sub-millisecond latencies. Ideal for autonomous vehicles, medical tele-robotics, smart grid protection, and industrial machine-to-machine control.',
              cls: 'urllc',
            },
            {
              name: 'eMBB',
              full: 'Enhanced Mobile Broadband',
              desc: 'Engineered for gigabit throughput and maximum spectrum bandwidth. Essential for 4K/8K media broadcast, virtual & augmented reality, dense urban crowd connectivity, and cloud workstation virtualization.',
              cls: 'embb',
            },
            {
              name: 'mMTC',
              full: 'Massive Machine-Type Communications',
              desc: 'Engineered for ultra-dense sensor networks (up to 1,000,000 devices/km²) transmitting lightweight, energy-efficient telemetry. Used for smart agriculture, municipal metering, fleet telematics, and environmental sensors.',
              cls: 'mmtc',
            },
          ].map(s => (
            <div
              key={s.name}
              style={{
                padding: '18px 20px',
                borderRadius: 10,
                background: 'rgba(12, 12, 12, 0.8)',
                border: `1px solid var(--${s.cls}-border)`,
                boxShadow: `0 0 20px var(--${s.cls}-glow)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className={`slice-badge ${s.cls}`}>{s.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>{s.full}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--stat)', lineHeight: 1.55 }}>
                {s.desc}
              </div>
            </div>
          ))}
        </div>

        {/* System Architecture */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Technical Stack
        </h2>
        <div className="grid-3" style={{ marginBottom: 32 }}>
          {[
            {
              icon: <Database size={20} />,
              title: 'Data & Machine Learning',
              items: ['Electric Sheep 5G Dataset (300k rows)', 'Scikit-learn RandomForestClassifier', 'ColumnTransformer standard scaler', 'Joblib serialized artifact'],
            },
            {
              icon: <Brain size={20} />,
              title: 'Backend & Inference API',
              items: ['FastAPI asynchronous core', 'Qualcomm Cloud AI (Llama-3.1-8B)', 'JSON & regex extraction parser', 'Vercel serverless integration'],
            },
            {
              icon: <Radio size={20} />,
              title: 'Frontend & Visuals',
              items: ['React 18 + TypeScript + Vite', 'Liquid-metal design tokens', 'Recharts telemetry dashboards', 'Zero third-party heavy dependencies'],
            },
          ].map(col => (
            <div key={col.title} className="card" style={{ textAlign: 'center', padding: '22px 18px' }}>
              <div style={{ color: '#ffffff', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                {col.icon}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#ffffff', marginBottom: 12 }}>
                {col.title}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                {col.items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>

        {/* Limitations & Disclaimers */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={18} style={{ color: 'var(--urllc-color)' }} />
          <span>Operational Disclaimers</span>
        </h2>
        <ul style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, paddingLeft: 20, marginBottom: 24 }}>
          <li>This is a software <strong>proof-of-concept</strong> developed for the NC-02 hackathon challenge.</li>
          <li>The Random Forest model was trained on synthetic Nigerian 5G network telemetry from the Electric Sheep Africa catalog.</li>
          <li>Predictions represent pattern-matching on historical training distributions and do not constitute certified telecom carrier provisioning advice.</li>
          <li>No live connection to commercial 5G Core (5GC) NSSF (Network Slice Selection Function) is performed.</li>
          <li>The LLM functions strictly as an explainability and translation agent — it never modifies or chooses the classification output.</li>
        </ul>

        {/* Dataset Attribution */}
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 8,
            border: '1px solid var(--border-soft)',
            fontSize: 12,
            color: 'var(--muted)',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: '#ffffff' }}>Dataset Attribution:</strong>{' '}
          <a
            href="https://huggingface.co/datasets/electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--stat)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'underline' }}
          >
            electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria <ExternalLink size={11} />
          </a>
          <br />Published by Electric Sheep Africa on Hugging Face under Creative Commons Attribution.
        </div>
      </div>
    </div>
  )
}
