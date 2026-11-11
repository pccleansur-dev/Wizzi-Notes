import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, Power, Loader2 } from 'lucide-react';

interface GpuStatus {
  mode: 'ai' | 'free';
  since: number;
  resumeAt: number | null;
  busy: boolean;
  localJobs: number;
  services: { llamacpp: 'running' | 'stopped' | 'missing'; whisper: 'running' | 'stopped' | 'missing' };
  nemotron: 'running' | 'stopped' | 'unreachable' | 'disabled';
  canToggle: boolean;
  defaultHours: number;
  maxHours: number;
}

/** Estado del modo GPU, compartido por el aviso y la tarjeta (se consulta cada 20 s). */
function useGpuStatus() {
  const [status, setStatus] = useState<GpuStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/gpu-mode', { credentials: 'include' });
      if (!r.ok) return;
      setStatus(await r.json());
    } catch { /* sin conexión: se mantiene el último estado */ }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { status, refresh };
}

function formatResume(resumeAt: number | null): string {
  if (!resumeAt) return '';
  const mins = Math.max(0, Math.round((resumeAt - Date.now()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Aviso visible para todos los usuarios cuando la IA local está en pausa. */
export function GpuModeBanner() {
  const { status } = useGpuStatus();
  if (!status || status.mode !== 'free') return null;
  return (
    <div className="fixed top-16 left-0 right-0 z-30 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-body-sm px-margin-mobile md:px-margin-desktop py-2 flex items-center gap-sm">
      <Cpu size={16} className="shrink-0" />
      <span>
        La IA local está en pausa (GPU liberada). Podés seguir usando Gemini, OpenAI o Claude.
        {status.resumeAt ? ` Se reactiva sola en ${formatResume(status.resumeAt)}.` : ''}
      </span>
    </div>
  );
}

/** Tarjeta de Ajustes: switch para liberar/recuperar la GPU. Solo se muestra a superusuarios. */
export default function GpuModeCard() {
  const { status, refresh } = useGpuStatus();
  const [hours, setHours] = useState<number>(4);
  const [working, setWorking] = useState(false);
  const [workingNemotron, setWorkingNemotron] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status?.defaultHours) setHours(status.defaultHours);
  }, [status?.defaultHours]);

  if (!status || !status.canToggle) return null;

  const isFree = status.mode === 'free';
  const loading = working || status.busy;

  const change = async (mode: 'ai' | 'free') => {
    setError('');
    setWorking(true);
    try {
      const r = await fetch('/api/gpu-mode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'free' ? { mode, hours } : { mode }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) setError(data?.error || `Error ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setWorking(false);
    }
  };

  const changeNemotron = async (on: boolean) => {
    setError('');
    setWorkingNemotron(true);
    try {
      const r = await fetch('/api/gpu-mode/nemotron', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) setError(data?.error || `Error ${r.status}`);
      await refresh();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setWorkingNemotron(false);
    }
  };

  const nemotronOn = status.nemotron === 'running';

  const dot = (s: string) => (s === 'running' ? 'bg-emerald-400' : s === 'stopped' ? 'bg-zinc-500' : 'bg-red-400');
  const label = (s: string) => (s === 'running' ? 'encendido' : s === 'stopped' ? 'apagado' : 'no encontrado');

  return (
    <div className="bg-surface-container rounded-xl border border-white/5 p-lg space-y-md shadow-md">
      <div>
        <h3 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest font-mono mb-xs">GPU del servidor</h3>
        <p className="text-body-sm text-on-surface-variant">
          Apaga la IA local (llama.cpp y Whisper) para liberar la VRAM, por ejemplo para usar ComfyUI. Con Gemini, OpenAI o Claude no cambia nada.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-md">
        <button
          type="button"
          role="switch"
          aria-checked={!isFree}
          disabled={loading}
          onClick={() => change(isFree ? 'ai' : 'free')}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:opacity-60 ${isFree ? 'bg-zinc-600' : 'bg-primary'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isFree ? 'translate-x-1' : 'translate-x-8'}`} />
        </button>
        <span className="text-body-md font-semibold text-on-surface flex items-center gap-xs">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
          {loading ? 'Aplicando…' : isFree ? 'GPU libre (IA local apagada)' : 'IA local activa'}
        </span>
      </div>

      {!isFree && (
        <label className="flex items-center gap-sm text-body-sm text-on-surface-variant">
          Al liberar, reactivar sola en
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            disabled={loading}
            className="bg-[#131313] border border-[#ccc3d8]/25 rounded-lg py-1 px-2 text-on-surface"
          >
            {[1, 2, 4, 8, 12, 24].filter((h) => h <= status.maxHours).map((h) => (
              <option key={h} value={h}>{h} h</option>
            ))}
          </select>
        </label>
      )}

      {isFree && status.resumeAt && (
        <p className="text-body-sm text-on-surface-variant">Se reactiva sola en {formatResume(status.resumeAt)}.</p>
      )}

      <div className="flex flex-wrap gap-md text-body-sm text-on-surface-variant">
        {(['llamacpp', 'whisper'] as const).map((s) => (
          <span key={s} className="flex items-center gap-xs">
            <span className={`inline-block h-2 w-2 rounded-full ${dot(status.services[s])}`} />
            {s === 'llamacpp' ? 'llama.cpp' : 'Whisper'}: {label(status.services[s])}
          </span>
        ))}
        {status.localJobs > 0 && <span>· {status.localJobs} trabajo(s) de IA local en curso</span>}
      </div>

      {status.nemotron !== 'disabled' && (
        <div className="border-t border-white/5 pt-md space-y-xs">
          <div className="flex flex-wrap items-center gap-md">
            <button
              type="button"
              role="switch"
              aria-checked={nemotronOn}
              disabled={workingNemotron || status.nemotron === 'unreachable'}
              onClick={() => changeNemotron(!nemotronOn)}
              className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors disabled:opacity-60 ${nemotronOn ? 'bg-primary' : 'bg-zinc-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${nemotronOn ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <span className="text-body-md font-semibold text-on-surface flex items-center gap-xs">
              {workingNemotron && <Loader2 size={16} className="animate-spin" />}
              {workingNemotron
                ? (nemotronOn ? 'Durmiendo Nemotron…' : 'Despertando Nemotron… (puede tardar un minuto)')
                : `Nemotron (transcripción): ${nemotronOn ? 'despierto' : status.nemotron === 'unreachable' ? 'sin conexión con el agente' : 'dormido'}`}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Usa ~1,2 GB de VRAM. Al liberar la GPU se duerme solo; se despierta solo cuando vos lo pedís.
          </p>
        </div>
      )}

      {error && <p className="text-body-sm text-red-400">{error}</p>}
    </div>
  );
}
