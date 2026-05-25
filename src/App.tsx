/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Sparkles, Terminal, ShieldAlert, ArrowDown, HelpCircle, 
  Trash2, RefreshCw, X, Shield, Volume2, Search, Info, CheckCircle2, 
  AlertCircle, MessageSquare, AlertTriangle, Play, HelpCircle as HelpIcon,
  CircleStop, RefreshCw as RegenerateIcon, Copy, Loader, ExternalLink, Paperclip,
  Brain, Cpu, Mail, Code2, ArrowUp, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { ChatMessage, ChatSession, SettingsConfig, ToastItem } from './types';

// Default application configuration settings
const DEFAULT_CONFIG: SettingsConfig = {
  model: 'deepseek-chat',
  systemInstruction: 'Anda adalah Worm Aiva, asisten chatbot AI generasi berikutnya. Anda cerdas, mandiri, sangat solutif, penolong, bersahabat, serta kompeten menjawab pertanyaan pengguna terkait coding, analisis teks, bahasa, dan pengetahuan umum.',
  temperature: 0.7,
  useSearch: false,
  showAILogoGlow: true,
};

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('worm_aiva_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {
        return [];
      }
    }
    return [];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const savedId = localStorage.getItem('worm_aiva_active_session_id');
    return savedId || null;
  });

  const [config, setConfig] = useState<SettingsConfig>(() => {
    const saved = localStorage.getItem('worm_aiva_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: string;
    size: number;
    base64?: string;
    textData?: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state modifications with LocalStorage
  useEffect(() => {
    localStorage.setItem('worm_aiva_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('worm_aiva_active_session_id', activeSessionId);
    } else {
      localStorage.removeItem('worm_aiva_active_session_id');
    }
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem('worm_aiva_config', JSON.stringify(config));
  }, [config]);

  // Handle auto scrolling inside message feed
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  
  useEffect(() => {
    scrollToBottom('smooth');
  }, [activeSession?.messages?.length, activeSession?.messages?.map(m => m.text).join('')]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      messagesContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior,
      });
    }
  };

  const handleScrollDetect = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // Show back to bottom arrow if user scrolls up significantly
      const isUp = scrollHeight - scrollTop - clientHeight > 300;
      setShowScrollBottomBtn(isUp);
    }
  };

  // Toast Management Function
  const showToast = (message: string, type: ToastItem['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Initialize a fresh new empty chat session
  const handleNewChat = (initialText?: string) => {
    const newSessionId = 'session-' + Date.now();
    const cleanSession: ChatSession = {
      id: newSessionId,
      title: initialText ? (initialText.slice(0, 24) + (initialText.length > 24 ? '...' : '')) : 'Sesi Obrolan Baru',
      lastUpdated: new Date().toISOString(),
      messages: [],
    };

    setSessions((prev) => [cleanSession, ...prev]);
    setActiveSessionId(newSessionId);
    if (!initialText) {
      showToast('Sesi obrolan baru modular dibentuk', 'success');
    }
    return newSessionId;
  };

  // Handle document or image file upload parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxLimit = 12 * 1024 * 1024; // 12 Megabytes max limit
    if (file.size > maxLimit) {
      showToast('Ukuran berkas melebihi batas maksimal 12MB.', 'error');
      return;
    }

    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
      reader.onload = () => {
        const result = reader.result as string;
        const rawBase64 = result.split(',')[1];
        setAttachedFile({
          name: file.name,
          type: file.type,
          size: file.size,
          base64: rawBase64,
        });
        showToast(`Gambar "${file.name}" berhasil dilampirkan!`, 'success');
      };
      reader.onerror = () => {
        showToast('Gagal memuat gambar.', 'error');
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        const content = reader.result as string;
        setAttachedFile({
          name: file.name,
          type: file.type,
          size: file.size,
          textData: content,
        });
        showToast(`Dokumen "${file.name}" berhasil dilampirkan!`, 'success');
      };
      reader.onerror = () => {
        showToast('Gagal membaca dokumen.', 'error');
      };
      reader.readAsText(file);
    }

    // Reset indicator to allow selection repetition
    e.target.value = '';
  };

  // Handle standard prompt triggers
  const handleSendMessage = async (textToSend: string) => {
    const textClean = textToSend.trim();
    // Allow sending message empty text ONLY when an attachment is uploaded! 
    if (!textClean && !attachedFile) return;
    if (isGenerating) return;

    let targetSessionId = activeSessionId;
    let targetSessions = [...sessions];

    // If no active session, create one instantly
    if (!targetSessionId) {
      targetSessionId = 'session-' + Date.now();
      const defaultTitle = textClean ? textClean.slice(0, 24) : (attachedFile ? `File: ${attachedFile.name}` : 'Sesi Obrolan Baru');
      const titleText = defaultTitle + (defaultTitle.length > 24 ? '...' : '');
      const newSession: ChatSession = {
        id: targetSessionId,
        title: titleText,
        lastUpdated: new Date().toISOString(),
        messages: [],
      };
      targetSessions = [newSession, ...targetSessions];
      setSessions(targetSessions);
      setActiveSessionId(targetSessionId);
    }

    // Set prompt title automatically if session has generic name
    targetSessions = targetSessions.map(s => {
      if (s.id === targetSessionId && (s.title === 'Sesi Obrolan Baru' || s.messages.length === 0)) {
        const rawTitle = textClean ? textClean.slice(0, 28) : (attachedFile ? `File: ${attachedFile.name}` : 'Obrolan');
        return {
          ...s,
          title: rawTitle + (rawTitle.length > 28 ? '...' : '')
        };
      }
      return s;
    });

    // Capture file attachment snapshots
    const fileSnap = attachedFile ? { ...attachedFile } : undefined;

    const userMessage: ChatMessage = {
      id: 'msg-user-' + Date.now(),
      role: 'user',
      text: textClean,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      file: fileSnap,
    };

    const aiMessageId = 'msg-ai-stream-' + Date.now();
    const aiMessagePlaceholder: ChatMessage = {
      id: aiMessageId,
      role: 'model',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStreaming: true,
    };

    // Update session state logs locally
    const sessionWithInputs = targetSessions.map((session) => {
      if (session.id === targetSessionId) {
        return {
          ...session,
          messages: [...session.messages, userMessage, aiMessagePlaceholder],
          lastUpdated: new Date().toISOString(),
        };
      }
      return session;
    });

    setSessions(sessionWithInputs);
    setInputValue('');
    setAttachedFile(null); // Clear active attachment state immediately for next prompt
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Get absolute historical context excluding streaming temporary message
    const targetedHistory = sessionWithInputs.find(s => s.id === targetSessionId);
    const apiHistory = targetedHistory 
      ? targetedHistory.messages.filter(m => m.id !== aiMessageId).map(m => ({ role: m.role, text: m.text }))
      : [{ role: 'user', text: textClean }];

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: apiHistory,
          model: config.model,
          systemInstruction: config.systemInstruction,
          temperature: config.temperature,
          useSearch: config.useSearch,
          file: fileSnap || null,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `HTTP ${response.status} failed standard stream.`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('SSE streaming reader initialization collapsed.');

      const decoder = new TextDecoder();
      let unfinishedChunk = '';
      let textStreamAccumulated = '';
      let groundingSources: { title: string; uri: string }[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawText = decoder.decode(value, { stream: true });
        const lines = (unfinishedChunk + rawText).split('\n');
        unfinishedChunk = lines.pop() || '';

        let currentSseEvent = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event:')) {
            currentSseEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataString = trimmed.slice(5).trim();
            try {
              const dataParsed = JSON.parse(dataString);
              if (currentSseEvent === 'chunk') {
                textStreamAccumulated += dataParsed.text || '';
                
                // Parse Search grounding if provided
                if (dataParsed.groundingMetadata?.groundingChunks) {
                  const sources = dataParsed.groundingMetadata.groundingChunks;
                  groundingSources = sources
                    .filter((c: any) => c.web?.title && c.web?.uri)
                    .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
                }

                // Push chunk to state instantly
                setSessions((prev) =>
                  prev.map((s) => {
                    if (s.id === targetSessionId) {
                      return {
                        ...s,
                        messages: s.messages.map((m) => {
                          if (m.id === aiMessageId) {
                            return {
                              ...m,
                              text: textStreamAccumulated,
                              groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
                            };
                          }
                          return m;
                        }),
                      };
                    }
                    return s;
                  })
                );
              } else if (currentSseEvent === 'error') {
                throw new Error(dataParsed.error || 'Cognitive stream abort error');
              }
            } catch (err: any) {
              console.warn("Telemetry JSON error", err);
            }
          }
        }
      }

      // Finish streaming cleanly
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.id === aiMessageId) {
                  return { ...m, isStreaming: false };
                }
                return m;
              }),
            };
          }
          return s;
        })
      );
      showToast('Worm Aiva merampungkan transmisi', 'success');

    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Streaming ditolak manual oleh operator', 'info');
      } else {
        showToast(err.message || 'Stream neural core gagal tersambung', 'error');
        
        // Push secure error bubble inside active message listing
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: s.messages.map((m) => {
                  if (m.id === aiMessageId) {
                    return {
                      ...m,
                      text: m.text 
                        ? m.text + '\n\n*(Transmisi terputus atau gagal)*' 
                        : 'Maaf, Worm Aiva mendeteksi gangguan koneksi pada terminal kognitif. Silakan coba regenerate atau periksa kredensial / jaringan Anda.',
                      isStreaming: false,
                      isError: true,
                    };
                  }
                  return m;
                }),
              };
            }
            return s;
          })
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Stop Generation Trigger Handler
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate Response Tracker
  const handleRegenerateResponse = () => {
    if (!activeSessionId || isGenerating) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || session.messages.length === 0) return;

    // Isolate user prompts
    const userPrompts = session.messages.filter((m) => m.role === 'user');
    if (userPrompts.length === 0) return;
    const lastUserPrompt = userPrompts[userPrompts.length - 1];

    // Crop historical record up to this message
    const lastPromptIndex = session.messages.findIndex((m) => m.id === lastUserPrompt.id);
    const prunedList = session.messages.slice(0, lastPromptIndex + 1);

    const updated = sessions.map((s) => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: prunedList,
          lastUpdated: new Date().toISOString(),
        };
      }
      return s;
    });

    setSessions(updated);
    handleSendMessage(lastUserPrompt.text);
  };

  // Sesi Deletion Handler
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const refreshed = sessions.filter((s) => s.id !== id);
    setSessions(refreshed);
    
    if (activeSessionId === id) {
      setActiveSessionId(refreshed.length > 0 ? refreshed[0].id : null);
    }
  };

  // Clear dialogue inside active session screen
  const handleResetCurrentChat = () => {
    if (!activeSessionId) return;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            title: 'Sesi Obrolan Baru',
            messages: [],
            lastUpdated: new Date().toISOString(),
          };
        }
        return s;
      })
    );
  };

  const handleClearAllSessions = () => {
    setSessions([]);
    setActiveSessionId(null);
    localStorage.removeItem('worm_aiva_sessions');
    localStorage.removeItem('worm_aiva_active_session_id');
  };

  const promptSuggestions = [
    { title: 'Apa itu AI?', text: 'Coba jelaskan secara sederhana apa itu Artificial Intelligence dan bagaimana cara kerjanya.' },
    { title: 'Bantu coding Python', text: 'Buatlah script Python ramah pemula untuk mendeteksi wajah di gambar menggunakan OpenCV.' },
    { title: 'Tulis email', text: 'Tulis draf email formal dan profesional untuk pengunduran diri kerja dengan pemberitahuan 1 bulan.' },
    { title: 'Machine learning', text: 'Jelaskan perbedaan antara Supervised, Unsupervised, dan Reinforcement Learning.' },
  ];


  return (
    <>
      {/* Main Fullscreen Dashboard Layout container */}
      <div id="immersive-dashboard" className="flex h-screen w-full bg-[#050507] text-zinc-200 font-sans overflow-hidden relative selection:bg-[#ff3355]/30 select-none">
        {/* Abstract Background Lights (Immersive theme core design features) */}
        <div className="absolute top-[-10%] left-[-10%] w-[380px] h-[380px] rounded-full bg-red-950/10 blur-[130px] pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[480px] h-[480px] rounded-full bg-red-950/5 blur-[150px] pointer-events-none z-0"></div>

        {/* Animated breathing rising and falling red ambient glow at the bottom center */}
        <motion.div
          animate={{
            y: [15, -45, 15],
            opacity: [0.22, 0.48, 0.22],
            scaleX: [1, 1.12, 1],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 w-[750px] h-[300px] rounded-full bg-[#ff3355]/25 blur-[110px] pointer-events-none z-0"
        />

        {/* 2. Responsive Sidebar Panel with chat sessions list */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => setActiveSessionId(id)}
          onNewChat={() => handleNewChat()}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAllSessions}
        />

        {/* 3. Operational view contents container */}
        <main className="flex-1 flex flex-col h-full min-w-0 z-10 relative bg-black/5">
          {/* Main system header */}
          <Header
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onResetChat={handleResetCurrentChat}
            activeModel={config.model}
            useSearch={config.useSearch}
            hasActiveMessages={!!activeSession && activeSession.messages.length > 0}
          />

          {/* Interactive Chat message stream window */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleScrollDetect}
            className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6 scroll-smooth"
          >
            {activeSession && activeSession.messages.length > 0 ? (
              <div className="max-w-3xl mx-auto space-y-6">
                {activeSession.messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex gap-3.5 max-w-[90%] md:max-w-[80%] hover:scale-[1.002] transition-transform duration-200">
                        {/* AI Logo Avatar bubble column */}
                        {!isUser && (
                          <div className={`w-8 h-8 rounded-full border border-red-500/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(255,51,85,0.3)] overflow-hidden ${msg.isStreaming ? 'animate-pulse' : ''}`}>
                            <img
                              src="https://i.ibb.co.com/T5JkfpS/file-00000000329c71fa9276e0523e9d3280.png"
                              alt="AIVA"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover rounded-full"
                            />
                          </div>
                        )}

                        {/* Speech Bubble Container */}
                        <div
                          className={`relative select-text transition-all duration-300 ${
                            isUser
                              ? 'bg-gradient-to-br from-zinc-900 to-[#121217] border border-zinc-800 text-zinc-100 rounded-2xl rounded-tr-none px-4 py-3 text-sm leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:border-zinc-700' 
                              : `bg-gradient-to-b from-[#0c0c14]/95 to-[#07070a]/98 border ${msg.isError ? 'border-rose-500/40 bg-rose-500/5' : 'border-red-500/15'} rounded-2xl rounded-tl-none px-5 py-4 text-sm text-zinc-150 shadow-[0_8px_30px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,51,85,0.03)] hover:border-red-500/25`
                          }`}
                        >
                          {/* Markdown parsing stream output feed */}
                          {isUser ? (
                            <div className="space-y-2">
                              {msg.file && (
                                <div className="flex items-center gap-2.5 p-2 bg-zinc-950/70 border border-zinc-800/60 rounded-xl max-w-full">
                                  {msg.file.type.startsWith('image/') ? (
                                    <div className="relative">
                                      <img
                                        src={`data:${msg.file.type};base64,${msg.file.base64}`}
                                        alt="Sent content"
                                        className="w-20 h-14 object-cover rounded-lg border border-zinc-800"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-[#ff3355] flex-shrink-0">
                                      <Paperclip size={14} />
                                    </div>
                                  )}
                                  <div className="min-w-0 pr-1">
                                    <p className="text-[11px] font-bold text-zinc-300 truncate max-w-[150px] sm:max-w-xs">{msg.file.name}</p>
                                    <p className="text-[9px] text-zinc-500 font-mono">{(msg.file.size / 1024).toFixed(1)} KB • {msg.file.type.split('/')[1] || 'doc'}</p>
                                  </div>
                                </div>
                              )}
                              {msg.text && <p className="whitespace-pre-wrap break-words font-sans">{msg.text}</p>}
                            </div>
                          ) : (
                            <div className="markdown-body font-sans select-text select-all">
                              {msg.text ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    code({ node, className, children, ...props }) {
                                      const match = /language-(\w+)/.exec(className || '');
                                      const isInline = !className;
                                      const codeString = String(children).replace(/\n$/, '');
                                      
                                      if (!isInline && match) {
                                        return (
                                          <div className="relative my-3 rounded-xl border border-white/5 bg-black/60 font-mono text-xs overflow-hidden leading-normal shadow-md">
                                            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-zinc-950/60 text-zinc-405 select-none font-sans">
                                              <span className="text-[10px] uppercase font-bold text-[#ff3355] tracking-wider font-mono">
                                                {match[1]}
                                              </span>
                                              <button
                                                onClick={() => {
                                                  navigator.clipboard.writeText(codeString);
                                                  showToast('Variabel kode telah disalin!', 'success');
                                                }}
                                                className="flex items-center gap-1.5 text-[10px] hover:text-white transition-colors cursor-pointer text-gray-400 capitalize font-medium"
                                              >
                                                <Copy size={11} />
                                                Salin Kode
                                              </button>
                                            </div>
                                            <div className="p-4 overflow-x-auto text-zinc-250 font-mono scrollbar-thin">
                                              <pre className="m-0 leading-relaxed font-mono">
                                                <code className={className} {...props}>
                                                  {children}
                                                </code>
                                              </pre>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return (
                                        <code className="bg-red-500/10 text-[#ff3355] px-1.5 py-0.5 rounded font-mono text-xs border border-red-500/10 mx-0.5 font-semibold" {...props}>
                                          {children}
                                        </code>
                                      );
                                    }
                                  }}
                                >
                                  {msg.text}
                                </ReactMarkdown>
                              ) : (
                                <div className="flex items-center gap-2 py-1 text-zinc-400">
                                  <Loader className="w-4 h-4 animate-spin text-[#ff3355]" />
                                  <span className="text-xs font-mono lowercase tracking-wide italic">menghubungkan data sinkronisasi...</span>
                                </div>
                              )}

                              {/* Realtime streaming active flashing pulse character */}
                              {msg.isStreaming && (
                                <span className="inline-block w-1.5 h-4 bg-[#ff3355] ml-1.5 animate-pulse align-middle" />
                              )}
                            </div>
                          )}

                          {/* Grounding sources web search citations list */}
                          {!isUser && msg.groundingSources && msg.groundingSources.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-zinc-900 flex flex-col gap-2 font-sans">
                              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                <Sparkles size={11} className="text-cyan-400" />
                                Terintegrasi dengan Web Search
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.groundingSources.map((source, sIdx) => (
                                  <a
                                    key={sIdx}
                                    href={source.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-400/40 text-zinc-400 hover:text-cyan-300 text-[10px] font-semibold transition-all"
                                  >
                                    <ExternalLink size={9} />
                                    <span className="max-w-[120px] truncate">{source.title}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action pills (shown at the bottom of the AI response once completed) */}
                          {!isUser && !msg.isStreaming && index === activeSession.messages.length - 1 && (
                            <div className="flex gap-2 mt-4 select-none">
                              <button 
                                onClick={handleRegenerateResponse}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-gray-400 transition-all font-sans font-semibold hover:text-white hover:border-[#ff3355]/30 cursor-pointer"
                              >
                                <RegenerateIcon size={11} />
                                Regenerate
                              </button>
                              {isGenerating && (
                                <button 
                                  onClick={handleStopGenerating}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[10px] text-red-400 transition-all font-sans font-semibold cursor-pointer animate-pulse"
                                >
                                  <CircleStop size={11} />
                                  Stop Generating
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* User Avatar tag bubble column removed */}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Aesthetics empty landing dashboard - perfectly flexible scrollable viewport wrapper */
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="w-full min-h-full flex flex-col items-center justify-center max-w-2xl mx-auto py-8 sm:py-12 px-4 select-none"
              >
                {/* Brand Logo - Clean, rounded curved borderless floating logo image */}
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="relative w-36 h-36 mb-6 flex items-center justify-center select-none z-10 cursor-default rounded-[2.5rem] overflow-hidden shadow-lg"
                >
                  <img
                    src="https://i.ibb.co.com/T5JkfpS/file-00000000329c71fa9276e0523e9d3280.png"
                    alt="Worm Aiva Logo"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover pointer-events-none rounded-[2.5rem]"
                  />
                </motion.div>

              {/* Brand title with beautiful solid bright red-pink premium gradient (fully opaque on the left) and version info */}
              <div className="text-center mb-8 flex flex-col items-center select-none leading-none">
                <h2 className="text-3xl font-black tracking-[0.3em] bg-gradient-to-r from-[#ff003c] via-[#ff476e] to-[#ffccd5] bg-clip-text text-transparent uppercase font-sans drop-shadow-[0_0_20px_rgba(255,51,85,0.4)] pl-[0.3em] leading-normal sm:text-4xl">
                  WORM AIVA
                </h2>
                <span className="text-[8.5px] font-mono font-black text-white/95 bg-white/5 border border-white/20 rounded-full px-3 py-1 mt-2.5 tracking-[0.25em] shadow-[0_0_8px_rgba(255,255,255,0.08)] uppercase">
                  version 1.2
                </span>
              </div>

              {/* Suggestion list designed beautifully as interactive grid cards (always fits the viewport) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-2">
                <motion.button
                  whileHover={{ scale: 1.025, borderColor: 'rgba(255, 51, 85, 0.45)', backgroundColor: 'rgba(255, 51, 85, 0.05)', boxShadow: '0 8px 30px rgba(255, 51, 85, 0.12)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage('Pelajari Konsep AI: Mulai petualangan dengan menjelajahi dasar kecerdasan buatan.')}
                  className="flex items-start gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-[#0c0c12]/80 to-[#06060a]/95 hover:text-white transition-all duration-300 text-left cursor-pointer backdrop-blur-md relative overflow-hidden group select-none shadow-[0_6px_25px_rgba(0,0,0,0.5)]"
                >
                  {/* Decorative corner glow line */}
                  <div className="absolute top-0 left-0 w-0.5 h-0 bg-gradient-to-b from-[#ff3355] to-transparent group-hover:h-full transition-all duration-300" />
                  
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#ff3355]/15 to-[#ff3355]/5 text-[#ff3355] border border-red-500/30 shadow-[0_0_10px_rgba(255,51,85,0.15)] flex-shrink-0 group-hover:from-[#ff3355]/25 group-hover:to-[#ff3355]/10 group-hover:scale-105 transition-all">
                    <Sparkles size={18} className="drop-shadow-[0_0_5px_rgba(255,51,85,0.5)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-bold text-zinc-150 group-hover:text-white tracking-wide transition-colors">Pelajari Konsep AI</h4>
                    <p className="text-[12px] text-zinc-450 group-hover:text-zinc-350 line-clamp-2 mt-1.5 leading-relaxed transition-colors">
                      Mulai petualangan dengan menjelajahi dasar kecerdasan buatan.
                    </p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.025, borderColor: 'rgba(255, 51, 85, 0.45)', backgroundColor: 'rgba(255, 51, 85, 0.05)', boxShadow: '0 8px 30px rgba(255, 51, 85, 0.12)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage('Asisten Kode Python: Buat kode pemrograman, analisis algoritma, atau debug script Anda.')}
                  className="flex items-start gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-[#0c0c12]/80 to-[#06060a]/95 hover:text-white transition-all duration-300 text-left cursor-pointer backdrop-blur-md relative overflow-hidden group select-none shadow-[0_6px_25px_rgba(0,0,0,0.5)]"
                >
                  {/* Decorative corner glow line */}
                  <div className="absolute top-0 left-0 w-0.5 h-0 bg-gradient-to-b from-[#ff3355] to-transparent group-hover:h-full transition-all duration-300" />
                  
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#ff3355]/15 to-[#ff3355]/5 text-[#ff3355] border border-red-500/30 shadow-[0_0_10px_rgba(255,51,85,0.15)] flex-shrink-0 group-hover:from-[#ff3355]/25 group-hover:to-[#ff3355]/10 group-hover:scale-105 transition-all">
                    <Code2 size={18} className="drop-shadow-[0_0_5px_rgba(255,51,85,0.5)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-bold text-zinc-150 group-hover:text-white tracking-wide transition-colors">Asisten Kode Python</h4>
                    <p className="text-[12px] text-zinc-450 group-hover:text-zinc-350 line-clamp-2 mt-1.5 leading-relaxed transition-colors">
                      Buat kode pemrograman, analisis algoritma, atau debug script Anda.
                    </p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.025, borderColor: 'rgba(255, 51, 85, 0.45)', backgroundColor: 'rgba(255, 51, 85, 0.05)', boxShadow: '0 8px 30px rgba(255, 51, 85, 0.12)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage('Tulis Email Profesional: Susun draf email formal, lamaran kerja, atau pesan bisnis secara elegan.')}
                  className="flex items-start gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-[#0c0c12]/80 to-[#06060a]/95 hover:text-white transition-all duration-300 text-left cursor-pointer backdrop-blur-md relative overflow-hidden group select-none shadow-[0_6px_25px_rgba(0,0,0,0.5)]"
                >
                  {/* Decorative corner glow line */}
                  <div className="absolute top-0 left-0 w-0.5 h-0 bg-gradient-to-b from-[#ff3355] to-transparent group-hover:h-full transition-all duration-300" />
                  
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#ff3355]/15 to-[#ff3355]/5 text-[#ff3355] border border-red-500/30 shadow-[0_0_10px_rgba(255,51,85,0.15)] flex-shrink-0 group-hover:from-[#ff3355]/25 group-hover:to-[#ff3355]/10 group-hover:scale-105 transition-all">
                    <Mail size={18} className="drop-shadow-[0_0_5px_rgba(255,51,85,0.5)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-bold text-zinc-150 group-hover:text-white tracking-wide transition-colors">Tulis Email Profesional</h4>
                    <p className="text-[12px] text-zinc-450 group-hover:text-zinc-350 line-clamp-2 mt-1.5 leading-relaxed transition-colors">
                      Susun draf email formal, lamaran kerja, atau pesan bisnis secara elegan.
                    </p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.025, borderColor: 'rgba(255, 51, 85, 0.45)', backgroundColor: 'rgba(255, 51, 85, 0.05)', boxShadow: '0 8px 30px rgba(255, 51, 85, 0.12)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSendMessage('Teori Machine Learning: Analisis perbedaan fungsional model deep learning & pembelajaran mesin.')}
                  className="flex items-start gap-4 p-5 rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-[#0c0c12]/80 to-[#06060a]/95 hover:text-white transition-all duration-300 text-left cursor-pointer backdrop-blur-md relative overflow-hidden group select-none shadow-[0_6px_25px_rgba(0,0,0,0.5)]"
                >
                  {/* Decorative corner glow line */}
                  <div className="absolute top-0 left-0 w-0.5 h-0 bg-gradient-to-b from-[#ff3355] to-transparent group-hover:h-full transition-all duration-300" />
                  
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#ff3355]/15 to-[#ff3355]/5 text-[#ff3355] border border-red-500/30 shadow-[0_0_10px_rgba(255,51,85,0.15)] flex-shrink-0 group-hover:from-[#ff3355]/25 group-hover:to-[#ff3355]/10 group-hover:scale-105 transition-all">
                    <Cpu size={18} className="drop-shadow-[0_0_5px_rgba(255,51,85,0.5)]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-bold text-zinc-150 group-hover:text-white tracking-wide transition-colors">Teori Machine Learning</h4>
                    <p className="text-[12px] text-zinc-450 group-hover:text-zinc-350 line-clamp-2 mt-1.5 leading-relaxed transition-colors">
                      Analisis perbedaan fungsional model deep learning & pembelajaran mesin.
                    </p>
                  </div>
                </motion.button>
              </div>
              </motion.div>
            )}
          </div>

          {/* Floated scroll-to-bottom pointer button */}
          {showScrollBottomBtn && (
            <button
              onClick={() => scrollToBottom('smooth')}
              className="absolute bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 p-2.5 rounded-full glass-panel border border-zinc-800 text-zinc-400 hover:text-white shadow-2xl transition-all cursor-pointer hover:border-[#ff3355]/30 animate-bounce"
            >
              <ArrowDown size={14} />
            </button>
          )}

          {/* Operational Input console segment */}
          <div className="p-4 md:p-6 bg-gradient-to-t from-[#050507] via-[#050507]/95 to-transparent relative z-20">
            <div className="max-w-3xl mx-auto space-y-4">
              
              {/* Active file attachment preview banner */}
              {attachedFile && (
                <div className="flex items-center gap-2.5 p-2 bg-[#0d0d12] border border-red-500/10 rounded-xl w-fit max-w-full backdrop-blur-md relative z-10 animate-fade-in shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
                  {attachedFile.type.startsWith('image/') ? (
                    <img
                      src={`data:${attachedFile.type};base64,${attachedFile.base64}`}
                      alt="Thumbnail upload"
                      className="w-10 h-10 object-cover rounded-lg border border-zinc-800"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-zinc-950 border border-zinc-850 rounded-lg flex items-center justify-center text-[#ff3355] flex-shrink-0">
                      <Paperclip size={14} />
                    </div>
                  )}
                  <div className="min-w-0 pr-1.5">
                    <p className="text-xs font-bold text-zinc-300 truncate max-w-[160px] sm:max-w-xs">{attachedFile.name}</p>
                    <p className="text-[9px] text-zinc-500 font-mono">{(attachedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="p-1 rounded-md hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Hapus lampiran"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Native Hidden File Chooser Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,text/*,.txt,.js,.jsx,.ts,.tsx,.json,.md,.html,.css,.py,.java,.cpp,.doc,.pdf,.csv,.tsv"
              />

              {/* Input Command interface Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }}
                className="relative flex items-center group select-none"
              >
                {/* Back glowing neon background effect under focus state */}
                <div className="absolute inset-0 bg-[#ff3355]/8 rounded-2xl blur-lg opacity-35 group-focus-within:opacity-75 transition-opacity pointer-events-none"></div>
                
                <div className="relative flex items-center w-full bg-[#0a0a0f]/95 border border-zinc-800/80 group-focus-within:border-[#ff3355]/40 rounded-2xl p-1.5 backdrop-blur-2xl transition-all shadow-[0_8px_32px_rgba(0,0,0,0.65)]">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-[#ff3355] transition-all select-none cursor-pointer"
                    title="Tambahkan lampiran"
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={attachedFile ? "Ketik instruksi untuk file ini..." : "Tulis pesan untuk Worm Aiva..."}
                    disabled={isGenerating}
                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm text-zinc-100 placeholder-zinc-550 focus:ring-0 focus:outline-none"
                  />

                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={handleStopGenerating}
                      className="p-2.5 bg-red-950/40 hover:bg-red-900 border border-red-500/30 text-white rounded-xl shadow-[0_0_15px_rgba(255,51,85,0.4)] transition-all cursor-pointer flex items-center justify-center animate-pulse"
                      title="Hentikan Proses Streaming"
                    >
                      <CircleStop size={16} className="text-[#ff3355]" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputValue.trim() && !attachedFile}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                        inputValue.trim() || attachedFile
                          ? 'bg-[#ff3355]/10 hover:bg-[#ff3355]/20 text-[#ff3355] border border-[#ff3355]/30 shadow-[0_0_15px_rgba(255,51,85,0.25)] hover:scale-105 active:scale-95'
                          : 'bg-transparent text-zinc-700 shadow-none border border-transparent cursor-not-allowed'
                      }`}
                      title="Kirim pesan"
                    >
                      <ArrowUp size={16} className={inputValue.trim() || attachedFile ? "text-[#ff3355] stroke-[2.5px] drop-shadow-[0_0_4px_rgba(255,51,85,0.5)]" : "text-zinc-700"} />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
