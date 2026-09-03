import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Chưa cấu hình GEMINI_API_KEY trong hệ thống. Giáo viên vui lòng vào Settings > Secrets để cấu hình.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface ScannedExamResult {
  title: string;
  description: string;
  durationMinutes: number;
  listeningPart1: any[];
  listeningPart2: any[];
  speakingReadAloud: { text: string; wordCount: number };
  speakingQuestions: { id: string; text: string }[];
  grammar: any[];
  vocabulary: any[];
  readingPassage: {
    title: string;
    text: string;
    questionsPartA: any[];
    questionsPartB: any[];
  };
  writingQuestions: { id: string; text: string; vietnamese: string }[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function scanExamWithAI(
  base64Data: string,
  mimeType: string
): Promise<ScannedExamResult> {
  const promptText = `
    You are an expert English Language examiner. Your task is to scan the attached file/image of an English test/exam and extract the content EXACTLY as it appears in the scanned document.
    
    CRITICAL RULE: DO NOT generate fake, synthetic, or dummy placeholder questions or sections for missing parts. If a specific section (e.g. Listening, Speaking, Reading, Writing, Grammar, or Vocabulary) is NOT present in the scanned image, leave its array empty ([]) or its text properties empty (""). Do not invent any questions out of nowhere. Only extract the real, actual questions written in the image, and categorize them into the correct skill section fields.
    
    Structure the JSON output exactly with these specifications:
    1. "title": The title of the exam exactly as written, or a brief descriptive title in Vietnamese based on the content.
    2. "description": A short summary in Vietnamese of what skills are tested.
    3. "durationMinutes": Duration of the test if specified, or default to 45.
    4. "listeningPart1": Multiple Choice Questions from Listening. IDs MUST start with "l1_" (e.g. l1_1, l1_2). Fields: id, type: "mcq", text, options: [3 options], answer: "A" or "B" or "C".
    5. "listeningPart2": Fill-in-the-blank questions from Listening. IDs MUST start with "l2_" (e.g. l2_1, l2_2). Fields: id, type: "blank", text (must include blank, e.g. "We booked a ____ room."), answer (the single word or number answer).
    6. "speakingReadAloud": Reading passage for speaking aloud if present in the image. Fields: text, wordCount (approximate number of words).
    7. "speakingQuestions": Conversational speaking questions found in the image. IDs are "sp_1", "sp_2", "sp_3". Fields: id, text.
    8. "grammar": Grammar questions. IDs MUST start with "g_" (e.g. g_1, g_2). Fields: id, type: "mcq" or "blank", text, options (only if type is mcq, array of 4 options), answer (A/B/C/D if mcq, or the blank answer word if blank).
    9. "vocabulary": Vocabulary questions. IDs MUST start with "v_" (e.g. v_1, v_2). Fields: id, type: "mcq", text, options (array of 4 options), answer (A/B/C/D).
    10. "readingPassage": Reading passage and its questions. Fields:
        - title: Title of the passage.
        - text: The passage text.
        - questionsPartA: MCQs based on passage. IDs MUST start with "r_" (e.g. r_1, r_2). Fields: id, type: "mcq", text, options (4 options), answer (A/B/C/D).
        - questionsPartB: True/False/Not Given questions. IDs MUST start with "r_" (e.g. r_3, r_4). Fields: id, type: "mcq", text, options: ["True", "False", "Not Given"], answer ("True", "False", or "Not Given").
    11. "writingQuestions": Writing/translation prompts. IDs MUST start with "w_" (e.g. w_1, w_2). Fields: id, text (Vietnamese prompt or sentence to translate), vietnamese (the source Vietnamese text).

    Extract content carefully, match character for character where applicable, and output valid JSON matching this schema exactly.
  `;

  const responseSchemaConfig = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      durationMinutes: { type: Type.INTEGER },
      listeningPart1: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["mcq"] },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING }
          },
          required: ["id", "type", "text", "options", "answer"]
        }
      },
      listeningPart2: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["blank"] },
            text: { type: Type.STRING },
            answer: { type: Type.STRING }
          },
          required: ["id", "type", "text", "answer"]
        }
      },
      speakingReadAloud: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          wordCount: { type: Type.INTEGER }
        },
        required: ["text", "wordCount"]
      },
      speakingQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["id", "text"]
        }
      },
      grammar: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["mcq", "blank"] },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING }
          },
          required: ["id", "type", "text", "answer"]
        }
      },
      vocabulary: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["mcq"] },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING }
          },
          required: ["id", "type", "text", "options", "answer"]
        }
      },
      readingPassage: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          text: { type: Type.STRING },
          questionsPartA: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["mcq"] },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING }
              },
              required: ["id", "type", "text", "options", "answer"]
            }
          },
          questionsPartB: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["mcq"] },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING }
              },
              required: ["id", "type", "text", "options", "answer"]
            }
          }
        },
        required: ["title", "text", "questionsPartA", "questionsPartB"]
      },
      writingQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            vietnamese: { type: Type.STRING }
          },
          required: ["id", "text", "vietnamese"]
        }
      }
    },
    required: [
      "title",
      "description",
      "durationMinutes",
      "listeningPart1",
      "listeningPart2",
      "speakingReadAloud",
      "speakingQuestions",
      "grammar",
      "vocabulary",
      "readingPassage",
      "writingQuestions"
    ]
  };

  const filePart = {
    inlineData: {
      mimeType,
      data: base64Data
    }
  };

  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  const maxRetriesPerModel = 2;
  let lastError: any = null;

  for (const modelName of candidateModels) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [filePart, promptText],
          config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchemaConfig,
          }
        });

        const jsonText = response.text?.trim() || '{}';
        const parsed = JSON.parse(jsonText) as ScannedExamResult;
        if (parsed && typeof parsed.title === 'string') {
          return parsed;
        }
      } catch (error: any) {
        lastError = error;
        const errMessage = error?.message || String(error);
        const isTransient =
          errMessage.includes('503') ||
          errMessage.includes('429') ||
          errMessage.includes('high demand') ||
          errMessage.includes('UNAVAILABLE') ||
          errMessage.includes('RESOURCE_EXHAUSTED') ||
          errMessage.includes('overloaded');

        console.warn(`[Exam AI Scan] Model ${modelName} attempt ${attempt + 1} failed (${errMessage}). Transient: ${isTransient}`);

        if (isTransient && attempt < maxRetriesPerModel) {
          const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 4000);
          await sleep(backoff);
          continue;
        }

        break;
      }
    }
  }

  console.error('AI exam scanning failed on all attempts:', lastError);
  throw new Error('Quá trình quét đề bằng AI thất bại: ' + (lastError?.message || lastError || 'Model unavailable'));
}

