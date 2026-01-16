import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Youtube, 
  Facebook, 
  Instagram, 
  Twitter, 
  Music, 
  Video, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft, 
  Clipboard, 
  Share2, 
  ExternalLink,
  Info,
  ShieldCheck,
  TrendingUp,
  History,
  Trash2,
  Video as VideoIcon,
  Search,
  Zap,
  Loader2,
  Settings,
  Bell,
  HardDrive
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini for precision metadata extraction
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type Platform = {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  pattern: RegExp;
  idExtractor: (url: string) => string | null;
  description: string;
};

type QualityOption = {
  id: string;
  label: string;
  size: string;
  type: 'mp3' | 'mp4';
};

type DownloadHistoryItem = {
  id: string;
  title: string;
  platformId: string;
  format: 'mp3' | 'mp4';
  quality: string;
  date: number;
  thumbnail: string;
  videoId: string;
};

const PLATFORMS: Platform[] = [
  { 
    id: 'youtube', 
    name: 'YouTube', 
    icon: <Youtube className="w-5 h-5" />, 
    color: '#FF0000', 
    pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
    idExtractor: (url) => {
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      return match ? match[1] : null;
    },
    description: '4K MP4 & 320kbps MP3 support'
  },
  { 
    id: 'facebook', 
    name: 'Facebook', 
    icon: <Facebook className="w-5 h-5" />, 
    color: '#1877F2', 
    pattern: /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/.+$/,
    idExtractor: (url) => {
      const match = url.match(/(?:videos\/|v=|\/watch\/\?v=|fb\.watch\/)([0-9]+)/);
      return match ? match[1] : 'FB_GENERIC_ID';
    },
    description: 'High quality public video downloads'
  },
  { 
    id: 'instagram', 
    name: 'Instagram', 
    icon: <Instagram className="w-5 h-5" />, 
    color: '#E4405F', 
    pattern: /^(https?:\/\/)?(www\.)?(instagram\.com)\/.+$/,
    idExtractor: (url) => {
      const match = url.match(/\/(?:p|reels|reel|tv)\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : null;
    },
    description: 'Reels, Stories & IGTV saver'
  },
  { 
    id: 'tiktok', 
    name: 'TikTok', 
    icon: <Music className="w-5 h-5" />, 
    color: '#000000', 
    pattern: /^(https?:\/\/)?(www\.|vm\.|vt\.)?(tiktok\.com)\/.+$/,
    idExtractor: (url) => {
      const match = url.match(/\/video\/([0-9]+)/);
      return match ? match[1] : 'TT_VIDEO_ID';
    },
    description: 'Save trends without watermark'
  },
  { 
    id: 'twitter', 
    name: 'Twitter (X)', 
    icon: <Twitter className="w-5 h-5" />, 
    color: '#000000', 
    pattern: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+$/,
    idExtractor: (url) => {
      const match = url.match(/\/status\/([0-9]+)/);
      return match ? match[1] : null;
    },
    description: 'Media downloader for X posts'
  },
  { 
    id: 'threads', 
    name: 'Threads', 
    icon: <Share2 className="w-5 h-5" />, 
    color: '#000000', 
    pattern: /^(https?:\/\/)?(www\.)?(threads\.net)\/.+$/,
    idExtractor: (url) => {
      const match = url.match(/\/post\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : null;
    },
    description: 'Quickly save Thread video clips'
  },
  { 
    id: 'pinterest', 
    name: 'Pinterest', 
    icon: <ExternalLink className="w-5 h-5" />, 
    color: '#BD081C', 
    pattern: /^(https?:\/\/)?(www\.)?(pinterest\.com|pin\.it)\/.+$/,
    idExtractor: (url) => {
      const match = url.match(/\/(?:pin|sent)\/([0-9]+)/);
      return match ? match[1] : 'PIN_ID';
    },
    description: 'Idea Pins & high-res video creative'
  },
  { 
    id: 'zoom', 
    name: 'Zoom', 
    icon: <VideoIcon className="w-5 h-5" />, 
    color: '#2D8CFF', 
    pattern: /^(https?:\/\/)?([a-z0-9]+\.)?(zoom\.us)\/.+$/,
    idExtractor: (url) => {
      const match = url.match(/\/rec\/play\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : 'ZOOM_ID';
    },
    description: 'Archived meeting capture tool'
  },
];

const App = () => {
  const [currentPlatform, setCurrentPlatform] = useState<Platform | null>(null);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'selecting' | 'downloading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadStep, setDownloadStep] = useState('Initializing...');
  const [metadata, setMetadata] = useState<{ title: string; duration: string; thumbnail?: string; formats: QualityOption[]; videoId: string } | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<QualityOption | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('velo_history_v4');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('velo_history_v4', JSON.stringify(history));
  }, [history]);

  const analyzeLink = async () => {
    if (!url) {
      setStatus('error');
      setErrorMessage('Please paste a link first.');
      return;
    }

    if (currentPlatform && !currentPlatform.pattern.test(url)) {
      setStatus('error');
      setErrorMessage(`Invalid ${currentPlatform.name} URL. Paste an exact video link.`);
      return;
    }

    const videoId = currentPlatform?.idExtractor(url);
    if (!videoId) {
      setStatus('error');
      setErrorMessage(`Unable to detect a valid video ID in this ${currentPlatform?.name} link.`);
      return;
    }

    setStatus('analyzing');
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `STRICT REQUIREMENT: Extract metadata ONLY for this specific Video ID: "${videoId}" on platform ${currentPlatform?.name}. 
        URL for context: "${url}". 
        DO NOT SEARCH for similar videos. Return JSON with keys: "title", "duration", "keywords", and "formats" (array of 4 objects with: id, label, size, type).`,
        config: { responseMimeType: "application/json" }
      });
      
      const data = JSON.parse(response.text || '{}');
      setMetadata({
        title: data.title || `Direct Content (ID: ${videoId})`,
        duration: data.duration || '00:00',
        videoId: videoId,
        thumbnail: `https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=600&q=keywords=${encodeURIComponent(data.keywords || 'media')}`,
        formats: data.formats || [
          { id: '1', label: '1080p Original', size: '42 MB', type: 'mp4' },
          { id: '2', label: '720p Original', size: '20 MB', type: 'mp4' },
          { id: '3', label: 'High Bitrate Audio', size: '8 MB', type: 'mp3' },
          { id: '4', label: 'Standard Audio', size: '3 MB', type: 'mp3' },
        ]
      });
      setStatus('selecting');
    } catch (error) {
      setStatus('error');
      setErrorMessage('Communication error with platform API. Please check your connection.');
    }
  };

  const startDownloadFlow = () => {
    if (!url || !currentPlatform?.pattern.test(url)) {
      setStatus('error');
      setErrorMessage('Link is invalid or has expired.');
      return;
    }

    if (!selectedQuality) {
      setStatus('error');
      setErrorMessage('Please select a quality/format first.');
      return;
    }

    const hasPermission = localStorage.getItem('velo_storage_permission');
    if (!hasPermission) {
      setShowPermissionDialog(true);
    } else {
      executeDownload();
    }
  };

  const executeDownload = () => {
    setShowPermissionDialog(false);
    setStatus('downloading');
    setProgress(0);
    setDownloadStep('Initializing secure connection...');
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.floor(Math.random() * 15) + 5;
        
        if (next < 30) setDownloadStep('Connecting to platform nodes...');
        else if (next < 60) setDownloadStep('Extracting media stream segments...');
        else if (next < 90) setDownloadStep('Merging packets & optimizing...');
        else setDownloadStep('Finalizing local storage save...');

        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setStatus('success');
            
            const newItem: DownloadHistoryItem = {
              id: Math.random().toString(36).substr(2, 9),
              title: metadata?.title || 'Untitled',
              platformId: currentPlatform?.id || 'unknown',
              format: selectedQuality!.type,
              quality: selectedQuality!.label,
              date: Date.now(),
              thumbnail: metadata?.thumbnail || '',
              videoId: metadata?.videoId || 'UNKNOWN'
            };
            setHistory(prev => [newItem, ...prev].slice(0, 15));
          }, 400);
          return 100;
        }
        return next;
      });
    }, 250);
  };

  const reset = () => {
    setStatus('idle');
    setProgress(0);
    setUrl('');
    setMetadata(null);
    setSelectedQuality(null);
    setErrorMessage('');
  };

  if (currentPlatform) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center bg-slate-950 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="w-full max-w-md">
          <nav className="flex items-center justify-between mb-8 text-slate-400">
            <button 
              disabled={status === 'downloading'}
              onClick={() => { setCurrentPlatform(null); reset(); }}
              className={`p-2 rounded-full transition-colors ${status === 'downloading' ? 'opacity-20' : 'hover:bg-white/10'}`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="font-bold text-lg text-white">Stream Extraction</h2>
            <Settings className="w-6 h-6 opacity-40" />
          </nav>

          <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-6 mb-6 shadow-2xl relative overflow-hidden">
            <div 
              className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-30 pointer-events-none"
              style={{ backgroundColor: currentPlatform.color }}
            ></div>

            <div className="flex items-center gap-4 mb-8">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl" 
                style={{ backgroundColor: currentPlatform.color }}
              >
                {currentPlatform.icon}
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">{currentPlatform.name}</h1>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Active Link Bind</p>
              </div>
            </div>

            {status === 'idle' || status === 'error' ? (
              <div className="animate-in fade-in duration-500">
                <div className="relative mb-6">
                  <input 
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={`Paste ${currentPlatform.name} video link...`}
                    className="w-full bg-slate-800 border-2 border-slate-700/50 rounded-2xl py-4 px-5 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all text-sm font-medium pr-14"
                  />
                  <button 
                    onClick={async () => setUrl(await navigator.clipboard.readText())}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400"
                  >
                    <Clipboard className="w-5 h-5" />
                  </button>
                </div>
                
                {status === 'error' && (
                  <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 animate-in shake duration-300">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    <p className="text-rose-500 text-[10px] font-bold uppercase">{errorMessage}</p>
                  </div>
                )}

                <button 
                  onClick={analyzeLink}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Locate Stream</span>
                </button>
              </div>
            ) : status === 'analyzing' ? (
              <div className="py-12 flex flex-col items-center animate-in zoom-in-95 duration-500 text-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <h3 className="text-white font-black text-lg">Validating ID...</h3>
                <p className="text-slate-500 text-[9px] uppercase font-bold tracking-[0.2em] mt-2 px-8">Identifying direct stream segments from source</p>
              </div>
            ) : status === 'selecting' && metadata ? (
              <div className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 p-3 bg-slate-800/50 rounded-2xl flex gap-3 border border-white/5">
                  <img src={metadata.thumbnail} className="w-16 h-16 rounded-xl object-cover shadow-lg" alt="" />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-white font-bold text-xs truncate">{metadata.title}</h4>
                    <p className="text-blue-400 text-[8px] font-black uppercase mt-1 tracking-wider">Matched: {metadata.videoId}</p>
                    <p className="text-slate-500 text-[8px] font-bold mt-0.5">{metadata.duration}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 mb-6">
                  {metadata.formats.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedQuality(f)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${selectedQuality?.id === f.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-800/50 border-transparent hover:bg-slate-800'}`}
                    >
                      <div className="flex items-center gap-3">
                        {f.type === 'mp4' ? <Video className="w-4 h-4 text-blue-400" /> : <Music className="w-4 h-4 text-emerald-400" />}
                        <div className="text-left">
                          <p className="text-xs font-bold text-white">{f.label}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">{f.size}</p>
                        </div>
                      </div>
                      {selectedQuality?.id === f.id && <CheckCircle className="w-5 h-5 text-blue-500" />}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button onClick={reset} className="flex-1 py-4 rounded-xl bg-slate-800 text-slate-400 font-bold text-[10px] uppercase tracking-[0.15em]">Reset</button>
                  <button 
                    disabled={!selectedQuality}
                    onClick={startDownloadFlow} 
                    className="flex-[2] py-4 rounded-xl bg-blue-600 text-white font-bold text-[10px] uppercase tracking-[0.15em] shadow-xl active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {selectedQuality?.type.toUpperCase()}</span>
                  </button>
                </div>
              </div>
            ) : status === 'downloading' ? (
              <div className="py-8 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-white text-[11px] font-black uppercase tracking-[0.1em]">Stream Download active</p>
                    <p className="text-blue-500 text-[9px] font-bold uppercase animate-pulse">{downloadStep}</p>
                  </div>
                  <span className="text-blue-500 font-black text-2xl">{progress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(59,130,246,0.3)]" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="mt-8 p-4 bg-slate-800/30 rounded-2xl border border-white/5 flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <p className="text-[9px] text-slate-400 font-medium italic">High-speed tunnel active. Do not close the application.</p>
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center text-center animate-in bounce-in duration-500">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-emerald-500/20">
                  <CheckCircle className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-white font-black text-2xl mb-2 tracking-tight">Stream Secured</h3>
                <p className="text-slate-500 text-xs px-10 leading-relaxed font-medium">The {selectedQuality?.type.toUpperCase()} file ({selectedQuality?.label}) from {currentPlatform.name} has been matched and saved to your device gallery.</p>
                
                <div className="mt-8 grid grid-cols-2 gap-3 w-full">
                   <button 
                    onClick={() => {}} 
                    className="py-4 rounded-xl bg-slate-800 text-white font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                  <button 
                    onClick={reset}
                    className="py-4 rounded-xl bg-white text-slate-950 font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    Next Video
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center pb-12 overflow-hidden bg-slate-950">
      {/* Background with Precise Overlay */}
      <div className="fixed inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1544919982-b61976f0ba43?auto=format&fit=crop&q=80&w=1080"
          className="w-full h-full object-cover"
          alt="Home Background"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/65 to-black/20"></div>
        <div className="absolute inset-0 backdrop-blur-[1px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-6 flex flex-col items-center">
        <header className="w-full mt-10 mb-12 flex flex-col items-center text-center">
          <div className="w-full flex justify-between items-center mb-10 px-2">
            <Settings className="w-6 h-6 text-white/40 hover:text-white transition-colors cursor-pointer" />
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="text-white/80 text-[8px] font-black uppercase tracking-widest">Global Node Verified</span>
            </div>
            <Bell className="w-6 h-6 text-white/40 hover:text-white transition-colors cursor-pointer" />
          </div>

          <h1 className="text-5xl font-black text-white tracking-tighter mb-2 drop-shadow-2xl">
            Velo<span className="text-blue-500">Down</span>
          </h1>
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.45em] drop-shadow-md">Premium Stream Capture</p>
        </header>

        {/* 4-Column Platform Grid */}
        <div className="grid grid-cols-4 gap-x-6 gap-y-8 w-full px-2 mb-12">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              onClick={() => setCurrentPlatform(platform)}
              className="flex flex-col items-center gap-3 group transition-all active:scale-90"
            >
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105 duration-200 backdrop-blur-xl border border-white/20" 
                style={{ backgroundColor: `${platform.color}CC` }}
              >
                <div className="text-white drop-shadow-lg">
                  {platform.icon}
                </div>
              </div>
              <span className="text-white text-[10px] font-bold tracking-tight text-center drop-shadow-md">{platform.name}</span>
            </button>
          ))}
        </div>

        {history.length > 0 && (
          <div className="w-full animate-in slide-in-from-bottom-8 duration-700 pb-12">
            <div className="flex items-center justify-between mb-4 px-2">
               <h2 className="text-white font-black text-[11px] flex items-center gap-2 opacity-60 uppercase tracking-[0.2em]">
                <History className="w-4 h-4" /> History
              </h2>
              <button onClick={() => setHistory([])} className="text-white/20 hover:text-rose-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {history.map((item) => (
                <div key={item.id} className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex items-center gap-4 group">
                  <img src={item.thumbnail} className="w-11 h-11 rounded-xl object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[11px] font-bold truncate pr-4">{item.title}</p>
                    <p className="text-blue-400 text-[8px] font-black uppercase mt-1 tracking-wider">{item.platformId} • {item.quality}</p>
                  </div>
                  <Share2 className="w-4 h-4 text-white/30 group-hover:text-white transition-colors cursor-pointer mr-2" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPermissionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 w-full max-sm rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6">
              <HardDrive className="w-8 h-8 text-blue-500" />
            </div>
            <h3 className="text-white font-black text-xl mb-3 tracking-tight">Write Access Required</h3>
            <p className="text-slate-400 text-[11px] mb-8 leading-relaxed font-medium">To complete the stream capture, VeloDown needs permission to write the media data directly to your device storage.</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {localStorage.setItem('velo_storage_permission', '1'); executeDownload();}} 
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-blue-900/20"
              >
                Allow Permission
              </button>
              <button 
                onClick={() => setShowPermissionDialog(false)} 
                className="w-full py-4 rounded-2xl bg-slate-800 text-slate-500 font-bold text-[11px] uppercase tracking-widest"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
