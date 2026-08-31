import { authService } from './auth';

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

export const aiScanService = {
  async scanExamWithAI(
    base64Data: string,
    mimeType: string
  ): Promise<ScannedExamResult> {
    const token = authService.getAdminToken() || 'Bearer PlAcEmEnT_TeSt_SeCrEt_Token';
    
    // Strip metadata prefix if present
    let cleanBase64 = base64Data;
    if (base64Data.includes(',')) {
      cleanBase64 = base64Data.split(',')[1];
    }

    const response = await fetch('/api/admin/exams/scan-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({
        fileData: cleanBase64,
        mimeType
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Lỗi kết nối máy chủ' }));
      throw new Error(errorData.error || 'Quá trình quét đề bằng AI thất bại');
    }

    const data = await response.json();
    if (!data.examData) {
      throw new Error('Máy chủ không trả về kết quả quét đề hợp lệ.');
    }

    return data.examData as ScannedExamResult;
  }
};
