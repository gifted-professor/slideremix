import React, { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import UploadZone from './components/UploadZone';
import SlideRenderer from './components/SlideRenderer';
import SelectionOverlay from './components/SelectionOverlay';
import ImageEditor from './components/ImageEditor';
import TextEditor from './components/TextEditor';
import { analyzeSlide, fileToGenerativePart, remixElementImage } from './services/geminiService';
import { parseHtmlToPptxRuns } from './services/htmlParser';
import { ProcessMode, VisualStyle, SlideData, AnalysisStatus, ElementSettings } from './types';
import { Code, Layout, Loader2, ArrowRight, AlertCircle, Presentation, LogOut, User as UserIcon, Save, FolderOpen, Upload } from 'lucide-react';
// @ts-ignore
import pptxgen from 'pptxgenjs';
import { cropBase64Region } from './services/imageCrop';

import LoginPage from './components/LoginPage';
import { authAdapter } from './services/authAdapter';
import { dbService, Project } from './services/database';
import ProjectList from './components/ProjectList';
import SaveProjectModal from './components/SaveProjectModal';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const user = await authAdapter.getCurrentUser();
      if (user) {
        setUserEmail(user.email);
        setIsLoggedIn(true);
      }
    };
    checkAuth();
  }, []);

  const [mode, setMode] = useState<ProcessMode>('fidelity');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('original');
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('saved_gemini_api_key') || import.meta.env.VITE_GOOGLE_API_KEY || '';
  });
  
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
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const rendererContainerRef = useRef<HTMLDivElement>(null);
  const [containerScale, setContainerScale] = useState(1);
  const [showProjectList, setShowProjectList] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Update scale on resize
  useEffect(() => {
    const updateScale = () => {
      if (rendererContainerRef.current) {
        setContainerScale(rendererContainerRef.current.clientWidth / 1000);
      }
    };
    
    // Initial update
    updateScale();
    
    // Observer for robust size tracking
    const observer = new ResizeObserver(updateScale);
    if (rendererContainerRef.current) {
       observer.observe(rendererContainerRef.current);
    }
    
    window.addEventListener('resize', updateScale);
    return () => {
       window.removeEventListener('resize', updateScale);
       observer.disconnect();
    };
  }, [status, activeTab]);

  const handleReuploadOriginal = useCallback(async (selectedFile: File) => {
    try {
      const base64Data = await fileToGenerativePart(selectedFile);
      setBase64Original(base64Data);
      
      const img = new Image();
      img.src = `data:image/jpeg;base64,${base64Data}`;
      await new Promise((r) => { if (img.complete) r(null); else img.onload = () => r(null); });
      setNaturalSize({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      
      // Update preview URL
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      
      alert("原图已更新！现在可以使用“全部图片化”和图像裁剪功能了。");
    } catch (err) {
      console.error(err);
      alert("上传失败，请重试。");
    }
  }, []);

  const handleFileSelected = useCallback(async (selectedFile: File) => {
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
      
      // Play success sound
      const audio = new Audio('/success.mp3');
      audio.play().catch(e => console.log('Audio play failed', e));
      
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

  const ensureImageGenerated = async (id: string, prev: ElementSettings, next: ElementSettings) => {
    if (!result || !base64Original || !naturalSize) return null;

    // Check if we need to generate/update image
    const shouldGenerate = !imageByElementId[id] || 
                           prev.renderMode !== 'image' || 
                           prev.inflateAmount !== next.inflateAmount ||
                           prev.removeBg !== next.removeBg ||
                           prev.cropInsets !== next.cropInsets ||
                           prev.eraseRegions !== next.eraseRegions ||
                           prev.erasePaths !== next.erasePaths;

    if (shouldGenerate) {
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
          
          return out;
       }
    }
    return null;
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
       const out = await ensureImageGenerated(id, prev, next);
       if (out) {
         setImageByElementId(prev => ({ ...prev, [id]: out! }));
       }
    }
  };

  const handleBackgroundChange = (color: string) => {
    if (!result) return;
    setResult({
      ...result,
      slide_meta: {
        ...result.slide_meta,
        background_color: color
      }
    });
  };

  const handleConvertAllToImage = async () => {
    if (!result) return;
    
    // If no original image (loaded from project without blob), warn user
    if (!base64Original) {
      alert("此项目是从数据库加载的，由于未保存原始高清图片，无法重新生成图片裁剪。仅支持编辑文本和矢量形状。");
      return;
    }
    
    const newSettingsMap = { ...elementSettingsMap };
    const updates: Promise<void>[] = [];
    
    // Find all raster images
    const imageElements = result.elements.filter(e => e.type === 'raster_image');
    
    // Process them in parallel
    const generatedImages: Record<string, { url: string; base64?: string }> = {};

    await Promise.all(imageElements.map(async (el) => {
       const prev = newSettingsMap[el.id] || { renderMode: 'svg' };
       // Skip if already image mode
       if (prev.renderMode === 'image') return;

       const next: ElementSettings = { ...prev, renderMode: 'image' };
       newSettingsMap[el.id] = next;
       
       const out = await ensureImageGenerated(el.id, prev, next);
       if (out) {
         generatedImages[el.id] = out;
       }
    }));
    
    setElementSettingsMap(newSettingsMap);
    setImageByElementId(prev => ({ ...prev, ...generatedImages }));
    recomputeHiddenTexts(newSettingsMap);
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
          
          const baseOptions = {
            fontSize: fontSizePt,
            color: color,
            bold: style.is_bold,
            align: style.alignment || 'left',
            fontFace: "Microsoft YaHei",
            valign: "top" as const,
            autoFit: true, 
          };

          if (/<[a-z][\s\S]*>/i.test(el.content)) {
             const runs = parseHtmlToPptxRuns(el.content, baseOptions);
             // @ts-ignore
             slide.addText(runs, { x, y, w, h, ...baseOptions });
          } else {
             slide.addText(el.content, {
               x, y, w, h,
               ...baseOptions
             });
          }
        }
      });

      pres.writeFile({ fileName: `SlideRemix_Vector_${Date.now()}.pptx` });
    } catch (e) {
      console.error("PPT Generation Error", e);
      alert("创建 PPT 失败，请查看控制台。");
    }
  };

  const handleSaveProjectClick = () => {
    if (!result || !authAdapter.isSupabaseEnabled) {
      if (!authAdapter.isSupabaseEnabled) alert("请先配置 Supabase 数据库以使用保存功能。");
      return;
    }
    setShowSaveModal(true);
  };

  const handleSaveProjectConfirm = async (title: string) => {
    if (!result) return;
    
    try {
      await dbService.saveProject(title, result, elementSettingsMap, previewUrl || undefined);
      setShowSaveModal(false);
      alert("项目保存成功！");
    } catch (error: any) {
      console.error(error);
      alert("保存失败: " + error.message);
    }
  };

  const handleLoadProject = (project: Project) => {
    setShowProjectList(false);
    setResult(project.slide_data);
    
    // Auto-fallback: If renderMode is 'image' but we don't have the blob, revert to 'svg'
    // so user sees color placeholders instead of empty space
    const sanitizedSettings: Record<string, ElementSettings> = {};
    Object.entries(project.element_settings).forEach(([id, settings]) => {
       if (settings.renderMode === 'image') {
         sanitizedSettings[id] = { ...settings, renderMode: 'svg' };
       } else {
         sanitizedSettings[id] = settings;
       }
    });
    setElementSettingsMap(sanitizedSettings);
    
    // Force clear hidden text IDs since we are falling back to SVG mode
    // (Image mode usually hides underlying text, but now we don't have images)
    setHiddenTextIds({});
    
    // Set preview URL to the thumbnail URL if available, otherwise clear it
    // This helps show *something* in the "Original Source" area
    if (project.thumbnail_url) {
      setPreviewUrl(project.thumbnail_url);
    } else {
      setPreviewUrl(null); 
    }
    
    // Reset heavy blobs as they are not persisted
    setImageByElementId({});
    setBase64Original(null);
    setNaturalSize(null);
    
    setStatus('success');
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setStatus('idle');
  };

  const handleTextDoubleClick = (id: string) => {
    const el = result?.elements.find(e => e.id === id);
    if (el && el.type === 'text') {
       setEditingTextId(id);
       if (rendererContainerRef.current) {
         setContainerScale(rendererContainerRef.current.clientWidth / 1000);
       }
    }
  };

  const handleLogout = async () => {
    await authAdapter.signOut();
    setIsLoggedIn(false);
    setUserEmail('');
    handleReset();
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={(email) => { setUserEmail(email); setIsLoggedIn(true); }} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        mode={mode} 
        setMode={setMode} 
        visualStyle={visualStyle} 
        setVisualStyle={setVisualStyle} 
        apiKey={apiKey}
        setApiKey={setApiKey}
        backgroundColor={result?.slide_meta.background_color || '#ffffff'}
        onBackgroundColorChange={handleBackgroundChange}
        status={status}
        onConvertAllToImage={handleConvertAllToImage}
        showText={showText}
        onToggleShowText={() => setShowText(!showText)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800">
              {status === 'idle' ? '仪表盘' : '工作区'}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowProjectList(true)}
              className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors text-sm"
              title="打开项目列表"
            >
              <FolderOpen size={18} />
              <span className="hidden lg:inline font-medium">我的项目</span>
            </button>

            {status === 'success' && (
              <div className="flex gap-2 border-r border-slate-200 pr-6">
                <button 
                  onClick={handleDownloadPptx}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Presentation size={16} />
                  <span className="hidden lg:inline">导出 PPTX</span>
                </button>
                {authAdapter.isSupabaseEnabled && (
                  <button 
                    onClick={handleSaveProjectClick}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ml-2"
                  >
                    <Save size={16} />
                    <span className="hidden lg:inline">保存项目</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
               <div className="flex flex-col items-end hidden sm:flex">
                 <span className="text-sm font-medium text-slate-700 leading-tight">
                    {userEmail.split('@')[0]}
                 </span>
                 <span className="text-[10px] text-slate-400 leading-tight">
                    {userEmail}
                 </span>
               </div>
               
               <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200 shadow-sm">
                 {userEmail ? userEmail[0].toUpperCase() : <UserIcon size={16} />}
               </div>

               <button 
                 onClick={handleLogout}
                 className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all ml-1"
                 title="退出登录"
               >
                 <LogOut size={18} />
               </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {status === 'idle' && (
            <div className="max-w-3xl mx-auto mt-10">
               <div className="text-center mb-10">
                 <h2 className="text-3xl font-bold text-slate-800 mb-3">AI 驱动的幻灯片重构 (SVG 引擎)</h2>
                 <p className="text-slate-500 text-lg">上传静态截图，自动分析矢量形状与复杂图像，生成 1:1 SVG 复刻。</p>
               </div>
               <UploadZone onFileSelected={handleFileSelected} />

               {/* Recent Projects Quick Access */}
               <div className="mt-12 pt-8 border-t border-slate-200">
                 <div className="flex items-center justify-center gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">最近项目</h3>
                 </div>
                 <div className="flex justify-center">
                   <button 
                     onClick={() => setShowProjectList(true)}
                     className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-2 hover:underline"
                   >
                     <FolderOpen size={16} />
                     查看所有保存的项目
                   </button>
                 </div>
               </div>
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
                <div className="flex-1 relative bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100 group">
                   {previewUrl ? (
                     <>
                        <img 
                          src={previewUrl} 
                          alt="Original Slide" 
                          className="max-w-full max-h-full object-contain"
                        />
                        {/* Re-upload overlay for restored projects */}
                        {!base64Original && (
                          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4">
                             <p className="text-white text-sm font-medium mb-3 text-center">
                               此项目缺少高清原图<br/>上传原图以启用裁剪功能
                             </p>
                             <label className="cursor-pointer bg-white text-slate-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                               <Upload size={16} />
                               上传原图
                               <input 
                                 type="file" 
                                 className="hidden" 
                                 accept="image/*"
                                 onChange={(e) => {
                                   if (e.target.files?.[0]) handleReuploadOriginal(e.target.files[0]);
                                 }}
                               />
                             </label>
                          </div>
                        )}
                     </>
                   ) : (
                      <div className="text-center p-6">
                         <p className="text-slate-400 text-sm mb-4">暂无原图预览</p>
                         <label className="cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors inline-flex items-center gap-2 shadow-sm">
                           <Upload size={16} />
                           上传高清原图
                           <input 
                             type="file" 
                             className="hidden" 
                             accept="image/*"
                             onChange={(e) => {
                               if (e.target.files?.[0]) handleReuploadOriginal(e.target.files[0]);
                             }}
                           />
                         </label>
                      </div>
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
                           <div ref={rendererContainerRef} style={{containerType: 'inline-size'}} className="w-full relative aspect-video shadow-lg bg-white">
                              <SlideRenderer 
                                data={result} 
                                elementSettings={elementSettingsMap}
                                images={imageByElementId}
                                onSelect={setSelectedId}
                                onDoubleClick={handleTextDoubleClick}
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
                                onDoubleClick={handleTextDoubleClick}
                              />
                              
                              {/* Text Editor Overlay */}
                              {editingTextId && result && (() => {
                                  const el = result.elements.find(e => e.id === editingTextId);
                                  const settings = elementSettingsMap[editingTextId] || {};
                                  if (!el) return null;
                                  
                                  const fontSize = settings.fontSize || el.style.font_size || 20;
                                  const color = settings.fillColor || el.style.fill_color || '#000000';
                                  const content = settings.content !== undefined ? settings.content : el.content;
                                  
                                  const x = settings.x !== undefined ? settings.x : el.position.x;
                                  const y = settings.y !== undefined ? settings.y : el.position.y;
                                  const w = settings.width !== undefined ? settings.width : el.position.width;
                                  const h = settings.height !== undefined ? settings.height : el.position.height;

                                  return (
                                     <TextEditor
                                        initialHtml={content || ''}
                                        x={x}
                                        y={y}
                                        width={w}
                                        height={h}
                                        baseStyle={{
                                           fontSize,
                                           color,
                                           textAlign: el.style.alignment || 'left',
                                           fontWeight: el.style.is_bold ? 700 : 400,
                                           fontFamily: 'Microsoft YaHei, Inter, sans-serif'
                                        }}
                                        scale={containerScale}
                                        onSave={(html) => {
                                           handleElementSettingsUpdate(editingTextId, { content: html });
                                           setEditingTextId(null);
                                        }}
                                        onCancel={() => setEditingTextId(null)}
                                     />
                                  );
                              })()}
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
        {editingImageId && result && (
          <ImageEditor 
            element={result.elements.find(e => e.id === editingImageId)!}
            settings={elementSettingsMap[editingImageId] || {}}
            originalImageBase64={base64Original || ''}
            onSave={(newSettings) => handleElementSettingsUpdate(editingImageId, newSettings)}
            onClose={() => setEditingImageId(null)}
            previewUrl={imageByElementId[editingImageId]?.url}
            onPreviewRequest={(settings) => generateElementImage(editingImageId, settings)}
          />
        )}

        {/* Project List Modal */}
        {showProjectList && (
          <ProjectList 
            onLoadProject={handleLoadProject}
            onClose={() => setShowProjectList(false)}
          />
        )}

        {/* Save Project Modal */}
        {showSaveModal && (
          <SaveProjectModal
            onSave={handleSaveProjectConfirm}
            onClose={() => setShowSaveModal(false)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
