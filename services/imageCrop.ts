/*
 * @Author: gifted-professor 1044396185@qq.com
 * @Date: 2025-12-29 19:47:44
 * @LastEditors: gifted-professor 1044396185@qq.com
 * @LastEditTime: 2025-12-29 20:03:26
 * @FilePath: /slideremix/services/imageCrop.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Position } from "../types";

export const cropBase64Region = async (
  base64Image: string,
  naturalWidth: number,
  naturalHeight: number,
  region: Position,
  options?: { 
    feather?: number; 
    inflatePx?: number;
    cropInsets?: { top: number; bottom: number; left: number; right: number };
    eraseRegions?: { x: number; y: number; width: number; height: number }[];
    erasePaths?: { x: number; y: number }[][];
  }
): Promise<{ base64: string; url: string }> => {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64Image}`;
  await new Promise((resolve) => {
    if (img.complete) resolve(null);
    else img.onload = () => resolve(null);
  });

  const scaleX = naturalWidth / 1000;
  const scaleY = naturalHeight / 562.5;
  const inflate = Math.max(0, options?.inflatePx ?? 2);
  const feather = Math.max(0, options?.feather ?? 2);
  const insets = {
    top: options?.cropInsets?.top || 0,
    bottom: options?.cropInsets?.bottom || 0,
    left: options?.cropInsets?.left || 0,
    right: options?.cropInsets?.right || 0
  };

  // 1. Calculate base region in original image pixels
  let sx = Math.floor(region.x * scaleX) - inflate;
  let sy = Math.floor(region.y * scaleY) - inflate;
  let sw = Math.floor(region.width * scaleX) + inflate * 2;
  let sh = Math.floor(region.height * scaleY) + inflate * 2;

  // 2. Apply Insets (Now treated as Slide Coordinates 0-1000, converted to pixels)
  sx += Math.floor(insets.left * scaleX);
  sy += Math.floor(insets.top * scaleY);
  sw -= Math.floor((insets.left + insets.right) * scaleX);
  sh -= Math.floor((insets.top + insets.bottom) * scaleY);

  sx = Math.max(0, sx);
  sy = Math.max(0, sy);
  sw = Math.min(naturalWidth - sx, Math.max(1, sw));
  sh = Math.min(naturalHeight - sy, Math.max(1, sh));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, sw);
  canvas.height = Math.max(1, sh);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  // Apply Eraser Regions
  if (options?.eraseRegions && options.eraseRegions.length > 0) {
    options.eraseRegions.forEach(region => {
      // Region coordinates are in percentage (0-100) relative to the CROPPED image
      const ex = (region.x / 100) * sw;
      const ey = (region.y / 100) * sh;
      const ew = (region.width / 100) * sw;
      const eh = (region.height / 100) * sh;
      
      ctx.clearRect(ex, ey, ew, eh);
    });
  }

  // Apply Eraser Paths (Freehand)
  if (options?.erasePaths && options.erasePaths.length > 0) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(5, sw * 0.05); // Dynamic eraser size relative to image width

    options.erasePaths.forEach(path => {
      if (path.length < 2) return;
      
      ctx.beginPath();
      // Move to first point
      ctx.moveTo((path[0].x / 100) * sw, (path[0].y / 100) * sh);
      
      // Draw lines to subsequent points
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo((path[i].x / 100) * sw, (path[i].y / 100) * sh);
      }
      ctx.stroke();
    });
    
    ctx.globalCompositeOperation = "source-over";
  }

  if (feather > 0) {
    const fade = (g: CanvasGradient, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    };
    ctx.globalCompositeOperation = "destination-out";
    const gTop = ctx.createLinearGradient(0, 0, 0, feather);
    gTop.addColorStop(0, "rgba(0,0,0,1)");
    gTop.addColorStop(1, "rgba(0,0,0,0)");
    fade(gTop, 0, 0, sw, feather);

    const gBottom = ctx.createLinearGradient(0, sh, 0, sh - feather);
    gBottom.addColorStop(0, "rgba(0,0,0,1)");
    gBottom.addColorStop(1, "rgba(0,0,0,0)");
    fade(gBottom, 0, sh - feather, sw, feather);

    const gLeft = ctx.createLinearGradient(0, 0, feather, 0);
    gLeft.addColorStop(0, "rgba(0,0,0,1)");
    gLeft.addColorStop(1, "rgba(0,0,0,0)");
    fade(gLeft, 0, 0, feather, sh);

    const gRight = ctx.createLinearGradient(sw, 0, sw - feather, 0);
    gRight.addColorStop(0, "rgba(0,0,0,1)");
    gRight.addColorStop(1, "rgba(0,0,0,0)");
    fade(gRight, sw - feather, 0, feather, sh);
    ctx.globalCompositeOperation = "source-over";
  }

  const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  const url = canvas.toDataURL("image/png");
  return { base64, url };
};
