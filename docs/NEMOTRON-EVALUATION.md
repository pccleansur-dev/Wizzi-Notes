# Evaluación de Nemotron 3.5 ASR

## Modelo evaluado

- `nvidia/nemotron-3.5-asr-streaming-0.6b`
- Runtime: NeMo-Speech.cpp 0.3.0, CUDA, GGUF Q8
- Hardware: NVIDIA GeForce RTX 3080 Ti, 12 GB VRAM
- Idioma configurado: `es-ES`

## Prueba inicial

Se utilizó un WAV sintético en español de 14,1 segundos con nombres, horarios y tareas.

| Motor | Tiempo inicial | Tiempo con modelo cargado | Observación |
| --- | ---: | ---: | --- |
| Nemotron 3.5 Q8 | 3,4 s | 0,87 s | Muy rápido; cometió errores en varias palabras de la voz sintética. |
| Whisper small | 5,0 s | No medido | También cometió errores importantes en la misma voz sintética. |

La voz SAPI de Windows no representa una reunión humana real. Estos números sirven para validar la integración y el rendimiento, no para decidir todavía qué motor tiene mejor precisión.

## Próxima prueba recomendada

Usar entre 5 y 10 fragmentos de reuniones reales en español, con transcripción de referencia, y medir:

- WER (tasa de error de palabras).
- Conservación de nombres, fechas, montos y tareas.
- Tiempo total y factor de tiempo real.
- VRAM máxima.
- Robustez con ruido, varios oradores y acento argentino.

Whisper permanece como motor predeterminado hasta completar esa evaluación.
