import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  FileText,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Upload,
  Volume2,
  Image as ImageIcon,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Save,
  ArrowRight,
  Layers,
  ListOrdered,
  BookMarked,
  Info,
  RotateCcw,
  Eye,
  CheckSquare,
  Edit3
} from 'lucide-react';
import { storageService } from '../services/storageService';
import {
  LISTENING_PART_1,
  LISTENING_PART_2,
  SPEAKING_READ_ALOUD,
  SPEAKING_QUESTIONS,
  GRAMMAR_QUESTIONS,
  VOCABULARY_QUESTIONS,
  READING_PASSAGE,
  WRITING_QUESTIONS
} from '../questions';

export interface ManualExamBuilderProps {
  initialExam?: {
    id?: string;
    title: string;
    description: string;
    durationMinutes: number;
    audio1Url?: string;
    audio2Url?: string;
    questions?: any;
  } | null;
  onSave: (examData: {
    title: string;
    description: string;
    durationMinutes: number;
    audio1Url: string;
    audio2Url: string;
    questions: any;
  }) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

type SkillType = 'listening' | 'grammar' | 'vocabulary' | 'reading' | 'writing' | 'speaking';

interface SkillConfig {
  id: SkillType;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  types: {
    id: string;
    name: string;
    desc: string;
    example: string;
    icon: any;
  }[];
}

const SKILL_CONFIGS: SkillConfig[] = [
  {
    id: 'listening',
    title: 'Nghe hiểu',
    subtitle: 'Listening Skills',
    icon: Headphones,
    color: 'indigo',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    badgeText: 'text-indigo-600',
    borderColor: 'border-indigo-600',
    types: [
      {
        id: 'l_part1_pic',
        name: 'Part 1: Trắc nghiệm kèm Tranh minh họa / Audio riêng',
        desc: 'Học sinh nghe file audio hoặc nhìn hình ảnh để chọn 1 trong các đáp án đúng (A, B, C, D).',
        example: 'Ví dụ: What room has Lisa booked? (Single / Double / Twin)',
        icon: ImageIcon
      },
      {
        id: 'l_part2_blank',
        name: 'Part 2: Nghe điền từ vào chỗ trống',
        desc: 'Học sinh nghe audio và điền từ ngữ hoặc con số chính xác vào chỗ trống.',
        example: 'Ví dụ: Prices Rent: $ (2) [1700] per month',
        icon: Edit3
      },
      {
        id: 'l_part2_mcq',
        name: 'Part 2: Nghe hội thoại trắc nghiệm 4 đáp án',
        desc: 'Học sinh nghe đoạn hội thoại hoặc độc thoại rồi chọn câu trả lời đúng nhất.',
        example: 'Ví dụ: What was the main problem with the reservation?',
        icon: CheckSquare
      }
    ]
  },
  {
    id: 'grammar',
    title: 'Ngữ pháp',
    subtitle: 'Grammar',
    icon: FileText,
    color: 'blue',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeText: 'text-blue-600',
    borderColor: 'border-blue-600',
    types: [
      {
        id: 'g_mcq',
        name: 'Trắc nghiệm Ngữ pháp 4 lựa chọn (A, B, C, D)',
        desc: 'Kiểm tra thì động từ, câu điều kiện, mệnh đề quan hệ, liên từ, giới từ...',
        example: 'Ví dụ: The woman ______ lives next door is a doctor. (A. which / B. whose / C. who / D. where)',
        icon: CheckSquare
      },
      {
        id: 'g_blank',
        name: 'Điền dạng đúng của từ trong ngoặc (Word Form / Verb Tense)',
        desc: 'Học sinh tự gõ dạng biến đổi của từ cho sẵn vào chỗ trống.',
        example: 'Ví dụ: Yesterday, Linda ________ (visit) her grandparents. -> Đáp án: visited',
        icon: Edit3
      }
    ]
  },
  {
    id: 'vocabulary',
    title: 'Từ vựng',
    subtitle: 'Vocabulary',
    icon: BookMarked,
    color: 'emerald',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeText: 'text-emerald-600',
    borderColor: 'border-emerald-600',
    types: [
      {
        id: 'v_mcq',
        name: 'Trắc nghiệm Từ vựng theo ngữ cảnh (A, B, C, D)',
        desc: 'Chọn từ vựng chuẩn xác theo nghĩa câu (A1, A2, B1, B2, C1).',
        example: 'Ví dụ: Every morning, I go to the ______ to borrow books. (A. library / B. hospital / C. supermarket)',
        icon: CheckSquare
      },
      {
        id: 'v_synonym',
        name: 'Chọn từ Đồng nghĩa / Trái nghĩa (Synonym / Antonym)',
        desc: 'Tìm từ có nghĩa tương đương hoặc trái ngược với từ in đậm.',
        example: 'Ví dụ: The meeting was CALLED OFF. Closest meaning: (A. cancelled / B. delayed)',
        icon: Sparkles
      }
    ]
  },
  {
    id: 'reading',
    title: 'Đọc hiểu',
    subtitle: 'Reading Comprehension',
    icon: BookOpen,
    color: 'amber',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    badgeText: 'text-amber-600',
    borderColor: 'border-amber-600',
    types: [
      {
        id: 'r_passage_a',
        name: 'Phần A: Bài đọc điền từ vào bài (Cloze Reading)',
        desc: 'Nhập đoạn văn chung và thêm các câu hỏi trắc nghiệm liên quan đến bài đọc.',
        example: 'Đoạn văn đọc hiểu + câu hỏi chọn ý chính, suy luận hoặc chọn từ phù hợp.',
        icon: BookOpen
      },
      {
        id: 'r_passage_b',
        name: 'Phần B: Bài đọc câu hỏi Đúng / Sai (True / False / Not Given)',
        desc: 'Đọc đoạn văn và xác định các câu nhận định là True, False hay Not Given.',
        example: 'Ví dụ: Fast fashion makes people buy clothes less often. -> False',
        icon: CheckCircle2
      }
    ]
  },
  {
    id: 'writing',
    title: 'Viết luận',
    subtitle: 'Writing Skills',
    icon: PenTool,
    color: 'rose',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeText: 'text-rose-600',
    borderColor: 'border-rose-600',
    types: [
      {
        id: 'w_translate',
        name: 'Dịch câu / Viết lại câu từ tiếng Việt sang tiếng Anh',
        desc: 'Đưa ra câu tiếng Việt để học sinh dịch chuẩn ngữ pháp và từ vựng sang tiếng Anh.',
        example: 'Ví dụ: "Tập thể dục mỗi ngày giúp mọi người giữ gìn sức khỏe tốt."',
        icon: Edit3
      },
      {
        id: 'w_essay',
        name: 'Viết bài luận / Đoạn văn tự do (Short Essay / Paragraph)',
        desc: 'Đưa ra chủ đề mở để học sinh viết bài văn từ 100 - 250 từ (Hệ thống AI sẽ chấm điểm tự động).',
        example: 'Ví dụ: Write a paragraph (120 words) describing your favorite holiday destination.',
        icon: FileText
      }
    ]
  },
  {
    id: 'speaking',
    title: 'Nói & Ghi âm',
    subtitle: 'Speaking Skills',
    icon: Mic,
    color: 'purple',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    badgeText: 'text-purple-600',
    borderColor: 'border-purple-600',
    types: [
      {
        id: 'sp_read_aloud',
        name: 'Phần 1: Đọc to đoạn văn bản mẫu (Read Aloud)',
        desc: 'Học sinh bật micro ghi âm giọng đọc chuẩn đoạn văn được cung cấp.',
        example: 'Ví dụ: Đoạn văn mẫu 90 từ để học sinh luyện phát âm và ngữ điệu.',
        icon: Volume2
      },
      {
        id: 'sp_interview',
        name: 'Phần 2: Trả lời câu hỏi phỏng vấn ghi âm (Speaking Prompt)',
        desc: 'Học sinh ghi âm câu trả lời cho các câu hỏi giao tiếp theo từng chủ đề.',
        example: 'Ví dụ: "Why do many young people prefer living in big cities?"',
        icon: Mic
      }
    ]
  }
];

export const ManualExamBuilder: React.FC<ManualExamBuilderProps> = ({
  initialExam,
  onSave,
  onCancel,
  isLoading = false
}) => {
  // General Info
  const [examTitle, setExamTitle] = useState(initialExam?.title || '');
  const [examDesc, setExamDesc] = useState(initialExam?.description || '');
  const [examDuration, setExamDuration] = useState<number>(initialExam?.durationMinutes || 45);
  const [audio1Url, setAudio1Url] = useState(initialExam?.audio1Url || '');
  const [audio2Url, setAudio2Url] = useState(initialExam?.audio2Url || '');
  const [isUploadingAudio1, setIsUploadingAudio1] = useState(false);
  const [isUploadingAudio2, setIsUploadingAudio2] = useState(false);

  // Active Skill & Type selector
  const [selectedSkill, setSelectedSkill] = useState<SkillType>('listening');
  const [selectedType, setSelectedType] = useState<string>('l_part1_pic');

  // Question Store State
  const [listeningPart1, setListeningPart1] = useState<any[]>([]);
  const [listeningPart2, setListeningPart2] = useState<any[]>([]);
  const [grammar, setGrammar] = useState<any[]>([]);
  const [vocabulary, setVocabulary] = useState<any[]>([]);
  const [readingPassage, setReadingPassage] = useState<{
    title: string;
    text: string;
    questionsPartA: any[];
    questionsPartB: any[];
  }>({
    title: 'The Problem of Fast Fashion',
    text: '',
    questionsPartA: [],
    questionsPartB: []
  });
  const [writingQuestions, setWritingQuestions] = useState<any[]>([]);
  const [speakingReadAloud, setSpeakingReadAloud] = useState<{ text: string; wordCount: number }>({
    text: '',
    wordCount: 0
  });
  const [speakingQuestions, setSpeakingQuestions] = useState<any[]>([]);

  // Current Form Builder State
  const [fQuestionText, setFQuestionText] = useState('');
  const [fOptions, setFOptions] = useState<string[]>(['', '', '', '']);
  const [fCorrectAnswer, setFCorrectAnswer] = useState<string>('A');
  const [fBlankAnswer, setFBlankAnswer] = useState<string>('');
  const [fImageUrl, setFImageUrl] = useState<string>('');
  const [fAudioUrl, setFAudioUrl] = useState<string>('');
  const [fPassageText, setFPassageText] = useState<string>('');
  const [fPassageTitle, setFPassageTitle] = useState<string>('');
  const [fReadAloudText, setFReadAloudText] = useState<string>('');

  // Upload helpers
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [showNotification, setShowNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load initial questions if provided
  useEffect(() => {
    if (initialExam?.questions) {
      const q = initialExam.questions;
      if (q.listeningPart1) setListeningPart1(q.listeningPart1);
      if (q.listeningPart2) setListeningPart2(q.listeningPart2);
      if (q.grammar) setGrammar(q.grammar);
      if (q.vocabulary) setVocabulary(q.vocabulary);
      if (q.readingPassage) {
        setReadingPassage({
          title: q.readingPassage.title || 'Đọc hiểu',
          text: q.readingPassage.text || '',
          questionsPartA: q.readingPassage.questionsPartA || [],
          questionsPartB: q.readingPassage.questionsPartB || []
        });
        setFPassageText(q.readingPassage.text || '');
        setFPassageTitle(q.readingPassage.title || '');
      }
      if (q.writingQuestions) setWritingQuestions(q.writingQuestions);
      if (q.speakingReadAloud) {
        setSpeakingReadAloud(q.speakingReadAloud);
        setFReadAloudText(q.speakingReadAloud.text || '');
      }
      if (q.speakingQuestions) setSpeakingQuestions(q.speakingQuestions);
    }
  }, [initialExam]);

  // Update default sub-type when switching skills
  const handleSelectSkill = (skill: SkillType) => {
    setSelectedSkill(skill);
    const cfg = SKILL_CONFIGS.find((c) => c.id === skill);
    if (cfg && cfg.types.length > 0) {
      setSelectedType(cfg.types[0].id);
    }
  };

  const triggerNotify = (message: string, type: 'success' | 'error' = 'success') => {
    setShowNotification({ message, type });
    setTimeout(() => setShowNotification(null), 3500);
  };

  // Load Preset Template (Full 4 skills standard exam)
  const handleLoadPresetTemplate = () => {
    if (
      window.confirm(
        'Bạn có muốn nạp dữ liệu mẫu chuẩn (4 kỹ năng Nghe, Nói, Đọc, Viết, Ngữ pháp, Từ vựng) vào đề thi này không? Dữ liệu hiện tại sẽ được cập nhật mẫu.'
      )
    ) {
      setListeningPart1(LISTENING_PART_1);
      setListeningPart2(LISTENING_PART_2);
      setGrammar(GRAMMAR_QUESTIONS);
      setVocabulary(VOCABULARY_QUESTIONS);
      setReadingPassage(READING_PASSAGE);
      setFPassageText(READING_PASSAGE.text);
      setFPassageTitle(READING_PASSAGE.title);
      setWritingQuestions(WRITING_QUESTIONS);
      setSpeakingReadAloud(SPEAKING_READ_ALOUD);
      setFReadAloudText(SPEAKING_READ_ALOUD.text);
      setSpeakingQuestions(SPEAKING_QUESTIONS);
      if (!audio1Url) setAudio1Url('https://storage.m3cdn.xyz/audio/1782652891560-hotel.mp3');
      if (!audio2Url) setAudio2Url('https://storage.m3cdn.xyz/audio/section%201%20rented%20properties.mp3');
      triggerNotify('Đã nạp thành công bộ đề mẫu 4 kỹ năng!');
    }
  };

  // Total questions counter
  const totalQuestionsCount =
    listeningPart1.length +
    listeningPart2.length +
    grammar.length +
    vocabulary.length +
    (readingPassage.questionsPartA?.length || 0) +
    (readingPassage.questionsPartB?.length || 0) +
    writingQuestions.length +
    speakingQuestions.length +
    (speakingReadAloud.text ? 1 : 0);

  // Add question handler
  const handleAddQuestion = () => {
    if (selectedSkill === 'speaking' && selectedType === 'sp_read_aloud') {
      if (!fReadAloudText.trim()) {
        triggerNotify('Vui lòng nhập đoạn văn bản đọc to (Read Aloud)!', 'error');
        return;
      }
      const words = fReadAloudText.trim().split(/\s+/).length;
      setSpeakingReadAloud({
        text: fReadAloudText.trim(),
        wordCount: words
      });
      triggerNotify(`Đã lưu đoạn văn đọc to (${words} từ)!`);
      return;
    }

    if (selectedSkill === 'reading') {
      // Update passage text
      if (fPassageText.trim()) {
        setReadingPassage((prev) => ({
          ...prev,
          title: fPassageTitle.trim() || prev.title || 'Bài đọc hiểu',
          text: fPassageText.trim()
        }));
      }

      if (!fQuestionText.trim()) {
        triggerNotify('Vui lòng nhập câu hỏi đọc hiểu!', 'error');
        return;
      }

      const qId = `r_${Date.now()}`;
      const newQuestion = {
        id: qId,
        type: 'mcq',
        text: fQuestionText.trim(),
        options: selectedType === 'r_passage_b' ? ['True', 'False', 'Not Given'] : fOptions.filter((o) => o.trim() !== ''),
        answer: fCorrectAnswer
      };

      if (selectedType === 'r_passage_a') {
        setReadingPassage((prev) => ({
          ...prev,
          questionsPartA: [...prev.questionsPartA, newQuestion]
        }));
      } else {
        setReadingPassage((prev) => ({
          ...prev,
          questionsPartB: [...prev.questionsPartB, newQuestion]
        }));
      }

      setFQuestionText('');
      setFOptions(['', '', '', '']);
      setFCorrectAnswer(selectedType === 'r_passage_b' ? 'True' : 'A');
      triggerNotify('Đã thêm câu hỏi đọc hiểu thành công!');
      return;
    }

    if (selectedSkill === 'writing') {
      if (!fQuestionText.trim()) {
        triggerNotify('Vui lòng nhập đề bài viết luận hoặc câu cần dịch!', 'error');
        return;
      }
      const newWriting = {
        id: `w_${Date.now()}`,
        vietnamese: fQuestionText.trim(),
        prompt: fQuestionText.trim()
      };
      setWritingQuestions((prev) => [...prev, newWriting]);
      setFQuestionText('');
      triggerNotify('Đã thêm đề bài viết vào đề thi!');
      return;
    }

    if (selectedSkill === 'speaking' && selectedType !== 'sp_read_aloud') {
      if (!fQuestionText.trim()) {
        triggerNotify('Vui lòng nhập câu hỏi / chủ đề nói ghi âm!', 'error');
        return;
      }
      const newSpeaking = {
        id: `sp_${Date.now()}`,
        text: fQuestionText.trim(),
        prompt: fQuestionText.trim(),
        allowRecord: true
      };
      setSpeakingQuestions((prev) => [...prev, newSpeaking]);
      setFQuestionText('');
      triggerNotify('Đã thêm câu hỏi Speaking ghi âm vào đề thi!');
      return;
    }

    // MCQ or Blank Questions
    if (!fQuestionText.trim()) {
      triggerNotify('Vui lòng nhập nội dung câu hỏi!', 'error');
      return;
    }

    const uniqueId = `${selectedSkill}_${Date.now()}`;

    // Fill in the blank (Điền từ)
    if (selectedType === 'l_part2_blank' || selectedType === 'g_blank') {
      if (!fBlankAnswer.trim()) {
        triggerNotify('Vui lòng nhập đáp án chính xác của ô trống!', 'error');
        return;
      }
      const newBlankQuestion = {
        id: uniqueId,
        type: 'blank',
        text: fQuestionText.trim(),
        answer: fBlankAnswer.trim()
      };

      if (selectedSkill === 'listening') {
        setListeningPart2((prev) => [...prev, newBlankQuestion]);
      } else {
        setGrammar((prev) => [...prev, newBlankQuestion]);
      }

      setFQuestionText('');
      setFBlankAnswer('');
      triggerNotify('Đã thêm câu hỏi điền từ vào đề thi!');
      return;
    }

    // Multiple Choice (Trắc nghiệm A, B, C, D)
    const validOptions = fOptions.filter((opt) => opt.trim() !== '');
    if (validOptions.length < 2) {
      triggerNotify('Vui lòng nhập ít nhất 2 phương án lựa chọn (A, B...)!', 'error');
      return;
    }

    const newMCQ: any = {
      id: uniqueId,
      type: 'mcq',
      text: fQuestionText.trim(),
      options: [...fOptions],
      answer: fCorrectAnswer
    };
    if (fAudioUrl.trim()) {
      newMCQ.audioUrl = fAudioUrl.trim();
    }
    if (fImageUrl.trim()) {
      newMCQ.imageUrl = fImageUrl.trim();
    }

    if (selectedSkill === 'listening') {
      if (selectedType === 'l_part1_pic') {
        setListeningPart1((prev) => [...prev, newMCQ]);
      } else {
        setListeningPart2((prev) => [...prev, newMCQ]);
      }
    } else if (selectedSkill === 'grammar') {
      setGrammar((prev) => [...prev, newMCQ]);
    } else if (selectedSkill === 'vocabulary') {
      setVocabulary((prev) => [...prev, newMCQ]);
    }

    setFQuestionText('');
    setFOptions(['', '', '', '']);
    setFCorrectAnswer('A');
    setFImageUrl('');
    setFAudioUrl('');
    triggerNotify('Đã thêm câu hỏi trắc nghiệm mới!');
  };

  // Delete question handler
  const handleDeleteQuestion = (skillKey: SkillType, id: string, subCategory?: string) => {
    if (skillKey === 'listening') {
      if (subCategory === 'part1') setListeningPart1((prev) => prev.filter((q) => q.id !== id));
      else setListeningPart2((prev) => prev.filter((q) => q.id !== id));
    } else if (skillKey === 'grammar') {
      setGrammar((prev) => prev.filter((q) => q.id !== id));
    } else if (skillKey === 'vocabulary') {
      setVocabulary((prev) => prev.filter((q) => q.id !== id));
    } else if (skillKey === 'reading') {
      if (subCategory === 'partA') {
        setReadingPassage((prev) => ({
          ...prev,
          questionsPartA: prev.questionsPartA.filter((q) => q.id !== id)
        }));
      } else {
        setReadingPassage((prev) => ({
          ...prev,
          questionsPartB: prev.questionsPartB.filter((q) => q.id !== id)
        }));
      }
    } else if (skillKey === 'writing') {
      setWritingQuestions((prev) => prev.filter((q) => q.id !== id));
    } else if (skillKey === 'speaking') {
      setSpeakingQuestions((prev) => prev.filter((q) => q.id !== id));
    }
    triggerNotify('Đã xóa câu hỏi khỏi đề thi!');
  };

  // Submit and save exam
  const handleSaveFullExam = async () => {
    if (!examTitle.trim()) {
      triggerNotify('Vui lòng nhập Tiêu đề đề thi!', 'error');
      return;
    }

    if (totalQuestionsCount === 0) {
      triggerNotify('Đề thi chưa có câu hỏi nào! Hãy thêm câu hỏi hoặc bấm "Tải Đề Mẫu Chuẩn".', 'error');
      return;
    }

    const payload = {
      title: examTitle.trim(),
      description: examDesc.trim() || 'Bài thi đánh giá năng lực tiếng Anh tổng hợp.',
      durationMinutes: Number(examDuration) || 45,
      audio1Url: audio1Url.trim(),
      audio2Url: audio2Url.trim(),
      questions: {
        listeningPart1,
        listeningPart2,
        grammar,
        vocabulary,
        readingPassage,
        writingQuestions,
        speakingReadAloud,
        speakingQuestions
      }
    };

    await onSave(payload);
  };

  // Get current skill's questions list
  const getCurrentSkillQuestionsCount = (skill: SkillType) => {
    switch (skill) {
      case 'listening':
        return listeningPart1.length + listeningPart2.length;
      case 'grammar':
        return grammar.length;
      case 'vocabulary':
        return vocabulary.length;
      case 'reading':
        return (readingPassage.questionsPartA?.length || 0) + (readingPassage.questionsPartB?.length || 0);
      case 'writing':
        return writingQuestions.length;
      case 'speaking':
        return speakingQuestions.length + (speakingReadAloud.text ? 1 : 0);
      default:
        return 0;
    }
  };

  const currentSkillConfig = SKILL_CONFIGS.find((c) => c.id === selectedSkill) || SKILL_CONFIGS[0];
  const currentTypeConfig = currentSkillConfig.types.find((t) => t.id === selectedType) || currentSkillConfig.types[0];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-[99999] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border ${
              showNotification.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
                : 'bg-rose-950 text-rose-100 border-rose-700'
            }`}
          >
            {showNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{showNotification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP HEADER: EXAM BASIC INFO & PRESET LOADER */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-900 text-white rounded-2xl flex items-center justify-center shadow-md">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                {initialExam?.id ? 'CHỈNH SỬA ĐỀ THI THỦ CÔNG' : 'TẠO ĐỀ THI THỦ CÔNG MỚI (THEO TỪNG KỸ NĂNG)'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Giao diện tạo câu hỏi trực quan: Chọn Kỹ năng → Chọn Dạng bài → Nhập câu hỏi & Đáp án.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadPresetTemplate}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Nạp nhanh đề mẫu 4 kỹ năng"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Nạp Đề Mẫu Chuẩn (4 Kỹ Năng)
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}
          </div>
        </div>

        {/* Input Fields: Title, Duration, Description */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              1. Tên / Tiêu đề đề thi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Đề thi đánh giá năng lực tiếng Anh B1 - Kỳ thi tháng 8"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs font-bold text-slate-900 transition-all bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-900" /> 2. Thời gian làm bài (Phút)
            </label>
            <input
              type="number"
              min={10}
              max={180}
              value={examDuration}
              onChange={(e) => setExamDuration(Number(e.target.value) || 45)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs font-mono font-bold text-slate-900 transition-all bg-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            3. Mô tả đề thi (Tùy chọn)
          </label>
          <input
            type="text"
            placeholder="Ví dụ: Bài thi gồm 4 phần: Nghe, Nói, Đọc, Viết phù hợp cho học sinh THCS & THPT..."
            value={examDesc}
            onChange={(e) => setExamDesc(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs text-slate-700 transition-all bg-white"
          />
        </div>

        {/* Global Audios (Part 1 & Part 2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-700" /> File Audio Listening Part 1
              </span>
              <label
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  isUploadingAudio1 ? 'bg-slate-300 text-slate-600' : 'bg-indigo-900 hover:bg-indigo-850 text-white'
                }`}
              >
                <Upload className="w-3 h-3" /> {isUploadingAudio1 ? 'Đang tải...' : 'Tải file MP3'}
                <input
                  type="file"
                  accept="audio/*"
                  disabled={isUploadingAudio1}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIsUploadingAudio1(true);
                      try {
                        const url = await storageService.uploadFile(file, 'exams/audio');
                        setAudio1Url(url);
                        triggerNotify('Đã tải lên Audio 1 thành công!');
                      } catch (err: any) {
                        triggerNotify(err.message, 'error');
                      } finally {
                        setIsUploadingAudio1(false);
                      }
                    }
                  }}
                />
              </label>
            </div>
            <input
              type="text"
              placeholder="Nhập link file audio hoặc bấm Tải file..."
              value={audio1Url}
              onChange={(e) => setAudio1Url(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
            />
            {audio1Url && (
              <audio
                src={audio1Url.startsWith('data:') || audio1Url.startsWith('blob:') ? audio1Url : `/api/audio-proxy?url=${encodeURIComponent(audio1Url)}`}
                controls
                className="w-full h-7 mt-1"
              />
            )}
          </div>

          <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-700" /> File Audio Listening Part 2
              </span>
              <label
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  isUploadingAudio2 ? 'bg-slate-300 text-slate-600' : 'bg-indigo-900 hover:bg-indigo-850 text-white'
                }`}
              >
                <Upload className="w-3 h-3" /> {isUploadingAudio2 ? 'Đang tải...' : 'Tải file MP3'}
                <input
                  type="file"
                  accept="audio/*"
                  disabled={isUploadingAudio2}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIsUploadingAudio2(true);
                      try {
                        const url = await storageService.uploadFile(file, 'exams/audio');
                        setAudio2Url(url);
                        triggerNotify('Đã tải lên Audio 2 thành công!');
                      } catch (err: any) {
                        triggerNotify(err.message, 'error');
                      } finally {
                        setIsUploadingAudio2(false);
                      }
                    }
                  }}
                />
              </label>
            </div>
            <input
              type="text"
              placeholder="Nhập link file audio hoặc bấm Tải file..."
              value={audio2Url}
              onChange={(e) => setAudio2Url(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
            />
            {audio2Url && (
              <audio
                src={audio2Url.startsWith('data:') || audio2Url.startsWith('blob:') ? audio2Url : `/api/audio-proxy?url=${encodeURIComponent(audio2Url)}`}
                controls
                className="w-full h-7 mt-1"
              />
            )}
          </div>
        </div>
      </div>

      {/* STEP 1: SELECT SKILL BAR (TABS LỚN RÕ RÀNG) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-900 text-white flex items-center justify-center text-xs font-black">
              1
            </span>
            <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
              BƯỚC 1: CHỌN KỸ NĂNG CẦN THÊM CÂU HỎI
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Tổng cộng trong đề: <strong className="text-indigo-900 font-black">{totalQuestionsCount} câu</strong>
          </span>
        </div>

        {/* 6 Skill Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {SKILL_CONFIGS.map((skill) => {
            const Icon = skill.icon;
            const isSelected = selectedSkill === skill.id;
            const count = getCurrentSkillQuestionsCount(skill.id);

            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => handleSelectSkill(skill.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[95px] cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/30'
                    : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`p-2 rounded-xl ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 shadow-2xs'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono ${
                      count > 0
                        ? isSelected
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                        : isSelected
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {count} câu
                  </span>
                </div>

                <div className="mt-2">
                  <h4 className="text-xs font-black leading-snug">{skill.title}</h4>
                  <p className={`text-[10px] truncate ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                    {skill.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: SELECT QUESTION TYPE (DẠNG BÀI TRONG KỸ NĂNG ĐÃ CHỌN) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-900 text-white flex items-center justify-center text-xs font-black">
            2
          </span>
          <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
            BƯỚC 2: CHỌN DẠNG BÀI CHO KỸ NĂNG &quot;{currentSkillConfig.title.toUpperCase()}&quot;
          </h3>
        </div>

        {/* Question Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentSkillConfig.types.map((t) => {
            const TypeIcon = t.icon;
            const isSelected = selectedType === t.id;

            return (
              <div
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isSelected ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 leading-snug">{t.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t.desc}</p>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-500 bg-slate-100/80 p-2 rounded-lg italic">
                  💡 {t.example}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 3: QUESTION INPUT BUILDER FORM (FORM NHẬP SIÊU DỄ HIỂU) */}
      <div className="bg-white border-2 border-indigo-100 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
              3
            </span>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
              BƯỚC 3: NHẬP NỘI DUNG CÂU HỎI & ĐÁP ÁN
            </h3>
          </div>
          <span className="text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
            Đang tạo: {currentTypeConfig.name}
          </span>
        </div>

        {/* 1. If Reading: Common Passage Box */}
        {selectedSkill === 'reading' && (
          <div className="space-y-3 p-4 bg-amber-50/50 border border-amber-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-700" /> Bài đọc hiểu chung (Reading Passage)
              </label>
              <span className="text-[10px] text-amber-700 font-mono">
                Số từ: {fPassageText ? fPassageText.split(/\s+/).length : 0} từ
              </span>
            </div>
            <input
              type="text"
              placeholder="Tiêu đề bài đọc (Ví dụ: The Problem of Fast Fashion)"
              value={fPassageTitle}
              onChange={(e) => setFPassageTitle(e.target.value)}
              className="w-full px-3 py-2 border border-amber-200 rounded-xl text-xs font-bold text-amber-950 bg-white"
            />
            <textarea
              placeholder="Nhập toàn bộ nội dung bài văn đọc hiểu tại đây..."
              value={fPassageText}
              onChange={(e) => setFPassageText(e.target.value)}
              rows={6}
              className="w-full p-3 border border-amber-200 rounded-xl text-xs text-slate-800 bg-white leading-relaxed"
            />
          </div>
        )}

        {/* 2. If Speaking Read Aloud */}
        {selectedSkill === 'speaking' && selectedType === 'sp_read_aloud' && (
          <div className="space-y-3 p-4 bg-purple-50/50 border border-purple-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-purple-900 uppercase flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-purple-700" /> Đoạn văn bản mẫu cho học sinh Đọc to (Read Aloud)
              </label>
              <span className="text-[10px] text-purple-700 font-mono font-bold">
                {fReadAloudText ? fReadAloudText.split(/\s+/).length : 0} từ
              </span>
            </div>
            <textarea
              placeholder="Nhập đoạn văn bản (khoảng 80 - 100 từ) để học sinh đọc to và ghi âm giọng nói..."
              value={fReadAloudText}
              onChange={(e) => setFReadAloudText(e.target.value)}
              rows={5}
              className="w-full p-3.5 border border-purple-200 rounded-xl text-xs text-slate-800 bg-white leading-relaxed font-serif"
            />
            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-3 bg-purple-900 hover:bg-purple-850 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Save className="w-4 h-4" /> Lưu đoạn văn đọc to vào đề thi
            </button>
          </div>
        )}

        {/* Standard Question Text Prompt (for MCQ, Blank, Writing, Speaking Interview) */}
        {!(selectedSkill === 'speaking' && selectedType === 'sp_read_aloud') && (
          <div className="space-y-4">
            {/* Audio or Image for Listening Part 1 */}
            {selectedSkill === 'listening' && selectedType === 'l_part1_pic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                {/* Individual Audio */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-indigo-900 uppercase flex items-center gap-1">
                      <Volume2 className="w-3 h-3" /> Audio riêng cho câu này (Tùy chọn)
                    </label>
                    <label className="text-[9px] font-bold text-indigo-700 hover:underline cursor-pointer">
                      {isUploadingAudio ? 'Đang tải...' : 'Tải file MP3'}
                      <input
                        type="file"
                        accept="audio/*"
                        disabled={isUploadingAudio}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsUploadingAudio(true);
                            try {
                              const url = await storageService.uploadFile(file, 'exams/questions/audio');
                              setFAudioUrl(url);
                              triggerNotify('Đã tải lên audio cho câu hỏi!');
                            } catch (err: any) {
                              triggerNotify(err.message, 'error');
                            } finally {
                              setIsUploadingAudio(false);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="URL audio riêng (nếu không dùng audio chung)..."
                    value={fAudioUrl}
                    onChange={(e) => setFAudioUrl(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                  />
                </div>

                {/* Picture for Part 1 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-indigo-900 uppercase flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Ảnh tranh minh họa (Picture)
                    </label>
                    <label className="text-[9px] font-bold text-indigo-700 hover:underline cursor-pointer">
                      {isUploadingImage ? 'Đang tải...' : 'Tải ảnh'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingImage}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsUploadingImage(true);
                            try {
                              const url = await storageService.uploadFile(file, 'exams/questions/images');
                              setFImageUrl(url);
                              triggerNotify('Đã tải lên ảnh minh họa!');
                            } catch (err: any) {
                              triggerNotify(err.message, 'error');
                            } finally {
                              setIsUploadingImage(false);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="URL ảnh hoặc bấm Tải ảnh..."
                    value={fImageUrl}
                    onChange={(e) => setFImageUrl(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                  />
                  {fImageUrl && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={fImageUrl} alt="Preview" className="h-10 w-14 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => setFImageUrl('')}
                        className="text-[10px] text-rose-600 hover:underline"
                      >
                        Xóa ảnh
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Question Text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                {selectedSkill === 'writing'
                  ? 'Nội dung đề bài viết / Câu tiếng Việt cần dịch sang tiếng Anh'
                  : selectedSkill === 'speaking'
                  ? 'Câu hỏi phỏng vấn / Chủ đề nói (Speaking Prompt)'
                  : 'Nội dung câu hỏi (Question Text)'}
              </label>
              <textarea
                placeholder={
                  selectedSkill === 'writing'
                    ? 'Ví dụ: "Tập thể dục mỗi ngày giúp mọi người giữ gìn sức khỏe tốt."'
                    : selectedSkill === 'speaking'
                    ? 'Ví dụ: "Describe a memorable trip you took recently with your friends or family."'
                    : selectedType === 'g_blank' || selectedType === 'l_part2_blank'
                    ? 'Ví dụ: "Yesterday, Linda ________ (visit) her grandparents."'
                    : "Ví dụ: What is the correct relative pronoun in: 'The boy ______ is standing there is my cousin'?"
                }
                value={fQuestionText}
                onChange={(e) => setFQuestionText(e.target.value)}
                rows={selectedSkill === 'writing' || selectedSkill === 'speaking' ? 3 : 2}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs font-semibold text-slate-900 bg-white leading-relaxed"
              />
            </div>

            {/* Form variant: Blank Question (Điền từ) */}
            {(selectedType === 'l_part2_blank' || selectedType === 'g_blank') && (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-emerald-900 uppercase">
                  Đáp án chính xác của ô trống (Correct Answer word/phrase) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: visited (hoặc 1700, May 5th...)"
                  value={fBlankAnswer}
                  onChange={(e) => setFBlankAnswer(e.target.value)}
                  className="w-full px-3.5 py-2 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 bg-white"
                />
                <p className="text-[10px] text-emerald-700 italic">
                  💡 Học sinh gõ từ này vào ô trống sẽ được tính điểm tuyệt đối.
                </p>
              </div>
            )}

            {/* Form variant: True/False/Not Given */}
            {selectedType === 'r_passage_b' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Chọn đáp án đúng của câu nhận định trên:
                </label>
                <div className="flex gap-3">
                  {['True', 'False', 'Not Given'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFCorrectAnswer(val)}
                      className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        fCorrectAnswer === val
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {fCorrectAnswer === val && <Check className="w-3.5 h-3.5" />}
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Form variant: Multiple Choice Options (A, B, C, D) */}
            {selectedSkill !== 'writing' &&
              selectedSkill !== 'speaking' &&
              selectedType !== 'l_part2_blank' &&
              selectedType !== 'g_blank' &&
              selectedType !== 'r_passage_b' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      4 Phương án lựa chọn (Nhấn trực tiếp vào chữ cái để chọn ĐÁP ÁN ĐÚNG):
                    </label>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Đáp án đúng hiện tại: <strong>{fCorrectAnswer}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {['A', 'B', 'C', 'D'].map((letter, idx) => {
                      const isCorrect = fCorrectAnswer === letter;

                      return (
                        <div
                          key={letter}
                          className={`flex items-center gap-2 p-2 rounded-2xl border-2 transition-all ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          {/* Clickable Letter Circle to toggle correct answer */}
                          <button
                            type="button"
                            onClick={() => setFCorrectAnswer(letter)}
                            className={`w-9 h-9 rounded-xl font-black text-xs shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title={`Chọn ${letter} làm đáp án đúng`}
                          >
                            {isCorrect ? <Check className="w-4 h-4" /> : letter}
                          </button>

                          {/* Option Text Input */}
                          <input
                            type="text"
                            placeholder={`Nội dung phương án ${letter}...`}
                            value={fOptions[idx] || ''}
                            onChange={(e) => {
                              const newOpts = [...fOptions];
                              newOpts[idx] = e.target.value;
                              setFOptions(newOpts);
                            }}
                            className="flex-1 px-3 py-1.5 border-0 focus:outline-none text-xs font-medium text-slate-800 bg-transparent"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Big Action Button: ADD THIS QUESTION */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleAddQuestion}
                className="w-full py-3.5 bg-indigo-950 hover:bg-indigo-900 text-white font-black text-xs rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" /> THÊM CÂU HỎI NÀY VÀO ĐỀ THI
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QUESTION LIST & MANAGEMENT (DANH SÁCH CÂU HỎI TRONG ĐỀ THI HIỆN TẠI) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                DANH SÁCH TẤT CẢ CÂU HỎI ĐÃ THÊM VÀO ĐỀ THI ({totalQuestionsCount} CÂU)
              </h3>
              <p className="text-[11px] text-slate-500">
                Bạn có thể kiểm tra lại nội dung, đáp án hoặc xóa câu hỏi thừa.
              </p>
            </div>
          </div>

          <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-100 font-mono">
            {totalQuestionsCount} câu hỏi
          </span>
        </div>

        {totalQuestionsCount === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Đề thi hiện chưa có câu hỏi nào</p>
            <p className="text-[11px] text-slate-400">
              Hãy dùng trình tạo ở Bước 3 phía trên để thêm từng câu hoặc bấm nút &quot;Nạp Đề Mẫu Chuẩn&quot; ở trên đầu.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. LISTENING */}
            {(listeningPart1.length > 0 || listeningPart2.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-indigo-50/80 px-4 py-2 rounded-xl border border-indigo-100">
                  <span className="text-xs font-black text-indigo-950 uppercase flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-indigo-700" /> 1. PHẦN NGHE HIỂU (LISTENING)
                  </span>
                  <span className="text-[11px] font-bold text-indigo-700 font-mono">
                    {listeningPart1.length + listeningPart2.length} câu
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                  {listeningPart1.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded">
                          Part 1 #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion('listening', q.id, 'part1')}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-bold text-slate-900 leading-snug">{q.text || q.question}</p>
                      {q.options && (
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium">
                          {q.options.map((opt: string, oIdx: number) => (
                            <div key={oIdx} className="truncate">
                              <strong className={q.answer === String.fromCharCode(65 + oIdx) ? 'text-emerald-600' : ''}>
                                {String.fromCharCode(65 + oIdx)}.
                              </strong>{' '}
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] font-bold text-emerald-600">Đáp án: {q.answer}</div>
                    </div>
                  ))}

                  {listeningPart2.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded">
                          Part 2 #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion('listening', q.id, 'part2')}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-bold text-slate-900 leading-snug">{q.text || q.question}</p>
                      <div className="text-[10px] font-bold text-emerald-600">Đáp án điền: {q.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. GRAMMAR */}
            {grammar.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-blue-50/80 px-4 py-2 rounded-xl border border-blue-100">
                  <span className="text-xs font-black text-blue-950 uppercase flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-700" /> 2. PHẦN NGỮ PHÁP (GRAMMAR)
                  </span>
                  <span className="text-[11px] font-bold text-blue-700 font-mono">{grammar.length} câu</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                  {grammar.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                          #{idx + 1} ({q.type === 'blank' ? 'Điền từ' : 'Trắc nghiệm'})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion('grammar', q.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-bold text-slate-900 leading-snug">{q.text || q.question}</p>
                      {q.options && (
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium">
                          {q.options.map((opt: string, oIdx: number) => (
                            <div key={oIdx} className="truncate">
                              <strong className={q.answer === String.fromCharCode(65 + oIdx) ? 'text-emerald-600' : ''}>
                                {String.fromCharCode(65 + oIdx)}.
                              </strong>{' '}
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] font-bold text-emerald-600">Đáp án: {q.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. VOCABULARY */}
            {vocabulary.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-50/80 px-4 py-2 rounded-xl border border-emerald-100">
                  <span className="text-xs font-black text-emerald-950 uppercase flex items-center gap-2">
                    <BookMarked className="w-4 h-4 text-emerald-700" /> 3. PHẦN TỪ VỰNG (VOCABULARY)
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 font-mono">{vocabulary.length} câu</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                  {vocabulary.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] font-black text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion('vocabulary', q.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-bold text-slate-900 leading-snug">{q.text || q.question}</p>
                      {q.options && (
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium">
                          {q.options.map((opt: string, oIdx: number) => (
                            <div key={oIdx} className="truncate">
                              <strong className={q.answer === String.fromCharCode(65 + oIdx) ? 'text-emerald-600' : ''}>
                                {String.fromCharCode(65 + oIdx)}.
                              </strong>{' '}
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] font-bold text-emerald-600">Đáp án: {q.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. READING */}
            {(readingPassage.questionsPartA?.length > 0 || readingPassage.questionsPartB?.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-amber-50/80 px-4 py-2 rounded-xl border border-amber-100">
                  <span className="text-xs font-black text-amber-950 uppercase flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-700" /> 4. PHẦN ĐỌC HIỂU (READING)
                  </span>
                  <span className="text-[11px] font-bold text-amber-700 font-mono">
                    {(readingPassage.questionsPartA?.length || 0) + (readingPassage.questionsPartB?.length || 0)} câu
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                  {readingPassage.questionsPartA?.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                          Part A #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion('reading', q.id, 'partA')}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-bold text-slate-900 leading-snug">{q.text || q.question}</p>
                      <div className="text-[10px] font-bold text-emerald-600">Đáp án: {q.answer}</div>
                    </div>
                  ))}

                  {readingPassage.questionsPartB?.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                          Part B (T/F/NG) #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion('reading', q.id, 'partB')}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-bold text-slate-900 leading-snug">{q.text || q.question}</p>
                      <div className="text-[10px] font-bold text-emerald-600">Đáp án: {q.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. WRITING */}
            {writingQuestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-rose-50/80 px-4 py-2 rounded-xl border border-rose-100">
                  <span className="text-xs font-black text-rose-950 uppercase flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-rose-700" /> 5. PHẦN VIẾT LUẬN (WRITING)
                  </span>
                  <span className="text-[11px] font-bold text-rose-700 font-mono">{writingQuestions.length} câu</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                  {writingQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] font-black text-rose-900 bg-rose-50 px-2 py-0.5 rounded">
                          Đề viết #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion('writing', q.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-bold text-slate-900 leading-snug">{q.vietnamese || q.prompt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. SPEAKING */}
            {(speakingQuestions.length > 0 || speakingReadAloud.text) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-purple-50/80 px-4 py-2 rounded-xl border border-purple-100">
                  <span className="text-xs font-black text-purple-950 uppercase flex items-center gap-2">
                    <Mic className="w-4 h-4 text-purple-700" /> 6. PHẦN NÓI GHI ÂM (SPEAKING)
                  </span>
                  <span className="text-[11px] font-bold text-purple-700 font-mono">
                    {speakingQuestions.length + (speakingReadAloud.text ? 1 : 0)} phần
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                  {speakingReadAloud.text && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs md:col-span-2">
                      <span className="font-mono text-[10px] font-black text-purple-900 bg-purple-50 px-2 py-0.5 rounded">
                        Phần 1: Đọc to đoạn văn (Read Aloud - {speakingReadAloud.wordCount || 90} từ)
                      </span>
                      <p className="text-slate-700 italic font-serif leading-relaxed line-clamp-3">
                        {speakingReadAloud.text}
                      </p>
                    </div>
                  )}

                  {speakingQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 text-xs relative group shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-mono text-[10px] font-black text-purple-900 bg-purple-50 px-2 py-0.5 rounded">
                          Câu hỏi phỏng vấn #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion('speaking', q.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-bold text-slate-900 leading-snug">{q.text || q.prompt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM ACTION BAR: SAVE EXAM */}
      <div className="sticky bottom-4 z-40 bg-slate-900/95 backdrop-blur-md text-white p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-black text-white">HOÀN TẤT VÀ LƯU ĐỀ THI</h4>
          <p className="text-xs text-slate-400">
            Đề thi &quot;{examTitle || 'Chưa đặt tên'}&quot; hiện có{' '}
            <strong className="text-emerald-400">{totalQuestionsCount} câu hỏi</strong> • Thời gian:{' '}
            {examDuration} phút
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Hủy
            </button>
          )}

          <button
            type="button"
            disabled={isLoading || !examTitle.trim()}
            onClick={handleSaveFullExam}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-450 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Đang lưu đề thi...' : 'LƯU ĐỀ THI VÀO HỆ THỐNG'}
          </button>
        </div>
      </div>
    </div>
  );
};
