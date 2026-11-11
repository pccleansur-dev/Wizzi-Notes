import fs from 'fs';
import path from 'path';
import { docker, findServiceId } from './dockerWhisper';

/**
 * Modo GPU: permite liberar la VRAM (apagando llamacpp y Whisper) para usarla en otra cosa
 * (por ejemplo ComfyUI) y volver a encenderlos después.
 *
 * - 'ai'   : llamacpp y Whisper encendidos (normal).
 * - 'free' : llamacpp y Whisper apagados. Se reenciende solo al vencer `resumeAt`.
 *
 * El modo se guarda en disco: tras un redespliegue (Coolify recrea y enciende los contenedores)
 * o un reinicio, la app reaplica el modo guardado.
 */

export type GpuModeName = 'ai' | 'free';
export const GPU_SERVICES = ['llamacpp', 'whisper'] as const;
export type GpuService = (typeof GPU_SERVICES)[number];
export type ServiceState = 'running' | 'stopped' | 'missing';

export interface GpuModeState {
  mode: GpuModeName;
  since: number;            // ms epoch del último cambio
  resumeAt: number | null;  // ms epoch en que vuelve solo a 'ai' (solo en modo 'free')
}

export const DEFAULT_RESUME_HOURS = 4;
export const MAX_RESUME_HOURS = 24;

const PAUSED_MESSAGE =
  'La IA local está en pausa (GPU liberada). Pedile al administrador que la reactive o usá Gemini, OpenAI o Claude.';
export const gpuPausedMessage = () => PAUSED_MESSAGE;

let stateFile = path.join(process.cwd(), 'config', 'gpu-mode.json');
let state: GpuModeState = { mode: 'ai', since: Date.now(), resumeAt: null };
let busy = false;
let activeJobs = 0;
let timer: NodeJS.Timeout | null = null;

export function initGpuMode(configDir: string) {
  stateFile = path.join(configDir, 'gpu-mode.json');
  try {
    if (fs.existsSync(stateFile)) {
      const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      if (raw && (raw.mode === 'ai' || raw.mode === 'free')) {
        state = {
          mode: raw.mode,
          since: Number(raw.since) || Date.now(),
          resumeAt: raw.mode === 'free' && Number(raw.resumeAt) > 0 ? Number(raw.resumeAt) : null,
        };
      }
    }
  } catch (e: any) {
    console.warn('[gpu-mode] no se pudo leer el estado guardado, se usa "ai":', e?.message || e);
  }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
  } catch (e: any) {
    console.warn('[gpu-mode] no se pudo guardar el estado:', e?.message || e);
  }
}

/** ¿La IA local está pausada? (consulta síncrona y barata, para los handlers) */
export function isGpuPaused(): boolean {
  return state.mode === 'free';
}

/** Cuenta de trabajos locales en curso: no se deja liberar la GPU en medio de uno. */
export function beginLocalJob() { activeJobs++; }
export function endLocalJob() { activeJobs = Math.max(0, activeJobs - 1); }
export function localJobsInProgress() { return activeJobs; }

// ─── Nemotron (corre en Windows, fuera de Docker): se controla por un agente con token ───
// NEMOTRON_AGENT_URL (por defecto, el host de NEMOTRON_URL en el puerto 9011) y NEMOTRON_AGENT_TOKEN.
// Sin token configurado, la función queda desactivada y el resto del modo GPU funciona igual.

export type NemotronState = 'running' | 'stopped' | 'unreachable' | 'disabled';

function nemotronAgentConfig(): { url: string; token: string } | null {
  const token = (process.env.NEMOTRON_AGENT_TOKEN || '').trim();
  if (!token) return null;
  let url = (process.env.NEMOTRON_AGENT_URL || '').trim();
  if (!url) {
    try {
      const u = new URL(process.env.NEMOTRON_URL || 'http://localhost:9010');
      url = `${u.protocol}//${u.hostname}:9011`;
    } catch { return null; }
  }
  return { url: url.replace(/\/$/, ''), token };
}

async function agentCall(method: 'GET' | 'POST', route: string, timeoutMs: number): Promise<any> {
  const cfg = nemotronAgentConfig();
  if (!cfg) throw new Error('El agente de Nemotron no está configurado');
  const r = await fetch(`${cfg.url}${route}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Agente de Nemotron: ${data?.error || r.status}`);
  return data;
}

export async function getNemotronState(): Promise<NemotronState> {
  if (!nemotronAgentConfig()) return 'disabled';
  try {
    const d = await agentCall('GET', '/status', 4000);
    return d.running ? 'running' : 'stopped';
  } catch {
    return 'unreachable';
  }
}

/** Despierta (on=true) o duerme (on=false) a Nemotron. Despertar puede tardar hasta ~90 s. */
export async function setNemotron(on: boolean): Promise<NemotronState> {
  await agentCall('POST', on ? '/start' : '/stop', 150_000);
  return getNemotronState();
}

async function serviceState(service: GpuService): Promise<ServiceState> {
  try {
    const id = await findServiceId(service);
    const info = await docker('GET', `/containers/${id}/json`, undefined, 10_000);
    if (info.status !== 200) return 'missing';
    return info.data?.State?.Running ? 'running' : 'stopped';
  } catch {
    return 'missing';
  }
}

async function stopService(service: GpuService) {
  const id = await findServiceId(service);
  const r = await docker('POST', `/containers/${id}/stop?t=10`, undefined, 40_000);
  // 204 = detenido, 304 = ya estaba detenido
  if (r.status !== 204 && r.status !== 304) throw new Error(`No se pudo detener ${service} (${r.status})`);
}

async function startService(service: GpuService) {
  const id = await findServiceId(service);
  const r = await docker('POST', `/containers/${id}/start`, undefined, 40_000);
  // 204 = iniciado, 304 = ya estaba corriendo
  if (r.status !== 204 && r.status !== 304) throw new Error(`No se pudo iniciar ${service} (${r.status})`);
}

export async function getGpuStatus() {
  const [llamacpp, whisper, nemotron] = await Promise.all([
    serviceState('llamacpp'), serviceState('whisper'), getNemotronState(),
  ]);
  return {
    mode: state.mode,
    since: state.since,
    resumeAt: state.resumeAt,
    busy,
    localJobs: activeJobs,
    services: { llamacpp, whisper },
    nemotron,
  };
}

/** Cambia el modo. Lanza error si ya hay un cambio en curso o si hay trabajos locales (sin force). */
export async function setGpuMode(mode: GpuModeName, opts: { hours?: number; force?: boolean } = {}) {
  if (busy) throw Object.assign(new Error('Ya hay un cambio de modo en curso.'), { code: 'busy' });
  if (mode === 'free' && activeJobs > 0 && !opts.force) {
    throw Object.assign(
      new Error(`Hay ${activeJobs} trabajo(s) de IA local en curso. Esperá a que terminen.`),
      { code: 'jobs' },
    );
  }

  busy = true;
  try {
    if (mode === 'free') {
      const hours = Math.min(Math.max(Number(opts.hours) || DEFAULT_RESUME_HOURS, 0.25), MAX_RESUME_HOURS);
      // Primero se marca como pausado (así los handlers rechazan pedidos nuevos) y luego se apaga.
      state = { mode: 'free', since: Date.now(), resumeAt: Date.now() + hours * 3_600_000 };
      persist();
      const results = await Promise.allSettled(GPU_SERVICES.map(stopService));
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failed.length === GPU_SERVICES.length) {
        // No se pudo apagar nada: volver atrás para no mostrar un estado falso.
        state = { mode: 'ai', since: Date.now(), resumeAt: null };
        persist();
        throw new Error(String(failed[0].reason?.message || failed[0].reason));
      }
      if (failed.length) console.warn('[gpu-mode] algunos servicios no se pudieron detener:', failed.map((f) => f.reason?.message));
      // Nemotron también se duerme (mejor esfuerzo: si el agente no responde, no se frena el cambio).
      if (nemotronAgentConfig()) {
        await setNemotron(false).catch((e) => console.warn('[gpu-mode] no se pudo dormir Nemotron:', e?.message || e));
      }
    } else {
      const results = await Promise.allSettled(GPU_SERVICES.map(startService));
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failed.length === GPU_SERVICES.length) throw new Error(String(failed[0].reason?.message || failed[0].reason));
      if (failed.length) console.warn('[gpu-mode] algunos servicios no se pudieron iniciar:', failed.map((f) => f.reason?.message));
      state = { mode: 'ai', since: Date.now(), resumeAt: null };
      persist();
    }
  } finally {
    busy = false;
  }
  return getGpuStatus();
}

/**
 * Reconcilia el estado guardado con los contenedores reales.
 * - Tras un arranque/redespliegue: si el modo es 'free', vuelve a apagar lo que Coolify encendió.
 * - Si venció `resumeAt`: vuelve a 'ai'.
 */
export async function reconcileGpuMode(opts: { onBoot?: boolean } = {}) {
  if (busy) return;
  try {
    if (state.mode === 'free') {
      if (state.resumeAt && Date.now() >= state.resumeAt) {
        console.log('[gpu-mode] venció el tiempo de GPU libre: se reactiva la IA');
        await setGpuMode('ai');
        return;
      }
      for (const svc of GPU_SERVICES) {
        if ((await serviceState(svc)) === 'running') {
          console.log(`[gpu-mode] modo libre: se apaga ${svc} (lo había encendido un redespliegue)`);
          await stopService(svc).catch((e) => console.warn('[gpu-mode]', e?.message || e));
        }
      }
    } else if (opts.onBoot) {
      // Modo normal: asegurar que estén encendidos (por ejemplo si quedaron apagados tras un corte).
      for (const svc of GPU_SERVICES) {
        if ((await serviceState(svc)) === 'stopped') {
          console.log(`[gpu-mode] modo IA: se enciende ${svc}`);
          await startService(svc).catch((e) => console.warn('[gpu-mode]', e?.message || e));
        }
      }
    }
  } catch (e: any) {
    console.warn('[gpu-mode] reconciliación falló:', e?.message || e);
  }
}

/** Arranca la reconciliación al iniciar y cada minuto (para el reencendido automático). */
export function startGpuModeWatcher() {
  if (timer) return;
  setTimeout(() => { void reconcileGpuMode({ onBoot: true }); }, 15_000);
  timer = setInterval(() => { void reconcileGpuMode(); }, 60_000);
  timer.unref?.();
}
