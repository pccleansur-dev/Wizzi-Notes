import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, Save, Shield, ChevronDown, ChevronUp, Cpu, Zap } from 'lucide-react';
import { PROVIDER_OPTIONS, AIProvider } from '../types';

interface Props {
  onSaved: () => void;
}

const PROVIDERS: AIProvider[] = ['gemini', 'openai', 'anthropic'];
const KEY_NAMES: Record<AIProvider, string> = {
  gemini:    'GEMINI_API_KEY',
  openai:    'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

export default function SettingsKeyForm({ onSaved }: Props) {
  const [configured, setConfigured] = useState<Record<string, any>>({
    gemini: false, openai: false, anthropic: false, googleAuth: false, appUrl: '', ollamaNumGpu: '1',
  });
  const [keys, setKeys] = useState({ GEMINI_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' });
  const [show, setShow] = useState<Record<AIProvider, boolean>>({ gemini: false, openai: false, anthropic: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Google OAuth section
  const [showGoogleSection, setShowGoogleSection] = useState(false);
  const [googleFields, setGoogleFields] = useState({ ALLOWED_EMAILS: '' });
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [savedGoogle, setSavedGoogle] = useState(false);

  // Hardware section
  const [showHardwareSection, setShowHardwareSection] = useState(false);
  const [gpuMode, setGpuMode] = useState<'1' | '0'>('1');
  const [savingHw, setSavingHw] = useState(false);
  const [savedHw, setSavedHw] = useState(false);
  const [hwChanged, setHwChanged] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d);
        if (d.appUrl) setGoogleFields((p) => ({ ...p, APP_URL: d.appUrl }));
        if (d.googleAuth) setShowGoogleSection(true);
        if (d.ollamaNumGpu !== undefined) setGpuMode(d.ollamaNumGpu === '0' ? '0' : '1');
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    const hasChange = (Object.values(keys) as string[]).some((v) => v.trim().length > 0);
    if (!hasChange) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar.');
      // Refrescar estado
      const updated = await fetch('/api/config').then((r) => r.json());
      setConfigured(updated);
      setKeys({ GEMINI_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChange = (Object.values(keys) as string[]).some((v) => v.trim().length > 0);

  const handleSaveGoogle = async () => {
    setSavingGoogle(true);
    setSavedGoogle(false);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ALLOWED_EMAILS: googleFields.ALLOWED_EMAILS }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar.');
      const updated = await fetch('/api/config').then((r) => r.json());
      setConfigured(updated);
      setSavedGoogle(true);
      setTimeout(() => setSavedGoogle(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingGoogle(false);
    }
  };

  const handleSaveHardware = async () => {
    setSavingHw(true);
    setSavedHw(false);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ OLLAMA_NUM_GPU: gpuMode }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar.');
      setSavedHw(true);
      setHwChanged(false);
      setTimeout(() => setSavedHw(false), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingHw(false);
    }
  };

  return (
    <div className="space-y-3">
      {PROVIDERS.map((id) => {
        const info = PROVIDER_OPTIONS[id];
        const keyName = KEY_NAMES[id] as keyof typeof keys;
        const value = keys[keyName];
        const isConfigured = configured[id];

        return (
          <div key={id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              {isConfigured
                ? <CheckCircle2 size={13} className={info.color} />
                : <span className={`w-3 h-3 rounded-full border-2 ${info.border} opacity-40`} />
              }
              <span className={`text-[11px] font-bold uppercase tracking-widest ${isConfigured ? info.color : 'text-on-surface-variant'}`}>
                {info.label} {isConfigured ? '· configurada' : '· no configurada'}
              </span>
            </div>
            <div className="relative">
              <input
                type={show[id] ? 'text' : 'password'}
                placeholder={isConfigured ? '••••••••••••  (dejar vacío para mantener)' : `${info.envVar}...`}
                value={value}
                onChange={(e) => setKeys((prev) => ({ ...prev, [keyName]: e.target.value }))}
                className="w-full bg-[#131313] border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-lg py-2.5 pl-3 pr-10 text-sm text-on-surface outline-none transition-all font-mono placeholder:text-on-surface-variant/30"
              />
              <button
                type="button"
                onClick={() => setShow((prev) => ({ ...prev, [id]: !prev[id] }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors"
              >
                {show[id] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        );
      })}

      {error && (
        <p className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !hasChange}
        className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-lg text-sm font-bold hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
        {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
      </button>

      {/* ── Google OAuth ── */}
      <div className="mt-4 rounded-xl border border-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGoogleSection((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Shield size={14} className={configured.googleAuth ? 'text-tertiary' : 'text-on-surface-variant'} />
            <span className="text-sm font-bold text-on-surface">Login con Google</span>
            {configured.googleAuth
              ? <span className="text-[10px] bg-tertiary/10 border border-tertiary/20 text-tertiary px-2 py-0.5 rounded-full font-bold">Configurado</span>
              : <span className="text-[10px] bg-white/5 border border-white/10 text-on-surface-variant px-2 py-0.5 rounded-full font-mono">opcional</span>
            }
          </div>
          {showGoogleSection ? <ChevronUp size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
        </button>

        {showGoogleSection && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3 bg-surface-container-lowest/30">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              El login con Google está configurado por el administrador. Podés restringir el acceso por email.
            </p>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono block mb-1">
                Emails permitidos <span className="normal-case text-on-surface-variant/60">(separados por coma, vacío = cualquiera)</span>
              </label>
              <input
                type="text"
                placeholder="tumail@gmail.com, otro@empresa.com"
                value={googleFields.ALLOWED_EMAILS}
                onChange={(e) => setGoogleFields((p) => ({ ...p, ALLOWED_EMAILS: e.target.value }))}
                className="w-full bg-[#131313] border border-white/10 focus:border-primary/50 rounded-lg py-2.5 px-3 text-sm text-on-surface outline-none transition-all font-mono placeholder:text-on-surface-variant/30"
              />
            </div>

            <button
              onClick={handleSaveGoogle}
              disabled={savingGoogle}
              className="flex items-center gap-2 px-4 py-2 bg-tertiary/10 border border-tertiary/20 text-tertiary rounded-lg text-sm font-bold hover:bg-tertiary/20 transition-all disabled:opacity-40"
            >
              {savingGoogle ? <span className="w-3.5 h-3.5 border-2 border-tertiary/30 border-t-tertiary rounded-full animate-spin" /> : savedGoogle ? <CheckCircle2 size={14} /> : <Shield size={14} />}
              {savingGoogle ? 'Guardando...' : savedGoogle ? 'Guardado' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
      {/* ── Hardware / GPU ── */}
      <div className="mt-1 rounded-xl border border-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHardwareSection((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Zap size={14} className={gpuMode === '1' ? 'text-yellow-400' : 'text-on-surface-variant'} />
            <span className="text-sm font-bold text-on-surface">Aceleración de Hardware</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              gpuMode === '1'
                ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400'
                : 'bg-white/5 border-white/10 text-on-surface-variant'
            }`}>
              {gpuMode === '1' ? 'GPU · NVIDIA' : 'CPU'}
            </span>
          </div>
          {showHardwareSection ? <ChevronUp size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
        </button>

        {showHardwareSection && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3 bg-surface-container-lowest/30">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Seleccioná cómo Llama.cpp procesa los modelos locales. GPU es mucho más rápido pero requiere NVIDIA con drivers recientes.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {([
                { value: '1', label: 'GPU (NVIDIA)', icon: <Zap size={16} />, desc: '~5s por fragmento', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
                { value: '0', label: 'Solo CPU', icon: <Cpu size={16} />, desc: '~60s por fragmento', color: 'text-on-surface-variant', bg: 'bg-white/5', border: 'border-white/10' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setGpuMode(opt.value); setHwChanged(true); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    gpuMode === opt.value
                      ? `${opt.bg} ${opt.border} ${opt.color}`
                      : 'bg-transparent border-white/5 text-on-surface-variant hover:border-white/20'
                  }`}
                >
                  {opt.icon}
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-[10px] opacity-60">{opt.desc}</span>
                </button>
              ))}
            </div>

            {savedHw && (
              <div className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg px-3 py-2 leading-relaxed">
                <p className="font-bold mb-1">✓ Guardado — Reiniciá Llama.cpp para aplicar:</p>
                <code className="text-[11px] bg-black/30 px-2 py-1 rounded font-mono block">docker compose restart llamacpp</code>
              </div>
            )}

            <button
              onClick={handleSaveHardware}
              disabled={savingHw || !hwChanged}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 rounded-lg text-sm font-bold hover:bg-yellow-400/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingHw ? <span className="w-3.5 h-3.5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" /> : <Save size={14} />}
              {savingHw ? 'Guardando...' : 'Aplicar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
