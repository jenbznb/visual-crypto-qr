import { useState, useEffect, useRef } from 'react';
import { Layers, ShieldCheck, Download, Move, CheckCircle2, Lock, Unlock, Camera, X, ScanLine, Printer, History, Trash2, Copy, Search, Save, Key, Database, Loader2, Edit3 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// --- 工具函数 ---
const resizeImage = (file, targetWidth = 1000) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const scale = targetWidth / img.width;
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png', 1.0));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

const getApiUrl = (endpoint) => {
  const hostname = window.location.hostname;
  if (hostname.includes('localhost')) return `http://localhost:8000${endpoint}`;
  return `https://vc-api.115333.xyz${endpoint}`; // 根据你的实际后端调整
};

// ================= 主应用 =================
export default function App() {
  const [activeTab, setActiveTab] = useState('encrypt');

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto font-sans text-slate-100 pb-20">
      <header className="mb-8 text-center no-print">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-3 text-indigo-400 mb-2">
          <ShieldCheck size={40} /> Visual Crypto QR
        </h1>
        <p className="text-slate-400 text-sm">混合加密架构 (方案 C) - 物理授权与数字解密</p>
      </header>

      <div className="flex p-1 bg-slate-800 rounded-xl mb-8 border border-slate-700 no-print">
        <button onClick={() => setActiveTab('encrypt')} className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${activeTab === 'encrypt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
          <Lock size={18} /> 加密分发
        </button>
        <button onClick={() => setActiveTab('decrypt')} className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${activeTab === 'decrypt' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
          <Unlock size={18} /> 协同解密
        </button>
      </div>

      <div className="w-full animate-fade-in">
        {activeTab === 'encrypt' ? <EncryptView /> : <DecryptView />}
      </div>
    </div>
  );
}

// ================= 加密页 =================
function EncryptView() {
  const [inputText, setInputText] = useState(window.location.origin);
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState({ ciphertext_qr: null, share1: null, share2: null, previewClean: null });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('vc_history_encrypt');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('text', inputText);
      const response = await fetch(getApiUrl('/generate'), { method: 'POST', body: formData });
      const data = await response.json();
      if (data.status === 'success') {
        const newResult = { ...data, date: new Date().toLocaleString(), text: inputText };
        setShares(newResult);
        const newHistory = [newResult, ...history].slice(0, 5);
        setHistory(newHistory);
        localStorage.setItem('vc_history_encrypt', JSON.stringify(newHistory));
      }
    } catch (error) { alert('后端连接失败'); } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl no-print">
        <input value={inputText} onChange={(e) => setInputText(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white mb-4" placeholder="输入敏感内容..." />
        <button onClick={handleGenerate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold">
          {loading ? "处理中..." : "执行混合加密"}
        </button>
      </div>

      {shares.share1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 no-print space-y-4">
             <div className="p-4 bg-slate-900 border border-indigo-500/30 rounded-lg">
                <p className="text-xs text-indigo-400 mb-2 font-bold uppercase">数字信道 (公开)</p>
                <img src={shares.ciphertext_qr} className="w-32 h-32 bg-white p-1 rounded mx-auto mb-2" />
                <a href={shares.ciphertext_qr} download="Secret_Carrier.png" className="text-xs text-center block text-slate-400 hover:text-white underline">下载密文二维码</a>
             </div>
             <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
                <p className="text-xs text-slate-400 mb-2 font-bold uppercase">物理信道 (隔离)</p>
                <div className="flex justify-between">
                    <a href={shares.share1} download="Share_A.png" className="text-xs bg-slate-700 px-3 py-1 rounded">下载 A</a>
                    <a href={shares.share2} download="Share_B.png" className="text-xs bg-slate-700 px-3 py-1 rounded">下载 B</a>
                </div>
             </div>
          </div>
          <div className="bg-slate-900 rounded-xl p-6 border border-slate-600 flex flex-col items-center">
            <span className="mb-4 text-amber-400 text-xs font-bold border border-amber-400/30 px-2 py-1 rounded">预览：净化后的 16位 物理密钥</span>
            <img src={shares.previewClean} className="max-w-[200px] bg-white p-2 rounded pixelated-image" />
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 no-print">
          <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2"><History size={16}/> 最近加密记录</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} onClick={() => setShares(h)} className="p-3 bg-slate-900 rounded-lg cursor-pointer hover:border-indigo-500 border border-transparent flex justify-between items-center">
                <span className="text-xs font-mono truncate max-w-[200px]">{h.text}</span>
                <span className="text-[10px] text-slate-500">{h.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ================= 解密页 =================
function DecryptView() {
  const [imgA, setImgA] = useState(null);
  const [imgB, setImgB] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [extractedKey, setExtractedKey] = useState(""); // 16位物理密钥 (可手动修改)
  const [purifiedImg, setPurifiedImg] = useState(null); // 净化后的预览图
  const [payload, setPayload] = useState(""); // 密文载体 JSON
  const [loading, setLoading] = useState(false);
  const [finalContent, setFinalContent] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('vc_history_decrypt');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const handleUpload = async (e, setter) => {
    const file = e.target.files[0];
    if (file) setter(await resizeImage(file, 1000));
  };

  const extractKey = async () => {
    if (!imgA || !imgB) return;
    setLoading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const i1 = new Image(); const i2 = new Image();
      await Promise.all([new Promise(r => { i1.onload = r; i1.src = imgA; }), new Promise(r => { i2.onload = r; i2.src = imgB; })]);
      canvas.width = i1.width; canvas.height = i1.height;
      ctx.drawImage(i1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(i2, offset.x, offset.y);
      
      canvas.toBlob(async (blob) => {
        const fd = new FormData(); fd.append('file', blob);
        const res = await fetch(getApiUrl('/decode'), { method: 'POST', body: fd });
        const data = await res.json();
        if (data.status === 'success') {
          setExtractedKey(data.content);
          setPurifiedImg(data.cleanImage); // 直接将净化后的图设置到 state
        } else { alert("自动识别失败，请尝试根据下方预览手动输入密钥"); }
      });
    } catch (e) { alert("识别异常"); } finally { setLoading(false); }
  };

  const finalDecrypt = async () => {
    if (!payload || !extractedKey) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('payload', payload);
      fd.append('key', extractedKey);
      const res = await fetch(getApiUrl('/decrypt_payload'), { method: 'POST', body: fd });
      const data = await res.json();
      if (data.status === 'success') {
        setFinalContent(data.content);
        const newHist = [{ content: data.content, date: new Date().toLocaleString() }, ...history].slice(0, 5);
        setHistory(newHist);
        localStorage.setItem('vc_history_decrypt', JSON.stringify(newHist));
      } else { alert(data.error); }
    } finally { setLoading(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {finalContent && <ResultModal content={finalContent} onClose={() => setFinalContent(null)} />}
      
      {/* 1. 物理层控制 */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
           <h3 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2"><Layers size={16}/> 1. 加载物理分片</h3>
           <div className="grid grid-cols-2 gap-2">
             <input type="file" id="a" className="hidden" onChange={e => handleUpload(e, setImgA)} />
             <label htmlFor="a" className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer ${imgA ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600'}`}>{imgA ? "图层 A 就绪" : "上传 A"}</label>
             <input type="file" id="b" className="hidden" onChange={e => handleUpload(e, setImgB)} />
             <label htmlFor="b" className={`p-4 border-2 border-dashed rounded-lg text-center cursor-pointer ${imgB ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600'}`}>{imgB ? "图层 B 就绪" : "上传 B"}</label>
           </div>
           
           {imgA && imgB && (
             <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
                <div className="flex justify-center gap-2">
                    <button onClick={() => setOffset(p => ({...p, y:p.y-1}))} className="ctrl-btn">↑</button>
                    <button onClick={() => setOffset(p => ({...p, y:p.y+1}))} className="ctrl-btn">↓</button>
                    <button onClick={() => setOffset(p => ({...p, x:p.x-1}))} className="ctrl-btn">←</button>
                    <button onClick={() => setOffset(p => ({...p, x:p.x+1}))} className="ctrl-btn">→</button>
                </div>
                <button onClick={extractKey} disabled={loading} className="w-full bg-emerald-600 py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                   {loading ? <Loader2 className="animate-spin"/> : <><Search size={18}/> 净化并提取密钥</>}
                </button>
             </div>
           )}
        </div>
      </div>

      {/* 2. 工作预览区 (对齐功能 + 净化展示) */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 min-h-[400px] flex flex-col items-center justify-center relative">
          {!purifiedImg ? (
            <div className="relative bg-white p-4 rounded overflow-hidden">
                <img src={imgA} className="relative z-10 mix-blend-multiply opacity-80 max-w-[300px]" />
                <img src={imgB} className="absolute top-4 left-4 z-20 mix-blend-multiply opacity-80 max-w-[300px]" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} />
            </div>
          ) : (
            <div className="flex flex-col items-center animate-fade-in bg-white p-6 rounded shadow-2xl">
                <span className="text-[10px] text-emerald-600 font-bold mb-2 uppercase tracking-widest">✨ 算法净化后的数字二维码</span>
                <img src={purifiedImg} className="w-64 h-64 pixelated-image mb-4" />
                <button onClick={() => setPurifiedImg(null)} className="text-xs text-slate-500 hover:text-slate-800 underline">返回手动对齐</button>
            </div>
          )}
        </div>

        {/* 3. 混合解密控制面板 (手动输入密钥) */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 shadow-xl">
           <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2"><Lock size={16}/> 2. 混合解密终端</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-wider"><Key size={12}/> 物理密钥 (可手动修正)</label>
                  <input value={extractedKey} onChange={e => setExtractedKey(e.target.value)} className="w-full bg-slate-900 border border-emerald-500/30 rounded px-3 py-2 text-white font-mono text-sm" placeholder="16位 HEX 密钥..." />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-wider"><Database size={12}/> 数字密文二维码内容</label>
                  <input value={payload} onChange={e => setPayload(e.target.value)} className="w-full bg-slate-900 border border-indigo-500/30 rounded px-3 py-2 text-white font-mono text-sm" placeholder="粘贴密文 JSON..." />
              </div>
           </div>
           <button onClick={finalDecrypt} disabled={!extractedKey || !payload} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all">
              <Unlock size={18}/> 执行最终 AES 解密
           </button>
        </div>

        {history.length > 0 && (
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
             <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase">解密成功历史</h3>
             <div className="space-y-1">
                {history.map((h, i) => (
                    <div key={i} className="text-xs bg-slate-900 p-2 rounded border border-slate-700 flex justify-between">
                        <span className="truncate">{h.content}</span>
                        <span className="text-slate-500">{h.date}</span>
                    </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
