import { useState, useRef, useEffect } from 'react';
import { Layers, ShieldCheck, Download, Upload, Move, CheckCircle2, Lock, Unlock } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('encrypt'); // 'encrypt' | 'decrypt'

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto font-sans text-slate-100">
      {/* 顶部标题 */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-bold flex items-center justify-center gap-3 text-indigo-400 mb-2">
          <ShieldCheck size={40} className="md:w-12 md:h-12" />
          Visual Crypto QR
        </h1>
        <p className="text-slate-400 text-sm md:text-base">Naor-Shamir (2,2) 视觉秘密共享算法演示</p>
      </header>

      {/* Tab 切换导航 */}
      <div className="flex p-1 bg-slate-800 rounded-xl mb-8 border border-slate-700">
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
          <Unlock size={18} /> 上传解密
        </button>
      </div>

      {/* 动态渲染对应模块 */}
      <div className="w-full animate-fade-in">
        {activeTab === 'encrypt' ? <EncryptView /> : <DecryptView />}
      </div>
    </div>
  );
}

/**
 * ==========================================
 * 模块一：加密 (EncryptView)
 * ==========================================
 */
function EncryptView() {
  const [inputText, setInputText] = useState('https://hunyuan.ggff.net');
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState({ share1: null, share2: null });
  const [isOverlaid, setIsOverlaid] = useState(false);
  
  // 用于合成下载的隐藏 Canvas
  const canvasRef = useRef(null);

  const handleGenerate = async () => {
    setLoading(true);
    setShares({ share1: null, share2: null });
    setIsOverlaid(false);
    try {
      const formData = new FormData();
      formData.append('text', inputText);
      
      // 这里的 URL 请根据实际部署修改
      const apiUrl = window.location.hostname === 'localhost' 
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
      setLoading(false);
    }
  };

  // 在浏览器端合成并下载
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
      // 绘制第一层
      ctx.drawImage(img1, 0, 0);
      
      img2.src = shares.share2;
      img2.onload = () => {
        // 设置混合模式为正片叠底 (Multiply)
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img2, 0, 0);
        
        // 导出图片
        const link = document.createElement('a');
        link.download = 'combined_secret.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // 重置混合模式
        ctx.globalCompositeOperation = 'source-over';
      };
    };
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 输入框 */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
        <label className="block text-slate-400 mb-2 text-sm font-semibold uppercase tracking-wider">加密内容</label>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none text-white transition-colors"
            placeholder="输入网址、私钥或秘密信息..."
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 px-8 py-3 rounded-lg font-bold text-white transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap"
          >
            {loading ? '计算中...' : '生成密钥'}
          </button>
        </div>
      </div>

      {/* 结果展示 */}
      {shares.share1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
          
          {/* 左侧：控制面板 */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-fit">
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
                {isOverlaid ? '分离图层 (Split)' : '合并图层 (Merge)'}
              </button>

              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-700">
                 <a href={shares.share1} download="share_A.png" className="btn-secondary">
                   <Download size={14}/> 下载图层 A
                 </a>
                 <a href={shares.share2} download="share_B.png" className="btn-secondary">
                   <Download size={14}/> 下载图层 B
                 </a>
              </div>
              
              <button onClick={handleDownloadCombined} className="w-full mt-2 btn-secondary bg-slate-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-500">
                <CheckCircle2 size={14} /> 下载已合成的二维码
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              * 提示：下载的单张图层只是随机噪点。只有当两张图层在“正片叠底”模式下叠加，或打印在透明胶片上重叠时，信息才会显现。
            </p>
          </div>

          {/* 右侧：可视化区域 */}
          <div className="relative bg-white rounded-xl p-4 md:p-8 flex items-center justify-center min-h-[400px] border border-slate-600 shadow-2xl overflow-hidden select-none">
            {/* 图层 A */}
            <img 
              src={shares.share1} 
              className={`absolute max-w-[80%] pixelated-image transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                 isOverlaid ? 'translate-x-0 rotate-0 opacity-100' : '-translate-x-12 -rotate-3 opacity-80' 
              }`}
              style={{ mixBlendMode: 'multiply' }} 
            />
            {/* 图层 B */}
            <img 
              src={shares.share2} 
              className={`absolute max-w-[80%] pixelated-image transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                 isOverlaid ? 'translate-x-0 rotate-0 opacity-100' : 'translate-x-12 rotate-3 opacity-80'
              }`}
              style={{ mixBlendMode: 'multiply' }} 
            />
          </div>
        </div>
      )}
      
      {/* 隐藏的 Canvas 用于生成图片 */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

/**
 * ==========================================
 * 模块二：解密 (DecryptView)
 * ==========================================
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

  // 微调控制
  const move = (dx, dy) => setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 左侧：上传区域 */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-bold mb-4 text-emerald-400">1. 上传图层</h3>
          
          <div className="space-y-4">
            <div className="upload-box">
              <label className="text-sm text-slate-400 mb-1 block">图层 A (Share 1)</label>
              <div className="relative">
                <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setImgA)} className="hidden" id="fileA" />
                <label htmlFor="fileA" className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-slate-700 transition-all">
                   <Upload size={16} /> {imgA ? '已选择图片' : '点击上传'}
                </label>
              </div>
            </div>

            <div className="upload-box">
              <label className="text-sm text-slate-400 mb-1 block">图层 B (Share 2)</label>
              <div className="relative">
                <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setImgB)} className="hidden" id="fileB" />
                <label htmlFor="fileB" className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-slate-700 transition-all">
                   <Upload size={16} /> {imgB ? '已选择图片' : '点击上传'}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 微调控制 */}
        {imgA && imgB && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 animate-fade-in">
             <h3 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2">
               <Move size={18} /> 2. 对齐微调
             </h3>
             <p className="text-xs text-slate-400 mb-4">如果图片未对齐，请点击下方箭头移动顶部图层。</p>
             
             <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
                <div />
                <button onClick={() => move(0, -1)} className="ctrl-btn">↑</button>
                <div />
                <button onClick={() => move(-1, 0)} className="ctrl-btn">←</button>
                <button onClick={() => setOffset({x:0, y:0})} className="ctrl-btn text-xs">重置</button>
                <button onClick={() => move(1, 0)} className="ctrl-btn">→</button>
                <div />
                <button onClick={() => move(0, 1)} className="ctrl-btn">↓</button>
                <div />
             </div>
             <p className="text-center text-xs text-slate-500 mt-2">X: {offset.x}px, Y: {offset.y}px</p>
          </div>
        )}
      </div>

      {/* 右侧：合成预览 */}
      <div className="lg:col-span-2 bg-slate-900 rounded-xl p-4 border border-slate-700 flex flex-col items-center justify-center min-h-[500px]">
        {!imgA || !imgB ? (
           <div className="text-slate-500 flex flex-col items-center">
             <Layers size={48} className="mb-4 opacity-50" />
             <p>请在左侧上传两张分片图层</p>
             <p className="text-sm opacity-60">合成预览将在此处显示</p>
           </div>
        ) : (
          <div className="relative bg-white w-full h-full min-h-[400px] rounded flex items-center justify-center overflow-hidden">
             <div className="relative w-[300px] h-[300px]">
                {/* 底图 A */}
                <img src={imgA} className="absolute top-0 left-0 w-full h-full pixelated-image mix-blend-multiply opacity-80" />
                
                {/* 顶图 B (受微调控制) */}
                <img 
                  src={imgB} 
                  className="absolute top-0 left-0 w-full h-full pixelated-image mix-blend-multiply opacity-80 transition-transform duration-75"
                  style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
                />
             </div>
             <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                混合模式: Multiply (正片叠底)
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
