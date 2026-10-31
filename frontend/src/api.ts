// Empty base = same origin. In dev, Vite proxies /api to the FastAPI server,
// so the app also works through forwarded/preview URLs.
const API_BASE = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : '';

export interface PredictionRequest {
  // Empty string omits the use case: the backend then averages over all of them.
  use_case: string;
  throughput_mbps: number;
  latency_ms: number;
  reliability_percent: number;
  active_connections: number;
  bandwidth_allocated_mhz: number;
}

export interface PredictionResponse {
  predicted_slice: string;
  class_probabilities: Record<string, number>;
  explanation: string;
  llm_used: boolean;
  warnings: string[];
  feature_values: Record<string, any>;
  feature_importance: Record<string, number>;
  feasibility_score?: number;
  feasibility_reasons?: string[];
}

export interface WhatIfResponse {
  original: { predicted_slice: string; class_probabilities: Record<string, number> };
  modified: { predicted_slice: string; class_probabilities: Record<string, number> };
  changes: Record<string, { from: any; to: any }>;
  slice_changed: boolean;
  explanation: string;
}

export interface ExtractedField {
  value: string | number | null;
  confidence: number;
  evidence: string;
  note: string;
  suggestion?: string | number | null;
}

export interface ExtractionQuestion {
  field: string;
  question: string;
  options: { label: string; value: string | number | null }[];
}

export interface ExtractionResponse {
  success: boolean;
  extracted: Record<string, any>;
  fields: Record<string, ExtractedField>;
  ambiguous: ExtractionQuestion[];
  missing_fields: string[];
  suggestions: Record<string, any>;
  app_name?: string;
  app_description?: string;
  text_preview?: string;
  source?: string;
  llm_used?: boolean;
  error?: string | null;
}

export interface RequirementSample {
  id: string;
  filename: string;
  title: string;
  description: string;
}

export interface RequirementSampleDetail extends RequirementSample {
  text: string;
  download_url: string;
}

export interface ModelInfo {
  dataset_source: string;
  dataset_note: string;
  total_rows_used: number;
  num_features: number;
  feature_names: string[];
  numeric_features: string[];
  categorical_features: string[];
  target_column: string;
  class_names: string[];
  split_sizes: { train: number; validation: number; test: number };
  class_distribution: Record<string, number>;
  validation_metrics: { accuracy: number; macro_f1: number };
  test_metrics: {
    accuracy: number;
    macro_f1: number;
    per_class_precision: Record<string, number>;
    per_class_recall: Record<string, number>;
    confusion_matrix: number[][];
  };
  feature_importance: Record<string, number>;
  model_params: Record<string, any>;
  training_time_seconds: number;
  model_version: string;
  trained_at: string;
  feature_ranges: Record<string, { min: number; max: number; mean: number; std: number }>;
  use_case_values: string[];
}

export interface FeatureSchema {
  features: string[];
  numeric_features: string[];
  categorical_features: string[];
  feature_ranges: Record<string, { min: number; max: number; mean: number; std: number }>;
  use_case_values: string[];
  class_names: string[];
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: isFormData ? options?.headers : { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API Error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => fetchAPI<{ status: string; model_loaded: boolean; llm_configured: boolean }>('/api/health'),

  getModelInfo: () => fetchAPI<ModelInfo>('/api/model-info'),

  getFeatureSchema: () => fetchAPI<FeatureSchema>('/api/feature-schema'),

  predict: (data: PredictionRequest) =>
    fetchAPI<PredictionResponse>('/api/predict', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  extractRequirements: (description: string) =>
    fetchAPI<ExtractionResponse>('/api/extract-requirements', {
      method: 'POST',
      body: JSON.stringify({ description }),
    }),

  extractRequirementsFile: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return fetchAPI<ExtractionResponse>('/api/extract-requirements-file', {
      method: 'POST',
      body,
    });
  },

  listSamples: () => fetchAPI<{ samples: RequirementSample[] }>('/api/sample-requirements'),

  getSample: (id: string) => fetchAPI<RequirementSampleDetail>(`/api/sample-requirements/${id}`),

  sampleDownloadUrl: (id: string) => `${API_BASE}/api/sample-requirements/${id}/download`,

  whatIf: (original: PredictionRequest, modified: PredictionRequest) =>
    fetchAPI<WhatIfResponse>('/api/what-if', {
      method: 'POST',
      body: JSON.stringify({ original, modified }),
    }),

  setApiKey: (apiKey: string) =>
    fetchAPI<{ success: boolean; llm_configured: boolean }>('/api/set-api-key', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey }),
    }),
};
