import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../firebase';
import { examService } from './examService';

export interface CandidateLog {
  timestamp: string;
  action: string;
}

export interface Candidate {
  id: string;
  fullName: string;
  phone: string;
  isLocked?: boolean;
  examId: string;
  registeredAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  leftRoom?: boolean;
  durationSeconds: number;
  tabSwitches: number;
  logs: CandidateLog[];
  writingScore: number;
  writingComment: string;
  audioPlayback?: {
    audio1Played?: boolean;
    audio1PlayedAt?: string;
    audio2Played?: boolean;
    audio2PlayedAt?: string;
  };
  audio1Played?: boolean;
  audio2Played?: boolean;
  answers: {
    listeningPart1: Record<string, string>;
    listeningPart2: Record<string, string>;
    grammar: Record<string, string>;
    vocabulary: Record<string, string>;
    readingPartA: Record<string, string>;
    readingPartB: Record<string, string>;
    speakingPart1: {
      audioPath: string | null;
      aiEvaluation: any | null;
    };
    speakingPart2: {
      sp_1_audioPath: string | null;
      sp_2_audioPath: string | null;
      sp_3_audioPath: string | null;
    };
    writing: Record<string, string>;
  };
  scores: {
    listening: number;
    grammar: number;
    vocabulary: number;
    reading: number;
    writing: number;
    total: number;
    maxPossible: number;
    percentage: number;
  } | null;
}

// Helper to normalize strings for comparison
function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

// Precise checker for fill-in-the-blank questions
export function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
  if (!userAnswer) return false;
  const normUser = normalizeString(userAnswer);
  const normCorrect = normalizeString(correctAnswer);

  if (!normUser) return false;
  if (normUser === normCorrect) return true;

  if (normCorrect === '1700') {
    return normUser === '1700' || normUser.includes('1700');
  }
  if (normCorrect === '15') {
    return normUser === '15' || normUser.includes('15');
  }
  if (normCorrect === 'may 5th') {
    const valid = ['may 5th', 'may 5', '5 may', '5th may', 'may fifth', 'fifth of may'];
    return valid.includes(normUser) || normUser.includes('may 5');
  }
  if (normCorrect === 'have never tried') {
    const valid = ['have never tried', 'never tried', 'havent tried', 'has never tried', 'tried'];
    return valid.includes(normUser);
  }

  if (normUser.length < 3) {
    return normUser === normCorrect;
  }

  const correctWords = normCorrect.split(' ');
  if (correctWords.length > 1) {
    return normUser.includes(normCorrect) || normCorrect.includes(normUser);
  }

  return normUser === normCorrect;
}

export function isAnswerSkipped(userAnswer: string | undefined, candidate?: any, questionId?: string): boolean {
  if (userAnswer === '__SKIPPED__') return true;
  if (candidate && questionId) {
    const skippedMap = candidate.answers?.skippedQuestions || (candidate as any).skippedQuestions;
    if (skippedMap && skippedMap[questionId]) return true;
  }
  return false;
}

export function getCandidateAnswer(candidate: Candidate | null | undefined, sectionKey: string, questionId: string): string {
  if (!candidate || !candidate.answers) return '';
  const a = candidate.answers as any;

  // 1. Direct section check
  if (a[sectionKey] && a[sectionKey][questionId] !== undefined) {
    return String(a[sectionKey][questionId]);
  }

  // 2. Check all other standard section buckets
  const standardSections = ['listeningPart1', 'listeningPart2', 'grammar', 'vocabulary', 'readingPartA', 'readingPartB', 'writing'];
  for (const sec of standardSections) {
    if (a[sec] && a[sec][questionId] !== undefined) {
      return String(a[sec][questionId]);
    }
  }

  // 3. Check flatAnswers or raw
  if (a.flatAnswers && a.flatAnswers[questionId] !== undefined) {
    return String(a.flatAnswers[questionId]);
  }
  if (a.raw && a.raw[questionId] !== undefined) {
    return String(a.raw[questionId]);
  }

  // 4. Check if answers itself is flat key-value
  if (a[questionId] !== undefined && typeof a[questionId] === 'string') {
    return String(a[questionId]);
  }

  return '';
}

export function isAnswerCorrect(userAnswer: string | undefined, question: any): boolean {
  if (!userAnswer || userAnswer === '__SKIPPED__') return false;
  const user = userAnswer.trim();
  const correct = (question?.answer || '').trim();
  if (!user || !correct) return false;

  // 1. Direct case-insensitive match (covers A/B/C/D, True/False/Not Given, exact words)
  if (user.toUpperCase() === correct.toUpperCase()) {
    return true;
  }

  // 2. If question is a blank / fill-in-the-blank question:
  if (question.type === 'blank') {
    return checkAnswer(user, correct);
  }

  // 3. If question has options (MCQ), check letter ('A', 'B'...) vs option text
  if (Array.isArray(question.options) && question.options.length > 0) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    // User selected letter (e.g. 'B'), question.answer is the text of option B
    const userLetterIdx = letters.indexOf(user.toUpperCase());
    if (userLetterIdx >= 0 && userLetterIdx < question.options.length) {
      const optText = (question.options[userLetterIdx] || '').trim();
      if (optText.toUpperCase() === correct.toUpperCase()) {
        return true;
      }
    }

    // Question answer is a letter (e.g. 'B'), user submitted the text of option B
    const correctLetterIdx = letters.indexOf(correct.toUpperCase());
    if (correctLetterIdx >= 0 && correctLetterIdx < question.options.length) {
      const optText = (question.options[correctLetterIdx] || '').trim();
      if (user.toUpperCase() === optText.toUpperCase()) {
        return true;
      }
    }

    // Check if user answer matches option text and that option is the correct answer
    for (let i = 0; i < question.options.length; i++) {
      const opt = (question.options[i] || '').trim().toUpperCase();
      if (opt === user.toUpperCase() && (letters[i] === correct.toUpperCase() || opt === correct.toUpperCase())) {
        return true;
      }
    }
  }

  // 4. Fallback to fuzzy checkAnswer for text blanks
  return checkAnswer(user, correct);
}

export function autoGradeCandidate(candidate: Candidate, exam: any): Candidate['scores'] {
  const listeningPart1 = exam?.questions?.listeningPart1 || [];
  const listeningPart2 = exam?.questions?.listeningPart2 || [];
  const grammarQuestions = exam?.questions?.grammar || [];
  const vocabularyQuestions = exam?.questions?.vocabulary || [];
  const readingPartA = exam?.questions?.readingPassage?.questionsPartA || [];
  const readingPartB = exam?.questions?.readingPassage?.questionsPartB || [];

  // 1. Listening Part 1
  let listeningScore = 0;
  listeningPart1.forEach((q: any) => {
    const userAnswer = getCandidateAnswer(candidate, 'listeningPart1', q.id);
    if (isAnswerCorrect(userAnswer, q)) {
      listeningScore += 1;
    }
  });

  // Listening Part 2
  listeningPart2.forEach((q: any) => {
    const userAnswer = getCandidateAnswer(candidate, 'listeningPart2', q.id);
    if (isAnswerCorrect(userAnswer, q)) {
      listeningScore += 1;
    }
  });

  // 2. Grammar
  let grammarScore = 0;
  grammarQuestions.forEach((q: any) => {
    const userAnswer = getCandidateAnswer(candidate, 'grammar', q.id);
    if (isAnswerCorrect(userAnswer, q)) {
      grammarScore += 1;
    }
  });

  // 3. Vocabulary
  let vocabularyScore = 0;
  vocabularyQuestions.forEach((q: any) => {
    const userAnswer = getCandidateAnswer(candidate, 'vocabulary', q.id);
    if (isAnswerCorrect(userAnswer, q)) {
      vocabularyScore += 1;
    }
  });

  // 4. Reading Part A
  let readingScore = 0;
  readingPartA.forEach((q: any) => {
    const userAnswer = getCandidateAnswer(candidate, 'readingPartA', q.id);
    if (isAnswerCorrect(userAnswer, q)) {
      readingScore += 1;
    }
  });

  // Reading Part B
  readingPartB.forEach((q: any) => {
    const userAnswer = getCandidateAnswer(candidate, 'readingPartB', q.id);
    if (isAnswerCorrect(userAnswer, q)) {
      readingScore += 1;
    }
  });

  const writingScore = candidate.writingScore || 0;
  const writingQuestions = exam?.questions?.writingQuestions || [];
  const writingMax = (writingQuestions.length > 0 || exam?.id === 'default-exam') ? 10 : 0;
  const totalAuto = listeningScore + grammarScore + vocabularyScore + readingScore;
  const total = totalAuto + writingScore;
  const maxPossible = 
    listeningPart1.length + 
    listeningPart2.length + 
    grammarQuestions.length + 
    vocabularyQuestions.length + 
    readingPartA.length + 
    readingPartB.length + 
    writingMax;

  const percentage = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;

  return {
    listening: listeningScore,
    grammar: grammarScore,
    vocabulary: vocabularyScore,
    reading: readingScore,
    writing: writingScore,
    total,
    maxPossible,
    percentage
  };
}

export const normalizePhone = (phone?: string): string => {
  return (phone || '').replace(/[\s\.\-\(\)]/g, '').trim();
};

export const candidateService = {
  async getCandidates(): Promise<Candidate[]> {
    try {
      const colRef = collection(db, 'candidates');
      const snap = await getDocs(colRef);
      const rawList: Candidate[] = [];
      snap.forEach((d) => {
        rawList.push({ id: d.id, ...d.data() } as Candidate);
      });

      // Deduplicate candidates by (normalized phone + examId)
      // If a candidate submitted an exam and also has an unsubmitted ghost record for that exam,
      // keep the submitted one!
      const deduplicatedMap = new Map<string, Candidate>();

      // Sort so submitted records come first (newest submission first), followed by highest duration
      rawList.sort((a, b) => {
        if (a.submittedAt && !b.submittedAt) return -1;
        if (!a.submittedAt && b.submittedAt) return 1;
        if (a.submittedAt && b.submittedAt) {
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
        return (b.durationSeconds || 0) - (a.durationSeconds || 0);
      });

      rawList.forEach((c) => {
        const cleanPhone = normalizePhone(c.phone) || (c.phone ? c.phone.trim() : c.id);
        const examKey = c.examId || 'default-exam';
        const key = `${cleanPhone}__${examKey}`;

        if (!deduplicatedMap.has(key)) {
          deduplicatedMap.set(key, c);
        }
      });

      return Array.from(deduplicatedMap.values());
    } catch (err) {
      console.error('Error listing candidates:', err);
      return [];
    }
  },

  async getCandidateById(id: string): Promise<Candidate | null> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const docRef = doc(db, 'candidates', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as Candidate;
        }
        return null;
      } catch (err) {
        console.warn(`getCandidateById attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
    }

    // Check local session as fallback if Firestore is temporarily offline
    try {
      const sessionStr = localStorage.getItem('candidate_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.candidate?.id === id) {
          return session.candidate;
        }
      }
    } catch (e) {}

    return null;
  },

  async checkIsPhoneLocked(phone: string): Promise<boolean> {
    try {
      const cleanPhone = normalizePhone(phone);
      const colRef = collection(db, 'candidates');
      const snap = await getDocs(colRef);
      let locked = false;
      snap.forEach((doc) => {
        const data = doc.data() as Candidate;
        if (normalizePhone(data.phone) === cleanPhone && data.isLocked) {
          locked = true;
        }
      });
      return locked;
    } catch (err) {
      console.error('Error checking lock state:', err);
      return false;
    }
  },

  async getCandidatesByPhone(phone: string): Promise<Candidate[]> {
    try {
      const cleanPhone = normalizePhone(phone);
      const colRef = collection(db, 'candidates');
      const snap = await getDocs(colRef);
      const list: Candidate[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as Candidate;
        if (normalizePhone(data.phone) === cleanPhone) {
          list.push({ id: doc.id, ...data });
        }
      });
      return list;
    } catch (err) {
      console.error('Error fetching candidates by phone:', err);
      return [];
    }
  },

  async getCandidateByPhoneAndExam(phone: string, examId: string): Promise<Candidate | null> {
    try {
      const list = await this.getCandidatesByPhone(phone);
      const targetExamId = examId || 'default-exam';
      const matches = list.filter((c) => (c.examId || 'default-exam') === targetExamId);
      if (matches.length === 0) return null;

      // Prefer submitted candidate
      matches.sort((a, b) => {
        if (a.submittedAt && !b.submittedAt) return -1;
        if (!a.submittedAt && b.submittedAt) return 1;
        if (a.submittedAt && b.submittedAt) {
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
        return (b.durationSeconds || 0) - (a.durationSeconds || 0);
      });
      return matches[0];
    } catch (err) {
      console.error('Error fetching candidate by phone and exam:', err);
      return null;
    }
  },

  async registerCandidate(fullName: string, phone: string, examId: string): Promise<{
    candidate: Candidate;
    exam: any;
    restoredAnswers: Record<string, string>;
  }> {
    const cleanPhone = normalizePhone(phone);
    const targetExamId = examId || 'default-exam';

    const isLocked = await this.checkIsPhoneLocked(cleanPhone);
    if (isLocked) {
      throw new Error('Số điện thoại này đã bị khóa trên hệ thống. Vui lòng liên hệ Giáo viên để được hỗ trợ.');
    }

    const exam = await examService.getExamById(targetExamId);

    // Check if there is an existing candidate with this phone and this exam
    const existingCandidates = await this.getCandidatesByPhone(cleanPhone);
    const matchingDocs = existingCandidates.filter((c) => (c.examId || 'default-exam') === targetExamId);
    
    if (matchingDocs.length > 0) {
      // Prioritize submitted candidates (most recent submittedAt), then in-progress
      matchingDocs.sort((a, b) => {
        if (a.submittedAt && !b.submittedAt) return -1;
        if (!a.submittedAt && b.submittedAt) return 1;
        if (a.submittedAt && b.submittedAt) {
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
        return (b.durationSeconds || 0) - (a.durationSeconds || 0);
      });

      const existing = matchingDocs[0];

      // Auto-cleanup any unsubmitted duplicate ghost documents for this same exam
      if (matchingDocs.length > 1) {
        for (let i = 1; i < matchingDocs.length; i++) {
          const duplicate = matchingDocs[i];
          if (existing.submittedAt && !duplicate.submittedAt) {
            try {
              await deleteDoc(doc(db, 'candidates', duplicate.id));
            } catch (err) {
              console.warn('Failed to clean up duplicate candidate doc:', duplicate.id, err);
            }
          }
        }
      }
      
      if (existing.leftRoom) {
        throw new Error('Bạn đã tự ý rời khỏi phòng thi trước đó và không thể tiếp tục hoặc làm lại bài thi này trừ khi được Giáo viên khôi phục (Reset).');
      }

      if (existing.submittedAt) {
        // Log back in to view results/materials, no error thrown!
        await this.addLog(existing.id, 'Thí sinh đăng nhập lại để xem kết quả, liên hệ giáo viên và tài liệu ôn tập.');
      } else {
        // Existing but not submitted -> Resume!
        await this.addLog(existing.id, 'Thí sinh tải lại trang hoặc đăng nhập lại để tiếp tục làm bài.');
      }

      // Flatten answers for React state
      const restoredAnswers: Record<string, string> = {};
      if (existing.answers) {
        Object.assign(restoredAnswers, existing.answers.listeningPart1 || {});
        Object.assign(restoredAnswers, existing.answers.listeningPart2 || {});
        Object.assign(restoredAnswers, existing.answers.grammar || {});
        Object.assign(restoredAnswers, existing.answers.vocabulary || {});
        Object.assign(restoredAnswers, existing.answers.readingPartA || {});
        Object.assign(restoredAnswers, existing.answers.readingPartB || {});
        Object.assign(restoredAnswers, existing.answers.writing || {});
        if (existing.answers.speakingPart1?.audioPath) {
          restoredAnswers['speaking_p1'] = existing.answers.speakingPart1.audioPath;
        }
        if (existing.answers.speakingPart2?.sp_1_audioPath) {
          restoredAnswers['speaking_p2_q1'] = existing.answers.speakingPart2.sp_1_audioPath;
        }
        if (existing.answers.speakingPart2?.sp_2_audioPath) {
          restoredAnswers['speaking_p2_q2'] = existing.answers.speakingPart2.sp_2_audioPath;
        }
        if (existing.answers.speakingPart2?.sp_3_audioPath) {
          restoredAnswers['speaking_p2_q3'] = existing.answers.speakingPart2.sp_3_audioPath;
        }
      }

      return {
        candidate: existing,
        exam,
        restoredAnswers
      };
    }

    // Register a brand new candidate
    const id = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const newCand: Candidate = {
      id,
      fullName: fullName.trim(),
      phone: cleanPhone,
      examId: targetExamId,
      registeredAt: new Date().toISOString(),
      startedAt: null,
      submittedAt: null,
      durationSeconds: 0,
      tabSwitches: 0,
      logs: [{ timestamp: new Date().toISOString(), action: 'Đăng ký tài khoản thi.' }],
      writingScore: 0,
      writingComment: '',
      audioPlayback: {
        audio1Played: false,
        audio2Played: false
      },
      audio1Played: false,
      audio2Played: false,
      answers: {
        listeningPart1: {},
        listeningPart2: {},
        grammar: {},
        vocabulary: {},
        readingPartA: {},
        readingPartB: {},
        speakingPart1: {
          audioPath: null,
          aiEvaluation: null,
        },
        speakingPart2: {
          sp_1_audioPath: null,
          sp_2_audioPath: null,
          sp_3_audioPath: null,
        },
        writing: {},
      },
      scores: null,
    };

    await setDoc(doc(db, 'candidates', id), sanitizeForFirestore(newCand));
    return {
      candidate: newCand,
      exam,
      restoredAnswers: {}
    };
  },

  async startSession(id: string): Promise<{
    candidate: Candidate;
    exam: any;
    answers: Record<string, string>;
  }> {
    const candidate = await this.getCandidateById(id);
    if (!candidate) {
      throw new Error('Không tìm thấy thông tin thí sinh.');
    }

    const isLocked = await this.checkIsPhoneLocked(candidate.phone);
    if (isLocked || candidate.isLocked) {
      throw new Error('Tài khoản/SĐT của bạn đã bị khóa bởi quản trị viên. Bạn không thể đăng nhập, thi hoặc xem tài liệu.');
    }

    // Allow session starting even if submitted so they can view results/materials on the completed screen
    const exam = await examService.getExamById(candidate.examId);

    if (!candidate.startedAt) {
      const startedAt = new Date().toISOString();
      const updatedLogs = [...candidate.logs, { timestamp: startedAt, action: 'Bắt đầu làm bài thi.' }];
      await updateDoc(doc(db, 'candidates', id), {
        startedAt,
        logs: updatedLogs
      });
      candidate.startedAt = startedAt;
      candidate.logs = updatedLogs;
    }

    // Flatten answers for React state
    const restoredAnswers: Record<string, string> = {};
    if (candidate.answers) {
      Object.assign(restoredAnswers, candidate.answers.listeningPart1 || {});
      Object.assign(restoredAnswers, candidate.answers.listeningPart2 || {});
      Object.assign(restoredAnswers, candidate.answers.grammar || {});
      Object.assign(restoredAnswers, candidate.answers.vocabulary || {});
      Object.assign(restoredAnswers, candidate.answers.readingPartA || {});
      Object.assign(restoredAnswers, candidate.answers.readingPartB || {});
      Object.assign(restoredAnswers, candidate.answers.writing || {});
      if (candidate.answers.speakingPart1?.audioPath) {
        restoredAnswers['speaking_p1'] = candidate.answers.speakingPart1.audioPath;
      }
      if (candidate.answers.speakingPart2?.sp_1_audioPath) {
        restoredAnswers['speaking_p2_q1'] = candidate.answers.speakingPart2.sp_1_audioPath;
      }
      if (candidate.answers.speakingPart2?.sp_2_audioPath) {
        restoredAnswers['speaking_p2_q2'] = candidate.answers.speakingPart2.sp_2_audioPath;
      }
      if (candidate.answers.speakingPart2?.sp_3_audioPath) {
        restoredAnswers['speaking_p2_q3'] = candidate.answers.speakingPart2.sp_3_audioPath;
      }
    }

    return {
      candidate,
      exam,
      answers: restoredAnswers
    };
  },

  formatFlatAnswers(flatAnswers: Record<string, string>, exam?: any): Partial<Candidate['answers']> {
    const nested: any = {
      listeningPart1: {},
      listeningPart2: {},
      grammar: {},
      vocabulary: {},
      readingPartA: {},
      readingPartB: {},
      writing: {},
      speakingPart1: {},
      speakingPart2: {},
      flatAnswers: { ...flatAnswers },
      raw: { ...flatAnswers }
    };
    
    if (!flatAnswers) return nested;

    const examQ = exam?.questions;

    Object.entries(flatAnswers).forEach(([k, v]) => {
      const activeKey = k.startsWith('__NOTE__') ? k.replace('__NOTE__', '') : k;
      if (activeKey === 'speaking_p1') {
        nested.speakingPart1 = { audioPath: v };
        return;
      } else if (activeKey === 'speaking_p2_q1') {
        nested.speakingPart2.sp_1_audioPath = v;
        return;
      } else if (activeKey === 'speaking_p2_q2') {
        nested.speakingPart2.sp_2_audioPath = v;
        return;
      } else if (activeKey === 'speaking_p2_q3') {
        nested.speakingPart2.sp_3_audioPath = v;
        return;
      }

      // 1. Direct match via exam question IDs
      if (examQ) {
        if (examQ.listeningPart1?.some((q: any) => q.id === activeKey)) {
          nested.listeningPart1[k] = v;
          return;
        }
        if (examQ.listeningPart2?.some((q: any) => q.id === activeKey)) {
          nested.listeningPart2[k] = v;
          return;
        }
        if (examQ.grammar?.some((q: any) => q.id === activeKey)) {
          nested.grammar[k] = v;
          return;
        }
        if (examQ.vocabulary?.some((q: any) => q.id === activeKey)) {
          nested.vocabulary[k] = v;
          return;
        }
        if (examQ.readingPassage?.questionsPartA?.some((q: any) => q.id === activeKey)) {
          nested.readingPartA[k] = v;
          return;
        }
        if (examQ.readingPassage?.questionsPartB?.some((q: any) => q.id === activeKey)) {
          nested.readingPartB[k] = v;
          return;
        }
        if (examQ.writingQuestions?.some((q: any) => q.id === activeKey)) {
          nested.writing[k] = v;
          return;
        }
      }

      // 2. Prefix-based routing
      if (activeKey.startsWith('l1_') || activeKey.startsWith('listening_p1') || activeKey.includes('l_part1')) {
        nested.listeningPart1[k] = v;
      } else if (activeKey.startsWith('l2_') || activeKey.startsWith('listening_p2') || activeKey.includes('l_part2')) {
        nested.listeningPart2[k] = v;
      } else if (activeKey.startsWith('listening')) {
        nested.listeningPart1[k] = v;
      } else if (activeKey.startsWith('g_') || activeKey.startsWith('grammar')) {
        nested.grammar[k] = v;
      } else if (activeKey.startsWith('v_') || activeKey.startsWith('vocabulary') || activeKey.startsWith('vocab')) {
        nested.vocabulary[k] = v;
      } else if (activeKey.startsWith('r_part_a') || activeKey.startsWith('reading_p1')) {
        nested.readingPartA[k] = v;
      } else if (activeKey.startsWith('r_part_b') || activeKey.startsWith('reading_p2')) {
        nested.readingPartB[k] = v;
      } else if (activeKey.startsWith('r_') || activeKey.startsWith('reading')) {
        const num = parseInt(activeKey.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num <= 2) {
          nested.readingPartA[k] = v;
        } else {
          nested.readingPartB[k] = v;
        }
      } else if (activeKey.startsWith('w_') || activeKey.startsWith('writing')) {
        nested.writing[k] = v;
      }
    });

    return nested;
  },

  async updateAnswers(id: string, answersUpdate: any, durationSeconds?: number): Promise<Candidate> {
    const candidate = await this.getCandidateById(id);
    if (!candidate) {
      throw new Error('Không tìm thấy thông tin thí sinh.');
    }

    if (candidate.submittedAt) {
      return candidate;
    }

    let parsedUpdate = answersUpdate || {};
    const hasStructuredBuckets = Boolean(
      parsedUpdate.listeningPart1 ||
      parsedUpdate.listeningPart2 ||
      parsedUpdate.grammar ||
      parsedUpdate.vocabulary ||
      parsedUpdate.readingPartA ||
      parsedUpdate.readingPartB
    );

    let exam: any = null;
    if (candidate.examId) {
      try {
        exam = await examService.getExamById(candidate.examId);
      } catch (e) {}
    }

    if (!hasStructuredBuckets) {
      const converted = this.formatFlatAnswers(parsedUpdate, exam);
      parsedUpdate = converted;
    }

    const mergedAnswers = {
      listeningPart1: { ...(candidate.answers?.listeningPart1 || {}), ...(parsedUpdate.listeningPart1 || {}) },
      listeningPart2: { ...(candidate.answers?.listeningPart2 || {}), ...(parsedUpdate.listeningPart2 || {}) },
      grammar: { ...(candidate.answers?.grammar || {}), ...(parsedUpdate.grammar || {}) },
      vocabulary: { ...(candidate.answers?.vocabulary || {}), ...(parsedUpdate.vocabulary || {}) },
      readingPartA: { ...(candidate.answers?.readingPartA || {}), ...(parsedUpdate.readingPartA || {}) },
      readingPartB: { ...(candidate.answers?.readingPartB || {}), ...(parsedUpdate.readingPartB || {}) },
      speakingPart1: {
        ...(candidate.answers?.speakingPart1 || {}),
        ...(parsedUpdate.speakingPart1 || {}),
        audioPath: parsedUpdate.speakingPart1?.audioPath || candidate.answers?.speakingPart1?.audioPath || null
      },
      speakingPart2: {
        ...(candidate.answers?.speakingPart2 || {}),
        ...(parsedUpdate.speakingPart2 || {}),
        sp_1_audioPath: parsedUpdate.speakingPart2?.sp_1_audioPath || candidate.answers?.speakingPart2?.sp_1_audioPath || null,
        sp_2_audioPath: parsedUpdate.speakingPart2?.sp_2_audioPath || candidate.answers?.speakingPart2?.sp_2_audioPath || null,
        sp_3_audioPath: parsedUpdate.speakingPart2?.sp_3_audioPath || candidate.answers?.speakingPart2?.sp_3_audioPath || null,
      },
      writing: { ...(candidate.answers?.writing || {}), ...(parsedUpdate.writing || {}) },
      flatAnswers: {
        ...((candidate.answers as any)?.flatAnswers || {}),
        ...(parsedUpdate.flatAnswers || {}),
        ...(!hasStructuredBuckets ? answersUpdate : {})
      },
      raw: {
        ...((candidate.answers as any)?.raw || {}),
        ...(parsedUpdate.raw || {}),
        ...(!hasStructuredBuckets ? answersUpdate : {})
      }
    };

    const updates: any = { answers: mergedAnswers };
    if (durationSeconds !== undefined) {
      updates.durationSeconds = durationSeconds;
    }

    candidate.answers = mergedAnswers;
    if (durationSeconds !== undefined) {
      candidate.durationSeconds = durationSeconds;
    }

    // Attempt Firestore update with 3 retries
    let updatedRemote = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await updateDoc(doc(db, 'candidates', id), updates);
        updatedRemote = true;
        break;
      } catch (err) {
        console.warn(`updateAnswers attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
    }

    // Save to local session cache as well
    try {
      const sessionStr = localStorage.getItem('candidate_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        session.candidate = candidate;
        localStorage.setItem('candidate_session', JSON.stringify(session));
      }
    } catch (e) {}

    // If remote update failed, record in pending updates
    if (!updatedRemote) {
      try {
        const pendingKey = 'pending_answers_updates';
        const existing = JSON.parse(localStorage.getItem(pendingKey) || '{}');
        existing[id] = updates;
        localStorage.setItem(pendingKey, JSON.stringify(existing));
      } catch (e) {}
    }

    return candidate;
  },

  async addLog(id: string, action: string): Promise<Candidate> {
    const candidate = await this.getCandidateById(id);
    if (!candidate) {
      throw new Error('Không tìm thấy thông tin thí sinh.');
    }

    const normalized = action.toLowerCase();
    let tabSwitches = candidate.tabSwitches || 0;
    if (
      normalized.includes('chuyển tab') ||
      normalized.includes('rời khỏi trang') ||
      normalized.includes('tab switched') ||
      normalized.includes('tab switch') ||
      normalized.includes('rời trang') ||
      normalized.includes('hidden')
    ) {
      tabSwitches += 1;
    }

    const newLog = { timestamp: new Date().toISOString(), action };
    const updatedLogs = [...(candidate.logs || []), newLog];

    candidate.tabSwitches = tabSwitches;
    candidate.logs = updatedLogs;

    // Retry update
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await updateDoc(doc(db, 'candidates', id), {
          tabSwitches,
          logs: updatedLogs
        });
        break;
      } catch (err) {
        console.warn(`addLog attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }
    }

    return candidate;
  },

  async recordAudioPlayed(id: string, audioType: 'audio1' | 'audio2'): Promise<Candidate | null> {
    let candidate = await this.getCandidateById(id);
    if (!candidate) {
      try {
        const sessionStr = localStorage.getItem('candidate_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (session?.candidate?.id === id) {
            candidate = session.candidate;
          }
        }
      } catch (e) {}
    }

    if (!candidate) return null;

    const playedKey = `${audioType}Played` as 'audio1Played' | 'audio2Played';
    const playedAtKey = `${audioType}PlayedAt` as 'audio1PlayedAt' | 'audio2PlayedAt';
    const now = new Date().toISOString();

    const audioPlayback = {
      ...(candidate.audioPlayback || {}),
      [playedKey]: true,
      [playedAtKey]: now
    };

    const actionText = audioType === 'audio1'
      ? 'Đã bắt đầu nghe Audio Phần 1 (Khóa bài nghe - chỉ được nghe 1 lần duy nhất).'
      : 'Đã bắt đầu nghe Audio Phần 2 (Khóa bài nghe - chỉ được nghe 1 lần duy nhất).';

    const updatedLogs = [...(candidate.logs || []), { timestamp: now, action: actionText }];

    candidate.audioPlayback = audioPlayback;
    candidate.logs = updatedLogs;
    (candidate as any)[playedKey] = true;

    const updates: any = {
      audioPlayback,
      logs: updatedLogs,
      [playedKey]: true
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await updateDoc(doc(db, 'candidates', id), updates);
        break;
      } catch (err) {
        console.warn(`recordAudioPlayed attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }
    }

    // Save in local session cache
    try {
      const sessionStr = localStorage.getItem('candidate_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        session.candidate = candidate;
        localStorage.setItem('candidate_session', JSON.stringify(session));
      }
    } catch (e) {}

    // Async sync to server
    try {
      fetch('/api/candidates/audio-played', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, audioType })
      }).catch(() => {});
    } catch (e) {}

    return candidate;
  },

  async submitTest(id: string): Promise<Candidate> {
    let candidate = await this.getCandidateById(id);
    if (!candidate) {
      try {
        const sessionStr = localStorage.getItem('candidate_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (session?.candidate?.id === id) {
            candidate = session.candidate;
          }
        }
      } catch (e) {}
    }

    if (!candidate) {
      throw new Error('Không tìm thấy thông tin thí sinh.');
    }

    if (candidate.submittedAt) {
      return candidate;
    }

    let exam: any = null;
    try {
      exam = await examService.getExamById(candidate.examId || 'default-exam');
    } catch (e) {
      console.warn('Failed to load exam during submit, fallback to local cache:', e);
      try {
        const sessionStr = localStorage.getItem('candidate_session');
        if (sessionStr) {
          exam = JSON.parse(sessionStr).exam;
        }
      } catch (err) {}
    }

    const submittedAt = new Date().toISOString();
    const logs = [...(candidate.logs || []), { timestamp: submittedAt, action: 'Nộp bài thi thành công.' }];
    
    const candidateWithSubmitted = { ...candidate, submittedAt, logs };
    const scores = autoGradeCandidate(candidateWithSubmitted, exam);

    const submissionData = {
      submittedAt,
      logs,
      scores
    };

    let firestoreSaved = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await updateDoc(doc(db, 'candidates', id), submissionData);
        firestoreSaved = true;
        break;
      } catch (err) {
        console.warn(`submitTest firestore update attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }
    }

    candidate.submittedAt = submittedAt;
    candidate.logs = logs;
    candidate.scores = scores;

    // Clean up any lingering unsubmitted duplicate documents for this candidate's phone and exam in Firestore
    try {
      const cleanPhone = normalizePhone(candidate.phone);
      const candExamId = candidate.examId || 'default-exam';
      const colRef = collection(db, 'candidates');
      const snap = await getDocs(colRef);
      snap.forEach(async (d) => {
        if (d.id !== id) {
          const data = d.data();
          const p = normalizePhone(data.phone);
          const exId = data.examId || 'default-exam';
          if (p === cleanPhone && exId === candExamId && !data.submittedAt) {
            try {
              await deleteDoc(doc(db, 'candidates', d.id));
            } catch (err) {}
          }
        }
      });
    } catch (err) {}

    // If Firestore could not be reached immediately, store in local backup queue to auto-sync
    if (!firestoreSaved) {
      try {
        const pendingQueueKey = 'pending_submissions';
        const existingQueue = JSON.parse(localStorage.getItem(pendingQueueKey) || '{}');
        existingQueue[id] = { ...submissionData, updatedAt: Date.now() };
        localStorage.setItem(pendingQueueKey, JSON.stringify(existingQueue));
      } catch (e) {}
    }

    return candidate;
  },

  async gradeWriting(id: string, writingScore: number, comment: string): Promise<Candidate> {
    const candidate = await this.getCandidateById(id);
    if (!candidate) {
      throw new Error('Không tìm thấy thông tin thí sinh.');
    }

    let updatedScores = candidate.scores;
    if (updatedScores) {
      updatedScores.writing = writingScore;
      updatedScores.total = 
        (updatedScores.listening || 0) + 
        (updatedScores.grammar || 0) + 
        (updatedScores.vocabulary || 0) + 
        (updatedScores.reading || 0) + 
        writingScore;
      updatedScores.percentage = Math.round((updatedScores.total / updatedScores.maxPossible) * 100);
    }

    await updateDoc(doc(db, 'candidates', id), {
      writingScore,
      writingComment: comment,
      scores: updatedScores
    });

    candidate.writingScore = writingScore;
    candidate.writingComment = comment;
    candidate.scores = updatedScores;
    return candidate;
  },

  async resetCandidate(id: string): Promise<Candidate> {
    const candidate = await this.getCandidateById(id);
    if (!candidate) {
      throw new Error('Không tìm thấy thông tin thí sinh.');
    }

    // Capture previous attempt in history to satisfy "Không xóa lịch sử"
    const prevAttempt = {
      submittedAt: candidate.submittedAt || new Date().toISOString(),
      startedAt: candidate.startedAt,
      scores: candidate.scores,
      answers: candidate.answers,
      logs: candidate.logs || [],
      durationSeconds: candidate.durationSeconds || 0,
      tabSwitches: candidate.tabSwitches || 0,
      writingScore: candidate.writingScore || 0,
      writingComment: candidate.writingComment || ''
    };

    const existingHistory = (candidate as any).history || [];
    const updatedHistory = [...existingHistory, prevAttempt];

    const updateFields = {
      startedAt: null,
      submittedAt: null,
      leftRoom: false,
      durationSeconds: 0,
      tabSwitches: 0,
      writingScore: 0,
      writingComment: '',
      scores: null,
      isReset: true,
      audioPlayback: {
        audio1Played: false,
        audio2Played: false
      },
      audio1Played: false,
      audio2Played: false,
      history: updatedHistory,
      answers: {
        listeningPart1: {},
        listeningPart2: {},
        grammar: {},
        vocabulary: {},
        readingPartA: {},
        readingPartB: {},
        speakingPart1: { audioPath: null, aiEvaluation: null },
        speakingPart2: { sp_1_audioPath: null, sp_2_audioPath: null, sp_3_audioPath: null },
        writing: {},
      },
      logs: [{ timestamp: new Date().toISOString(), action: 'Giáo viên reset khôi phục bài thi. Cho phép làm bài lại lần 2.' }]
    };

    await updateDoc(doc(db, 'candidates', id), updateFields);
    return { ...candidate, ...updateFields } as Candidate;
  },

  async setCandidateLockStateByPhone(phone: string, isLocked: boolean): Promise<void> {
    try {
      const trimmedPhone = phone.trim();
      const colRef = collection(db, 'candidates');
      const q = query(colRef, where('phone', '==', trimmedPhone));
      const snap = await getDocs(q);
      
      const batchPromises = snap.docs.map((doc) => {
        return updateDoc(doc.ref, { isLocked });
      });
      await Promise.all(batchPromises);
    } catch (err) {
      console.error('Error toggling lock state:', err);
      throw err;
    }
  },

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<void> {
    try {
      const cleanUpdates = sanitizeForFirestore(updates);
      await updateDoc(doc(db, 'candidates', id), cleanUpdates as any);
    } catch (err) {
      console.error('Error updating candidate:', err);
      throw err;
    }
  },

  async deleteCandidate(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'candidates', id));
    } catch (err) {
      console.error('Error deleting candidate:', err);
      throw err;
    }
  },

  async leaveRoom(id: string): Promise<Candidate> {
    const candidate = await this.getCandidateById(id);
    if (!candidate) {
      throw new Error('Không tìm thấy thông tin thí sinh.');
    }

    const leaveTime = new Date().toISOString();
    const logs = [...(candidate.logs || []), { timestamp: leaveTime, action: 'Thí sinh chủ động rời phòng thi. Hủy toàn bộ kết quả.' }];

    const updates = {
      leftRoom: true,
      submittedAt: null, // candidate didn't submit, they left
      scores: null, // clear results
      answers: {
        listeningPart1: {},
        listeningPart2: {},
        grammar: {},
        vocabulary: {},
        readingPartA: {},
        readingPartB: {},
        speakingPart1: { audioPath: null, aiEvaluation: null },
        speakingPart2: { sp_1_audioPath: null, sp_2_audioPath: null, sp_3_audioPath: null },
        writing: {},
      },
      logs
    };

    await updateDoc(doc(db, 'candidates', id), updates);
    return { ...candidate, ...updates } as Candidate;
  }
};

// Automatic background sync for queued submissions / updates when online
if (typeof window !== 'undefined') {
  const syncPendingData = async () => {
    try {
      // 1. Sync pending submissions
      const pendingSubKey = 'pending_submissions';
      const pendingSubStr = localStorage.getItem(pendingSubKey);
      if (pendingSubStr) {
        const pendingQueue = JSON.parse(pendingSubStr);
        for (const [candidateId, data] of Object.entries(pendingQueue)) {
          try {
            await updateDoc(doc(db, 'candidates', candidateId), data as any);
            delete pendingQueue[candidateId];
          } catch (e) {
            console.warn(`Sync pending submission failed for ${candidateId}:`, e);
          }
        }
        if (Object.keys(pendingQueue).length === 0) {
          localStorage.removeItem(pendingSubKey);
        } else {
          localStorage.setItem(pendingSubKey, JSON.stringify(pendingQueue));
        }
      }

      // 2. Sync pending answers updates
      const pendingAnsKey = 'pending_answers_updates';
      const pendingAnsStr = localStorage.getItem(pendingAnsKey);
      if (pendingAnsStr) {
        const pendingAnsQueue = JSON.parse(pendingAnsStr);
        for (const [candidateId, data] of Object.entries(pendingAnsQueue)) {
          try {
            await updateDoc(doc(db, 'candidates', candidateId), data as any);
            delete pendingAnsQueue[candidateId];
          } catch (e) {
            console.warn(`Sync pending answers failed for ${candidateId}:`, e);
          }
        }
        if (Object.keys(pendingAnsQueue).length === 0) {
          localStorage.removeItem(pendingAnsKey);
        } else {
          localStorage.setItem(pendingAnsKey, JSON.stringify(pendingAnsQueue));
        }
      }
    } catch (err) {
      console.warn('Background sync error:', err);
    }
  };

  window.addEventListener('online', syncPendingData);
  // Also try running a few seconds after startup
  setTimeout(syncPendingData, 4000);
}

