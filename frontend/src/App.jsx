import { useState } from 'react';
import { Layers, ShieldCheck, Download } from 'lucide-react';

function App() {
  const [inputText, setInputText] = useState('https://www.yourdomain.com');
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState({ share1: null, share2: null });
  const [isOverlaid, setIsOverlaid] = useState(false);

  // 调用 Python 后端
  const handleGenerate = async () => {
    setLoading(true);
    setShares({ share1: null, share2: null }); // 重置
    setIsOverlaid(false);

    try {
      const formData = new FormData();
      formData.append('text', inputText);

      // 注意：本地开发时后端通常在 8000 端口
      const response = await fetch('https://api.hunyuan.ggff.net/generate', {
  method: 'POST',
  body: formData,
});

      const data = await response.json();
      
      if (data.status === 'success') {
        setShares({
          share1: data.share1,
          share2: data.share2
        });
      } else {
        alert('生成失败: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('无法连接到后端服务器，请确认 python main.py 是否在运行');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center max-w-4xl mx-auto font-sans">
      
      {/* 标题 */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold flex items-center gap-3 text-indigo-400">
          <ShieldCheck size={40} />
          Visual Crypto Generator
        </h1>
        <p className="text-slate-400 mt-2">Python 强力驱动 | 视觉分层加密技术</p>
      </header>

      {/* 输入区域 */}
      <div className="w-full bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 text-white"
            placeholder="输入秘密信息或网址..."
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
          >
            {loading ? '加密计算中...' : '生成密钥'}
          </button>
        </div>
      </div>

      {/* 结果展示区域 */}
      {shares.share1 && (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
          
          {/* 左侧：控制台 */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-fit">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Layers size={20} />
              叠加模拟器
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              两张图片单独看只是噪点。点击下方按钮模拟将它们打印到透明胶片并叠在一起的效果。
            </p>
            
            <button
              onClick={() => setIsOverlaid(!isOverlaid)}
              className={`w-full py-3 rounded-lg font-semibold transition-all mb-4 ${
                isOverlaid ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {isOverlaid ? '分离图层' : '合并图层 (模拟解密)'}
            </button>

            <div className="grid grid-cols-2 gap-2 mt-4">
               <a href={shares.share1} download="layer_1.png" className="text-xs text-center p-2 bg-slate-900 rounded border border-slate-700 hover:border-indigo-500 text-slate-300 flex justify-center gap-1">
                 <Download size={14}/> 下载图层 A
               </a>
               <a href={shares.share2} download="layer_2.png" className="text-xs text-center p-2 bg-slate-900 rounded border border-slate-700 hover:border-indigo-500 text-slate-300 flex justify-center gap-1">
                 <Download size={14}/> 下载图层 B
               </a>
            </div>
          </div>

          {/* 右侧：视觉展示 - 修复版 */}
          <div className="relative bg-white rounded-xl p-8 flex items-center justify-center min-h-[400px] overflow-hidden border border-slate-700 shadow-2xl">
            {/* 模拟白纸背景：bg-white (必须是白的，叠加上去才看得清) */}
            
            {/* 图层 A (底部) */}
            <img 
              src={shares.share1} 
              alt="Share 1"
              className={`absolute w-64 h-64 pixelated-image transition-all duration-700 ease-in-out ${
                 isOverlaid 
                   ? 'translate-x-0 rotate-0 opacity-100' 
                   : '-translate-x-24 -rotate-6 opacity-60' 
              }`}
              style={{ mixBlendMode: 'multiply' }} 
            />

            {/* 图层 B (顶部) */}
            <img 
              src={shares.share2} 
              alt="Share 2"
              className={`absolute w-64 h-64 pixelated-image transition-all duration-700 ease-in-out ${
                 isOverlaid 
                   ? 'translate-x-0 rotate-0 opacity-100' 
                   : 'translate-x-24 rotate-6 opacity-60'
              }`}
              style={{ mixBlendMode: 'multiply' }} 
            />
            
            {/* 提示文字 */}
            <div className="absolute bottom-4 text-slate-400 text-xs font-mono">
                {isOverlaid ? "已合并 (模拟灯箱效果)" : "已分离"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
