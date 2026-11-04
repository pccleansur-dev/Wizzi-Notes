import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';

dotenv.config();

// ─── Progress SSE ─────────────────────────────────────────────────────────────
const progressClients = new Map<string, Response>();
const jobResults = new Map<string, object>(); // fallback store if SSE is closed before done

function emitProgress(jobId: string, data: object) {
  const client = progressClients.get(jobId);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
  // Always store done/error results so client can poll if SSE dropped
  if ((data as any).stage === 'done' || (data as any).stage === 'error') {
    jobResults.set(jobId, data);
    // Auto-clean after 5 minutes
    setTimeout(() => jobResults.delete(jobId), 5 * 60 * 1000);
  }
}

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Config file paths (must be declared before any function that uses them) ──
const CONFIG_DIR = path.join(process.cwd(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'keys.json');
const USERS_DIR = path.join(CONFIG_DIR, 'users');

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ─── Session & Passport ───────────────────────────────────────────────────────
app.use(session({
  secret: getOrCreateSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true solo si usás HTTPS en producción
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  },
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

// Google Strategy — se reconfigura en cada llamada para leer keys actualizadas
function getGoogleStrategy() {
  const clientID = getKey('GOOGLE_CLIENT_ID')!;
  const clientSecret = getKey('GOOGLE_CLIENT_SECRET')!;
  const callbackURL = `${getKey('APP_URL') || process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`;

  return new GoogleStrategy({ clientID, clientSecret, callbackURL }, (accessToken, _rt, profile, done) => {
    const email = profile.emails?.[0]?.value?.toLowerCase() || '';
    return done(null, {
      id: profile.id,
      email,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
      accessToken,
    });
  });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isGoogleAuthConfigured() || req.isAuthenticated()) return next();
  res.status(401).json({ error: 'No autenticado.' });
}

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,                  // 120 req/min para uso normal
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/api/transcribe-chunk', // chunks de grabación van sin límite
  message: { error: 'Demasiadas solicitudes. Esperá un momento antes de intentar de nuevo.' },
});
app.use('/api/', apiLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 25;
app.use(express.json({ limit: `${MAX_UPLOAD_MB * 2}mb` })); // x2 por overhead base64
app.use(express.urlencoded({ limit: `${MAX_UPLOAD_MB * 2}mb`, extended: true }));

// ─── Structured output schema (shared) ────────────────────────────────────────

const STRUCTURED_SCHEMA_DESCRIPTION = `Devuelve un JSON con exactamente estas claves:
- "transcription": texto completo de la transcripción o contenido extraído
- "summary": resumen ejecutivo claro y detallado
- "decisions": array de strings con decisiones clave o conclusiones
- "actionItems": array de strings con tareas pendientes o recomendaciones accionables`;

// ─── Config file (persiste keys entre reinicios) ──────────────────────────────

interface KeysConfig {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APP_URL?: string;
  ALLOWED_EMAILS?: string;
  SESSION_SECRET?: string;
  OLLAMA_NUM_GPU?: string;  // "1" = GPU, "0" = CPU
}

function readKeysConfig(): KeysConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // archivo corrupto o inexistente — ignorar
  }
  return {};
}

function writeKeysConfig(keys: KeysConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  // Merge con lo existente para no borrar keys que no se envían
  const current = readKeysConfig();
  const next: KeysConfig = { ...current };
  for (const [k, v] of Object.entries(keys)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      next[k as keyof KeysConfig] = String(v).trim();
    }
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf-8');
}

function getKey(name: keyof KeysConfig): string | undefined {
  const fromFile = readKeysConfig()[name];
  return fromFile || process.env[name];
}

function getAllowedEmails(): string[] {
  const raw = getKey('ALLOWED_EMAILS') || '';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function isGoogleAuthConfigured(): boolean {
  return !!(getKey('GOOGLE_CLIENT_ID') && getKey('GOOGLE_CLIENT_SECRET'));
}

// ─── Per-user key storage ─────────────────────────────────────────────────────

interface UserData {
  email: string;
  name: string;
  avatar?: string;
  registeredAt: string;
  keys: { GEMINI_API_KEY?: string; OPENAI_API_KEY?: string; ANTHROPIC_API_KEY?: string };
}

function emailToFilename(email: string): string {
  // Sanitiza el email para usarlo como nombre de archivo
  return email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_') + '.json';
}

function readUserData(email: string): UserData | null {
  try {
    const file = path.join(USERS_DIR, emailToFilename(email));
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {}
  return null;
}

function writeUserData(data: UserData): void {
  if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
  const file = path.join(USERS_DIR, emailToFilename(data.email));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedEmails();
  // Lista vacía = cualquiera puede entrar con keys globales
  return allowed.length === 0 || allowed.includes(email.toLowerCase());
}

// Resuelve las keys para el usuario activo en el request
function getUserKeys(req: Request): { GEMINI?: string; OPENAI?: string; ANTHROPIC?: string } {
  const user = req.user as any;
  if (!user?.email) return {};
  // Si tiene keys propias las usa; si no, usa las globales
  const userData = readUserData(user.email);
  if (userData?.keys) {
    return {
      GEMINI:    userData.keys.GEMINI_API_KEY,
      OPENAI:    userData.keys.OPENAI_API_KEY,
      ANTHROPIC: userData.keys.ANTHROPIC_API_KEY,
    };
  }
  return {};
}

// Genera y persiste SESSION_SECRET automáticamente en el primer arranque
function getOrCreateSessionSecret(): string {
  const existing = getKey('SESSION_SECRET');
  if (existing) return existing;
  const generated = crypto.randomBytes(32).toString('hex');
  writeKeysConfig({ SESSION_SECRET: generated });
  return generated;
}

// ─── Provider clients (lazy) ───────────────────────────────────────────────────

function getGeminiClient(userKey?: string): GoogleGenAI {
  const apiKey = userKey || getKey('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada.');
  return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'wizzi-note' } } });
}

function getOpenAIClient(userKey?: string): OpenAI {
  const apiKey = userKey || getKey('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada.');
  return new OpenAI({ apiKey });
}

function getAnthropicClient(userKey?: string): Anthropic {
  const apiKey = userKey || getKey('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada.');
  return new Anthropic({ apiKey });
}

// ─── Gemini process ───────────────────────────────────────────────────────────

async function processWithGemini(body: any, model: string, userKey?: string) {
  const { type, fileData, mimeType, youtubeUrl, text } = body;
  const ai = getGeminiClient(userKey);

  let contents: any[] = [];
  let systemInstruction = '';

  if (type === 'multimodal') {
    if (!fileData || !mimeType) throw new Error('Faltan datos de archivo o tipo MIME.');
    systemInstruction = `Eres un transcriptor experto para Wizzi Note. Transcribe el audio/video con identificación de oradores y timestamps [MM:SS]. Genera un resumen ejecutivo, decisiones clave y action items.`;
    contents = [
      { inlineData: { data: fileData, mimeType } },
      'Transcribe detalladamente e identifica oradores con marcas de tiempo. Genera el JSON estructurado.'
    ];
  } else if (type === 'pdf') {
    if (!fileData || !mimeType) throw new Error('Faltan datos del PDF.');
    systemInstruction = `Eres un analista de documentos para Wizzi Note. Extrae y organiza el contenido del PDF en secciones, genera un resumen ejecutivo, decisiones y action items.`;
    contents = [
      { inlineData: { data: fileData, mimeType } },
      'Procesa este PDF. Extrae su contenido en "transcription", resumen en "summary", conclusiones en "decisions" y recomendaciones en "actionItems".'
    ];
  } else if (type === 'youtube') {
    if (!youtubeUrl) throw new Error('Falta la URL de YouTube.');
    systemInstruction = `Eres un asistente de investigación. Usa Google Search para encontrar información sobre el video de YouTube y sintetiza una transcripción/resumen estructurado.`;
    contents = [`Busca y resume el video de YouTube: ${youtubeUrl}. Genera el JSON estructurado.`];
  } else if (type === 'text') {
    if (!text) throw new Error('No se proveyó texto.');
    systemInstruction = `Eres un analizador de minutas corporativo. Toma el texto y genera la mejor minuta de reunión estructurada en español.`;
    contents = [`Texto de transcripción:\n\n${text}\n\nGenera el JSON estructurado.`];
  } else {
    throw new Error('Tipo no soportado.');
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      tools: type === 'youtube' ? [{ googleSearch: {} }] : undefined,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          transcription: { type: Type.STRING },
          summary: { type: Type.STRING },
          decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['transcription', 'summary', 'decisions', 'actionItems'],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}

// ─── OpenAI process ───────────────────────────────────────────────────────────

async function processWithOpenAI(body: any, model: string, userKey?: string) {
  const { type, fileData, mimeType, youtubeUrl, text, fileName } = body;
  const openai = getOpenAIClient(userKey);

  if (type === 'multimodal') {
    if (!fileData || !mimeType) throw new Error('Faltan datos de archivo o tipo MIME.');

    // Step 1: transcribe with Whisper
    const audioBuffer = Buffer.from(fileData, 'base64');
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'mp3';
    const whisperFile = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

    const whisperResult = await openai.audio.transcriptions.create({
      file: whisperFile,
      model: 'whisper-1',
      language: 'es',
      response_format: 'text',
    });

    const rawTranscript = typeof whisperResult === 'string' ? whisperResult : (whisperResult as any).text || '';

    // Step 2: structure with GPT
    const structureResponse = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Eres un analista de minutas corporativo. ${STRUCTURED_SCHEMA_DESCRIPTION}`,
        },
        {
          role: 'user',
          content: `Tienes la siguiente transcripción de audio. Estructúrala como minuta de reunión identificando oradores si es posible:\n\n${rawTranscript}`,
        },
      ],
    });

    return JSON.parse(structureResponse.choices[0].message.content || '{}');

  } else if (type === 'pdf') {
    throw new Error('OpenAI no soporta PDFs directamente en esta integración. Usa Gemini o Anthropic para procesar PDFs.');

  } else if (type === 'youtube') {
    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Eres un asistente de investigación. ${STRUCTURED_SCHEMA_DESCRIPTION}. Nota: no tienes acceso directo al video, genera el mejor resumen posible basado en tu conocimiento sobre el contenido.`,
        },
        {
          role: 'user',
          content: `Resume el contenido del video de YouTube: ${youtubeUrl}`,
        },
      ],
    });
    return JSON.parse(response.choices[0].message.content || '{}');

  } else if (type === 'text') {
    if (!text) throw new Error('No se proveyó texto.');
    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Eres un analizador de minutas corporativo. ${STRUCTURED_SCHEMA_DESCRIPTION}`,
        },
        {
          role: 'user',
          content: `Analiza esta transcripción y genera la minuta estructurada:\n\n${text}`,
        },
      ],
    });
    return JSON.parse(response.choices[0].message.content || '{}');
  }

  throw new Error('Tipo no soportado.');
}

// ─── Anthropic process ────────────────────────────────────────────────────────

async function processWithAnthropic(body: any, model: string, userKey?: string) {
  const { type, fileData, mimeType, youtubeUrl, text } = body;
  const anthropic = getAnthropicClient(userKey);

  if (type === 'multimodal') {
    throw new Error('Anthropic Claude no soporta transcripción de audio/video. Usa Gemini o OpenAI para este tipo de archivo.');
  }

  let userContent: Anthropic.MessageParam['content'];

  if (type === 'pdf') {
    if (!fileData || !mimeType) throw new Error('Faltan datos del PDF.');
    userContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileData },
      } as any,
      {
        type: 'text',
        text: 'Extrae y organiza el contenido del PDF. Responde SOLO con un JSON válido con las claves: transcription, summary, decisions (array), actionItems (array).',
      },
    ];
  } else if (type === 'youtube') {
    userContent = `Resume el contenido del video de YouTube: ${youtubeUrl}. Responde SOLO con un JSON válido con las claves: transcription, summary, decisions (array), actionItems (array).`;
  } else if (type === 'text') {
    if (!text) throw new Error('No se proveyó texto.');
    userContent = `Analiza esta transcripción y genera la minuta estructurada:\n\n${text}\n\nResponde SOLO con un JSON válido con las claves: transcription, summary, decisions (array), actionItems (array).`;
  } else {
    throw new Error('Tipo no soportado.');
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: `Eres un analista de minutas corporativo para Wizzi Note. ${STRUCTURED_SCHEMA_DESCRIPTION}. Responde ÚNICAMENTE con JSON válido, sin texto adicional.`,
    messages: [{ role: 'user', content: userContent }],
  });

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '{}';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
}

// ─── Chat per provider ────────────────────────────────────────────────────────

async function chatWithGemini(message: string, transcript: string, history: any[], model: string, userKey?: string) {
  const ai = getGeminiClient(userKey);
  const systemInstruction = `Eres la IA analista de Wizzi Note. Responde en español basándote en este contexto del documento activo:
------------------------------------------
${transcript || 'Sin documento activo.'}
------------------------------------------
Si la respuesta no está en el contexto, responde con tu conocimiento general aclarando que no está en el documento.`;

  const contents: any[] = [];
  for (const msg of (history || [])) {
    contents.push({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await ai.models.generateContent({ model, contents, config: { systemInstruction } });
  return response.text;
}

async function chatWithOpenAI(message: string, transcript: string, history: any[], model: string, userKey?: string) {
  const openai = getOpenAIClient(userKey);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `Eres la IA analista de Wizzi Note. Responde en español basándote en este contexto:\n------------------------------------------\n${transcript || 'Sin documento activo.'}\n------------------------------------------\nSi la info no está en el contexto, responde con conocimiento general aclarando que no está en el documento.`,
    },
  ];

  for (const msg of (history || [])) {
    messages.push({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text });
  }
  messages.push({ role: 'user', content: message });

  const response = await openai.chat.completions.create({ model, messages });
  return response.choices[0].message.content;
}

async function chatWithAnthropic(message: string, transcript: string, history: any[], model: string, userKey?: string) {
  const anthropic = getAnthropicClient(userKey);
  const anthropicHistory: Anthropic.MessageParam[] = [];

  for (const msg of (history || [])) {
    anthropicHistory.push({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text });
  }
  anthropicHistory.push({ role: 'user', content: message });

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: `Eres la IA analista de Wizzi Note. Responde en español basándote en este contexto del documento activo:\n------------------------------------------\n${transcript || 'Sin documento activo.'}\n------------------------------------------\nSi la info no está en el contexto, responde con conocimiento general aclarando que no está en el documento.`,
    messages: anthropicHistory,
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ─── Local (Ollama + Whisper) ─────────────────────────────────────────────────

const LLAMACPP_URL      = process.env.LLAMACPP_URL || 'http://llamacpp:8080';
const WHISPER_URL       = process.env.WHISPER_URL  || 'http://localhost:9000';
const HW_AGENT_URL      = 'http://host.docker.internal:3099';

async function transcribeWithWhisper(fileData: string, mimeType: string): Promise<string> {
  const buffer = Buffer.from(fileData, 'base64');
  const ext = mimeType.split('/')[1]?.replace('x-', '') || 'webm';
  console.log(`[Whisper] Sending ${buffer.length} bytes, type: ${mimeType}, ext: ${ext}`);
  const blob = new Blob([buffer], { type: mimeType });
  const form = new FormData();
  form.append('audio_file', blob, `audio.${ext}`);
  const res = await fetch(`${WHISPER_URL}/asr?output=json&language=es&task=transcribe&word_timestamps=false`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper error: ${res.status}`);
  const data: any = await res.json();
  console.log('[Whisper response]', JSON.stringify(data));
  const raw = data.text || '';
  return raw.replace(/<\|[^|]+\|>/g, '').trim();
}

// ─── Llama.cpp server (OpenAI-compatible API) ────────────────────────────────

const LLAMACPP_HEADERS = {
  'Content-Type': 'application/json',
  'Connection': 'close',          // disable keep-alive — llamacpp closes connections between requests
};

/** Check if an error is a recoverable socket/connection reset */
function isRetryable(e: unknown): boolean {
  const msg = String(e);
  return msg.includes('terminated') || msg.includes('other side closed') ||
         msg.includes('ECONNRESET') || msg.includes('UND_ERR_SOCKET') ||
         msg.includes('fetch failed');
}

async function chatWithLocal(prompt: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${LLAMACPP_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: LLAMACPP_HEADERS,
        body: JSON.stringify({
          model: 'local',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.3,
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(300000),
      });
      if (!res.ok) throw new Error(`Llama.cpp error: ${res.status}`);
      const data: any = await res.json();
      return data.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (e) {
      if (attempt < retries && isRetryable(e)) {
        console.warn(`[llamacpp] Reintentando (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('chatWithLocal: max retries exceeded');
}

async function chatWithLocalStreaming(
  prompt: string,
  onToken: (token: string) => void,
  retries = 2
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${LLAMACPP_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: LLAMACPP_HEADERS,
        body: JSON.stringify({
          model: 'local',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: 0.3,
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(600000),
      });
      if (!res.ok) throw new Error(`Llama.cpp error: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') continue;
          try {
            const obj = JSON.parse(json);
            const token = obj.choices?.[0]?.delta?.content ?? '';
            if (token) { full += token; onToken(token); }
          } catch {}
        }
      }
      return full;
    } catch (e) {
      if (attempt < retries && isRetryable(e)) {
        console.warn(`[llamacpp streaming] Reintentando (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('chatWithLocalStreaming: max retries exceeded');
}

// List GGUF model files available in the models volume
async function getLoadedLlamaCppModel(): Promise<string> {
  try {
    const res = await fetch(`${LLAMACPP_URL}/v1/models`);
    if (!res.ok) return 'unknown';
    const data: any = await res.json();
    return data.data?.[0]?.id ?? 'unknown';
  } catch { return 'unknown'; }
}

function parseSectioned(text: string, fallbackTranscription: string) {
  // Match ## TITULO or **TITULO** as section delimiters (handles models that ignore ## instructions)
  const get = (header: string) => {
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      text.match(new RegExp(`(?:##\\s*|\\*\\*\\s*)${escaped}[^\\n*]*(?:\\*\\*)?\\s*\\n([\\s\\S]*?)(?=(?:##|\\*\\*[A-ZÁÉÍÓÚÑ]{3})|$)`, 'i'))?.[1]?.trim() ?? ''
    );
  };

  const toList = (block: string) =>
    block.split('\n').map(l => l.replace(/^[-*•\[\]\s✓]+/, '').trim()).filter(Boolean);

  const summary      = get('RESUMEN EJECUTIVO') || get('RESUMEN');
  const participants = get('PARTICIPANTES');
  const decisionsRaw = get('DECISIONES TOMADAS') || get('DECISIONES');
  const actionsRaw   = get('ITEMS DE ACCION') || get('ÍTEMS DE ACCIÓN') || get('ACCIONES');
  const risksRaw     = get('RIESGOS Y CONSIDERACIONES') || get('RIESGOS');
  const pendingRaw   = get('PENDIENTES Y PUNTOS ABIERTOS') || get('PENDIENTES');
  const scope        = get('ALCANCE DEL PROYECTO') || get('ALCANCE');
  const economic     = get('PROPUESTA ECONOMICA') || get('PROPUESTA ECONÓMICA') || get('PROPUESTA');

  let fullSummary = summary || text.substring(0, 600);
  if (participants) fullSummary += `\n\n**Participantes:** ${participants}`;
  if (scope)        fullSummary += `\n\n**Alcance:** ${scope}`;
  if (economic)     fullSummary += `\n\n**Propuesta económica:** ${economic}`;

  const risks   = toList(risksRaw);
  const pending = toList(pendingRaw);

  return {
    transcription: fallbackTranscription,
    summary: fullSummary,
    decisions: toList(decisionsRaw),
    actionItems: [
      ...toList(actionsRaw),
      ...pending.map(p => `⏳ Pendiente: ${p}`),
      ...risks.map(r => `⚠️ Riesgo: ${r}`),
    ],
  };
}

async function processWithLocal(body: any, model: string, jobId?: string) {
  const { type, fileData, mimeType, text } = body;
  const emit = (data: object) => emitProgress(jobId || '', data);

  let transcription = '';

  if (type === 'multimodal') {
    emit({ stage: 'transcribing', message: 'Transcribiendo audio con Whisper...', percent: 5 });
    transcription = await transcribeWithWhisper(fileData, mimeType);
  } else {
    transcription = text || '';
  }


  const CHUNK_SIZE = 4000;
  const chunks: string[] = [];
  for (let i = 0; i < transcription.length; i += CHUNK_SIZE) {
    chunks.push(transcription.substring(i, i + CHUNK_SIZE));
  }

  console.log(`[Local] ${chunks.length} fragmentos...`);
  emit({ stage: 'analyzing', message: `Extrayendo puntos clave de ${chunks.length} fragmentos...`, percent: 10, total: chunks.length, current: 0 });

  const chunkResults: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const percent = Math.round(10 + ((i + 1) / chunks.length) * 60);
    emit({ stage: 'analyzing', message: `Fragmento ${i + 1} de ${chunks.length}...`, percent, current: i + 1, total: chunks.length });
    emit({ stage: 'streaming', token: `\n▸ Fragmento ${i + 1} de ${chunks.length}\n` });
    const result = await chatWithLocalStreaming(
      `Analizá el siguiente fragmento y extraé SOLO lo que está presente. Sin inventar nada. Bullet points breves.

Primero identificá qué tipo de contenido es (reunión, nota personal, prueba, instrucción, etc.) y luego extraé lo relevante según ese tipo:

- TIPO: (reunión / nota personal / prueba / instrucción / otro)
- INTENCIÓN: qué se quiso hacer o comunicar
- TEMAS: qué se discutió o mencionó
- ACCIONES: tareas o compromisos (si los hay) — formato: "- [ ] acción — responsable — plazo"
- DECISIONES: acuerdos concretos (si los hay)
- PENDIENTES: cosas sin resolver (si las hay)
- RIESGOS: problemas o preocupaciones (si los hay)
- PARTICIPANTES: nombres o roles (si se mencionan)

Fragmento:
${chunks[i]}

Extracción:`,
      (token) => emit({ stage: 'streaming', token })
    );
    chunkResults.push(result);
    emit({ stage: 'streaming', token: '\n' });
  }

  emit({ stage: 'synthesizing', message: 'Generando minuta final...', percent: 75 });
  emit({ stage: 'streaming', token: '\n━━━━━━━━━━━━━━━━━━━━━━\n✦ MINUTA FINAL\n━━━━━━━━━━━━━━━━━━━━━━\n\n' });
  console.log('[Local] Síntesis streaming...');

  const combinedPoints = chunkResults.join('\n\n').substring(0, 12000);
  const wordCount = transcription.trim().split(/\s+/).length;
  const isShort = wordCount < 80;

  const synthesisPrompt = isShort
    ? `Eres un asistente de notas. Tu tarea es resumir lo que dijo el usuario en el siguiente audio transcripto.

TRANSCRIPCIÓN:
"${transcription.trim()}"

Escribí un resumen breve en español (2-4 oraciones) de lo que se dijo. Solo describí el contenido real de la transcripción. No saludes ni ofrezcas ayuda.

Resumen:`
    : `Eres un asistente de notas de reuniones. Tu tarea es generar una minuta en español basada en la siguiente transcripción.

TRANSCRIPCIÓN COMPLETA:
${transcription.substring(0, 6000)}

ANÁLISIS PREVIO:
${combinedPoints}

Generá una minuta estructurada con las siguientes secciones (solo incluí las que tengan información real):
## RESUMEN EJECUTIVO
## TEMAS TRATADOS
## DECISIONES TOMADAS
## ITEMS DE ACCION
## PENDIENTES

Reglas:
- Solo incluí información que esté en la transcripción.
- No inventes participantes, decisiones ni datos.
- Sé conciso y claro.

Minuta:`;

  let streamedText = '';
  await chatWithLocalStreaming(synthesisPrompt, (token) => {
    streamedText += token;
    emit({ stage: 'streaming', token });
  });

  // Generate a smart title from the synthesis
  emit({ stage: 'synthesizing', message: 'Generando título...', percent: 95 });
  const titlePrompt = `Generá UN título corto y descriptivo en español para esta transcripción (máximo 6 palabras, sin comillas, sin puntuación al final). Solo el título, nada más.

Transcripción:
${transcription.substring(0, 400)}

Título:`;
  let generatedTitle = '';
  try {
    generatedTitle = (await chatWithLocal(titlePrompt)).trim().replace(/^["'`]|["'`]$/g, '').trim();
  } catch { /* fallback to default */ }

  emit({ stage: 'synthesizing', message: 'Minuta lista, preparando nota...', percent: 98 });
  const parsed = parseSectioned(streamedText, transcription);
  return { ...parsed, extendedMinutes: streamedText, generatedTitle: generatedTitle || undefined };
}

async function chatWithLocalDoc(message: string, transcript: string, history: any[]): Promise<string> {
  const historyText = history.slice(-6).map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n');
  const prompt = `Eres un asistente de documentos. Contexto del documento:
---
${transcript || 'Sin documento activo.'}
---
${historyText ? `Conversación previa:\n${historyText}\n` : ''}Usuario: ${message}
Asistente:`;
  return chatWithLocal(prompt);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PROVIDERS = new Set(['gemini', 'openai', 'anthropic', 'local']);
const VALID_PROCESS_TYPES = new Set(['multimodal', 'pdf', 'youtube', 'text']);
const VALID_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg',
  'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/webm',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
  'application/pdf',
]);

function sanitizeError(error: any): string {
  // En producción no exponer detalles internos ni stack traces
  if (!IS_PROD) return error?.message || 'Error interno del servidor.';

  // Mensajes de validación propios siempre son seguros de mostrar
  const safePatterns = [
    'no soporta', 'falta', 'falta la url', 'no se proveyó',
    'tipo no soportado', 'demasiado grande', 'formato no válido',
    'api key', 'no configurada',
  ];
  const msg: string = error?.message || '';
  if (safePatterns.some((p) => msg.toLowerCase().includes(p))) return msg;

  return 'Error interno del servidor. Revisá los logs para más detalles.';
}

function validateFilePayload(fileData: string, mimeType: string): void {
  if (!VALID_MIME_TYPES.has(mimeType)) {
    throw new Error(`Formato no válido: ${mimeType}. Usá PDF, MP3, WAV, MP4 o M4A.`);
  }

  // Base64 tiene ~33% de overhead, así que el tamaño real ≈ base64.length * 0.75
  const estimatedBytes = Math.floor(fileData.length * 0.75);
  const maxBytes = (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024;
  if (estimatedBytes > maxBytes) {
    const mb = (estimatedBytes / (1024 * 1024)).toFixed(1);
    throw new Error(`El archivo (${mb}MB) supera el límite permitido de ${process.env.MAX_UPLOAD_MB || 25}MB.`);
  }
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.get('/api/auth/me', (req, res) => {
  if (!isGoogleAuthConfigured()) return res.json({ user: null, authRequired: false, needsRegistration: false });
  if (!req.isAuthenticated()) return res.json({ user: null, authRequired: true, needsRegistration: false });

  const user = req.user as any;
  const allowed = isEmailAllowed(user.email);
  const registered = !!readUserData(user.email);
  const needsRegistration = !allowed && !registered;

  res.json({ user, authRequired: true, needsRegistration });
});

app.get('/auth/google', (req, res, next) => {
  if (!isGoogleAuthConfigured()) return res.redirect('/?error=auth_not_configured');
  passport.use(getGoogleStrategy());
  passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'], accessType: 'offline' })(req, res, next);
});

app.get('/auth/google/callback',
  (req, res, next) => {
    passport.use(getGoogleStrategy());
    passport.authenticate('google', { failureRedirect: '/?error=unauthorized' })(req, res, next);
  },
  (_req, res) => res.redirect('/')
);

app.post('/auth/logout', (req, res) => {
  req.logout(() => res.json({ ok: true }));
});

// Registro de usuario con sus propias keys
app.post('/api/auth/register', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'No autenticado.' });

  const user = req.user as any;
  const { GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY } = req.body;

  if (!GEMINI_API_KEY && !OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'Configurá al menos una API key.' });
  }

  try {
    writeUserData({
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      registeredAt: new Date().toISOString(),
      keys: { GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'No se pudo guardar el registro.' });
  }
});

// Devuelve qué está configurado (nunca los valores)
app.get('/api/config', (_req, res) => {
  res.json({
    gemini:    !!getKey('GEMINI_API_KEY'),
    openai:    !!getKey('OPENAI_API_KEY'),
    anthropic: !!getKey('ANTHROPIC_API_KEY'),
    googleAuth: isGoogleAuthConfigured(),
    allowedEmails: getAllowedEmails(),
    appUrl: getKey('APP_URL') || '',
    ollamaNumGpu: getKey('OLLAMA_NUM_GPU') ?? '1',
  });
});

// Guarda la configuración
app.post('/api/config', (req, res) => {
  try {
    const {
      GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY,
      GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, ALLOWED_EMAILS,
      OLLAMA_NUM_GPU,
    } = req.body;

    const hasAiKey = GEMINI_API_KEY || OPENAI_API_KEY || ANTHROPIC_API_KEY || !!getKey('GEMINI_API_KEY') || !!getKey('OPENAI_API_KEY') || !!getKey('ANTHROPIC_API_KEY');
    if (!hasAiKey) {
      return res.status(400).json({ error: 'Configurá al menos una API key de IA.' });
    }

    writeKeysConfig({ GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, ALLOWED_EMAILS, OLLAMA_NUM_GPU });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'No se pudo guardar la configuración.' });
  }
});

app.get('/api/progress/:jobId', requireAuth, (req, res) => {
  const { jobId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  progressClients.set(jobId, res);

  // Heartbeat every 15s to keep tunnel/proxy from closing idle SSE connections
  const heartbeat = setInterval(() => {
    if (progressClients.has(jobId)) res.write(': heartbeat\n\n');
    else clearInterval(heartbeat);
  }, 15000);

  req.on('close', () => {
    progressClients.delete(jobId);
    clearInterval(heartbeat);
  });
});

// Fallback: client polls this when SSE drops before receiving done
app.get('/api/result/:jobId', requireAuth, (req, res) => {
  const result = jobResults.get(req.params.jobId);
  if (result) {
    jobResults.delete(req.params.jobId);
    return res.json(result);
  }
  res.json({ stage: 'pending' });
});

app.post('/api/transcribe-chunk', requireAuth, async (req, res) => {
  const { fileData, mimeType } = req.body;
  if (!fileData) return res.status(400).json({ error: 'fileData requerido' });
  try {
    const text = await transcribeWithWhisper(fileData, mimeType || 'audio/webm');
    res.json({ text });
  } catch (e: any) {
    console.error('[transcribe-chunk]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/process', requireAuth, async (req, res) => {
  const { provider = 'gemini', model, type, fileData, mimeType, jobId, fileName, noteType, duration: reqDuration, ...rest } = req.body;

  if (!VALID_PROVIDERS.has(provider)) {
    return res.status(400).json({ error: 'Proveedor no válido.' });
  }
  if (!VALID_PROCESS_TYPES.has(type)) {
    return res.status(400).json({ error: 'Tipo de procesamiento no válido.' });
  }
  if (fileData && mimeType) {
    try { validateFilePayload(fileData, mimeType); } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  // Respond immediately — result will arrive via SSE to avoid tunnel timeout
  res.json({ status: 'processing', jobId });

  const defaultModels: Record<string, string> = {
    gemini: 'gemini-2.0-flash', openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-6', local: 'llama3.2:3b',
  };
  const resolvedModel = model || defaultModels[provider] || defaultModels.gemini;
  const payload = { type, fileData, mimeType, ...rest };
  const uk = getUserKeys(req);
  const userKey = provider === 'openai' ? uk.OPENAI : provider === 'anthropic' ? uk.ANTHROPIC : uk.GEMINI;

  setImmediate(async () => {
    // Wait up to 3s for the SSE client to connect before we start emitting
    if (jobId) {
      const deadline = Date.now() + 3000;
      while (!progressClients.has(jobId) && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
    try {
      let result: any;
      if (provider === 'local') {
        result = await processWithLocal(payload, resolvedModel, jobId);
      } else if (provider === 'openai') {
        result = await processWithOpenAI(payload, resolvedModel, userKey);
      } else if (provider === 'anthropic') {
        result = await processWithAnthropic(payload, resolvedModel, userKey);
      } else {
        result = await processWithGemini(payload, resolvedModel, userKey);
      }
      emitProgress(jobId, {
        stage: 'done', percent: 100, message: 'Completado',
        result: { ...result, fileName, noteType, duration: reqDuration },
      });
    } catch (error: any) {
      console.error('Error en /api/process:', error);
      emitProgress(jobId, { stage: 'error', message: sanitizeError(error) });
    }
  });
});

// ─── Hardware detection ───────────────────────────────────────────────────────
type GpuProfile = 'cpu' | 'npu' | '1650' | '3080';

interface HardwareInfo {
  gpuName:      string | null;
  vramMb:       number | null;
  cpuName:      string | null;
  ramMb:        number | null;
  profile:      GpuProfile;
  detectedBy:   string[];
  envOverrides?: Record<string, string>;
}

function execCmd(cmd: string): Promise<string> {
  return new Promise(resolve => {
    const { exec } = require('child_process');
    exec(cmd, { timeout: 5000 }, (_err: any, stdout: string) => resolve(stdout?.trim() ?? ''));
  });
}

function readFileSafe(p: string): string {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

async function detectHardware(): Promise<HardwareInfo> {
  const info: HardwareInfo = { gpuName: null, vramMb: null, cpuName: null, ramMb: null, profile: 'cpu', detectedBy: [] };

  // ── 1. config/hardware.json written by detect-hardware.bat (highest priority) ──
  const hwJsonPath = path.resolve(process.cwd(), 'config', 'hardware.json');
  if (fs.existsSync(hwJsonPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(hwJsonPath, 'utf8'));
      if (saved.cpuName) { info.cpuName = saved.cpuName; info.detectedBy.push('hardware.json'); }
      if (saved.gpuName) { info.gpuName = saved.gpuName; info.detectedBy.push('hardware.json'); }
      if (saved.vramMb)  { info.vramMb  = Number(saved.vramMb); }
      if (saved.ramMb)   { info.ramMb   = Number(saved.ramMb);  }
      if (saved.profile) { info.profile = saved.profile; return info; } // fast path — skip other detection
    } catch { /* corrupt file, continue */ }
  }

  // ── 2. .env overrides (manual fallback) ──
  if (process.env.HOST_GPU)     { info.gpuName = process.env.HOST_GPU; info.detectedBy.push('env:HOST_GPU'); }
  if (process.env.HOST_VRAM_GB) { info.vramMb  = Math.round(parseFloat(process.env.HOST_VRAM_GB) * 1024); info.detectedBy.push('env:HOST_VRAM_GB'); }
  if (process.env.HOST_CPU)     { info.cpuName  = process.env.HOST_CPU; info.detectedBy.push('env:HOST_CPU'); }
  if (process.env.HOST_RAM_GB)  { info.ramMb    = Math.round(parseFloat(process.env.HOST_RAM_GB)  * 1024); info.detectedBy.push('env:HOST_RAM_GB'); }

  // ── GPU via nvidia-smi (NVIDIA) ──
  const smiOut = await execCmd('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits');
  if (smiOut && !smiOut.toLowerCase().includes('error') && !smiOut.toLowerCase().includes('not found')) {
    const parts = smiOut.split('\n')[0].split(',').map(s => s.trim());
    if (parts[0]) {
      info.gpuName = parts[0];
      info.vramMb  = parts[1] ? parseInt(parts[1], 10) : null;
      info.detectedBy.push('nvidia-smi');
    }
  }

  // ── GPU fallback via lspci (AMD / Intel / any) ──
  if (!info.gpuName) {
    const lspci = await execCmd('lspci 2>/dev/null | grep -iE "VGA|3D|Display"');
    if (lspci) {
      // Extract GPU name from lspci output e.g. "01:00.0 VGA compatible controller: NVIDIA GeForce RTX 3080 (rev a1)"
      const gpuLine = lspci.split('\n')[0];
      const match = gpuLine.match(/:\s*(.+?)(?:\s*\(rev\s*[0-9a-f]+\))?$/i);
      if (match) {
        info.gpuName = match[1].trim();
        info.detectedBy.push('lspci');

        // Estimate VRAM from known GPU names (lspci doesn't report VRAM)
        const g = info.gpuName.toLowerCase();
        if      (g.includes('rx 7900') || g.includes('rx 6900') || g.includes('rtx 4090') || g.includes('rtx 3090')) info.vramMb = 16000;
        else if (g.includes('rx 7800') || g.includes('rx 6800') || g.includes('rtx 4080') || g.includes('rtx 3080')) info.vramMb = 10000;
        else if (g.includes('rx 7700') || g.includes('rx 6700') || g.includes('rtx 4070') || g.includes('rtx 3070')) info.vramMb = 8000;
        else if (g.includes('rx 7600') || g.includes('rx 6600') || g.includes('rtx 3060') || g.includes('rtx 4060')) info.vramMb = 8000;
        else if (g.includes('rx 580')  || g.includes('rx 570')  || g.includes('rtx 2060') || g.includes('gtx 1660')) info.vramMb = 6000;
        else if (g.includes('gtx 1650') || g.includes('rx 560') || g.includes('rtx 2050'))                           info.vramMb = 4000;
        else if (g.includes('gtx 1050') || g.includes('rx 550') || g.includes('arc a380'))                           info.vramMb = 2000;
        else if (g.includes('intel') || g.includes('uhd') || g.includes('iris'))                                     info.vramMb = 1000; // shared
      }
    }
  }

  // ── CPU via /proc/cpuinfo ──
  const cpuinfo = readFileSafe('/proc/cpuinfo');
  const cpuMatch = cpuinfo.match(/^model name\s*:\s*(.+)$/m);
  if (cpuMatch) {
    info.cpuName = cpuMatch[1].trim();
    info.detectedBy.push('/proc/cpuinfo');
  }
  if (!info.cpuName) {
    const lscpu = await execCmd('lscpu');
    const m = lscpu.match(/^Model name[^:]*:\s*(.+)$/mi);
    if (m) { info.cpuName = m[1].trim(); info.detectedBy.push('lscpu'); }
  }

  // ── RAM via /proc/meminfo ──
  const meminfo = readFileSafe('/proc/meminfo');
  const memMatch = meminfo.match(/^MemTotal:\s+(\d+)\s+kB/m);
  if (memMatch) {
    info.ramMb = Math.round(parseInt(memMatch[1], 10) / 1024);
    info.detectedBy.push('/proc/meminfo');
  }

  // ── Map to GpuProfile ──
  if (info.vramMb && info.vramMb >= 6500) {
    info.profile = '3080';
  } else if (info.vramMb && info.vramMb >= 3500) {
    info.profile = '1650';
  } else {
    const cpu = (info.cpuName ?? '').toLowerCase();
    const hasNpu =
      cpu.includes('ryzen ai') ||
      /ryzen [579] [789]\d{3}/.test(cpu) ||
      cpu.includes('core ultra');
    info.profile = hasNpu ? 'npu' : 'cpu';
  }

  return info;
}

app.get('/api/hardware', requireAuth, async (_req, res) => {
  try {
    // Try to call the Windows hardware agent first
    let agentAvailable = false;
    try {
      const ping = await fetch(`${HW_AGENT_URL}/ping`, { signal: AbortSignal.timeout(1000) });
      agentAvailable = ping.ok;
    } catch { /* agent not running */ }

    if (agentAvailable) {
      // Detect hardware
      const agentRes = await fetch(`${HW_AGENT_URL}/detect`, { signal: AbortSignal.timeout(8000) });
      if (agentRes.ok) {
        const hw = await agentRes.json() as HardwareInfo;
        hw.detectedBy = hw.detectedBy ?? [];
        (hw as any).hasHwJson    = true;
        (hw as any).agentRunning = true;
        // Register in Windows startup (fire-and-forget, don't block response)
        fetch(`${HW_AGENT_URL}/register-startup`, { signal: AbortSignal.timeout(3000) }).catch(() => {});
        return res.json(hw);
      }
    }

    // Fallback: read saved hardware.json or env vars
    const hw = await detectHardware();
    const hwJsonPath = path.resolve(process.cwd(), 'config', 'hardware.json');
    hw.envOverrides = {
      HOST_CPU:     process.env.HOST_CPU     || '',
      HOST_GPU:     process.env.HOST_GPU     || '',
      HOST_VRAM_GB: process.env.HOST_VRAM_GB || '',
      HOST_RAM_GB:  process.env.HOST_RAM_GB  || '',
    };
    (hw as any).hasHwJson    = fs.existsSync(hwJsonPath);
    (hw as any).agentRunning = false;
    res.json(hw);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Save host hardware overrides to .env
app.post('/api/hardware/override', requireAuth, async (req, res) => {
  const { HOST_CPU, HOST_GPU, HOST_VRAM_GB, HOST_RAM_GB } = req.body as Record<string, string>;
  const envPath = path.resolve(process.cwd(), '.env');
  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const set = (key: string, val: string) => {
      const line = `${key}=${val}`;
      if (new RegExp(`^${key}=`, 'm').test(content)) content = content.replace(new RegExp(`^${key}=.*`, 'm'), line);
      else content += `\n${line}`;
    };
    set('HOST_CPU',     HOST_CPU     ?? '');
    set('HOST_GPU',     HOST_GPU     ?? '');
    set('HOST_VRAM_GB', HOST_VRAM_GB ?? '');
    set('HOST_RAM_GB',  HOST_RAM_GB  ?? '');
    fs.writeFileSync(envPath, content, 'utf8');
    // Apply immediately
    if (HOST_CPU)     process.env.HOST_CPU     = HOST_CPU;
    if (HOST_GPU)     process.env.HOST_GPU     = HOST_GPU;
    if (HOST_VRAM_GB) process.env.HOST_VRAM_GB = HOST_VRAM_GB;
    if (HOST_RAM_GB)  process.env.HOST_RAM_GB  = HOST_RAM_GB;
    const hw = await detectHardware();
    res.json({ ok: true, hw });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Is llama.cpp up and serving a model? (used after activation to know when ready)
app.get('/api/llamacpp/ready', requireAuth, async (req, res) => {
  try {
    const r = await fetch(`${LLAMACPP_URL}/v1/models`, { signal: AbortSignal.timeout(3000) });
    res.json({ ready: r.ok });
  } catch {
    res.json({ ready: false });
  }
});

// Currently loaded llama.cpp model
app.get('/api/llamacpp/model', requireAuth, async (req, res) => {
  // Prefer the persisted active model name (set via /set-model)
  const activeFile = path.join(process.cwd(), 'config', 'active-llm.txt');
  try {
    if (fs.existsSync(activeFile)) {
      const name = fs.readFileSync(activeFile, 'utf8').trim();
      if (name) return res.json({ model: name });
    }
  } catch {}
  const name = await getLoadedLlamaCppModel();
  res.json({ model: name });
});

// Whisper model currently configured (from env, not discoverable via API)
app.get('/api/whisper/model', requireAuth, async (req, res) => {
  const model = process.env.ASR_MODEL || 'small';
  try {
    const check = await fetch(`${WHISPER_URL}/docs`, { signal: AbortSignal.timeout(3000) });
    res.json({ model, available: check.ok });
  } catch {
    res.json({ model, available: false });
  }
});

// ─── LLM model download (streams GGUF from HuggingFace → /models volume) ──────

const downloadProgressClients = new Map<string, import('http').ServerResponse>();
const activeDownloads = new Set<string>(); // prevent concurrent downloads of same file

// Clean up any leftover .tmp files from a previous run
try {
  const modelsDir = '/models';
  if (fs.existsSync(modelsDir)) {
    fs.readdirSync(modelsDir)
      .filter(f => f.endsWith('.tmp'))
      .forEach(f => { try { fs.unlinkSync(path.join(modelsDir, f)); } catch {} });
  }
} catch {}

app.get('/api/llamacpp/download-progress/:filename', requireAuth, (req, res) => {
  const { filename } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  downloadProgressClients.set(filename, res);

  // keepalive ping every 15s so the connection doesn't time out
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 15000);

  req.on('close', () => {
    clearInterval(ping);
    downloadProgressClients.delete(filename);
  });
});

function sendDownloadProgress(filename: string, data: object) {
  const client = downloadProgressClients.get(filename);
  if (client) {
    try { client.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
  }
}

app.post('/api/llamacpp/download', requireAuth, async (req, res) => {
  const { url, filename } = req.body as { url: string; filename: string };
  if (!url || !filename) return res.status(400).json({ error: 'url y filename requeridos' });
  if (!filename.endsWith('.gguf')) return res.status(400).json({ error: 'Solo archivos .gguf' });

  const destPath = path.join('/models', filename);

  if (fs.existsSync(destPath)) {
    return res.json({ ok: true, skipped: true, message: 'Ya existe en /models' });
  }

  if (activeDownloads.has(filename)) {
    return res.json({ ok: true, already: true, message: 'Descarga ya en progreso' });
  }

  res.json({ ok: true, started: true });

  activeDownloads.add(filename);

  // Download in background, push progress via SSE (throttled to 1 event/sec)
  (async () => {
    const tmpPath = destPath + '.tmp';
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3600000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const total = parseInt(response.headers.get('content-length') ?? '0', 10);
      let received = 0;
      let lastPct = -1;
      let lastEmit = 0;
      const writer = fs.createWriteStream(tmpPath);

      const reader = response.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write(value);
        received += value.length;
        if (total > 0) {
          const pct = Math.round((received / total) * 100);
          const now = Date.now();
          // throttle: emit at most once per second or on percent change
          if (pct !== lastPct && now - lastEmit > 1000) {
            lastPct = pct;
            lastEmit = now;
            sendDownloadProgress(filename, { type: 'progress', received, total, percent: pct });
          }
        }
      }
      await new Promise<void>((resolve, reject) => writer.end(err => err ? reject(err) : resolve()));
      fs.renameSync(tmpPath, destPath);
      sendDownloadProgress(filename, { type: 'done', filename });
    } catch (e) {
      if (fs.existsSync(tmpPath)) { try { fs.unlinkSync(tmpPath); } catch {} }
      sendDownloadProgress(filename, { type: 'error', message: String(e) });
    } finally {
      activeDownloads.delete(filename);
    }
  })();
});

// Check if a model file exists in /models
app.get('/api/llamacpp/exists/:filename', requireAuth, (req, res) => {
  const filePath = path.join('/models', req.params.filename);
  const exists = fs.existsSync(filePath);
  const sizeBytes = exists ? fs.statSync(filePath).size : 0;
  res.json({ exists, sizeBytes });
});

// Restart a container via the Docker Engine API over the mounted unix socket
function restartContainer(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const http = require('http') as typeof import('http');
    const req = http.request(
      {
        socketPath: '/var/run/docker.sock',
        path: `/v1.43/containers/${encodeURIComponent(name)}/restart?t=5`,
        method: 'POST',
      },
      (r) => {
        // 204 = restarted OK, 304 = already in desired state
        r.resume();
        if (r.statusCode === 204 || r.statusCode === 304) resolve();
        else reject(new Error(`Docker API status ${r.statusCode}`));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

const ACTIVE_LLM_FILE = path.join(process.cwd(), 'config', 'active-llm.txt');

// Activate a downloaded GGUF: point active.gguf symlink at it + restart llamacpp
app.post('/api/llamacpp/set-model', requireAuth, async (req, res) => {
  const { filename } = req.body as { filename: string };
  if (!filename || !filename.endsWith('.gguf')) {
    return res.status(400).json({ error: 'filename .gguf requerido' });
  }
  const target = path.join('/models', filename);
  if (!fs.existsSync(target)) {
    return res.status(404).json({ error: 'El modelo no está descargado' });
  }

  const link = '/models/active.gguf';
  try {
    if (fs.existsSync(link) || fs.lstatSync(link, { throwIfNoEntry: false } as any)) {
      try { fs.unlinkSync(link); } catch {}
    }
    fs.symlinkSync(target, link);
    // Persist active model name so the UI can display it
    try { fs.writeFileSync(ACTIVE_LLM_FILE, filename, 'utf8'); } catch {}
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo cambiar el modelo activo', detail: String(e) });
  }

  // Restart llamacpp so it loads the new model
  try {
    await restartContainer('wizzi-note-llamacpp-1');
    res.json({ ok: true, model: filename, restarted: true });
  } catch (e) {
    res.json({ ok: true, model: filename, restarted: false, hint: 'docker restart wizzi-note-llamacpp-1', detail: String(e) });
  }
});

// Change Whisper model: update .env + restart whisper container
app.post('/api/whisper/set-model', requireAuth, async (req, res) => {
  const { model } = req.body as { model: string };
  const VALID = ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'];
  if (!VALID.includes(model)) return res.status(400).json({ error: 'Modelo inválido' });

  // Update .env file
  const envPath = path.resolve(process.cwd(), '.env');
  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (/^ASR_MODEL=/m.test(content)) {
      content = content.replace(/^ASR_MODEL=.*/m, `ASR_MODEL=${model}`);
    } else {
      content += `\nASR_MODEL=${model}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    process.env.ASR_MODEL = model;
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo actualizar .env', detail: String(e) });
  }

  // Try to restart whisper container via docker CLI (requires docker socket or docker in PATH)
  const { exec } = await import('child_process');
  exec('docker compose restart whisper', { cwd: process.cwd() }, (err) => {
    if (err) {
      // Docker not available from inside container — return success anyway, user restarts manually
      return res.json({ ok: true, model, restarted: false, hint: 'docker compose restart whisper' });
    }
    res.json({ ok: true, model, restarted: true });
  });
});

// Priority: Gemini > OpenAI > Anthropic > llama.cpp local
app.get('/api/best-model', requireAuth, async (req, res) => {
  try {
    const keys = getUserKeys(req);
    if (keys.GEMINI)    return res.json({ provider: 'gemini',    model: 'gemini-2.0-flash' });
    if (keys.OPENAI)    return res.json({ provider: 'openai',    model: 'gpt-4o' });
    if (keys.ANTHROPIC) return res.json({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    const model = await getLoadedLlamaCppModel();
    return res.json({ provider: 'local', model });
  } catch {
    res.status(500).json({ error: 'Error detectando mejor modelo.' });
  }
});

app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, transcript, history, provider = 'gemini', model } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Falta el mensaje.' });
    }
    if (!VALID_PROVIDERS.has(provider)) {
      return res.status(400).json({ error: 'Proveedor no válido.' });
    }

    const defaultModels: Record<string, string> = {
      gemini: 'gemini-2.0-flash',
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-6',
    };
    const resolvedModel = model || defaultModels[provider] || defaultModels.gemini;

    const uk = getUserKeys(req);
    const userKey = provider === 'openai' ? uk.OPENAI : provider === 'anthropic' ? uk.ANTHROPIC : uk.GEMINI;

    let text: string | null | undefined;
    if (provider === 'local') {
      text = await chatWithLocalDoc(message, transcript, history);
    } else if (provider === 'openai') {
      text = await chatWithOpenAI(message, transcript, history, resolvedModel, userKey);
    } else if (provider === 'anthropic') {
      text = await chatWithAnthropic(message, transcript, history, resolvedModel, userKey);
    } else {
      text = await chatWithGemini(message, transcript, history, resolvedModel, userKey);
    }

    return res.json({ text });
  } catch (error: any) {
    console.error('Error en /api/chat:', error);
    return res.status(500).json({ error: sanitizeError(error) });
  }
});

// ─── Google Drive endpoints ───────────────────────────────────────────────────

const DRIVE_FILE_NAME = 'wizzi-notes-backup.json';
const DRIVE_APPDATA_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

async function driveRequest(accessToken: string, method: string, url: string, body?: any, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(url + qs, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res;
}

async function findDriveFile(accessToken: string): Promise<string | null> {
  const res = await driveRequest(accessToken, 'GET', `${DRIVE_APPDATA_URL}/files`, undefined, {
    spaces: 'appDataFolder',
    q: `name='${DRIVE_FILE_NAME}'`,
    fields: 'files(id)',
  });
  const data = await res.json() as { files: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

// GET /api/drive/load — carga notas desde Drive
app.get('/api/drive/load', requireAuth, async (req, res) => {
  const user = req.user as any;
  if (!user?.accessToken) return res.status(403).json({ error: 'Sin access token de Google.' });
  try {
    const fileId = await findDriveFile(user.accessToken);
    if (!fileId) return res.json({ notes: null, fileId: null });
    const fileRes = await driveRequest(user.accessToken, 'GET', `${DRIVE_APPDATA_URL}/files/${fileId}`, undefined, { alt: 'media' });
    const data = await fileRes.json();
    res.json({ notes: data.notes ?? data, fileId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/drive/save — guarda/sobreescribe notas en Drive
app.post('/api/drive/save', requireAuth, async (req, res) => {
  const user = req.user as any;
  if (!user?.accessToken) return res.status(403).json({ error: 'Sin access token de Google.' });
  const { notes } = req.body;
  if (!Array.isArray(notes)) return res.status(400).json({ error: 'Payload inválido.' });
  try {
    const existingId = await findDriveFile(user.accessToken);
    const content = JSON.stringify({ notes, savedAt: new Date().toISOString() });

    if (existingId) {
      // Actualizar archivo existente (multipart PATCH)
      const boundary = '-------wizzi_boundary';
      const multipart = [
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: DRIVE_FILE_NAME })}`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}`,
        `--${boundary}--`,
      ].join('\r\n');
      const patchRes = await fetch(`${DRIVE_UPLOAD_URL}/files/${existingId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      });
      if (!patchRes.ok) throw new Error(`Drive PATCH ${patchRes.status}`);
      const updated = await patchRes.json() as { id: string };
      return res.json({ ok: true, fileId: updated.id });
    } else {
      // Crear archivo nuevo en appDataFolder
      const boundary = '-------wizzi_boundary';
      const multipart = [
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] })}`,
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}`,
        `--${boundary}--`,
      ].join('\r\n');
      const createRes = await fetch(`${DRIVE_UPLOAD_URL}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      });
      if (!createRes.ok) throw new Error(`Drive POST ${createRes.status}`);
      const created = await createRes.json() as { id: string };
      return res.json({ ok: true, fileId: created.id });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Vite / Static ────────────────────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Wizzi Note corriendo en: http://localhost:${PORT}`);
  });
}

startServer();
