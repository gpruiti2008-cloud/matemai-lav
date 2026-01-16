
import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, StructuredContent } from './types';
import { getGeminiResponse } from './services/geminiService';

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastTimestamp: Date;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: Role.BOT,
      parts: [{ text: "Ciao! 👋 Sono **MatemAI-tica Lav**, il tuo tutor web personale. Scrivi un esercizio o carica una foto, e lo risolveremo insieme in modo semplicissimo!" }],
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTeoria, setExpandedTeoria] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [history, setHistory] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => Date.now().toString());
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (messages.length > 1) {
      const updatedHistory = [...history];
      const sessionIndex = updatedHistory.findIndex(s => s.id === currentSessionId);
      const firstUserMsg = messages.find(m => m.role === Role.USER)?.parts.find(p => p.text)?.text || "Conversazione";
      const title = firstUserMsg.length > 25 ? firstUserMsg.substring(0, 25) + "..." : firstUserMsg;

      if (sessionIndex >= 0) {
        updatedHistory[sessionIndex] = { ...updatedHistory[sessionIndex], messages, lastTimestamp: new Date() };
      } else {
        updatedHistory.unshift({ id: currentSessionId, title, messages, lastTimestamp: new Date() });
      }
      setHistory(updatedHistory);
      localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleNewChat = () => {
    setMessages([{
      id: 'welcome',
      role: Role.BOT,
      parts: [{ text: "Nuova sessione avviata! Cosa studiamo oggi? 📐" }],
      timestamp: new Date()
    }]);
    setCurrentSessionId(Date.now().toString());
    setShowMobileSidebar(false);
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setShowMobileSidebar(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(s => s.id !== id);
    setHistory(updated);
    localStorage.setItem('chatHistory', JSON.stringify(updated));
    if (currentSessionId === id) handleNewChat();
  };

  const handleShare = async () => {
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'MatemAI-tica Lav', text: 'Il miglior tutor di matematica AI!', url });
      } else {
        await navigator.clipboard.writeText(url);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (err) { console.error(err); }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;
    const currentRequestId = ++requestIdRef.current;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      parts: [
        ...(inputText ? [{ text: inputText }] : []),
        ...(selectedImage ? [{ image: selectedImage }] : [])
      ],
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const result = await getGeminiResponse(messages.slice(-6), userMessage);
      if (currentRequestId !== requestIdRef.current) return;
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: Role.BOT,
        parts: typeof result === 'string' ? [{ text: result }] : [{ structured: result }],
        timestamp: new Date()
      }]);
    } finally {
      if (currentRequestId === requestIdRef.current) setIsLoading(false);
    }
  };

  const formatText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 dark:text-white">$1</strong>')
        .replace(/([Δπ√±∞≈≠≤≥²³÷×→⇒])/g, '<span class="text-indigo-600 dark:text-indigo-400 font-bold">$1</span>');
      return <p key={idx} className="mb-1" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="p-6">
        <button onClick={handleNewChat} className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Nuova Analisi
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 space-y-2 no-scrollbar">
        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-3 mb-4">Cronologia Recente</h3>
        {history.length === 0 ? (
          <div className="py-10 text-center px-6">
            <p className="text-slate-300 dark:text-slate-700 text-xs italic">I tuoi esercizi appariranno qui</p>
          </div>
        ) : (
          history.map(session => (
            <div 
              key={session.id} 
              onClick={() => loadSession(session)}
              className={`group relative p-3.5 rounded-xl transition-all cursor-pointer border-2 ${currentSessionId === session.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate pr-6">{session.title}</p>
              <button onClick={(e) => deleteSession(e, session.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))
        )}
      </div>
      <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <button onClick={handleShare} className="w-full p-3 flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          <span className="text-xs font-black uppercase tracking-widest">Condividi Sito</span>
        </button>
        <button onClick={() => setShowSettings(true)} className="w-full p-3 flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-colors mt-1">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-xs font-black uppercase tracking-widest">Opzioni</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-jakarta transition-colors duration-300`}>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-indigo-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-top-10 duration-500">
          <span>🔗</span> Link copiato negli appunti!
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className="hidden lg:block w-80 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative">
        {/* Header Mobile & Desktop Title */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowMobileSidebar(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-brand-600/30">π</div>
              <div>
                <h1 className="font-extrabold text-slate-900 dark:text-white text-base leading-none">MatemAI-tica <span className="text-brand-600">Lav</span></h1>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Sito Web Ufficiale</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-full">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{isLoading ? 'AI sta scrivendo' : 'AI Online'}</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto px-6 py-12 md:py-20 space-y-12">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'} animate-chat`}>
                <div className={`max-w-[95%] md:max-w-[85%] ${msg.role === Role.USER ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-[2rem] rounded-tr-sm p-6 shadow-xl border border-slate-100 dark:border-slate-800' : 'w-full space-y-8'}`}>
                  {msg.parts.map((p, i) => (
                    p.structured ? (
                      <div key={i} className="space-y-8">
                        {/* Esercizio Card */}
                        <div className="bg-indigo-600 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden text-white group">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-[100px] group-hover:scale-110 transition-transform duration-1000"></div>
                          <div className="relative z-10">
                            <h3 className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2"><span className="w-6 h-px bg-indigo-300"></span> Esercizio Analizzato</h3>
                            <div className="text-xl md:text-3xl font-bold leading-tight tracking-tight">{formatText(p.structured.esercizio)}</div>
                          </div>
                        </div>

                        {/* Spiegazione Card */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-sm">
                          <h3 className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8">Soluzione Passo-Passo</h3>
                          <div className="space-y-6">
                             {p.structured.spiegazione.split('\n').map((line, lidx) => {
                               const lower = line.trim().toLowerCase();
                               if (lower.startsWith('calcolo:')) return <div key={lidx} className="bg-slate-50 dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 text-3xl md:text-5xl font-black text-center my-10 tracking-tighter text-slate-900 dark:text-white shadow-inner">{line.replace(/calcolo:/i, '').trim()}</div>;
                               if (lower.startsWith('passaggio')) return <h4 key={lidx} className="text-indigo-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-12 mb-4 border-b border-indigo-50 dark:border-indigo-900/30 pb-2">{line}</h4>;
                               return <div key={lidx} className="text-slate-600 dark:text-slate-400 font-medium text-sm md:text-base leading-relaxed">{formatText(line)}</div>;
                             })}
                          </div>
                        </div>

                        {/* Risultato & Teoria Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-2 bg-emerald-500 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-500/20 border-4 border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-80">Risultato Finale</p>
                            <p className="text-3xl md:text-5xl font-black tracking-tighter">{p.structured.risultato}</p>
                          </div>
                          <button onClick={() => setExpandedTeoria(p.structured!.teoria)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 flex flex-col items-center justify-center hover:border-indigo-500 transition-all active:scale-95 group shadow-sm">
                            <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📘</div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vedi Teoria</span>
                          </button>
                        </div>

                        {/* Trucco Card */}
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-[2rem] p-6 md:p-8 flex gap-6 items-center">
                          <div className="text-4xl">💡</div>
                          <div>
                            <h4 className="text-amber-700 dark:text-amber-400 font-black text-[10px] uppercase tracking-widest mb-1">Il Trucco di Lav</h4>
                            <div className="text-amber-900 dark:text-amber-200 font-bold italic text-sm md:text-base">{formatText(p.structured.trucchi)}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="space-y-6">
                        {p.image && <img src={p.image} className="rounded-3xl max-h-[500px] w-full object-contain shadow-2xl border-8 border-white dark:border-slate-900" />}
                        {p.text && <div className="text-sm md:text-lg font-medium leading-relaxed">{formatText(p.text)}</div>}
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-4 py-12">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce delay-150"></div>
                  <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce delay-300"></div>
                </div>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.4em]">Calcolo in corso</span>
              </div>
            )}
            <div ref={chatEndRef} className="h-64" />
          </div>
        </main>

        {/* Input Bar - Floating Style */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
             {/* Simboli Quick Access */}
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-2">
              {['Δ', 'π', '√', '²', '³', '±', '÷', '×', '≠', '≤', '≥', 'x', 'y', '(', ')'].map(s => (
                <button key={s} onClick={() => {
                  const start = textareaRef.current?.selectionStart || 0;
                  const end = textareaRef.current?.selectionEnd || 0;
                  const newText = inputText.substring(0, start) + s + inputText.substring(end);
                  setInputText(newText);
                  setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.setSelectionRange(start+s.length, start+s.length); }, 0);
                }} className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-indigo-400 transition-all shadow-sm active:scale-90 backdrop-blur-md">{s}</button>
              ))}
            </div>

            <div className="glass border-2 border-slate-200/50 dark:border-slate-800/50 rounded-[2.5rem] p-3 shadow-2xl flex items-end gap-3 focus-within:border-indigo-500/50 transition-all">
              <button onClick={() => fileInputRef.current?.click()} className="p-4 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 dark:bg-slate-800/50 rounded-full active:scale-90 shadow-inner">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
              </button>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Incolla un'equazione o chiedimi aiuto..."
                className="flex-1 bg-transparent py-4 px-2 outline-none resize-none font-bold text-base text-slate-800 dark:text-white placeholder:text-slate-400"
                rows={1}
              />
              <input type="file" ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setSelectedImage(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }} className="hidden" accept="image/*" />
              <button onClick={handleSend} disabled={!inputText.trim() && !selectedImage} className="p-5 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-20 active:scale-95">
                <svg className="h-6 w-6 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
            {selectedImage && (
              <div className="mt-4 flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl border-2 border-indigo-500 shadow-xl w-fit">
                <img src={selectedImage} className="h-12 w-12 object-cover rounded-lg" />
                <span className="text-xs font-black uppercase text-indigo-600">Foto caricata!</span>
                <button onClick={() => setSelectedImage(null)} className="p-1 text-red-500">✕</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-[200] flex lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowMobileSidebar(false)}></div>
          <div className="relative w-80 h-full animate-in slide-in-from-left duration-500">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setShowSettings(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800">
            <h2 className="text-center font-black text-slate-800 dark:text-white uppercase tracking-[0.3em] text-xs mb-10">Preferenze Sito</h2>
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-white text-base">Modalità Notte</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Per studiare senza stancarti</p>
                </div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-16 h-9 rounded-full p-1 transition-colors duration-500 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <div className={`w-7 h-7 rounded-full bg-white shadow-xl transform transition-transform duration-500 ${isDarkMode ? 'translate-x-7' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => { if(confirm("Cancellare tutta la cronologia?")) { localStorage.removeItem('chatHistory'); setHistory([]); handleNewChat(); setShowSettings(false); }}} className="w-full py-4 text-red-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all uppercase tracking-widest">Svuota Archivio</button>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="mt-10 w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-xs rounded-3xl shadow-2xl active:scale-95 transition-all">Chiudi Impostazioni</button>
          </div>
        </div>
      )}

      {/* Theory Pop-up */}
      {expandedTeoria && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={() => setExpandedTeoria(null)}></div>
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] p-10 md:p-14 shadow-2xl overflow-y-auto no-scrollbar max-h-[85vh]">
            <button onClick={() => setExpandedTeoria(null)} className="absolute top-8 right-8 p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-slate-50 dark:bg-slate-800 rounded-full"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
            <h3 className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-10 text-center">Scheda Teorica</h3>
            <div className="text-lg md:text-2xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-center italic">{formatText(expandedTeoria)}</div>
            <button onClick={() => setExpandedTeoria(null)} className="mt-12 w-full py-5 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 transition-all uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/30">Ho capito, torniamo ai calcoli!</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
