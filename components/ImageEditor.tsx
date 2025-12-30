import React, { useState, useEffect, useRef } from 'react';
import { SlideElement, ElementSettings } from '../types';
import { X, Check, Scissors, RotateCcw, ZoomIn, Box, Eraser, MousePointer2 } from 'lucide-react';

interface ImageEditorProps {
  element: SlideElement;
  settings: ElementSettings;
  originalImageBase64: string;
  onSave: (settings: Partial<ElementSettings>) => void;
  onClose: () => void;
  previewUrl?: string;
  onPreviewRequest?: (settings: ElementSettings) => Promise<string | null>;
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  element,
  settings,
  originalImageBase64,
  onSave,
  onClose,
  previewUrl,
  onPreviewRequest
}) => {
  // Local state for editing session
  const [localSettings, setLocalSettings] = useState<ElementSettings>({ ...settings });
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | undefined>(previewUrl);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Tool State
  const [activeTool, setActiveTool] = useState<'pointer' | 'eraser'>('pointer');
  const [isDrawing, setIsDrawing] = useState(false);
  // We use this to track the current freehand path
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Crop Insets State
  const insets = localSettings.cropInsets || { top: 0, bottom: 0, left: 0, right: 0 };
  
  const handleInsetChange = (side: keyof typeof insets, value: number) => {
    // Allow negative values for expansion
    const newInsets = { ...insets, [side]: value };
    setLocalSettings(prev => ({ ...prev, cropInsets: newInsets }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== 'eraser' || !imgRef.current) return;
    e.preventDefault();
    
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    
    // Convert to percentage immediately for storage consistency
    const px = (x / rect.width) * 100;
    const py = (y / rect.height) * 100;
    
    setCurrentPath([{ x: px, y: py }]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !imgRef.current) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Constrain to image bounds
    const constrainedX = Math.max(0, Math.min(x, rect.width));
    const constrainedY = Math.max(0, Math.min(y, rect.height));
    
    const px = (constrainedX / rect.width) * 100;
    const py = (constrainedY / rect.height) * 100;
    
    setCurrentPath(prev => [...prev, { x: px, y: py }]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !imgRef.current) return;
    
    if (currentPath.length > 1) {
        const newPaths = [...(localSettings.erasePaths || []), currentPath];
        setLocalSettings(prev => ({ ...prev, erasePaths: newPaths }));
    }
    
    setIsDrawing(false);
    setCurrentPath([]);
  };

  useEffect(() => {
    if (!onPreviewRequest) return;

    const timer = setTimeout(async () => {
      setIsLoadingPreview(true);
      try {
        const url = await onPreviewRequest(localSettings);
        if (url) setLivePreviewUrl(url);
      } finally {
        setIsLoadingPreview(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [localSettings, onPreviewRequest]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
               <Scissors size={20} />
             </div>
             <div>
               <h3 className="font-semibold text-slate-800">Image Editor</h3>
               <p className="text-xs text-slate-500">Fine-tune image extraction</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button 
              onClick={() => {
                onSave(localSettings);
                onClose();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
            >
              <Check size={16} />
              Apply Changes
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* Main Preview Area */}
          <div className="flex-1 bg-slate-100 relative flex items-center justify-center p-8 overflow-auto select-none">
            <div 
                className="relative shadow-lg border border-slate-200 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-white inline-block"
                style={{ cursor: activeTool === 'eraser' ? 'crosshair' : 'default' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
               {/* This shows the live preview of the crop */}
               {livePreviewUrl ? (
                 <img 
                   ref={imgRef}
                   src={livePreviewUrl} 
                   alt="Preview" 
                   className={`max-w-full max-h-[60vh] object-contain transition-opacity duration-300 ${isLoadingPreview ? 'opacity-50' : 'opacity-100'}`}
                   draggable={false}
                 />
               ) : (
                 <div className="w-96 h-64 flex items-center justify-center text-slate-400">
                   <span className="flex items-center gap-2">
                     <Loader2 size={20} className="animate-spin" />
                     Generating Preview...
                   </span>
                 </div>
               )}

               {/* Drawing Overlay */}
               {isDrawing && currentPath.length > 0 && (
                  <svg 
                    className="absolute inset-0 pointer-events-none w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <path 
                      d={`M ${currentPath.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                      fill="none"
                      stroke="rgba(239, 68, 68, 0.5)"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
               )}
            </div>
          </div>

          {/* Right Sidebar - Controls */}
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col overflow-y-auto">
            
            <div className="p-6 border-b border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Box size={16} className="text-slate-400" />
                Extraction Settings
              </h4>
              
              {/* Expand / Inflate */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-medium text-slate-700">Expand Selection</label>
                  <span className="text-xs font-mono text-slate-500">{localSettings.inflateAmount || 0}px</span>
                </div>
                <input 
                  type="range" 
                  min="-10" 
                  max="20" 
                  step="1"
                  value={localSettings.inflateAmount || 0}
                  onChange={(e) => setLocalSettings(p => ({ ...p, inflateAmount: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Increase to capture more context around the element.</p>
              </div>

              {/* Eraser Tool */}
              <div className="mb-6 border-t border-slate-100 pt-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Eraser size={16} className="text-slate-400" />
                  Magic Eraser
                </h4>
                
                <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                  <button
                    onClick={() => setActiveTool('pointer')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${
                      activeTool === 'pointer' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <MousePointer2 size={14} />
                    Pointer
                  </button>
                  <button
                    onClick={() => setActiveTool('eraser')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${
                      activeTool === 'eraser' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Eraser size={14} />
                    Eraser
                  </button>
                </div>
                
                {(localSettings.erasePaths && localSettings.erasePaths.length > 0) || (localSettings.eraseRegions && localSettings.eraseRegions.length > 0) ? (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-slate-600">Erased Areas</span>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                        {(localSettings.erasePaths?.length || 0) + (localSettings.eraseRegions?.length || 0)}
                      </span>
                    </div>
                    <button 
                      onClick={() => setLocalSettings(p => ({ ...p, eraseRegions: [], erasePaths: [] }))}
                      className="w-full py-1.5 text-xs text-red-500 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors flex items-center justify-center gap-1"
                    >
                      <RotateCcw size={10} />
                      Clear All
                    </button>
                  </div>
                ) : null}
                
                {activeTool === 'eraser' && (
                  <p className="text-[10px] text-slate-500 mt-2 bg-indigo-50 p-2 rounded border border-indigo-100">
                    Click and drag on the image to erase unwanted parts. The preview will update automatically.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-200 transition-colors"
                   onClick={() => setLocalSettings(p => ({ ...p, removeBg: !p.removeBg }))}
              >
                 <div className="flex items-center gap-3">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center ${localSettings.removeBg ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                     <Scissors size={14} />
                   </div>
                   <div className="text-xs font-medium text-slate-700">Remove Background</div>
                 </div>
                 <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${localSettings.removeBg ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                   {localSettings.removeBg && <Check size={12} className="text-white" />}
                 </div>
              </div>
            </div>

            <div className="p-6">
               <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <ZoomIn size={16} className="text-slate-400" />
                Crop Edges
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                    {/* Visual Crop Representation */}
                    <div className="grid grid-cols-3 gap-2">
                       <div className="col-start-2">
                          <label className="block text-[10px] text-center text-slate-400 mb-1 uppercase tracking-wider">Top</label>
                          <input 
                            type="number" 
                            className="w-full text-center text-sm font-medium p-1 rounded border border-slate-200"
                            value={insets.top}
                            onChange={(e) => handleInsetChange('top', parseInt(e.target.value) || 0)}
                          />
                       </div>
                       <div className="col-start-1 row-start-2 flex items-center">
                          <div className="w-full">
                            <label className="block text-[10px] text-center text-slate-400 mb-1 uppercase tracking-wider">Left</label>
                            <input 
                              type="number" 
                              className="w-full text-center text-sm font-medium p-1 rounded border border-slate-200"
                              value={insets.left}
                              onChange={(e) => handleInsetChange('left', parseInt(e.target.value) || 0)}
                            />
                          </div>
                       </div>
                       <div className="col-start-3 row-start-2 flex items-center">
                          <div className="w-full">
                            <label className="block text-[10px] text-center text-slate-400 mb-1 uppercase tracking-wider">Right</label>
                            <input 
                              type="number" 
                              className="w-full text-center text-sm font-medium p-1 rounded border border-slate-200"
                              value={insets.right}
                              onChange={(e) => handleInsetChange('right', parseInt(e.target.value) || 0)}
                            />
                          </div>
                       </div>
                       <div className="col-start-2 row-start-3">
                          <label className="block text-[10px] text-center text-slate-400 mb-1 uppercase tracking-wider">Bottom</label>
                          <input 
                            type="number" 
                            className="w-full text-center text-sm font-medium p-1 rounded border border-slate-200"
                            value={insets.bottom}
                            onChange={(e) => handleInsetChange('bottom', parseInt(e.target.value) || 0)}
                          />
                       </div>
                    </div>
                 </div>
              </div>
              
              <button 
                onClick={() => setLocalSettings(p => ({ ...p, cropInsets: { top: 0, bottom: 0, left: 0, right: 0 } }))}
                className="mt-4 w-full py-2 flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <RotateCcw size={12} />
                Reset Crop
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// Helper for loading icon
import { Loader2 } from 'lucide-react';

export default ImageEditor;
