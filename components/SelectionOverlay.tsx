import React, { useRef, useEffect, useState } from 'react';
import { SlideElement, ElementSettings } from '../types';
import ElementToolbar from './ElementToolbar';

interface SelectionOverlayProps {
  elements: SlideElement[];
  selectedId: string | null;
  elementSettings: Record<string, ElementSettings>;
  onUpdateSettings: (id: string, settings: Partial<ElementSettings>) => void;
  onOpenEditor?: (id: string) => void;
  onClose: () => void;
  onDoubleClick?: (id: string) => void;
}

const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ 
  elements, 
  selectedId, 
  elementSettings,
  onUpdateSettings,
  onOpenEditor,
  onClose,
  onDoubleClick
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const initialElemPos = useRef<{ x: number; y: number } | null>(null);

  const element = selectedId ? elements.find(el => el.id === selectedId) : null;
  const settings = (selectedId && elementSettings[selectedId]) ? elementSettings[selectedId] : { renderMode: 'svg' } as ElementSettings;

  const currentX = element ? (settings.x !== undefined ? settings.x : element.position.x) : 0;
  const currentY = element ? (settings.y !== undefined ? settings.y : element.position.y) : 0;
  const currentW = element ? (settings.width !== undefined ? settings.width : element.position.width) : 0;
  const currentH = element ? (settings.height !== undefined ? settings.height : element.position.height) : 0;

  // Apply crop insets to the selection box to match visual image
  const insetL = settings.cropInsets?.left || 0;
  const insetR = settings.cropInsets?.right || 0;
  const insetT = settings.cropInsets?.top || 0;
  const insetB = settings.cropInsets?.bottom || 0;

  const finalX = currentX + insetL;
  const finalY = currentY + insetT;
  const finalW = currentW - (insetL + insetR);
  const finalH = currentH - (insetT + insetB);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!element || !selectedId) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    // We want to update the BASE x/y (without insets), so we track currentX/Y
    initialElemPos.current = { x: currentX, y: currentY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartPos.current || !initialElemPos.current || !selectedId) return;

      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;

      // Convert pixel delta to SVG coordinate delta
      const container = document.querySelector('.aspect-video'); 
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const scaleX = 1000 / rect.width;
      const scaleY = 562.5 / rect.height;

      const newX = initialElemPos.current.x + (deltaX * scaleX);
      const newY = initialElemPos.current.y + (deltaY * scaleY);

      onUpdateSettings(selectedId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartPos.current = null;
      initialElemPos.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, selectedId, onUpdateSettings]);

  if (!selectedId || !element) return null;

  // Convert 1000x562.5 coordinates to percentages for rendering
  const left = (finalX / 1000) * 100;
  const top = (finalY / 562.5) * 100;
  const width = (finalW / 1000) * 100;
  const height = (finalH / 562.5) * 100;

  // Determine toolbar position based on element position
  // If element is in the top 40% of the slide, show toolbar below
  const toolbarPosition = finalY < 225 ? 'bottom' : 'top';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-visible">
      {/* Selection Box */}
      <div
        className={`absolute border-2 border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)] pointer-events-auto transition-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        }}
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()} 
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (selectedId && onDoubleClick) {
             onDoubleClick(selectedId);
          }
        }}
      >
        {/* Only show resize handles if we are NOT in fallback SVG mode from a missing image */}
        {/* We can infer this: if settings.renderMode is 'image' but we are actually seeing an SVG placeholder, it might be confusing. */}
        {/* But generally, handles are always good. */}
        
        {/* Resize Handles (Visual only for now) */}
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-500 rounded-full shadow-sm"></div>
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-500 rounded-full shadow-sm"></div>
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-500 rounded-full shadow-sm"></div>
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-500 rounded-full shadow-sm"></div>

        {/* Toolbar - Prevent drag propagation from toolbar */}
        {/* Also pass 'disabled' prop to toolbar if image mode is requested but not available? */}
        {/* The toolbar itself handles switching modes. */}
        <div onMouseDown={(e) => e.stopPropagation()}>
          <ElementToolbar 
            element={element}
            settings={settings}
            onUpdateSettings={(s) => onUpdateSettings(selectedId, s)}
            onOpenEditor={() => onOpenEditor && onOpenEditor(selectedId)}
            onClose={onClose}
            position={toolbarPosition}
          />
        </div>
      </div>
    </div>
  );
};

export default SelectionOverlay;
