import React, { useState, useRef, useEffect } from 'react';
import { FileText, Clipboard, CheckCircle2, Bookmark, BookmarkCheck, Calendar, Clock, Star, ListTodo, FileDown, Download, ScrollText } from 'lucide-react';
import { Note } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { exportToPDF } from '../lib/pdfGenerator';

interface TranscriptViewProps {
  note: Note;
  onToggleFavorite: (id: string) => void;
  onExportTXT: (note: Note) => void;
}

export default function TranscriptView({
  note,
  onToggleFavorite,
  onExportTXT,
}: TranscriptViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'transcript' | 'summary' | 'decisions' | 'tasks' | 'extended'>('transcript');
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const toggleTask = (index: number) => {
    const key = `${note.id}-task-${index}`;
    setCompletedTasks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCopy = () => {
    let contentToCopy = '';
    if (activeSubTab === 'transcript') {
      contentToCopy = note.transcription;
    } else if (activeSubTab === 'summary') {
      contentToCopy = note.summary;
    } else if (activeSubTab === 'decisions') {
      contentToCopy = note.decisions.join('\n');
    } else if (activeSubTab === 'tasks') {
      contentToCopy = note.actionItems.join('\n');
    } else if (activeSubTab === 'extended') {
      contentToCopy = note.extendedMinutes || '';
    }

    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to parse line by line and separate Speaker, Timestamps, and Text for gorgeous layout
  const renderParsedTranscription = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-md">
        {lines.map((line, idx) => {
          if (!line.trim()) return null;

          // Match: Orador 1 [01:23]: Text or Orador 1 [01:23] - Text or Orador X: Text
          const speakerMatch = line.match(/^([^[:\n]+?)(?:\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\])?\s*:(.*)$/);
          
          if (speakerMatch) {
            const speaker = speakerMatch[1];
            const timestamp = speakerMatch[2];
            const textContent = speakerMatch[3];
            const isSpeakerOne = speaker.toLowerCase().includes('1');

            return (
              <div 
                key={idx} 
                className={`p-md rounded-xl border transition-all ${
                  isSpeakerOne 
                    ? 'bg-primary-container/5 border-primary/10 pl-4' 
                    : 'bg-surface-container-high/40 border-outline-variant/10 pl-4'
                }`}
              >
                <div className="flex items-center gap-sm mb-xs">
                  <span className={`font-headline-md text-xs font-bold px-2 py-0.5 rounded ${
                    isSpeakerOne 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-secondary/20 text-secondary'
                  }`}>
                    {speaker.trim()}
                  </span>
                  {timestamp && (
                    <span className="font-mono text-xs text-on-surface-variant/70 bg-surface-container-lowest px-2 py-0.5 rounded border border-white/5">
                      {timestamp}
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-on-surface/90 leading-relaxed font-sans pre-wrap whitespace-pre-wrap">
                  {textContent.trim()}
                </p>
              </div>
            );
          }

          // Simple raw text fallback
          return (
            <p key={idx} className="text-body-sm text-on-surface-variant leading-relaxed pre-wrap whitespace-pre-wrap">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-xl overflow-hidden flex flex-col h-full" id="transcript-viewer">
      {/* File Header Details */}
      <div className="p-lg bg-surface-container-lowest/50 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div className="flex items-start gap-md min-w-0">
          <div className="p-md bg-primary-container/10 rounded-xl text-primary shrink-0">
            <FileText size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="font-headline-md text-body-lg text-on-surface truncate font-bold">
              {note.title}
            </h3>
            <div className="flex flex-wrap items-center gap-sm mt-xs text-xs text-on-surface-variant">
              <span className="bg-surface-container-highest px-2.5 py-1 rounded capitalize font-medium">
                {note.type === 'youtube' ? 'YouTube link' : note.type}
              </span>
              <div className="w-1 h-1 bg-outline rounded-full opacity-30" />
              <span className="flex items-center gap-xs">
                <Calendar size={12} />
                {new Date(note.createdAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
              {note.duration && (
                <>
                  <div className="w-1 h-1 bg-outline rounded-full opacity-30" />
                  <span className="flex items-center gap-xs">
                    <Clock size={12} />
                    {note.duration}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Favorite & Exports */}
        <div className="flex items-center gap-sm shrink-0">
          <button
            onClick={() => onToggleFavorite(note.id)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              note.isFavorite
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'
                : 'bg-surface-container/50 border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
            title="Favorito"
          >
            <Star size={18} fill={note.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => onExportTXT(note)}
            className="flex items-center gap-xs bg-surface-container/50 border border-outline-variant/20 hover:text-on-surface hover:bg-surface-container text-on-surface-variant p-2.5 px-md rounded-xl text-body-sm font-semibold transition-all cursor-pointer"
            title="Exportar TXT / Borrador"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Exportar TXT</span>
          </button>
          <button
            onClick={() => exportToPDF(note)}
            className="flex items-center gap-xs bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary p-2.5 px-md rounded-xl text-body-sm font-semibold transition-all cursor-pointer shadow-sm shadow-primary/5"
            title="Exportar Reporte PDF con Formato"
          >
            <FileDown size={16} />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs selectors */}
      <div className="flex overflow-x-auto bg-surface-container border-b border-outline-variant/10 px-md custom-scrollbar whitespace-nowrap">
        <button
          onClick={() => { setActiveSubTab('transcript'); }}
          className={`py-md px-lg text-body-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'transcript'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Transcripción
        </button>
        <button
          onClick={() => { setActiveSubTab('summary'); }}
          className={`py-md px-lg text-body-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'summary'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Resumen Ejecutivo
        </button>
        <button
          onClick={() => { setActiveSubTab('decisions'); }}
          className={`py-md px-lg text-body-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'decisions'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Decisiones Clave
        </button>
        <button
          onClick={() => { setActiveSubTab('tasks'); }}
          className={`py-md px-lg text-body-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'tasks'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Tareas de Acción
        </button>
        {note.extendedMinutes && (
          <button
            onClick={() => { setActiveSubTab('extended'); }}
            className={`py-md px-lg text-body-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-xs ${
              activeSubTab === 'extended'
                ? 'border-tertiary text-tertiary bg-tertiary/5'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <ScrollText size={14} />
            Análisis Completo
          </button>
        )}
      </div>

      {/* Scrollable View Content area */}
      <div className="flex-1 overflow-y-auto p-lg custom-scrollbar min-h-0 bg-surface-container-lowest/10 relative">
        {/* Copy Floating Button */}
        <button
          onClick={handleCopy}
          className="absolute top-4 right-4 bg-surface-container border border-outline-variant/10 hover:bg-surface-container-high transition-colors p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:scale-105 active:scale-95 duration-200 cursor-pointer shadow-md flex items-center gap-xs text-[11px] font-bold z-10"
        >
          {copied ? (
            <>
              <CheckCircle2 className="text-tertiary" size={14} />
              Copiado
            </>
          ) : (
            <>
              <Clipboard size={14} />
              Copiar
            </>
          )}
        </button>

        <AnimatePresence mode="wait">
          {activeSubTab === 'transcript' && (
            <motion.div
              key="transcript-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {note.transcription ? (
                renderParsedTranscription(note.transcription)
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center text-on-surface-variant opacity-60">
                  <FileText size={48} className="mb-md" />
                  <p className="text-body-sm">No hay transcripción disponible para esta nota.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeSubTab === 'summary' && (
            <motion.div
              key="summary-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="prose max-w-none text-on-surface/90 leading-relaxed font-sans pre-wrap whitespace-pre-wrap text-body-sm md:text-body-md"
            >
              <h4 className="font-headline-md text-body-lg text-primary font-bold mb-md">
                Resumen Ejecutivo
              </h4>
              {note.summary || 'Resumen no disponible todavía.'}
            </motion.div>
          )}

          {activeSubTab === 'decisions' && (
            <motion.div
              key="decisions-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-md"
            >
              <h4 className="font-headline-md text-body-lg text-secondary font-bold mb-md">
                Decisiones Clave Tomadas
              </h4>
              {note.decisions && note.decisions.length > 0 ? (
                <ul className="space-y-md">
                  {note.decisions.map((decision, idx) => (
                    <li key={idx} className="flex items-start gap-md p-md rounded-xl bg-surface-container border border-outline-variant/10">
                      <div className="p-xs bg-secondary/15 rounded text-secondary shrink-0 mt-0.5">
                        <CheckCircle2 size={16} />
                      </div>
                      <span className="text-body-sm text-on-surface/90 font-medium leading-relaxed font-sans">
                        {decision}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-on-surface-variant/70 text-body-sm p-4 text-center italic bg-surface-container rounded-xl">
                  Ninguna decisión detectada explícitamente en el contenido.
                </div>
              )}
            </motion.div>
          )}

          {activeSubTab === 'tasks' && (
            <motion.div
              key="tasks-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-md"
            >
              <div className="flex items-center justify-between mb-md">
                <h4 className="font-headline-md text-body-lg text-tertiary font-bold">
                  Tareas Pendientes y Action Items
                </h4>
                <div className="flex items-center gap-2 bg-tertiary/10 text-tertiary text-xs px-2.5 py-1 rounded-full font-semibold">
                  <ListTodo size={12} />
                  Interactivo
                </div>
              </div>

              {note.actionItems && note.actionItems.length > 0 ? (
                <div className="space-y-md">
                  {note.actionItems.map((task, idx) => {
                    const isDone = completedTasks[`${note.id}-task-${idx}`];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleTask(idx)}
                        className={`p-md rounded-xl border flex items-start gap-md transition-all cursor-pointer group ${
                          isDone
                            ? 'bg-tertiary/5 border-tertiary/30 opacity-70'
                            : 'bg-surface-container border-outline-variant/10 hover:border-primary/30'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border transition-all ${
                            isDone
                              ? 'bg-tertiary border-tertiary text-on-tertiary'
                              : 'border-outline-variant group-hover:border-primary bg-background'
                          }`}
                        >
                          {isDone && <CheckCircle2 size={16} />}
                        </div>
                        <span className={`text-body-sm leading-relaxed font-sans ${
                          isDone 
                            ? 'text-on-surface-variant line-through' 
                            : 'text-on-surface/90 font-medium'
                        }`}>
                          {task}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-on-surface-variant/70 text-body-sm p-4 text-center italic bg-surface-container rounded-xl">
                  Ninguna tarea o action item asignado explícitamente en el contenido.
                </div>
              )}
            </motion.div>
          )}
          {activeSubTab === 'extended' && (
            <motion.div
              key="extended-view"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="space-y-md"
            >
              <div className="flex items-center gap-sm mb-md">
                <ScrollText size={16} className="text-tertiary" />
                <h4 className="font-headline-md text-body-lg text-tertiary font-bold">
                  Análisis Completo (Local)
                </h4>
                <span className="text-[10px] bg-tertiary/10 border border-tertiary/20 text-tertiary px-2 py-0.5 rounded-full font-bold ml-1">
                  RAW
                </span>
              </div>
              <p className="text-xs text-on-surface-variant/60 italic mb-md">
                Salida completa del modelo — incluye extracción por fragmento y síntesis final tal como fueron generadas.
              </p>
              <div className="bg-[#0d0d0d] border border-white/5 rounded-xl p-md font-mono text-xs text-white/75 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {note.extendedMinutes}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
