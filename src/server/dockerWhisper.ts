import http from 'http';
import os from 'os';

/**
 * Control del contenedor de Whisper desde la app, vía la API de Docker (socket montado).
 * Cambiar el modelo implica recrear el contenedor con ASR_MODEL distinto (el modelo se lee al arrancar).
 */

const SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';

export const WHISPER_MODELS = ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'] as const;

function docker<T = any>(method: string, apiPath: string, body?: unknown, timeoutMs = 60_000): Promise<{ status: number; data: T }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        socketPath: SOCKET,
        path: apiPath,
        method,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : undefined,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let data: any = text;
          try { data = text ? JSON.parse(text) : null; } catch { /* texto plano */ }
          resolve({ status: res.statusCode || 0, data });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Docker API timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function findWhisperId(): Promise<string> {
  const self = await docker('GET', `/containers/${encodeURIComponent(os.hostname())}/json`);
  if (self.status !== 200) throw new Error('No se pudo inspeccionar el contenedor de la app');
  const project = self.data?.Config?.Labels?.['com.docker.compose.project'];
  if (!project) throw new Error('La app no corre dentro de un proyecto docker compose');
  const filters = encodeURIComponent(JSON.stringify({
    label: [`com.docker.compose.project=${project}`, 'com.docker.compose.service=whisper'],
  }));
  const list = await docker('GET', `/containers/json?all=true&filters=${filters}`);
  const found = Array.isArray(list.data) ? list.data[0] : null;
  if (!found) throw new Error('No se encontró el contenedor de Whisper');
  return found.Id as string;
}

function envValue(env: string[] | undefined, key: string): string | undefined {
  const hit = env?.find((e) => e.startsWith(`${key}=`));
  return hit ? hit.slice(key.length + 1) : undefined;
}

/** Modelo con el que corre realmente el contenedor de Whisper. */
export async function getRunningWhisperModel(): Promise<string | undefined> {
  const id = await findWhisperId();
  const info = await docker('GET', `/containers/${id}/json`);
  if (info.status !== 200) throw new Error('No se pudo inspeccionar Whisper');
  return envValue(info.data?.Config?.Env, 'ASR_MODEL');
}

/** Recrea el contenedor de Whisper con otro ASR_MODEL, conservando el resto de su configuración. */
export async function applyWhisperModel(model: string): Promise<void> {
  if (!(WHISPER_MODELS as readonly string[]).includes(model)) throw new Error('Modelo inválido');
  const id = await findWhisperId();
  const info = await docker('GET', `/containers/${id}/json`);
  if (info.status !== 200) throw new Error('No se pudo inspeccionar Whisper');
  const c = info.data;

  const env: string[] = (c.Config.Env || []).filter((e: string) => !e.startsWith('ASR_MODEL='));
  env.push(`ASR_MODEL=${model}`);

  const name = String(c.Name || '').replace(/^\//, '');
  const networks = Object.entries<any>(c.NetworkSettings?.Networks || {});
  if (networks.length === 0) throw new Error('Whisper no tiene red');
  const [primaryName, primary] = networks[0];

  const createBody = {
    Image: c.Config.Image,
    Env: env,
    Cmd: c.Config.Cmd,
    Entrypoint: c.Config.Entrypoint,
    Labels: c.Config.Labels,
    ExposedPorts: c.Config.ExposedPorts,
    WorkingDir: c.Config.WorkingDir || undefined,
    User: c.Config.User || undefined,
    Healthcheck: c.Config.Healthcheck,
    HostConfig: c.HostConfig,
    NetworkingConfig: {
      EndpointsConfig: {
        [primaryName]: { Aliases: (primary.Aliases || []).filter((a: string) => !/^[0-9a-f]{12}$/.test(a)) },
      },
    },
  };

  // 1) detener y borrar el contenedor actual
  await docker('POST', `/containers/${id}/stop?t=10`, undefined, 30_000);
  const rm = await docker('DELETE', `/containers/${id}?force=true`);
  if (rm.status !== 204 && rm.status !== 404) throw new Error(`No se pudo borrar Whisper (${rm.status})`);

  // 2) crear con el modelo nuevo y arrancar
  const created = await docker('POST', `/containers/create?name=${encodeURIComponent(name)}`, createBody);
  if (created.status !== 201) throw new Error(`No se pudo crear Whisper: ${created.data?.message || created.status}`);
  const newId = created.data.Id as string;

  for (const [netName, net] of networks.slice(1)) {
    await docker('POST', `/networks/${encodeURIComponent(netName)}/connect`, {
      Container: newId,
      EndpointConfig: { Aliases: (net.Aliases || []).filter((a: string) => !/^[0-9a-f]{12}$/.test(a)) },
    });
  }

  const started = await docker('POST', `/containers/${newId}/start`);
  if (started.status !== 204 && started.status !== 304) {
    throw new Error(`No se pudo iniciar Whisper: ${started.data?.message || started.status}`);
  }
}
