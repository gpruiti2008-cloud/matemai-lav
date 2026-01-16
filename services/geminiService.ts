
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION, MODEL_NAME } from "../constants";
import { Message, Role, StructuredContent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getGeminiResponse = async (history: Message[], currentMessage: Message): Promise<StructuredContent | string> => {
  const contents = history.map(msg => ({
    role: msg.role === Role.USER ? 'user' : 'model',
    parts: msg.parts.map(part => {
      if (part.image) {
        return {
          inlineData: {
            mimeType: 'image/jpeg',
            data: part.image.split(',')[1]
          }
        };
      }
      return { text: part.structured ? JSON.stringify(part.structured) : (part.text || '') };
    })
  }));

  contents.push({
    role: 'user',
    parts: currentMessage.parts.map(part => {
      if (part.image) {
        return {
          inlineData: {
            mimeType: 'image/jpeg',
            data: part.image.split(',')[1]
          }
        };
      }
      return { text: part.text || '' };
    })
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents as any,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        responseMimeType: "application/json"
      },
    });

    const text = response.text || "";
    try {
      return JSON.parse(text) as StructuredContent;
    } catch (e) {
      console.error("Failed to parse JSON response:", text);
      return text; // Fallback to raw text if parsing fails
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Scusa, ho avuto un problema tecnico. Prova a ricaricare la pagina.";
  }
};
