import React from 'react';
import { SlideData, ElementSettings } from '../types';

interface SlideRendererProps {
  data: SlideData;
  elementSettings?: Record<string, ElementSettings>;
  images?: Record<string, { url: string; base64?: string }>;
  onSelect?: (id: string) => void;
  hiddenIds?: Record<string, boolean>;
  onToggleText?: (id: string) => void;
  showText?: boolean;
}

const SlideRenderer: React.FC<SlideRendererProps> = ({ 
  data, 
  elementSettings = {}, 
  images = {}, 
  onSelect, 
  hiddenIds = {}, 
  onToggleText, 
  showText = true 
}) => {
  const { slide_meta, elements } = data;
  
  // Standard 16:9 Coordinate System
  const VIEWBOX_W = 1000;
  const VIEWBOX_H = 562.5;

  return (
    <div className="w-full h-full shadow-lg overflow-hidden border border-slate-200 bg-white select-none">
      <svg 
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} 
        className="w-full h-full block"
        style={{ backgroundColor: slide_meta.background_color || '#ffffff' }}
        xmlns="http://www.w3.org/2000/svg"
        onClick={(e) => {
          if (e.target === e.currentTarget && onSelect) {
             onSelect(''); // Deselect if clicking background
          }
        }}
      >
        {/* Render elements sorted by Z-Index */}
        {elements
          .sort((a, b) => a.z_index - b.z_index)
          .map((el) => {
            const { position, type, id } = el;
            const style = el.style || {};
            
            const settings = elementSettings[id] || {};
            
            if (settings.hidden) return null;
            
            // Use override position if available
            const x = settings.x !== undefined ? settings.x : position.x;
            const y = settings.y !== undefined ? settings.y : position.y;
            const w = settings.width !== undefined ? settings.width : position.width;
            const h = settings.height !== undefined ? settings.height : position.height;

            // Apply crop insets to the bounding box to maintain 1:1 visual scale
            const insetL = settings.cropInsets?.left || 0;
            const insetR = settings.cropInsets?.right || 0;
            const insetT = settings.cropInsets?.top || 0;
            const insetB = settings.cropInsets?.bottom || 0;

            const finalX = x + insetL;
            const finalY = y + insetT;
            const finalW = w - (insetL + insetR);
            const finalH = h - (insetT + insetB);

            // 1. Vector Shapes (Rects, Circles, Background Panels)
            if (type === 'vector_shape') {
              const opacity = style.opacity !== undefined ? style.opacity : 1;
              const fill = style.fill_color || '#E2E8F0';
              
              const commonProps = {
                key: id,
                fill: fill,
                fillOpacity: opacity,
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onSelect && onSelect(id);
                },
                style: { cursor: 'pointer' }
              };

              if (el.shape_type === 'circle') {
                return (
                  <ellipse
                    {...commonProps}
                    cx={x + w / 2}
                    cy={y + h / 2}
                    rx={w / 2}
                    ry={h / 2}
                  />
                );
              }
              // Default to rect/rounded_rect
              return (
                <rect
                  {...commonProps}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={el.shape_type === 'rounded_rect' || style.corner_radius ? (style.corner_radius || 10) : 0}
                />
              );
            }

            // 2. Raster Images (Complex Visuals)
            if (type === 'raster_image') {
              const mode = settings.renderMode || 'svg';
              
              if (mode === 'image' && images[id]?.url) {
                return (
                  <image
                    key={id}
                    href={images[id].url}
                    x={finalX}
                    y={finalY}
                    width={finalW}
                    height={finalH}
                    preserveAspectRatio="xMidYMid meet"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect && onSelect(id);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                );
              }
              return (
                <g 
                  key={id} 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect && onSelect(id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                   <rect
                    x={finalX}
                    y={finalY}
                    width={finalW}
                    height={finalH}
                    fill="#F1F5F9"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <foreignObject 
                    x={finalX} 
                    y={finalY} 
                    width={finalW} 
                    height={finalH}
                    style={{ pointerEvents: 'none' }} // Let click pass to group
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Image</span>
                       <span className="text-[8px] text-slate-500 line-clamp-2 leading-tight mt-1">{el.semantic_desc}</span>
                    </div>
                  </foreignObject>
                </g>
              );
            }

            // 3. Text
            if (type === 'text' && el.content) {
              if (!showText) return null;
              if (hiddenIds[id]) return null;
              
              const fontSize = settings.fontSize || style.font_size || 20;
              const color = settings.fillColor || style.fill_color || '#000000';
              const align = style.alignment || 'left';
              
              return (
                <foreignObject
                  key={id}
                  x={x}
                  y={y}
                  width={w}
                  height={h + 10}
                  style={{ overflow: 'visible' }}
                >
                  <div
                    style={{
                      fontSize: `${fontSize}px`,
                      color: color,
                      fontWeight: style.is_bold ? 700 : 400,
                      textAlign: align,
                      lineHeight: 1.2,
                      fontFamily: 'Microsoft YaHei, Inter, sans-serif',
                      whiteSpace: 'pre-wrap',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect && onSelect(id);
                    }}
                  >
                    {el.content}
                  </div>
                </foreignObject>
              );
            }

            return null;
          })}
      </svg>
    </div>
  );
};

export default SlideRenderer;
