import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BarChart, 
  Mic, 
  FileText, 
  MessageSquare, 
  Settings, 
  HelpCircle, 
  Plus, 
  Search, 
  Bell, 
  History, 
  Sparkles, 
  Users, 
  Star, 
  CheckCircle2, 
  Eye, 
  Menu,
  Clock,
  Database,
  Grid,
  List,
  ArrowRight,
  TrendingUp,
  Workflow,
  X,
  User,
  MoreVertical,
  Paperclip,
  ZoomIn,
  ZoomOut,
  Play,
  Share2,
  FileDown,
  Download,
  FolderOpen,
  Calendar,
  ChevronRight,
  Check,
  Upload,
  Trash2,
  AlertTriangle,
  Square,
  Maximize2,
  Minimize2,
  Cpu,
} from 'lucide-react';
import { Note, ActiveTab, AIProviderConfig, AIProvider, AsrProvider, DEFAULT_PROVIDER_CONFIG, PROVIDER_OPTIONS, LOCAL_MODELS, GpuProfile, QuantLevel, QUANT_OPTIONS, ggufFilename, ggufDownloadUrl, effectiveScores, CapabilityScores } from './types';
import UploadZone from './components/UploadZone';
import TranscriptView from './components/TranscriptView';
import AIChatSidebar from './components/AIChatSidebar';
import WaveformCanvas from './components/WaveformCanvas';
import SetupScreen from './components/SetupScreen';
import SettingsKeyForm from './components/SettingsKeyForm';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import { motion, AnimatePresence } from 'motion/react';
import { getAllNotes, saveNote, deleteNoteFromDB, clearAllNotes, importNotes } from './lib/db';
import { exportToPDF } from './lib/pdfGenerator';

// Seed Notes for Initial Local State
const SEED_NOTES: Note[] = [
  /*
  {
    id: 'seed-1',
    title: 'Sincronización Estrategia Q4: Rendimiento Móvil',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    type: 'audio',
    transcription: `Orador 1 [00:15]: Hola a todos, gracias por estar aquí. Hoy revisaremos la sincronización para el lanzamiento de la estrategia Q4 y el rendimiento de la app móvil.\n\nOrador 2 [00:35]: Hola. Respecto a ingeniería, necesitamos centrarnos en reducir la latencia en nuestro motor de transcripción. El retraso actual de 2 segundos es aceptable para notas estáticas, pero desfasa en vivo.\n\nOrador 1 [01:10]: De acuerdo. Propongo que aumentemos el presupuesto de ingeniería en un 15% para acelerar el desarrollo del RAG local.\n\nOrador 3 [01:45]: Me parece genial. Yo me encargaré de redactar el borrador del plan de lanzamiento para la región EMEA y estimar las fechas para fin de noviembre.\n\nOrador 1 [02:20]: Excelente, James, ¿podrías ayudarnos a actualizar el presupuesto para este viernes?\n\nOrador 2 [02:35]: Hecho. Yo lo tendré listo de inmediato.`,
    summary: 'Se discutió el próximo lanzamiento de la aplicación móvil y la necesidad de optimizar el motor de transcripción en tiempo real para dispositivos de baja latencia. El equipo acordó priorizar las mejoras operativas del pipeline conversacional.',
    decisions: [
      'Aumentar el presupuesto de ingeniería en un 15% para el desarrollo de procesamiento RAG local.',
      'Lanzar primero en versión beta cerrada para la región EMEA a finales de noviembre.'
    ],
    actionItems: [
      'James Wilson: Actualizar las hojas de presupuesto Q4 y presentarlas el viernes.',
      'Sarah Jenkins: Redactar el borrador del plan de lanzamiento para EMEA.',
      'Alex Rivera: Planificar la auditoría de seguridad de los endpoints de la API.'
    ],
    duration: '45:12',
    wordsCount: 2400,
    isFavorite: true,
  },
  {
    id: 'seed-2',
    title: 'Revisión de Código: Módulo Auth API',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    type: 'video',
    transcription: `Orador 1 [00:10]: Buenos días. Hoy revisaremos la seguridad de nuestra Auth API y la implementación de JWT.\n\nOrador 2 [00:45]: Perfecto. He seleccionado una rotación de claves RSA de 2048 bits para máxima protección en cada sesión.\n\nOrador 1 [01:15]: ¿Qué hay de la migración de bases de datos legadas?\n\nOrador 2 [01:50]: Recomiendo hacer una migración gradual de sesiones a memoria protegida para evitar fugas de información.`,
    summary: 'Resumen de las recomendaciones de seguridad implementadas en la API de autenticación. Se detalló la transición a tokens protegidos y encriptación de datos en reposo para cumplir con estándares bancarios.',
    decisions: [
      'Utilizar JWT con rotación de claves RSA de 2048 bits para la sesión activa.',
      'Migrar las bases de datos de sesión legadas a la memoria local protegida.'
    ],
    actionItems: [
      'Alex Rivera: Implementar la rotación automática de claves en el servidor backend.',
      'Equipo de QA: Iniciar pruebas de esfuerzo en los nuevos endpoints el próximo lunes.'
    ],
    duration: '12:45',
    wordsCount: 520,
    isFavorite: false,
  },
  {
    id: 'seed-3',
    title: 'Reporte de Ingresos Q3: Crecimiento Enterprise',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    type: 'pdf',
    transcription: `Texto del PDF Extraído:\nSección 1: Resumen de Ingresos del Q3.\nEl total de ingresos escaló un 12% trimestral, impulsado primordialmente por las ventas corporativas de cuentas de alto rendimiento.\n\nSección 2: Renovaciones Enterprise.\nAlcanzamos una tasa de renovación del 98.2% para clientes de prestigio Fortune 500, superando ampliamente las metas establecidas al inicio del año.`,
    summary: 'Análisis detallado de los rendimientos comerciales correspondientes al tercer trimestre. El crecimiento del 12% trimestral ha sido guiado exitosamente por renovaciones Enterprise estables y la introducción del asistente IA.',
    decisions: [
      'Establecer un objetivo de renovación de clientes Fortune 500 superior al 98% para el próximo año.',
      'Duplicar el gasto en marketing digital enfocado en captación corporativa.'
    ],
    actionItems: [
      'James Rivera: Presentar el desglose final de gastos de captación comercial.',
      'Sarah Jenkins: Organizar llamada de seguimiento con el equipo de ventas Enterprise.'
    ],
    duration: 'PDF',
    wordsCount: 140,
    isFavorite: false,
  }
  */
];

// Resample audio blob to 16kHz mono WAV — optimal format for Whisper
async function resampleToWav(blob: Blob): Promise<{ base64: string; mimeType: string }> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    // Mix down to mono
    const numFrames = decoded.length;
    const offlineCtx = new OfflineAudioContext(1, numFrames, 16000);
    const src = offlineCtx.createBufferSource();
    src.buffer = decoded;
    src.connect(offlineCtx.destination);
    src.start(0);
    const rendered = await offlineCtx.startRendering();
    await audioCtx.close();

    // Encode to 16-bit PCM WAV
    const pcm = rendered.getChannelData(0);
    const wavBuffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(wavBuffer);
    const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);   // PCM
    view.setUint16(22, 1, true);   // mono
    view.setUint32(24, 16000, true); // sample rate
    view.setUint32(28, 32000, true); // byte rate
    view.setUint16(32, 2, true);   // block align
    view.setUint16(34, 16, true);  // bits per sample
    writeStr(36, 'data');
    view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) {
      view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    }
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    const reader = new FileReader();
    const base64 = await new Promise<string>(resolve => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(wavBlob);
    });
    return { base64, mimeType: 'audio/wav' };
  } catch {
    // Fallback: send original if resampling fails
    const reader = new FileReader();
    const base64 = await new Promise<string>(resolve => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });
    return { base64, mimeType: blob.type || 'audio/webm' };
  }
}

const TAG_COLORS = [
  'bg-primary/15 text-primary border-primary/25',
  'bg-secondary/15 text-secondary border-secondary/25',
  'bg-tertiary/15 text-tertiary border-tertiary/25',
  'bg-amber-400/15 text-amber-400 border-amber-400/25',
  'bg-blue-400/15 text-blue-400 border-blue-400/25',
  'bg-pink-400/15 text-pink-400 border-pink-400/25',
];
function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function NoteTagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [adding, setAdding] = React.useState(false);
  const [input, setInput] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commitTag = () => {
    const val = input.trim().toLowerCase().replace(/\s+/g, '-');
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-sm border-b border-white/5 mb-0">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${tagColor(tag)}`}
        >
          #{tag}
          <button
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="opacity-50 hover:opacity-100 transition-opacity ml-0.5 cursor-pointer"
          >
            <X size={9} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag(); }
            if (e.key === 'Escape') { setInput(''); setAdding(false); }
          }}
          onBlur={commitTag}
          placeholder="etiqueta..."
          className="px-2 py-0.5 rounded-full border border-primary/40 bg-primary/5 text-primary text-[11px] font-bold outline-none w-24 placeholder:text-primary/30"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-white/15 text-on-surface-variant/40 text-[11px] hover:border-primary/40 hover:text-primary/60 transition-colors cursor-pointer"
        >
          <Plus size={9} /> Etiqueta
        </button>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={`Copiar ${label || ''}`}
      className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer shrink-0
        border-white/10 text-on-surface-variant hover:border-primary/30 hover:text-primary"
    >
      {copied ? <Check size={10} /> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function NoteExtendedCollapse({ content }: { content: string }) {
  const [open, setOpen] = React.useState(false);

  // Extract only the final synthesis (after ✦ MINUTA FINAL separator)
  const finalPart = content.includes('MINUTA FINAL')
    ? content.split(/✦\s*MINUTA FINAL[^\n]*/)[1]?.trim() ?? content
    : content;

  // Render extendedMinutes with basic markdown-like formatting
  const renderLine = (line: string, idx: number) => {
    if (/^##\s+/.test(line)) {
      return <p key={idx} className="text-primary font-bold text-xs uppercase tracking-widest mt-4 mb-1">{line.replace(/^##\s+/, '')}</p>;
    }
    if (/^\*\*(.+?)\*\*$/.test(line.trim())) {
      return <p key={idx} className="text-on-surface font-bold text-xs uppercase tracking-wider mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>;
    }
    if (/^- \[ \]/.test(line)) {
      return <p key={idx} className="text-tertiary text-xs pl-2">☐ {line.replace(/^- \[ \]\s*/, '')}</p>;
    }
    if (/^[-•]/.test(line.trim())) {
      return <p key={idx} className="text-on-surface-variant/90 text-xs pl-2">· {line.replace(/^[-•]\s*/, '')}</p>;
    }
    if (/^▸/.test(line)) {
      return <p key={idx} className="text-primary/60 font-bold text-[10px] mt-3">{line}</p>;
    }
    if (/^━+/.test(line) || /^✦/.test(line)) {
      return <p key={idx} className="text-primary/40 text-[10px] tracking-widest">{line}</p>;
    }
    if (!line.trim()) return <div key={idx} className="h-1" />;
    return <p key={idx} className="text-on-surface-variant/80 text-xs leading-relaxed">{line}</p>;
  };

  return (
    <div className="pt-md border-t border-white/5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left group"
      >
        <h4 className="font-bold text-tertiary/80 tracking-wide text-xs uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-tertiary/50 inline-block" />
          Minuta en Tiempo Real
        </h4>
        <span className="text-[10px] text-tertiary/40 border border-tertiary/20 rounded px-2 py-0.5 group-hover:border-tertiary/40 transition-colors">
          {open ? 'Ocultar ▲' : 'Ver ▼'}
        </span>
      </button>
      {open && (
        <div className="mt-3 bg-[#0d0d0d] p-4 rounded-lg border border-white/5 max-h-96 overflow-y-auto custom-scrollbar space-y-0.5">
          {finalPart.split('\n').map((line, idx) => renderLine(line, idx))}
        </div>
      )}
    </div>
  );
}

function NoteTranscriptCollapse({ transcription }: { transcription: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="pt-md border-t border-white/5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left group"
      >
        <h4 className="font-bold text-on-surface-variant tracking-wide text-xs uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-on-surface-variant/40 inline-block" />
          Transcripción Completa
        </h4>
        <span className="text-[10px] text-on-surface-variant/50 border border-white/10 rounded px-2 py-0.5 group-hover:border-white/20 transition-colors">
          {open ? 'Ocultar ▲' : 'Ver ▼'}
        </span>
      </button>
      {open && (
        <div className="mt-3 bg-[#1c1b1b] p-3 rounded-lg border border-white/5 max-h-72 overflow-y-auto custom-scrollbar font-mono text-[11px] text-on-surface-variant/80 leading-relaxed whitespace-pre-wrap">
          {transcription || 'Sin contenido de audio registrado.'}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [setupDone, setSetupDone] = useState<boolean | null>(null);
  const [authState, setAuthState] = useState<{ user: any; authRequired: boolean } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mobileFileView, setMobileFileView] = useState<'explorer' | 'document' | 'chat'>('document');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [userName, setUserName] = useState(() => localStorage.getItem('wizzi_username') || 'Alex Dev');
  const [userPlan, setUserPlan] = useState('Plan Pro');
  const [providerConfig, setProviderConfig] = useState<AIProviderConfig>(() => {
    try {
      const saved = localStorage.getItem('wizzi_provider_config');
      return saved ? JSON.parse(saved) : DEFAULT_PROVIDER_CONFIG;
    } catch {
      return DEFAULT_PROVIDER_CONFIG;
    }
  });
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [gpuProfile, setGpuProfile] = useState<GpuProfile>(() =>
    (localStorage.getItem('wizzi_gpu_profile') as GpuProfile) || '1650'
  );

  const [loadedModel, setLoadedModel] = useState<string>('');
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
  const [whisperInfo, setWhisperInfo] = useState<{ model: string; available: boolean } | null>(null);
  const [asrProvider, setAsrProvider] = useState<AsrProvider>(() =>
    localStorage.getItem('wizzi_asr_provider') === 'nemotron' ? 'nemotron' : 'whisper'
  );
  const [asrStatus, setAsrStatus] = useState<{
    whisper: { model: string; available: boolean };
    nemotron: { model: string; available: boolean };
  } | null>(null);
  const [whisperSwitching, setWhisperSwitching] = useState<string | null>(null);
  const [whisperHint, setWhisperHint] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'ok' | 'warn' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, tone: 'ok' | 'warn' = 'ok') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  const [modelDownloads, setModelDownloads] = useState<Record<string, { state: 'idle'|'downloading'|'done'|'error'; percent: number; error: string }>>({});
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  // modelId -> filename of the quant actually downloaded (any quant)
  const [downloadedByModel, setDownloadedByModel] = useState<Record<string, string>>({});
  const [activatingModel, setActivatingModel] = useState<string | null>(null);
  const [hwInfo, setHwInfo] = useState<{ gpuName: string|null; vramMb: number|null; cpuName: string|null; ramMb: number|null; profile: GpuProfile; detectedBy: string[]; envOverrides?: Record<string,string>; hasHwJson?: boolean; agentRunning?: boolean } | null>(null);
  const [hwDetecting, setHwDetecting] = useState(false);
  const [hwEditOpen, setHwEditOpen] = useState(false);
  const [hwForm, setHwForm] = useState({ HOST_CPU: '', HOST_GPU: '', HOST_VRAM_GB: '', HOST_RAM_GB: '' });
  const [hwSaving, setHwSaving] = useState(false);

  // Fetch currently loaded llama.cpp model when settings tab is open
  const fetchLoadedModel = useCallback(() => {
    fetch('/api/llamacpp/model')
      .then(r => r.json())
      .then(d => setLoadedModel(d.model || ''))
      .catch(() => {});
    fetch('/api/whisper/model')
      .then(r => r.json())
      .then(d => setWhisperInfo(d))
      .catch(() => {});
    fetch('/api/asr/status')
      .then(r => r.json())
      .then(d => setAsrStatus(d))
      .catch(() => {});
  }, []);

  const detectHardware = useCallback(async () => {
    setHwDetecting(true);
    try {
      const r = await fetch('/api/hardware');
      const d = await r.json();
      // Normalize numeric fields to avoid NaN in render
      const hw = {
        gpuName:    d.gpuName    ?? null,
        vramMb:     d.vramMb    != null ? Number(d.vramMb)   : null,
        cpuName:    d.cpuName    ?? null,
        ramMb:      d.ramMb     != null ? Number(d.ramMb)    : null,
        profile:    (d.profile as GpuProfile) || 'cpu',
        detectedBy: Array.isArray(d.detectedBy) ? d.detectedBy : [],
      };
      setHwInfo(hw);
      if (hw.profile) setGpuProfile(hw.profile);
      if (hw.envOverrides) setHwForm({ HOST_CPU: hw.envOverrides.HOST_CPU || hw.cpuName || '', HOST_GPU: hw.envOverrides.HOST_GPU || hw.gpuName || '', HOST_VRAM_GB: hw.envOverrides.HOST_VRAM_GB || (hw.vramMb ? String((hw.vramMb/1024).toFixed(0)) : ''), HOST_RAM_GB: hw.envOverrides.HOST_RAM_GB || (hw.ramMb ? String((hw.ramMb/1024).toFixed(0)) : '') });
    } catch (e) {
      console.error('[detectHardware]', e);
    } finally {
      setHwDetecting(false);
    }
  }, []);
  const [copiedPull, setCopiedPull] = useState<string | null>(null);
  const [quantLevel, setQuantLevel] = useState<QuantLevel>(() =>
    (localStorage.getItem('wizzi_quant_level') as QuantLevel) || 'q4_K_M'
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Storage mode
  const [storageMode, setStorageMode] = useState<'local' | 'drive'>(() =>
    (localStorage.getItem('wizzi_storage_mode') as 'local' | 'drive') || 'local'
  );
  const [driveSync, setDriveSync] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [storageEstimate, setStorageEstimate] = useState<{ used: number; quota: number }>({ used: 0, quota: 1 });
  
  // Create blank note state
  const [newTitle, setNewTitle] = useState('');
  const [newTranscription, setNewTranscription] = useState('');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingHeights, setRecordingHeights] = useState<number[]>(Array(40).fill(15));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const initChunkRef = useRef<Blob | null>(null);
  const liveTranscriptionRef = useRef<string>('');
  // Rolling buffer: small blobs accumulate here between flushes
  const rollingBufferRef = useRef<Blob[]>([]);
  // Ordered result assembly: batch index → text (out-of-order Whisper replies land here)
  const batchIndexRef = useRef(0);
  const batchResultsRef = useRef<Map<number, string>>(new Map());
  const nextExpectedBatchRef = useRef(0);
  // Flush interval ref (replaces old transcriptionQueueRef)
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track in-flight promises so stop() can await them all
  const inFlightRef = useRef<Set<Promise<void>>>(new Set());
  const [liveTranscription, setLiveTranscription] = useState('');
  const [chunksTranscribed, setChunksTranscribed] = useState(0);
  const [inFlightCount, setInFlightCount] = useState(0);

  const formatTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /** Flush ordered results to the live transcript as consecutive batches arrive */
  const flushOrderedResults = useCallback(() => {
    while (batchResultsRef.current.has(nextExpectedBatchRef.current)) {
      const text = batchResultsRef.current.get(nextExpectedBatchRef.current)!;
      batchResultsRef.current.delete(nextExpectedBatchRef.current);
      nextExpectedBatchRef.current++;
      if (text) {
        liveTranscriptionRef.current += (liveTranscriptionRef.current ? ' ' : '') + text;
        setLiveTranscription(liveTranscriptionRef.current);
        setChunksTranscribed((c) => c + 1);
      }
    }
  }, []);

  /**
   * Snapshot the rolling buffer and fire off a parallel Whisper request.
   * The recording keeps going uninterrupted — this is the ping-pong core.
   */
  const flushBuffer = useCallback(() => {
    const chunks = rollingBufferRef.current.splice(0); // drain & reset
    if (chunks.length === 0 || !initChunkRef.current) return;

    const batchIdx = batchIndexRef.current++;
    const batchBlob = new Blob([initChunkRef.current, ...chunks], { type: 'audio/webm' });

    const promise: Promise<void> = (async () => {
      setInFlightCount((c) => c + 1);
      try {
        const { base64, mimeType } = await resampleToWav(batchBlob);
        const res = await fetch('/api/transcribe-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fileData: base64, mimeType, asrProvider }),
          signal: AbortSignal.timeout(28000),
        });
        const text = res.ok ? (JSON.parse(await res.text())?.text?.trim() ?? '') : '';
        batchResultsRef.current.set(batchIdx, text);
      } catch {
        batchResultsRef.current.set(batchIdx, '');
      } finally {
        flushOrderedResults();
        inFlightRef.current.delete(promise);
        setInFlightCount((c) => Math.max(0, c - 1));
      }
    })();

    inFlightRef.current.add(promise);
  }, [flushOrderedResults, asrProvider]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) { handleStopRecording(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Reset all rolling-buffer state
      initChunkRef.current = null;
      liveTranscriptionRef.current = '';
      rollingBufferRef.current = [];
      batchIndexRef.current = 0;
      batchResultsRef.current = new Map();
      nextExpectedBatchRef.current = 0;
      inFlightRef.current = new Set();
      audioChunksRef.current = [];
      setLiveTranscription('');
      setChunksTranscribed(0);

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = (e) => {
        if (e.data.size < 100) return;
        audioChunksRef.current.push(e.data);
        if (!initChunkRef.current) {
          // First miniblob = WebM init segment; save it so every flush is a valid file
          initChunkRef.current = e.data;
        }
        rollingBufferRef.current.push(e.data);
      };
      // 300ms minichunks — smooth waveform + fine-grained buffer control
      recorder.start(300);
      mediaRecorderRef.current = recorder;

      // Flush the rolling buffer to Whisper every 5s — fully parallel with recording
      flushIntervalRef.current = setInterval(flushBuffer, 5000);

      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);

      // WaveformCanvas handles its own rAF loop via analyserRef
    } catch {
      alert('No se pudo acceder al micrófono. Verificá los permisos del navegador.');
    }
  }, [isRecording, flushBuffer]);

  const handleStopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    const recorder = mediaRecorderRef.current;

    // Force emit any buffered miniblobs immediately (avoids 300ms wait)
    try { recorder.requestData(); } catch {}

    // Stop the flush interval — no more periodic snapshots
    if (flushIntervalRef.current) { clearInterval(flushIntervalRef.current); flushIntervalRef.current = null; }

    // Capture duration before timer is cleared
    const capturedSeconds = recordingSeconds;
    const mins = Math.floor(capturedSeconds / 60);
    const secs = capturedSeconds % 60;
    const durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    setRecordingHeights(Array(40).fill(15));

    // Show streaming overlay immediately
    const jobId = crypto.randomUUID();
    handleProcessStarted(jobId);

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());

      // Flush any remaining miniblobs that arrived after the last 5s interval
      flushBuffer();

      // Wait for ALL in-flight parallel Whisper requests to finish
      await Promise.allSettled([...inFlightRef.current]);

      const fullTranscription = liveTranscriptionRef.current;
      setLiveTranscription('');
      setChunksTranscribed(0);
      liveTranscriptionRef.current = '';

      if (!fullTranscription.trim()) {
        handleProcessError('No se detectó audio transcribible en la grabación.');
        return;
      }

      fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerConfig.provider,
          model: providerConfig.models[providerConfig.provider],
          type: 'text',
          text: fullTranscription,
          jobId,
          fileName: `Grabación ${new Date().toLocaleDateString()}`,
          noteType: 'audio',
          duration: durationStr,
        }),
      }).catch((e) => handleProcessError(e.message || 'Error enviando grabación.'));
    };

    recorder.stop();
  }, [providerConfig]);

  // Chequear configuración y autenticación al arrancar
  useEffect(() => {
    Promise.all([
      fetch('/api/config').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
    ]).then(([config, auth]) => {
      setSetupDone(config.gemini || config.openai || config.anthropic);
      setAuthState(auth);
    }).catch(() => {
      setSetupDone(false);
      setAuthState({ user: null, authRequired: false });
    });
  }, []);

  // Load notes on mount from IndexedDB (or fallback to localStorage as a backup)
  useEffect(() => {
    async function loadNotes() {
      try {
        let dbNotes = await getAllNotes();
        if (dbNotes.length === 0) {
          // Seed the IndexedDB for initial polished experience
          for (const note of SEED_NOTES) {
            await saveNote(note);
          }
          dbNotes = [...SEED_NOTES];
        }
        setNotes(dbNotes);
        if (dbNotes.length > 0) {
          setSelectedNote(dbNotes[0]);
        }
      } catch (err) {
        console.error("IndexedDB error, falling back to localStorage", err);
        const saved = localStorage.getItem('wizzi_notes');
        const fallback = saved ? JSON.parse(saved) : SEED_NOTES;
        setNotes(fallback);
        if (fallback.length > 0) {
          setSelectedNote(fallback[0]);
        }
      }
    }
    loadNotes();
  }, []);

  // Save notes backup dynamically to localStorage
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('wizzi_notes', JSON.stringify(notes));
    }
  }, [notes]);

  // Measure real storage usage
  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        setStorageEstimate({ used: usage || 0, quota: quota || 1 });
      });
    }
  }, [notes]);

  // Auto-sync to Drive when mode is 'drive' and notes change
  useEffect(() => {
    if (activeTab === 'settings') {
      fetchLoadedModel();
    }
  }, [activeTab, fetchLoadedModel]);

  // Check which model files are already downloaded (any quant level)
  useEffect(() => {
    if (activeTab !== 'settings') return;
    let cancelled = false;
    (async () => {
      const found = new Set<string>();
      const byModel: Record<string, string> = {};
      const quants = Object.keys(QUANT_OPTIONS) as QuantLevel[];
      await Promise.all(LOCAL_MODELS.map(async (m) => {
        // Check current quant first (so it's preferred), then the rest
        const ordered = [quantLevel, ...quants.filter(q => q !== quantLevel)];
        for (const q of ordered) {
          const fn = ggufFilename(m, q);
          try {
            const r = await fetch(`/api/llamacpp/exists/${encodeURIComponent(fn)}`, { credentials: 'include' });
            const d = await r.json();
            if (d.exists) {
              found.add(fn);
              if (!byModel[m.id]) byModel[m.id] = fn; // remember first found (prefers current quant)
            }
          } catch {}
        }
      }));
      if (!cancelled) { setDownloadedSet(found); setDownloadedByModel(byModel); }
    })();
    return () => { cancelled = true; };
  }, [activeTab, quantLevel]);

  useEffect(() => {
    if (activeTab === 'settings' && !hwInfo && !hwDetecting) {
      detectHardware();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (storageMode !== 'drive' || notes.length === 0) return;
    const timer = setTimeout(async () => {
      setDriveSync('syncing');
      try {
        const res = await fetch('/api/drive/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        });
        if (!res.ok) throw new Error();
        setDriveSync('idle');
      } catch {
        setDriveSync('error');
      }
    }, 1500); // debounce 1.5s
    return () => clearTimeout(timer);
  }, [notes, storageMode]);

  // Load from Drive when switching to drive mode
  const switchStorageMode = async (mode: 'local' | 'drive') => {
    localStorage.setItem('wizzi_storage_mode', mode);
    setStorageMode(mode);
    if (mode === 'drive') {
      setDriveSync('syncing');
      try {
        const res = await fetch('/api/drive/load');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.notes) && data.notes.length > 0) {
            await importNotes(data.notes);
            setNotes(data.notes);
            setSelectedNote(data.notes[0]);
          }
        }
        setDriveSync('idle');
      } catch {
        setDriveSync('error');
      }
    }
  };



  const [isTranscribing, setIsTranscribing] = useState(false);
  const [processProgress, setProcessProgress] = useState<{ message: string; percent: number; current?: number; total?: number } | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const progressESRef = useRef<EventSource | null>(null);
  const streamingContainerRef = useRef<HTMLDivElement | null>(null);
  const tokenBufferRef = useRef<string>('');
  const tokenFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollForResult = useCallback(async (jobId: string) => {
    const maxAttempts = 60; // poll up to 5 min (every 5s)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/result/${jobId}`);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.stage === 'done' && data.result) {
          if (tokenFlushTimerRef.current) { clearInterval(tokenFlushTimerRef.current); tokenFlushTimerRef.current = null; }
          handleProcessSuccess({
            transcription: data.result.transcription || '',
            summary: data.result.summary || '',
            decisions: data.result.decisions || [],
            actionItems: data.result.actionItems || [],
            fileName: data.result.fileName,
            type: data.result.noteType || 'text',
            youtubeUrl: data.result.youtubeUrl,
            extendedMinutes: data.result.extendedMinutes,
            duration: data.result.duration,
          });
          return;
        }
        if (data.stage === 'error') {
          handleProcessError(data.message || 'Error procesando.');
          return;
        }
        // stage === 'pending' → keep polling
      } catch {}
    }
    handleProcessError('Tiempo de espera agotado. Intentá de nuevo.');
  }, []);

  const handleProcessStarted = (jobId?: string) => {
    setIsTranscribing(true);
    setStreamingText('');
    tokenBufferRef.current = '';
    setProcessProgress({ message: 'Iniciando...', percent: 0 });

    // Flush buffered tokens to state every 50ms — prevents React from choking on 146 t/s
    if (tokenFlushTimerRef.current) clearInterval(tokenFlushTimerRef.current);
    tokenFlushTimerRef.current = setInterval(() => {
      if (tokenBufferRef.current) {
        const chunk = tokenBufferRef.current;
        tokenBufferRef.current = '';
        setStreamingText((prev) => {
          const next = prev + chunk;
          setTimeout(() => {
            if (streamingContainerRef.current)
              streamingContainerRef.current.scrollTop = streamingContainerRef.current.scrollHeight;
          }, 0);
          return next;
        });
      }
    }, 50);

    if (jobId) {
      const es = new EventSource(`/api/progress/${jobId}`);
      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.stage === 'streaming') {
          tokenBufferRef.current += data.token;
          return;
        }
        setProcessProgress({ message: data.message, percent: data.percent, current: data.current, total: data.total });
        if (data.stage === 'done') {
          es.close();
          progressESRef.current = null;
          if (data.result) {
            handleProcessSuccess({
              transcription: data.result.transcription || '',
              summary: data.result.summary || '',
              decisions: data.result.decisions || [],
              actionItems: data.result.actionItems || [],
              fileName: data.result.fileName,
              type: data.result.noteType || 'text',
              youtubeUrl: data.result.youtubeUrl,
              extendedMinutes: data.result.extendedMinutes,
              duration: data.result.duration,
              generatedTitle: data.result.generatedTitle,
            });
          } else {
            setIsTranscribing(false);
          }
        } else if (data.stage === 'error') {
          es.close();
          progressESRef.current = null;
          handleProcessError(data.message || 'Error procesando.');
        }
      };
      es.onerror = () => {
        es.close();
        progressESRef.current = null;
        // SSE dropped — poll for result in case processing already finished
        pollForResult(jobId);
      };
      progressESRef.current = es;
    }
  };

  const handleProcessSuccess = (result: {
    transcription: string;
    summary: string;
    decisions: string[];
    actionItems: string[];
    fileName?: string;
    type: 'audio' | 'video' | 'pdf' | 'youtube' | 'text';
    youtubeUrl?: string;
    extendedMinutes?: string;
    duration?: string;
    generatedTitle?: string;
  }) => {
    const autoTitle = result.generatedTitle
      || result.fileName
      || `Grabación ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`;
    const newNote: Note = {
      id: Math.random().toString(),
      title: autoTitle,
      createdAt: new Date().toISOString(),
      type: result.type,
      transcription: result.transcription,
      summary: result.summary,
      decisions: result.decisions,
      actionItems: result.actionItems,
      fileName: result.fileName,
      youtubeUrl: result.youtubeUrl,
      duration: result.duration ?? (result.type === 'pdf' ? 'PDF' : undefined),
      wordsCount: result.transcription.split(/\s+/).length,
      isFavorite: false,
      extendedMinutes: result.extendedMinutes,
    };

    if (tokenFlushTimerRef.current) { clearInterval(tokenFlushTimerRef.current); tokenFlushTimerRef.current = null; }
    setIsTranscribing(false);
    setStreamingText('');
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNote(newNote);
    setActiveTab('files-chat');
    saveNote(newNote).catch((e) => console.error("Error guardando en IndexedDB:", e));
  };

  const handleProcessError = (errorMsg: string) => {
    if (tokenFlushTimerRef.current) { clearInterval(tokenFlushTimerRef.current); tokenFlushTimerRef.current = null; }
    setIsTranscribing(false);
    setStreamingText('');
    alert(`Error: ${errorMsg}`);
  };

  const updateProviderConfig = (updates: Partial<AIProviderConfig>) => {
    setProviderConfig((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem('wizzi_provider_config', JSON.stringify(next));
      return next;
    });
  };

  const setActiveProvider = (p: AIProvider) => updateProviderConfig({ provider: p });

  const setModelForProvider = (p: AIProvider, model: string) => {
    updateProviderConfig({ models: { ...providerConfig.models, [p]: model } });
  };

  const handleExportBackup = async () => {
    try {
      const allNotes = await getAllNotes();
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        notesCount: allNotes.length,
        notes: allNotes,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wizzi-note-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al exportar el respaldo. Intentá de nuevo.');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const incoming: Note[] = Array.isArray(raw) ? (raw as Note[]) : (raw?.notes as Note[]);
        if (!Array.isArray(incoming) || incoming.length === 0) {
          alert('El archivo no contiene notas válidas.');
          return;
        }
        await importNotes(incoming);
        // Merge en estado: las notas importadas reemplazan si ya existen (mismo id), las nuevas se agregan
        setNotes((prev) => {
          const map = new Map<string, Note>(prev.map((n) => [n.id, n]));
          for (const n of incoming) map.set(n.id, n);
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        alert(`${incoming.length} nota${incoming.length !== 1 ? 's' : ''} importada${incoming.length !== 1 ? 's' : ''} correctamente.`);
      } catch {
        alert('El archivo de respaldo no es válido o está dañado.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAllData = async () => {
    const confirmed = confirm(
      '¿Estás seguro de que querés borrar TODAS las notas y datos locales?\n\nEsta acción es irreversible. Exportá un respaldo antes si querés conservar tu información.'
    );
    if (!confirmed) return;
    try {
      await clearAllNotes();
      localStorage.removeItem('wizzi_notes');
      setNotes([]);
      setSelectedNote(null);
    } catch {
      alert('Error al borrar los datos. Intentá de nuevo.');
    }
  };

  const toggleFavorite = (id: string) => {
    const updatedNotes = notes.map((n) => (n.id === id ? { ...n, isFavorite: !n.isFavorite } : n));
    setNotes(updatedNotes);
    if (selectedNote && selectedNote.id === id) {
      setSelectedNote((prev) => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }
    
    // Update target note in IndexedDB
    const target = updatedNotes.find((n) => n.id === id);
    if (target) {
      saveNote(target).catch((e) => console.error("Error actualizando favorito en IndexedDB:", e));
    }
  };

  const deleteNote = (id: string) => {
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (selectedNote && selectedNote.id === id) {
      setSelectedNote(remaining.length > 0 ? remaining[0] : null);
    }
    deleteNoteFromDB(id).catch((e) => console.error("Error eliminando de IndexedDB:", e));
    setShowDeleteConfirm(false);
  };

  const handleSaveTitle = () => {
    if (!selectedNote || !editTitleValue.trim()) {
      setEditingTitle(false);
      return;
    }
    const updated = { ...selectedNote, title: editTitleValue.trim() };
    setSelectedNote(updated);
    setNotes((prev) => prev.map((n) => n.id === updated.id ? updated : n));
    saveNote(updated).catch((e) => console.error("Error guardando título:", e));
    setEditingTitle(false);
  };

  // Text report download
  const handleExportPDF = (noteToExport: Note) => {
    const content = `========================================================================
                      WIZZI NOTE - REPORTE INTELIGENTE IA
========================================================================
Título: ${noteToExport.title}
Tipo: ${noteToExport.type.toUpperCase()}
Fecha de consulta: ${new Date(noteToExport.createdAt).toLocaleString('es-ES')}
Palabras: ${noteToExport.wordsCount || 0}
========================================================================

1. RESUMEN EJECUTIVO:
------------------------------------------------------------------------
${noteToExport.summary}

2. DECISIONES CLAVE TOMADAS:
------------------------------------------------------------------------
${noteToExport.decisions.map((d, i) => `- [ ] ${d}`).join('\n') || 'No se registraron decisiones directas.'}

3. TAREAS DE ACCIÓN Y RECOMENDACIONES (ACTION ITEMS):
------------------------------------------------------------------------
${noteToExport.actionItems.map((a, i) => `- [ ] ${a}`).join('\n') || 'Sin tareas asignadas.'}

========================================================================
4. TRANSCRIPCIÓN COMPLETA / EXTRACTOR DE TEXTO:
========================================================================
${noteToExport.transcription || 'Sin guion transcrito registrado.'}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${noteToExport.title.toLowerCase().replace(/\s+/g, '_')}_wizzi_report.txt`;
    link.click();
  };

  const handleCreateBlankNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const title = newTitle;
    const text = newTranscription;
    setShowNewNoteModal(false);
    setNewTitle('');
    setNewTranscription('');

    if (text.trim()) {
      const jobId = crypto.randomUUID();
      handleProcessStarted(jobId);
      fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerConfig.provider,
          model: providerConfig.models[providerConfig.provider],
          type: 'text',
          text,
          jobId,
          fileName: title,
          noteType: 'text',
        }),
      }).catch((e) => handleProcessError(e.message || 'Error procesando texto.'));
    } else {
      const newNote: Note = {
        id: Math.random().toString(),
        title,
        createdAt: new Date().toISOString(),
        type: 'text',
        transcription: '',
        summary: '',
        decisions: [],
        actionItems: [],
        wordsCount: 0,
        isFavorite: false,
      };
      setNotes((prev) => [newNote, ...prev]);
      setSelectedNote(newNote);
      setActiveTab('files-chat');
      saveNote(newNote).catch((e) => console.error("Error guardando nota:", e));
    }
  };

  // Calculations for Stats Bento Grid
  const totalNotesCount = notes.length;
  const favoriteNotesCount = notes.filter(n => n.isFavorite).length;
  const totalWords = notes.reduce((acc, n) => acc + (n.wordsCount || 0), 0);
  const totalDecisions = notes.reduce((acc, n) => acc + (n.decisions?.length || 0), 0);
  const totalActionItems = notes.reduce((acc, n) => acc + (n.actionItems?.filter(a => !a.startsWith('⚠️') && !a.startsWith('⏳')).length || 0), 0);

  // Real audio duration: sum note.duration values if parseable, fallback to wordsCount/130wpm
  const audioTranscriptHours = notes
    .filter(n => n.type === 'audio' || n.type === 'video')
    .reduce((acc, n) => {
      const mins = (() => {
        if (!n.duration || n.duration === 'Calculando...') return (n.wordsCount || 0) / 130;
        const m = n.duration.match(/(\d+):(\d+)/);
        if (m) return parseInt(m[1]) + parseInt(m[2]) / 60;
        return (n.wordsCount || 0) / 130;
      })();
      return acc + mins;
    }, 0);
  const audioTranscriptHoursStr = audioTranscriptHours >= 60
    ? `${(audioTranscriptHours / 60).toFixed(1)}h`
    : `${Math.round(audioTranscriptHours)}min`;

  // Notes created this week vs last week
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const notesThisWeek = notes.filter(n => now - new Date(n.createdAt).getTime() < oneWeek).length;
  const notesLastWeek = notes.filter(n => {
    const age = now - new Date(n.createdAt).getTime();
    return age >= oneWeek && age < 2 * oneWeek;
  }).length;
  const notesTrend = notesLastWeek > 0 ? Math.round(((notesThisWeek - notesLastWeek) / notesLastWeek) * 100) : notesThisWeek > 0 ? 100 : 0;

  // Type distribution for chart
  const notesByType = ['audio', 'video', 'pdf', 'text'].map(type => ({
    type,
    count: notes.filter(n => n.type === type).length,
  })).filter(t => t.count > 0);

  // Most active topic: most common word in titles (excluding stopwords)
  const stopwords = new Set(['de', 'el', 'la', 'los', 'las', 'y', 'en', 'a', 'del', 'con', 'para', 'por', 'un', 'una', 'al']);
  const wordFreq: Record<string, number> = {};
  notes.forEach(n => n.title.toLowerCase().split(/\s+/).forEach(w => {
    if (w.length > 3 && !stopwords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1;
  }));
  const topTopic = Object.entries(wordFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Collect all tags across notes for the filter sidebar
  const allTags: string[] = (Array.from(new Set(notes.flatMap((n) => n.tags ?? []))) as string[]).sort();

  const filteredNotes = notes.filter((n) => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          n.transcription.toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedCategory === 'Todas') return matchesSearch;
    // Tag filter: selectedCategory starts with '#'
    if (selectedCategory.startsWith('#')) {
      const tag = selectedCategory.slice(1);
      return matchesSearch && (n.tags || []).includes(tag);
    }
    if (selectedCategory === 'Recientes') {
      const isPast24h = (Date.now() - new Date(n.createdAt).getTime()) < 24 * 60 * 60 * 1000;
      return matchesSearch && isPast24h;
    }
    if (selectedCategory === 'Destacadas' || selectedCategory === 'Favoritos') {
      return matchesSearch && n.isFavorite;
    }
    if (selectedCategory === 'Producto') {
      return matchesSearch && (n.title.toLowerCase().includes('producto') || n.title.toLowerCase().includes('estrategia') || n.title.toLowerCase().includes('marketing'));
    }
    if (selectedCategory === 'Ingeniería') {
      return matchesSearch && (n.title.toLowerCase().includes('código') || n.title.toLowerCase().includes('api') || n.title.toLowerCase().includes('auth') || n.title.toLowerCase().includes('arquitectura'));
    }
    return matchesSearch;
  });

  // Cargando
  if (setupDone === null || authState === null) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Sin API keys → setup inicial
  if (!setupDone) {
    return <SetupScreen onComplete={() => setSetupDone(true)} />;
  }

  // Auth requerida pero no logueado → login con Google
  if (authState.authRequired && !authState.user) {
    return <LoginScreen />;
  }

  // Logueado pero necesita registrar sus propias keys
  if (authState.authRequired && authState.user && (authState as any).needsRegistration) {
    return (
      <RegisterScreen
        user={authState.user}
        onRegistered={() => setAuthState((prev) => prev ? { ...prev, needsRegistration: false } as any : prev)}
      />
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#131313] text-[#e5e2e1] font-sans selection:bg-primary-container selection:text-white" id="wizzi-note-root">

      {isTranscribing && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-start pt-12 px-4 md:px-8 pb-8 gap-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={12} />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-none">Wizzi Note está analizando</p>
              <p className="text-white/50 text-xs mt-0.5 animate-pulse">{processProgress?.message || 'Iniciando...'}</p>
            </div>
            {processProgress?.total && processProgress.total > 1 && (
              <span className="ml-2 text-xs bg-white/10 text-white/60 rounded-full px-2 py-0.5">
                {processProgress.current}/{processProgress.total}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-2xl shrink-0">
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${processProgress?.percent || 0}%` }}
              />
            </div>
          </div>

          {/* Streaming text panel */}
          <div className="w-full max-w-2xl flex-1 min-h-0 bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 shrink-0">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-white/40 font-medium uppercase tracking-widest">
                {streamingText ? 'Minuta generándose en tiempo real' : 'Esperando análisis...'}
              </span>
            </div>
            <div
              ref={streamingContainerRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-sm text-white/80 whitespace-pre-wrap leading-relaxed"
            >
              {streamingText || (
                <span className="text-white/20 italic">El texto aparecerá aquí mientras Llama.cpp lo genera...</span>
              )}
              {streamingText && <span className="inline-block w-2 h-4 bg-primary/80 animate-pulse ml-0.5 align-middle" />}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Navigation with frosted backdrop overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
              className="fixed inset-0 z-50 bg-[#0e0e0e] lg:hidden"
            />
            
            {/* Drawer Container */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-[#1c1b1b] border-r border-white/10 flex flex-col p-md h-full shadow-2xl lg:hidden"
            >
              {/* Drawer Title Block */}
              <div className="flex items-center justify-between pb-md mb-md border-b border-white/5">
                <div className="flex items-center gap-sm">
                  <span className="font-headline text-headline-sm text-primary font-black">Wizzi Note</span>
                  <span className="text-[9px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">PRO</span>
                </div>
                <button 
                  onClick={() => setShowMobileMenu(false)}
                  className="p-1.5 hover:bg-surface-container-high rounded-full text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Account block in Drawer */}
              <div className="bg-[#131313] p-sm rounded-xl border border-white/5 mb-md flex items-center gap-sm">
                {authState?.user?.avatar
                  ? <img referrerPolicy="no-referrer" alt={authState.user.name} src={authState.user.avatar} className="w-10 h-10 rounded-lg border border-white/10 shrink-0" />
                  : <div className="w-10 h-10 rounded-lg border border-primary/20 bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">{(authState?.user?.name || userName).charAt(0).toUpperCase()}</div>
                }
                <div className="min-w-0">
                  <p className="font-bold text-body-sm text-on-surface truncate">{userName}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium truncate">{userPlan}</p>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowNewNoteModal(true);
                }}
                className="w-full py-2.5 mb-md bg-primary text-black hover:bg-primary/95 font-bold text-body-sm rounded-xl flex items-center justify-center gap-sm transition-all shadow-lg shadow-primary-container/20 cursor-pointer"
              >
                <Plus size={16} />
                Nuevas Notas
              </button>

              {/* Navigation Items */}
              <nav className="flex-1 flex flex-col gap-xs">
                {[
                  { id: 'dashboard', label: 'Panel de Control', icon: <BarChart size={18} /> },
                  { id: 'transcribe', label: 'Transcripción', icon: <Mic size={18} /> },
                  { id: 'notes', label: `Notas de Reunión (${notes.length})`, icon: <FileText size={18} /> },
                  { id: 'files-chat', label: 'Chat de Archivos', icon: <MessageSquare size={18} /> },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as ActiveTab);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-md px-md py-3 text-body-sm font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-primary/10 text-primary border-l-4 border-primary font-bold'
                        : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="pt-md border-t border-white/5 mt-auto">
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center gap-md px-md py-3 text-body-sm font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                  }`}
                >
                  <Settings size={18} />
                  Configuración
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Top Application Header */}
      <header className="fixed top-0 w-full z-40 bg-[#131313] border-b border-outline-variant/10 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 shadow-sm shadow-[#7C3AED]/15">
        <div className="flex items-center gap-md">
          <button 
            onClick={() => setShowMobileMenu(true)} 
            className="material-symbols-outlined text-primary hover:bg-surface-container-high transition-colors p-2 rounded-full active:scale-95 duration-200 lg:hidden cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-sm">
            <span className="font-headline text-headline-sm text-primary font-bold tracking-tight">Wizzi Note</span>
            <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-[10px] text-primary px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
              <Sparkles size={11} className="animate-spin text-primary" />
              Plan Pro
            </div>
          </div>
        </div>

        {/* Global search input */}
        <div className="hidden md:flex items-center bg-surface-container-high px-md py-xs rounded-full border border-white/5 w-96 relative focus-within:border-primary/50 transition-all duration-250">
          <Search size={16} className="text-on-surface-variant mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Buscar notas, archivos o transcripciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-body-sm text-on-surface w-full focus:outline-none focus:ring-0"
          />
          {searchQuery && (
            <X 
              size={14} 
              className="text-on-surface-variant hover:text-white cursor-pointer" 
              onClick={() => setSearchQuery('')}
            />
          )}
        </div>

        {/* Profile and indicators */}
        <div className="flex items-center gap-md">
          <div className="hidden md:flex items-center gap-md mr-4 text-xs font-semibold text-on-surface-variant">
            <span onClick={() => setActiveTab('dashboard')} className="cursor-pointer hover:text-primary transition-colors">Workspace</span>
            <span onClick={() => setActiveTab('settings')} className="cursor-pointer hover:text-primary transition-colors">Ajustes</span>
          </div>
          <div
            onClick={() => setActiveTab('settings')}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/20 cursor-pointer hover:border-primary/50 transition-colors active:scale-95 duration-200 shrink-0"
            title={authState?.user?.name || userName}
          >
            {authState?.user?.avatar
              ? <img referrerPolicy="no-referrer" alt={authState.user.name} src={authState.user.avatar} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm">{(authState?.user?.name || userName).charAt(0).toUpperCase()}</div>
            }
          </div>
        </div>
      </header>

      {/* Main Grid: Navigation Drawer + Core Work Area + Interactive Side RAG Chat */}
      <div className="flex h-[calc(100vh-4rem)] mt-16 relative" id="workspace-grid">
        
        {/* Left Drawer Navigation */}
        <aside className="w-72 border-r border-white/10 flex flex-col bg-surface-container shrink-0 h-full hidden lg:flex shadow-xl transition-all duration-300">
          <div className="p-lg flex flex-col gap-sm border-b border-white/5">
            <div className="flex items-center gap-md mb-md">
              {authState?.user?.avatar ? (
                <img
                  referrerPolicy="no-referrer"
                  alt={authState.user.name}
                  src={authState.user.avatar}
                  className="w-12 h-12 rounded-xl border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl border border-white/10 bg-primary/10 flex items-center justify-center text-primary font-black text-lg shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-body-md text-on-surface truncate">
                  {authState?.user?.name || userName}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {authState?.user?.email || userPlan}
                </p>
              </div>
              {authState?.user && (
                <button
                  onClick={async () => {
                    await fetch('/auth/logout', { method: 'POST' });
                    window.location.reload();
                  }}
                  title="Cerrar sesión"
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors shrink-0 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              )}
            </div>

            <button
              onClick={() => setShowNewNoteModal(true)}
              className="w-full py-3 px-md bg-primary text-[#001a42] hover:bg-primary/95 font-bold text-body-sm rounded-xl flex items-center justify-center gap-sm active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary-container/20"
              id="sidebar-btn-new-note"
            >
              <Plus size={16} />
              Nuevas Notas
            </button>
          </div>

          <nav className="flex-1 p-md flex flex-col gap-xs">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-md px-lg py-3 text-body-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-primary-container/15 text-primary border-l-4 border-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
              }`}
            >
              <BarChart size={18} />
              Panel de Control
            </button>

            <button
              onClick={() => setActiveTab('transcribe')}
              className={`w-full flex items-center gap-md px-lg py-3 text-body-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'transcribe'
                  ? 'bg-primary-container/15 text-primary border-l-4 border-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
              }`}
            >
              <Mic size={18} />
              Transcripción
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`w-full flex items-center gap-md px-lg py-3 text-body-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-primary-container/15 text-primary border-l-4 border-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
              }`}
            >
              <FileText size={18} />
              Notas de Reunión ({notes.length})
            </button>

            <button
              onClick={() => setActiveTab('files-chat')}
              className={`w-full flex items-center gap-md px-lg py-3 text-body-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'files-chat'
                  ? 'bg-primary-container/15 text-primary border-l-4 border-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
              }`}
            >
              <MessageSquare size={18} />
              Chat de Archivos
            </button>
          </nav>

          <div className="mt-auto p-lg border-t border-white/5">
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-md px-lg py-3 text-body-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-primary-container/15 text-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
              }`}
            >
              <Settings size={18} />
              Configuración
            </button>
          </div>
        </aside>

        {/* Central Core Work Window */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto custom-scrollbar bg-[#131313]" style={{ WebkitOverflowScrolling: 'touch' }}>
          
          <AnimatePresence mode="wait">
            
            {/* ====== TAB 1: DASHBOARD (PANEL DE CONTROL) ====== */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="p-md md:p-xl space-y-xl max-w-7xl mx-auto w-full pt-6 pb-8"
              >
                {/* Welcome Header */}
                <div>
                  <h2 className="font-headline text-display-lg text-on-surface font-bold">Buenos días, {userName.split(' ')[0]}</h2>
                  <p className="text-body-lg text-on-surface-variant mt-xs">Tienes {totalNotesCount} transcripciones e informes de negocios listos para escrutinio.</p>
                </div>

                {/* Stats Bento Grid */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md md:gap-lg">
                  <div className="bg-surface-container p-lg rounded-xl border border-white/5 shadow-sm hover:translate-y-[-4px] hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] transition-all duration-300">
                    <div className="flex justify-between items-start mb-sm">
                      <span className="text-primary bg-primary-container/15 p-2.5 rounded-lg border border-primary/20 flex items-center justify-center">
                        <FileText size={20} />
                      </span>
                      {notesTrend !== 0 && (
                        <span className={`text-label-md font-bold ${notesTrend > 0 ? 'text-tertiary' : 'text-red-400'}`}>
                          {notesTrend > 0 ? '+' : ''}{notesTrend}%
                        </span>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-label-md uppercase tracking-wider font-semibold">Notas Totales</p>
                    <h2 className="text-headline-lg font-bold mt-xs">{totalNotesCount}</h2>
                  </div>

                  <div className="bg-surface-container p-lg rounded-xl border border-white/5 shadow-sm hover:translate-y-[-4px] hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] transition-all duration-300">
                    <div className="flex justify-between items-start mb-sm">
                      <span className="text-secondary bg-secondary-container/10 p-2.5 rounded-lg flex items-center justify-center border border-secondary/20">
                        <Mic size={20} />
                      </span>
                    </div>
                    <p className="text-on-surface-variant text-label-md uppercase tracking-wider font-semibold">Audio Transcrito</p>
                    <h2 className="text-headline-lg font-bold mt-xs">{audioTranscriptHoursStr}</h2>
                  </div>

                  <div className="bg-surface-container p-lg rounded-xl border border-white/5 shadow-sm hover:translate-y-[-4px] hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] transition-all duration-300">
                    <div className="flex justify-between items-start mb-sm">
                      <span className={`p-2.5 rounded-lg flex items-center justify-center border ${PROVIDER_OPTIONS[providerConfig.provider].bg} ${PROVIDER_OPTIONS[providerConfig.provider].border}`}>
                        <Sparkles size={20} className={PROVIDER_OPTIONS[providerConfig.provider].color} />
                      </span>
                      <span className={`text-label-md font-bold ${PROVIDER_OPTIONS[providerConfig.provider].color}`}>Activo</span>
                    </div>
                    <p className="text-on-surface-variant text-label-md uppercase tracking-wider font-semibold">Proveedor IA</p>
                    <h2 className="text-headline-md font-bold mt-xs truncate">{PROVIDER_OPTIONS[providerConfig.provider].label}</h2>
                  </div>

                  <div className="bg-primary-container/20 p-lg rounded-xl border border-primary/20 shadow-lg relative overflow-hidden group hover:translate-y-[-4px] hover:shadow-[0_0_20px_rgba(124,58,237,0.25)] transition-all duration-300">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary to-transparent"></div>
                    <p className="text-primary-fixed-dim text-label-md relative z-10 font-bold tracking-widest text-[11px] uppercase">Decisiones Documentadas</p>
                    <h2 className="text-headline-lg font-bold mt-xs text-white relative z-10">{totalDecisions}</h2>
                    <p className="text-xs text-primary/60 relative z-10 mt-1">{totalActionItems} acción{totalActionItems !== 1 ? 'es' : ''} pendiente{totalActionItems !== 1 ? 's' : ''}</p>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="mt-md text-[11px] font-bold text-primary relative z-10 flex items-center gap-xs hover:gap-sm transition-all text-left"
                    >
                      Mejorar Plan <ArrowRight size={12} />
                    </button>
                  </div>
                </section>

                {/* Dashboard grid panel */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                  
                  {/* Left (Colspan 2): Recent Activity Feed */}
                  <div className="lg:col-span-2 space-y-md">
                    <div className="flex items-center justify-between">
                      <h3 className="font-headline text-headline-md text-on-surface">Actividad Reciente</h3>
                      <button onClick={() => setActiveTab('notes')} className="text-primary font-bold text-label-md hover:underline cursor-pointer">Ver Todos</button>
                    </div>

                    {notes.length === 0 ? (
                      /* ── Empty state onboarding ── */
                      <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-surface-container rounded-xl border border-dashed border-white/10">
                        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                          <Mic size={28} className="text-primary" />
                        </div>
                        <h4 className="font-headline text-body-lg font-bold text-on-surface mb-1">Tu primer reporte te espera</h4>
                        <p className="text-body-sm text-on-surface-variant max-w-xs leading-relaxed mb-6">
                          Grabá una reunión, subí un audio o pegá texto. La IA genera el resumen, decisiones y acciones automáticamente.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-sm">
                          <button
                            onClick={() => setActiveTab('transcribe')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl text-body-sm hover:opacity-90 transition-all shadow-[0_4px_20px_rgba(124,58,237,0.3)] cursor-pointer"
                          >
                            <Mic size={15} /> Grabar reunión
                          </button>
                          <button
                            onClick={() => document.querySelector<HTMLElement>('[data-upload-trigger]')?.click()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high border border-white/10 text-on-surface font-bold rounded-xl text-body-sm hover:bg-surface-container-highest transition-all cursor-pointer"
                          >
                            <Upload size={15} /> Subir archivo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-md">
                        {notes.slice(0, 4).map((noteItem) => {
                          const typeStyle: Record<string, { bg: string; icon: React.ReactNode }> = {
                            audio: { bg: 'bg-primary/10 border-primary/20', icon: <Mic size={28} className="text-primary/70" /> },
                            video: { bg: 'bg-secondary/10 border-secondary/20', icon: <Play size={28} className="text-secondary/70" /> },
                            pdf:   { bg: 'bg-tertiary/10 border-tertiary/20', icon: <FileText size={28} className="text-tertiary/70" /> },
                            text:  { bg: 'bg-on-surface-variant/10 border-white/10', icon: <FileText size={28} className="text-on-surface-variant/50" /> },
                          };
                          const ts = typeStyle[noteItem.type] ?? typeStyle.text;

                          return (
                            <div
                              key={noteItem.id}
                              onClick={() => {
                                setSelectedNote(noteItem);
                                setActiveTab('files-chat');
                              }}
                              className="group bg-surface-container p-md md:p-lg rounded-xl border border-white/5 hover:border-primary/30 transition-all flex gap-md cursor-pointer duration-300"
                            >
                              <div className={`w-20 h-20 rounded-lg border shrink-0 flex items-center justify-center ${ts.bg}`}>
                                {ts.icon}
                              </div>
                              <div className="flex-grow min-w-0 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                    noteItem.type === 'pdf'
                                      ? 'bg-secondary/15 text-secondary'
                                      : 'bg-primary/10 text-primary'
                                  }`}>
                                    {noteItem.type}
                                  </span>
                                  <span className="text-label-md text-on-surface-variant font-mono">
                                    {new Date(noteItem.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <h3 className="font-headline text-body-lg text-on-surface font-black truncate mt-1 group-hover:text-primary transition-colors">
                                  {noteItem.title}
                                </h3>
                                <p className="text-on-surface-variant text-body-sm line-clamp-2 mt-0.5 leading-relaxed">
                                  {noteItem.summary || noteItem.transcription.substring(0, 100)}
                                </p>
                                <div className="flex items-center gap-md mt-2 text-[11px] text-on-surface-variant/70 font-semibold font-mono">
                                  <div className="flex items-center gap-1">
                                    <Clock size={11} />
                                    <span>{noteItem.duration || 'Nota'}</span>
                                  </div>
                                  <span className="w-1.5 h-1.5 bg-outline-variant/60 rounded-full" />
                                  <span>{noteItem.wordsCount || 0} palabras</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Meta widgets sidebar */}
                  <div className="space-y-lg">
                    {/* Weekly analytics */}
                    <div className="bg-surface-container rounded-xl p-lg border border-white/5 shadow-sm">
                      <h4 className="font-headline text-body-lg text-on-surface font-bold mb-md">Esta Semana</h4>
                      <div className="space-y-md">
                        <div>
                          <div className="flex justify-between text-label-md mb-xs font-semibold">
                            <span className="text-on-surface-variant">Notas creadas</span>
                            <span className="text-primary">{notesThisWeek}</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full shadow-[0_0_8px_rgba(124,58,237,0.5)]"
                              style={{ width: `${totalNotesCount > 0 ? Math.min(100, Math.round((notesThisWeek / Math.max(totalNotesCount, 1)) * 100)) : 0}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-label-md mb-xs font-semibold">
                            <span className="text-on-surface-variant">Favoritos</span>
                            <span className="text-secondary">{favoriteNotesCount}</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full"
                              style={{ width: `${totalNotesCount > 0 ? Math.min(100, Math.round((favoriteNotesCount / Math.max(totalNotesCount, 1)) * 100)) : 0}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-label-md mb-xs font-semibold">
                            <span className="text-on-surface-variant">Palabras procesadas</span>
                            <span className="text-tertiary">{totalWords.toLocaleString('es')}</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-tertiary rounded-full" style={{ width: `${Math.min(100, Math.round((totalWords / Math.max(totalWords, 50000)) * 100))}%` }} />
                          </div>
                        </div>
                      </div>
                      {topTopic && (
                        <div className="mt-lg pt-lg border-t border-white/5">
                          <p className="text-body-sm text-on-surface-variant">Tema más frecuente:</p>
                          <div className="mt-2 flex items-center gap-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-tertiary" />
                            <span className="font-bold text-body-sm text-on-surface capitalize">{topTopic}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="bg-surface-container rounded-xl p-lg border border-white/5 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl transition-all group-hover:scale-150 pointer-events-none"></div>
                      <h4 className="font-headline text-body-md font-bold mb-md relative z-10">Acciones rápidas</h4>
                      <div className="space-y-sm relative z-10">
                        <button
                          onClick={() => setActiveTab('transcribe')}
                          className="w-full py-2.5 px-md bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary font-semibold text-label-md rounded-xl transition-colors text-left flex items-center gap-sm cursor-pointer"
                        >
                          <Mic size={14} /> Nueva transcripción
                        </button>
                        <button
                          onClick={() => setShowNewNoteModal(true)}
                          className="w-full py-2.5 px-md bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface font-semibold text-label-md rounded-xl transition-colors text-left flex items-center gap-sm cursor-pointer"
                        >
                          <Plus size={14} /> Crear nota manual
                        </button>
                      </div>
                    </div>

                    {/* Notes breakdown */}
                    <div className="p-lg bg-surface-container/50 border border-white/5 rounded-xl space-y-md">
                      <h4 className="text-label-md font-extrabold text-on-surface-variant uppercase tracking-widest">Distribución de notas</h4>
                      <div className="space-y-sm">
                        {(['audio', 'video', 'pdf', 'text'] as const).map((t) => {
                          const count = notes.filter(n => n.type === t).length;
                          const pct = totalNotesCount > 0 ? Math.round((count / totalNotesCount) * 100) : 0;
                          const colors: Record<string, string> = { audio: 'bg-primary', video: 'bg-secondary', pdf: 'bg-tertiary', text: 'bg-on-surface-variant/40' };
                          if (count === 0) return null;
                          return (
                            <div key={t}>
                              <div className="flex justify-between text-label-md mb-xs font-semibold">
                                <span className="text-on-surface-variant uppercase">{t}</span>
                                <span className="text-on-surface font-bold">{count}</span>
                              </div>
                              <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${colors[t]}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                </div>
              </motion.div>
            )}

            {/* ====== TAB 2: TRANSCRIPTION STUDIO ====== */}
            {activeTab === 'transcribe' && (
              <motion.div
                key="transcribe-tab-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-5xl mx-auto space-y-xl p-md md:p-xl w-full pt-6 pb-8 relative"
              >
                <section className="text-center flex flex-col items-center">
                  <div className="mb-md">
                    <span className={`inline-flex items-center gap-sm px-4 py-1.5 rounded-full border text-label-md font-bold transition-all ${
                      isRecording 
                        ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'
                        : 'bg-tertiary/15 text-tertiary border-tertiary/20'
                    }`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-tertiary'}`} />
                      {isRecording ? 'Grabando Audio...' : 'Listo para Transcribir'}
                    </span>
                  </div>

                  <h2 className="font-headline text-display-lg font-bold mb-lg text-on-surface">Asistente de Grabación en Vivo</h2>

                  {/* Waveform graphic recorder */}
                  <div className="relative w-full max-w-3xl bg-surface-container rounded-3xl p-xl mb-xl overflow-hidden shadow-2xl border border-white/5">
                    {/* Atmospheric lights */}
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-tertiary/10 rounded-full blur-[80px]"></div>

                    {/* Live transcription preview */}
                    {isRecording && liveTranscription && (
                      <div className="mb-md px-md text-left">
                        <p className="text-[11px] text-primary/60 font-semibold uppercase tracking-widest mb-1">Transcripción en vivo</p>
                        <p className="text-xs text-on-surface/70 leading-relaxed line-clamp-3">
                          {liveTranscription.slice(-300)}
                        </p>
                      </div>
                    )}

                    {/* Waveform canvas */}
                    <div className="mb-xl px-2">
                      <WaveformCanvas analyser={analyserRef.current} isRecording={isRecording} />
                    </div>

                    {/* Controls dial */}
                    <div className="flex flex-col items-center gap-md">
                      {/* Red recording dot */}
                      <div className="h-6 flex items-center justify-center">
                        <AnimatePresence>
                          {isRecording && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              className="flex items-center gap-2"
                            >
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                              </span>
                              <span className="text-xs font-bold text-red-400 tracking-widest uppercase">Grabando</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="relative cursor-pointer" onClick={handleToggleRecording}>
                        {/* Pulse ring while recording */}
                        {isRecording && (
                          <div className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
                        )}
                        <button className={`relative z-10 w-24 h-24 md:w-28 md:h-28 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                          isRecording
                            ? 'bg-red-500 shadow-red-500/40 text-white'
                            : 'bg-primary shadow-primary/30 text-[#001a42]'
                        }`}>
                          {isRecording
                            ? <Square size={32} fill="currentColor" />
                            : <Mic size={36} fill="currentColor" />
                          }
                        </button>
                      </div>

                      <p className="font-headline text-4xl font-bold font-mono tracking-widest tabular-nums text-on-surface">
                        {formatTimer(recordingSeconds)}
                      </p>
                      {isRecording && (
                        <div className="flex items-center gap-3 text-xs min-h-[20px]">
                          {inFlightCount > 0 && (
                            <span className="flex items-center gap-1.5 text-amber-400/90 font-mono">
                              <svg className="animate-spin shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                              {asrProvider === 'nemotron' ? 'Nemotron' : 'Whisper'} procesando {inFlightCount > 1 ? `×${inFlightCount}` : ''}
                            </span>
                          )}
                          {chunksTranscribed > 0 && (
                            <span className="text-tertiary/80 font-mono">
                              ✓ {chunksTranscribed} batch{chunksTranscribed > 1 ? 'es' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Operational row buttons */}
                    <div className="flex justify-center gap-xl mt-lg">
                      <button
                        onClick={() => document.querySelector<HTMLElement>('[data-upload-trigger]')?.click()}
                        className="flex flex-col items-center gap-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors flex items-center justify-center border border-white/5">
                          <Paperclip size={18} />
                        </div>
                        <span className="text-label-md">Subir Archivo</span>
                      </button>

                      <button
                        onClick={() => {}}
                        className="flex flex-col items-center gap-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors flex items-center justify-center border border-white/5 text-xs font-bold font-mono">
                          ES
                        </div>
                        <span className="text-label-md">Idioma</span>
                      </button>
                    </div>


                  </div>
                </section>

                {/* Grounding and multimodal processing components */}
                <div className="space-y-md">
                  <h3 className="font-headline text-headline-sm text-on-surface">Procesamiento de Archivos y Grounding</h3>
                  <UploadZone
                    providerConfig={providerConfig}
                    asrProvider={asrProvider}
                    onProcessStarted={handleProcessStarted}
                    onProcessError={handleProcessError}
                  />
                </div>
              </motion.div>
            )}

            {/* ====== TAB 3: NOTES OF MEETINGS ====== */}
            {activeTab === 'notes' && (
              <motion.div
                key="notes-tab-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="p-md md:p-xl space-y-xl max-w-7xl mx-auto w-full pt-6 pb-8"
              >
                {/* Header info */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl">
                  <div>
                    <h2 className="font-headline text-headline-lg text-on-surface font-bold">Mis Notas de Reunión</h2>
                    <p className="text-body-md text-on-surface-variant mt-sm">Accede, filtra y administra tus reportes estratégicos construidos localmente.</p>
                  </div>
                  <button 
                    onClick={() => setShowNewNoteModal(true)}
                    className="bg-primary text-[#001a42] px-lg py-3 rounded-xl font-bold flex items-center gap-sm shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={18} />
                    Crear Nota
                  </button>
                </div>

                {/* Filter Chips Scroll Area */}
                <div className="flex items-center gap-sm overscroll-contain overflow-x-auto pb-2 custom-scrollbar">
                  {['Todas', 'Recientes', 'Destacadas', 'Producto', 'Ingeniería'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-5 py-2 rounded-full font-bold text-label-md whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-primary text-[#001a42]'
                          : 'bg-surface-container text-on-surface-variant hover:bg-[#353534] border border-white/5'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  {/* Dynamic tag filters */}
                  {allTags.map((tag) => (
                    <button
                      key={`#${tag}`}
                      onClick={() => setSelectedCategory(`#${tag}`)}
                      className={`px-4 py-2 rounded-full font-bold text-label-md whitespace-nowrap transition-all cursor-pointer border ${
                        selectedCategory === `#${tag}`
                          ? `${tagColor(tag)} opacity-100`
                          : 'bg-surface-container text-on-surface-variant/60 hover:bg-[#353534] border-white/5'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>

                {/* Layout Grid of cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md md:gap-lg">
                  
                  {/* Featured note banner — most recent favorite, or just most recent */}
                  {(() => {
                    const featured = notes.find(n => n.isFavorite) ?? notes[0];
                    if (!featured) return null;
                    const actions = featured.actionItems?.filter(a => !a.startsWith('⚠️') && !a.startsWith('⏳')) ?? [];
                    return (
                      <div
                        onClick={() => { setSelectedNote(featured); setActiveTab('files-chat'); }}
                        className="md:col-span-2 glass-panel p-lg rounded-xl hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] transition-all group cursor-pointer border border-white/10 relative overflow-hidden flex flex-col gap-md duration-300"
                      >
                        <div className="flex justify-between items-start">
                          <span className="flex items-center gap-sm text-[10px] font-bold text-primary tracking-widest uppercase bg-primary-container/10 px-2.5 py-1 rounded">
                            <Sparkles size={12} />
                            {featured.isFavorite ? 'Favorita' : 'Más reciente'}
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-mono">
                            {new Date(featured.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <h3 className="font-headline text-headline-sm text-on-surface group-hover:text-primary transition-colors font-bold">
                          {featured.title}
                        </h3>
                        <p className="text-body-md text-on-surface-variant leading-relaxed line-clamp-3">
                          {featured.summary || featured.transcription.substring(0, 200)}
                        </p>
                        <div className="flex flex-wrap items-center gap-sm">
                          <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-label-md font-bold uppercase">{featured.type}</span>
                          {actions.length > 0 && <span className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-full text-label-md font-bold">{actions.length} acción{actions.length !== 1 ? 'es' : ''}</span>}
                          {featured.wordsCount ? <span className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-full text-label-md font-bold">{featured.wordsCount.toLocaleString('es')} palabras</span> : null}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Render standard notes items */}
                  {filteredNotes.map((noteItem, index) => {
                    return (
                      <div
                        key={noteItem.id}
                        onClick={() => {
                          setSelectedNote(noteItem);
                          setActiveTab('files-chat');
                        }}
                        className="glass-panel p-lg rounded-xl hover:shadow-[0_0_15px_rgba(124,58,237,0.1)] transition-all group cursor-pointer relative overflow-hidden border border-white/5 flex flex-col justify-between h-[250px] hover:border-primary/20 duration-300"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div>
                          <div className="flex justify-between items-start mb-sm">
                            <span className="flex items-center gap-xs text-[10px] font-bold text-on-surface-variant font-mono uppercase bg-white/5 px-2.5 py-0.5 rounded">
                              {noteItem.type}
                            </span>
                            <span className="text-label-md text-on-surface-variant">
                              {new Date(noteItem.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          
                          <h3 className="font-headline text-body-lg text-on-surface font-black line-clamp-1 mb-2 group-hover:text-primary transition-colors">
                            {noteItem.title}
                          </h3>
                          <p className="text-body-sm text-on-surface-variant line-clamp-3 leading-relaxed mb-4">
                            {noteItem.summary || noteItem.transcription.substring(0, 100)}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/5 pt-3">
                          <div className="flex items-center gap-sm">
                            <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded text-label-md font-bold uppercase">Resumen</span>
                          </div>
                          <div className="flex items-center gap-md">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(noteItem.id);
                              }}
                              className={`p-1 rounded hover:bg-white/5 ${noteItem.isFavorite ? 'text-amber-500' : 'text-on-surface-variant'}`}
                            >
                              <Star size={14} fill={noteItem.isFavorite ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNote(noteItem.id);
                              }}
                              className="text-on-surface-variant hover:text-error text-xs font-semibold"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredNotes.length === 0 && (
                    <div className="col-span-full text-center py-24 text-on-surface-variant opacity-65 bg-surface-container/20 border border-white/5 rounded-2xl">
                      <FolderOpen size={48} className="mx-auto mb-sm" />
                      <p className="text-body-sm">No se encontraron minutas o reportes en esta selección.</p>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* ====== TAB 4: CHAT DE ARCHIVOS (3 PANELS INTEGRADOS) ====== */}
            {activeTab === 'files-chat' && (
              <motion.div
                key="files-chat-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full w-full"
              >
                {/* High-End Segmented Control for Mobile/Tablet Views (<xl) */}
                <div className="xl:hidden bg-[#1c1b1b] border-b border-white/10 p-2 flex gap-2 shrink-0">
                  <button
                    onClick={() => setMobileFileView('explorer')}
                    className={`flex-1 py-2 px-3 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      mobileFileView === 'explorer' 
                        ? 'bg-primary text-black shadow-md shadow-primary-container/10 font-extrabold' 
                        : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    <FolderOpen size={14} />
                    <span>Archivos</span>
                  </button>
                  <button
                    onClick={() => setMobileFileView('document')}
                    className={`flex-1 py-2 px-3 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      mobileFileView === 'document' 
                        ? 'bg-primary text-black shadow-md shadow-primary-container/10 font-extrabold' 
                        : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    <FileText size={14} />
                    <span>Documento</span>
                  </button>
                  <button
                    onClick={() => setMobileFileView('chat')}
                    className={`flex-1 py-2 px-3 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      mobileFileView === 'chat' 
                        ? 'bg-primary text-black shadow-md shadow-primary-container/10 font-extrabold' 
                        : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>Copiloto IA</span>
                  </button>
                </div>

                <div className="flex flex-grow w-full min-h-0">
                  {/* 1. Explorador de Archivos (Left Column) */}
                  <section className={`w-full xl:w-72 bg-surface-dim border-r border-[#4a4455]/20 flex flex-col h-full shrink-0 ${
                    mobileFileView === 'explorer' ? 'flex' : 'hidden xl:flex'
                  }`}>
                    <div className="p-md flex items-center justify-between border-b border-[#4a4455]/20">
                      <span className="font-headline text-body-md font-bold">Explorador local</span>
                      <button onClick={() => setShowNewNoteModal(true)} className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                        <Plus size={18} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-sm space-y-xs">
                      <div className="p-sm text-[10px] text-on-surface-variant font-bold tracking-widest uppercase">Documentos recientes</div>
                      
                      {notes.map((noteItem) => {
                        const isActive = selectedNote?.id === noteItem.id;
                        return (
                          <div 
                            key={noteItem.id}
                            onClick={() => {
                              setSelectedNote(noteItem);
                              // Auto transition to document view when a file is tapped on mobile explorer
                              setMobileFileView('document');
                            }}
                            className={`group relative flex items-center gap-sm p-3 rounded-lg cursor-pointer transition-all border ${
                              isActive 
                                ? 'bg-surface-container-high border-primary/40' 
                                : 'hover:bg-surface-container border-transparent'
                            }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary"></div>
                            )}
                            <span className={`${isActive ? 'text-primary' : 'text-on-surface-variant animate-pulse'}`}>
                              <FileText size={18} />
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="text-body-sm font-semibold truncate w-40">{noteItem.title}</span>
                              <span className="text-[10px] text-on-surface-variant/80 font-mono">
                                {noteItem.type.toUpperCase()} • {noteItem.wordsCount || 0} palabras
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-md bg-surface-container-lowest/40 border-t border-[#4a4455]/20 shrink-0">
                      <div className="flex justify-between text-[11px] mb-xs font-semibold">
                        <span className="text-on-surface-variant">
                          {storageMode === 'drive' ? '☁ Drive' : '💾 Local'}
                        </span>
                        <span className={`font-bold ${driveSync === 'error' ? 'text-error' : driveSync === 'syncing' ? 'text-secondary' : 'text-primary'}`}>
                          {storageMode === 'drive'
                            ? (driveSync === 'syncing' ? 'Sincronizando…' : driveSync === 'error' ? 'Error sync' : 'Sincronizado')
                            : `${storageEstimate.quota > 0 ? Math.round((storageEstimate.used / storageEstimate.quota) * 100) : 0}%`
                          }
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#353534] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${driveSync === 'error' ? 'bg-error' : 'bg-primary'}`}
                          style={{ width: storageMode === 'drive' ? '100%' : `${storageEstimate.quota > 0 ? Math.min(100, Math.round((storageEstimate.used / storageEstimate.quota) * 100)) : 0}%` }}
                        />
                      </div>
                    </div>
                  </section>

                  {/* 2. Document Viewer Panel (Center Column) */}
                  <section
                    className={`flex-1 bg-[#131313] p-sm md:p-md xl:p-lg relative flex flex-col items-center overflow-y-auto custom-scrollbar h-full ${
                      mobileFileView === 'document' ? 'flex' : 'hidden xl:flex'
                    }`}
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
                  >
                    {selectedNote ? (
                      <>
                        {/* Paper toolbar */}
                        <div className="w-full max-w-4xl flex items-center justify-between mb-lg sticky top-0 bg-[#131313]/90 backdrop-blur-md py-sm z-10 border-b border-white/5 gap-sm">
                          <div className="flex items-center gap-sm md:gap-md">
                            <div className="flex bg-surface-container border border-white/5 rounded-lg p-xs shrink-0">
                              <button onClick={() => setZoomLevel(prev => Math.max(75, prev - 10))} className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant hover:text-white cursor-pointer"><ZoomOut size={16} /></button>
                              <button onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))} className="p-1 hover:bg-surface-container-high rounded transition-colors text-on-surface-variant hover:text-white cursor-pointer"><ZoomIn size={16} /></button>
                            </div>
                            <span className="text-[10px] md:text-label-md text-on-surface-variant font-mono">Zoom: {zoomLevel}%</span>
                          </div>

                          <div className="flex items-center gap-xs md:gap-sm shrink-0">
                            <button
                              onClick={() => setFocusMode(true)}
                              className="flex items-center gap-xs px-2.5 py-1.5 bg-surface-container border border-white/5 rounded-lg text-[10px] md:text-xs font-bold hover:bg-surface-container-high transition-colors cursor-pointer text-on-surface-variant hover:text-white"
                              title="Modo enfoque (pantalla completa)"
                            >
                              <Maximize2 size={12} />
                              <span className="hidden sm:inline">Focus</span>
                            </button>
                            <button
                              onClick={() => handleExportPDF(selectedNote)}
                              className="flex items-center gap-xs px-2.5 py-1.5 bg-surface-container border border-white/5 rounded-lg text-[10px] md:text-xs font-bold hover:bg-surface-container-high transition-colors cursor-pointer"
                              title="Exportar archivo TXT"
                            >
                              <Download size={12} />
                              <span className="hidden sm:inline">Exportar </span>TXT
                            </button>
                            <button 
                              onClick={() => exportToPDF(selectedNote)}
                              className="flex items-center gap-xs px-2.5 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-lg text-[10px] md:text-xs font-bold transition-all cursor-pointer"
                              title="Exportar reporte PDF"
                            >
                              <FileDown size={12} />
                              <span className="hidden sm:inline">Exportar </span>PDF
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/shared/${selectedNote.id}`);
                              }}
                              className="flex items-center gap-xs px-2.5 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[10px] md:text-xs font-bold hover:bg-[#7c3aed]/20 transition-all cursor-pointer"
                              title="Compartir nota"
                            >
                              <Share2 size={12} />
                              <span className="hidden sm:inline">Compartir</span>
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(true)}
                              className="flex items-center gap-xs px-2.5 py-1.5 bg-error/10 border border-error/20 hover:bg-error/20 text-error rounded-lg text-[10px] md:text-xs font-bold transition-all cursor-pointer"
                              title="Eliminar nota"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Document Simulation Sheet */}
                        <div 
                          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                          className="w-full max-w-3xl bg-surface-container/50 border border-white/10 min-h-[640px] rounded-xl p-4 md:p-8 shadow-2xl mb-xl relative group transition-all duration-300"
                        >
                          {/* Atmosphere overlay lights */}
                          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary to-transparent"></div>
                          
                          {/* Title details */}
                          <div className="border-b border-white/10 pb-md mb-md">
                            <div className="flex items-center justify-between text-xs text-on-surface-variant mb-2">
                              <span className="font-bold tracking-widest text-[10px] uppercase text-primary">REPORTE INTELIGENTE IA</span>
                              <span className="font-mono">{new Date(selectedNote.createdAt).toLocaleDateString('es-ES')}</span>
                            </div>
                            <div className="flex items-start gap-2 group/title">
                              {editingTitle ? (
                                <input
                                  autoFocus
                                  value={editTitleValue}
                                  onChange={(e) => setEditTitleValue(e.target.value)}
                                  onBlur={handleSaveTitle}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                                  className="flex-1 text-display-lg font-bold bg-surface-container-high border border-primary/40 rounded-lg px-3 py-1 text-on-surface outline-none"
                                />
                              ) : (
                                <h2
                                  className="flex-1 text-display-lg font-bold text-on-surface leading-tight cursor-text hover:text-primary transition-colors"
                                  onClick={() => { setEditTitleValue(selectedNote.title); setEditingTitle(true); }}
                                  title="Clic para editar el título"
                                >
                                  {selectedNote.title}
                                </h2>
                              )}
                              <div className="flex items-center gap-1 opacity-0 group/title:opacity-100 transition-opacity shrink-0 mt-1">
                                <button
                                  onClick={() => { setEditTitleValue(selectedNote.title); setEditingTitle(true); }}
                                  className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                                  title="Editar título"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(true)}
                                  className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                                  title="Eliminar nota"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Tags */}
                          <NoteTagsEditor
                            tags={selectedNote.tags || []}
                            onChange={(tags) => {
                              const updated = { ...selectedNote, tags };
                              setSelectedNote(updated);
                              setNotes((prev) => prev.map((n) => n.id === updated.id ? updated : n));
                              saveNote(updated).catch(console.error);
                            }}
                          />

                          {/* Content text */}
                          <div className="space-y-lg text-on-surface/95 leading-relaxed text-body-sm md:text-body-md font-sans">

                            {/* Resumen ejecutivo completo */}
                            <div className="group">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-bold text-primary tracking-wide text-xs uppercase">Resumen Ejecutivo</h4>
                                <CopyButton text={selectedNote.summary || ''} label="resumen" />
                              </div>
                              <p className="text-on-surface/90 leading-relaxed whitespace-pre-wrap">
                                {selectedNote.summary || 'Sin resumen disponible.'}
                              </p>
                            </div>

                            {/* Decisiones Tomadas */}
                            {selectedNote.decisions && selectedNote.decisions.length > 0 && (
                              <div className="pt-md border-t border-white/5 group">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-secondary tracking-wide text-xs uppercase flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
                                    Decisiones Tomadas
                                  </h4>
                                  <CopyButton text={selectedNote.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')} label="decisiones" />
                                </div>
                                <ul className="space-y-2">
                                  {selectedNote.decisions.map((dec, idx) => (
                                    <li key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/5 border border-secondary/10">
                                      <span className="text-secondary font-bold text-xs mt-0.5 shrink-0">{idx + 1}.</span>
                                      <span className="text-on-surface/90 text-[13px] leading-relaxed">{dec}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Acuerdos / Action Items */}
                            {selectedNote.actionItems && selectedNote.actionItems.filter(a => !a.startsWith('⚠️')).length > 0 && (
                              <div className="pt-md border-t border-white/5 group">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-tertiary tracking-wide text-xs uppercase flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-tertiary inline-block" />
                                    Acciones y Responsables
                                  </h4>
                                  <CopyButton text={selectedNote.actionItems.filter(a => !a.startsWith('⚠️') && !a.startsWith('⏳')).map(a => `→ ${a}`).join('\n')} label="acciones" />
                                </div>
                                <ul className="space-y-2">
                                  {selectedNote.actionItems.filter(a => !a.startsWith('⚠️')).map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-tertiary/5 border border-tertiary/10">
                                      <span className="text-tertiary mt-0.5 shrink-0">→</span>
                                      <span className="text-on-surface/90 text-[13px] leading-relaxed">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Pendientes */}
                            {selectedNote.actionItems && selectedNote.actionItems.filter(a => a.startsWith('⏳')).length > 0 && (
                              <div className="pt-md border-t border-white/5 group">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-blue-400 tracking-wide text-xs uppercase flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                                    Pendientes y Puntos Abiertos
                                  </h4>
                                  <CopyButton text={selectedNote.actionItems.filter(a => a.startsWith('⏳')).join('\n')} label="pendientes" />
                                </div>
                                <ul className="space-y-2">
                                  {selectedNote.actionItems.filter(a => a.startsWith('⏳')).map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-400/5 border border-blue-400/15">
                                      <span className="text-blue-300 text-[13px] leading-relaxed">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Riesgos */}
                            {selectedNote.actionItems && selectedNote.actionItems.filter(a => a.startsWith('⚠️')).length > 0 && (
                              <div className="pt-md border-t border-white/5 group">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-bold text-amber-400 tracking-wide text-xs uppercase flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                    Riesgos y Consideraciones
                                  </h4>
                                  <CopyButton text={selectedNote.actionItems.filter(a => a.startsWith('⚠️')).join('\n')} label="riesgos" />
                                </div>
                                <ul className="space-y-2">
                                  {selectedNote.actionItems.filter(a => a.startsWith('⚠️')).map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/15">
                                      <span className="text-amber-400 text-[13px] leading-relaxed">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Minuta en tiempo real colapsable */}
                            {selectedNote.extendedMinutes && (
                              <NoteExtendedCollapse content={selectedNote.extendedMinutes} />
                            )}

                            {/* Transcripción colapsable */}
                            <NoteTranscriptCollapse transcription={selectedNote.transcription} />

                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-xl text-center text-on-surface-variant/75">
                        <FolderOpen size={64} className="animate-pulse text-on-surface-variant mb-4" />
                        <h4 className="font-headline text-body-lg font-bold text-on-surface mb-2">No se seleccionó archivo</h4>
                        <p className="text-body-sm max-w-md">Selecciona uno de tus reportes en el panel izquierdo o ve al menú de Transcripción para subir un archivo.</p>
                      </div>
                    )}
                  </section>

                  {/* 3. AI Chat sidebar (Right Column, width 96/w-96) */}
                  <aside className={`w-full xl:w-96 border-l border-white/10 shrink-0 h-full relative bg-[#1c1b1b] px-0 ${
                    mobileFileView === 'chat' ? 'flex' : 'hidden xl:block'
                  }`}>
                    <AIChatSidebar activeNote={selectedNote} providerConfig={providerConfig} />
                  </aside>
                </div>

              </motion.div>
            )}

            {/* ====== TAB 5: PROFILE SETTINGS ====== */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-3xl mx-auto space-y-xl p-md md:p-xl w-full pt-6 pb-8"
              >
                <div>
                  <h2 className="font-headline text-headline-lg font-bold text-on-surface">Configuración de Wizzi Note</h2>
                  <p className="text-body-md text-on-surface-variant mt-xs">Gestiona tu perfil, proveedor de IA y modelos.</p>
                </div>

                {/* API Keys */}
                <div className="bg-surface-container rounded-xl border border-white/5 p-lg space-y-lg shadow-md">
                  <div>
                    <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono mb-xs">API Keys</h3>
                    <p className="text-body-sm text-on-surface-variant">Las keys se guardan en el servidor. Dejá en blanco las que no quieras cambiar.</p>
                  </div>
                  <SettingsKeyForm onSaved={() => {}} />
                </div>

                {/* User profile */}
                <div className="bg-surface-container rounded-xl border border-white/5 p-lg space-y-lg shadow-md">
                  <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono">Perfil</h3>
                  <div className="space-y-sm">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">Nombre de Usuario</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => {
                        setUserName(e.target.value);
                        localStorage.setItem('wizzi_username', e.target.value);
                      }}
                      className="w-full bg-[#131313] border border-[#ccc3d8]/25 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-md text-body-sm text-on-surface outline-none transition-all font-semibold"
                    />
                  </div>
                </div>

                {/* AI Provider selector */}
                <div className="bg-surface-container rounded-xl border border-white/5 p-lg space-y-lg shadow-md">
                  <div>
                    <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono mb-xs">Proveedor de IA</h3>
                    <p className="text-body-sm text-on-surface-variant">El proveedor activo se usará para procesar archivos y el chat. Las API keys se configuran en el archivo <code className="bg-white/5 px-1 rounded text-primary font-mono text-xs">.env</code> del servidor.</p>
                  </div>

                  {/* Provider cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
                    {(Object.keys(PROVIDER_OPTIONS) as AIProvider[]).map((p) => {
                      const info = PROVIDER_OPTIONS[p];
                      const isActive = providerConfig.provider === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setActiveProvider(p)}
                          className={`relative p-md rounded-xl border-2 text-left transition-all cursor-pointer ${
                            isActive
                              ? `${info.bg} ${info.border} shadow-lg`
                              : 'bg-surface-container-high border-white/5 hover:border-white/20'
                          }`}
                        >
                          {isActive && (
                            <span className={`absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest ${info.color} ${info.bg} px-2 py-0.5 rounded-full border ${info.border}`}>
                              Activo
                            </span>
                          )}
                          <p className={`font-black text-body-sm mb-xs ${isActive ? info.color : 'text-on-surface'}`}>{info.label}</p>
                          <p className="text-[10px] text-on-surface-variant font-mono mb-sm">{info.envVar}</p>
                          <div className="flex flex-col gap-1 text-[10px] text-on-surface-variant">
                            <span>{info.supportsAudio ? '✓' : '✗'} Audio/Video</span>
                            <span>{info.supportsPDF ? '✓' : '✗'} PDF</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Model selector for active provider */}
                  <div className="space-y-md pt-md border-t border-white/5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono block">
                      Modelo — {PROVIDER_OPTIONS[providerConfig.provider].label}
                    </label>

                    {/* GPU profile selector — only shown for local */}
                    {providerConfig.provider === 'local' && (
                      <div className="space-y-sm">
                        {/* Header + autodetect button */}
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-on-surface-variant/70 font-mono">Seleccioná tu hardware para ver los modelos recomendados:</p>
                          <button
                            onClick={() => detectHardware()}
                            disabled={hwDetecting}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-bold hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          >
                            {hwDetecting
                              ? <><span className="animate-spin inline-block w-3 h-3 border border-purple-400 border-t-transparent rounded-full" /> Detectando...</>
                              : <><Cpu size={11} /> Autodetectar</>}
                          </button>
                        </div>


                        {/* Detected hardware info card */}
                        {hwInfo && (
                          <div className="bg-surface-container-high rounded-xl border border-purple-500/20 px-md py-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-bold text-purple-400/60 uppercase tracking-widest font-mono">Hardware detectado</p>
                              <button onClick={() => setHwEditOpen(v => !v)} className="text-[9px] text-purple-400/60 hover:text-purple-300 transition-colors font-mono">
                                {hwEditOpen ? '✕ Cerrar' : '✏ Editar'}
                              </button>
                            </div>

                            {!hwEditOpen ? (
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {hwInfo.cpuName && (
                                  <div className="flex items-start gap-1.5 col-span-2">
                                    <span className="text-[10px] shrink-0">🖥️</span>
                                    <span className="text-[10px] text-on-surface-variant/70 leading-snug">{hwInfo.cpuName}</span>
                                  </div>
                                )}
                                {hwInfo.gpuName && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px]">🎮</span>
                                    <span className="text-[10px] text-on-surface-variant/70">{hwInfo.gpuName}</span>
                                  </div>
                                )}
                                {hwInfo.vramMb != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px]">⚡</span>
                                    <span className="text-[10px] text-on-surface-variant/70">
                                      {(hwInfo.vramMb / 1024).toFixed(1)} GB VRAM
                                      {!hwInfo.detectedBy.some(s => s.startsWith('env')) && <span className="text-on-surface-variant/30 ml-1">(estimado)</span>}
                                    </span>
                                  </div>
                                )}
                                {hwInfo.ramMb != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px]">🧠</span>
                                    <span className="text-[10px] text-on-surface-variant/70">{(hwInfo.ramMb / 1024).toFixed(0)} GB RAM</span>
                                  </div>
                                )}
                                {!hwInfo.gpuName && (
                                  <div className="flex items-center gap-1.5 col-span-2">
                                    <span className="text-[10px]">🎮</span>
                                    <span className="text-[10px] text-on-surface-variant/40 italic">Sin GPU detectada — usá ✏ Editar para ingresar tus specs</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[9px] text-on-surface-variant/40 font-mono">Docker no puede leer el hardware del host directamente. Ingresalo vos una vez y se guarda en .env:</p>
                                {([
                                  { key: 'HOST_CPU',     label: '🖥️ CPU',         placeholder: 'Ej: i7-11700F @ 2.50GHz' },
                                  { key: 'HOST_GPU',     label: '🎮 GPU',         placeholder: 'Ej: RTX 3070, RX 6700 XT' },
                                  { key: 'HOST_VRAM_GB', label: '⚡ VRAM (GB)',   placeholder: 'Ej: 8' },
                                  { key: 'HOST_RAM_GB',  label: '🧠 RAM (GB)',    placeholder: 'Ej: 32' },
                                ] as const).map(f => (
                                  <div key={f.key} className="flex items-center gap-2">
                                    <label className="text-[10px] text-on-surface-variant/60 w-24 shrink-0">{f.label}</label>
                                    <input
                                      type="text"
                                      value={hwForm[f.key]}
                                      onChange={e => setHwForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                      placeholder={f.placeholder}
                                      className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-on-surface font-mono placeholder-on-surface-variant/20 focus:outline-none focus:border-purple-500/40"
                                    />
                                  </div>
                                ))}
                                <button
                                  onClick={async () => {
                                    setHwSaving(true);
                                    try {
                                      const r = await fetch('/api/hardware/override', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hwForm) });
                                      const d = await r.json();
                                      if (d.ok) {
                                        const hw = { ...d.hw, vramMb: d.hw.vramMb != null ? Number(d.hw.vramMb) : null, ramMb: d.hw.ramMb != null ? Number(d.hw.ramMb) : null };
                                        setHwInfo(hw);
                                        if (hw.profile) setGpuProfile(hw.profile);
                                        setHwEditOpen(false);
                                      }
                                    } catch {} finally { setHwSaving(false); }
                                  }}
                                  disabled={hwSaving}
                                  className="w-full py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold hover:bg-purple-500/25 transition-colors disabled:opacity-40"
                                >
                                  {hwSaving ? 'Guardando...' : '💾 Guardar y aplicar'}
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                              <span className="text-[9px] text-purple-400/50 font-mono">Perfil sugerido:</span>
                              <span className="text-[9px] font-bold text-purple-300 font-mono uppercase">{hwInfo.profile}</span>
                              <span className="text-[9px] text-on-surface-variant/30 font-mono">— aplicado automáticamente ✓</span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-sm flex-wrap">
                          {([
                            { id: 'cpu',  label: 'CPU / RAM',  sub: 'Sin acelerador',          icon: '🖥️' },
                            { id: 'npu',  label: 'NPU / iGPU', sub: 'Core Ultra · Ryzen AI',   icon: '🧠' },
                            { id: '1650', label: 'GTX 1650',   sub: '4 GB VRAM',               icon: '🎮' },
                            { id: '3080', label: 'RTX 3080',   sub: '10 GB VRAM',              icon: '⚡' },
                          ] as { id: GpuProfile; label: string; sub: string; icon: string }[]).map((gpu) => {
                            const isAutoDetected = hwInfo?.profile === gpu.id;
                            return (
                            <button
                              key={gpu.id}
                              onClick={() => { setGpuProfile(gpu.id); localStorage.setItem('wizzi_gpu_profile', gpu.id); }}
                              className={`relative flex items-center gap-2 px-md py-sm rounded-xl border text-left transition-all cursor-pointer ${
                                gpuProfile === gpu.id
                                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                                  : 'bg-surface-container-high border-white/5 text-on-surface-variant hover:border-white/20'
                              }`}
                            >
                              {isAutoDetected && (
                                <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black bg-purple-500 text-white px-1.5 py-0.5 rounded-full leading-none">AUTO</span>
                              )}
                              <span className="text-base">{gpu.icon}</span>
                              <div>
                                <p className="text-xs font-bold leading-none">{gpu.label}</p>
                                <p className="text-[10px] opacity-60 mt-0.5">{gpu.sub}</p>
                              </div>
                              {gpuProfile === gpu.id && <Check size={12} className="ml-auto text-purple-400 shrink-0" />}
                            </button>
                          )})}
                        </div>

                        {/* ── Quantization selector ── */}
                        <div className="space-y-sm pt-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-on-surface-variant/70 font-mono">Nivel de cuantización (afecta peso y precisión):</p>
                            <a
                              href="https://github.com/ggerganov/llama.cpp/blob/master/docs/quantization.md"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary/60 hover:text-primary transition-colors font-mono"
                            >
                              ¿Qué es esto? ↗
                            </a>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
                            {(Object.entries(QUANT_OPTIONS) as [QuantLevel, typeof QUANT_OPTIONS[QuantLevel]][]).map(([key, q]) => (
                              <button
                                key={key}
                                onClick={() => { setQuantLevel(key); localStorage.setItem('wizzi_quant_level', key); }}
                                className={`text-left p-sm rounded-xl border transition-all cursor-pointer ${
                                  quantLevel === key
                                    ? 'bg-surface-container-highest border-purple-500/40'
                                    : 'bg-surface-container border-white/5 hover:border-white/15'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className={`font-black text-xs ${quantLevel === key ? q.color : 'text-on-surface'}`}>{q.label}</span>
                                  {quantLevel === key && <Check size={10} className="text-purple-400" />}
                                </div>
                                <p className="text-[10px] text-on-surface-variant/60 leading-tight">{q.description}</p>
                              </button>
                            ))}
                          </div>

                        </div>

                        {/* ── Model cards + Capability scores ── */}
                        {(() => {
                          const qInfo       = QUANT_OPTIONS[quantLevel];
                          const recommended = LOCAL_MODELS.filter(m => m.recommended.includes(gpuProfile));
                          const others      = LOCAL_MODELS.filter(m => !m.recommended.includes(gpuProfile));
                          const memLabel    = gpuProfile === 'npu' || gpuProfile === 'cpu' ? 'RAM' : 'VRAM';

                          const modelSize   = (m: typeof LOCAL_MODELS[0]) =>
                            parseFloat((m.sizeGbQ4 * qInfo.multiplier).toFixed(1));
                          const totalGb     = parseFloat(
                            recommended.reduce((s, m) => s + modelSize(m), 0).toFixed(1)
                          );

                          const isLoaded = (m: typeof LOCAL_MODELS[0]) =>
                            !!loadedModel && loadedModel.toLowerCase().startsWith(m.ggufBase.toLowerCase());

                          const ModelCard = ({ m }: { m: typeof LOCAL_MODELS[0] }) => {
                            const isRec     = m.recommended.includes(gpuProfile);
                            const loaded    = isLoaded(m);
                            const sizeGb    = modelSize(m);
                            const filename  = ggufFilename(m, quantLevel);
                            const dlUrl     = ggufDownloadUrl(m, quantLevel);
                            // Real file on disk (any quant) — preferred for activation
                            const downloadedFilename = downloadedByModel[m.id];
                            const vramColor = m.vramGb <= 3 ? 'text-tertiary' : m.vramGb <= 6 ? 'text-amber-400' : 'text-red-400';

                            const dl = modelDownloads[filename] ?? { state: 'idle', percent: 0, error: '' };
                            const dlState   = dl.state;
                            const dlPercent = dl.percent;
                            const dlError   = dl.error;

                            const setDl = (patch: Partial<typeof dl>) =>
                              setModelDownloads(prev => ({ ...prev, [filename]: { ...prev[filename] ?? { state: 'idle', percent: 0, error: '' }, ...patch } }));

                            const startDownload = async (e: React.MouseEvent) => {
                              e.stopPropagation();
                              if (dlState === 'downloading') return;
                              setDl({ state: 'downloading', percent: 0, error: '' });

                              // 1. Iniciar descarga en el servidor (retorna inmediatamente)
                              try {
                                const dlRes = await fetch('/api/llamacpp/download', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ url: dlUrl, filename }),
                                });
                                if (!dlRes.ok) {
                                  setDl({ state: 'error', error: `Error ${dlRes.status}` });
                                  return;
                                }
                              } catch (err: any) {
                                setDl({ state: 'error', error: err.message || 'Error iniciando descarga' });
                                return;
                              }

                              // 2. Polling del tamaño del archivo cada 3 segundos (simple y robusto)
                              const totalBytes = m.sizeGbQ4 * 1024 * 1024 * 1024;
                              const poll = setInterval(async () => {
                                try {
                                  const r = await fetch(`/api/llamacpp/exists/${encodeURIComponent(filename)}`, { credentials: 'include' });
                                  const data = await r.json();
                                  if (data.exists) {
                                    clearInterval(poll);
                                    setDl({ state: 'done', percent: 100 });
                                    return;
                                  }
                                  // check .tmp file size for progress
                                  const rt = await fetch(`/api/llamacpp/exists/${encodeURIComponent(filename + '.tmp')}`, { credentials: 'include' });
                                  const dt = await rt.json();
                                  if (dt.exists && dt.sizeBytes > 0 && totalBytes > 0) {
                                    const pct = Math.min(99, Math.round((dt.sizeBytes / totalBytes) * 100));
                                    setDl({ percent: pct });
                                  }
                                } catch { /* ignore poll errors */ }
                              }, 3000);

                              // Timeout máximo 2 horas
                              setTimeout(() => {
                                clearInterval(poll);
                                setDl((prev: any) => prev.state === 'downloading' ? { state: 'error', error: 'Timeout' } : prev);
                              }, 2 * 60 * 60 * 1000);
                            };

                            const isDownloaded = !!downloadedFilename || downloadedSet.has(filename) || dlState === 'done';
                            const activateFilename = downloadedFilename || filename;

                            const activate = async (e: React.MouseEvent) => {
                              e.stopPropagation();
                              setActivatingModel(filename);
                              try {
                                const r = await fetch('/api/llamacpp/set-model', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ filename: activateFilename }),
                                });
                                const d = await r.json();
                                if (!d.ok) {
                                  setDl({ state: 'error', error: d.error || 'No se pudo activar' });
                                  setActivatingModel(null);
                                  return;
                                }
                                // Esperar a que llamacpp recargue el modelo (puede tardar 1-3 min)
                                const deadline = Date.now() + 8 * 60 * 1000;
                                while (Date.now() < deadline) {
                                  await new Promise(res => setTimeout(res, 4000));
                                  try {
                                    const rr = await fetch('/api/llamacpp/ready', { credentials: 'include' });
                                    const dd = await rr.json();
                                    if (dd.ready) break;
                                  } catch {}
                                }
                                setLoadedModel(activateFilename);
                                showToast(`Ahora usamos ${activateFilename.replace(/\.gguf$/i, '')} como modelo de IA`);
                              } catch (err: any) {
                                setDl({ state: 'error', error: err.message || 'Error activando' });
                              } finally {
                                setActivatingModel(null);
                              }
                            };

                            return (
                              <div
                                className={`relative rounded-xl border transition-all cursor-pointer ${
                                  loaded
                                    ? 'bg-emerald-500/8 border-emerald-500/30'
                                    : dlState === 'downloading'
                                    ? 'bg-primary/8 border-primary/25'
                                    : hoveredModelId === m.id
                                    ? 'bg-surface-container-high border-white/20'
                                    : isRec
                                    ? 'bg-surface-container border-white/8'
                                    : 'bg-surface-container border-white/5 opacity-55'
                                }`}
                                onMouseEnter={() => setHoveredModelId(m.id)}
                                onMouseLeave={() => setHoveredModelId(null)}
                              >
                                <div className="p-md pb-2">
                                  <div className="flex items-baseline gap-1.5 mb-1 pr-24">
                                    <span className={`font-black text-xs ${loaded ? 'text-emerald-300' : 'text-on-surface'}`}>{m.label}</span>
                                    <span className="text-[10px] font-mono text-on-surface-variant/60">{m.params}</span>
                                  </div>
                                  <p className="text-[11px] text-on-surface-variant/70 leading-snug">{m.description}</p>
                                  <p className="text-[10px] font-mono text-on-surface-variant/40 mt-1 truncate">{filename}</p>
                                </div>

                                {/* Download progress bar */}
                                {dlState === 'downloading' && (
                                  <div className="px-md pb-2">
                                    <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${dlPercent}%` }} />
                                    </div>
                                    <p className="text-[9px] text-on-surface-variant/40 font-mono mt-0.5 text-right">{dlPercent}%</p>
                                  </div>
                                )}
                                {dlState === 'error' && (
                                  <p className="px-md pb-2 text-[9px] text-red-400 font-mono truncate">{dlError}</p>
                                )}

                                {/* Badges */}
                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                  {loaded && (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">▶ Cargado</span>
                                  )}
                                  {dlState === 'done' && !loaded && (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary/15 border border-primary/30 px-1.5 py-0.5 rounded-full">✓ Descargado</span>
                                  )}
                                </div>

                                {/* Footer row */}
                                <div className="flex items-center justify-between px-md pb-md pt-1 gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold font-mono ${vramColor}`}>{m.vramGb} GB {memLabel}</span>
                                    <span className={`text-[10px] font-mono font-bold ${qInfo.color}`}>~{sizeGb} GB</span>
                                  </div>
                                  {!loaded && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isDownloaded && (
                                        <button
                                          onClick={activate}
                                          disabled={activatingModel === filename}
                                          className="flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                        >
                                          {activatingModel === filename
                                            ? <><span className="animate-spin inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full" /> Activando…</>
                                            : <>▶ Activar</>}
                                        </button>
                                      )}
                                      {!isDownloaded && (
                                        <button
                                          onClick={startDownload}
                                          disabled={dlState === 'downloading'}
                                          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                                            dlState === 'downloading'
                                              ? 'border-white/10 text-on-surface-variant/40 cursor-not-allowed'
                                              : 'border-white/10 text-on-surface-variant/50 hover:text-primary hover:border-primary/30'
                                          }`}
                                        >
                                          {dlState === 'downloading'
                                            ? <><span className="animate-spin inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full" /> {dlPercent}%</>
                                            : <><Download size={9} /> Descargar</>}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          };

                          // Loaded model section
                          const loadedList = LOCAL_MODELS.filter(m => isLoaded(m));

                          return (
                            <div className="space-y-md mt-sm">

                              {/* Currently loaded model */}
                              <div className="px-md py-sm bg-surface-container rounded-xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${loadedModel && loadedModel !== 'unknown' ? 'bg-emerald-400 animate-pulse' : 'bg-on-surface-variant/30'}`} />
                                  <span className="text-[11px] text-on-surface-variant/70 font-mono">
                                    {loadedModel && loadedModel !== 'unknown'
                                      ? <><span className="text-emerald-400 font-bold">▶ Cargado:</span> {loadedModel}</>
                                      : 'llama.cpp sin modelo cargado'}
                                  </span>
                                </div>
                                <button onClick={fetchLoadedModel} className="text-[9px] text-on-surface-variant/40 hover:text-emerald-400 transition-colors cursor-pointer font-mono shrink-0">↻</button>
                              </div>

                              {/* How to load a model hint */}
                              <div className="text-[10px] text-on-surface-variant/40 font-mono px-1">
                                Para cambiar de modelo: descargá el .gguf → copialo al volumen <code className="text-primary/60">llamacpp_models</code> → editá <code className="text-primary/60">LLAMA_MODEL</code> en tu .env → <code className="text-primary/60">docker compose restart llamacpp</code>
                              </div>

                              {/* Recommended section */}
                              <div>
                                <div className="flex items-center justify-between mb-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold text-tertiary uppercase tracking-widest font-mono">
                                      ✦ Recomendado para tu hardware
                                    </span>
                                    <span className="text-[10px] text-on-surface-variant/50 font-mono">
                                      {recommended.length} modelo{recommended.length !== 1 ? 's' : ''} · ~{totalGb.toFixed(1)} GB total
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                                  {recommended.map(m => <ModelCard key={m.id} m={m} />)}
                                </div>
                              </div>

                              {/* Others section */}
                              {others.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-extrabold text-on-surface-variant/40 uppercase tracking-widest font-mono mb-sm">
                                    Otros disponibles
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                                    {others.map(m => <ModelCard key={m.id} m={m} />)}
                                  </div>
                                </div>
                              )}

                              {/* Capability scores panel — reacts to hovered/selected model */}
                              {(() => {
                                const activeM = hoveredModelId
                                  ? LOCAL_MODELS.find(m => m.id === hoveredModelId)
                                  : LOCAL_MODELS.find(m => isLoaded(m)) ?? LOCAL_MODELS.find(m => m.recommended.includes(gpuProfile));
                                const scores: CapabilityScores = activeM
                                  ? effectiveScores(activeM.scores, quantLevel)
                                  : effectiveScores({ resumen: 3, notas: 3, traduccion: 3, instrucciones: 3, velocidad: 3 }, quantLevel);
                                const qColor = QUANT_OPTIONS[quantLevel].color;
                                const bgColor = qColor.replace('text-', 'bg-');
                                const rows: { label: string; key: keyof CapabilityScores; icon: string }[] = [
                                  { label: 'Resumen / Minuta',    key: 'resumen',       icon: '📝' },
                                  { label: 'Notas y análisis',    key: 'notas',         icon: '🧠' },
                                  { label: 'Traducción',          key: 'traduccion',    icon: '🌐' },
                                  { label: 'Instrucciones / RAG', key: 'instrucciones', icon: '🔍' },
                                  { label: 'Velocidad',           key: 'velocidad',     icon: '⚡' },
                                ];
                                return (
                                  <div className="bg-surface-container rounded-xl border border-white/5 p-sm mt-sm">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest font-mono">
                                        Capacidades estimadas
                                      </p>
                                      <p className={`text-[9px] font-bold font-mono ${qColor} opacity-70`}>
                                        {activeM ? `${activeM.label} ${activeM.params} · ${QUANT_OPTIONS[quantLevel].label}` : QUANT_OPTIONS[quantLevel].label}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      {rows.map(({ label, key, icon }) => (
                                        <div key={key} className="flex items-center gap-2">
                                          <span className="text-[11px] w-4 shrink-0">{icon}</span>
                                          <span className="text-[10px] text-on-surface-variant/60 w-28 shrink-0 truncate">{label}</span>
                                          <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${bgColor} opacity-85 transition-all duration-500 ease-out`}
                                              style={{ width: `${(scores[key] / 5) * 100}%` }}
                                            />
                                          </div>
                                          <span className={`text-[9px] font-bold font-mono w-5 text-right transition-all duration-300 ${scores[key] >= 4 ? qColor : 'text-on-surface-variant/40'}`}>
                                            {scores[key]}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    {!hoveredModelId && (
                                      <p className="text-[9px] text-on-surface-variant/30 font-mono mt-2 text-center">
                                        Pasá el mouse por un modelo para comparar
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* For non-local providers, keep the simple chip selector */}
                    {providerConfig.provider !== 'local' && (
                      <div className="flex flex-wrap gap-sm">
                        {PROVIDER_OPTIONS[providerConfig.provider].models.map((m) => {
                          const isActiveModel = providerConfig.models[providerConfig.provider] === m;
                          const info = PROVIDER_OPTIONS[providerConfig.provider];
                          return (
                            <button
                              key={m}
                              onClick={() => setModelForProvider(providerConfig.provider, m)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                isActiveModel
                                  ? `${info.bg} ${info.color} ${info.border}`
                                  : 'bg-surface-container-high text-on-surface-variant border-white/5 hover:border-white/20'
                              }`}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                {/* ── Speech-to-text engine ── */}
                <div className="bg-surface-container rounded-xl border border-white/5 p-lg space-y-lg shadow-md">
                  <div>
                    <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono mb-xs">Motor de transcripción</h3>
                    <p className="text-body-sm text-on-surface-variant">Alterná entre Whisper y Nemotron 3.5 para comparar precisión y velocidad con el mismo audio.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm" role="group" aria-label="Motor de transcripción">
                    {([
                      { id: 'whisper', label: 'Whisper', detail: 'Estable · varios tamaños' },
                      { id: 'nemotron', label: 'Nemotron 3.5', detail: '600M · streaming · 40 idiomas' },
                    ] as const).map(engine => {
                      const active = asrProvider === engine.id;
                      const available = asrStatus?.[engine.id]?.available;
                      return (
                        <button
                          key={engine.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setAsrProvider(engine.id);
                            localStorage.setItem('wizzi_asr_provider', engine.id);
                            const name = engine.id === 'whisper'
                              ? `Whisper${asrStatus?.whisper?.model ? ` (${asrStatus.whisper.model})` : ''}`
                              : 'Nemotron 3.5';
                            if (available === false) showToast(`Seleccionaste ${name}, pero no está disponible ahora`, 'warn');
                            else showToast(`Ahora usamos ${name} para transcribir`);
                          }}
                          className={`text-left rounded-xl border p-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            active
                              ? 'bg-primary/10 border-primary/40'
                              : 'bg-surface-container-high border-white/5 hover:border-white/15'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-sm">
                            <span className={`font-bold text-body-sm ${active ? 'text-primary' : 'text-on-surface'}`}>{engine.label}</span>
                            <span className={`text-[9px] font-mono ${available ? 'text-emerald-400' : available === false ? 'text-red-400' : 'text-on-surface-variant/50'}`}>
                              {available ? 'DISPONIBLE' : available === false ? 'SIN CONEXIÓN' : 'VERIFICANDO'}
                            </span>
                          </span>
                          <span className="block text-[10px] text-on-surface-variant/60 mt-1">{engine.detail}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active model status */}
                  <div className="flex items-center justify-between bg-surface-container-high rounded-lg px-md py-sm border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${asrStatus?.[asrProvider]?.available ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                      <span className="text-[11px] text-on-surface-variant/70 font-mono">
                        {asrStatus?.[asrProvider]?.available
                          ? <><span className="text-emerald-400 font-bold">▶ Activo:</span> {asrStatus[asrProvider].model}</>
                          : asrStatus ? `${asrProvider === 'nemotron' ? 'Nemotron' : 'Whisper'} no disponible` : 'Verificando...'}
                      </span>
                    </div>
                    <button onClick={fetchLoadedModel} className="text-[9px] text-on-surface-variant/40 hover:text-emerald-400 transition-colors cursor-pointer font-mono shrink-0">↻</button>
                  </div>

                  {/* Model cards */}
                  {asrProvider === 'whisper' ? (() => {
                    const WHISPER_MODELS = [
                      { id: 'tiny',     label: 'Tiny',     params: '39M',  sizeGb: '~0.1', vram: '~1 GB',  speed: 5, quality: 1, desc: 'Ultra rápido. Bueno para pruebas o voz muy clara.' },
                      { id: 'base',     label: 'Base',     params: '74M',  sizeGb: '~0.1', vram: '~1 GB',  speed: 4, quality: 2, desc: 'Rápido y liviano. Funciona bien en CPU.' },
                      { id: 'small',    label: 'Small ★',  params: '244M', sizeGb: '~0.5', vram: '~2 GB',  speed: 3, quality: 3, desc: 'Balance ideal. Recomendado para uso diario.' },
                      { id: 'medium',   label: 'Medium',   params: '769M', sizeGb: '~1.5', vram: '~5 GB',  speed: 2, quality: 4, desc: 'Alta precisión en español y acentos variados.' },
                      { id: 'large-v3', label: 'Large v3', params: '1.5B', sizeGb: '~3.0', vram: '~10 GB', speed: 1, quality: 5, desc: 'Máxima calidad. Requiere GPU con bastante VRAM.' },
                    ] as const;

                    const active = whisperInfo?.model ?? 'small';

                    const handleSwitch = async (modelId: string) => {
                      setWhisperSwitching(modelId);
                      setWhisperHint(null);
                      try {
                        const r = await fetch('/api/whisper/set-model', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ model: modelId }),
                        });
                        const d = await r.json();
                        if (d.ok) {
                          setWhisperInfo(prev => ({ ...prev!, model: modelId }));
                          if (!d.restarted) setWhisperHint(d.hint);
                          showToast(`Ahora usamos Whisper ${modelId}`);
                        }
                      } catch {
                        setWhisperHint('docker compose restart whisper');
                      } finally {
                        setWhisperSwitching(null);
                      }
                    };

                    return (
                      <div className="space-y-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                          {WHISPER_MODELS.map(m => {
                            const isActive = active === m.id;
                            const isSwitching = whisperSwitching === m.id;
                            return (
                              <div
                                key={m.id}
                                className={`relative rounded-xl border p-sm transition-all ${
                                  isActive
                                    ? 'bg-emerald-500/8 border-emerald-500/30'
                                    : 'bg-surface-container-high border-white/5'
                                }`}
                              >
                                {isActive && (
                                  <span className="absolute top-2 right-2 text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    ACTIVO
                                  </span>
                                )}
                                <div className="flex items-baseline gap-1.5 mb-0.5 pr-14">
                                  <span className={`font-black text-body-sm ${isActive ? 'text-emerald-400' : 'text-on-surface'}`}>{m.label}</span>
                                  <span className="text-[10px] text-on-surface-variant/50 font-mono">{m.params}</span>
                                </div>
                                <p className="text-[10px] text-on-surface-variant/60 mb-sm leading-snug">{m.desc}</p>

                                {/* Speed / Quality bars */}
                                <div className="space-y-1.5 mb-sm">
                                  {([
                                    { label: 'Velocidad', val: m.speed,   icon: '⚡', color: 'bg-amber-400' },
                                    { label: 'Precisión', val: m.quality, icon: '🎯', color: 'bg-emerald-400' },
                                  ] as const).map(row => (
                                    <div key={row.label} className="flex items-center gap-1.5">
                                      <span className="text-[10px] w-3">{row.icon}</span>
                                      <span className="text-[9px] text-on-surface-variant/50 w-14 shrink-0">{row.label}</span>
                                      <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${row.color} opacity-80 transition-all duration-500`} style={{ width: `${(row.val / 5) * 100}%` }} />
                                      </div>
                                      <span className="text-[9px] font-mono text-on-surface-variant/40 w-3 text-right">{row.val}</span>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex items-center justify-between pt-sm border-t border-white/5">
                                  <span className="text-[9px] font-mono text-on-surface-variant/30">{m.sizeGb} GB · {m.vram}</span>
                                  {!isActive && (
                                    <button
                                      onClick={() => handleSwitch(m.id)}
                                      disabled={!!whisperSwitching}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {isSwitching ? (
                                        <><span className="animate-spin inline-block w-3 h-3 border border-emerald-400 border-t-transparent rounded-full" /> Aplicando...</>
                                      ) : (
                                        <><Download size={10} /> Activar</>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Restart hint */}
                        {whisperHint && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-md py-sm space-y-1">
                            <p className="text-[10px] font-bold text-amber-400">✓ .env actualizado — reiniciá Whisper para aplicar:</p>
                            <code className="text-[10px] bg-black/30 px-2 py-1 rounded font-mono block text-emerald-400/80">{whisperHint}</code>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-md space-y-sm">
                      <div className="flex items-center justify-between gap-md">
                        <div>
                          <p className="font-bold text-body-sm text-on-surface">Nemotron 3.5 ASR Streaming</p>
                          <p className="text-[10px] text-on-surface-variant/60 mt-1">Q8 · 0.6B parámetros · idioma es-ES · aceleración CUDA</p>
                        </div>
                        <span className="text-[9px] font-mono text-primary border border-primary/20 rounded-full px-2 py-1">EXPERIMENTAL</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant/70 leading-relaxed">
                        Recomendado para pruebas A/B. Whisper continúa disponible como alternativa inmediata si una grabación obtiene peores resultados.
                      </p>
                    </div>
                  )}
                </div>

                {/* Storage mode */}
                <div className="bg-surface-container rounded-xl border border-white/5 p-lg space-y-lg shadow-md">
                  <div>
                    <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono mb-xs">Almacenamiento</h3>
                    <p className="text-body-sm text-on-surface-variant">Elegí dónde guardar tus notas. Drive requiere login con Google.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-md">
                    {(['local', 'drive'] as const).map((mode) => {
                      const isActive = storageMode === mode;
                      const driveAvailable = !!authState?.user?.accessToken || mode === 'local';
                      const disabled = mode === 'drive' && !authState?.user;
                      return (
                        <button
                          key={mode}
                          disabled={disabled}
                          onClick={() => switchStorageMode(mode)}
                          className={`relative p-md rounded-xl border-2 text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isActive
                              ? 'bg-primary/10 border-primary/40 shadow-lg'
                              : 'bg-surface-container-high border-white/5 hover:border-white/20'
                          }`}
                        >
                          {isActive && <span className="absolute top-2 right-2 text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">Activo</span>}
                          <p className={`font-black text-body-sm mb-xs ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                            {mode === 'local' ? '💾 Local' : '☁ Google Drive'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-mono">
                            {mode === 'local' ? 'IndexedDB en este dispositivo' : disabled ? 'Requiere login con Google' : 'Carpeta privada en tu Drive'}
                          </p>
                          {mode === 'local' && (
                            <p className="text-[10px] text-on-surface-variant/60 mt-1">
                              {storageEstimate.quota > 0
                                ? `${(storageEstimate.used / 1024 / 1024).toFixed(1)} MB / ${(storageEstimate.quota / 1024 / 1024 / 1024).toFixed(1)} GB`
                                : 'Calculando…'}
                            </p>
                          )}
                          {mode === 'drive' && !disabled && (
                            <p className={`text-[10px] mt-1 font-semibold ${driveSync === 'error' ? 'text-error' : driveSync === 'syncing' ? 'text-secondary' : 'text-tertiary'}`}>
                              {driveSync === 'syncing' ? 'Sincronizando…' : driveSync === 'error' ? 'Error de sincronización' : 'Auto-sync activado'}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Backup & Data */}
                <div className="bg-surface-container rounded-xl border border-white/5 p-lg space-y-lg shadow-md">
                  <div>
                    <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono mb-xs">Datos y Respaldo</h3>
                    <p className="text-body-sm text-on-surface-variant">Exportá un respaldo para transferir notas o como copia de seguridad.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                    {/* Export */}
                    <button
                      onClick={handleExportBackup}
                      className="flex items-center gap-md p-md bg-surface-container-high rounded-xl border border-white/5 hover:border-primary/30 hover:bg-surface-container-highest transition-all text-left cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Download size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-body-sm text-on-surface">Exportar respaldo</p>
                        <p className="text-[11px] text-on-surface-variant">{notes.length} nota{notes.length !== 1 ? 's' : ''} · formato .json</p>
                      </div>
                    </button>

                    {/* Import */}
                    <label className="flex items-center gap-md p-md bg-surface-container-high rounded-xl border border-white/5 hover:border-primary/30 hover:bg-surface-container-highest transition-all text-left cursor-pointer group">
                      <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary shrink-0 group-hover:bg-secondary/20 transition-colors">
                        <Upload size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-body-sm text-on-surface">Importar respaldo</p>
                        <p className="text-[11px] text-on-surface-variant">Restaurar desde .json · merge automático</p>
                      </div>
                    </label>
                  </div>

                  {/* Clear all */}
                  <div className="pt-md border-t border-white/5">
                    <button
                      onClick={handleClearAllData}
                      className="flex items-center gap-md p-md w-full bg-error/5 rounded-xl border border-error/15 hover:bg-error/10 hover:border-error/30 transition-all text-left cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-error/10 border border-error/20 flex items-center justify-center text-error shrink-0">
                        <Trash2 size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-body-sm text-error">Borrar todos los datos locales</p>
                        <p className="text-[11px] text-on-surface-variant">Elimina todas las notas de este dispositivo. Irreversible.</p>
                      </div>
                      <AlertTriangle size={16} className="text-error/40 shrink-0" />
                    </button>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>

          {/* Mobile bottom-bar controls FAB icon (Contextual) */}
          <div className="lg:hidden fixed bottom-20 right-6 z-40">
            <button
              onClick={() => {
                if (activeTab === 'transcribe') {
                  handleToggleRecording();
                } else if (activeTab === 'notes') {
                  setShowNewNoteModal(true);
                } else {
                  setActiveTab('transcribe');
                }
              }}
              className="bg-primary hover:scale-105 active:scale-95 text-[#001a42] w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all cursor-pointer rotate-0"
            >
              <Mic size={24} />
            </button>
          </div>

        </main>

      </div>

      {/* Dialog overlay and forms for new meeting details creation */}
      {showNewNoteModal && (
        <div className="fixed inset-0 z-55 bg-black/85 backdrop-blur-sm flex items-center justify-center p-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface-container rounded-2xl border border-white/10 p-lg w-full max-w-lg shadow-2xl space-y-md"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-headline text-body-lg font-bold text-primary">Crear Nueva Minuta</h3>
              <button 
                onClick={() => setShowNewNoteModal(false)}
                className="p-1 hover:bg-[#353534] rounded-full text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBlankNote} className="space-y-md">
              <div className="space-y-sm">
                <label className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono block">
                  Título del Reporte
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sincronización Estrategia de Producto Q4"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#131313] border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-md px-md text-body-sm text-[#e5e2e1] outline-none transition-all placeholder:text-on-surface-variant/40"
                />
              </div>

              <div className="space-y-sm">
                <label className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono block">
                  Diario / Transcripción (Opcional)
                </label>
                <textarea
                  placeholder="Inserta el contenido suelto o minutas de la reunión..."
                  value={newTranscription}
                  onChange={(e) => setNewTranscription(e.target.value)}
                  rows={4}
                  className="w-full bg-[#131313] border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-md px-md text-body-sm text-[#e5e2e1] outline-none transition-all placeholder:text-on-surface-variant/40 resize-none font-sans"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-[#001a42] font-bold py-3 rounded-xl text-body-sm hover:opacity-95 transition-all shadow-md cursor-pointer"
              >
                Indexar en IndexedDB
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Focus mode overlay */}
      <AnimatePresence>
        {focusMode && selectedNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-[#0d0d0d] overflow-y-auto outline-none"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onKeyDown={(e) => { if (e.key === 'Escape') setFocusMode(false); }}
            tabIndex={-1}
            ref={(el) => el?.focus()}
          >
            {/* Focus toolbar */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-md py-sm bg-[#0d0d0d]/95 backdrop-blur-md border-b border-white/5">
              <div className="flex items-center gap-sm">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest font-mono">Modo Focus</span>
                <span className="text-[10px] text-on-surface-variant/40 font-mono truncate max-w-[200px]">{selectedNote.title}</span>
              </div>
              <button
                onClick={() => setFocusMode(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-white/10 text-on-surface-variant hover:text-white hover:bg-surface-container-high text-xs font-bold transition-colors cursor-pointer"
              >
                <Minimize2 size={12} /> Salir
              </button>
            </div>

            {/* Document content — reuse same layout */}
            <div className="max-w-3xl mx-auto px-md pb-16 pt-xl">
              <div className="border-b border-white/10 pb-md mb-lg">
                <h2 className="text-2xl font-bold text-on-surface leading-tight">{selectedNote.title}</h2>
                <p className="text-xs text-on-surface-variant/60 font-mono mt-1">
                  {new Date(selectedNote.createdAt).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {selectedNote.duration && ` · ${selectedNote.duration}`}
                </p>
              </div>
              <div className="space-y-lg text-on-surface/95 leading-relaxed text-body-md font-sans">
                <div>
                  <h4 className="font-bold text-primary tracking-wide text-xs uppercase mb-3">Resumen Ejecutivo</h4>
                  <p className="text-on-surface/90 leading-relaxed whitespace-pre-wrap">{selectedNote.summary || 'Sin resumen.'}</p>
                </div>
                {selectedNote.decisions?.length > 0 && (
                  <div className="pt-md border-t border-white/5">
                    <h4 className="font-bold text-secondary tracking-wide text-xs uppercase mb-3">Decisiones Tomadas</h4>
                    <ul className="space-y-2">
                      {selectedNote.decisions.map((d, i) => (
                        <li key={i} className="flex gap-2 p-3 rounded-lg bg-secondary/5 border border-secondary/10">
                          <span className="text-secondary font-bold text-xs mt-0.5 shrink-0">{i + 1}.</span>
                          <span className="text-on-surface/90">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedNote.actionItems?.filter(a => !a.startsWith('⚠️') && !a.startsWith('⏳')).length > 0 && (
                  <div className="pt-md border-t border-white/5">
                    <h4 className="font-bold text-tertiary tracking-wide text-xs uppercase mb-3">Acciones y Responsables</h4>
                    <ul className="space-y-2">
                      {selectedNote.actionItems.filter(a => !a.startsWith('⚠️') && !a.startsWith('⏳')).map((a, i) => (
                        <li key={i} className="flex gap-2 p-3 rounded-lg bg-tertiary/5 border border-tertiary/10">
                          <span className="text-tertiary mt-0.5 shrink-0">→</span>
                          <span className="text-on-surface/90">{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedNote.actionItems?.filter(a => a.startsWith('⏳')).length > 0 && (
                  <div className="pt-md border-t border-white/5">
                    <h4 className="font-bold text-blue-400 tracking-wide text-xs uppercase mb-3">Pendientes</h4>
                    <ul className="space-y-2">
                      {selectedNote.actionItems.filter(a => a.startsWith('⏳')).map((a, i) => (
                        <li key={i} className="p-3 rounded-lg bg-blue-400/5 border border-blue-400/10 text-blue-300">{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedNote.actionItems?.filter(a => a.startsWith('⚠️')).length > 0 && (
                  <div className="pt-md border-t border-white/5">
                    <h4 className="font-bold text-amber-400 tracking-wide text-xs uppercase mb-3">Riesgos</h4>
                    <ul className="space-y-2">
                      {selectedNote.actionItems.filter(a => a.startsWith('⚠️')).map((a, i) => (
                        <li key={i} className="p-3 rounded-lg bg-amber-400/5 border border-amber-400/10 text-amber-400">{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <NoteTranscriptCollapse transcription={selectedNote.transcription} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation bottom sheet */}
      <AnimatePresence>
        {showDeleteConfirm && selectedNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-surface-container border border-white/10 rounded-t-2xl p-lg space-y-md shadow-2xl"
            >
              <div className="flex items-center gap-3 pb-md border-b border-white/10">
                <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-error" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-on-surface text-body-lg">Eliminar nota</h3>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Esta acción no se puede deshacer.</p>
                </div>
              </div>
              <p className="text-body-sm text-on-surface/80">
                ¿Eliminar permanentemente <span className="font-bold text-on-surface">"{selectedNote.title}"</span> de tu base de datos local?
              </p>
              <div className="flex gap-sm pt-sm">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-surface-container-high border border-white/10 text-on-surface font-bold text-body-sm hover:bg-surface-container-highest transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteNote(selectedNote.id)}
                  className="flex-1 py-3 rounded-xl bg-error/15 border border-error/30 text-error font-bold text-body-sm hover:bg-error/25 transition-colors cursor-pointer"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast de confirmación (cambio de motor / modelo) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] pointer-events-none"
          >
            <div className={`flex items-center gap-2 px-md py-sm rounded-xl border shadow-2xl backdrop-blur-md text-body-sm font-bold ${
              toast.tone === 'ok'
                ? 'bg-surface-container-high/95 border-emerald-400/30 text-on-surface'
                : 'bg-surface-container-high/95 border-amber-400/40 text-on-surface'
            }`}>
              {toast.tone === 'ok'
                ? <Cpu size={16} className="text-emerald-400 shrink-0" />
                : <AlertTriangle size={16} className="text-amber-400 shrink-0" />}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile only BottomNavigationBar */}
      <nav className="lg:hidden fixed bottom-0 w-full bg-[#1c1b1b] border-t border-white/5 flex justify-around items-center h-16 pb-safe px-4 shadow-[0_-4px_12px_rgba(124,58,237,0.1)] z-40 rounded-t-xl shrink-0">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center p-xs ${
            activeTab === 'dashboard' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <BarChart size={18} />
          <span className="text-[10px] scale-90">Inicio</span>
        </button>

        <button
          onClick={() => setActiveTab('transcribe')}
          className={`flex flex-col items-center justify-center p-xs ${
            activeTab === 'transcribe' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <Mic size={18} />
          <span className="text-[10px] scale-90">Transcribir</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex flex-col items-center justify-center p-xs ${
            activeTab === 'notes' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <FileText size={18} />
          <span className="text-[10px] scale-90 font-semibold">Notas</span>
        </button>

        <button
          onClick={() => setActiveTab('files-chat')}
          className={`flex flex-col items-center justify-center p-xs ${
            activeTab === 'files-chat' ? 'text-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <MessageSquare size={18} />
          <span className="text-[10px] scale-90 font-semibold font-sans">Archivos</span>
        </button>
      </nav>


    </div>
  );
}
