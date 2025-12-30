
export type ProcessMode = 'fidelity' | 'remix';
export type VisualStyle = 'original' | 'minimalist' | 'hand_drawn';

export interface Position {
  x: number; // 0-1000 coordinate space
  y: number; // 0-1000 coordinate space
  width: number; // 0-1000 coordinate space
  height: number; // 0-1000 coordinate space
}

export interface ElementStyle {
  fill_color?: string;
  stroke_color?: string;
  opacity?: number; // 0-1
  font_size?: number; // In SVG coordinate units (0-1000)
  is_bold?: boolean;
  alignment?: 'left' | 'center' | 'right';
  corner_radius?: number; // For rounded rects
}

export interface SlideElement {
  id: string;
  type: 'text' | 'vector_shape' | 'raster_image';
  shape_type?: 'rect' | 'circle' | 'line' | 'rounded_rect'; // For vector_shapes
  content?: string; // For text
  semantic_desc?: string; // For images
  position: Position;
  style: ElementStyle;
  z_index: number;
}

export interface SlideMeta {
  background_color: string;
}

export interface ElementSettings {
  renderMode: 'svg' | 'image';
  removeBg?: boolean;
  inflateAmount?: number; // -10 to 10
  fontSize?: number;
  fillColor?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  hidden?: boolean;
  cropInsets?: { top: number; bottom: number; left: number; right: number };
  erasePaths?: { x: number; y: number }[][]; // Array of paths, each path is array of points (0-100 scale)
  eraseRegions?: { x: number; y: number; width: number; height: number }[]; // Deprecated but kept for backward compat
}

export interface SlideData {
  slide_meta: SlideMeta;
  elements: SlideElement[];
}

export type AnalysisStatus = 'idle' | 'analyzing' | 'success' | 'error';
