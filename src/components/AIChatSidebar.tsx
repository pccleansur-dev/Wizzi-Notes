import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Bot, User, Trash2, Zap } from 'lucide-react';
import { Note, ChatMessage, AIProviderConfig, PROVIDER_OPTIONS } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface AIChatSidebarProps {
  activeNote: Note | null;
  providerConfig: AIProviderConfig;
}

export default function AIChatSidebar({ activeNote, providerConfig }: AIChatSidebarProps) {
  // Auto-detected best model (overrides providerConfig)
  const [bestProvider, setBestProvider] = useState<string>(providerConfig.provider);
  const [bestModel, setBestModel] = useState<string>(providerConfig.models[providerConfig.provider]);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    fetch('/api/best-model')
      .then((r) => r.json())
      .then((data) => {
        if (data.provider && data.model) {
          setBestProvider(data.provider);
          setBestModel(data.model);
        }
      })
      .catch(() => {/* keep defaults */})
      .finally(() => setModelReady(true));
  }, []);

  const provider = bestProvider as keyof typeof PROVIDER_OPTIONS;
  const currentModel = bestModel;
  const providerInfo = PROVIDER_OPTIONS[provider] ?? PROVIDER_OPTIONS['local'];
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat session based on activeNote.id
  const currentNoteId = activeNote?.id || 'general';
  const currentMessages = messages[currentNoteId] || [];

  // Scroll to bottom whenever messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isTyping]);

  // Set default intro message if empty
  useEffect(() => {
    if (activeNote && currentMessages.length === 0) {
      setMessages((prev) => ({
        ...prev,
        [activeNote.id]: [
          {
            id: 'intro',
            sender: 'assistant',
            text: `¡Hola! Soy tu asistente **Wizzi Note**. He indexado **${activeNote.title}** con éxito.\n\nPuedo ayudarte a sintetizar los puntos discutidos o detallar cualquier sección específica. ¿De qué te gustaría conversar hoy?`,
            timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      }));
    } else if (!activeNote && currentMessages.length === 0) {
      setMessages((prev) => ({
        ...prev,
        general: [
          {
            id: 'intro-general',
            sender: 'assistant',
            text: `¡Hola! Selecciona uno de tus documentos o transcribe un nuevo audio para iniciar un RAG local mediante Gemini. Estaré listo para escudriñar el contenido contigo.`,
            timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      }));
    }
  }, [activeNote]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => ({
      ...prev,
      [currentNoteId]: [...(prev[currentNoteId] || []), userMsg],
    }));
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: bestProvider,
          model: bestModel,
          message: text,
          transcript: activeNote?.transcription || '',
          history: (messages[currentNoteId] || []).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Fallo al obtener respuesta del asistente.');
      }

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: data.text || 'No pude sintetizar una respuesta adecuada.',
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => ({
        ...prev,
        [currentNoteId]: [...(prev[currentNoteId] || []), assistantMsg],
      }));
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: '❌ Hubo un error de conexión con el backend o la clave API. Por favor verifica tus credenciales o el estado de tu servidor.',
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => ({
        ...prev,
        [currentNoteId]: [...(prev[currentNoteId] || []), errorMsg],
      }));
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    setMessages((prev) => ({
      ...prev,
      [currentNoteId]: activeNote ? [
        {
          id: 'intro',
          sender: 'assistant',
          text: `Conversación reiniciada. ¿Qué otra duda tienes sobre **${activeNote.title}**?`,
          timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        }
      ] : [],
    }));
  };

  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-xl overflow-hidden flex flex-col h-full" id="chat-sidebar">
      {/* Sidebar Header */}
      <div className="p-md bg-surface-container-lowest/50 border-b border-outline-variant/10 flex items-center justify-between">
        <div className="flex items-center gap-md">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-body-sm font-bold text-on-surface leading-tight">
              {activeNote ? 'Analista IA RAG' : 'Chat de Consulta'}
            </h3>
            {activeNote ? (
              <p className="text-[10px] text-tertiary flex items-center gap-xs font-semibold mt-0.5">
                <span className="w-1.5 h-1.5 bg-tertiary rounded-full animate-ping" />
                Listo en: {activeNote.title.substring(0, 18)}...
              </p>
            ) : (
              <p className="text-[10px] text-on-surface-variant/70 mt-0.5">Sin archivo activo</p>
            )}
          </div>
        </div>

        {currentMessages.length > 1 && (
          <button
            onClick={handleClearChat}
            className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-error transition-colors cursor-pointer"
            title="Borrar Chat"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-md space-y-md custom-scrollbar bg-gradient-to-b from-surface-container-lowest/20 to-surface">
        <AnimatePresence initial={false}>
          {currentMessages.map((msg) => {
            const isBot = msg.sender === 'assistant';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-sm ${isBot ? 'items-start' : 'items-start flex-row-reverse'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isBot ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high border border-white/10 text-on-surface-variant'
                  }`}
                >
                  {isBot ? <Bot size={14} /> : <User size={14} />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-md rounded-2xl max-w-[82%] text-body-sm shadow-sm leading-relaxed border ${
                    isBot
                      ? 'bg-surface-container-high rounded-tl-none border-outline-variant/10 text-on-surface'
                      : 'bg-primary-container/20 text-primary border-primary/20 rounded-tr-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap font-sans break-words pre-wrap">{msg.text}</p>
                  <span className="text-[9px] text-on-surface-variant/50 block text-right mt-1">
                    {msg.timestamp}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isTyping && (
          <div className="flex gap-sm items-start" id="assistant-typing">
            <div className="w-7 h-7 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
              <Bot size={14} />
            </div>
            <div className="bg-surface-container-high p-md rounded-2xl rounded-tl-none border border-outline-variant/10 text-on-surface text-body-sm shadow-sm flex items-center gap-xs">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested RAG queries (Only when we have active note transcription) */}
      {activeNote && currentMessages.length === 1 && !isTyping && (
        <div className="px-md py-sm bg-surface-container-lowest/50 border-t border-outline-variant/5 flex flex-wrap gap-xs shrink-0 max-h-24 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => handleSendMessage('¿Cuáles son los temas más cruciales tratados en este archivo?')}
            className="text-[10px] text-primary bg-primary/5 hover:bg-primary/10 border border-primary/15 rounded-full px-2.5 py-1 transition-all cursor-pointer font-medium"
          >
            Temas cruciales
          </button>
          <button
            onClick={() => handleSendMessage('Házme una lista de las preguntas pendientes o puntos de ambigüedad en esta reunión.')}
            className="text-[10px] text-primary bg-primary/5 hover:bg-primary/10 border border-primary/15 rounded-full px-2.5 py-1 transition-all cursor-pointer font-medium"
          >
            Puntos ambiguos
          </button>
          <button
            onClick={() => handleSendMessage('¿Quién es el participante que propone más ideas o lidera la discusión? Dúcelo.')}
            className="text-[10px] text-primary bg-primary/5 hover:bg-primary/10 border border-primary/15 rounded-full px-2.5 py-1 transition-all cursor-pointer font-medium"
          >
            Líder de la reunión
          </button>
        </div>
      )}

      {/* Message Input Panel */}
      <div className="p-md bg-surface-container-lowest border-t border-outline-variant/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="relative flex items-center bg-surface-container rounded-xl border border-outline-variant/20 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all px-3 py-2"
          id="chat-input-form"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isTyping}
            placeholder={activeNote ? "Consúltale al Analista IA..." : "Primero selecciona una nota..."}
            className="flex-1 bg-transparent border-none text-body-sm text-on-surface px-md placeholder:text-on-surface-variant/40 outline-none focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="bg-primary text-on-primary w-8 h-8 rounded-lg flex items-center justify-center hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
            id="btn-send-message"
          >
            <Send size={14} />
          </button>
        </form>
        <div className="flex items-center justify-center gap-1 mt-sm">
          <Zap size={9} className={`${providerInfo.color} opacity-70`} />
          <span className={`text-[9px] uppercase tracking-wider font-mono ${providerInfo.color} opacity-70`}>
            {modelReady ? `${providerInfo.label} · ${currentModel}` : 'Detectando mejor modelo...'}
          </span>
        </div>
      </div>
    </div>
  );
}
