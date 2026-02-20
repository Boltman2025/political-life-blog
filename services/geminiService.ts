import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const summarizeArticle = async (content: string): Promise<string> => {
  if (!apiKey) {
    return "عذراً، مفتاح API غير متوفر. يرجى التأكد من الإعدادات.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `لخص هذا المقال السياسي بأسلوب صحفي محايد وموجز في حدود 3 نقاط رئيسية باللغة العربية:\n\n${content}`,
      config: {
        temperature: 0.3,
      }
    });

    return response.text || "لم يتم إنشاء ملخص.";
  } catch (error) {
    console.error("Error summarizing article:", error);
    return "حدث خطأ أثناء محاولة تلخيص المقال. يرجى المحاولة لاحقاً.";
  }
};