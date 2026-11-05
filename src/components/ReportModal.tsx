import React, { useState } from 'react';
import { Bug, X, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  onClose: () => void;
  context: { tab?: string; asrProvider?: string; lastError?: string };
}

export default function ReportModal({ onClose, context }: Props) {
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  const send = async () => {
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context: { ...context, url: window.location.pathname } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el reporte.');
      setState('done');
    } catch (e: any) {
      setError(e.message || 'No se pudo enviar el reporte.');
      setState('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#1c1b1b] border border-white/10 rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white font-bold"><Bug size={18} className="text-amber-300" /> Reportar un problema</div>
          <button onClick={onClose} className="p-1 text-white/50 hover:text-white cursor-pointer" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {state === 'done' ? (
          <div className="text-center py-6">
            <CheckCircle2 size={36} className="text-green-400 mx-auto mb-2" />
            <p className="text-white font-semibold">¡Gracias! Recibimos tu reporte.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-primary text-black font-bold rounded-xl cursor-pointer">Cerrar</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-white/50 mb-2">Contanos qué estabas haciendo y qué salió mal. Adjuntamos datos técnicos básicos (pantalla, motor de transcripción y último error), no el contenido de tus notas.</p>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={3000}
              placeholder="Ej: grabé 10 minutos y al terminar no apareció la transcripción…"
              className="w-full bg-[#131313] border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 resize-none"
            />
            {context.lastError && (
              <p className="text-[11px] text-white/40 mt-2 break-words">Último error detectado: <span className="text-amber-200/80">{context.lastError}</span></p>
            )}
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-white/60 hover:text-white cursor-pointer">Cancelar</button>
              <button
                onClick={send}
                disabled={message.trim().length < 3 || state === 'sending'}
                className="px-4 py-2 bg-primary text-black font-bold rounded-xl disabled:opacity-40 flex items-center gap-2 cursor-pointer"
              >
                {state === 'sending' && <Loader2 size={14} className="animate-spin" />} Enviar reporte
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
