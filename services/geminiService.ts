// services/geminiService.ts

export async function summarizeArticle(text: string): Promise<string> {
  // تعطيل Gemini مؤقتًا لتفادي كسر البناء
  // يمكن تفعيله لاحقًا بسهولة
  return text.slice(0, 600) + "...";
}
