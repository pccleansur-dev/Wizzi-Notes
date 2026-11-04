export type NoteType = 'audio' | 'video' | 'pdf' | 'text';

export interface Note {
  id: string;
  title: string;
  createdAt: string;
  type: NoteType;
  fileName?: string;

  transcription: string;
  summary: string;
  decisions: string[];
  actionItems: string[];
  duration?: string;
  wordsCount?: number;
  isFavorite?: boolean;
  extendedMinutes?: string;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export type ActiveTab = 'dashboard' | 'transcribe' | 'notes' | 'files-chat' | 'settings';

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'local';

export interface AIProviderConfig {
  provider: AIProvider;
  models: {
    gemini: string;
    openai: string;
    anthropic: string;
    local: string;
  };
}

export const DEFAULT_PROVIDER_CONFIG: AIProviderConfig = {
  provider: 'local',
  models: {
    gemini: 'gemini-2.0-flash',
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-6',
    local: 'llama3.2:3b',
  },
};

export const PROVIDER_OPTIONS = {
  gemini: {
    label: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    supportsAudio: true,
    supportsPDF: true,
    supportsYoutube: false,
    envVar: 'GEMINI_API_KEY',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    supportsAudio: true,
    supportsPDF: false,
    supportsYoutube: false,
    envVar: 'OPENAI_API_KEY',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  anthropic: {
    label: 'Anthropic Claude',
    models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
    supportsAudio: false,
    supportsPDF: true,
    supportsYoutube: false,
    envVar: 'ANTHROPIC_API_KEY',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  local: {
    label: 'Local (Llama.cpp)',
    models: ['llama3.2:3b', 'llama3.1:8b', 'mistral:7b'],
    supportsAudio: true,
    supportsPDF: true,
    supportsYoutube: false,
    envVar: '',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
} as const;

export type GpuProfile = 'cpu' | 'npu' | '1650' | '3080';

export type QuantLevel = 'q2_K' | 'q3_K_M' | 'q4_K_M' | 'q5_K_M';

export interface CapabilityScores {
  resumen: number;
  notas: number;
  traduccion: number;
  instrucciones: number;
  velocidad: number;
}

export interface QuantInfo {
  multiplier: number;
  label: string;
  description: string;
  color: string;
  /** Score modifier 0-1 applied to model base scores */
  scoreModifier: number;
}

export const QUANT_OPTIONS: Record<QuantLevel, QuantInfo> = {
  q2_K:   { multiplier: 0.54, label: 'Q2',   description: 'Ultra liviano — calidad reducida',    color: 'text-red-400',   scoreModifier: 0.55 },
  q3_K_M: { multiplier: 0.67, label: 'Q3',   description: 'Liviano — buena calidad',             color: 'text-amber-400', scoreModifier: 0.75 },
  q4_K_M: { multiplier: 1.00, label: 'Q4 ★', description: 'Estándar — balance óptimo (default)', color: 'text-tertiary',  scoreModifier: 1.00 },
  q5_K_M: { multiplier: 1.16, label: 'Q5',   description: 'Alta calidad — más VRAM',             color: 'text-blue-400',  scoreModifier: 1.08 },
};

/** Combine model base scores + quant modifier, clamped 1–5 */
export function effectiveScores(base: CapabilityScores, quant: QuantLevel): CapabilityScores {
  const mod = QUANT_OPTIONS[quant].scoreModifier;
  const clamp = (v: number) => Math.min(5, Math.max(1, Math.round(v * mod)));
  return {
    resumen:       clamp(base.resumen),
    notas:         clamp(base.notas),
    traduccion:    clamp(base.traduccion),
    instrucciones: clamp(base.instrucciones),
    velocidad:     clamp(base.velocidad),   // speed is inverse to quality mods
  };
}

export interface LocalModel {
  id: string;
  label: string;
  params: string;
  sizeGbQ4: number;
  vramGb: number;
  description: string;
  recommended: GpuProfile[];
  ggufBase: string;
  hfRepo: string;
  /** Base capability scores at Q4_K_M */
  scores: CapabilityScores;
}

/** Build the GGUF filename for a model + quant level */
export function ggufFilename(m: LocalModel, quant: QuantLevel): string {
  const q = quant === 'q4_K_M' ? 'Q4_K_M'
          : quant === 'q3_K_M' ? 'Q3_K_M'
          : quant === 'q2_K'   ? 'Q2_K'
          : 'Q5_K_M';
  return `${m.ggufBase}-${q}.gguf`;
}

/** HuggingFace direct download URL */
export function ggufDownloadUrl(m: LocalModel, quant: QuantLevel): string {
  return `https://huggingface.co/${m.hfRepo}/resolve/main/${ggufFilename(m, quant)}`;
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'gemma2-2b', label: 'Gemma 2', params: '2B', sizeGbQ4: 1.6, vramGb: 2,
    description: 'El más liviano. Ideal para CPU y NPU, respuesta muy rápida.',
    recommended: ['cpu', 'npu', '1650', '3080'],
    ggufBase: 'gemma-2-2b-it', hfRepo: 'bartowski/gemma-2-2b-it-GGUF',
    scores: { resumen: 2, notas: 2, traduccion: 2, instrucciones: 2, velocidad: 5 },
  },
  {
    id: 'llama3.2-3b', label: 'Llama 3.2', params: '3B', sizeGbQ4: 2.0, vramGb: 2.5,
    description: 'Rápido y equilibrado. Excelente para resúmenes y minutas.',
    recommended: ['cpu', 'npu', '1650', '3080'],
    ggufBase: 'Llama-3.2-3B-Instruct', hfRepo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    scores: { resumen: 3, notas: 3, traduccion: 3, instrucciones: 3, velocidad: 4 },
  },
  {
    id: 'qwen2.5-3b', label: 'Qwen 2.5', params: '3B', sizeGbQ4: 1.9, vramGb: 2.5,
    description: 'Muy bueno en español e instrucciones estructuradas.',
    recommended: ['npu', '1650', '3080'],
    ggufBase: 'Qwen2.5-3B-Instruct', hfRepo: 'bartowski/Qwen2.5-3B-Instruct-GGUF',
    scores: { resumen: 3, notas: 3, traduccion: 4, instrucciones: 3, velocidad: 4 },
  },
  {
    id: 'phi3-mini', label: 'Phi-3 Mini', params: '3.8B', sizeGbQ4: 2.3, vramGb: 3,
    description: 'De Microsoft. Excelente razonamiento con bajo consumo de VRAM.',
    recommended: ['npu', '1650', '3080'],
    ggufBase: 'Phi-3-mini-4k-instruct', hfRepo: 'bartowski/Phi-3-mini-4k-instruct-GGUF',
    scores: { resumen: 3, notas: 4, traduccion: 2, instrucciones: 5, velocidad: 3 },
  },
  {
    id: 'mistral-7b', label: 'Mistral', params: '7B', sizeGbQ4: 4.1, vramGb: 5.5,
    description: 'Muy bueno en texto técnico y análisis de decisiones.',
    recommended: ['1650', '3080'],
    ggufBase: 'Mistral-7B-Instruct-v0.3', hfRepo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF',
    scores: { resumen: 4, notas: 4, traduccion: 3, instrucciones: 4, velocidad: 2 },
  },
  {
    id: 'qwen2.5-7b', label: 'Qwen 2.5', params: '7B', sizeGbQ4: 4.7, vramGb: 5.5,
    description: 'Versión potente. Mejor comprensión en español.',
    recommended: ['1650', '3080'],
    ggufBase: 'Qwen2.5-7B-Instruct', hfRepo: 'bartowski/Qwen2.5-7B-Instruct-GGUF',
    scores: { resumen: 4, notas: 4, traduccion: 5, instrucciones: 4, velocidad: 2 },
  },
  {
    id: 'llama3.1-8b', label: 'Llama 3.1', params: '8B', sizeGbQ4: 4.7, vramGb: 6,
    description: 'Gran calidad de síntesis. El tope recomendado para 1650.',
    recommended: ['1650', '3080'],
    ggufBase: 'Meta-Llama-3.1-8B-Instruct', hfRepo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    scores: { resumen: 5, notas: 4, traduccion: 3, instrucciones: 4, velocidad: 2 },
  },
  {
    id: 'gemma2-9b', label: 'Gemma 2', params: '9B', sizeGbQ4: 5.4, vramGb: 7,
    description: 'Versión completa de Google. Máxima calidad en la línea Gemma.',
    recommended: ['3080'],
    ggufBase: 'gemma-2-9b-it', hfRepo: 'bartowski/gemma-2-9b-it-GGUF',
    scores: { resumen: 5, notas: 5, traduccion: 4, instrucciones: 5, velocidad: 1 },
  },
];
