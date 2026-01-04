import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Type, Palette, Check, X } from 'lucide-react';

interface TextEditorProps {
  initialHtml: string;
  x: number;
  y: number;
  width: number;
  height: number;
  baseStyle: {
    fontSize: number;
    color: string;
    textAlign: string;
    fontWeight: string | number;
    fontFamily: string;
  };
  onSave: (html: string) => void;
  onCancel: () => void;
  scale: number; // Current visual scale of the slide (e.g. 1.0)
}

const TextEditor: React.FC<TextEditorProps> = ({
  initialHtml,
  x,
  y,
  width,
  height,
  baseStyle,
  onSave,
  onCancel,
  scale
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(initialHtml);
  
  // Toolbar state (for feedback)
  const [currentFontSize, setCurrentFontSize] = useState(baseStyle.fontSize);
  const [currentColor, setCurrentColor] = useState(baseStyle.color);
  
  // Initialize focus
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  // Sync selection state to toolbar
  const handleSelectionChange = () => {
    // This is complex to get right for every node, 
    // for now we just keep the last applied setting or base style
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
        editorRef.current.focus();
    }
  };

  const applyFontSize = (size: number) => {
    setCurrentFontSize(size);
    // Use the font size hack: set size to 7 (largest), then find the font tag and replace style
    document.execCommand('fontSize', false, '7');
    
    const fontElements = editorRef.current?.getElementsByTagName('font');
    if (fontElements) {
      for (let i = 0; i < fontElements.length; i++) {
        const el = fontElements[i];
        if (el.getAttribute('size') === '7') {
          el.removeAttribute('size');
          el.style.fontSize = `${size}px`;
        }
      }
    }
    // Also support span fallback if browser uses spans
    const spans = editorRef.current?.querySelectorAll('span[style*="font-size: xxx-large"]');
    spans?.forEach(span => {
        (span as HTMLElement).style.fontSize = `${size}px`;
    });
  };

  const applyColor = (color: string) => {
    setCurrentColor(color);
    document.execCommand('foreColor', false, color);
  };
  
  const TOOLBAR_HEIGHT = 45;
  const GAP = 5;
  
  // Calculate vertical position (prefer top, flip to bottom if too close to edge)
  // We need to account for the scale. y is in 1000x562 space.
  const topSpace = y * scale;
  const showToolbarAbove = topSpace > (TOOLBAR_HEIGHT + GAP + 10); // 10px buffer
  
  // To keep the Editor in the exact same visual position as the original text:
  // We need to position the Editor absolutely at (x*scale, y*scale).
  // The Toolbar will be offset relative to that.
  
  const editorStyle = {
      position: 'absolute' as const,
      left: x * scale,
      top: y * scale,
      width: width * scale, // Slightly wider to prevent premature wrap?
      minHeight: height * scale,
      fontSize: `${baseStyle.fontSize * scale}px`,
      color: baseStyle.color,
      textAlign: baseStyle.textAlign as any,
      fontWeight: baseStyle.fontWeight,
      fontFamily: baseStyle.fontFamily,
      lineHeight: 1.2,
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-word' as const,
      cursor: 'text'
  };

  return (
    <div 
      className="absolute inset-0 z-50 pointer-events-none" // Overlay entire area
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-auto">
      
      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="outline-none ring-2 ring-indigo-500 rounded bg-white/95 backdrop-blur-sm shadow-sm"
        style={editorStyle}
        onBlur={() => {}}
        onKeyDown={(e) => {
           if (e.key === 'Escape') onCancel();
           if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
             e.preventDefault();
             if (editorRef.current) onSave(editorRef.current.innerHTML);
           }
        }}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />
      
      {/* Floating Toolbar (Positioned relative to editor) */}
      <div className="flex items-center gap-2 bg-slate-900 text-white p-2 rounded-lg shadow-xl mb-2 whitespace-nowrap absolute"
           style={{ 
             left: x * scale,
             top: showToolbarAbove ? (y * scale) - (TOOLBAR_HEIGHT + GAP) : (y * scale) + (height * scale) + GAP,
             zIndex: 60,
             transformOrigin: '0 0'
           }} 
      >
        <button 
           onClick={() => applyFormat('bold')} 
           className="p-1 hover:bg-slate-700 rounded"
           title="Bold"
        >
          <Bold size={16} />
        </button>
        <button 
           onClick={() => applyFormat('italic')} 
           className="p-1 hover:bg-slate-700 rounded"
           title="Italic"
        >
          <Italic size={16} />
        </button>
        
        <div className="h-4 w-px bg-slate-700 mx-1"></div>
        
        <div className="flex items-center gap-1">
          <Type size={14} className="text-slate-400" />
          <input 
            type="number" 
            value={currentFontSize}
            onChange={(e) => applyFontSize(Number(e.target.value))}
            className="w-12 bg-transparent border-b border-slate-600 text-center text-sm focus:outline-none focus:border-white"
          />
        </div>

        <div className="flex items-center gap-1">
          <Palette size={14} className="text-slate-400" />
          <input 
            type="color" 
            value={currentColor}
            onChange={(e) => applyColor(e.target.value)}
            className="w-6 h-6 bg-transparent cursor-pointer border-none p-0"
          />
        </div>

        <div className="h-4 w-px bg-slate-700 mx-1"></div>

        <button 
           onClick={() => {
             if (editorRef.current) {
               onSave(editorRef.current.innerHTML);
             }
           }} 
           className="p-1 bg-green-600 hover:bg-green-700 rounded text-white"
           title="Save"
        >
          <Check size={16} />
        </button>
        <button 
           onClick={onCancel} 
           className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
           title="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      </div>
    </div>
  );
};

export default TextEditor;
