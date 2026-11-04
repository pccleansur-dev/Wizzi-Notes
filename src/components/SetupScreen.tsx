import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff, CheckCircle2, ExternalLink, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PROVIDER_OPTIONS, AIProvider } from '../types';

interface SetupScreenProps {
  onComplete: () => void;
}

const PROVIDERS: { id: AIProvider; docsUrl: string }[] = [
  { id: 'gemini',    docsUrl: 'https://aistudio.google.com/' },
  { id: 'openai',    docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', docsUrl: 'https://console.anthropic.com/' },
];

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const [keys, setKeys] = useState({ GEMINI_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' });
  const [show, setShow] = useState({ gemini: false, openai: false, anthropic: false });
  const [auth, setAuth] = useState({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', APP_URL: 'http://localhost:3000', ALLOWED_EMAILS: '' });
  const [showAuthSection, setShowAuthSection] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const keyMap: Record<AIProvider, keyof typeof keys> = {
    gemini:    'GEMINI_API_KEY',
    openai:    'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  };

  const hasAtLeastOne = (Object.values(keys) as string[]).some((v) => v.trim().length > 0);

  const handleSave = async () => {
    if (!hasAtLeastOne) {
      setError('Configurá al menos una API key para continuar.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...keys, ...auth }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar.');
      }
      onComplete();
    } catch (e: any) {
      setError(e.message || 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg min-w-0"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Sparkles size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 whitespace-normal break-words">Bienvenido a Wizzi Note</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            Configurá al menos una API key para empezar. Podés agregar o cambiar las claves en cualquier momento desde Configuración.
          </p>
        </div>

        {/* Provider key inputs */}
        <div className="space-y-3 mb-6">
          {PROVIDERS.map(({ id, docsUrl }) => {
            const info = PROVIDER_OPTIONS[id];
            const keyName = keyMap[id];
            const value = keys[keyName];
            const visible = show[id];
            const filled = value.trim().length > 0;

            return (
              <div
                key={id}
                className={`rounded-xl border p-4 transition-all ${
                  filled
                    ? `${info.bg} ${info.border}`
                    : 'bg-surface-container border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {filled
                      ? <CheckCircle2 size={15} className={info.color} />
                      : <span className={`w-3.5 h-3.5 rounded-full border-2 ${info.border}`} />
                    }
                    <span className={`text-sm font-bold ${filled ? info.color : 'text-on-surface'}`}>
                      {info.label}
                    </span>
                  </div>
                  <a
                    href={docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary transition-colors"
                  >
                    Obtener key <ExternalLink size={11} />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={visible ? 'text' : 'password'}
                    placeholder={`${info.envVar}...`}
                    value={value}
                    onChange={(e) => setKeys((prev) => ({ ...prev, [keyName]: e.target.value }))}
                    className="w-full bg-[#131313] border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-lg py-2.5 pl-3 pr-10 text-sm text-on-surface outline-none transition-all font-mono placeholder:text-on-surface-variant/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((prev) => ({ ...prev, [id]: !prev[id] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors"
                  >
                    {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Google Auth — sección colapsable */}
        <div className="mb-6 rounded-xl border border-white/5 bg-surface-container overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAuthSection((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-on-surface-variant" />
              <span className="text-sm font-bold text-on-surface">Login con Google</span>
              <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant font-mono">opcional</span>
            </div>
            {showAuthSection ? <ChevronUp size={15} className="text-on-surface-variant" /> : <ChevronDown size={15} className="text-on-surface-variant" />}
          </button>

          <AnimatePresence>
            {showAuthSection && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Protege la app con login de Google. Solo los emails que configures podrán entrar.{' '}
                    <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                      Google Cloud Console <ExternalLink size={10} />
                    </a>
                  </p>

                  <input
                    type="text"
                    placeholder="Client ID"
                    value={auth.GOOGLE_CLIENT_ID}
                    onChange={(e) => setAuth((p) => ({ ...p, GOOGLE_CLIENT_ID: e.target.value }))}
                    className="w-full bg-[#131313] border border-white/10 focus:border-primary/50 rounded-lg py-2.5 px-3 text-sm text-on-surface outline-none transition-all font-mono placeholder:text-on-surface-variant/30"
                  />

                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Client Secret"
                      value={auth.GOOGLE_CLIENT_SECRET}
                      onChange={(e) => setAuth((p) => ({ ...p, GOOGLE_CLIENT_SECRET: e.target.value }))}
                      className="w-full bg-[#131313] border border-white/10 focus:border-primary/50 rounded-lg py-2.5 pl-3 pr-10 text-sm text-on-surface outline-none transition-all font-mono placeholder:text-on-surface-variant/30"
                    />
                    <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white">
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="URL de la app  (ej: http://localhost:3000)"
                    value={auth.APP_URL}
                    onChange={(e) => setAuth((p) => ({ ...p, APP_URL: e.target.value }))}
                    className="w-full bg-[#131313] border border-white/10 focus:border-primary/50 rounded-lg py-2.5 px-3 text-sm text-on-surface outline-none transition-all font-mono placeholder:text-on-surface-variant/30"
                  />

                  <div>
                    <input
                      type="text"
                      placeholder="Emails permitidos  (separados por coma)"
                      value={auth.ALLOWED_EMAILS}
                      onChange={(e) => setAuth((p) => ({ ...p, ALLOWED_EMAILS: e.target.value }))}
                      className="w-full bg-[#131313] border border-white/10 focus:border-primary/50 rounded-lg py-2.5 px-3 text-sm text-on-surface outline-none transition-all font-mono placeholder:text-on-surface-variant/30"
                    />
                    <p className="text-[10px] text-on-surface-variant/50 mt-1 px-1">
                      Dejalo vacío para permitir cualquier cuenta Google.
                    </p>
                  </div>

                  <div className="bg-surface-container-high rounded-lg p-3 text-[11px] text-on-surface-variant font-mono space-y-0.5">
                    <p className="text-on-surface font-bold mb-1">URI de redirección autorizada:</p>
                    <p className="text-primary break-all">{auth.APP_URL || 'http://localhost:3000'}/auth/google/callback</p>
                    <p className="text-on-surface-variant/60 mt-1">Copiá esta URL en tu proyecto de Google Cloud.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !hasAtLeastOne}
          className="w-full py-3.5 bg-primary text-black font-black rounded-xl hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary/20"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Empezar a usar Wizzi Note
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-on-surface-variant/50 mt-4">
          Las keys se guardan localmente en el servidor. Nunca se envían a terceros.
        </p>
      </motion.div>
    </div>
  );
}
