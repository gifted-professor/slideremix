import React from 'react';
import { SlideElement, ElementSettings } from '../types';
import { X, Image as ImageIcon, Box, Scissors, Check, Type, Trash2, Edit, Bold, Italic } from 'lucide-react';

interface ElementToolbarProps {
  element: SlideElement;
  settings: ElementSettings;
  onUpdateSettings: (settings: Partial<ElementSettings>) => void;
  onOpenEditor?: () => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

const ElementToolbar: React.FC<ElementToolbarProps> = ({ 
  element, 
  settings, 
  onUpdateSettings, 
  onOpenEditor, 
  onClose,
  position = 'top' 
}) => {
  const isImage = settings.renderMode === 'image';

  const getIcon = () => {
    switch (element.type) {
      case 'raster_image': return <ImageIcon size={14} />;
      case 'text': return <Type size={14} />;
      default: return <Box size={14} />;
    }
  };

  const getLabel = () => {
    switch (element.type) {
      case 'raster_image': return 'Image Element';
      case 'text': return 'Text Element';
      default: return 'Vector Element';
    }
  };

  const contentEditableRef = React.useRef<HTMLDivElement>(null);

  // Sync content with contentEditable div
  React.useEffect(() => {
    if (contentEditableRef.current) {
      const newContent = settings.content !== undefined ? settings.content : (element.content || '');
      if (contentEditableRef.current.innerHTML !== newContent) {
        contentEditableRef.current.innerHTML = newContent;
      }
    }
  }, [element.content, settings.content]);

  const handleApplyColor = (color: string) => {
    // If selection is inside editor, apply color to selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.anchorNode)) {
      document.execCommand('foreColor', false, color);
      // Update content immediately
      if (contentEditableRef.current) {
        onUpdateSettings({ content: contentEditableRef.current.innerHTML });
      }
    } else {
      // Fallback to global setting
      onUpdateSettings({ fillColor: color });
    }
  };

  const handleApplyFontSize = (size: number) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.anchorNode) && !selection.isCollapsed) {
       // Apply to selection
       // Use the font size hack
       document.execCommand('fontSize', false, '7');
       const fontElements = contentEditableRef.current?.getElementsByTagName('font');
       if (fontElements) {
         for (let i = 0; i < fontElements.length; i++) {
           const el = fontElements[i];
           if (el.getAttribute('size') === '7') {
             el.removeAttribute('size');
             el.style.fontSize = `${size}px`;
           }
         }
       }
       // Span fallback
       const spans = contentEditableRef.current?.querySelectorAll('span[style*="font-size: xxx-large"]');
       spans?.forEach(span => {
           (span as HTMLElement).style.fontSize = `${size}px`;
       });
       
       if (contentEditableRef.current) {
         onUpdateSettings({ content: contentEditableRef.current.innerHTML });
       }
    } else {
       // Global setting
       onUpdateSettings({ fontSize: size });
    }
  };

  const handleFormat = (command: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current?.contains(selection.anchorNode)) {
      document.execCommand(command, false);
      if (contentEditableRef.current) {
        onUpdateSettings({ content: contentEditableRef.current.innerHTML });
      }
    }
  };

  return (
    <div 
      className={`absolute left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-slate-200 p-2 flex flex-col gap-2 min-w-[240px] z-50 animate-in fade-in duration-200 ${
        position === 'top' 
          ? 'bottom-[calc(100%+8px)] slide-in-from-bottom-2' 
          : 'top-[calc(100%+8px)] slide-in-from-top-2'
      }`}
    >
      {/* Header / Title */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          {getIcon()}
          <span className="truncate max-w-[120px]">{getLabel()}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      {/* Mode Toggle - Only for non-text elements */}
      {element.type !== 'text' && (
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => onUpdateSettings({ renderMode: 'svg' })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              !isImage ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Box size={14} />
            Vector
          </button>
          <button
            onClick={() => onUpdateSettings({ renderMode: 'image' })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              isImage ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ImageIcon size={14} />
            Image
          </button>
        </div>
      )}

      {/* Size Controls - For non-text elements */}
      {element.type !== 'text' && (
        <div className="flex items-center gap-2 px-1 pt-1 border-t border-slate-100 mt-1">
             <span className="text-[10px] text-slate-400 font-medium uppercase w-8">Size</span>
             <div className="flex gap-2 flex-1">
               <div className="flex items-center gap-1 flex-1">
                  <span className="text-[9px] text-slate-400">W</span>
                  <input 
                    type="number"
                    value={Math.round(settings.width !== undefined ? settings.width : element.position.width)}
                    onChange={(e) => onUpdateSettings({ width: Math.max(1, parseInt(e.target.value) || 0) })}
                    className="w-full h-5 text-[10px] bg-slate-50 border border-slate-200 rounded px-1 text-center"
                  />
               </div>
               <div className="flex items-center gap-1 flex-1">
                  <span className="text-[9px] text-slate-400">H</span>
                  <input 
                    type="number"
                    value={Math.round(settings.height !== undefined ? settings.height : element.position.height)}
                    onChange={(e) => onUpdateSettings({ height: Math.max(1, parseInt(e.target.value) || 0) })}
                    className="w-full h-5 text-[10px] bg-slate-50 border border-slate-200 rounded px-1 text-center"
                  />
               </div>
             </div>
        </div>
      )}

      {/* Text Specific Info */}
      {element.type === 'text' && (
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-100 mt-1">
           {/* Text Content Editor */}
           <div className="px-1">
             <div className="flex justify-between items-center mb-1">
               <span className="text-[10px] text-slate-400 font-medium uppercase">Content (Select text to style)</span>
               <div className="flex gap-1">
                 <button onClick={() => handleFormat('bold')} className="p-0.5 hover:bg-slate-200 rounded" title="Bold">
                   <Bold size={12} className="text-slate-600" />
                 </button>
                 <button onClick={() => handleFormat('italic')} className="p-0.5 hover:bg-slate-200 rounded" title="Italic">
                   <Italic size={12} className="text-slate-600" />
                 </button>
               </div>
             </div>
             <div
               ref={contentEditableRef}
               contentEditable
               onBlur={(e) => onUpdateSettings({ content: e.currentTarget.innerHTML })}
               className="w-full min-h-[64px] max-h-[120px] overflow-y-auto text-[10px] bg-slate-50 border border-slate-200 rounded p-1 focus:outline-none focus:border-indigo-500 transition-colors whitespace-pre-wrap"
               style={{ 
                 color: settings.fillColor || element.style.fill_color || '#000000',
                 fontSize: '12px' // Fixed size for editing comfort
               }}
             />
           </div>

           {/* Font Size Control */}
           <div className="flex items-center gap-2 px-1">
             <span className="text-[10px] text-slate-400 font-medium uppercase w-12">Size</span>
             <input 
               type="range" 
               min="8" 
               max="100" 
               step="1"
               value={settings.fontSize || element.style.font_size || 20}
               onChange={(e) => handleApplyFontSize(parseInt(e.target.value))}
               className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
             />
             <span className="text-[10px] text-slate-500 w-6 text-right">{settings.fontSize || element.style.font_size || 20}</span>
           </div>

           {/* Color Control */}
           <div className="flex items-center gap-2 px-1">
             <span className="text-[10px] text-slate-400 font-medium uppercase w-12">Color</span>
             <div className="flex items-center gap-2 flex-1 bg-slate-50 p-1 rounded-md border border-slate-200">
                <input 
                  type="color" 
                  value={settings.fillColor || element.style.fill_color || '#000000'}
                  onChange={(e) => handleApplyColor(e.target.value)}
                  className="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={settings.fillColor || element.style.fill_color || '#000000'}
                  onChange={(e) => handleApplyColor(e.target.value)}
                  className="text-[10px] text-slate-500 font-mono uppercase bg-transparent border-none outline-none w-full ml-2"
                />
             </div>
           </div>
        </div>
      )}

      {/* Image Specific Options */}
      {isImage && element.type === 'raster_image' && (
        <div className="flex flex-col gap-2 pt-1">
          {/* Open Editor Button */}
          <button
            onClick={onOpenEditor}
            className="flex w-full items-center justify-center gap-2 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm mb-1"
          >
            <Edit size={12} />
            Open Image Editor
          </button>

          {/* Remove Background Toggle */}
          <button
            onClick={() => onUpdateSettings({ removeBg: !settings.removeBg })}
            className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-xs transition-colors ${
              settings.removeBg 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Scissors size={14} />
              <span>Remove Background</span>
            </div>
            {settings.removeBg && <Check size={12} />}
          </button>

          {/* Inset / Inflate Control */}
          <div className="flex items-center gap-2 px-1">
             <span className="text-[10px] text-slate-400 font-medium uppercase w-12">Expand</span>
             <input 
               type="range" 
               min="-10" 
               max="10" 
               step="1"
               value={settings.inflateAmount || 0}
               onChange={(e) => onUpdateSettings({ inflateAmount: parseInt(e.target.value) })}
               className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
             />
             <span className="text-[10px] text-slate-500 w-4 text-right">{settings.inflateAmount || 0}</span>
          </div>

          {/* Crop Controls */}
          <div className="border-t border-slate-100 pt-1 mt-1">
             <div className="flex items-center justify-between mb-1 px-1">
               <span className="text-[10px] font-semibold text-slate-500 uppercase">Crop</span>
             </div>
             <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-1">
                {['top', 'bottom', 'left', 'right'].map((side) => (
                  <div key={side} className="flex items-center gap-1">
                     <span className="text-[9px] text-slate-400 uppercase w-3">{side[0]}</span>
                     <input 
                       type="number"
                       value={settings.cropInsets?.[side as keyof typeof settings.cropInsets] || 0}
                       onChange={(e) => {
                         const val = parseInt(e.target.value) || 0;
                         // Allow negative values for expansion
                         const currentInsets = settings.cropInsets || { top: 0, bottom: 0, left: 0, right: 0 };
                         const newInsets = { ...currentInsets, [side]: val };
                         onUpdateSettings({ cropInsets: newInsets });
                       }}
                       className="w-full h-5 text-[10px] bg-slate-50 border border-slate-200 rounded px-1 text-center"
                     />
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}
      
      {/* Decorative pointer arrow */}
      <div 
        className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent drop-shadow-sm ${
          position === 'top'
            ? 'top-full border-t-[6px] border-t-white'
            : 'bottom-full border-b-[6px] border-b-white'
        }`}
      ></div>

      {/* Delete Button */}
      <div className="border-t border-slate-100 pt-1 mt-1">
        <button
          onClick={() => {
            onUpdateSettings({ hidden: true });
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
          Delete Element
        </button>
      </div>
    </div>
  );
};

export default ElementToolbar;
