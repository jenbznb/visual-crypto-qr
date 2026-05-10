import React, { useState, useEffect, useRef } from 'react';
import { Layers, ShieldCheck, Download, Move, CheckCircle2, Lock, Unlock, Camera, X, ScanLine, Printer, Share2, History, Trash2, ExternalLink, Copy, Search, Save, Image as ImageIcon, Loader2, KeyRound, FileJson, Check } from 'lucide-react';
import { Html5Qrcode } from 'https://esm.sh/html5-qrcode';

// --- 工具函数 ---
const dataURLtoBlob = async (dataUrl) => { const res = await fetch(dataUrl); return await res.blob(); };

const getApiUrl = (endpoint) => {
  const hostname = window.location.hostname;
  if (hostname.includes('localhost')) {
    return `http://localhost:8000${endpoint}`;
  }
  if (hostname.includes('hunyuan.ggff.net')) {
    return `https://api.hunyuan.ggff.net${endpoint}`;
  }
  return `https://vc-api.115333.xyz${endpoint}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('encrypt');

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-6xl mx-auto font-sans text-slate-100 pb-20">
      <header className="mb-8 text-center no-print">
        <h1 className="text-3xl md:text-5xl font-bold flex items-center justify-center gap-3 text-indigo-400 mb-2">
          <ShieldCheck size={40} className="md:w-12 md:h-12" />
          VC Hybrid Crypto
        </h1>
        <p className="text-slate-400 text-sm md:text-base">AES-GCM + Naor-Shamir (2,2) 混合加密网络架构</p>
      </header>

      <div className="flex p-1 bg-slate-800 rounded-xl mb-8 border border-slate-700 no-print">
        <button onClick={() => setActiveTab('encrypt')} className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${activeTab === 'encrypt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
          <Lock size={18} /> 混合加密
        </button>
        <button onClick={() => setActiveTab('decrypt')} className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${activeTab === 'decrypt' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
          <Unlock size={18} /> 联合解密
        </button>
      </div>

      <div className="w-full animate-fade-in">
        {activeTab === 'encrypt' ? <EncryptView /> : <DecryptView />}
      </div>
    </div>
  );
}

// ================= EncryptView (阶段一：分离产物展示) =================
function EncryptView() {
  const [inputText, setInputText] = useState(window.location.origin);
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState({ share1: null, share2: null, previewClean: null, ciphertextQr: null });
  const [isPreview, setIsPreview] = useState(false);
  
  const handleGenerate = async () => {
    if (!inputText) return;
    setLoading(true); setShares({ share1: null, share2: null, previewClean: null, ciphertextQr: null }); setIsPreview(false);
    
    try {
      const formData = new FormData();
      formData.append('text', inputText);
      const response = await fetch(getApiUrl('/generate'), { method: 'POST', body: formData });
      const data = await response.json();
      
      if (data.status === 'success') {
        setShares({ 
          share1: data.share1, 
          share2: data.share2, 
          previewClean: data.previewClean,
          ciphertextQr: data.ciphertext_qr 
        });
      } else { 
        alert('错误: ' + data.error); 
      }
    } catch (error) { 
      alert('连接后端失败。'); 
    } finally { 
      setLoading(false); 
    }
  };

  const downloadImage = (url, filename) => {
    const link = document.createElement('a'); 
    link.download = filename; link.href = url; link.click();
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 步骤 1：输入数据 */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl no-print">
        <h3 className="text-lg font-bold mb-4 text-indigo-400 flex items-center gap-2">1. 输入原始机密</h3>
        <div className="flex flex-col gap-4">
           <textarea 
             value={inputText} 
             onChange={(e) => setInputText(e.target.value)} 
             className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[100px]" 
             placeholder="输入任意长度的机密文本、JSON或代码..." 
           />
          <button onClick={handleGenerate} disabled={loading || !inputText} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 px-8 py-3 rounded-lg font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : '执行 AES+VC 混合加密'}
          </button>
        </div>
      </div>

      {/* 步骤 2：输出分离物 */}
      {shares.share1 && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 animate-fade-in no-print">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-indigo-300">2. 分发安全凭证</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* 产物 A: 密文载体 */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col items-center shadow-inner">
                    <span className="mb-2 px-3 py-1 bg-indigo-900 text-indigo-300 rounded-full text-xs font-bold border border-indigo-700 flex items-center gap-1"><FileJson size={14}/> AES 密文载体</span>
                    <p className="text-xs text-slate-500 mb-4 text-center">可安全地在公开信道(如微信、网站)传输。没有物理密钥无法解密。</p>
                    <img src={shares.ciphertextQr} className="max-w-[200px] w-full bg-white shadow-md rounded mb-4" alt="Ciphertext QR" />
                    <button onClick={() => downloadImage(shares.ciphertextQr, "AES_Payload.png")} className="btn-secondary w-full"><Download size={14}/> 下载密文二维码</button>
                </div>

                {/* 产物 B/C: 物理钥匙 */}
                <div className="md:col-span-2 bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-inner flex flex-col">
                     <span className="mb-2 px-3 py-1 bg-emerald-900 text-emerald-300 rounded-full text-xs font-bold border border-emerald-700 self-center flex items-center gap-1"><KeyRound size={14}/> 物理分解密钥 (VC Shares)</span>
                     <p className="text-xs text-slate-500 mb-4 text-center">包含解密密文所需的 16 位 AES 密钥。必须通过分离的安全信道（如打印、物理信件、不同APP）分发。</p>
                     
                     <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 mb-4 relative min-h-[200px]">
                         {!isPreview ? (
                            <>
                              <div className="flex flex-col items-center">
                                 <img src={shares.share1} className="max-w-[180px] w-full bg-white pixelated-image shadow-lg" alt="Share A" />
                                 <button onClick={() => downloadImage(shares.share1, "VC_Share_A.png")} className="mt-2 text-xs text-slate-400 hover:text-white flex items-center gap-1"><Download size={12}/> 下载 分片 A</button>
                              </div>
                              <div className="flex flex-col items-center">
                                 <img src={shares.share2} className="max-w-[180px] w-full bg-white pixelated-image shadow-lg" alt="Share B" />
                                 <button onClick={() => downloadImage(shares.share2, "VC_Share_B.png")} className="mt-2 text-xs text-slate-400 hover:text-white flex items-center gap-1"><Download size={12}/> 下载 分片 B</button>
                              </div>
                            </>
                         ) : (
                            <div className="flex flex-col items-center">
                               <img src={shares.previewClean} className="max-w-[200px] w-full bg-white pixelated-image shadow-2xl rounded" alt="Preview" />
                               <span className="mt-2 text-xs text-emerald-400 font-mono">16-bit Key Generated</span>
                            </div>
                         )}
                     </div>

                     <button onClick={() => setIsPreview(!isPreview)} className="btn-secondary w-full mt-auto">
                        {isPreview ? <Layers size={14} /> : <Search size={14} />} 
                        {isPreview ? '关闭净化对齐预览' : '预览密钥对齐效果'}
                     </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// ================= DecryptView (阶段一：双因子联合解密) =================
function DecryptView() {
  // VC 分片状态 (物理密钥)
  const [imgA, setImgA] = useState(null);
  const [imgB, setImgB] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isScanningKey, setIsScanningKey] = useState(false);
  const [aesKey, setAesKey] = useState(null);

  // Payload 密文状态
  const [payloadImg, setPayloadImg] = useState(null);
  const [isScanningPayload, setIsScanningPayload] = useState(false);
  const [cipherPayload, setCipherPayload] = useState(null);

  // 终极解密状态
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [finalResult, setFinalResult] = useState(null);

  // --- 处理文件上传 (绝不缩放) ---
  const handleUpload = (e, setImgState) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImgState(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const move = (dx, dy) => setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));

  // --- Step 1: 解析载体密文二维码 ---
  const handleExtractPayload = async () => {
      if (!payloadImg) return;
      setIsScanningPayload(true);
      try {
          const blob = await dataURLtoBlob(payloadImg);
          const formData = new FormData();
          formData.append('file', blob, 'payload.png');
          
          const response = await fetch(getApiUrl('/decode_normal_qr'), { method: 'POST', body: formData });
          const data = await response.json();
          
          if (data.status === 'success') {
              setCipherPayload(data.content);
          } else {
              alert(data.error);
          }
      } catch (err) {
          alert("提取密文时发生网络错误");
      } finally {
          setIsScanningPayload(false);
      }
  };

  // --- Step 2: 提取 VC 物理密钥 ---
  const handleExtractKey = async () => {
    if (!imgA || !imgB) return;
    setIsScanningKey(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      const image1 = new Image(); const image2 = new Image();
      const loadImg = (img, src) => new Promise(resolve => { img.onload = resolve; img.src = src; });
      await Promise.all([loadImg(image1, imgA), loadImg(image2, imgB)]);
      
      canvas.width = image1.width; canvas.height = image1.height;
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(image2, offset.x, offset.y);
      
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const formData = new FormData();
      formData.append('file', blob, 'composite.png');

      const response = await fetch(getApiUrl('/decode'), { method: 'POST', body: formData });
      const data = await response.json();

      if (data.status === 'success') {
        setAesKey(data.content);
      } else {
        alert(data.error || "提取物理密钥失败，请微调对齐。");
      }
    } catch (err) {
      alert("网络连接异常");
    } finally {
      setIsScanningKey(false);
    }
  };

  // --- Step 3: 联合解密 ---
  const handleFinalDecrypt = async () => {
      if (!cipherPayload || !aesKey) return;
      setIsDecrypting(true);
      try {
          const formData = new FormData();
          formData.append('payload', cipherPayload);
          formData.append('key', aesKey);
          
          const response = await fetch(getApiUrl('/decrypt_payload'), { method: 'POST', body: formData });
          const data = await response.json();
          
          if (data.status === 'success') {
              setFinalResult(data.content);
          } else {
              alert(data.error || "解密失败，密钥或密文损坏。");
          }
      } catch (e) {
          alert("网络连接异常");
      } finally {
          setIsDecrypting(false);
      }
  };

  const renderUploadBox = (label, imgState, setImgState, id) => (
    <div className="flex-1">
      <div className="relative">
        <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setImgState)} className="hidden" id={id} />
        <label htmlFor={id} className={`flex flex-col items-center justify-center gap-1 w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-all ${imgState ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-700 text-slate-400'}`}>
           {imgState ? <><Check size={18} /><span className="text-[10px]">{label}就绪</span></> : <><Camera size={18} /><span className="text-[10px]">加载 {label}</span></>}
        </label>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      
      {/* 结果展示 Modal */}
      {finalResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-emerald-500 shadow-2xl shadow-emerald-500/20 p-6">
                <div className="flex justify-between items-start mb-6 border-b border-slate-700 pb-4">
                  <h3 className="text-2xl font-bold text-emerald-400 flex items-center gap-2"><Unlock size={28} /> 解密成功</h3>
                  <button onClick={() => setFinalResult(null)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-6 max-h-60 overflow-y-auto custom-scrollbar">
                  <p className="text-white font-mono text-sm whitespace-pre-wrap break-all">{finalResult}</p>
                </div>
                <button onClick={() => {navigator.clipboard.writeText(finalResult); alert("已复制")}} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                   <Copy size={18} /> 复制机密信息
                </button>
            </div>
          </div>
      )}

      {/* 第一阶段：获取载体 */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-6 items-center">
         <div className="w-full md:w-1/3 flex flex-col gap-2 border-r border-slate-700 pr-4">
             <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2"><FileJson size={20}/> 1. 提取密文</h3>
             <p className="text-xs text-slate-400">上传公开的 AES 密文二维码</p>
         </div>
         <div className="w-full md:w-2/3 flex items-center gap-4">
             {renderUploadBox("密文二维码", payloadImg, setPayloadImg, "payloadInput")}
             <button onClick={handleExtractPayload} disabled={!payloadImg || isScanningPayload || cipherPayload} className={`py-3 px-6 rounded-lg font-bold flex items-center gap-2 transition-all flex-1 justify-center ${cipherPayload ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-700'}`}>
                 {isScanningPayload ? <Loader2 className="animate-spin" size={18} /> : cipherPayload ? <><CheckCircle2 size={18}/> 密文已就绪</> : '提取密文载荷'}
             </button>
         </div>
      </div>

      {/* 第二阶段：提取密钥 */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-6">
         <div className="w-full md:w-1/3 flex flex-col gap-2 border-b md:border-b-0 md:border-r border-slate-700 pr-4 pb-4 md:pb-0">
             <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2"><KeyRound size={20}/> 2. 提取密钥</h3>
             <p className="text-xs text-slate-400 mb-2">叠合分片并提取 16 位 AES 密钥</p>
             <div className="flex gap-2 w-full">{renderUploadBox("分片A", imgA, setImgA, "keyA")}{renderUploadBox("分片B", imgB, setImgB, "keyB")}</div>
             {imgA && imgB && !aesKey && (
                <div className="grid grid-cols-3 gap-1 w-24 mx-auto mt-4">
                    <div /><button onClick={() => move(0, -1)} className="ctrl-btn py-1 text-xs">↑</button><div />
                    <button onClick={() => move(-1, 0)} className="ctrl-btn py-1 text-xs">←</button>
                    <button onClick={() => setOffset({x:0, y:0})} className="ctrl-btn py-1 text-[10px]">●</button>
                    <button onClick={() => move(1, 0)} className="ctrl-btn py-1 text-xs">→</button>
                    <div /><button onClick={() => move(0, 1)} className="ctrl-btn py-1 text-xs">↓</button><div />
                </div>
             )}
         </div>
         <div className="w-full md:w-2/3 flex flex-col items-center justify-center gap-4 relative min-h-[200px] bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
             {aesKey ? (
                 <div className="flex flex-col items-center text-emerald-400 animate-fade-in">
                    <CheckCircle2 size={48} className="mb-2" />
                    <span className="font-bold text-lg">物理密钥提取成功</span>
                    <span className="font-mono text-xs opacity-50 mt-1">Key Matrix Locked</span>
                 </div>
             ) : imgA && imgB ? (
                <div className="relative flex items-center justify-center w-full h-full p-4">
                    <img src={imgA} className="absolute z-10 pixelated-image mix-blend-multiply opacity-80 max-h-[180px]" alt="A" />
                    <img src={imgB} className="absolute z-20 pixelated-image mix-blend-multiply opacity-80 transition-transform duration-75 max-h-[180px]" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} alt="B" />
                </div>
             ) : (
                <span className="text-slate-500 text-sm">等待分片...</span>
             )}
             
             {imgA && imgB && !aesKey && (
                 <button onClick={handleExtractKey} disabled={isScanningKey} className="absolute bottom-4 right-4 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2">
                     {isScanningKey ? <Loader2 className="animate-spin" size={16}/> : '合成并提取密钥'}
                 </button>
             )}
         </div>
      </div>

      {/* 第三阶段：联合解密 (The Vault) */}
      <div className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center transition-all duration-500 ${cipherPayload && aesKey ? 'bg-gradient-to-r from-indigo-900/50 to-emerald-900/50 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'bg-slate-900 border-slate-700'}`}>
         <Unlock size={32} className={`mb-4 transition-all duration-500 ${cipherPayload && aesKey ? 'text-emerald-400' : 'text-slate-600'}`} />
         <h3 className="text-xl font-bold mb-6 text-white">3. 双因子联合解密</h3>
         
         <div className="flex items-center justify-center gap-4 mb-8 w-full max-w-md">
            <div className={`flex-1 flex flex-col items-center p-3 rounded-lg border ${cipherPayload ? 'bg-indigo-900/30 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
               <FileJson size={24} className="mb-2"/>
               <span className="text-xs font-bold">密文载荷</span>
               <span className="text-[10px] mt-1">{cipherPayload ? '已就绪' : '缺失'}</span>
            </div>
            <div className={`text-2xl ${cipherPayload && aesKey ? 'text-emerald-400' : 'text-slate-600'}`}>+</div>
            <div className={`flex-1 flex flex-col items-center p-3 rounded-lg border ${aesKey ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
               <KeyRound size={24} className="mb-2"/>
               <span className="text-xs font-bold">物理密钥</span>
               <span className="text-[10px] mt-1">{aesKey ? '已就绪' : '缺失'}</span>
            </div>
         </div>

         <button 
           onClick={handleFinalDecrypt} 
           disabled={!cipherPayload || !aesKey || isDecrypting}
           className="w-full max-w-md bg-white text-slate-900 hover:bg-emerald-50 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 py-4 rounded-xl font-black text-lg transition-all shadow-xl disabled:shadow-none flex items-center justify-center gap-2"
         >
           {isDecrypting ? <Loader2 className="animate-spin" size={24} /> : '执行解密协议'}
         </button>
      </div>

    </div>
  );
}
