import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { AIProviderConfig, PROVIDER_OPTIONS } from '../types';

interface UploadZoneProps {
  providerConfig: AIProviderConfig;
  onProcessStarted: (jobId?: string) => void;
  onProcessError: (errorMsg: string) => void;
}

export default function UploadZone({
  providerConfig,
  onProcessStarted,
  onProcessError,
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { provider, models } = providerConfig;
  const currentModel = models[provider];
  const providerInfo = PROVIDER_OPTIONS[provider];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['mp3', 'wav', 'mp4', 'pdf', 'm4a', 'mov'];
    if (!validExts.includes(ext || '')) {
      onProcessError('Formato no soportado. Usa: PDF, MP3, WAV, MP4, M4A, MOV.');
      return;
    }

    const isPdf = ext === 'pdf';
    const isAudioVideo = !isPdf;

    if (isPdf && !providerInfo.supportsPDF) {
      onProcessError(`${providerInfo.label} no soporta PDFs. Cambia a Gemini o Anthropic en Configuración.`);
      return;
    }
    if (isAudioVideo && !providerInfo.supportsAudio) {
      onProcessError(`${providerInfo.label} no soporta audio/video. Cambia a Gemini u OpenAI en Configuración.`);
      return;
    }

    setSelectedFile(file);
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });

  // Resample audio to 16kHz mono WAV for better Whisper accuracy
  const prepareAudio = async (file: File): Promise<{ base64: string; mimeType: string }> => {
    if (file.type === 'application/pdf') {
      return { base64: await toBase64(file), mimeType: file.type };
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      const offlineCtx = new OfflineAudioContext(1, decoded.length, 16000);
      const src = offlineCtx.createBufferSource();
      src.buffer = decoded;
      src.connect(offlineCtx.destination);
      src.start(0);
      const rendered = await offlineCtx.startRendering();
      await audioCtx.close();
      const pcm = rendered.getChannelData(0);
      const wavBuffer = new ArrayBuffer(44 + pcm.length * 2);
      const view = new DataView(wavBuffer);
      const ws = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
      ws(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      ws(36, 'data'); view.setUint32(40, pcm.length * 2, true);
      for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      return { base64: await toBase64(new File([wavBlob], 'audio.wav', { type: 'audio/wav' })), mimeType: 'audio/wav' };
    } catch {
      return { base64: await toBase64(file), mimeType: file.type || 'audio/webm' };
    }
  };

  const handleSubmitFile = async () => {
    if (!selectedFile) return;
    const jobId = crypto.randomUUID();
    const isPdf = selectedFile.name.endsWith('.pdf') || selectedFile.type === 'application/pdf';
    const fileType = isPdf ? 'pdf' : (selectedFile.type.startsWith('video') ? 'video' : 'audio');
    setIsProcessing(true);
    onProcessStarted(jobId);
    try {
      const { base64: base64Data, mimeType: finalMime } = await prepareAudio(selectedFile);
      fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: currentModel,
          type: isPdf ? 'pdf' : 'multimodal',
          fileData: base64Data,
          mimeType: finalMime,
          jobId,
          fileName: selectedFile.name,
          noteType: fileType,
        }),
      }).catch((e) => onProcessError(e.message || 'Error enviando archivo.'));
      setSelectedFile(null);
    } catch (e: any) {
      onProcessError(e.message || 'Error leyendo archivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    const jobId = crypto.randomUUID();
    onProcessStarted(jobId);
    fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider, model: currentModel, type: 'text', text: rawText, jobId,
        fileName: 'Transcripción pegada',
        noteType: 'text',
      }),
    }).catch((e) => onProcessError(e.message || 'Error procesando texto.'));
    setRawText('');
  };

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/10 p-lg shadow-xl">
      {/* Provider badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-md border ${providerInfo.bg} ${providerInfo.color} ${providerInfo.border}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {providerInfo.label} · {currentModel}
      </div>

      {/* Tabs */}
      <div className="flex gap-xs p-1 bg-surface-container-lowest rounded-xl mb-lg border border-outline-variant/10">
        {(['upload', 'text'] as const).map((tab) => {
          const icons = { upload: <Upload size={16} />, text: <FileText size={16} /> };
          const labels = { upload: 'Subir Archivos', text: 'Texto Libre' };
          return (
            <button
              key={tab}
              onClick={() => !isProcessing && setActiveTab(tab)}
              disabled={isProcessing}
              className={`flex-1 flex items-center justify-center gap-sm py-2 px-md text-body-sm font-semibold rounded-lg transition-all ${
                activeTab === tab
                  ? 'bg-primary-container text-on-primary-container shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {icons[tab]}
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {isProcessing ? (
        <div className="flex flex-col items-center justify-center py-xl text-center space-y-md">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" size={24} />
          </div>
          <div className="space-y-sm w-full max-w-md px-md">
            <h4 className="text-body-lg font-bold text-on-surface animate-pulse">Wizzi Note está procesando...</h4>
            <p className="text-body-sm text-on-surface-variant">{progressMsg}</p>
            <p className="text-[11px] text-tertiary font-medium">Puede tardar desde unos segundos hasta un minuto.</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'upload' && (
            <div className="space-y-lg">
              {/* Compatibility warnings */}
              {!providerInfo.supportsAudio && (
                <div className={`flex items-start gap-sm p-sm rounded-lg text-xs font-semibold ${providerInfo.bg} ${providerInfo.color} border ${providerInfo.border}`}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{providerInfo.label} no soporta audio/video. Cambia a Gemini u OpenAI en Configuración para procesar grabaciones.</span>
                </div>
              )}
              {!providerInfo.supportsPDF && (
                <div className={`flex items-start gap-sm p-sm rounded-lg text-xs font-semibold ${providerInfo.bg} ${providerInfo.color} border ${providerInfo.border}`}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{providerInfo.label} no soporta PDFs directamente. Cambia a Gemini o Anthropic en Configuración.</span>
                </div>
              )}

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${
                  dragActive ? 'border-primary bg-primary-container/10' : 'border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-high'
                }`}
              >
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleChange} accept=".mp3,.wav,.pdf,.mp4,.m4a,.mov,.mpeg" data-upload-trigger />
                <Upload size={48} className={`mb-md transition-colors ${dragActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`} />
                <h4 className="font-bold text-body-lg text-on-surface mb-xs">Suelte su archivo aquí o explore</h4>
                <p className="text-body-sm text-on-surface-variant max-w-md mb-md leading-relaxed">
                  {providerInfo.supportsAudio && providerInfo.supportsPDF && 'Audio (MP3, WAV, M4A), Video (MP4, MOV) y PDF · hasta 25MB'}
                  {providerInfo.supportsAudio && !providerInfo.supportsPDF && 'Audio (MP3, WAV, M4A), Video (MP4, MOV) · hasta 25MB'}
                  {!providerInfo.supportsAudio && providerInfo.supportsPDF && 'Documentos PDF · hasta 25MB'}
                </p>
                <button type="button" className="bg-primary/10 text-primary hover:bg-primary/20 transition-all font-semibold rounded-lg px-lg py-sm border border-primary/20">
                  Seleccionar Archivo
                </button>
              </div>

              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface-container-high p-md rounded-xl border border-primary/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-md min-w-0">
                    <div className="p-sm bg-primary/10 rounded-lg text-primary shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold truncate text-on-surface">{selectedFile.name}</p>
                      <p className="text-[11px] text-on-surface-variant">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Listo para procesar</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSubmitFile}
                    className="bg-primary text-on-primary font-bold hover:scale-[1.02] active:scale-[0.98] transition-all rounded-lg px-md py-sm text-body-sm shrink-0 shadow-lg shadow-primary/10"
                  >
                    Procesar con IA
                  </button>
                </motion.div>
              )}
            </div>
          )}

          {activeTab === 'text' && (
            <form onSubmit={handleSubmitText} className="space-y-md">
              <div className="space-y-sm">
                <label className="text-label-md text-on-surface-variant uppercase tracking-widest block font-bold">Pegar Transcripción o Notas</label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Ej: [00:12] Orador 1: Hola, hoy revisaremos el presupuesto..."
                  rows={6}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-md px-md text-body-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/40 resize-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!rawText.trim()}
                className="w-full bg-primary text-on-primary font-bold hover:opacity-95 active:scale-[0.99] transition-all rounded-xl py-md text-body-sm shadow-lg shadow-primary-container/20 flex items-center justify-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                Sintetizar Minuta de Reunión
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
