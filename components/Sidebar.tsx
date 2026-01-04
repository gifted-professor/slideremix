import React from 'react';
import { ProcessMode, VisualStyle } from '../types';
import { Settings, Scissors, Palette, Wand2, Key, ExternalLink } from 'lucide-react';

interface SidebarProps {
  mode: ProcessMode;
  setMode: (mode: ProcessMode) => void;
  visualStyle: VisualStyle;
  setVisualStyle: (style: VisualStyle) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  mode, 
  setMode, 
  visualStyle, 
  setVisualStyle, 
  apiKey, 
  setApiKey,
  backgroundColor,
  onBackgroundColorChange
}) => {
  return (
    <aside className="w-80 bg-white border-r border-slate-200 h-screen flex flex-col shadow-sm z-10">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">S</div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">SlideRemix</h1>
        </div>
        <p className="text-xs text-slate-500 pl-10">AI 幻灯片重构引擎</p>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Settings size={14} />
            配置
          </h2>

          {/* API Key Input */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Key size={14} className="text-slate-400" />
                API Key
                </label>
                <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                >
                    获取 Key <ExternalLink size={10} />
                </a>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={(e) => {
                const val = e.target.value.trim();
                // Only ask if it's a valid looking key (not empty) and different from what's saved
                if (val && val !== localStorage.getItem('saved_gemini_api_key')) {
                   // Use a small timeout to avoid blocking UI immediately if they are just tabbing through
                   setTimeout(() => {
                     const shouldSave = window.confirm("是否将此 API Key 保存到本地？\n\n保存后，下次访问将自动加载，无需重复输入。");
                     if (shouldSave) {
                       localStorage.setItem('saved_gemini_api_key', val);
                     }
                   }, 100);
                }
              }}
              placeholder="输入您的 Gemini API Key..."
              className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-slate-400"
            />
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
              支持保存到本地，方便下次自动加载。
            </p>
          </div>
          
          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">处理模式</label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setMode('fidelity')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  mode === 'fidelity'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mode === 'fidelity' ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100'}`}>
                  <Scissors size={16} />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-sm">高保真模式</div>
                  <div className="text-xs opacity-80">保留原始视觉素材</div>
                </div>
              </button>

              <button
                onClick={() => setMode('remix')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  mode === 'remix'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mode === 'remix' ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100'}`}>
                  <Wand2 size={16} />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-sm">重塑模式</div>
                  <div className="text-xs opacity-80">AI 重绘与文本风格化</div>
                </div>
              </button>
            </div>
          </div>

          {/* Style Selection - Conditional on Remix Mode ideally, but we show always for UI completeness */}
          <div className={`transition-opacity duration-300 ${mode === 'remix' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Palette size={14} />
              重塑风格
            </label>
            <select
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
              className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="original">保持原有氛围</option>
              <option value="minimalist">现代极简</option>
              <option value="hand_drawn">创意手绘</option>
            </select>
          </div>
          
          {/* Background Color Picker */}
          {onBackgroundColorChange && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: backgroundColor || '#ffffff' }}></div>
                背景颜色
              </label>
              <div className="flex items-center gap-2">
                 <input 
                   type="color" 
                   value={backgroundColor || '#ffffff'}
                   onChange={(e) => onBackgroundColorChange(e.target.value)}
                   className="w-10 h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                 />
                 <input 
                   type="text" 
                   value={backgroundColor || '#ffffff'}
                   onChange={(e) => onBackgroundColorChange(e.target.value)}
                   className="flex-1 p-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono uppercase"
                 />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase">使用统计</h3>
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>配额</span>
            <span className="font-medium">免费版</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
            <div className="bg-indigo-500 h-1.5 rounded-full w-[15%]"></div>
          </div>
          <p className="text-[10px] text-slate-400">升级到 Pro 版以进行批量处理。</p>
        </div>
      </div>
      
      <div className="p-4 border-t border-slate-100 text-[10px] text-slate-400 text-center">
        由 Google Gemini 2.5 提供支持
      </div>
    </aside>
  );
};

export default Sidebar;