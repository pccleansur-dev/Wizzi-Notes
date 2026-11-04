export type AsrProvider = 'whisper' | 'nemotron';

export interface AsrRuntimeConfig {
  defaultProvider: AsrProvider;
  language: string;
  whisperUrl: string;
  nemotronUrl: string;
}

export interface AudioTranscriptionInput {
  fileData: string;
  mimeType: string;
  provider?: AsrProvider;
}

export function resolveAsrProvider(value: unknown): AsrProvider {
  return value === 'nemotron' ? 'nemotron' : 'whisper';
}

function baseLanguage(locale: string): string {
  return locale.split('-')[0] || 'es';
}

function audioExtension(mimeType: string): string {
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return 'wav';
  return mimeType.split('/')[1]?.replace('x-', '').split(';')[0] || 'webm';
}

export async function transcribeAudio(
  input: AudioTranscriptionInput,
  config: AsrRuntimeConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const provider = resolveAsrProvider(input.provider ?? config.defaultProvider);
  const buffer = Buffer.from(input.fileData, 'base64');
  const blob = new Blob([buffer], { type: input.mimeType });
  const form = new FormData();

  let response: Response;
  if (provider === 'nemotron') {
    form.append('file', blob, `audio.${audioExtension(input.mimeType)}`);
    form.append('language', config.language);
    form.append('response_format', 'json');
    response = await fetchImpl(`${config.nemotronUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: form,
    });
  } else {
    form.append('audio_file', blob, `audio.${audioExtension(input.mimeType)}`);
    const params = new URLSearchParams({
      output: 'json',
      language: baseLanguage(config.language),
      task: 'transcribe',
      word_timestamps: 'false',
    });
    response = await fetchImpl(`${config.whisperUrl}/asr?${params}`, {
      method: 'POST',
      body: form,
    });
  }

  if (!response.ok) {
    const label = provider === 'nemotron' ? 'Nemotron' : 'Whisper';
    throw new Error(`${label} error: ${response.status}`);
  }

  const data = await response.json() as { text?: string };
  return (data.text || '').replace(/<\|[^|]+\|>/g, '').trim();
}
