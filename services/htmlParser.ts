export interface PptxRun {
  text: string;
  options: {
    color?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    breakLine?: boolean;
    fontFace?: string;
  };
}

export const parseHtmlToPptxRuns = (html: string, baseOptions: any): PptxRun[] => {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  const runs: PptxRun[] = [];
  
  const traverse = (node: Node, currentOptions: any) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        runs.push({
          text: node.textContent,
          options: { ...currentOptions }
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const newOptions = { ...currentOptions };
      
      // Parse styles
      if (el.tagName === 'B' || el.tagName === 'STRONG' || el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 700) {
        newOptions.bold = true;
      }
      if (el.tagName === 'I' || el.tagName === 'EM' || el.style.fontStyle === 'italic') {
        newOptions.italic = true;
      }
      if (el.tagName === 'U' || el.style.textDecoration.includes('underline')) {
        newOptions.underline = true;
      }
      if (el.tagName === 'BR') {
          runs.push({ text: '\n', options: { ...newOptions } });
          return;
      }
      
      // Color
      if (el.style.color) {
        if (el.style.color.startsWith('#')) {
             newOptions.color = el.style.color.replace('#', '');
        } else if (el.style.color.startsWith('rgb')) {
             // Convert rgb to hex
             const rgb = el.style.color.match(/\d+/g);
             if (rgb && rgb.length >= 3) {
                const r = parseInt(rgb[0]);
                const g = parseInt(rgb[1]);
                const b = parseInt(rgb[2]);
                const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
                newOptions.color = hex;
             }
        }
      }
      
      // Font Size
      if (el.style.fontSize) {
         const px = parseFloat(el.style.fontSize);
         if (!isNaN(px)) {
            newOptions.fontSize = px * 0.75; // px to pt conversion (approx)
         }
      }
      
      el.childNodes.forEach(child => traverse(child, newOptions));
    }
  };
  
  traverse(div, baseOptions);
  
  // Clean up runs: merge adjacent text nodes with same options?
  // PptxGenJS handles array fine, but merging is better optimization.
  // Skipping optimization for now for simplicity.
  
  return runs;
};
