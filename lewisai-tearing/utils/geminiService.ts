import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const getClient = () => {
    const apiKey = process.env.API_KEY || ''; 
    return new GoogleGenAI({ apiKey });
};

// Helper: Resize image to reduce payload size
const resizeImage = (base64Str: string, maxWidth: number = 512): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.crossOrigin = "anonymous"; 
        img.onload = () => {
            if (img.width <= maxWidth) {
                resolve(base64Str);
                return;
            }
            const scale = maxWidth / img.width;
            const canvas = document.createElement("canvas");
            canvas.width = maxWidth;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.8)); 
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => resolve(base64Str);
    });
};

/**
 * Analyzes the image to generate a short caption.
 * Uses gemini-3-flash-preview for fast text generation.
 */
export const analyzeImage = async (base64Image: string): Promise<string> => {
  try {
    const ai = getClient();
    if (!process.env.API_KEY) {
        return "请配置 API KEY";
    }

    const resizedBase64 = await resizeImage(base64Image, 512);
    const cleanBase64 = resizedBase64.split(',')[1];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: `请作为一名专业分镜师对这张视频画面进行反推分析。
请严格按照以下格式输出一段描述：

[角度，景别，构图，画面内容]

要求：
1. **角度**：准确判断拍摄角度（如平视、仰拍、俯拍、上帝视角等）。
2. **景别**：准确判断镜头距离（如特写、近景、中景、全景、远景）。
3. **构图**：分析画面构图方式（如居中构图、三分法、对角线、框架式等）。
4. **画面内容**：
   - **务必精简**：只描述“哪里”和“发生了什么”。
   - **禁止描述色彩与画质**：不要提及颜色（如“暖色调”、“冷色”）、光影对比、滤镜效果或“电影质感”等修饰语。
   - 专注于场景结构和人物的具体动作/神态。
5. **音频/旁白**：
   - 仅当画面有**可见字幕**时，提取并标注为“字幕/台词”。
   - 若无字幕，**绝对不要**编造对话。

示例格式：
[俯拍，全景，对角线构图，繁忙十字路口，行人匆匆穿过斑马线。]
或
[平视，特写，中心构图，主角盯着屏幕，眼神惊讶。字幕：“不可能...”]`
          },
        ],
      },
    });

    return response.text?.trim() || "无法识别";
  } catch (error) {
    console.error("Gemini Caption Error:", error);
    return "AI分析失败";
  }
};

/**
 * Transforms the image into a loose storyboard sketch.
 * Uses gemini-2.5-flash-image.
 * Strictly enforces Black & White Manga style.
 */
export const generateSketch = async (base64Image: string): Promise<string> => {
    try {
        const ai = getClient();
        if (!process.env.API_KEY) throw new Error("Missing API Key");

        const resizedBase64 = await resizeImage(base64Image, 800);
        const cleanBase64 = resizedBase64.split(',')[1];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: cleanBase64,
                        },
                    },
                    {
                        text: "Transform this image into a professional Manga/Comic storyboard sketch. \nSTYLE REQUIREMENTS:\n- STRICTLY BLACK AND WHITE. NO COLOR. NO SEPIA.\n- High contrast ink lines on white paper.\n- Use cross-hatching for shading.\n- Simplified details, focus on composition and action.\n- Make it look like a hand-drawn rough draft by a master artist.",
                    },
                ],
            },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        throw new Error("No image generated");
    } catch (error) {
        console.error("Gemini Sketch Error:", error);
        throw error;
    }
};