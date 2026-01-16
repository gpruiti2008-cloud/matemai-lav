
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
      parts: [{ text: "Ciao! 👋 Sono MatemAI-tica Lav, il tuo tutor personale. Inviami un esercizio e lo risolveremo insieme passo dopo passo! 📝" }],
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTeoria, setExpandedTeoria] = useState<string | null>(null);
  const [showQuaderno, setShowQuaderno] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [history, setHistory] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => Date.now().toString());
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevGuide, setShowDevGuide] = useState(false);

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
      
      const firstUserMsg = messages.find(m => m.role === Role.USER)?.parts.find(p => p.text)?.text || "Nuova conversazione";
      const title = firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + "..." : firstUserMsg;

      if (sessionIndex >= 0) {
        updatedHistory[sessionIndex] = {
          ...updatedHistory[sessionIndex],
          messages,
          lastTimestamp: new Date()
        };
      } else {
        updatedHistory.unshift({
          id: currentSessionId,
          title,
          messages,
          lastTimestamp: new Date()
        });
      }
      setHistory(updatedHistory);
      localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleNewChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: Role.BOT,
        parts: [{ text: "Ciao! 👋 Sono MatemAI-tica Lav. Cominciamo un nuovo esercizio! 📝" }],
        timestamp: new Date()
      }
    ]);
    setCurrentSessionId(Date.now().toString());
    setShowHistory(false);
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setShowHistory(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(s => s.id !== id);
    setHistory(updated);
    localStorage.setItem('chatHistory', JSON.stringify(updated));
    if (currentSessionId === id) {
      handleNewChat();
    }
  };

  const handleDownloadApp = async () => {
    const url = window.location.href;
    
    if (url.startsWith('blob:') || url.includes('usercontent.goog')) {
      alert("⚠️ Attenzione: Sei in una modalità 'Anteprima'.\n\nPer installare l'app:\n1. Pubblica l'app su GitHub Pages.\n2. Apri l'indirizzo pubblico (es. github.io).\n3. Clicca su 'Aggiungi a schermata Home'.");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'MatemAI-tica Lav',
          text: 'Usa il mio tutor di matematica personale!',
          url: url,
        });
      } catch (err) {
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('Link copiato! 🚀\n\nIncollalo in Chrome o Safari e seleziona "Aggiungi a schermata Home" per installarla.');
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
    if (!textarea) {
      setInputText(prev => prev + symbol);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = inputText;
    const newText = text.substring(0, start) + symbol + text.substring(end);
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
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.BOT,
        parts: typeof result === 'string' ? [{ text: result }] : [{ structured: result }],
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      if (currentRequestId === requestIdRef.current) setIsLoading(false);
    }
  };

  const formatText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/([Δπ√±∞≈≠≤≥²³÷×→⇒])/g, '<span class="font-bold text-indigo-700 dark:text-indigo-400">$1</span>');
      return <p key={idx} className="mb-1" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  const formatSpiegazione = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const lower = line.trim().toLowerCase();
      if (lower.startsWith('passaggio')) {
        return <div key={idx} className="mt-5 mb-2 text-indigo-500 dark:text-indigo-400 font-bold text-[9px] uppercase tracking-widest flex items-center gap-2">
          <div className="h-[1px] flex-1 bg-indigo-50 dark:bg-indigo-900/30"></div>{line}<div className="h-[1px] flex-1 bg-indigo-50 dark:bg-indigo-900/30"></div>
        </div>;
      }
      if (lower.startsWith('nota:')) {
        return <div key={idx} className="bg-slate-50 dark:bg-slate-800 border-l-4 border-slate-300 dark:border-slate-600 p-3 rounded-r-xl mb-2 text-slate-700 dark:text-slate-300 text-sm font-medium">
          <span className="font-bold mr-1">Nota:</span>{line.replace(/nota:/i, '').trim()}
        </div>;
      }
      if (lower.startsWith('formula:')) {
        return <div key={idx} className="text-indigo-600 dark:text-indigo-400 font-bold text-[9px] bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg w-fit mb-1 border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-1.5">
          <span className="text-xs">📐</span> {line.replace(/formula:/i, '').trim()}
        </div>;
      }
      if (lower.startsWith('calcolo:')) {
        return <div key={idx} className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 p-3 md:p-4 rounded-2xl my-2 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center tracking-tight">
          {line.replace(/calcolo:/i, '').trim()}
        </div>;
      }
      if (line.trim() === "") return <div key={idx} className="h-1"></div>;
      return <div key={idx} className="text-slate-600 dark:text-slate-400 font-medium text-xs md:text-sm mb-1 px-1">{formatText(line)}</div>;
    });
  };

  return (
    <div className={`flex flex-col h-screen ${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'} overflow-hidden font-jakarta transition-colors duration-300`}>
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm z-40">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => setShowHistory(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <span className="text-lg font-bold">π</span>
            </div>
            <div className="hidden xs:block">
              <h1 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">MatemAI-tica <span className="text-indigo-600 dark:text-indigo-400">Lav</span></h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase">Chiaro & Veloce</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={handleDownloadApp}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-full shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden xs:inline text-[10px] font-black uppercase tracking-tight">Installa</span>
          </button>
          
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
          <div className="relative w-4/5 max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-500">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <h2 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Cronologia</h2>
              <button onClick={() => setShowHistory(false)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-2 bg-white dark:bg-slate-900">
              <button onClick={handleNewChat} className="w-full p-4 mb-4 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Nuova Chat
              </button>
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <span className="text-4xl mb-4">📖</span>
                  <p className="text-center text-slate-400 text-sm">Nessuna chat salvata</p>
                </div>
              ) : (
                history.map(session => (
                  <div 
                    key={session.id} 
                    onClick={() => loadSession(session)}
                    className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer ${currentSessionId === session.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                  >
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate pr-6">{session.title}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">{new Date(session.lastTimestamp).toLocaleDateString()}</p>
                    <button 
                      onClick={(e) => deleteSession(e, session.id)}
                      className="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSettings(false)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-center font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] text-xs mb-8">Impostazioni</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-white text-sm">Tema Scuro</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Riposa gli occhi</p>
                </div>
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setShowDevGuide(true)}
                  className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center justify-center gap-2 rounded-xl transition-all active:scale-95"
                >
                  🚀 Guida Pubblicazione & APK
                </button>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => {
                    if(confirm("Vuoi davvero cancellare tutta la cronologia?")) {
                      localStorage.removeItem('chatHistory');
                      setHistory([]);
                      handleNewChat();
                      setShowSettings(false);
                    }
                  }}
                  className="w-full py-3 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                >
                  Cancella Cronologia
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowSettings(false)}
              className="mt-8 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl active:scale-95 transition-all"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Dev Guide Modal */}
      {showDevGuide && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" onClick={() => setShowDevGuide(false)}></div>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[85vh]">
            <h2 className="text-indigo-600 font-black uppercase tracking-[0.2em] text-xs mb-6">Come pubblicare & ottenere l'APK</h2>
            
            <div className="space-y-6 text-slate-700 dark:text-slate-300">
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><span>1.</span> GitHub Pages (Hosting)</h3>
                <p className="text-xs leading-relaxed">Crea un repo su GitHub, carica i file e attiva <strong>GitHub Pages</strong> nelle impostazioni del repository. Avrai un link HTTPS pubblico (es. tuo-utente.github.io/app).</p>
              </section>

              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><span>2.</span> Ottenere l'APK (Android)</h3>
                <p className="text-xs leading-relaxed">Vai su <strong>PWABuilder.com</strong>, incolla l'URL della tua app GitHub e clicca su "Package for Store" > "Android". Ti genererà un pacchetto con l'APK pronto per l'installazione.</p>
              </section>

              <section className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <h3 className="font-bold text-amber-700 dark:text-amber-400 text-xs mb-1 flex items-center gap-2">⚠️ Nota Importante</h3>
                <p className="text-[10px] leading-relaxed italic">L'APK è solo un "contenitore". Se aggiorni il codice su GitHub, l'APK si aggiornerà automaticamente sul telefono senza doverne creare uno nuovo ogni volta!</p>
              </section>
            </div>

            <button 
              onClick={() => setShowDevGuide(false)}
              className="mt-8 w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl active:scale-95 transition-all"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 no-scrollbar pb-64">
        <div className="max-w-4xl ml-0 mr-auto space-y-6 w-full lg:w-4/5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === Role.USER ? 'items-end' : 'items-start'} gap-3 animate-in slide-in-from-bottom-4 duration-500`}>
              {msg.role === Role.USER ? (
                <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl rounded-tr-none p-4 shadow-lg max-w-[90%] border-2 border-slate-800 dark:border-slate-700">
                  {msg.parts.map((p, i) => (
                    <div key={i} className="space-y-2">
                      {p.image && <img src={p.image} className="rounded-xl w-full max-h-64 object-contain bg-white/10" />}
                      {p.text && <p className="text-sm md:text-base font-bold leading-tight">{p.text}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full space-y-5">
                  {msg.parts.map((p, i) => (
                    p.structured ? (
                      <div key={i} className="space-y-5 animate-in fade-in duration-500">
                        <div className="bg-indigo-600 rounded-3xl p-5 md:p-6 shadow-lg relative overflow-hidden text-white border-4 border-indigo-500/20">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-3xl"></div>
                          <h3 className="text-indigo-200 text-[8px] font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-2">ESERCIZIO</h3>
                          <div className="text-lg md:text-xl font-bold leading-tight relative z-10">{formatText(p.structured.esercizio)}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm">
                          <h3 className="text-indigo-50 dark:text-indigo-400 text-[8px] font-black uppercase tracking-[0.2em] mb-3">SPIEGAZIONE PASSO-PASSO</h3>
                          <div className="space-y-1">{formatSpiegazione(p.structured.spiegazione)}</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-emerald-500 rounded-3xl p-5 shadow-md text-white flex flex-col items-center justify-center border-4 border-emerald-400/20">
                            <h3 className="text-emerald-100 text-[8px] font-black uppercase tracking-[0.2em] mb-1">RISULTATO</h3>
                            <div className="text-2xl md:text-3xl font-bold tracking-tight">{formatText(p.structured.risultato)}</div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button onClick={() => setShowQuaderno(p.structured!.quaderno)} className="flex-1 p-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500 transition-all flex items-center gap-3 active:scale-95">
                              <span className="text-xl">📝</span>
                              <div className="text-left"><p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Quaderno</p><p className="text-xs font-bold text-slate-800 dark:text-white">Solo calcoli</p></div>
                            </button>
                            <button onClick={() => setExpandedTeoria(p.structured!.teoria)} className="flex-1 p-3 bg-indigo-600 text-white rounded-2xl shadow-md hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95">
                              <span className="text-xl">📖</span>
                              <div className="text-left"><p className="text-[8px] font-black uppercase tracking-widest text-indigo-300">Teoria</p><p className="text-xs font-bold">Leggi spiegazione</p></div>
                            </button>
                          </div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-100 dark:border-amber-900/30 rounded-3xl p-4 md:p-5 shadow-sm">
                          <h3 className="text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase tracking-[0.2em] mb-1 flex items-center gap-2">💡 TRUCCO PRATICO</h3>
                          <div className="text-amber-900 dark:text-amber-200 text-xs md:text-sm font-bold italic">{formatText(p.structured.trucchi)}</div>
                        </div>
                        {expandedTeoria && (
                          <div className="fixed inset-0 bg-slate-900/90 dark:bg-black/95 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
                            <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl relative">
                              <button onClick={() => setExpandedTeoria(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 p-2 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                              <h3 className="text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest mb-4 text-center">APPROFONDIMENTO</h3>
                              <div className="text-base md:text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-center">{formatText(expandedTeoria)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div key={i} className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 shadow-sm text-slate-800 dark:text-slate-200 max-w-[90%] font-medium text-sm md:text-base">
                        {formatText(p.text || '')}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="py-6 flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-indigo-900 dark:text-indigo-400 font-bold uppercase tracking-widest text-[8px]">Elaborazione...</p>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      {showQuaderno && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-[80vh] rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-500">
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#4a90e2 1px, transparent 1px), linear-gradient(90deg, #4a90e2 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
            <div className="absolute left-8 top-0 bottom-0 w-[2px] bg-red-100 dark:bg-red-900/30 pointer-events-none"></div>
            <header className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-3"><span>✏️</span> Quaderno</h2>
              <button onClick={() => setShowQuaderno(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 md:p-12 relative z-10 space-y-6 no-scrollbar">
              {showQuaderno.split('\n').map((line, idx) => (
                <div key={idx} className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white tracking-tight pl-4 border-b border-slate-50 dark:border-slate-800 pb-2">{line}</div>
              ))}
              <div className="h-20"></div>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-100 dark:border-slate-800 p-4 md:p-6 fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar px-1">
            {['Δ', 'π', '√', '²', '³', '±', '÷', '×', '≠', '≤', '≥', '≈', '→', 'x', 'y', '(', ')'].map(s => (
              <button key={s} onClick={() => handleSymbolClick(s)} className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-90 shadow-sm">{s}</button>
            ))}
          </div>
          <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 p-2 rounded-[2rem] focus-within:border-indigo-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all shadow-xl group">
            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all bg-white dark:bg-slate-800 rounded-full shadow-sm active:scale-90 border border-slate-100 dark:border-slate-700"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg></button>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Esercizio o domanda..."
              className="flex-1 bg-transparent py-3 outline-none resize-none font-bold text-sm md:text-base text-slate-800 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
              rows={1}
              disabled={isLoading}
            />
            <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
            <button onClick={() => handleSend()} disabled={!inputText.trim() && !selectedImage} className="p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-20 active:scale-90 flex items-center justify-center"><svg className="h-5 w-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
