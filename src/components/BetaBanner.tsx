import React, { useState } from 'react';
import { FlaskConical, Bug, X } from 'lucide-react';

/** Aviso grande de beta para el login (siempre visible). */
export function BetaNotice() {
  return (
    <div className="w-full rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-left mb-6">
      <div className="flex items-center gap-2 mb-1.5">
        <FlaskConical size={18} className="text-amber-300" />
        <span className="text-amber-300 font-black uppercase tracking-widest text-xs">Plataforma en BETA</span>
      </div>
      <p className="text-sm text-amber-100/90 leading-relaxed">
        Podés iniciar sesión y usarla gratis mientras dure la beta. Si encontrás algún error, usá el botón
        <b> “Reportar un problema” </b>dentro de la app y lo vamos a solucionar. Más adelante algunas funciones podrían
        pasar a ser de pago; te vamos a avisar con anticipación.
      </p>
    </div>
  );
}

/** Franja dentro de la app: se puede cerrar, pero vuelve a aparecer en cada sesión del navegador. */
export function BetaStrip({ onReport }: { onReport: () => void }) {
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('beta-strip-hidden') === '1'; } catch { return false; }
  });
  if (hidden) return null;
  return (
    <div className="sticky top-0 shrink-0 z-30 bg-amber-400/15 border-b border-amber-400/30 backdrop-blur px-4 py-2 flex items-center gap-3 text-amber-100 text-xs sm:text-sm">
      <FlaskConical size={16} className="text-amber-300 shrink-0" />
      <p className="flex-1 min-w-0">
        <b className="text-amber-300">BETA:</b> la plataforma está en pruebas y es gratis por ahora. ¿Encontraste un error?
      </p>
      <button
        onClick={onReport}
        className="shrink-0 flex items-center gap-1.5 bg-amber-300 text-black font-bold px-3 py-1 rounded-full hover:bg-amber-200 transition-colors cursor-pointer"
      >
        <Bug size={13} /> Reportar
      </button>
      <button
        onClick={() => { try { sessionStorage.setItem('beta-strip-hidden', '1'); } catch { /* ignorar */ } setHidden(true); }}
        className="shrink-0 p-1 text-amber-200/70 hover:text-white cursor-pointer"
        aria-label="Cerrar aviso"
      >
        <X size={16} />
      </button>
    </div>
  );
}
