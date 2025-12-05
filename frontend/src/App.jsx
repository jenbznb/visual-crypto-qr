import { useState, useEffect, useRef } from 'react';
import { Layers, ShieldCheck, Download, Upload, Move, CheckCircle2, Lock, Unlock, Camera, X, ScanLine, Printer, AlertCircle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function App() {
  const [activeTab, setActiveTab] = useState('encrypt');

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto font-sans text-slate-100 pb-20">
      {/* 顶部标题 (打印时隐藏) */}
      <header className="mb-8 text-center no-print">
        <h1 className="text-3xl md:text-5xl font-bold flex items-center justify-center gap-3 text-indigo-400 mb-2">
          <ShieldCheck size={40} className="md:w-12 md:h-12" />
          Visual Crypto QR
        </h1>
        <p className="text-slate-400 text-sm md:text-base">Naor-Shamir (2,2) 视觉秘密共享算法演示</p>
      </header>

      {/* Tab 切换 (打印时隐藏) */}
      <div className="flex p-1 bg-slate-800 rounded-xl mb-8 border border-slate-700 no-print">
        <button
          onClick={() => setActiveTab('encrypt')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${
            activeTab === 'encrypt' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Lock size={18} /> 生成加密
        </button>
        <button
          onClick={() => setActiveTab('decrypt')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${
            activeTab === 'decrypt' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Unlock size={18} /> 拍照解密
        </button>
      </div>

      <div className="w-full animate-fade-in">
        {activeTab === 'encrypt' ? <EncryptView /> : <DecryptView />}
      </div>
    </div>
  );
}

/**
 * 子组件：二维码扫描模态框
 */
function QrScannerModal({ onScanSuccess, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render((decodedText) => {
      onScanSuccess(decodedText);
      scanner.clear();
    }, (error) => {
      // ignore errors
    });

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 overflow-hidden relative shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <h3 className="font-bold flex items-center gap-2 text-white">
            <ScanLine size={20} className="text-indigo-400"/> 扫描二维码
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition-colors text-white">
            <X size={24} />
          </button>
        </div>
        <div className="p-4 bg-slate-900">
          <div id="reader" className="w-full rounded-lg overflow-hidden"></div>
          <p className="text-center text-xs text-slate-500 mt-4">
            请将标准二维码置于框内，识别成功后将自动填入输入框。
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 模块一：加密 (EncryptView) - 包含打印和 Render 唤醒提示
 */
function EncryptView() {
  const [inputText, setInputText] = useState('https://hunyuan.ggff.net');
  const [loading, setLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false); // Render 唤醒状态
  const [shares, setShares] = useState({ share1: null, share2: null });
  const [isOverlaid, setIsOverlaid] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  const canvasRef = useRef(null);

  const handleGenerate = async () => {
    setLoading(true);
    setSlowLoading(false);
    setShares({ share1: null, share2: null });
    setIsOverlaid(false);
    
    // 如果 3 秒后还没返回，显示唤醒提示
    const timer = setTimeout(() => {
      setSlowLoading(true);
    }, 3000);

    try {
      const formData = new FormData();
      formData.append('text', inputText);
      const apiUrl = window.location.hostname.includes('localhost') 
        ? 'http://localhost:8000/generate' 
        : 'https://api.hunyuan.ggff.net/generate';

      const response = await fetch(apiUrl, { method: 'POST', body: formData });
      const data = await response.json();
      
      if (data.status === 'success') {
        setShares({ share1: data.share1, share2: data.share2 });
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('连接后端失败。请确保后端已启动。');
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setSlowLoading(false);
    }
  };

  const handlePrint = () => {
    setIsOverlaid(false); // 强制分离，方便打印剪裁
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadCombined = () => {
    if (!shares.share1 || !shares.share2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img1 = new Image();
    const img2 = new Image();

    img1.src = shares.share1;
    img1.onload = () => {
      canvas.width = img1.width;
      canvas.height = img1.height;
      ctx.drawImage(img1, 0, 0);
      img2.src = shares.share2;
      img2.onload = () => {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img2, 0, 0);
        const link = document.createElement('a');
        link.download = 'visual_crypto_combined.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        ctx.globalCompositeOperation = 'source-over';
      };
    };
  };

  return (
    <div className="flex flex-col gap-8">
      {showScanner && (
        <QrScannerModal 
          onClose={() => setShowScanner(false)}
          onScanSuccess={(text) => {
            setInputText(text);
            setShowScanner(false);
          }}
        />
      )}

      {/* 输入区域 (打印隐藏) */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl no-print">
        <label className="block text-slate-400 mb-2 text-sm font-semibold uppercase tracking-wider">加密内容</label>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex gap-2">
             <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none text-white transition-colors"
              placeholder="输入文本或扫描二维码..."
            />
            <button 
              onClick={() => setShowScanner(true)}
              className="bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 px-3 rounded-lg transition-colors flex items-center justify-center"
              title="扫描普通二维码"
            >
              <ScanLine size={20} />
            </button>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 px-8 py-3 rounded-lg font-bold text-white transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap min-w-[120px]"
          >
            {loading ? '计算中...' : '生成密钥'}
          </button>
        </div>

        {/* Render 唤醒提示 */}
        {slowLoading && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3 text-amber-200 animate-fade-in">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">服务器正在唤醒中...</p>
              <p className="opacity-80">Render 免费实例会在闲置后休眠，初次启动可能需要 30-50 秒，请耐心等待，不要刷新页面。</p>
            </div>
          </div>
        )}
      </div>

      {/* 结果展示 */}
      {shares.share1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
          
          {/* 左侧：控制面板 (打印隐藏) */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-fit no-print">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-300">
              <Layers size={20} /> 图层控制
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={() => setIsOverlaid(!isOverlaid)}
                className={`w-full py-3 rounded-lg font-semibold transition-all border ${
                  isOverlaid 
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {isOverlaid ? '分离图层' : '合并图层 (预览)'}
              </button>

              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-700">
                 <a href={shares.share1} download="share_A.png" className="btn-secondary">
                   <Download size={14}/> 下载图层 A
                 </a>
                 <a href={shares.share2} download="share_B.png" className="btn-secondary">
                   <Download size={14}/> 下载图层 B
                 </a>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                 <button onClick={handleDownloadCombined} className="btn-secondary hover:text-emerald-400 hover:border-emerald-500">
                   <CheckCircle2 size={14} /> 下载合成图
                 </button>
                 <button onClick={handlePrint} className="btn-secondary hover:text-indigo-400 hover:border-indigo-500">
                   <Printer size={14} /> 打印图纸
                 </button>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              * 提示：点击“打印图纸”可生成适合剪裁的黑白图纸。
            </p>
          </div>

          {/* 右侧：可视化区域 (打印核心区域) */}
          {/* id="printable-section" 配合 CSS @media print 使用 */}
          <div id="printable-section" className="relative bg-white rounded-xl p-4 md:p-8 flex items-center justify-center min-h-[400px] border border-slate-600 shadow-2xl overflow-hidden select-none">
            
            {/* 打印时显示的标题 */}
            <div className="hidden print:block absolute top-4 text-black text-center w-full">
               <h2 className="text-xl font-bold">Visual Crypto Shares</h2>
               <p className="text-sm text-gray-500">打印后沿边框剪下，重叠即可查看秘密信息。</p>
            </div>

            {/* 图层 A */}
            <img 
              src={shares.share1} 
              className={`absolute max-w-[80%] pixelated-image transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                 isOverlaid 
                   ? 'opacity-100' 
                   : '-translate-x-6 -rotate-3 opacity-80 print:static print:translate-x-0 print:rotate-0 print:m-4 print:border print:border-dashed print:border-gray-400' 
              }`}
              style={{ mixBlendMode: 'multiply' }} 
            />

            {/* 图层 B */}
            <img 
              src={shares.share2} 
              className={`absolute max-w-[80%] pixelated-image transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                 isOverlaid 
                   ? 'opacity-100' 
                   : 'translate-x-6 rotate-3 opacity-80 print:static print:translate-x-0 print:rotate-0 print:m-4 print:border print:border-dashed print:border-gray-400'
              }`}
              style={{ mixBlendMode: 'multiply' }} 
            />
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

/**
 * 模块二：解密 (DecryptView) - 完整保留
 */
function DecryptView() {
  const [imgA, setImgA] = useState(null);
  const [imgB, setImgB] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleUpload = (e, setImg) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImg(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const move = (dx, dy) => setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));

  const renderUploadButton = (label, imgState, setImgState, id) => (
    <div className="upload-box">
      <label className="text-sm text-slate-400 mb-1 block">{label}</label>
      <div className="relative">
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => handleUpload(e, setImgState)} 
          className="hidden" 
          id={id} 
        />
        <label 
          htmlFor={id} 
          className={`flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
            imgState 
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' 
              : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-700 text-slate-400'
          }`}
        >
           {imgState ? (
             <>
               <CheckCircle2 size={24} />
               <span className="text-xs">已加载</span>
             </>
           ) : (
             <>
               <Camera size={24} />
               <span className="text-xs">拍照 / 上传</span>
             </>
           )}
        </label>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
      {/* 左侧：操作区 */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2">
            <Camera size={20}/> 1. 获取图层
          </h3>
          <p className="text-xs text-slate-500 mb-4 bg-slate-900/50 p-2 rounded">
            提示：如果是纸质分片，请尽量垂直俯拍以减少畸变。推荐直接上传原图文件。
          </p>
          <div className="grid grid-cols-2 gap-4">
            {renderUploadButton("图层 A", imgA, setImgA, "fileA")}
            {renderUploadButton("图层 B", imgB, setImgB, "fileB")}
          </div>
        </div>

        {imgA && imgB && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 animate-fade-in">
             <h3 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2">
               <Move size={18} /> 2. 对齐微调
             </h3>
             <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
                <div />
                <button onClick={() => move(0, -1)} className="ctrl-btn">↑</button>
                <div />
                <button onClick={() => move(-1, 0)} className="ctrl-btn">←</button>
                <button onClick={() => setOffset({x:0, y:0})} className="ctrl-btn text-xs">●</button>
                <button onClick={() => move(1, 0)} className="ctrl-btn">→</button>
                <div />
                <button onClick={() => move(0, 1)} className="ctrl-btn">↓</button>
                <div />
             </div>
             <p className="text-center text-xs text-slate-500 mt-2">偏移: X{offset.x}, Y{offset.y}</p>
          </div>
        )}
      </div>

      {/* 右侧：合成预览 */}
      <div className="lg:col-span-2 bg-slate-900 rounded-xl p-4 border border-slate-700 flex flex-col items-center justify-center min-h-[500px]">
        {!imgA || !imgB ? (
           <div className="text-slate-500 flex flex-col items-center text-center p-8">
             <Layers size={48} className="mb-4 opacity-50" />
             <p>请上传两张分片</p>
             <p className="text-sm opacity-60 mt-2 max-w-md">
               你可以直接用手机拍摄纸质分片，或者上传下载好的噪点图。系统将自动应用正片叠底模式。
             </p>
           </div>
        ) : (
          <div className="relative bg-white w-full h-full min-h-[400px] rounded flex items-center justify-center overflow-hidden">
             <div className="relative w-full h-full flex items-center justify-center">
                <div className="relative max-w-full max-h-full">
                  <img src={imgA} className="relative z-10 pixelated-image mix-blend-multiply opacity-80 max-w-[300px] md:max-w-[400px]" />
                  <img 
                    src={imgB} 
                    className="absolute top-0 left-0 z-20 pixelated-image mix-blend-multiply opacity-80 transition-transform duration-75 max-w-[300px] md:max-w-[400px]"
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
                  />
                </div>
             </div>
             <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-30 pointer-events-none">
                混合模式: Multiply
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
