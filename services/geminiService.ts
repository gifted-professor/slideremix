import { GoogleGenAI, Type } from "@google/genai";
import { SlideData, ProcessMode, VisualStyle, SlideElement } from "../types";

const MODEL_NAME = 'gemini-3-pro-preview';

export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeSlide = async (
  base64Image: string,
  mode: ProcessMode,
  style: VisualStyle,
  userApiKey?: string
): Promise<SlideData> => {
  // Prioritize user-provided key, fallback to environment variable
  const apiKey = userApiKey || import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("API Key 缺失。请在左侧设置栏中填写您的 API Key。");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are a "Vector Graphics Decompiler" for Presentation Software.
    Your job is to convert a slide screenshot into a structured SVG-compatible format.
    
    *** COORDINATE SYSTEM ***
    - **Canvas Size**: 1000 width x 562.5 height (16:9 Aspect Ratio).
    - All coordinates (x, y, w, h) must be in this 0-1000 scale.

    *** CLASSIFICATION LOGIC (CRITICAL) ***
    Analyze every visual element and classify it into one of three types:
    
    1. **'text'**: Any readable text. 
       - **IMPORTANT**: Text MUST be separated from background images/shapes. Do not include text inside a raster_image bounding box if the text can be extracted.
       - Even if text is inside a diagram, try to extract it as a 'text' element on top of the diagram shape.

    2. **'vector_shape'**: Simple geometric elements.
       - Solid color backgrounds behind text.
       - Decorative rectangles, lines, circles, or simple arrows.
       - Icons that are simple enough to be represented as shapes.
       - *Rule*: If it's a solid color box, it is a SHAPE, not an IMAGE.

    3. **'raster_image'**: Complex visuals.
       - Photographs of people, places, or objects.
       - Complex 3D renders.
       - **DECOMPOSITION RULE**: For diagrams (e.g., flowcharts, cycle charts, "AI Brain" diagrams), do NOT create one single huge image covering the whole diagram.
         - Isolate distinct icons (e.g., the brain icon, the database icon, the user icon) as separate 'raster_image' elements.
         - Isolate arrows as 'vector_shape' (if simple) or 'raster_image' (if complex/hand-drawn style).
         - This allows the user to rearrange the diagram parts later.
       - Detailed screenshots or charts that cannot be rebuilt with simple shapes.

    *** STYLE EXTRACTION ***
    - **Color**: Extract hex codes. Detect opacity/transparency if a shape is see-through (0.0 - 1.0).
    - **Font Size**: precise height in the 0-562.5 vertical scale.
    - **Z-Index**: Estimate layer order (1 = background, 100 = foreground). Text is usually high z-index.

    Output pure JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg", 
              data: base64Image
            }
          },
          {
            text: "Decompile this slide into vector elements. Distinguish between simple shapes (rects) and complex images."
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slide_meta: {
              type: Type.OBJECT,
              properties: {
                background_color: { type: Type.STRING },
              },
              required: ["background_color"]
            },
            elements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["text", "vector_shape", "raster_image"] },
                  shape_type: { type: Type.STRING, enum: ["rect", "circle", "rounded_rect", "line"] },
                  content: { type: Type.STRING },
                  semantic_desc: { type: Type.STRING },
                  position: { 
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      width: { type: Type.NUMBER },
                      height: { type: Type.NUMBER },
                    },
                    required: ["x", "y", "width", "height"]
                  },
                  style: {
                    type: Type.OBJECT,
                    properties: {
                      fill_color: { type: Type.STRING },
                      opacity: { type: Type.NUMBER },
                      font_size: { type: Type.NUMBER },
                      is_bold: { type: Type.BOOLEAN },
                      alignment: { type: Type.STRING, enum: ["left", "center", "right"] },
                      corner_radius: { type: Type.NUMBER }
                    }
                  },
                  z_index: { type: Type.NUMBER }
                },
                required: ["id", "type", "position", "z_index", "style"]
              }
            }
          },
          required: ["slide_meta", "elements"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Gemini 未返回数据");
    
    const rawData = JSON.parse(text);
    return rawData as SlideData;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    const e = error as any;
    const msg: string = e?.error?.details?.[0]?.message || e?.error?.message || e?.message || "分析失败";
    if (
      msg.includes("API key not valid") ||
      e?.error?.details?.some((d: any) => d?.reason === "API_KEY_INVALID")
    ) {
      throw new Error("API Key 无效，请在侧栏输入有效的 Gemini API Key。");
    }
    throw new Error(msg);
  }
};

export const remixElementImage = async (
  base64Image: string,
  element: SlideElement,
  style: VisualStyle,
  apiKey: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  throw new Error("AI 重绘未启用");
};
