import { useState, useEffect, useRef } from 'react'
import {
  Send,
  Sparkles,
  AlertTriangle,
  Loader2,
  X,
  Upload,
  FileText,
  Download,
  HelpCircle,
  Check,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  api,
  type PredictionRequest,
  type PredictionResponse,
  type FeatureSchema,
  type ExtractionResponse,
  type RequirementSample,
} from '../api'

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

type NumericField =
  | 'throughput_mbps'
  | 'latency_ms'
  | 'reliability_percent'
  | 'active_connections'
  | 'bandwidth_allocated_mhz'

const NUMERIC_FIELDS: NumericField[] = [
  'throughput_mbps',
  'latency_ms',
  'reliability_percent',
  'active_connections',
  'bandwidth_allocated_mhz',
]

// Selecting this in the use case list leaves the use case out of the prediction.
const NONE_USE_CASE = '__none__'

interface QuickOption {
  label: string
  value: number
}

interface FieldConfig {
  label: string
  unit: string
  step: number
  min: number
  max: number
  sliderMin: number
  sliderMax: number
  sliderStep: number
  quick: QuickOption[]
}

const FIELD_CONFIG: Record<NumericField, FieldConfig> = {
  throughput_mbps: {
    label: 'Throughput',
    unit: 'Mbps',
    step: 0.1,
    min: 0,
    max: 100000,
    sliderMin: 1,
    sliderMax: 1000,
    sliderStep: 1,
    quick: [
      { label: 'Very low', value: 5 },
      { label: 'Low', value: 25 },
      { label: 'Medium', value: 100 },
      { label: 'High', value: 500 },
      { label: 'Very high', value: 2000 },
    ],
  },
  latency_ms: {
    label: 'Latency',
    unit: 'ms',
    step: 0.1,
    min: 0,
    max: 10000,
    sliderMin: 1,
    sliderMax: 200,
    sliderStep: 1,
    quick: [
      { label: 'Very low', value: 5 },
      { label: 'Low', value: 10 },
      { label: 'Medium', value: 30 },
      { label: 'High', value: 100 },
      { label: 'Very high', value: 300 },
    ],
  },
  reliability_percent: {
    label: 'Reliability',
    unit: '%',
    step: 0.001,
    min: 0,
    max: 100,
    sliderMin: 90,
    sliderMax: 99.999,
    sliderStep: 0.001,
    quick: [
      { label: '95%', value: 95 },
      { label: '99%', value: 99 },
      { label: '99.9%', value: 99.9 },
      { label: '99.99%', value: 99.99 },
      { label: '99.999%', value: 99.999 },
    ],
  },
  active_connections: {
    label: 'Active Connections',
    unit: '',
    step: 1,
    min: 0,
    max: 10000000,
    sliderMin: 1,
    sliderMax: 10000,
    sliderStep: 1,
    quick: [
      { label: 'A few', value: 10 },
      { label: 'A few hundred', value: 500 },
      { label: 'Thousands', value: 5000 },
      { label: 'Hundreds of thousands', value: 100000 },
    ],
  },
  bandwidth_allocated_mhz: {
    label: 'Bandwidth Allocated',
    unit: 'MHz',
    step: 1,
    min: 0,
    max: 100000,
    sliderMin: 1,
    sliderMax: 100,
    sliderStep: 1,
    quick: [
      { label: 'Very low', value: 10 },
      { label: 'Low', value: 20 },
      { label: 'Medium', value: 40 },
      { label: 'High', value: 80 },
      { label: 'Very high', value: 160 },
    ],
  },
}

const EXAMPLE_PROMPT =
  'We stream 4K product demos and live cloud gaming sessions to remote users. Each session needs about 65 Mbps, latency under 15 ms, 99.9% reliability and roughly 500 concurrent connections.'

const emptyValues = (): Record<NumericField, number | null> => ({
  throughput_mbps: null,
  latency_ms: null,
  reliability_percent: null,
  active_connections: null,
  bandwidth_allocated_mhz: null,
})

const emptyUnknown = (): Record<NumericField, boolean> => ({
  throughput_mbps: false,
  latency_ms: false,
  reliability_percent: false,
  active_connections: false,
  bandwidth_allocated_mhz: false,
})

function numericSuggestion(entry?: { suggestion?: string | number | null } | null) {
  return typeof entry?.suggestion === 'number' ? entry.suggestion : null
}

function formatNumber(field: string, value: number) {
  if (field === 'active_connections' || field === 'bandwidth_allocated_mhz') {
    return value.toLocaleString()
  }
  return String(value)
}

function formatFeatureValue(field: string, value: unknown, unknown = false) {
  if (unknown) return "Don't know"
  if (field === 'use_case') {
    if (!value) return 'None of these'
    return String(value).replace(/_/g, ' ')
  }
  if (value === null || value === undefined || value === '') return 'Not set'
  const num = Number(value)
  if (!Number.isFinite(num)) return 'Not set'
  return formatNumber(field, num)
}

interface NumericFieldControlProps {
  field: NumericField
  value: number | null
  unknown: boolean
  suggestion?: number | null
  range?: { min: number; max: number; mean: number; std: number }
  onChange: (value: number | null) => void
  onToggleUnknown: () => void
}

function NumericFieldControl({
  field,
  value,
  unknown,
  suggestion,
  range,
  onChange,
  onToggleUnknown,
}: NumericFieldControlProps) {
  const config = FIELD_CONFIG[field]
  const inputRef = useRef<HTMLInputElement>(null)
  const answered = value !== null && !unknown
  const anchor = value ?? suggestion ?? range?.mean ?? config.sliderMin
  const sliderValue = Math.min(Math.max(anchor, config.sliderMin), config.sliderMax)

  return (
    <div className="form-group">
      <div className="field-label-row">
        <label className="form-label" style={{ marginBottom: 0 }}>
          {config.label} {config.unit && <span className="form-sublabel">({config.unit})</span>}
        </label>
        <button
          type="button"
          className={`dont-know-btn ${unknown ? 'active' : ''}`}
          onClick={onToggleUnknown}
          aria-pressed={unknown}
          title="Use the dataset average for this parameter and flag it in the result"
        >
          {unknown ? <Check size={11} /> : <HelpCircle size={11} />}
          Don't know
        </button>
      </div>

      {!answered && (
        <div className="quick-ask">
          <span className="quick-ask-title">{config.label}?</span>
          <div className="chip-row">
            {config.quick.map(option => (
              <button
                key={option.label}
                type="button"
                className="chip"
                onClick={() => onChange(option.value)}
              >
                {option.label}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => inputRef.current?.focus()}>
              I'll enter it myself
            </button>
            <button
              type="button"
              className={`chip ${unknown ? 'active' : ''}`}
              onClick={onToggleUnknown}
            >
              Don't know
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        className="form-input"
        type="number"
        min={config.min}
        max={config.max}
        step={config.step}
        placeholder={unknown ? "Don't know — dataset average will be used" : 'Not set'}
        value={unknown || value === null ? '' : value}
        disabled={unknown}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      />

      {!answered && suggestion !== null && suggestion !== undefined && (
        <span className="suggestion-hint">
          Most likely ~{formatNumber(field, suggestion)} {config.unit} — move the slider to use it.
        </span>
      )}
      {(answered || suggestion === null || suggestion === undefined) && range && (
        <span className="form-hint">
          Typical range: {range.min.toLocaleString()} – {range.max.toLocaleString()} {config.unit}
        </span>
      )}

      <input
        className="mini-slider"
        type="range"
        aria-label={`${config.label} slider`}
        min={config.sliderMin}
        max={config.sliderMax}
        step={config.sliderStep}
        value={sliderValue}
        disabled={unknown}
        onChange={e => onChange(parseFloat(Number(e.target.value).toFixed(3)))}
      />
    </div>
  )
}

export default function PredictPage() {
  const [schema, setSchema] = useState<FeatureSchema | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [error, setError] = useState('')
  const [schemaError, setSchemaError] = useState('')

  // Every parameter starts unset so nothing is predicted from assumptions.
  const [useCase, setUseCase] = useState(NONE_USE_CASE)
  const [values, setValues] = useState<Record<NumericField, number | null>>(emptyValues)
  const [unknown, setUnknown] = useState<Record<NumericField, boolean>>(emptyUnknown)
  const [assumedFields, setAssumedFields] = useState<{ field: NumericField; value: number }[]>([])

  // Requirements document state
  const [nlpText, setNlpText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractionResponse | null>(null)
  const [uploadedName, setUploadedName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [samples, setSamples] = useState<RequirementSample[]>([])
  const [loadingSample, setLoadingSample] = useState('')
  const [dismissedQuestions, setDismissedQuestions] = useState<string[]>([])
  const [showExample, setShowExample] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getFeatureSchema()
      .then(setSchema)
      .catch((e) => setSchemaError(e.message))
  }, [])

  useEffect(() => {
    api.listSamples()
      .then(res => setSamples(res.samples))
      .catch(() => setSamples([]))
  }, [])

  const missingFields = NUMERIC_FIELDS.filter(f => values[f] === null && !unknown[f])
  const canPredict = missingFields.length === 0
  const canExtract = nlpText.trim().length >= 10

  const updateField = (field: NumericField, value: number | null) => {
    setValues(prev => ({ ...prev, [field]: value }))
    if (value !== null) {
      setUnknown(prev => ({ ...prev, [field]: false }))
    }
  }

  const toggleUnknown = (field: NumericField) => {
    setUnknown(prev => {
      const next = { ...prev, [field]: !prev[field] }
      if (next[field]) {
        setValues(vals => ({ ...vals, [field]: null }))
      }
      return next
    })
  }

  const clearDocument = () => {
    setUploadedName('')
    setExtracted(null)
    setDismissedQuestions([])
    setAssumedFields([])
  }

  const applyExtraction = (res: ExtractionResponse) => {
    setExtracted(res)
    setDismissedQuestions([])
    setResult(null)
    setAssumedFields([])

    const nextValues = emptyValues()
    for (const field of NUMERIC_FIELDS) {
      const value = res.fields?.[field]?.value
      if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
        nextValues[field] = Number(value)
      }
    }
    const nextUseCase = res.fields?.use_case?.value
    setValues(nextValues)
    setUnknown(emptyUnknown())
    setUseCase(nextUseCase ? String(nextUseCase) : NONE_USE_CASE)
  }

  const handleExtractText = async () => {
    setExtracting(true)
    setError('')
    try {
      const res = await api.extractRequirements(nlpText)
      setUploadedName('')
      applyExtraction(res)
      if (!res.success) setError(res.error || 'No parameters could be extracted. Fill the form below.')
    } catch (e: any) {
      setError(e.message || 'Extraction failed. Fill the form manually.')
    } finally {
      setExtracting(false)
    }
  }

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return
    if (!/\.(txt|md|markdown|pdf)$/i.test(file.name)) {
      setError('Unsupported file. Upload a .txt, .md or .pdf document.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File is larger than 5 MB. Upload a shorter document.')
      return
    }
    setExtracting(true)
    setError('')
    try {
      const res = await api.extractRequirementsFile(file)
      setUploadedName(file.name)
      applyExtraction(res)
      if (!res.success) setError(res.error || 'No parameters could be extracted. Fill the form below.')
    } catch (e: any) {
      setError(e.message || 'Could not read that file.')
    } finally {
      setExtracting(false)
    }
  }

  const handleSample = async (sample: RequirementSample) => {
    setExtracting(true)
    setLoadingSample(sample.id)
    setError('')
    try {
      const detail = await api.getSample(sample.id)
      setUploadedName(detail.filename)
      const res = await api.extractRequirements(detail.text)
      applyExtraction(res)
      if (!res.success) setError(res.error || 'No parameters could be extracted from this sample.')
    } catch (e: any) {
      setError(e.message || 'Could not load that sample.')
    } finally {
      setExtracting(false)
      setLoadingSample('')
    }
  }

  const answerQuestion = (field: string, value: string | number | null) => {
    setDismissedQuestions(prev => [...prev, field])
    if (field === 'use_case') {
      if (typeof value === 'string') setUseCase(value)
      return
    }
    const numericField = field as NumericField
    if (value === null) {
      setUnknown(prev => ({ ...prev, [numericField]: true }))
      setValues(prev => ({ ...prev, [numericField]: null }))
    } else {
      setValues(prev => ({ ...prev, [numericField]: Number(value) }))
      setUnknown(prev => ({ ...prev, [numericField]: false }))
    }
  }

  const handlePredict = async () => {
    if (!canPredict) return
    const payload = {
      use_case: useCase === NONE_USE_CASE ? '' : useCase,
      throughput_mbps: 0,
      latency_ms: 0,
      reliability_percent: 0,
      active_connections: 0,
      bandwidth_allocated_mhz: 0,
    } as PredictionRequest

    const assumed: { field: NumericField; value: number }[] = []
    for (const field of NUMERIC_FIELDS) {
      if (values[field] !== null) {
        payload[field] = values[field] as number
        continue
      }
      const fallback = schema?.feature_ranges?.[field]?.mean ?? FIELD_CONFIG[field].quick[0].value
      const rounded = field === 'active_connections' || field === 'bandwidth_allocated_mhz'
        ? Math.round(fallback)
        : Number(fallback.toFixed(2))
      payload[field] = rounded
      assumed.push({ field, value: rounded })
    }
    setAssumedFields(assumed)

    setLoading(true)
    setError('')
    try {
      const res = await api.predict(payload)
      setResult(res)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const pendingQuestions = (extracted?.ambiguous || []).filter(q => {
    if (dismissedQuestions.includes(q.field)) return false
    if (q.field === 'use_case') return useCase === NONE_USE_CASE
    const field = q.field as NumericField
    if (!NUMERIC_FIELDS.includes(field)) return false
    return values[field] === null && !unknown[field]
  })

  const extractedCount = extracted
    ? NUMERIC_FIELDS.filter(f => extracted.fields?.[f]?.value !== null && extracted.fields?.[f]?.value !== undefined).length +
      (extracted.fields?.use_case?.value ? 1 : 0)
    : 0

  const useCaseSuggestion = extracted?.fields?.use_case?.suggestion

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
              <div className="card-subtitle">Upload a requirements file or set the network constraints</div>
            </div>
          </div>

          {extracted && (
            <div className={`alert ${extractedCount > 0 ? 'alert-success' : 'alert-warning'}`} style={{ marginBottom: 16 }}>
              <Sparkles size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {extractedCount > 0
                  ? `Read ${extractedCount} of 6 parameters from the document. Review the values and answer what is left.`
                  : 'The document was read but no parameters were clear enough to autofill. Fill the form below.'}
              </span>
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Requirements document upload */}
          <div className="form-group">
            <label className="form-label">
              Requirements document <span className="form-sublabel">(optional · .txt, .md or .pdf · max 5 MB)</span>
            </label>
            <div
              className={`upload-zone ${dragging ? 'dragging' : ''} ${extracting ? 'busy' : ''}`}
              onClick={() => !extracting && fileInputRef.current?.click()}
              onDragOver={e => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault()
                setDragging(false)
                if (!extracting) handleFile(e.dataTransfer.files?.[0])
              }}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && !extracting) {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              {extracting ? (
                <>
                  <Loader2 size={20} className="spinner" />
                  <span>Reading requirements and extracting parameters…</span>
                </>
              ) : uploadedName ? (
                <div className="uploaded-file">
                  <FileText size={14} />
                  <span>{uploadedName}</span>
                  <button
                    type="button"
                    className="uploaded-file-x"
                    aria-label={`Remove ${uploadedName}`}
                    onClick={e => {
                      e.stopPropagation()
                      clearDocument()
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={20} />
                  <span>
                    Drop a file here or <strong>browse</strong>
                  </span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,.pdf"
              style={{ display: 'none' }}
              onChange={e => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            {samples.length > 0 && (
              <div className="sample-row">
                <span className="sample-row-label">Use an example:</span>
                {samples.map(sample => (
                  <span key={sample.id} className="sample-chip">
                    <button
                      type="button"
                      className="sample-chip-load"
                      onClick={() => handleSample(sample)}
                      disabled={extracting}
                      title={sample.description}
                    >
                      {loadingSample === sample.id && <Loader2 size={11} className="spinner" />}
                      {sample.title}
                    </button>
                    <a
                      href={api.sampleDownloadUrl(sample.id)}
                      download
                      className="sample-chip-download"
                      title={`Download ${sample.filename}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <Download size={11} />
                    </a>
                  </span>
                ))}
              </div>
            )}
          </div>

          {extracted?.text_preview && (
            <details className="document-preview">
              <summary>Read document text</summary>
              <pre>{extracted.text_preview}</pre>
            </details>
          )}

          {/* Optional pasted description */}
          <div className="form-group">
            <label className="form-label">
              Or paste requirements <span className="form-sublabel">(optional)</span>
            </label>
            <textarea
              className="form-textarea"
              value={nlpText}
              onChange={e => setNlpText(e.target.value)}
              style={{ minHeight: 96 }}
            />
            <div className="example-row">
              {showExample && !nlpText && (
                <button
                  type="button"
                  className="example-toggle"
                  onClick={() => {
                    setNlpText(EXAMPLE_PROMPT)
                    setShowExample(false)
                  }}
                >
                  <Sparkles size={12} />
                  Use an example
                </button>
              )}
              <button
                className="btn btn-ghost"
                style={{ height: 42, marginLeft: 'auto' }}
                onClick={handleExtractText}
                disabled={extracting || !canExtract}
              >
                {extracting ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>Extracting…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Autofill from Text</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="form-divider">
            <span>Network Constraints</span>
          </div>

          {pendingQuestions.length > 0 && (
            <div className="question-block" style={{ marginBottom: 18 }}>
              <div className="question-title">
                <HelpCircle size={14} />
                <span>We need a little more detail</span>
              </div>
              {pendingQuestions.map(question => (
                <div key={question.field} className="question-item">
                  <div className="question-text">{question.question}</div>
                  <div className="chip-row">
                    {question.options.map(option => (
                      <button
                        key={`${question.field}-${option.label}`}
                        type="button"
                        className="chip"
                        onClick={() => answerQuestion(question.field, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Telecom Use Case</label>
            <select
              className="form-select"
              value={useCase}
              onChange={e => setUseCase(e.target.value)}
            >
              <option value={NONE_USE_CASE}>None of these — decide from the other parameters</option>
              {schema?.use_case_values.map(v => (
                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
              ))}
            </select>
            {useCase === NONE_USE_CASE && useCaseSuggestion && (
              <span className="suggestion-hint">
                The document suggested “{String(useCaseSuggestion).replace(/_/g, ' ')}” — pick it above if that is right.
              </span>
            )}
          </div>

          <div className="grid-2">
            <NumericFieldControl
              field="throughput_mbps"
              value={values.throughput_mbps}
              unknown={unknown.throughput_mbps}
              suggestion={numericSuggestion(extracted?.fields?.throughput_mbps)}
              range={schema?.feature_ranges.throughput_mbps}
              onChange={v => updateField('throughput_mbps', v)}
              onToggleUnknown={() => toggleUnknown('throughput_mbps')}
            />
            <NumericFieldControl
              field="latency_ms"
              value={values.latency_ms}
              unknown={unknown.latency_ms}
              suggestion={numericSuggestion(extracted?.fields?.latency_ms)}
              range={schema?.feature_ranges.latency_ms}
              onChange={v => updateField('latency_ms', v)}
              onToggleUnknown={() => toggleUnknown('latency_ms')}
            />
          </div>

          <div className="grid-2">
            <NumericFieldControl
              field="reliability_percent"
              value={values.reliability_percent}
              unknown={unknown.reliability_percent}
              suggestion={numericSuggestion(extracted?.fields?.reliability_percent)}
              range={schema?.feature_ranges.reliability_percent}
              onChange={v => updateField('reliability_percent', v)}
              onToggleUnknown={() => toggleUnknown('reliability_percent')}
            />
            <NumericFieldControl
              field="active_connections"
              value={values.active_connections}
              unknown={unknown.active_connections}
              suggestion={numericSuggestion(extracted?.fields?.active_connections)}
              range={schema?.feature_ranges.active_connections}
              onChange={v => updateField('active_connections', v)}
              onToggleUnknown={() => toggleUnknown('active_connections')}
            />
          </div>

          <NumericFieldControl
            field="bandwidth_allocated_mhz"
            value={values.bandwidth_allocated_mhz}
            unknown={unknown.bandwidth_allocated_mhz}
            suggestion={numericSuggestion(extracted?.fields?.bandwidth_allocated_mhz)}
            range={schema?.feature_ranges.bandwidth_allocated_mhz}
            onChange={v => updateField('bandwidth_allocated_mhz', v)}
            onToggleUnknown={() => toggleUnknown('bandwidth_allocated_mhz')}
          />

          {!canPredict && (
            <p className="form-hint" style={{ marginBottom: 8, color: '#fbbf24' }}>
              Still needed: {missingFields.map(f => FEATURE_LABELS[f]).join(', ')} — answer above or mark them “Don’t know”.
            </p>
          )}

          <button
            className="btn btn-solid"
            style={{ width: '100%', height: 46 }}
            onClick={handlePredict}
            disabled={loading || !canPredict}
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
                Upload a requirements document or fill every network constraint on the left, then run the classifier.
              </p>
            </div>
          )}

          {/* Warnings */}
          {result && (result.warnings.length > 0 || assumedFields.length > 0) && (
            <div style={{ marginBottom: 16 }}>
              {assumedFields.length > 0 && (
                <div className="alert alert-warning" style={{ marginBottom: 8 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    Marked “Don’t know”, so the dataset average was used:{' '}
                    {assumedFields.map(({ field, value }) => `${FEATURE_LABELS[field]} ${value.toLocaleString()}`).join(', ')}.
                  </span>
                </div>
              )}
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
            <div className="card-title" style={{ marginBottom: 14, fontSize: 15 }}>
              Slice Confidence Probabilities
            </div>
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

            <div className="prob-bar-container">
              <div className="prob-bar-label">
                <span className="none-of-these-label">
                  <AlertTriangle size={12} />
                  None of these
                </span>
                <span>
                  {result ? `${Math.round((result.feasibility_score ?? 0) * 100)}%` : '—'}
                </span>
              </div>
              <div className="prob-bar-track">
                <div
                  className="prob-bar-fill none"
                  style={{ width: result ? `${(result.feasibility_score ?? 0) * 100}%` : 0 }}
                />
              </div>
              {result && (result.feasibility_reasons?.length ?? 0) > 0 && (
                <ul className="none-of-these-reasons">
                  {result.feasibility_reasons?.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>

            <p className="form-hint" style={{ marginTop: 10 }}>
              “None of these” is a plausibility check on the requirements themselves, not a fourth model class.
            </p>
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
              const current = field === 'use_case'
                ? (useCase === NONE_USE_CASE ? '' : useCase)
                : (values as unknown as Record<string, unknown>)[field]
              return (
                <div key={field} className="feature-row">
                  <span className="feature-row-label">{label}</span>
                  <span className="feature-row-value">
                    {formatFeatureValue(field, current, field !== 'use_case' && unknown[field as NumericField])}
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
