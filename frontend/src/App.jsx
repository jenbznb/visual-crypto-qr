import React, { useState, useEffect, useRef } from 'react';
import { Layers, ShieldCheck, Download, Move, CheckCircle2, Lock, Unlock, Camera, X, ScanLine, Printer, Share2, History, Trash2, ExternalLink, Copy, Search, Save, Image as ImageIcon, Loader2, KeyRound, FileJson, Check, FileText, UploadCloud, Info, AlertTriangle, HelpCircle, Eye, EyeOff, Cloud } from 'lucide-react';

// --- 工具函数：数据流转换 ---
const dataURLtoBlob = async (dataUrl) => { 
  const res = await fetch(dataUrl); 
  return await res.blob(); 
};

// --- 工具函数：获取 API 端点 ---
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

// --- 工具函数：触发文件下载 ---
const downloadFile = (url, filename) => {
  const link = document.createElement('a'); 
  link.download = filename; 
  link.href = url; 
  link.click();
};

// --- 动态加载外部 CDN 脚本，避免打包构建时解析失败 ---
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
    document.head.appendChild(script);
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState('encrypt');
  const [toast, setToast] = useState(null);
  const [libsReady, setLibsReady] = useState(false);

  // 弹出提示框管理
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 在组件加载时，从 CDN 异步获取扫码和解析二维码的库
  useEffect(() => {
    const initLibraries = async () => {
      try {
        await Promise.all([
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'),
          loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js')
        ]);
        setLibsReady(true);
      } catch (err) {
        showToast("核心解密依赖库加载失败，请检查网络连接", "error");
      }
    };
    initLibraries();
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-6xl mx-auto font-sans text-slate-850 pb-20 relative">
      {/* 全局通知 Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-white border-indigo-200 text-slate-800'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500" />}
          {toast.type === 'error' && <AlertTriangle size={18} className="text-rose-500" />}
          {toast.type === 'info' && <Info size={18} className="text-indigo-500" />}
          <span className="text-sm font-semibold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 transition-opacity ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      <header className="mb-8 text-center no-print">
        <h1 className="text-3xl md:text-5xl font-black flex items-center justify-center gap-3 text-indigo-600 mb-2">
          <ShieldCheck size={40} className="md:w-12 md:h-12 text-indigo-600" />
          VC Hybrid Crypto
        </h1>
        <p className="text-slate-600 text-sm md:text-base font-medium">
          基于 Zlib 极限压缩 + Naor-Shamir (2,2) 物理二维码秘密分享网络
        </p>
      </header>

      {/* 选项卡导航 */}
      <div className="flex p-1 bg-slate-200/80 rounded-xl mb-8 border border-slate-300 no-print shadow-sm">
        <button 
          onClick={() => setActiveTab('encrypt')} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'encrypt' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Lock size={16} /> 隐写秘密分发
        </button>
        <button 
          onClick={() => setActiveTab('decrypt')} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
            activeTab === 'decrypt' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Unlock size={16} /> 联合扫码还原
        </button>
      </div>

      <div className="w-full animate-fade-in">
        {activeTab === 'encrypt' ? (
          <EncryptView showToast={showToast} />
        ) : (
          <DecryptView showToast={showToast} libsReady={libsReady} />
        )}
      </div>
    </div>
  );
}

// ================= EncryptView (直接隐写 + VC分片) =================
function EncryptView({ showToast }) {
  const [mode, setMode] = useState('text'); 
  const [inputText, setInputText] = useState(window.location.origin);
  const [inputFileData, setInputFileData] = useState(null);
  const [inputFileName, setInputFileName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState({ share1: null, share2: null, previewClean: null, ciphertextQr: null });
  const [isPreview, setIsPreview] = useState(false);
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 1536) { 
      showToast(`文件过大 (${(file.size/1024).toFixed(2)} KB)！\n受限于物理对齐极限，建议上传 1.5KB 以下的极小文件。`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setInputFileData(event.target.result); 
      setInputFileName(file.name);
      showToast("文件读取成功，已自动编码为二进制流", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    const payload = mode === 'text' ? inputText : inputFileData;
    if (!payload) return;
    
    setLoading(true); 
    setShares({ share1: null, share2: null, previewClean: null, ciphertextQr: null }); 
    setIsPreview(false);
    
    try {
      const formData = new FormData();
      formData.append('text', payload); 
      const response = await fetch(getApiUrl('/generate'), { method: 'POST', body: formData });
      const data = await response.json();
      
      if (data.status === 'success') {
        setShares({ 
          share1: data.share1, 
          share2: data.share2, 
          previewClean: data.previewClean,
          ciphertextQr: data.ciphertext_qr 
        });
        showToast("隐写载体分拆与视觉秘密分享部署完毕！", "success");
      } else { 
        showToast('生成失败 (可能是内容超出了二维码的最大编码极限): ' + data.error, 'error'); 
      }
    } catch (error) { 
      showToast('连接后端失败，请确认服务是否正常启动。', 'error'); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 步骤 1：输入原始数据 */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-md no-print">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-indigo-600 flex items-center gap-2">
            1. 注入原始机密
          </h3>
          <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
            <button 
              onClick={() => setMode('text')} 
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                mode === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={14}/> 文本机密
            </button>
            <button 
              onClick={() => setMode('file')} 
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                mode === 'file' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon size={14}/> 极小文件/图片
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {mode === 'text' ? (
            <textarea 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-850 focus:outline-none focus:border-indigo-500 focus:bg-white min-h-[120px] font-mono text-sm leading-relaxed shadow-inner" 
              placeholder="输入任意要隐藏的机密文本..." 
            />
          ) : (
            <div className="w-full border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/70 transition-colors relative group">
              <input type="file" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              {inputFileData ? (
                <div className="flex flex-col items-center text-emerald-600 animate-fade-in">
                  <CheckCircle2 size={36} className="mb-2" />
                  <span className="font-bold text-sm">{inputFileName}</span>
                  <span className="text-xs text-slate-500 mt-1">已执行最高等级 Zlib 压缩算法就绪</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-slate-500 group-hover:text-indigo-600 transition-colors">
                  <UploadCloud size={36} className="mb-2" />
                  <span className="font-bold text-sm">点击或拖拽上传极小文件 (建议 Max: 1.5KB)</span>
                  <span className="text-xs text-slate-400 mt-1">支持：文本、密钥、迷你Icon、签名等文件</span>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={handleGenerate} 
            disabled={loading || (mode === 'text' ? !inputText : !inputFileData)} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 px-8 py-3.5 rounded-lg font-bold text-white transition-all shadow-md hover:shadow-indigo-500/10 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : '执行 Zlib 极限压缩并生成视觉分片'}
          </button>
        </div>
      </div>

      {/* 步骤 2：输出分离凭证 */}
      {shares.share1 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 animate-fade-in no-print shadow-md" id="printable-section">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-indigo-600">2. 分发安全凭证</h3>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-[10px] font-mono font-bold">无需物理密钥</span>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            已成功将机密秘密直接隐写并拆分为以下实体媒介，只有重叠 A 与 B 物理分片，才能使隐写诱饵二维码正确显示。
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 完整隐写二维码高清母版 */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col items-center shadow-inner">
              <span className="mb-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-200 flex items-center gap-1.5">
                <FileJson size={13}/> 高清隐写母版 (免折叠)
              </span>
              <p className="text-xs text-slate-500 mb-4 text-center leading-relaxed">
                此图为合并后的完整隐写二维码，可直接使用直扫通道还原原始机密。
              </p>
              <div className="bg-white p-2 rounded shadow-sm border border-slate-200 mb-4 flex items-center justify-center">
                <img src={shares.ciphertextQr} className="max-w-[170px] w-full" alt="Ciphertext QR" />
              </div>
              <button 
                onClick={() => downloadFile(shares.ciphertextQr, "Stego_Master_QR.png")} 
                className="btn-secondary w-full mt-auto border-slate-300 hover:border-indigo-500"
              >
                <Download size={14}/> 下载高清隐写码
              </button>
            </div>

            {/* 物理秘密分发分片 */}
            <div className="md:col-span-2 bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner flex flex-col">
              <span className="mb-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-200 self-center flex items-center gap-1.5">
                <KeyRound size={13}/> 物理分解密钥分片 (VC Shares)
              </span>
              <p className="text-xs text-slate-500 mb-4 text-center leading-relaxed">
                两张完全独立、不包含任何可识别特征的视觉分片。只有物理堆叠才能生成扫码纹理。
              </p>
              
              <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 mb-4 relative min-h-[220px]">
                {!isPreview ? (
                  <>
                    <div className="flex flex-col items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="bg-white p-1 rounded">
                        <img src={shares.share1} className="max-w-[150px] w-full pixelated-image" alt="Share A" />
                      </div>
                      <button onClick={() => downloadFile(shares.share1, "VC_Share_A.png")} className="mt-2.5 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"><Download size={12}/> 下载 分片 A</button>
                    </div>
                    <div className="flex flex-col items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="bg-white p-1 rounded">
                        <img src={shares.share2} className="max-w-[150px] w-full pixelated-image" alt="Share B" />
                      </div>
                      <button onClick={() => downloadFile(shares.share2, "VC_Share_B.png")} className="mt-2.5 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"><Download size={12}/> 下载 分片 B</button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center bg-white p-4 rounded-xl border border-emerald-500/30 shadow-md animate-fade-in">
                    <div className="bg-white p-2 rounded">
                      <img src={shares.previewClean} className="max-w-[170px] w-full pixelated-image" alt="Preview" />
                    </div>
                    <span className="mt-3 text-xs text-emerald-600 font-mono font-bold flex items-center gap-1">
                      <CheckCircle2 size={12}/> 物理对准叠合复原图
                    </span>
                  </div>
                )}
              </div>

              <button onClick={() => setIsPreview(!isPreview)} className="btn-secondary w-full mt-auto">
                {isPreview ? <Layers size={14} /> : <Search size={14} />} 
                {isPreview ? '返回分片下载面板' : '预览分片叠合效果'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= DecryptView (扫码直扫 / 物理叠合) =================
function DecryptView({ showToast, libsReady }) {
  const [decryptTab, setDecryptTab] = useState('direct'); 

  // 叠合微调
  const [imgA, setImgA] = useState(null);
  const [imgB, setImgB] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // 异步状态控制
  const [isPurifying, setIsPurifying] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);

  // 叠合净化状态
  const [purifiedImg, setPurifiedImg] = useState(null);
  const [showPurified, setShowPurified] = useState(false);

  // 单图直扫 (专精高效 Camera 实时直扫还原)
  const [isLiveScanning, setIsLiveScanning] = useState(false);
  const [isDecodingCamera, setIsDecodingCamera] = useState(false);
  
  // 明文结果
  const [finalResult, setFinalResult] = useState(null);

  const html5QrCodeRef = useRef(null);

  const handleUpload = (e, setImgState) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImgState(event.target.result);
        setPurifiedImg(null);
        setShowPurified(false);
        showToast("图像成功载入，请利用方向键精密对准", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const move = (dx, dy) => {
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    if (showPurified) {
      setShowPurified(false); // 对齐偏移发生改变，需要重新净化以防止展示失效图像
    }
  };

  // --- 💡 核心算法：前端高纯度像素级硬合并（布尔逻辑 AND 运算） ---
  const generateMergedBlob = async () => {
    if (!imgA || !imgB) return null;
    const image1 = new Image(); 
    const image2 = new Image();
    const loadImg = (img, src) => new Promise(resolve => { img.onload = resolve; img.src = src; });
    await Promise.all([loadImg(image1, imgA), loadImg(image2, imgB)]);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image1.width; 
    canvas.height = image1.height;
    
    // 先铺设绝对纯白背景作为防护层
    ctx.fillStyle = "#FFFFFF"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const canvasA = document.createElement('canvas');
    const ctxA = canvasA.getContext('2d');
    canvasA.width = canvas.width; canvasA.height = canvas.height;
    ctxA.drawImage(image1, 0, 0);
    const imgDataA = ctxA.getImageData(0, 0, canvas.width, canvas.height).data;

    const canvasB = document.createElement('canvas');
    const ctxB = canvasB.getContext('2d');
    canvasB.width = canvas.width; canvasB.height = canvas.height;
    ctxB.drawImage(image2, offset.x, offset.y);
    const imgDataB = ctxB.getImageData(0, 0, canvas.width, canvas.height).data;

    const finalImgData = ctx.createImageData(canvas.width, canvas.height);
    const d = finalImgData.data;

    // 像素与逻辑：只要任意分片在该坐标对应黑点，叠合图即认定为纯黑
    for (let i = 0; i < imgDataA.length; i += 4) {
      const rA = imgDataA[i];
      const rB = imgDataB[i];
      const aA = imgDataA[i+3];
      const aB = imgDataB[i+3];

      const isBlackA = (rA < 128 && aA > 50);
      const isBlackB = (rB < 128 && aB > 50);

      if (isBlackA || isBlackB) {
        d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 255;
      } else {
        d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 255;
      }
    }
    
    ctx.putImageData(finalImgData, 0, 0);
    return new Promise(res => canvas.toBlob(res, 'image/png'));
  };

  // --- ⚡ 阶段一：纯重建层提取 (查看自动净化) ---
  const handlePurifyOverlay = async () => {
    if (!imgA || !imgB) return;
    setIsPurifying(true);
    try {
      const blob = await generateMergedBlob();
      const formData = new FormData();
      formData.append('file', blob, 'overlay_composite.png');

      const response = await fetch(getApiUrl('/purify_only'), { method: 'POST', body: formData });
      const data = await response.json();

      if (data.status === 'success' && data.cleanImage) {
        setPurifiedImg(data.cleanImage);
        setShowPurified(true);
        showToast("OpenCV 空间域低通去噪完毕，条纹连通性完美修复！", "success");
      } else {
        showToast("净化失败，请检查分片边缘是否对齐", "error");
      }
    } catch (err) {
      showToast("连接后端净化引擎超时: " + err.message, "error");
    } finally {
      setIsPurifying(false);
    }
  };

  // --- 🔍 阶段二：业务解密层提取 (云端识别) ---
  const handleExtractOverlay = async () => {
    if (!imgA || !imgB) return;
    setIsDecoding(true);
    try {
      const blob = await generateMergedBlob();
      const formData = new FormData();
      formData.append('file', blob, 'overlay_composite.png');

      const response = await fetch(getApiUrl('/decode'), { method: 'POST', body: formData });
      const data = await response.json();

      if (data.status === 'success') {
        setFinalResult(data.content);
        if (data.cleanImage) {
          setPurifiedImg(data.cleanImage);
          setShowPurified(true);
        }
        showToast("解密矩阵捕获，秘密共享信道激活成功！", "success");
      } else {
        // 识别失败时，若后端返回了净化后的图像（即使无法解析出二维码文本），仍更新底图供微调参考
        if (data.cleanImage) {
          setPurifiedImg(data.cleanImage);
          setShowPurified(true);
        }
        showToast(data.error || "提取失败，请利用对齐罗盘微调像素偏置", "error");
      }
    } catch (err) {
      showToast("网络数据传输异常", "error");
    } finally {
      setIsDecoding(false);
    }
  };

  // --- 调取摄像头执行实时二维码捕获 ---
  const startLiveScan = () => {
    if (!libsReady || !window.Html5Qrcode) {
      showToast("解析依赖项正在加载，请稍候再试...", "info");
      return;
    }
    setIsLiveScanning(true);
    setTimeout(() => {
      try {
        html5QrCodeRef.current = new window.Html5Qrcode("live-reader");
        html5QrCodeRef.current.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 260, height: 260 } },
          async (decodedText) => {
            if (decodedText) {
              let hiddenPayload = "";
              if (decodedText.includes("[VC-S]")) {
                hiddenPayload = decodedText.split("[VC-S]")[1];
              } else if (decodedText.includes("[VC-STEGO]")) {
                hiddenPayload = decodedText.split("[VC-STEGO]")[1];
              }
              
              if (hiddenPayload) {
                stopLiveScan();
                await executeDirectPayloadDecrypt(hiddenPayload.trim());
              } else {
                showToast("非隐写专属二维码，无法在此进行压缩解密", "info");
              }
            }
          },
          (err) => { /* 捕捉对焦中断，保持静默扫码 */ }
        ).catch((err) => {
          showToast("未能获取摄像头权限或设备不可达", "error");
          setIsLiveScanning(false);
        });
      } catch (err) {
        showToast("摄像头初始化失败", "error");
        setIsLiveScanning(false);
      }
    }, 200);
  };

  const stopLiveScan = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current.clear();
        setIsLiveScanning(false);
      }).catch(() => setIsLiveScanning(false));
    } else {
      setIsLiveScanning(false);
    }
  };

  // 一键自适应极速解密
  const executeDirectPayloadDecrypt = async (payloadData) => {
    setIsDecodingCamera(true);
    try {
      const formData = new FormData();
      formData.append('payload', payloadData);
      formData.append('key', ''); 

      const response = await fetch(getApiUrl('/decrypt_payload'), { method: 'POST', body: formData });
      const data = await response.json();
      
      if (data.status === 'success') {
        setFinalResult(data.content);
        showToast("安全密函已还原成功！", "success");
      } else {
        showToast("数据流解压失败，密文可能在传输/扫码时受损：" + (data.error || ""), "error");
      }
    } catch (err) {
      showToast("连接后端解密服务超时", "error");
    } finally {
      setIsDecodingCamera(false);
    }
  };

  // 最终解密明文气泡卡片渲染
  const renderDecryptedContent = () => {
    if (!finalResult) return null;

    if (finalResult.startsWith('data:')) {
      const isImage = finalResult.startsWith('data:image/');
      return (
        <div className="flex flex-col items-center w-full animate-fade-in">
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl w-full flex flex-col items-center justify-center mb-6 shadow-inner">
            {isImage ? (
              <img src={finalResult} alt="Decrypted Content" className="max-w-[210px] w-full rounded shadow-md border-2 border-indigo-500 bg-white pixelated-image" />
            ) : (
              <div className="flex flex-col items-center text-indigo-600 py-6">
                <FileText size={52} className="mb-2 animate-bounce" />
                <span className="font-bold text-sm text-slate-700">安全载体二进制流解密成功</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => downloadFile(finalResult, isImage ? "restored_image.png" : "restored_file")} 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <Download size={18} /> 保存并下载还原文件
          </button>
        </div>
      );
    }

    return (
      <div className="w-full animate-fade-in">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 mb-6 max-h-60 overflow-y-auto font-mono text-sm leading-relaxed text-indigo-800 break-all whitespace-pre-wrap select-text shadow-inner">
          {finalResult}
        </div>
        <button 
          onClick={() => {
            document.execCommand('copy') || navigator.clipboard?.writeText(finalResult); 
            showToast("已成功复制机密到剪贴板！", "success")
          }} 
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
        >
          <Copy size={18} /> 复制机密纯文本
        </button>
      </div>
    );
  };

  const renderUploadBox = (label, imgState, setImgState, id) => (
    <div className="flex-1">
      <div className="relative">
        <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setImgState)} className="hidden" id={id} />
        <label 
          htmlFor={id} 
          className={`flex flex-col items-center justify-center gap-1.5 w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            imgState 
              ? 'border-emerald-500 bg-emerald-50 text-emerald-600' 
              : 'border-slate-300 hover:border-indigo-400 hover:bg-white text-slate-500 bg-slate-50'
          }`}
        >
          {imgState ? (
            <>
              <CheckCircle2 size={22} className="text-emerald-500 animate-fade-in" />
              <span className="text-xs font-semibold text-emerald-600">{label}已导入</span>
            </>
          ) : (
            <>
              <Camera size={22} className="text-slate-400" />
              <span className="text-xs font-semibold">导入{label}</span>
            </>
          )}
        </label>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      
      {/* 解码明文弹出层 */}
      {finalResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-emerald-500 shadow-2xl p-6 animate-fade-in">
            <div className="flex justify-between items-start mb-5 border-b border-slate-200 pb-3">
              <h3 className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                <Unlock size={24} className="animate-pulse" /> 隐写秘密提取成功
              </h3>
              <button onClick={() => setFinalResult(null)} className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            {renderDecryptedContent()}
          </div>
        </div>
      )}

      {/* 实时扫码模态窗口 */}
      {isLiveScanning && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 p-4 no-print">
          <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden border border-slate-200 relative flex flex-col animate-fade-in shadow-2xl">
            <div className="p-4 bg-slate-50 flex justify-between items-center border-b border-slate-200">
              <h3 className="font-bold text-sm flex items-center gap-2 text-indigo-600">
                <ScanLine size={16} className="animate-pulse" /> 扫描物理复原矩阵
              </h3>
              <button onClick={stopLiveScan} className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={18}/>
              </button>
            </div>
            {/* 摄像头容器 */}
            <div id="live-reader" className="w-full bg-black min-h-[320px] relative"></div>
            <div className="p-4 bg-slate-50 text-[11px] text-slate-500 text-center leading-relaxed">
              将叠合后的分片放置在镜头框架内。<br/>
              <span className="text-indigo-600 font-bold">物理对准：保证纸张展开无褶皱，环境光线充足可提升通过速度。</span>
            </div>
          </div>
        </div>
      )}

      {/* 解码模式选择器 */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-xl border border-slate-300 max-w-md mx-auto w-full shadow-sm">
        <button 
          onClick={() => setDecryptTab('direct')}
          className={`py-2 px-4 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            decryptTab === 'direct' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera size={14} /> 直接直扫还原
        </button>
        <button 
          onClick={() => setDecryptTab('overlay')}
          className={`py-2 px-4 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            decryptTab === 'overlay' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={14} /> 物理双片叠合解析
        </button>
      </div>

      {/* 模式一：直接扫描与还原 */}
      {decryptTab === 'direct' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-md flex flex-col md:flex-row gap-6 items-center animate-fade-in">
          <div className="w-full md:w-1/3 flex flex-col gap-2 border-slate-200 pr-0 md:pr-4 border-b md:border-b-0 md:border-r pb-4 md:pb-0">
            <h3 className="text-lg font-bold text-indigo-600 flex items-center gap-2">
              <Camera size={20}/> 1. 摄像头直扫
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              使用您的移动端、平板或电脑摄像头，直接扫描并即时还原出已物理堆叠或合并的高清二维码图案。
            </p>
          </div>
          <div className="w-full md:w-2/3 flex flex-col items-center justify-center p-4">
            {isDecodingCamera ? (
              <div className="w-full max-w-md h-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl text-slate-500">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
                <span className="text-xs font-semibold">正在智能清洗与还原数据流...</span>
              </div>
            ) : (
              <button 
                onClick={startLiveScan} 
                className="w-full max-w-md h-32 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/50 text-indigo-600 transition-all rounded-2xl cursor-pointer group shadow-sm"
              >
                <ScanLine size={32} className="group-hover:scale-110 text-indigo-500 transition-all duration-300" />
                <span className="text-xs font-bold tracking-wide">启动摄像头扫码</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 模式二：物理叠合微调解析 */}
      {decryptTab === 'overlay' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-6 animate-fade-in shadow-md">
          <div className="w-full md:w-1/3 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-slate-200 pr-0 md:pr-4 pb-4 md:pb-0">
            <h3 className="text-lg font-bold text-emerald-600 flex items-center gap-2">
              <Layers size={20}/> 1. 上传物理分片
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              分别加载拆分得到的分片 A 与分片 B。利用方向控制按钮将其严密对准。
            </p>
            <div className="flex gap-2 w-full">
              {renderUploadBox("分片 A", imgA, setImgA, "keyA")}
              {renderUploadBox("分片 B", imgB, setImgB, "keyB")}
            </div>
            
            {/* 微调控制罗盘 */}
            {imgA && imgB && (
              <div className="flex flex-col items-center mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
                <span className="text-[10px] text-slate-500 font-bold mb-2 uppercase tracking-wider">叠合对齐偏置控制</span>
                <div className="grid grid-cols-3 gap-1.5 w-28 mx-auto">
                  <div />
                  <button onClick={() => move(0, -1)} className="ctrl-btn py-1 text-sm">↑</button>
                  <div />
                  <button onClick={() => move(-1, 0)} className="ctrl-btn py-1 text-sm">←</button>
                  <button onClick={() => setOffset({x:0, y:0})} className="ctrl-btn py-1 text-[11px] bg-indigo-50 text-indigo-600 border border-indigo-200">●</button>
                  <button onClick={() => move(1, 0)} className="ctrl-btn py-1 text-sm">→</button>
                  <div />
                  <button onClick={() => move(0, 1)} className="ctrl-btn py-1 text-sm">↓</button>
                  <div />
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-500">
                  水平偏移: {offset.x}px | 垂直偏移: {offset.y}px
                </div>
              </div>
            )}
          </div>

          <div className="w-full md:w-2/3 flex flex-col items-center justify-center gap-4 relative min-h-[280px] bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shadow-inner p-4">
            {imgA && imgB ? (
              <>
                {/* 🌟 阶段一：自动净化切换（对准后右上角常驻） */}
                <div className="absolute top-4 right-4 z-30 flex gap-2">
                  {showPurified && purifiedImg ? (
                    <button 
                      onClick={() => setShowPurified(false)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer animate-fade-in"
                    >
                      <EyeOff size={13}/> 返回物理叠合
                    </button>
                  ) : (
                    <button 
                      onClick={handlePurifyOverlay}
                      disabled={isPurifying}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-60 animate-fade-in"
                    >
                      {isPurifying ? (
                        <>
                          <Loader2 className="animate-spin" size={13} />
                          正在重构滤波...
                        </>
                      ) : (
                        <>
                          <Eye size={13}/> 查看自动净化效果
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* 核心叠层渲染区 */}
                {showPurified && purifiedImg ? (
                  <div className="flex flex-col items-center justify-center animate-fade-in">
                    <span className="mb-2.5 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                      <CheckCircle2 size={13} /> 图像已自动净化 (二值化抗噪码)
                    </span>
                    <div className="bg-white p-3 rounded-xl shadow-md border-2 border-emerald-500 max-w-[190px] w-full">
                      <img src={purifiedImg} className="w-full pixelated-image animate-fade-in" alt="Purified QR" />
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center w-full h-full min-h-[220px]">
                    {/* 固定分片 A */}
                    <img src={imgA} className="absolute z-10 pixelated-image mix-blend-multiply opacity-90 max-h-[190px] select-none pointer-events-none animate-fade-in" alt="A" />
                    {/* 漂移分片 B */}
                    <img 
                      src={imgB} 
                      className="absolute z-20 pixelated-image mix-blend-multiply opacity-90 transition-transform duration-75 max-h-[190px] select-none pointer-events-none" 
                      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} 
                      alt="B" 
                    />
                  </div>
                )}
                
                {/* 🌟 阶段二：云端深度识别还原明文（右下角） */}
                <button 
                  onClick={handleExtractOverlay} 
                  disabled={isDecoding} 
                  className="absolute bottom-4 right-4 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer text-xs"
                >
                  {isDecoding ? (
                    <>
                      <Loader2 className="animate-spin" size={14}/> 云端识别中...
                    </>
                  ) : (
                    <>
                      <Cloud size={14}/> ☁️ 云端识别与还原
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center text-slate-400 py-10">
                <HelpCircle size={40} className="mb-2 opacity-60 text-slate-300" />
                <span className="text-sm font-semibold">等待导入视觉分片 A + B...</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}