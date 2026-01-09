import { GoogleGenAI } from "@google/genai";
import { GEMINI_SYSTEM_INSTRUCTION, DEFAULT_THEME } from "../constants";
import { LevelTheme } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateLevelTheme = async (prompt: string): Promise<LevelTheme> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a game theme based on this mood: "${prompt}"`,
      config: {
        systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return DEFAULT_THEME;
    
    // Parse JSON
    const theme = JSON.parse(text) as LevelTheme;
    
    // Validate basics
    if (!theme.colors || theme.colors.length < 4) return DEFAULT_THEME;
    
    return theme;

  } catch (error) {
    console.error("Error generating theme:", error);
    return DEFAULT_THEME;
  }
};
