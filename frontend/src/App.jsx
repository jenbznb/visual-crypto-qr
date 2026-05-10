import { useState, useEffect, useRef } from 'react';
import { Layers, ShieldCheck, Download, Upload, Move, CheckCircle2, Lock, Unlock, Camera, X, ScanLine, Printer, Share2, History, Trash2, ExternalLink, Copy, Search, Save, Image as ImageIcon, Loader2 } from 'lucide-react';
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
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png', 1.0)); 
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};
const dataURLtoBlob = async (dataUrl) => { const res = await fetch(dataUrl); return await res.blob(); };

// --- 智能判断后端 API 地址 ---
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

function App() {
  const [activeTab, setActiveTab] = useState('encrypt');

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto font-sans text-slate-100 pb-20">
      <header className="mb-8 text-center no-print">
        <h1 className="text-3xl md:text-5xl font-bold flex items-center justify-center gap-3 text-indigo-400 mb-2">
          <ShieldCheck size={40} className="md:w-12 md:h-12" />
          Visual Crypto QR
        </h1>
        <p className="text-slate-400 text-sm md:text-base">Naor-Shamir (2,2) 视觉秘密共享算法演示</p>
      </header>

      <div className="flex p-1 bg-slate-800 rounded-xl mb-8 border border-slate-700 no-print">
        <button onClick={() => setActiveTab('encrypt')} className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${activeTab === 'encrypt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
          <Lock size={18} /> 加密
        </button>
        <button onClick={() => setActiveTab('decrypt')} className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${activeTab === 'decrypt' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
          <Unlock size={18} /> 解密
        </button>
      </div>

      <div className="w-full animate-fade-in">
        {activeTab === 'encrypt' ? <EncryptView /> : <DecryptView />}
      </div>
    </div>
  );
}

// ================= QrScannerModal =================
function QrScannerModal({ onScanSuccess, onClose }) {
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    const startScanner = async () => {
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          let cameraId;
          const rearCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment')
          );

          if (rearCamera) {
            cameraId = rearCamera.id;
          } else {
            cameraId = devices[devices.length - 1].id;
          }

          await html5QrCode.start(
            cameraId,
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText, decodedResult) => {
              onScanSuccess(decodedText);
            },
            (errorMessage) => { }
          );
        } else {
          alert("未找到可用的摄像头设备。");
          onClose();
        }
      } catch (err) {
        console.error("摄像头启动失败:", err);
        alert("无法启动摄像头，请检查浏览器权限。");
        onClose();
      }
    };

    startScanner();

    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(err => {
          console.error("停止扫描仪失败", err);
        });
      }
    };
  }, [onScanSuccess, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 overflow-hidden relative shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <h3 className="font-bold flex items-center gap-2 text-white"><ScanLine size={20}/> 扫描二维码</h3>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <div className="p-4 bg-slate-900" style={{ position: 'relative' }}>
          <div id="reader" style={{ width: '100%' }}></div>
        </div>
      </div>
    </div>
  );
}

// ================= ResultModal =================
function ResultModal({ content, imgSrc, onClose }) {
  const isUrl = content.startsWith('http://') || content.startsWith('https://');
  const handleCopy = () => { navigator.clipboard.writeText(content); alert('已复制'); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 transform transition-all scale-100">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2"><CheckCircle2 size={24} /> 识别并净化成功</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        
        {imgSrc && (
          <div className="mb-4 flex flex-col items-center bg-white p-2 rounded-lg border border-slate-600">
             <img src={imgSrc} className="max-h-48 object-contain pixelated-image" alt="Purified QR" />
          </div>
        )}

        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mb-6 break-words max-h-40 overflow-y-auto">
          <p className="text-slate-200 font-mono text-sm">{content}</p>
        </div>
        <div className="flex gap-3">
          {isUrl && <a href={content} target="_blank" rel="noopener noreferrer" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"><ExternalLink size={18} /> 访问链接</a>}
          <button onClick={handleCopy} className={`flex-1 border border-slate-600 hover:bg-slate-700 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${!isUrl ? 'w-full' : ''}`}><Copy size={18} /> 复制</button>
        </div>
      </div>
    </div>
  );
}

// ================= ImagePreviewModal =================
function ImagePreviewModal({ imgSrc, text, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 no-print" onClick={onClose}>
      <div className="max-w-3xl w-full flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <div className="relative bg-white p-2 rounded-lg shadow-2xl">
           <img src={imgSrc} className="max-h-[70vh] w-auto rounded object-contain pixelated-image" />
           <button onClick={onClose} className="absolute -top-12 right-0 p-2 text-white hover:text-slate-300"><X size={32}/></button>
        </div>
        {text && text !== "手动保存的图片" && (
           <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 w-full max-w-md">
             <p className="text-slate-400 text-xs mb-1">包含内容:</p>
             <p className="text-white font-mono text-sm break-all">{text}</p>
           </div>
        )}
      </div>
    </div>
  );
}

// ================= EncryptView (加密页) =================
function EncryptView() {
  const [inputType, setInputType] = useState('text');
  const [inputText, setInputText] = useState(window.location.origin);
  const [inputImage, setInputImage] = useState(null);
  const [inputImagePreview, setInputImagePreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState({ share1: null, share2: null, previewClean: null });
  const [isPreview, setIsPreview] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [history, setHistory] = useState([]); 
  const canvasRef = useRef(null);
  const MAX_LENGTH = 150; 

  useEffect(() => {
    const saved = localStorage.getItem('vc_history_encrypt');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // 核心修复 1：将 previewClean 也保存到历史记录中
  const saveToHistory = (textOrType, s1, s2, previewClean) => {
    const newItem = { id: Date.now(), text: textOrType, share1: s1, share2: s2, previewClean, date: new Date().toLocaleString() };
    const newHistory = [newItem, ...history].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('vc_history_encrypt', JSON.stringify(newHistory));
  };

  const deleteHistory = (id, e) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('vc_history_encrypt', JSON.stringify(newHistory));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setInputImage(file);
      const reader = new FileReader();
      reader.onload = (event) => setInputImagePreview(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    setLoading(true); setShares({ share1: null, share2: null, previewClean: null }); setIsPreview(false);
    
    try {
      let apiUrl, formData;

      if (inputType === 'text') {
        if (inputText.length > MAX_LENGTH) { alert(`文本过长！建议 ${MAX_LENGTH} 字符以内。`); return; }
        formData = new FormData();
        formData.append('text', inputText);
        apiUrl = getApiUrl('/generate');
      } else {
        if (!inputImage) { alert("请先上传一张图片或二维码！"); setLoading(false); return; }
        formData = new FormData();
        formData.append('file', inputImage);
        apiUrl = getApiUrl('/generate_image');
      }

      const response = await fetch(apiUrl, { method: 'POST', body: formData });
      const data = await response.json();
      
      if (data.status === 'success' || data.share1) {
        setShares({ share1: data.share1, share2: data.share2, previewClean: data.previewClean });
        // 核心修复 2：保存历史时传入 data.previewClean
        saveToHistory(inputType === 'text' ? inputText : "[加密图片]", data.share1, data.share2, data.previewClean);
      } else { 
        alert('Error: ' + data.error); 
      }
    } catch (error) { 
      alert('连接后端失败。'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handlePrint = () => { setIsPreview(false); setTimeout(() => window.print(), 100); };
  
  const handleShare = async () => {
    if (!navigator.share || !shares.share1) { alert("浏览器不支持分享，请手动下载。"); return; }
    try {
      const blob1 = await dataURLtoBlob(shares.share1);
      const blob2 = await dataURLtoBlob(shares.share2);
      await navigator.share({ title: 'Visual Crypto Shares', text: '视觉秘密分片', files: [new File([blob1], "A.png", {type:"image/png"}), new File([blob2], "B.png", {type:"image/png"})] });
    } catch (err) { console.error(err); }
  };

  const handleDownloadCombined = () => {
    if (shares.previewClean) {
        const link = document.createElement('a'); 
        link.download = 'combined_result.png';
        link.href = shares.previewClean; 
        link.click();
        return;
    }
    
    if (!shares.share1) return;
    const ctx = canvasRef.current.getContext('2d');
    const i1 = new Image(); i1.src = shares.share1;
    const i2 = new Image(); i2.src = shares.share2;
    i1.onload = () => {
      canvasRef.current.width = i1.width; canvasRef.current.height = i1.height;
      ctx.drawImage(i1, 0, 0);
      i2.onload = () => {
        ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(i2, 0, 0);
        const link = document.createElement('a'); link.download = 'combined.png';
        link.href = canvasRef.current.toDataURL('image/png'); link.click();
        ctx.globalCompositeOperation = 'source-over';
      };
    };
  };

  return (
    <div className="flex flex-col gap-8">
      {showScanner && <QrScannerModal onClose={() => setShowScanner(false)} onScanSuccess={(t) => {setInputText(t); setInputType('text'); setShowScanner(false);}} />}
      
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl no-print">
        <div className="flex gap-4 mb-6 border-b border-slate-700 pb-2">
          <button onClick={() => setInputType('text')} className={`text-sm font-bold pb-2 border-b-2 transition-all ${inputType === 'text' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>文本转二维码</button>
          <button onClick={() => setInputType('image')} className={`text-sm font-bold pb-2 border-b-2 transition-all ${inputType === 'image' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>直接加密图片</button>
        </div>

        <div className="flex flex-col gap-4">
          {inputType === 'text' ? (
             <div className="flex gap-2">
               <input value={inputText} onChange={(e) => setInputText(e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500" placeholder="输入文本或扫描..." />
               <button onClick={() => setShowScanner(true)} className="bg-slate-700 px-3 rounded-lg border border-slate-600 hover:bg-slate-600"><ScanLine size={20} /></button>
             </div>
          ) : (
             <div className="flex items-center gap-4">
                <input type="file" id="encryptImageInput" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <label htmlFor="encryptImageInput" className="flex-1 border-2 border-dashed border-slate-600 hover:border-indigo-400 bg-slate-900 hover:bg-slate-800 rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer transition-all text-slate-400">
                  <ImageIcon size={24} className="mb-1" />
                  <span className="text-sm">点击上传图片 / 二维码</span>
                </label>
                {inputImagePreview && (
                  <div className="w-24 h-24 bg-white rounded-lg p-1 border border-slate-600 flex-shrink-0">
                    <img src={inputImagePreview} className="w-full h-full object-contain" />
                  </div>
                )}
             </div>
          )}

          <button onClick={handleGenerate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 px-8 py-3 rounded-lg font-bold text-white transition-all shadow-lg">
            {loading ? <Loader2 className="animate-spin inline mr-2" size={20} /> : '开始加密'}
          </button>
        </div>
      </div>

      {shares.share1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-fit no-print">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-300"><Layers size={20} /> 分发与控制</h3>
            <div className="space-y-3">
              <button onClick={() => setIsPreview(!isPreview)} className={`w-full py-3 rounded-lg font-semibold border flex justify-center items-center gap-2 transition-all ${isPreview ? 'bg-amber-500/20 text-amber-400 border-amber-500' : 'bg-slate-700 hover:bg-slate-600 border-slate-600'}`}>
                {isPreview ? <><Layers size={18} /> 关闭预览</> : <><Search size={18} /> 预览效果</>}
              </button>
              
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-700">
                 <a href={shares.share1} download="Share_A.png" className="btn-secondary"><Download size={14}/> 下载图层 A</a>
                 <a href={shares.share2} download="Share_B.png" className="btn-secondary"><Download size={14}/> 下载图层 B</a>
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <button onClick={handleDownloadCombined} className="btn-secondary hover:text-emerald-400 hover:border-emerald-500"><CheckCircle2 size={14} /> 合成下载</button>
                 <button onClick={handlePrint} className="btn-secondary hover:text-indigo-400 hover:border-indigo-500"><Printer size={14} /> 打印图纸</button>
              </div>
              <button onClick={handleShare} className="w-full py-3 mt-2 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 transition-all shadow-lg"><Share2 size={18} /> 分享图层给朋友</button>
            </div>
          </div>
          
          <div id="printable-section" className="relative bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center min-h-[400px] border border-slate-600 shadow-2xl overflow-hidden select-none">
            <div className="hidden print:block absolute top-4 text-black text-center w-full"><h2 className="text-xl font-bold">Visual Crypto Shares</h2></div>
            
            {!isPreview ? (
              <div className="flex flex-col md:flex-row gap-6 items-center justify-center w-full print:static">
                <div className="flex flex-col items-center">
                  <span className="mb-2 px-3 py-1 bg-slate-800 text-slate-300 rounded text-sm font-bold shadow">图层 A</span>
                  <img src={shares.share1} className="max-w-[200px] w-full bg-white pixelated-image shadow-lg" />
                </div>
                <div className="hidden md:block text-slate-600"><Move size={32} /></div>
                <div className="flex flex-col items-center">
                  <span className="mb-2 px-3 py-1 bg-slate-800 text-slate-300 rounded text-sm font-bold shadow">图层 B</span>
                  <img src={shares.share2} className="max-w-[200px] w-full bg-white pixelated-image shadow-lg" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                 {shares.previewClean ? (
                   <img src={shares.previewClean} className="max-w-[250px] md:max-w-[300px] w-full bg-white pixelated-image shadow-2xl rounded" />
                 ) : (
                   <div className="relative w-full max-w-[300px] aspect-square flex items-center justify-center bg-white rounded shadow-inner">
                     <img src={shares.share1} className="absolute w-full h-full object-contain mix-blend-multiply opacity-90 pixelated-image" />
                     <img src={shares.share2} className="absolute w-full h-full object-contain mix-blend-multiply opacity-90 pixelated-image" />
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="w-full mt-8 bg-slate-800 p-6 rounded-xl border border-slate-700 no-print animate-fade-in">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-300"><History size={20}/> 加密历史记录</h3>
          <div className="space-y-3">
            {history.map(item => (
              <div 
                key={item.id} 
                className="flex gap-4 p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-indigo-500 cursor-pointer transition-all"
                // 核心修复 3：点击历史记录时，如果存在 previewClean，重新赋值回去
                onClick={() => setShares({ share1: item.share1, share2: item.share2, previewClean: item.previewClean || null })}
              >
                <img src={item.share1} className="w-12 h-12 object-cover rounded bg-white border border-slate-600" />
                <div className="flex-1 overflow-hidden flex flex-col justify-center">
                  <p className="text-sm text-white truncate font-mono">{item.text}</p>
                  <p className="text-xs text-slate-500">{item.date}</p>
                </div>
                <button onClick={(e) => deleteHistory(item.id, e)} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ================= DecryptView (解密页) =================
function DecryptView() {
  const [imgA, setImgA] = useState(null);
  const [imgB, setImgB] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scanResult, setScanResult] = useState(null); 
  const [isScanning, setIsScanning] = useState(false);
  const [decryptHistory, setDecryptHistory] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [purifiedImg, setPurifiedImg] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('vc_history_decrypt');
    if (saved) setDecryptHistory(JSON.parse(saved));
  }, []);

  const saveToDecryptHistory = (text, combinedImg) => {
    const newItem = { id: Date.now(), text, img: combinedImg, date: new Date().toLocaleString() };
    const newHistory = [newItem, ...decryptHistory].slice(0, 5);
    setDecryptHistory(newHistory);
    localStorage.setItem('vc_history_decrypt', JSON.stringify(newHistory));
  };

  const deleteDecryptHistory = (id) => {
    const newHistory = decryptHistory.filter(item => item.id !== id);
    setDecryptHistory(newHistory);
    localStorage.setItem('vc_history_decrypt', JSON.stringify(newHistory));
  };

  const handleUpload = async (e, setImgState) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const resizedDataUrl = await resizeImage(file, 1000);
        setImgState(resizedDataUrl);
      } catch (err) {
        alert("处理图片时出错，请重试");
      }
    }
  };

  const move = (dx, dy) => setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));

  const generateCompositeBlob = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;

    const image1 = new Image();
    const image2 = new Image();
    const loadImg = (img, src) => new Promise(resolve => { img.onload = resolve; img.src = src; });
    await Promise.all([loadImg(image1, imgA), loadImg(image2, imgB)]);
    
    canvas.width = image1.width; canvas.height = image1.height;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(image1, 0, 0);
    
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(image2, offset.x, offset.y);
    ctx.globalCompositeOperation = 'source-over';
    
    const rawUrl = canvas.toDataURL("image/png");
    
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            resolve({ blob, rawUrl });
        }, 'image/png');
    });
  };

  const handleScanContent = async () => {
    if (!imgA || !imgB) return;
    setIsScanning(true);
    let currentRawUrl = "";

    try {
      const { blob, rawUrl } = await generateCompositeBlob();
      currentRawUrl = rawUrl;

      const formData = new FormData();
      formData.append('file', blob, 'composite.png');

      const apiUrl = getApiUrl('/decode');

      const response = await fetch(apiUrl, { method: 'POST', body: formData });
      const data = await response.json();

      if (data.status === 'success') {
        setScanResult(data.content);
        setPurifiedImg(data.cleanImage); 
        saveToDecryptHistory(data.content, data.cleanImage || rawUrl);
      } else {
        throw new Error(data.error || "无法识别");
      }
    } catch (err) {
      if(confirm("识别失败：无法读取二维码。\n\n是否将图片【手动保存】到历史记录？")) {
        saveToDecryptHistory("手动保存的图片", currentRawUrl);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualSave = async () => {
    if (!imgA || !imgB) return;
    if (purifiedImg) {
        const link = document.createElement('a'); 
        link.download = 'purified_result.png';
        link.href = purifiedImg; 
        link.click();
        saveToDecryptHistory("手动保存的图片", purifiedImg);
        alert("已保存");
        return;
    }
    const { rawUrl } = await generateCompositeBlob();
    saveToDecryptHistory("手动保存的图片", rawUrl);
    alert("已保存");
  };

  const renderUploadButton = (label, imgState, setImgState, id) => (
    <div className="upload-box">
      <label className="text-sm text-slate-400 mb-1 block">{label}</label>
      <div className="relative">
        <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setImgState)} className="hidden" id={id} />
        <label htmlFor={id} className={`flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${imgState ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-700 text-slate-400'}`}>
           {imgState ? <><CheckCircle2 size={24} /><span className="text-xs">已加载</span></> : <><Camera size={24} /><span className="text-xs">拍照 / 上传</span></>}
        </label>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
      {scanResult && <ResultModal content={scanResult} imgSrc={purifiedImg} onClose={() => setScanResult(null)} />}
      {previewItem && <ImagePreviewModal imgSrc={previewItem.img} text={previewItem.text} onClose={() => setPreviewItem(null)} />}

      <div className="lg:col-span-1 space-y-4">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2"><Camera size={20}/> 1. 获取图层</h3>
          <div className="grid grid-cols-2 gap-4">{renderUploadButton("图层 A", imgA, setImgA, "fileA")}{renderUploadButton("图层 B", imgB, setImgB, "fileB")}</div>
        </div>

        {imgA && imgB && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 animate-fade-in">
             <h3 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2"><Move size={18} /> 2. 对齐与识别</h3>
             <div className="grid grid-cols-3 gap-2 w-32 mx-auto mb-4">
                <div /><button onClick={() => move(0, -1)} className="ctrl-btn">↑</button><div />
                <button onClick={() => move(-1, 0)} className="ctrl-btn">←</button>
                <button onClick={() => setOffset({x:0, y:0})} className="ctrl-btn text-xs">●</button>
                <button onClick={() => move(1, 0)} className="ctrl-btn">→</button>
                <div /><button onClick={() => move(0, 1)} className="ctrl-btn">↓</button><div />
             </div>
             <div className="flex flex-col gap-2">
               <button 
                 onClick={handleScanContent} 
                 disabled={isScanning}
                 className="w-full py-3 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 transition-all shadow-lg"
               >
                 {isScanning ? <Loader2 className="animate-spin" size={20} /> : <><Search size={18} /> 云端智能识别</>}
               </button>
               <button onClick={handleManualSave} className="w-full py-2 rounded-lg text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center gap-2"><Save size={16} /> 仅保存图片</button>
             </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-8">
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 flex flex-col items-center justify-center min-h-[400px]">
          {!imgA || !imgB ? (
             <div className="text-slate-500 flex flex-col items-center text-center p-8">
               <Layers size={48} className="mb-4 opacity-50" /><p>请上传两张分片</p>
               <p className="text-sm opacity-60 mt-2 max-w-md">上传图层并拖拽对齐十字标，然后点击识别即可查看识别结果。</p>
             </div>
          ) : purifiedImg ? (
             <div className="relative bg-white w-full h-full min-h-[400px] rounded flex flex-col items-center justify-center overflow-hidden p-4 animate-fade-in">
                <span className="absolute top-4 px-4 py-2 bg-emerald-600/10 text-emerald-600 rounded-lg text-sm font-bold border border-emerald-500/30 z-30 shadow-sm backdrop-blur-sm">✨ 云端智能识别结果</span>
                <img src={purifiedImg} className="relative z-10 pixelated-image max-w-[300px] md:max-w-[400px] object-contain shadow-2xl" />
                <button onClick={() => setPurifiedImg(null)} className="absolute bottom-4 px-6 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-lg shadow-lg z-30 transition-all font-bold">返回手动对齐</button>
             </div>
          ) : (
            <div className="relative bg-white w-full h-full min-h-[400px] rounded flex items-center justify-center overflow-hidden">
               <div className="relative max-w-full max-h-full">
                 <img src={imgA} className="relative z-10 pixelated-image mix-blend-multiply opacity-80 max-w-[300px] md:max-w-[400px]" />
                 <img src={imgB} className="absolute top-0 left-0 z-20 pixelated-image mix-blend-multiply opacity-80 transition-transform duration-75 max-w-[300px] md:max-w-[400px]" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} />
               </div>
            </div>
          )}
        </div>

        {decryptHistory.length > 0 && (
          <div className="w-full bg-slate-800 p-6 rounded-xl border border-slate-700 animate-fade-in">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-400"><History size={20}/> 解密历史记录</h3>
            <div className="space-y-3">
              {decryptHistory.map(item => (
                <div 
                  key={item.id} 
                  className="flex gap-4 p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-emerald-500 cursor-pointer transition-all"
                  onClick={() => setPreviewItem(item)}
                >
                  <img src={item.img} className="w-12 h-12 object-cover rounded bg-white border border-slate-600" />
                  <div className="flex-1 overflow-hidden flex flex-col justify-center">
                    <p className="text-sm text-white truncate font-mono">{item.text}</p>
                    <p className="text-xs text-slate-500">{item.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={(e) => {e.stopPropagation(); setPreviewItem(item)}} className="p-2 text-slate-400 hover:text-white" title="查看大图"><ImageIcon size={16}/></button>
                     <button onClick={(e) => {e.stopPropagation(); deleteDecryptHistory(item.id)}} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
