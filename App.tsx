
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
      parts: [{ text: "Ciao! 👋 Sono MatemAI-tica Lav, il tuo tutor personale. Come posso aiutarti oggi con la matematica? 📝" }],
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTeoria, setExpandedTeoria] = useState<string | null>(null);
  const [showQuaderno, setShowQuaderno] = useState<string | null>(null);
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
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (messages.length > 1) {
      const updatedHistory = [...history];
      const sessionIndex = updatedHistory.findIndex(s => s.id === currentSessionId);
      const firstUserMsg = messages.find(m => m.role === Role.USER)?.parts.find(p => p.text)?.text || "Conversazione";
      const title = firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + "..." : firstUserMsg;

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
      parts: [{ text: "Ciao! 👋 Nuova sessione avviata. Cosa risolviamo oggi?" }],
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
    const shareData = {
      title: 'MatemAI-tica Lav',
      text: 'Usa questo tutor di matematica AI per risolvere i tuoi esercizi!',
      url: window.location.origin + window.location.pathname
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (err) {
      console.error('Errore durante la condivisione:', err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSymbolClick = (symbol: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return setInputText(prev => prev + symbol);
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = inputText.substring(0, start) + symbol + inputText.substring(end);
    setInputText(newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + symbol.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
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
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/([Δπ√±∞≈≠≤≥²³÷×→⇒])/g, '<span class="font-bold text-indigo-600 dark:text-indigo-400">$1</span>');
      return <p key={idx} className="mb-1" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800">
      <div className="p-4">
        <button onClick={handleNewChat} className="w-full p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuova Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 mb-2">Cronologia Recente</p>
        {history.length === 0 ? (
          <p className="text-center text-slate-400 text-xs py-10 italic">Nessuna chat salvata</p>
        ) : (
          history.map(session => (
            <div 
              key={session.id} 
              onClick={() => loadSession(session)}
              className={`group relative p-3 rounded-xl transition-all cursor-pointer ${currentSessionId === session.id ? 'bg-white dark:bg-slate-800 border-2 border-indigo-500/30 shadow-sm' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/30 border-2 border-transparent'}`}
            >
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-6">{session.title}</p>
              <button onClick={(e) => deleteSession(e, session.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))
        )}
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button onClick={handleShare} className="w-full p-3 flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/30 rounded-xl transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          <span className="text-sm font-bold">Condividi Sito</span>
        </button>
        <button onClick={() => setShowSettings(true)} className="w-full p-3 flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/30 rounded-xl transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-sm font-bold">Impostazioni</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark bg-slate-950' : 'bg-white'} transition-colors duration-300 overflow-hidden font-jakarta`}>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm animate-in fade-in slide-in-from-top-4 duration-300 border border-slate-700">
          Link copiato negli appunti! 🔗
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className="hidden md:block w-72 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 relative">
        {/* Header Mobile & Desktop Title */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowMobileSidebar(true)} className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">π</div>
              <h1 className="font-extrabold text-slate-900 dark:text-white text-sm md:text-lg tracking-tight">MatemAI-tica <span className="text-indigo-600 dark:text-indigo-400">Lav</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleShare} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Condividi sito">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
            <span className="hidden sm:inline-block text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.3em]">AI Tutor Online</span>
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-10">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[90%] md:max-w-[85%] ${msg.role === Role.USER ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-3xl rounded-tr-sm p-4 md:p-6 shadow-sm border border-slate-200 dark:border-slate-700' : 'w-full space-y-6'}`}>
                  {msg.parts.map((p, i) => (
                    p.structured ? (
                      <div key={i} className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 md:p-8 shadow-sm">
                          <h3 className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-5 h-[2px] bg-indigo-100 dark:bg-indigo-900"></span> RISOLUZIONE DETTAGLIATA</h3>
                          <div className="text-lg md:text-xl font-bold text-slate-800 dark:text-white mb-6 leading-tight">{formatText(p.structured.esercizio)}</div>
                          <div className="space-y-4 prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
                             {p.structured.spiegazione.split('\n').map((line, lidx) => {
                               const lower = line.trim().toLowerCase();
                               if (lower.startsWith('calcolo:')) return <div key={lidx} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 text-2xl md:text-3xl font-black text-center my-4 tracking-tighter text-slate-900 dark:text-white">{line.replace(/calcolo:/i, '').trim()}</div>;
                               if (lower.startsWith('passaggio')) return <h4 key={lidx} className="text-indigo-500 font-bold text-xs uppercase tracking-wider mt-8 mb-2">{line}</h4>;
                               return <div key={lidx}>{formatText(line)}</div>;
                             })}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="sm:col-span-2 bg-emerald-500 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Risultato Finale</p>
                            <p className="text-2xl md:text-3xl font-bold tracking-tight">{p.structured.risultato}</p>
                          </div>
                          <button onClick={() => setExpandedTeoria(p.structured!.teoria)} className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-indigo-500 transition-all active:scale-95 group">
                            <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📖</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teoria</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="space-y-4">
                        {p.image && <img src={p.image} className="rounded-2xl max-h-80 object-contain shadow-md border border-slate-100 dark:border-slate-800" />}
                        {p.text && <div className="text-sm md:text-base font-medium leading-relaxed">{formatText(p.text)}</div>}
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-3 text-indigo-600 animate-pulse">
                <div className="w-2 h-2 bg-current rounded-full"></div>
                <div className="w-2 h-2 bg-current rounded-full delay-75"></div>
                <div className="w-2 h-2 bg-current rounded-full delay-150"></div>
                <span className="text-xs font-black uppercase tracking-widest ml-2">Analisi in corso...</span>
              </div>
            )}
            <div ref={chatEndRef} className="h-40" />
          </div>
        </main>

        {/* Floating Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-white dark:from-slate-950 via-white/90 dark:via-slate-950/90 to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <div className="flex gap-1 overflow-x-auto pb-3 no-scrollbar">
              {['Δ', 'π', '√', '²', '³', '±', '÷', '×', '≠', 'x', 'y', '(', ')'].map(s => (
                <button key={s} onClick={() => handleSymbolClick(s)} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition-all active:scale-90 shadow-sm">{s}</button>
              ))}
            </div>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2rem] blur opacity-10 group-focus-within:opacity-30 transition duration-500"></div>
              <div className="relative flex items-end gap-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-2 rounded-[2rem] shadow-2xl focus-within:border-indigo-500 transition-all">
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 dark:bg-slate-800 rounded-full active:scale-90">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                </button>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="Scrivi l'esercizio o incolla una domanda..."
                  className="flex-1 bg-transparent py-3 outline-none resize-none font-medium text-sm md:text-base text-slate-800 dark:text-white placeholder:text-slate-400"
                  rows={1}
                />
                <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                <button onClick={handleSend} disabled={!inputText.trim() && !selectedImage} className="p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-20 active:scale-95">
                  <svg className="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileSidebar(false)}></div>
          <div className="relative w-72 h-full animate-in slide-in-from-left duration-300">
            <SidebarContent />
            <button onClick={() => setShowMobileSidebar(false)} className="absolute top-4 right-[-3rem] p-2 text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSettings(false)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-center font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] text-xs mb-8">Personalizzazione Sito</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-white text-sm">Tema Scuro</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Per studiare di notte</p>
                </div>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => { if(confirm("Cancellare la cronologia?")) { localStorage.removeItem('chatHistory'); setHistory([]); handleNewChat(); setShowSettings(false); }}} className="w-full py-3 text-red-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all uppercase tracking-widest">Svuota Memoria</button>
              </div>
            </div>
            <button onClick={() => setShowSettings(false)} className="mt-8 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl">Salva & Chiudi</button>
          </div>
        </div>
      )}

      {/* Theory Pop-up */}
      {expandedTeoria && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-in zoom-in duration-200">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setExpandedTeoria(null)}></div>
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl max-h-[80vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setExpandedTeoria(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
            <h3 className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-center">Approfondimento Teorico</h3>
            <div className="text-lg md:text-xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-center">{formatText(expandedTeoria)}</div>
            <button onClick={() => setExpandedTeoria(null)} className="mt-10 w-full py-4 border-2 border-slate-100 dark:border-slate-800 text-slate-400 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all uppercase text-[10px] tracking-widest">Torna all'Esercizio</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
