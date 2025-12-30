import React, { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import UploadZone from './components/UploadZone';
import SlideRenderer from './components/SlideRenderer';
import SelectionOverlay from './components/SelectionOverlay';
import ImageEditor from './components/ImageEditor';
import { analyzeSlide, fileToGenerativePart, remixElementImage } from './services/geminiService';
import { ProcessMode, VisualStyle, SlideData, AnalysisStatus, ElementSettings } from './types';
import { Code, Layout, Loader2, ArrowRight, AlertCircle, Presentation } from 'lucide-react';
// @ts-ignore
import pptxgen from 'pptxgenjs';
import { cropBase64Region } from './services/imageCrop';

const App: React.FC = () => {
  const [mode, setMode] = useState<ProcessMode>('fidelity');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('original');
  const [apiKey, setApiKey] = useState<string>('');
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [result, setResult] = useState<SlideData | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [base64Original, setBase64Original] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  
  const [elementSettingsMap, setElementSettingsMap] = useState<Record<string, ElementSettings>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [imageByElementId, setImageByElementId] = useState<Record<string, { url: string; base64?: string }>>({});
  const [hiddenTextIds, setHiddenTextIds] = useState<Record<string, boolean>>({});
  const [showText, setShowText] = useState<boolean>(true);
  
  const [editingImageId, setEditingImageId] = useState<string | null>(null);

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    setResult(null);
    setErrorMsg(null);
    setStatus('analyzing');
    setSelectedId(null);

    try {
      const base64Data = await fileToGenerativePart(selectedFile);
      setBase64Original(base64Data);
      const img = new Image();
      img.src = `data:image/jpeg;base64,${base64Data}`;
      await new Promise((r) => { if (img.complete) r(null); else img.onload = () => r(null); });
      setNaturalSize({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      const data = await analyzeSlide(base64Data, mode, visualStyle, apiKey);
      setResult(data);
      
      const initial: Record<string, ElementSettings> = {};
      data.elements.forEach(el => { initial[el.id] = { renderMode: 'svg' }; });
      setElementSettingsMap(initial);
      
      setHiddenTextIds({});
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || "无法分析图像。请重试。");
    }
  }, [mode, visualStyle, apiKey]);

  const rectContains = (a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}, pad = 0) => {
    return b.x >= a.x - pad && b.y >= a.y - pad && (b.x + b.width) <= (a.x + a.width + pad) && (b.y + b.height) <= (a.y + a.height + pad);
  };

  const recomputeHiddenTexts = (settings: Record<string, ElementSettings>) => {
    if (!result) return;
    const hidden: Record<string, boolean> = {};
    const images = result.elements.filter(e => e.type === 'raster_image' && settings[e.id]?.renderMode === 'image');
    const texts = result.elements.filter(e => e.type === 'text');
    images.forEach(imgEl => {
      texts.forEach(t => {
        if (rectContains(imgEl.position, t.position, 2)) {
          hidden[t.id] = true;
        }
      });
    });
    setHiddenTextIds(hidden);
  };

  const generateElementImage = async (id: string, settings: ElementSettings): Promise<string | null> => {
    if (!result || !base64Original || !naturalSize) return null;
    
    const el = result.elements.find(e => e.id === id);
    if (!el) return null;

    // If using Image Mode but trying to preview standard Crop/Expand
    // We can reuse cropBase64Region logic
    const inflate = settings.inflateAmount !== undefined ? settings.inflateAmount : 2;
    const feather = settings.removeBg ? 5 : 2;
    
    const cropped = await cropBase64Region(
      base64Original, 
      naturalSize.w, 
      naturalSize.h, 
      el.position, 
      { 
        feather, 
        inflatePx: inflate, 
        cropInsets: settings.cropInsets, 
        eraseRegions: settings.eraseRegions,
        erasePaths: settings.erasePaths
      }
    );
    
    return cropped.url;
  };

  const handleElementSettingsUpdate = async (id: string, newSettings: Partial<ElementSettings>) => {
    if (!result) return;
    const prev = elementSettingsMap[id] || { renderMode: 'svg' };
    const next = { ...prev, ...newSettings };
    const newMap = { ...elementSettingsMap, [id]: next };
    
    setElementSettingsMap(newMap);
    recomputeHiddenTexts(newMap);
    
    // Image generation logic
    if (next.renderMode === 'image') {
       // Check if we need to generate/update image
       const shouldGenerate = !imageByElementId[id] || 
                              prev.renderMode !== 'image' || 
                              prev.inflateAmount !== next.inflateAmount ||
                              prev.removeBg !== next.removeBg ||
                              prev.cropInsets !== next.cropInsets ||
                              prev.eraseRegions !== next.eraseRegions ||
                              prev.erasePaths !== next.erasePaths;

       if (shouldGenerate && base64Original && naturalSize) {
          const el = result.elements.find(e => e.id === id);
          if (el) {
             let out: { base64: string; url: string } | null = null;
             
             // Try remix if available (and not just doing simple crop adjustment)
             if (apiKey && !next.inflateAmount && !next.removeBg && !next.cropInsets && !next.eraseRegions && !next.erasePaths) {
               try {
                 const gen = await remixElementImage(base64Original, el, visualStyle, apiKey);
                 out = { base64: gen, url: `data:image/png;base64,${gen}` };
               } catch {}
             }
             
             if (!out) {
               const url = await generateElementImage(id, next);
               if (url) {
                 const base64 = url.replace(/^data:image\/png;base64,/, "");
                 out = { base64, url };
               }
             }
             
             if (out) {
               setImageByElementId(prev => ({ ...prev, [id]: out! }));
             }
          }
       }
    }
  };

  const toggleTextHidden = (id: string) => {
    const cur = !!hiddenTextIds[id];
    setHiddenTextIds({ ...hiddenTextIds, [id]: !cur });
  };

  const handleDownloadPptx = () => {
    if (!result) return;

    try {
      const pres = new pptxgen();
      pres.layout = 'LAYOUT_16x9'; 
      
      const SCALE = 0.01; 

      const slide = pres.addSlide();
      
      if (result.slide_meta.background_color) {
        slide.background = { color: result.slide_meta.background_color.replace('#', '') };
      }

      const sortedElements = [...result.elements].sort((a, b) => a.z_index - b.z_index);

      sortedElements.forEach((el) => {
        const settings = elementSettingsMap[el.id] || {};
        
        if (settings.hidden) return;

        // Use updated position if available
        const x = (settings.x !== undefined ? settings.x : el.position.x) * SCALE;
        const y = (settings.y !== undefined ? settings.y : el.position.y) * SCALE;
        const w = el.position.width * SCALE;
        const h = el.position.height * SCALE;

        const style = el.style || {};
        const color = (settings.fillColor || style.fill_color || '000000').replace('#', '');
        const fontSize = settings.fontSize || style.font_size || 18;
        const opacity = style.opacity !== undefined ? (1 - style.opacity) * 100 : 0;

        if (el.type === 'vector_shape') {
          if (el.shape_type === 'circle') {
             slide.addShape(pres.ShapeType.ellipse, {
               x, y, w, h,
               fill: { color, transparency: opacity },
               line: { width: 0 } 
             });
          } else {
             slide.addShape(pres.ShapeType.rect, {
               x, y, w, h,
               fill: { color, transparency: opacity },
               line: { width: 0 },
               rectRadius: style.corner_radius ? style.corner_radius / 100 : 0 
             });
          }
        }
        else if (el.type === 'raster_image') {
          const imgData = imageByElementId[el.id]?.base64;
          if (imgData) {
            slide.addImage({ 
              data: `data:image/png;base64,${imgData}`, 
              x, y, w, h,
              sizing: { type: 'contain', w, h }
            });
          } else {
            slide.addText(`[Image: ${el.semantic_desc}]`, { x, y, w, h, fill: { color: 'F1F5F9' }, color: '94A3B8', fontSize: 10, align: 'center', shape: pres.ShapeType.rect });
          }
        }
        else if (el.type === 'text' && el.content && showText && !hiddenTextIds[el.id]) {
          const fontSizePt = fontSize * 0.72;

          slide.addText(el.content, {
            x, y, w, h,
            fontSize: fontSizePt,
            color: color,
            bold: style.is_bold,
            align: style.alignment || 'left',
            fontFace: "Microsoft YaHei",
            valign: "top",
            autoFit: true, 
          });
        }
      });

      pres.writeFile({ fileName: `SlideRemix_Vector_${Date.now()}.pptx` });
    } catch (e) {
      console.error("PPT Generation Error", e);
      alert("创建 PPT 失败，请查看控制台。");
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setStatus('idle');
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        mode={mode} 
        setMode={setMode} 
        visualStyle={visualStyle} 
        setVisualStyle={setVisualStyle} 
        apiKey={apiKey}
        setApiKey={setApiKey}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20">
          <h2 className="text-lg font-semibold text-slate-800">
            {status === 'idle' ? '仪表盘' : '工作区'}
          </h2>
          {status === 'success' && (
            <div className="flex gap-2">
              <button 
                onClick={() => setShowText(!showText)}
                className={`flex items-center gap-2 ${showText ? 'bg-slate-200 text-slate-800' : 'bg-white'} border border-slate-300 px-4 py-2 rounded-lg text-sm transition-colors`}
              >
                {showText ? '隐藏文本' : '显示文本'}
              </button>
              <button 
                onClick={handleDownloadPptx}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Presentation size={16} />
                导出 PPTX (Beta)
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-8">
          {status === 'idle' && (
            <div className="max-w-3xl mx-auto mt-10">
               <div className="text-center mb-10">
                 <h2 className="text-3xl font-bold text-slate-800 mb-3">AI 驱动的幻灯片重构 (SVG 引擎)</h2>
                 <p className="text-slate-500 text-lg">上传静态截图，自动分析矢量形状与复杂图像，生成 1:1 SVG 复刻。</p>
               </div>
               <UploadZone onFileSelected={handleFileSelected} />
            </div>
          )}

          {(status === 'analyzing' || status === 'success' || status === 'error') && (
            <div className="flex flex-col lg:flex-row gap-8 h-full max-h-[calc(100vh-140px)]">
              
              {/* Left Column: Original Image */}
              <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <div className="flex justify-between items-center mb-4 px-2">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">原始来源</h3>
                  <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500">清除</button>
                </div>
                <div className="flex-1 relative bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
                   {previewUrl && (
                     <img 
                       src={previewUrl} 
                       alt="Original Slide" 
                       className="max-w-full max-h-full object-contain"
                     />
                   )}
                </div>
              </div>

              <div className="hidden lg:flex items-center justify-center text-slate-300">
                <ArrowRight size={32} />
              </div>

              {/* Right Column: Result */}
              <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative">
                
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                    {status === 'analyzing' && <Loader2 size={14} className="animate-spin text-indigo-600" />}
                    {status === 'success' && <span className="text-emerald-500">●</span>}
                    {status === 'error' && <span className="text-red-500">●</span>}
                    SVG 矢量预览
                  </h3>
                  
                  {status === 'success' && (
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button 
                        onClick={() => setActiveTab('preview')}
                        className={`p-1.5 rounded-md transition-all ${activeTab === 'preview' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        title="可视化预览"
                      >
                        <Layout size={16} />
                      </button>
                      <button 
                        onClick={() => setActiveTab('json')}
                        className={`p-1.5 rounded-md transition-all ${activeTab === 'json' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        title="JSON 数据"
                      >
                        <Code size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 relative overflow-hidden bg-slate-50 rounded-xl border border-slate-100 flex flex-col">
                  
                  {status === 'analyzing' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/80 backdrop-blur-sm">
                      <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
                      <p className="text-slate-600 font-medium animate-pulse">正在矢量化...</p>
                      <p className="text-slate-400 text-sm mt-2">区分简单形状与复杂图像 (Gemini 3 Pro)</p>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center p-8">
                      <AlertCircle size={48} className="text-red-400 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-700">分析失败</h3>
                      <p className="text-slate-500 mt-2 text-sm">{errorMsg}</p>
                      <button 
                        onClick={() => status === 'error' && file && handleFileSelected(file)}
                        className="mt-6 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                      >
                        重试
                      </button>
                    </div>
                  )}

                  {status === 'success' && result && (
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                      {activeTab === 'preview' ? (
                        <div className="w-full flex items-center justify-center min-h-full">
                           <div style={{containerType: 'inline-size'}} className="w-full relative aspect-video shadow-lg bg-white">
                              <SlideRenderer 
                                data={result} 
                                elementSettings={elementSettingsMap}
                                images={imageByElementId}
                                onSelect={setSelectedId}
                                hiddenIds={hiddenTextIds}
                                onToggleText={toggleTextHidden}
                                showText={showText}
                              />
                              <SelectionOverlay 
                                elements={result.elements}
                                selectedId={selectedId}
                                elementSettings={elementSettingsMap}
                                onUpdateSettings={handleElementSettingsUpdate}
                                onOpenEditor={setEditingImageId}
                                onClose={() => setSelectedId(null)}
                              />
                            </div>
                        </div>
                      ) : (
                        <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-all p-2">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
        
        {/* Full Screen Image Editor Modal */}
        {editingImageId && result && base64Original && (
          <ImageEditor 
            element={result.elements.find(e => e.id === editingImageId)!}
            settings={elementSettingsMap[editingImageId] || {}}
            originalImageBase64={base64Original}
            onSave={(newSettings) => handleElementSettingsUpdate(editingImageId, newSettings)}
            onClose={() => setEditingImageId(null)}
            previewUrl={imageByElementId[editingImageId]?.url}
            onPreviewRequest={(settings) => generateElementImage(editingImageId, settings)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
