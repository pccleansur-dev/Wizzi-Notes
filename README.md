# Wizzi Note 🚀

Wizzi Note es una suite de productividad inteligente y offline-first para transcribir audios, analizar documentos, gestionar notas estructuradas y chatear con tus archivos utilizando inteligencia artificial.

## Características principales

*   **🎙️ Transcripción inteligente**: Sube grabaciones de audio (`MP3`, `WAV`, `M4A`), videos (`MP4`, `MOV`) o documentos `PDF` (hasta 25MB) para procesarlos con IA.
*   **💾 Almacenamiento local ultrarrápido**: Integrado con `IndexedDB` para un almacenamiento offline optimizado y sin latencia.
*   **📃 Minutas y minería de decisiones**: Estructuración automática de planes, decisiones y tareas a partir de tus archivos.
*   **💬 Chat interactivo integrado**: Consulta dudas de cualquier reporte o minuta directamente con el asistente cognitivo.
*   **💻 Arquitectura Full-Stack**: Construido con un frontend interactivo en **React 19 + Vite + Tailwind CSS v4** y un servidor robusto en **Express**.

---

## Requisitos previos

Para correr este proyecto en tu computadora local, asegúrate de tener instalado:

*   **Node.js** (versión 18 o superior recomendada)
*   **npm** (incluido al instalar Node.js)

---

## Instrucciones de Instalación Local

Sigue estos sencillos pasos para iniciar Wizzi Note localmente:

### 1. Clonar o extraer el proyecto
Extrae el archivo `.zip` descargado en una carpeta de tu sistema local.

### 2. Instalar dependencias
Abre tu terminal favorita dentro de la carpeta del proyecto y ejecuta el siguiente comando:

```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo llamado `.env` en la raíz del proyecto (puedes tomar como referencia `.env.example`). Añade tu clave de API de Gemini:

```env
GEMINI_API_KEY="Tu_Clave_De_Gemini_Aqui"
APP_URL="http://localhost:3000"
```

> 💡 *Nota: Puedes obtener tu clave gratis de Gemini en [Google AI Studio](https://aistudio.google.com/).*

### 4. Lanzar el Servidor de Desarrollo
Para correr la aplicación en modo desarrollo (frontend en tiempo real y servidor Express activo), simplemente ejecuta:

```bash
npm run dev
```

La aplicación estará disponible de inmediato en tu navegador en:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## Comandos disponibles en `package.json`

A continuación, tienes los scripts listos para la producción o verificación:

*   `npm run dev`: Levanta el entorno de desarrollo híbrido (Express + Vite) en vivo por el puerto `3000`.
*   `npm run build`: Compila la SPA de React y empaqueta el servidor Express compilado optimizadamente usando `esbuild` en la carpeta `dist/`.
*   `npm run start`: Inicia el servidor optimizado de producción desde `dist/server.cjs`.
*   `npm run lint`: Ejecuta el validador estático de tipos de TypeScript.

## Probar Nemotron 3.5 como alternativa a Whisper

Wizzi Note permite elegir **Whisper** o **Nemotron 3.5 ASR** desde Configuración. Whisper sigue siendo el motor predeterminado.

Nemotron usa el runtime oficial [NeMo-Speech.cpp](https://github.com/NVIDIA/NeMo-Speech.cpp) y el modelo `nvidia/nemotron-3.5-asr-streaming-0.6b`.

1. Instalá NeMo-Speech.cpp con backend CUDA dentro de `tools/nemo-speech`.
2. Guardá `nemotron-3.5-asr-streaming-0.6b.q8_0.gguf` en `models/nemotron/`.
3. Iniciá el servidor local:

```powershell
.\scripts\start-nemotron.ps1
```

4. Iniciá Wizzi Note y seleccioná **Nemotron 3.5** en Configuración → Motor de transcripción.

El runtime y el modelo están excluidos de Git. La evaluación inicial y el protocolo de comparación están en [`docs/NEMOTRON-EVALUATION.md`](docs/NEMOTRON-EVALUATION.md).
