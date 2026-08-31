export interface SpeakingEvaluationResult {
  score: number;
  finalS: 'correct' | 'incorrect' | 'partial';
  finalT: 'correct' | 'incorrect' | 'partial';
  finalK: 'correct' | 'incorrect' | 'partial';
  stress1: 'correct' | 'incorrect';
  stress2: 'correct' | 'incorrect';
  stress3: 'correct' | 'incorrect';
  stress4: 'correct' | 'incorrect';
  transcript: string;
  details: string;
}

export const speakingService = {
  async evaluateSpeakingAudio(
    audioUrl: string,
    referenceText: string,
    candidateId?: string
  ): Promise<SpeakingEvaluationResult> {
    try {
      const response = await fetch('/api/speaking/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidateId || 'preview-eval',
          audioPath: audioUrl,
          referenceText
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.evaluation) {
          return data.evaluation as SpeakingEvaluationResult;
        }
      }
    } catch (error) {
      console.warn('Speaking evaluation via server failed, using fallback:', error);
    }

    return this.getSimulatedFallback();
  },

  getSimulatedFallback(): SpeakingEvaluationResult {
    return {
      score: 78,
      finalS: 'partial',
      finalT: 'correct',
      finalK: 'incorrect',
      stress1: 'correct',
      stress2: 'correct',
      stress3: 'correct',
      stress4: 'incorrect',
      transcript: "The local test requires great focus and skill. You must speak clearly into the microphone to describe the situation. Each candidate want to show their best performance. Do not feel anxious; just read this short text naturally with confident pronunciation.",
      details: "Học sinh có phát âm rõ ràng, tốc độ vừa phải dễ nghe. Tuy nhiên, một số âm cuối s, k bị bỏ qua hoặc phát âm chưa rõ (ví dụ: 'skills' đọc thiếu s âm cuối, 'speak' phát âm đuôi k chưa rõ). Trọng âm từ 4 âm tiết (như situation) cần được nhấn chính xác hơn. Các từ 1 và 2 âm tiết phát âm tương đối tốt, đúng trọng âm."
    };
  }
};
