import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Eye, EyeOff, CheckCircle2, ExternalLink, LogOut } from 'lucide-react';
import { PROVIDER_OPTIONS, AIProvider } from '../types';

interface Props {
  user: { name: string; email: string; avatar?: string };
  onRegistered: () => void;
}

const PROVIDERS: { id: AIProvider; docsUrl: string }[] = [
  { id: 'gemini',    docsUrl: 'https://aistudio.google.com/' },
  { id: 'openai',    docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', docsUrl: 'https://console.anthropic.com/' },
];

const KEY_NAMES: Record<AIProvider, string> = {
  gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY',
};

export default function RegisterScreen({ user, onRegistered }: Props) {
  const [keys, setKeys] = useState({ GEMINI_API_KEY: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' });
  const [show, setShow] = useState<Record<AIProvider, boolean>>({ gemini: false, openai: false, anthropic: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasAtLeastOne = (Object.values(keys) as string[]).some((v) => v.trim().length > 0);

  const handleSave = async () => {
    if (!hasAtLeastOne) { setError('Configurá al menos una API key.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al registrar.');
      onRegistered();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Sparkles size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Completá tu cuenta</h1>
          <p className="text-on-surface-variant text-sm">
            Hola, <span className="text-white font-semibold">{user.name}</span>. Tu cuenta no está en la lista de acceso directo.
            Para usar Wizzi Note, configurá tus propias API keys — cada llamada a la IA se factura a tu cuenta.
          </p>
        </div>

        {/* User badge */}
        <div className="flex items-center gap-3 p-3 bg-surface-container rounded-xl border border-white/5 mb-6">
          {user.avatar
            ? <img referrerPolicy="no-referrer" src={user.avatar} alt={user.name} className="w-9 h-9 rounded-lg border border-white/10" />
            : <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black">{user.name.charAt(0)}</div>
          }
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-on-surface">{user.name}</p>
            <p className="text-xs text-on-surface-variant">{user.email}</p>
          </div>
          <button
            onClick={async () => { await fetch('/auth/logout', { method: 'POST' }); window.location.reload(); }}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-error transition-colors"
          >
            <LogOut size={13} />
            Salir
          </button>
        </div>

        {/* Keys */}
        <div className="space-y-3 mb-6">
          {PROVIDERS.map(({ id, docsUrl }) => {
            const info = PROVIDER_OPTIONS[id];
            const keyName = KEY_NAMES[id] as keyof typeof keys;
            const value = keys[keyName];
            const filled = value.trim().length > 0;
            return (
              <div key={id} className={`rounded-xl border p-4 transition-all ${filled ? `${info.bg} ${info.border}` : 'bg-surface-container border-white/5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {filled
                      ? <CheckCircle2 size={14} className={info.color} />
                      : <span className={`w-3 h-3 rounded-full border-2 ${info.border} opacity-50`} />
                    }
                    <span className={`text-sm font-bold ${filled ? info.color : 'text-on-surface'}`}>{info.label}</span>
                  </div>
                  <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary transition-colors">
                    Obtener key <ExternalLink size={10} />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={show[id] ? 'text' : 'password'}
                    placeholder={`${info.envVar}...`}
                    value={value}
                    onChange={(e) => setKeys((p) => ({ ...p, [keyName]: e.target.value }))}
                    className="w-full bg-[#131313] border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-lg py-2.5 pl-3 pr-10 text-sm text-on-surface outline-none transition-all font-mono placeholder:text-on-surface-variant/30"
                  />
                  <button type="button" onClick={() => setShow((p) => ({ ...p, [id]: !p[id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-colors">
                    {show[id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !hasAtLeastOne}
          className="w-full py-3.5 bg-primary text-black font-black rounded-xl hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-lg shadow-primary/20"
        >
          {saving
            ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Guardando...</>
            : <><Sparkles size={16} />Empezar a usar Wizzi Note</>
          }
        </button>

        <p className="text-center text-[11px] text-on-surface-variant/40 mt-4">
          Tus keys se guardan en el servidor de esta instancia. No se comparten con nadie.
        </p>
      </motion.div>
    </div>
  );
}
