import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Prueba el modo GPU contra una API de Docker falsa (named pipe en Windows, socket unix en Linux).
 * DOCKER_SOCKET se define antes de importar los módulos, porque dockerWhisper lo lee al cargarse.
 */

const SOCK = process.platform === 'win32'
  ? `\\\\.\\pipe\\wizzi-gpu-test-${process.pid}`
  : path.join(os.tmpdir(), `wizzi-gpu-test-${process.pid}.sock`);
process.env.DOCKER_SOCKET = SOCK;

const running: Record<string, boolean> = { llamacpp: true, whisper: true };
const calls: string[] = [];

const fake = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  const p = url.pathname.replace(/^\/v[\d.]+/, '');
  const json = (status: number, body?: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (req.method === 'GET' && p === `/containers/${encodeURIComponent(os.hostname())}/json`) {
    return json(200, { Config: { Labels: { 'com.docker.compose.project': 'proj' } } });
  }
  if (req.method === 'GET' && p === '/containers/json') {
    const filters = JSON.parse(url.searchParams.get('filters') || '{}');
    const svc = (filters.label as string[]).find((l) => l.startsWith('com.docker.compose.service='))?.split('=')[1];
    return json(200, svc ? [{ Id: `id-${svc}` }] : []);
  }
  const m = p.match(/^\/containers\/id-(\w+)\/(json|stop|start)$/);
  if (m) {
    const [, svc, action] = m;
    if (action === 'json') return json(200, { State: { Running: running[svc] } });
    calls.push(`${action}:${svc}`);
    running[svc] = action === 'start';
    return json(204);
  }
  json(404, { message: 'no existe ' + p });
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wizzi-gpu-'));
let gpu: typeof import('./gpuMode');

test.before(async () => {
  await new Promise<void>((r) => fake.listen(SOCK, r));
  gpu = await import('./gpuMode');
  gpu.initGpuMode(tmp);
});

test.after(() => {
  fake.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('modo free apaga llamacpp y whisper, lo guarda y pausa la IA local', async () => {
  calls.length = 0;
  const st = await gpu.setGpuMode('free', { hours: 2 });
  assert.equal(st.mode, 'free');
  assert.deepEqual(st.services, { llamacpp: 'stopped', whisper: 'stopped' });
  assert.equal(gpu.isGpuPaused(), true);
  assert.ok(st.resumeAt && st.resumeAt > Date.now());
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'gpu-mode.json'), 'utf8'));
  assert.equal(saved.mode, 'free');
});

test('modo ai vuelve a encender los dos servicios', async () => {
  const st = await gpu.setGpuMode('ai');
  assert.equal(st.mode, 'ai');
  assert.deepEqual(st.services, { llamacpp: 'running', whisper: 'running' });
  assert.equal(gpu.isGpuPaused(), false);
  assert.equal(st.resumeAt, null);
});

test('no deja liberar la GPU con un trabajo local en curso, salvo force', async () => {
  gpu.beginLocalJob();
  await assert.rejects(() => gpu.setGpuMode('free'), (e: any) => e.code === 'jobs');
  assert.equal(gpu.isGpuPaused(), false);
  assert.deepEqual((await gpu.getGpuStatus()).services, { llamacpp: 'running', whisper: 'running' });
  gpu.endLocalJob();
  assert.equal(gpu.localJobsInProgress(), 0);
});

test('tras un redespliegue (contenedores encendidos) el modo free los vuelve a apagar', async () => {
  await gpu.setGpuMode('free', { hours: 1 });
  running.llamacpp = true; // Coolify lo recrea y lo enciende
  running.whisper = true;
  await gpu.reconcileGpuMode({ onBoot: true });
  assert.deepEqual((await gpu.getGpuStatus()).services, { llamacpp: 'stopped', whisper: 'stopped' });
});

test('al vencer resumeAt vuelve solo a modo ai y enciende los servicios', async () => {
  // Se simula un estado guardado con el tiempo vencido y se recarga
  fs.writeFileSync(path.join(tmp, 'gpu-mode.json'), JSON.stringify({ mode: 'free', since: Date.now() - 7_200_000, resumeAt: Date.now() - 1000 }));
  gpu.initGpuMode(tmp);
  assert.equal(gpu.isGpuPaused(), true);
  await gpu.reconcileGpuMode();
  assert.equal(gpu.isGpuPaused(), false);
  assert.deepEqual((await gpu.getGpuStatus()).services, { llamacpp: 'running', whisper: 'running' });
});

test('Nemotron: sin token configurado queda desactivado', async () => {
  delete process.env.NEMOTRON_AGENT_TOKEN;
  assert.equal(await gpu.getNemotronState(), 'disabled');
});

test('Nemotron: despertar, dormir y estado vía agente con token; free también lo duerme', async () => {
  const TOKEN = 'a'.repeat(40);
  let nemoRunning = false;
  const agentCalls: string[] = [];
  const agent = http.createServer((req, res) => {
    const send = (s: number, b: unknown) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'no autorizado' });
    agentCalls.push(`${req.method} ${req.url}`);
    if (req.url === '/status') return send(200, { running: nemoRunning });
    if (req.url === '/start') { nemoRunning = true; return send(200, { running: true }); }
    if (req.url === '/stop') { nemoRunning = false; return send(200, { running: false }); }
    send(404, {});
  });
  await new Promise<void>((r) => agent.listen(0, '127.0.0.1', r));
  const port = (agent.address() as any).port;
  process.env.NEMOTRON_AGENT_URL = `http://127.0.0.1:${port}`;
  process.env.NEMOTRON_AGENT_TOKEN = TOKEN;
  try {
    assert.equal(await gpu.getNemotronState(), 'stopped');
    assert.equal(await gpu.setNemotron(true), 'running');
    assert.equal((await gpu.getGpuStatus()).nemotron, 'running');
    // pasar a modo free duerme también a Nemotron
    await gpu.setGpuMode('free', { hours: 1 });
    assert.equal(nemoRunning, false);
    assert.ok(agentCalls.includes('POST /stop'));
    await gpu.setGpuMode('ai');

    // token incorrecto -> error, y estado inalcanzable
    process.env.NEMOTRON_AGENT_TOKEN = 'b'.repeat(40);
    assert.equal(await gpu.getNemotronState(), 'unreachable');
    await assert.rejects(() => gpu.setNemotron(true));
  } finally {
    delete process.env.NEMOTRON_AGENT_TOKEN;
    delete process.env.NEMOTRON_AGENT_URL;
    agent.close();
  }
});

test('Nemotron: agente caído no frena el cambio a modo free', async () => {
  process.env.NEMOTRON_AGENT_URL = 'http://127.0.0.1:1'; // nada escucha ahí
  process.env.NEMOTRON_AGENT_TOKEN = 'c'.repeat(40);
  try {
    assert.equal(await gpu.getNemotronState(), 'unreachable');
    const st = await gpu.setGpuMode('free', { hours: 1 });
    assert.equal(st.mode, 'free');
    await gpu.setGpuMode('ai');
  } finally {
    delete process.env.NEMOTRON_AGENT_TOKEN;
    delete process.env.NEMOTRON_AGENT_URL;
  }
});

test('si no se puede apagar ningún servicio, no queda un estado falso en free', async () => {
  const keep = running.llamacpp;
  const origStop = fake.listeners('request')[0] as (...a: any[]) => void;
  fake.removeAllListeners('request');
  fake.on('request', (req, res) => {
    if (req.method === 'POST' && /\/stop/.test(req.url || '')) { res.writeHead(500); return res.end(); }
    origStop(req, res);
  });
  await assert.rejects(() => gpu.setGpuMode('free'));
  assert.equal(gpu.isGpuPaused(), false);
  fake.removeAllListeners('request');
  fake.on('request', origStop);
  running.llamacpp = keep;
});
