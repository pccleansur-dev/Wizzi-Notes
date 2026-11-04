import assert from 'node:assert/strict';
import test from 'node:test';

import { transcribeAudio, type AsrRuntimeConfig } from './asr';

const config: AsrRuntimeConfig = {
  defaultProvider: 'whisper',
  language: 'es-ES',
  whisperUrl: 'http://whisper:9000',
  nemotronUrl: 'http://nemotron:9010',
};

const audio = Buffer.from('wav-data').toString('base64');

test('uses Whisper by default and sends its expected multipart contract', async () => {
  let requestUrl = '';
  let form: FormData | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    form = init?.body as FormData;
    return new Response(JSON.stringify({ text: ' hola <|endoftext|> ' }), { status: 200 });
  };

  const text = await transcribeAudio(
    { fileData: audio, mimeType: 'audio/wav' },
    config,
    fetchImpl,
  );

  assert.equal(text, 'hola');
  assert.match(requestUrl, /^http:\/\/whisper:9000\/asr\?/);
  assert.equal(new URL(requestUrl).searchParams.get('language'), 'es');
  assert.ok(form?.get('audio_file') instanceof Blob);
  assert.equal(form?.get('file'), null);
});

test('uses Nemotron when requested and sends the OpenAI-compatible contract', async () => {
  let requestUrl = '';
  let form: FormData | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    form = init?.body as FormData;
    return new Response(JSON.stringify({ text: 'Reunión transcrita.' }), { status: 200 });
  };

  const text = await transcribeAudio(
    { fileData: audio, mimeType: 'audio/wav', provider: 'nemotron' },
    config,
    fetchImpl,
  );

  assert.equal(text, 'Reunión transcrita.');
  assert.equal(requestUrl, 'http://nemotron:9010/v1/audio/transcriptions');
  assert.ok(form?.get('file') instanceof Blob);
  assert.equal(form?.get('language'), 'es-ES');
  assert.equal(form?.get('response_format'), 'json');
  assert.equal(form?.get('audio_file'), null);
});

test('rejects an unavailable ASR provider with a useful error', async () => {
  const fetchImpl: typeof fetch = async () => new Response('offline', { status: 503 });

  await assert.rejects(
    transcribeAudio(
      { fileData: audio, mimeType: 'audio/wav', provider: 'nemotron' },
      config,
      fetchImpl,
    ),
    /Nemotron error: 503/,
  );
});
