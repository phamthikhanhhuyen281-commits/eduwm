import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Users,
  CheckCircle,
  Clock,
  Award,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Play,
  Volume2,
  Trash2,
  Lock,
  Unlock,
  Search,
  Filter,
  Check,
  X,
  FileText,
  Save,
  MessageSquare,
  Sparkles,
  RotateCcw,
  BookOpen,
  Plus,
  ExternalLink,
  Video,
  Settings,
  BarChart2,
  Activity,
  Globe,
  Share2,
  Eye,
  Upload,
  Headphones,
  FileCode,
  Image as ImageIcon,
  Copy,
  FileCheck
} from 'lucide-react';
import { WRITING_QUESTIONS, LISTENING_PART_1, LISTENING_PART_2, SPEAKING_READ_ALOUD, SPEAKING_QUESTIONS, GRAMMAR_QUESTIONS, VOCABULARY_QUESTIONS, READING_PASSAGE } from '../questions';

// Firebase Services
import { authService } from '../services/auth';
import { candidateService, Candidate, checkAnswer, isAnswerCorrect, isAnswerSkipped, getCandidateAnswer, autoGradeCandidate } from '../services/candidateService';
import { examService } from '../services/examService';
import { materialService } from '../services/materialService';
import { settingsService } from '../services/settingsService';
import { storageService } from '../services/storageService';
import { aiScanService } from '../services/aiScanService';
import { languageService, Language } from '../services/languageService';
import LanguageToggle from './LanguageToggle';
import { DocumentReaderModal } from './DocumentReaderModal';
import { ManualExamBuilder } from './ManualExamBuilder';

interface CandidateSummary {
  id: string;
  fullName: string;
  phone: string;
  registeredAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  durationSeconds: number;
  tabSwitches: number;
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
  writingScore: number;
  writingComment: string;
}

interface AdminPanelProps {
  onBackToTest: () => void;
}

// Client-side exact replication of server grading comparison
function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function checkAnswerClient(userAnswer: string, correctAnswer: string): boolean {
  return checkAnswer(userAnswer, correctAnswer);
}

function countTabSwitches(candidate: any): number {
  if (!candidate) return 0;
  let logCount = 0;
  if (Array.isArray(candidate.logs)) {
    candidate.logs.forEach((log: any) => {
      const act = (log.action || '').toLowerCase();
      if (
        act.includes('tab switch') ||
        act.includes('chuyển tab') ||
        act.includes('rời khỏi trang') ||
        act.includes('rời trang') ||
        act.includes('hidden')
      ) {
        logCount++;
      }
    });
  }
  return Math.max(candidate.tabSwitches || 0, logCount);
}

export default function AdminPanel({ onBackToTest }: AdminPanelProps) {
  const [lang, setLang] = useState<Language>(languageService.getLanguage());
  const t = (key: Parameters<typeof languageService.t>[0]) => languageService.t(key);

  useEffect(() => {
    return languageService.onChange((newLang) => {
      setLang(newLang);
    });
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [token, setToken] = useState('');

  // Dashboard Data
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    active: 0,
    averageScore: 0,
    averagePercentage: 0,
    bands: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 }
  });

  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<CandidateSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'completed' | 'active'>('all');
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('all');
  const [expandedPhones, setExpandedPhones] = useState<string[]>([]);
  const [lockLoadingPhone, setLockLoadingPhone] = useState<string | null>(null);

  // Candidate Details state
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [viewingDetailId, setViewingDetailId] = useState<string | null>(null);
  const [activeAuditTab, setActiveAuditTab] = useState<'listening' | 'grammar' | 'vocabulary' | 'reading'>('listening');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all');

  // Materials state
  const [adminTab, setAdminTab] = useState<'exams' | 'candidates' | 'materials' | 'settings' | 'logs'>('exams');
  const [materials, setMaterials] = useState<any[]>([]);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialDesc, setNewMaterialDesc] = useState('');
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [newMaterialType, setNewMaterialType] = useState<'pdf' | 'docx' | 'image' | 'video' | 'audio' | 'link' | 'document' | 'other'>('pdf');
  const [materialSourceMode, setMaterialSourceMode] = useState<'upload' | 'link'>('upload');
  const [selectedMaterialFile, setSelectedMaterialFile] = useState<File | null>(null);
  const [materialFilterType, setMaterialFilterType] = useState<string>('all');
  const [materialSearchTerm, setMaterialSearchTerm] = useState<string>('');
  const [materialSubmitting, setMaterialSubmitting] = useState(false);
  const [adminPreviewItem, setAdminPreviewItem] = useState<any | null>(null);
  const [adminPreviewType, setAdminPreviewType] = useState<string | null>(null);
  const [adminAudioError, setAdminAudioError] = useState(false);
  const [adminMaterialViewMode, setAdminMaterialViewMode] = useState<'manage' | 'student_preview'>('manage');

  // Settings State
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState('indigo');
  const [slogan, setSlogan] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherZalo, setTeacherZalo] = useState('');
  const [teacherFacebook, setTeacherFacebook] = useState('');
  const [teacherWebsite, setTeacherWebsite] = useState('');
  const [teacherAddress, setTeacherAddress] = useState('');
  const [websiteName, setWebsiteName] = useState('English Placement');
  const [primaryColor, setPrimaryColor] = useState('#1e3a8a');
  const [secondaryColor, setSecondaryColor] = useState('#3b82f6');
  const [favicon, setFavicon] = useState('');
  const [cefrA1Max, setCefrA1Max] = useState<number>(19);
  const [cefrA2Max, setCefrA2Max] = useState<number>(39);
  const [cefrB1Max, setCefrB1Max] = useState<number>(59);
  const [cefrB2Max, setCefrB2Max] = useState<number>(74);
  const [cefrC1Max, setCefrC1Max] = useState<number>(89);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Exam management states
  const [exams, setExams] = useState<any[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examActiveSubTab, setExamActiveSubTab] = useState<'candidates' | 'settings'>('candidates');
  const [examTitle, setExamTitle] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [examDuration, setExamDuration] = useState<number>(60);
  const [examAudio1Url, setExamAudio1Url] = useState('');
  const [examAudio2Url, setExamAudio2Url] = useState('');
  const [examQuestionsJson, setExamQuestionsJson] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');

  // Visual Question Builder states
  const [qbSkill, setQbSkill] = useState<string>('listeningPart1');
  const [qbQuestionText, setQbQuestionText] = useState<string>('');
  const [qbAudioUrl, setQbAudioUrl] = useState<string>('');
  const [qbImageUrl, setQbImageUrl] = useState<string>('');
  const [isUploadingAudio1, setIsUploadingAudio1] = useState(false);
  const [isUploadingAudio2, setIsUploadingAudio2] = useState(false);
  const [isUploadingQbAudio, setIsUploadingQbAudio] = useState(false);
  const [isUploadingQbImage, setIsUploadingQbImage] = useState(false);
  const [qbOptions, setQbOptions] = useState<string[]>(['', '', '', '']);
  const [qbCorrectAnswer, setQbCorrectAnswer] = useState<string>('A');
  const [qbPassage, setQbPassage] = useState<string>('');

  // Bulk Selection States
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isBulkDeletingCandidates, setIsBulkDeletingCandidates] = useState(false);

  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [isBulkDeletingExams, setIsBulkDeletingExams] = useState(false);

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [isBulkDeletingMaterials, setIsBulkDeletingMaterials] = useState(false);

  // Custom Confirmation Modal state
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    type?: 'reset' | 'delete';
    id?: string;
    name?: string;
    title?: string;
    description?: React.ReactNode;
    confirmText?: string;
    confirmStyle?: 'danger' | 'warning' | 'primary';
    onConfirm?: () => Promise<void> | void;
  } | null>(null);

  // Custom Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Custom alert action
  const showAlert = (title: string, message: string, type: 'success' | 'error') => {
    setAlertConfig({
      show: true,
      title,
      message,
      type
    });
  };

  // Exam CRUD & scanning functions
  const fetchExams = async () => {
    try {
      const list = await examService.getExams();
      setExams(list || []);
    } catch (e) {
      console.error('Error fetching exams:', e);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim()) {
      showAlert('Lỗi', 'Vui lòng nhập tiêu đề đề thi.', 'error');
      return;
    }
    setExamLoading(true);
    try {
      let parsedQuestions = {};
      if (examQuestionsJson.trim()) {
        try {
          parsedQuestions = JSON.parse(examQuestionsJson);
        } catch (err) {
          showAlert('Cảnh báo', 'JSON câu hỏi không hợp lệ nên chưa thể lưu các câu hỏi.', 'error');
        }
      }

      const id = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      const newExam = {
        id,
        title: examTitle.trim(),
        description: examDesc.trim(),
        durationMinutes: examDuration,
        audio1Url: examAudio1Url,
        audio2Url: examAudio2Url,
        questions: parsedQuestions
      };

      await examService.saveExam(newExam as any);
      showAlert('Thành công', 'Đã tạo đề thi mới thành công!', 'success');

      setExamTitle('');
      setExamDesc('');
      setExamDuration(60);
      setExamAudio1Url('');
      setExamAudio2Url('');
      setExamQuestionsJson('');
      setEditingExamId(null);
      fetchExams();
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi khi tạo đề thi.', 'error');
    } finally {
      setExamLoading(false);
    }
  };

  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExamId) return;
    if (!examTitle.trim()) {
      showAlert('Lỗi', 'Vui lòng nhập tiêu đề đề thi.', 'error');
      return;
    }

    let parsedQuestions = {};
    if (examQuestionsJson.trim()) {
      try {
        parsedQuestions = JSON.parse(examQuestionsJson);
      } catch (err) {
        showAlert('Lỗi định dạng', 'Dữ liệu JSON câu hỏi không hợp lệ. Vui lòng kiểm tra lại cú pháp JSON.', 'error');
        return;
      }
    }

    setExamLoading(true);
    try {
      const updatedExam = {
        id: editingExamId,
        title: examTitle.trim(),
        description: examDesc.trim(),
        durationMinutes: examDuration,
        audio1Url: examAudio1Url,
        audio2Url: examAudio2Url,
        questions: parsedQuestions
      };

      await examService.saveExam(updatedExam as any);
      showAlert('Thành công', 'Cập nhật đề thi thành công!', 'success');
      setEditingExamId(null);
      setExamTitle('');
      setExamDesc('');
      setExamDuration(60);
      setExamAudio1Url('');
      setExamAudio2Url('');
      setExamQuestionsJson('');
      fetchExams();
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi khi cập nhật đề thi.', 'error');
    } finally {
      setExamLoading(false);
    }
  };

  const handleAdminDeleteExam = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa đề thi "${title}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    try {
      await examService.deleteExam(id);
      setSelectedExamIds((prev) => prev.filter((item) => item !== id));
      showAlert('Đã xóa', 'Xóa đề thi thành công!', 'success');
      fetchExams();
    } catch (err: any) {
      showAlert('Thất bại', err.message, 'error');
    }
  };

  const handleToggleSelectExam = (id: string) => {
    if (id === 'default-exam') return;
    setSelectedExamIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllExams = () => {
    const deletable = exams.filter((e) => e.id !== 'default-exam');
    const allIds = deletable.map((e) => e.id);
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedExamIds.includes(id));
    if (isAllSelected) {
      setSelectedExamIds([]);
    } else {
      setSelectedExamIds(allIds);
    }
  };

  const handleBulkDeleteExams = async () => {
    if (selectedExamIds.length === 0) return;
    const count = selectedExamIds.length;
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${count} đề thi đã chọn không? Thao tác này KHÔNG THỂ hoàn tác.`)) {
      return;
    }

    setIsBulkDeletingExams(true);
    try {
      let successCount = 0;
      for (const id of selectedExamIds) {
        if (id === 'default-exam') continue;
        try {
          await examService.deleteExam(id);
          successCount++;
          if (editingExamId === id) {
            setEditingExamId(null);
            setExamTitle('');
            setExamDesc('');
            setExamDuration(45);
            setExamAudio1Url('');
            setExamAudio2Url('');
            setExamQuestionsJson('');
          }
        } catch (e) {
          console.error(`Error deleting exam ${id}:`, e);
        }
      }
      setSelectedExamIds([]);
      showAlert('Thành công', `Đã xóa thành công ${successCount} đề thi!`, 'success');
      await fetchExams();
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi khi xóa hàng loạt đề thi.', 'error');
    } finally {
      setIsBulkDeletingExams(false);
    }
  };

  const handleSaveExamFromBuilder = async (examData: {
    title: string;
    description: string;
    durationMinutes: number;
    audio1Url: string;
    audio2Url: string;
    questions: any;
  }) => {
    setExamLoading(true);
    try {
      const id = editingExamId || (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10));
      const payload = {
        id,
        title: examData.title.trim(),
        description: examData.description.trim(),
        durationMinutes: examData.durationMinutes,
        audio1Url: examData.audio1Url,
        audio2Url: examData.audio2Url,
        questions: examData.questions
      };

      await examService.saveExam(payload as any);
      showAlert('Thành công', editingExamId ? 'Cập nhật đề thi thành công!' : 'Đã tạo đề thi mới thành công!', 'success');
      setEditingExamId(null);
      setExamTitle('');
      setExamDesc('');
      setExamDuration(45);
      setExamAudio1Url('');
      setExamAudio2Url('');
      setExamQuestionsJson('');
      fetchExams();
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi khi lưu đề thi.', 'error');
    } finally {
      setExamLoading(false);
    }
  };

  const handleSelectEditExam = (exam: any) => {
    setEditingExamId(exam.id);
    setExamTitle(exam.title);
    setExamDesc(exam.description);
    setExamDuration(exam.durationMinutes);
    setExamAudio1Url(exam.audio1Url || '');
    setExamAudio2Url(exam.audio2Url || '');
    setExamQuestionsJson(JSON.stringify(exam.questions || {}, null, 2));
    setExamActiveSubTab('builder');
  };

  const handleAddToQuestionsJson = () => {
    if (!qbQuestionText.trim() && qbSkill !== 'readingPartA' && qbSkill !== 'readingPartB') {
      showAlert('Lỗi', 'Vui lòng nhập nội dung câu hỏi hoặc đề bài!', 'error');
      return;
    }

    let currentObj: any = {};
    try {
      currentObj = examQuestionsJson.trim() ? JSON.parse(examQuestionsJson) : {};
    } catch (e) {
      showAlert('Lỗi cú pháp', 'Dữ liệu JSON hiện tại đang bị lỗi cú pháp. Vui lòng bấm "Tải Cấu trúc Mẫu (JSON Template)" để làm mới trước khi tự động thêm.', 'error');
      return;
    }

    // Ensure fundamental structures exist
    if (!currentObj.listeningPart1) currentObj.listeningPart1 = [];
    if (!currentObj.listeningPart2) currentObj.listeningPart2 = [];
    if (!currentObj.grammar) currentObj.grammar = [];
    if (!currentObj.vocabulary) currentObj.vocabulary = [];
    if (!currentObj.readingPassage) {
      currentObj.readingPassage = {
        passagePartA: "",
        questionsPartA: [],
        passagePartB: "",
        questionsPartB: []
      };
    }
    if (!currentObj.writingQuestions) currentObj.writingQuestions = [];
    if (!currentObj.speakingQuestions) currentObj.speakingQuestions = [];

    const uniqueId = `${qbSkill}_${Date.now()}`;

    if (qbSkill === 'listeningPart1') {
      currentObj.listeningPart1.push({
        id: uniqueId,
        type: 'mcq',
        text: qbQuestionText.trim(),
        question: qbQuestionText.trim(),
        audioUrl: qbAudioUrl.trim() || undefined,
        imageUrl: qbImageUrl.trim() || undefined,
        options: [...qbOptions],
        answer: qbCorrectAnswer
      });
    } else if (qbSkill === 'listeningPart2') {
      currentObj.listeningPart2.push({
        id: uniqueId,
        type: 'blank',
        text: qbQuestionText.trim(),
        question: qbQuestionText.trim(),
        options: [...qbOptions],
        answer: qbCorrectAnswer
      });
    } else if (qbSkill === 'grammar') {
      currentObj.grammar.push({
        id: uniqueId,
        type: 'mcq',
        text: qbQuestionText.trim(),
        question: qbQuestionText.trim(),
        options: [...qbOptions],
        answer: qbCorrectAnswer
      });
    } else if (qbSkill === 'vocabulary') {
      currentObj.vocabulary.push({
        id: uniqueId,
        type: 'mcq',
        text: qbQuestionText.trim(),
        question: qbQuestionText.trim(),
        options: [...qbOptions],
        answer: qbCorrectAnswer
      });
    } else if (qbSkill === 'readingPartA') {
      if (qbPassage.trim()) {
        currentObj.readingPassage.passagePartA = qbPassage.trim();
      }
      if (qbQuestionText.trim()) {
        currentObj.readingPassage.questionsPartA.push({
          id: uniqueId,
          type: 'mcq',
          text: qbQuestionText.trim(),
          question: qbQuestionText.trim(),
          options: [...qbOptions],
          answer: qbCorrectAnswer
        });
      }
    } else if (qbSkill === 'readingPartB') {
      if (qbPassage.trim()) {
        currentObj.readingPassage.passagePartB = qbPassage.trim();
      }
      if (qbQuestionText.trim()) {
        currentObj.readingPassage.questionsPartB.push({
          id: uniqueId,
          type: 'mcq',
          text: qbQuestionText.trim(),
          question: qbQuestionText.trim(),
          options: [...qbOptions],
          answer: qbCorrectAnswer
        });
      }
    } else if (qbSkill === 'writing') {
      currentObj.writingQuestions.push({
        id: uniqueId,
        prompt: qbQuestionText.trim(),
        vietnamese: qbQuestionText.trim()
      });
    } else if (qbSkill === 'speaking') {
      currentObj.speakingQuestions.push({
        id: uniqueId,
        prompt: qbQuestionText.trim(),
        text: qbQuestionText.trim(),
        question: qbQuestionText.trim(),
        allowRecord: true
      });
    }

    setExamQuestionsJson(JSON.stringify(currentObj, null, 2));
    setQbQuestionText('');
    setQbImageUrl('');
    setQbAudioUrl('');
    showAlert('Thành công', 'Đã chèn câu hỏi mới vào cấu trúc JSON bên dưới!', 'success');
  };

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>, audioSlot: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (audioSlot === 1) setIsUploadingAudio1(true);
    else setIsUploadingAudio2(true);
    setExamLoading(true);
    try {
      const downloadUrl = await storageService.uploadFile(file, 'exams/audio');
      if (audioSlot === 1) {
        setExamAudio1Url(downloadUrl);
        showAlert('Thành công', 'Đã tải lên Audio 1 thành công!', 'success');
      } else {
        setExamAudio2Url(downloadUrl);
        showAlert('Thành công', 'Đã tải lên Audio 2 thành công!', 'success');
      }
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi tải audio.', 'error');
    } finally {
      if (audioSlot === 1) setIsUploadingAudio1(false);
      else setIsUploadingAudio2(false);
      setExamLoading(false);
    }
  };

  const handleDeleteQuestionFromExam = (sectionKey: string, questionId: string) => {
    try {
      const currentObj = examQuestionsJson.trim() ? JSON.parse(examQuestionsJson) : {};
      
      if (sectionKey === 'readingPartA') {
        if (currentObj.readingPassage && currentObj.readingPassage.questionsPartA) {
          currentObj.readingPassage.questionsPartA = currentObj.readingPassage.questionsPartA.filter((q: any) => q.id !== questionId);
        }
      } else if (sectionKey === 'readingPartB') {
        if (currentObj.readingPassage && currentObj.readingPassage.questionsPartB) {
          currentObj.readingPassage.questionsPartB = currentObj.readingPassage.questionsPartB.filter((q: any) => q.id !== questionId);
        }
      } else if (currentObj[sectionKey]) {
        currentObj[sectionKey] = currentObj[sectionKey].filter((q: any) => q.id !== questionId);
      }
      
      const newJson = JSON.stringify(currentObj, null, 2);
      setExamQuestionsJson(newJson);
      showAlert('Thành công', 'Đã xóa câu hỏi khỏi danh sách tạm. Đừng quên bấm "LƯU THAY ĐỔI" để hoàn tất lưu thay đổi này vào hệ thống!', 'success');
    } catch (e) {
      showAlert('Lỗi', 'Không thể xóa câu hỏi. Vui lòng kiểm tra định dạng JSON.', 'error');
    }
  };

  const renderCurrentExamQuestionsList = () => {
    let parsed: any = null;
    try {
      parsed = examQuestionsJson.trim() ? JSON.parse(examQuestionsJson) : null;
    } catch (e) {
      return (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-xl font-bold">
          ⚠️ Cấu trúc dữ liệu JSON hiện tại đang lỗi cú pháp nên không thể hiển thị danh sách câu hỏi trực quan. Hãy kiểm tra các dấu ngoặc hoặc dấu phẩy.
        </div>
      );
    }

    if (!parsed) return null;

    const categories = [
      { key: 'listeningPart1', label: 'Listening Part 1 (Tranh ảnh)', items: parsed.listeningPart1 || [] },
      { key: 'listeningPart2', label: 'Listening Part 2 (Hội thoại)', items: parsed.listeningPart2 || [] },
      { key: 'grammar', label: 'Grammar (Ngữ pháp)', items: parsed.grammar || [] },
      { key: 'vocabulary', label: 'Vocabulary (Từ vựng)', items: parsed.vocabulary || [] },
      { key: 'readingPartA', label: 'Reading Part A (Điền từ)', items: parsed.readingPassage?.questionsPartA || [] },
      { key: 'readingPartB', label: 'Reading Part B (Đọc hiểu)', items: parsed.readingPassage?.questionsPartB || [] },
      { key: 'writingQuestions', label: 'Writing (Viết)', items: parsed.writingQuestions || [] },
      { key: 'speakingQuestions', label: 'Speaking (Nói)', items: parsed.speakingQuestions || [] }
    ];

    const totalQuestionsCount = categories.reduce((acc, cat) => acc + cat.items.length, 0);
    const hasQuestions = totalQuestionsCount > 0;

    return (
      <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-150 pb-2">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-900" />
            <h4 className="text-[10px] font-black uppercase text-indigo-950 tracking-wider">
              DANH SÁCH CÂU HỎI HIỆN CÓ TRONG ĐỀ THI ({totalQuestionsCount} CÂU)
            </h4>
          </div>
          {hasQuestions && (
            <span className="text-[10px] bg-indigo-50 text-indigo-900 border border-indigo-100 font-bold px-2 py-0.5 rounded-full">
              Đầy đủ {totalQuestionsCount} câu hỏi
            </span>
          )}
        </div>

        {!hasQuestions ? (
          <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Chưa có câu hỏi nào được thêm vào đề thi này. Sử dụng trình thêm câu hỏi trực quan ở trên hoặc quét bằng AI để tạo.
          </div>
        ) : (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1.5 scrollbar-thin">
            {categories.map((cat) => {
              if (cat.items.length === 0) return null;
              return (
                <div key={cat.key} className="space-y-2">
                  <div className="flex justify-between items-center bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider">
                      {cat.label}
                    </span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 font-black px-2 py-0.5 rounded-full font-mono">
                      {cat.items.length} câu
                    </span>
                  </div>

                  <div className="space-y-1 pl-1">
                    {cat.items.map((q: any, qIdx: number) => {
                      const qText = q.text || q.question || q.vietnamese || q.prompt || `Câu hỏi ${qIdx + 1}`;
                      return (
                        <div key={q.id || qIdx} className="flex items-start justify-between gap-3 p-2 bg-slate-50/50 border border-slate-150 hover:bg-slate-50 rounded-lg transition-all text-xs">
                          <div className="space-y-0.5 grow min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black font-mono text-indigo-950 bg-indigo-100/70 px-1.5 py-0.2 rounded">
                                #{qIdx + 1}
                              </span>
                              {q.id && (
                                <span className="text-[8px] font-mono text-slate-400 truncate max-w-[120px]">
                                  ID: {q.id}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-800 font-bold leading-normal break-words">{qText}</p>
                            {q.options && q.options.length > 0 && (
                              <div className="grid grid-cols-2 gap-1.5 mt-1 text-[9px] text-slate-500 font-medium">
                                {q.options.map((opt: string, oIdx: number) => (
                                  <div key={oIdx} className="truncate">
                                    <strong className="text-slate-700">{String.fromCharCode(65 + oIdx)}.</strong> {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.answer && (
                              <div className="text-[9px] text-emerald-600 font-bold mt-1">
                                Đáp án đúng: {q.answer}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteQuestionFromExam(cat.key, q.id)}
                            className="p-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-md transition-colors shrink-0 cursor-pointer"
                            title="Xóa câu hỏi này"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderVisualQuestionBuilder = () => {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
          <Sparkles className="w-4 h-4 text-indigo-950" />
          <h4 className="text-[10px] font-black uppercase text-indigo-950 tracking-wider">
            TRÌNH THÊM CÂU HỎI TRỰC QUAN (VISUAL QUESTION BUILDER)
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Skill Selector */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold text-slate-500 uppercase">1. Chọn kỹ năng (Skill)</label>
            <select
              value={qbSkill}
              onChange={(e) => setQbSkill(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-900 bg-white"
            >
              <option value="listeningPart1">Listening Part 1 (Có Tranh / Ảnh minh họa)</option>
              <option value="listeningPart2">Listening Part 2 (Hội thoại / Độc thoại ngắn)</option>
              <option value="grammar">Grammar (Ngữ pháp trắc nghiệm)</option>
              <option value="vocabulary">Vocabulary (Từ vựng trắc nghiệm)</option>
              <option value="readingPartA">Reading Part A (Bài đọc điền từ trắc nghiệm)</option>
              <option value="readingPartB">Reading Part B (Bài đọc đọc hiểu trắc nghiệm)</option>
              <option value="writing">Writing (Viết luận tự luận)</option>
              <option value="speaking">Speaking (Nói - Học sinh thu âm câu trả lời)</option>
            </select>
          </div>

          {/* If Listening Part 1: allow adding audio URL / Upload file & Image */}
          {qbSkill === 'listeningPart1' && (
            <>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 uppercase">
                  2. Link Audio hoặc Tải file nghe câu này (Nếu có)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={isUploadingQbAudio ? "Đang tải file nghe lên... ⏳" : "Nhập URL file mp3..."}
                    value={qbAudioUrl}
                    disabled={isUploadingQbAudio}
                    onChange={(e) => setQbAudioUrl(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-900 bg-white"
                  />
                  <label className={`text-white text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors font-bold shrink-0 flex items-center justify-center ${
                    isUploadingQbAudio ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-900 hover:bg-indigo-850'
                  }`}>
                    {isUploadingQbAudio ? 'Đang tải...' : 'Tải file'}
                    <input
                      type="file"
                      accept="audio/*"
                      disabled={isUploadingQbAudio}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setIsUploadingQbAudio(true);
                          try {
                            const url = await storageService.uploadFile(file, 'exams/questions/audio');
                            setQbAudioUrl(url);
                            showAlert('Thành công', 'Đã tải lên audio cho câu hỏi!', 'success');
                          } catch (err: any) {
                            showAlert('Lỗi', err.message, 'error');
                          } finally {
                            setIsUploadingQbAudio(false);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 uppercase">
                  2b. Link Ảnh hoặc Tải ảnh minh họa cho câu này (Part 1 Picture)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={isUploadingQbImage ? "Đang tải ảnh lên... ⏳" : "Nhập URL ảnh (http://...)"}
                    value={qbImageUrl}
                    disabled={isUploadingQbImage}
                    onChange={(e) => setQbImageUrl(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-900 bg-white"
                  />
                  <label className={`text-white text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors font-bold shrink-0 flex items-center justify-center ${
                    isUploadingQbImage ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-900 hover:bg-indigo-850'
                  }`}>
                    {isUploadingQbImage ? 'Đang tải...' : 'Tải ảnh'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingQbImage}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setIsUploadingQbImage(true);
                          try {
                            const url = await storageService.uploadFile(file, 'exams/questions/images');
                            setQbImageUrl(url);
                            showAlert('Thành công', 'Đã tải lên ảnh minh họa!', 'success');
                          } catch (err: any) {
                            showAlert('Lỗi', err.message, 'error');
                          } finally {
                            setIsUploadingQbImage(false);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </>
          )}

          {/* If Reading Part A or Part B: Passage input */}
          {(qbSkill === 'readingPartA' || qbSkill === 'readingPartB') && (
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[9px] font-bold text-slate-500 uppercase">
                2. Đoạn văn đọc hiểu (Reading Passage) - Nhập một lần cho toàn bài đọc
              </label>
              <textarea
                placeholder="Nhập đoạn văn đọc hiểu tại đây..."
                value={qbPassage}
                onChange={(e) => setQbPassage(e.target.value)}
                rows={3}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-900 bg-white"
              />
            </div>
          )}
        </div>

        {/* Question Text Prompt */}
        <div className="space-y-1">
          <label className="block text-[9px] font-bold text-slate-500 uppercase">
            {qbSkill === 'writing' ? '2. Đề bài viết luận' : qbSkill === 'speaking' ? '2. Đề bài / Câu hỏi nói ghi âm (Speaking Record Prompt)' : '3. Câu hỏi (Question Text)'}
          </label>
          <input
            type="text"
            placeholder={
              qbSkill === 'writing'
                ? "Ví dụ: Write an essay (150-200 words) about your family..."
                : qbSkill === 'speaking'
                ? "Ví dụ: Describe a memorable trip you took recently..."
                : "Ví dụ: What is the correct form of 'be' in 'He ___ a doctor'?"
            }
            value={qbQuestionText}
            onChange={(e) => setQbQuestionText(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-900 bg-white"
          />
        </div>

        {/* If NOT writing or speaking: render Multiple Choice Options */}
        {qbSkill !== 'writing' && qbSkill !== 'speaking' && (
          <div className="space-y-3 border-t border-slate-150 pt-3">
            <label className="block text-[9px] font-bold text-slate-500 uppercase">4. Các phương án lựa chọn & Đáp án đúng</label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {qbOptions.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx); // A, B, C, D
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-bold text-xs text-indigo-950 w-4 text-center">{letter}.</span>
                    <input
                      type="text"
                      placeholder={`Phương án ${letter}...`}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...qbOptions];
                        newOpts[idx] = e.target.value;
                        setQbOptions(newOpts);
                      }}
                      className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-900 bg-white"
                    />
                  </div>
                );
              })}
            </div>

            {/* Correct Answer dropdown */}
            <div className="flex items-center gap-3 w-40">
              <label className="block text-[10px] font-bold text-slate-600 shrink-0">Đáp án đúng:</label>
              <select
                value={qbCorrectAnswer}
                onChange={(e) => setQbCorrectAnswer(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-900 bg-white"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
          </div>
        )}

        {/* If speaking: notify about recording block */}
        {qbSkill === 'speaking' && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] rounded-lg font-bold flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Đề thi Speaking này sẽ kích hoạt tính năng Ghi âm micro trực tiếp cho học sinh trả lời trên website.</span>
          </div>
        )}

        {/* Add question button */}
        <button
          type="button"
          onClick={handleAddToQuestionsJson}
          className="w-full py-2.5 bg-indigo-950 hover:bg-indigo-900 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer text-center uppercase tracking-wider"
        >
          Chèn câu hỏi này vào cấu trúc đề thi bên dưới ↓
        </button>
      </div>
    );
  };

  const handleAIScanExam = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanLoading(true);
    setScanError('');
    showAlert('Đang quét đề', 'AI đang xử lý quét ảnh/file đề thi và chuyển đổi thành đề thi số. Vui lòng chờ trong giây lát...', 'success');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        const result = await aiScanService.scanExamWithAI(base64Data, file.type || 'image/jpeg');
        
        if (result) {
          setExamTitle(result.title || examTitle || 'Đề thi Quét bởi AI');
          setExamDesc(result.description || examDesc || 'Đề thi tự động quét và tạo lập bởi AI');
          setExamDuration(result.durationMinutes || examDuration || 60);
          
          const questionsObj = {
            listeningPart1: result.listeningPart1 || [],
            listeningPart2: result.listeningPart2 || [],
            speakingReadAloud: result.speakingReadAloud || { text: "", wordCount: 0 },
            speakingQuestions: result.speakingQuestions || [],
            grammar: result.grammar || [],
            vocabulary: result.vocabulary || [],
            readingPassage: result.readingPassage || { title: "", text: "", questionsPartA: [], questionsPartB: [] },
            writingQuestions: result.writingQuestions || []
          };

          setExamQuestionsJson(JSON.stringify(questionsObj, null, 2));
          showAlert('Quét đề hoàn tất', 'AI đã phân tích đề thi thành công! Vui lòng kiểm tra và chỉnh sửa chi tiết ở biểu mẫu phía dưới trước khi bấm Lưu.', 'success');
        } else {
          throw new Error('Dữ liệu quét không hợp lệ.');
        }
      } catch (err: any) {
        setScanError(err.message);
        showAlert('Lỗi quét đề', err.message, 'error');
      } finally {
        setScanLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Manual Grading State
  const [writingScore, setWritingScore] = useState<number>(0);
  const [writingComment, setWritingComment] = useState<string>('');
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingSuccess, setGradingSuccess] = useState(false);

  // Custom Confirmation Modal state
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    type: 'reset' | 'delete';
    id: string;
    name: string;
  } | null>(null);

  // Custom Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Check saved admin session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
      
      const loadAll = async () => {
        try {
          const cands = await candidateService.getCandidates();
          setCandidates(cands);
          calculateDashboardStats(cands);
          
          const mats = await materialService.getMaterials();
          setMaterials(mats);
          
          fetchExams();
          
           const s = await settingsService.getSettings();
          setLogoUrl(s.logoUrl || '');
          setThemeColor(s.themeColor || 'indigo');
          setSlogan(s.slogan || '');
          setTeacherPhone(s.teacherPhone || '');
          setTeacherEmail(s.teacherEmail || '');
          setGeminiApiKey(s.geminiApiKey || '');
          setTeacherName(s.teacherName || '');
          setTeacherZalo(s.teacherZalo || '');
          setTeacherFacebook(s.teacherFacebook || '');
          setTeacherWebsite(s.teacherWebsite || '');
          setTeacherAddress(s.teacherAddress || '');
          setWebsiteName(s.websiteName || 'English Placement');
          setPrimaryColor(s.primaryColor || '#1e3a8a');
          setSecondaryColor(s.secondaryColor || '#3b82f6');
          setFavicon(s.favicon || '');
          if (s.cefrThresholds) {
            setCefrA1Max(s.cefrThresholds.a1Max);
            setCefrA2Max(s.cefrThresholds.a2Max);
            setCefrB1Max(s.cefrThresholds.b1Max);
            setCefrB2Max(s.cefrThresholds.b2Max);
            setCefrC1Max(s.cefrThresholds.c1Max);
          }
          calculateDashboardStats(cands, s.cefrThresholds);
        } catch (err) {
          console.error('Error loading initial admin data:', err);
        }
      };
      loadAll();
    }
  }, []);

  const calculateDashboardStats = (cands: any[], customThresholds?: any) => {
    const total = cands.length;
    const completed = cands.filter(c => c.submittedAt !== null).length;
    const active = total - completed;
    
    let totalScore = 0;
    let totalPercentage = 0;
    let completedCount = 0;
    
    const bands = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    
    const a1Max = customThresholds ? customThresholds.a1Max : cefrA1Max;
    const a2Max = customThresholds ? customThresholds.a2Max : cefrA2Max;
    const b1Max = customThresholds ? customThresholds.b1Max : cefrB1Max;
    const b2Max = customThresholds ? customThresholds.b2Max : cefrB2Max;
    const c1Max = customThresholds ? customThresholds.c1Max : cefrC1Max;

    cands.forEach(c => {
      if (c.submittedAt !== null && c.scores) {
        completedCount++;
        totalScore += c.scores.total || 0;
        totalPercentage += c.scores.percentage || 0;
        
        const pct = c.scores.percentage || 0;
        if (pct <= a1Max) bands.A1++;
        else if (pct <= a2Max) bands.A2++;
        else if (pct <= b1Max) bands.B1++;
        else if (pct <= b2Max) bands.B2++;
        else if (pct <= c1Max) bands.C1++;
        else bands.C2++;
      }
    });
    
    setStats({
      total,
      completed,
      active,
      averageScore: completedCount > 0 ? Number((totalScore / completedCount).toFixed(1)) : 0,
      averagePercentage: completedCount > 0 ? Math.round(totalPercentage / completedCount) : 0,
      bands
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const ok = await authService.login(password);
      if (!ok.success) {
        throw new Error(ok.error || 'Mật khẩu quản trị viên không chính xác.');
      }

      localStorage.setItem('admin_token', 'firebase_auth_active');
      setToken('firebase_auth_active');
      setIsAuthenticated(true);
      
      const cands = await candidateService.getCandidates();
      setCandidates(cands);
      calculateDashboardStats(cands);
      
      const mats = await materialService.getMaterials();
      setMaterials(mats);
      
      fetchExams();
      
      const s = await settingsService.getSettings();
      setLogoUrl(s.logoUrl || '');
      setThemeColor(s.themeColor || 'indigo');
      setSlogan(s.slogan || '');
      setTeacherPhone(s.teacherPhone || '');
      setTeacherEmail(s.teacherEmail || '');
      setGeminiApiKey(s.geminiApiKey || '');
      setTeacherName(s.teacherName || '');
      setTeacherZalo(s.teacherZalo || '');
      setTeacherFacebook(s.teacherFacebook || '');
      setTeacherWebsite(s.teacherWebsite || '');
      setTeacherAddress(s.teacherAddress || '');
      setWebsiteName(s.websiteName || 'English Placement');
      setPrimaryColor(s.primaryColor || '#1e3a8a');
      setSecondaryColor(s.secondaryColor || '#3b82f6');
      setFavicon(s.favicon || '');
      if (s.cefrThresholds) {
        setCefrA1Max(s.cefrThresholds.a1Max);
        setCefrA2Max(s.cefrThresholds.a2Max);
        setCefrB1Max(s.cefrThresholds.b1Max);
        setCefrB2Max(s.cefrThresholds.b2Max);
        setCefrC1Max(s.cefrThresholds.c1Max);
      }
      calculateDashboardStats(cands, s.cefrThresholds);
    } catch (err: any) {
      setLoginError(err.message || 'Đăng nhập thất bại.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken('');
    setIsAuthenticated(false);
    setSelectedCandidate(null);
    setViewingDetailId(null);
  };

  const deduplicateCandidateList = (list: Candidate[]): Candidate[] => {
    const map = new Map<string, Candidate>();
    const sorted = [...list].sort((a, b) => {
      if (a.submittedAt && !b.submittedAt) return -1;
      if (!a.submittedAt && b.submittedAt) return 1;
      if (a.submittedAt && b.submittedAt) {
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
      return (b.durationSeconds || 0) - (a.durationSeconds || 0);
    });

    sorted.forEach((c) => {
      const cleanPhone = (c.phone || '').replace(/[\s\.\-\(\)]/g, '').trim() || c.phone || c.id;
      const examKey = c.examId || 'default-exam';
      const key = `${cleanPhone}__${examKey}`;
      if (!map.has(key)) {
        map.set(key, c);
      }
    });
    return Array.from(map.values());
  };

  const fetchDashboardData = async () => {
    try {
      const rawCands = await candidateService.getCandidates();
      const cands = deduplicateCandidateList(rawCands);
      setCandidates(cands);
      calculateDashboardStats(cands);
    } catch (e) {
      console.error('Error fetching admin stats:', e);
    }
  };

  const fetchCandidates = async () => {
    try {
      const rawCands = await candidateService.getCandidates();
      const cands = deduplicateCandidateList(rawCands);
      setCandidates(cands);
      calculateDashboardStats(cands);
    } catch (e) {
      console.error('Error fetching candidates list:', e);
    }
  };

  const fetchMaterials = async () => {
    try {
      const mats = await materialService.getMaterials();
      setMaterials(mats || []);
    } catch (e) {
      console.error('Error fetching materials list:', e);
    }
  };

  const fetchCandidateDetails = async (id: string) => {
    try {
      const cand = await candidateService.getCandidateById(id);
      if (cand) {
        setSelectedCandidate(cand);
        setWritingScore(cand.writingScore || 0);
        setWritingComment(cand.writingComment || '');
      }
    } catch (e) {
      console.error('Error fetching candidate details:', e);
    }
  };

  const toggleExpandPhone = (phone: string) => {
    setExpandedPhones((prev) =>
      prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]
    );
  };

  const handleToggleLockPhone = async (phone: string, currentIsLocked: boolean) => {
    setLockLoadingPhone(phone);
    try {
      const newLockState = !currentIsLocked;
      await candidateService.setCandidateLockStateByPhone(phone, newLockState);
      
      setAlertConfig({
        show: true,
        title: 'Thành công',
        message: newLockState
          ? `Đã khóa thí sinh có SĐT "${phone}" thành công! Thí sinh này sẽ không thể tham gia bất kỳ kỳ thi nào nữa.`
          : `Đã mở khóa thí sinh có SĐT "${phone}" thành công!`,
        type: 'success'
      });
      
      // Refresh list
      await fetchCandidates();
    } catch (err: any) {
      setAlertConfig({
        show: true,
        title: 'Lỗi',
        message: err.message || 'Có lỗi xảy ra khi cập nhật trạng thái khóa.',
        type: 'error'
      });
    } finally {
      setLockLoadingPhone(null);
    }
  };

  // Handle candidate search and filter
  useEffect(() => {
    let result = candidates;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    if (selectedExamFilter !== 'all') {
      result = result.filter((c) => (c.examId || 'default-exam') === selectedExamFilter);
    }

    if (filterType === 'completed') {
      result = result.filter((c) => c.submittedAt !== null);
    } else if (filterType === 'active') {
      result = result.filter((c) => c.submittedAt === null);
    }

    setFilteredCandidates(result);
  }, [searchQuery, filterType, selectedExamFilter, candidates]);

  // Auto-fetch fresh materials whenever materials tab is activated
  useEffect(() => {
    if (adminTab === 'materials' && isAuthenticated) {
      fetchMaterials();
    }
  }, [adminTab, isAuthenticated]);

  // Group candidates by phone for deduplicated candidate management
  const groupedCandidates = React.useMemo(() => {
    const groups: Record<string, {
      phone: string;
      fullName: string;
      isLocked: boolean;
      attempts: any[];
    }> = {};

    filteredCandidates.forEach((c) => {
      const p = c.phone || 'N/A';
      if (!groups[p]) {
        groups[p] = {
          phone: p,
          fullName: c.fullName,
          isLocked: !!c.isLocked,
          attempts: []
        };
      }
      groups[p].attempts.push(c);
      if (c.isLocked) {
        groups[p].isLocked = true;
      }
    });

    return Object.values(groups);
  }, [filteredCandidates]);

  const handleViewDetail = (id: string) => {
    setViewingDetailId(id);
    fetchCandidateDetails(id);
  };

  const handleCloseDetail = () => {
    setViewingDetailId(null);
    setSelectedCandidate(null);
    // Refresh list to show updated grades
    fetchDashboardData();
    fetchCandidates();
  };

  // Handle Manual Writing grading submit
  const handleGradeWriting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;

    setGradingLoading(true);
    setGradingSuccess(false);

    try {
      const updatedCand = await candidateService.gradeWriting(selectedCandidate.id, writingScore, writingComment);
      setSelectedCandidate(updatedCand);
      setGradingSuccess(true);
      setTimeout(() => setGradingSuccess(false), 3000);
      fetchCandidates(); // Refresh list to update final scores
    } catch (err: any) {
      setAlertConfig({
        show: true,
        title: 'Thất bại',
        message: err.message || 'Lỗi chấm viết.',
        type: 'error'
      });
    } finally {
      setGradingLoading(false);
    }
  };

  const handleDeleteCandidate = (id: string, name: string) => {
    setConfirmModalConfig({ type: 'delete', id, name });
    setShowConfirmModal(true);
  };

  const handleToggleSelectCandidate = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllCandidates = () => {
    const allFilteredIds = filteredCandidates.map((c) => c.id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedCandidateIds.includes(id));
    if (isAllSelected) {
      setSelectedCandidateIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedCandidateIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleBulkDeleteCandidates = async () => {
    if (selectedCandidateIds.length === 0) return;
    const count = selectedCandidateIds.length;
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${count} thí sinh đã chọn không? Thao tác này KHÔNG THỂ hoàn tác.`)) {
      return;
    }

    setIsBulkDeletingCandidates(true);
    try {
      let successCount = 0;
      for (const id of selectedCandidateIds) {
        try {
          await candidateService.deleteCandidate(id);
          successCount++;
          if (selectedCandidate && selectedCandidate.id === id) {
            handleCloseDetail();
          }
        } catch (e) {
          console.error(`Error deleting candidate ${id}:`, e);
        }
      }
      setSelectedCandidateIds([]);
      showAlert('Thành công', `Đã xóa thành công ${successCount} thí sinh khỏi hệ thống!`, 'success');
      await fetchCandidates();
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi khi xóa hàng loạt thí sinh.', 'error');
    } finally {
      setIsBulkDeletingCandidates(false);
    }
  };

  const handleResetCandidate = (id: string, name: string) => {
    setConfirmModalConfig({ type: 'reset', id, name });
    setShowConfirmModal(true);
  };

  const handleConfirmedAction = async () => {
    if (!confirmModalConfig) return;
    const { type, id, name } = confirmModalConfig;
    setShowConfirmModal(false);

    if (type === 'delete') {
      try {
        await candidateService.deleteCandidate(id);

        setAlertConfig({
          show: true,
          title: 'Thành công',
          message: `Đã xóa thí sinh "${name}" vĩnh viễn khỏi hệ thống!`,
          type: 'success'
        });

        if (selectedCandidate && selectedCandidate.id === id) {
          handleCloseDetail();
        } else {
          fetchCandidates();
        }
      } catch (err: any) {
        setAlertConfig({
          show: true,
          title: 'Thất bại',
          message: err.message || 'Lỗi xóa thí sinh.',
          type: 'error'
        });
      }
    } else if (type === 'reset') {
      try {
        await candidateService.resetCandidate(id);

        setAlertConfig({
          show: true,
          title: 'Thành công',
          message: `Đã reset bài thi của thí sinh "${name}" thành công! Thí sinh có thể làm lại bài thi ngay.`,
          type: 'success'
        });

        if (selectedCandidate && selectedCandidate.id === id) {
          fetchCandidateDetails(id);
        } else {
          fetchCandidates();
        }
      } catch (err: any) {
        setAlertConfig({
          show: true,
          title: 'Thất bại',
          message: err.message || 'Lỗi reset bài thi.',
          type: 'error'
        });
      }
    }
  };

  // Helper to format duration in seconds to hh:mm:ss or mm:ss
  const formatDuration = (totalSecs: number) => {
    if (!totalSecs) return '0 giây';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    let res = '';
    if (hrs > 0) res += `${hrs} giờ `;
    if (mins > 0) res += `${mins} phút `;
    if (secs > 0 || res === '') res += `${secs} giây`;
    return res;
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialTitle.trim()) {
      showAlert('Lỗi', 'Vui lòng nhập Tiêu đề tài liệu.', 'error');
      return;
    }

    if (materialSourceMode === 'upload' && !selectedMaterialFile && !newMaterialUrl.trim()) {
      showAlert('Lỗi', 'Vui lòng chọn tệp tin từ máy tính hoặc nhập đường link.', 'error');
      return;
    }

    if (materialSourceMode === 'link' && !newMaterialUrl.trim()) {
      showAlert('Lỗi', 'Vui lòng nhập đường dẫn liên kết (URL).', 'error');
      return;
    }

    setMaterialSubmitting(true);
    try {
      let finalUrl = newMaterialUrl.trim();
      let detectedType = newMaterialType;
      let fileName = selectedMaterialFile?.name || '';
      let fileSize = selectedMaterialFile?.size || 0;

      // If uploading direct file
      if (materialSourceMode === 'upload' && selectedMaterialFile) {
        finalUrl = await storageService.uploadFile(selectedMaterialFile, 'materials');
        
        // Auto-detect type from file extension
        const ext = selectedMaterialFile.name.split('.').pop()?.toLowerCase() || '';
        if (ext === 'pdf') detectedType = 'pdf';
        else if (ext === 'doc' || ext === 'docx') detectedType = 'docx';
        else if (['mp4', 'webm', 'mov', 'm4v', 'avi'].includes(ext)) detectedType = 'video';
        else if (['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)) detectedType = 'audio';
        else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) detectedType = 'image';
        else detectedType = 'document';
      } else if (materialSourceMode === 'link') {
        const urlLower = finalUrl.toLowerCase();
        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) detectedType = 'video';
        else if (urlLower.endsWith('.pdf')) detectedType = 'pdf';
        else if (urlLower.endsWith('.doc') || urlLower.endsWith('.docx')) detectedType = 'docx';
        else if (urlLower.endsWith('.mp3') || urlLower.endsWith('.wav')) detectedType = 'audio';
        else if (urlLower.endsWith('.png') || urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) detectedType = 'image';
      }

      const id = 'mat_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const newMat = {
        id,
        title: newMaterialTitle.trim(),
        description: newMaterialDesc.trim(),
        url: finalUrl,
        type: detectedType,
        fileName,
        fileSize,
        uploadedBy: teacherName || 'Admin',
        createdAt: new Date().toISOString()
      };

      // Optimistically add to state immediately
      setMaterials((prev) => [newMat, ...prev.filter(m => m.id !== id)]);

      await materialService.saveMaterial(newMat as any);

      // Reset form
      setNewMaterialTitle('');
      setNewMaterialDesc('');
      setNewMaterialUrl('');
      setSelectedMaterialFile(null);
      setNewMaterialType('pdf');
      
      // Refresh list in background
      fetchMaterials();
      
      showAlert('Thành công', 'Tài liệu ôn tập đã được thêm thành công!', 'success');
    } catch (e: any) {
      console.error(e);
      showAlert('Lỗi', e.message || 'Có lỗi xảy ra khi lưu tài liệu.', 'error');
    } finally {
      setMaterialSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này không?')) return;

    try {
      await materialService.deleteMaterial(id);
      setSelectedMaterialIds((prev) => prev.filter((item) => item !== id));
      await fetchMaterials();
      
      setAlertConfig({
        show: true,
        title: 'Thành công',
        message: 'Đã xóa tài liệu thành công.',
        type: 'success'
      });
    } catch (e: any) {
      console.error(e);
      setAlertConfig({
        show: true,
        title: 'Lỗi',
        message: e.message || 'Có lỗi xảy ra khi xóa tài liệu.',
        type: 'error'
      });
    }
  };

  const handleToggleSelectMaterial = (id: string) => {
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllMaterials = (filteredList: any[]) => {
    const allFilteredIds = filteredList.map((m) => m.id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedMaterialIds.includes(id));
    if (isAllSelected) {
      setSelectedMaterialIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedMaterialIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleBulkDeleteMaterials = async () => {
    if (selectedMaterialIds.length === 0) return;
    const count = selectedMaterialIds.length;
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA ${count} tài liệu đã chọn không? Thao tác này KHÔNG THỂ hoàn tác.`)) {
      return;
    }

    setIsBulkDeletingMaterials(true);
    try {
      let successCount = 0;
      for (const id of selectedMaterialIds) {
        try {
          await materialService.deleteMaterial(id);
          successCount++;
        } catch (e) {
          console.error(`Error deleting material ${id}:`, e);
        }
      }
      setSelectedMaterialIds([]);
      showAlert('Thành công', `Đã xóa thành công ${successCount} tài liệu!`, 'success');
      await fetchMaterials();
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi khi xóa hàng loạt tài liệu.', 'error');
    } finally {
      setIsBulkDeletingMaterials(false);
    }
  };

  // Export Table to CSV
  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'; // Add BOM for excel Vietnamese characters support
    csvContent += 'Mã thí sinh,Họ tên,Số điện thoại,Kỳ thi,Thời gian đăng ký,Bắt đầu,Nộp bài,Thời gian làm bài,Lần chuyển tab,Điểm nghe,Điểm ngữ pháp,Điểm từ vựng,Điểm đọc,Điểm viết,Tổng điểm,Tỷ lệ %\n';

    const listToExport = filteredCandidates.length > 0 ? filteredCandidates : candidates;

    listToExport.forEach((c) => {
      const listening = c.scores?.listening ?? '-';
      const grammar = c.scores?.grammar ?? '-';
      const vocabulary = c.scores?.vocabulary ?? '-';
      const reading = c.scores?.reading ?? '-';
      const writing = c.writingScore ?? 0;
      const total = c.scores?.total ?? '-';
      const pct = c.scores?.percentage ?? '-';
      const dur = c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)} phút ${c.durationSeconds % 60} giây` : '-';
      const examTitle = exams.find(e => e.id === (c.examId || 'default-exam'))?.title || 'Đề thi Placement Test';

      const row = [
        c.id,
        `"${c.fullName}"`,
        `"${c.phone}"`,
        `"${examTitle}"`,
        c.registeredAt ? new Date(c.registeredAt).toLocaleString('vi-VN') : '',
        c.startedAt ? new Date(c.startedAt).toLocaleString('vi-VN') : '',
        c.submittedAt ? new Date(c.submittedAt).toLocaleString('vi-VN') : 'Đang thi',
        `"${dur}"`,
        c.tabSwitches,
        listening,
        grammar,
        vocabulary,
        reading,
        writing,
        total,
        pct
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `English_Placement_Test_Candidates_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated) {
    return (
      <div id="admin-login-wrapper" className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-900 p-3.5 rounded-full shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-center text-3xl font-extrabold text-indigo-950 uppercase">
            Admin Portal Log In
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Hệ thống quản lý điểm thi đánh giá năng lực Tiếng Anh
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-slate-200">
            <form className="space-y-6" onSubmit={handleLogin}>
              {loginError && (
                <div id="login-error-alert" className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-semibold border border-red-100 flex items-center gap-2">
                  <ShieldAlert className="shrink-0 w-4 h-4 text-red-600" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Mật khẩu bí mật của Admin
                </label>
                <input
                  id="admin-pwd-input"
                  type="password"
                  required
                  placeholder="Nhập mật khẩu..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-900 focus:outline-none transition-all"
                />
                <p className="text-slate-400 text-[10px] mt-1">
                  * Mật khẩu mặc định khởi tạo ban đầu là: <span className="font-mono bg-slate-50 border border-slate-200 px-1 py-0.5 rounded text-indigo-900 font-bold">admin123</span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onBackToTest}
                  className="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl text-xs hover:bg-slate-50 transition-colors"
                >
                  Quay lại thi
                </button>
                <button
                  id="admin-login-submit"
                  type="submit"
                  className="flex-1 bg-indigo-900 hover:bg-indigo-850 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-md hover:shadow-lg transition-colors cursor-pointer"
                >
                  Đăng nhập Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const renderMaterialsManager = () => {
    const getYoutubeEmbedUrl = (url: string) => {
      if (!url) return '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : '';
    };

    const getProxiedUrl = (url: string) => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return `/api/audio-proxy?url=${encodeURIComponent(url)}`;
      }
      return url;
    };

    const handleOpenAdminPreview = (mat: any) => {
      setAdminPreviewItem(mat);
      setAdminAudioError(false);
      const urlLower = (mat.url || '').toLowerCase();
      const typeLower = (mat.type || '').toLowerCase();

      if (typeLower === 'video' || urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || urlLower.endsWith('.mp4') || urlLower.endsWith('.webm') || urlLower.endsWith('.mov')) {
        setAdminPreviewType('video');
      } else if (typeLower === 'audio' || urlLower.endsWith('.mp3') || urlLower.endsWith('.wav') || urlLower.endsWith('.m4a') || urlLower.endsWith('.ogg')) {
        setAdminPreviewType('audio');
      } else if (typeLower === 'image' || urlLower.endsWith('.png') || urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg') || urlLower.endsWith('.webp')) {
        setAdminPreviewType('image');
      } else if (typeLower === 'pdf' || urlLower.endsWith('.pdf')) {
        setAdminPreviewType('pdf');
      } else if (typeLower === 'docx' || urlLower.endsWith('.docx') || urlLower.endsWith('.doc')) {
        setAdminPreviewType('word');
      } else {
        setAdminPreviewType('link');
      }
    };

    const getMaterialTypeBadge = (mat: any) => {
      const cleanUrl = (mat.url || '').split('?')[0].split('#')[0].toLowerCase();
      const type = (mat.type || '').toLowerCase();
      const fileName = (mat.fileName || '').toLowerCase();

      if (type === 'pdf' || cleanUrl.endsWith('.pdf') || fileName.endsWith('.pdf')) return { text: 'Tài liệu PDF', bg: 'bg-red-50 text-red-700 border-red-200' };
      if (type === 'docx' || type === 'doc' || cleanUrl.endsWith('.docx') || cleanUrl.endsWith('.doc') || fileName.endsWith('.docx')) return { text: 'File Word (.docx)', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      if (type === 'video' || mat.url.toLowerCase().includes('youtu') || cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm')) return { text: 'Video bài giảng', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      if (type === 'audio' || cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a')) return { text: 'Audio bài nghe', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      if (type === 'image' || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.svg') || fileName.endsWith('.png') || fileName.endsWith('.jpg')) return { text: 'Hình ảnh bài học', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      if (type === 'link') return { text: 'Liên kết ngoài', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      return { text: 'Tài liệu học tập', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    };

    // Filter materials for admin view
    const filteredAdminMaterials = materials.filter((m) => {
      const matchSearch =
        m.title.toLowerCase().includes(materialSearchTerm.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(materialSearchTerm.toLowerCase())) ||
        (m.fileName && m.fileName.toLowerCase().includes(materialSearchTerm.toLowerCase()));

      if (!matchSearch) return false;
      if (materialFilterType === 'all') return true;

      const cleanUrl = (m.url || '').split('?')[0].split('#')[0].toLowerCase();
      const type = (m.type || '').toLowerCase();
      const fileName = (m.fileName || '').toLowerCase();

      if (materialFilterType === 'pdf') return type === 'pdf' || cleanUrl.endsWith('.pdf') || fileName.endsWith('.pdf');
      if (materialFilterType === 'docx') return type === 'docx' || type === 'doc' || cleanUrl.endsWith('.doc') || cleanUrl.endsWith('.docx') || fileName.endsWith('.docx');
      if (materialFilterType === 'video') return type === 'video' || m.url.toLowerCase().includes('youtu') || cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov');
      if (materialFilterType === 'audio') return type === 'audio' || cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.ogg');
      if (materialFilterType === 'image') return type === 'image' || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.svg') || fileName.endsWith('.png') || fileName.endsWith('.jpg');
      if (materialFilterType === 'link') return type === 'link';
      return true;
    });

    const getIconForType = (type: string, url: string) => {
      const cleanUrl = (url || '').split('?')[0].split('#')[0].toLowerCase();
      const t = (type || '').toLowerCase();

      if (t === 'pdf' || cleanUrl.endsWith('.pdf')) return <FileText className="w-5 h-5 text-red-600" />;
      if (t === 'docx' || t === 'doc' || cleanUrl.endsWith('.docx') || cleanUrl.endsWith('.doc')) return <FileCode className="w-5 h-5 text-blue-600" />;
      if (t === 'video' || (url || '').toLowerCase().includes('youtu') || cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm')) return <Video className="w-5 h-5 text-purple-600" />;
      if (t === 'audio' || cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a')) return <Headphones className="w-5 h-5 text-emerald-600" />;
      if (t === 'image' || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.svg')) return <ImageIcon className="w-5 h-5 text-amber-600" />;
      if (t === 'link') return <ExternalLink className="w-5 h-5 text-cyan-600" />;
      return <BookOpen className="w-5 h-5 text-indigo-600" />;
    };

    return (
      <div className="space-y-6">
        {/* Header with View Mode Switcher */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-extrabold text-indigo-950 uppercase tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-900" /> KHO TÀI LIỆU HỌC TẬP & BÀI GIẢNG
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Quản lý, tải lên và trực tiếp xem trước tài liệu Word (.docx), PDF, Video, Audio bài giảng giống hệt giao diện của học sinh.
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
            <button
              onClick={() => setAdminMaterialViewMode('manage')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                adminMaterialViewMode === 'manage'
                  ? 'bg-white text-indigo-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Quản lý & Tải lên
            </button>
            <button
              onClick={() => setAdminMaterialViewMode('student_preview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                adminMaterialViewMode === 'student_preview'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Xem giao diện như Học sinh
            </button>
          </div>
        </div>

        {/* MODE 1: MANAGEMENT & UPLOAD */}
        {adminMaterialViewMode === 'manage' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Column 1: Add New Material Form */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-900" /> Tải lên / Thêm tài liệu mới
              </h3>

              {/* Source Mode Switcher */}
              <div className="flex rounded-2xl bg-slate-100 p-1 mb-4">
                <button
                  type="button"
                  onClick={() => setMaterialSourceMode('upload')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    materialSourceMode === 'upload' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" /> Tải tệp tin trực tiếp
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialSourceMode('link')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    materialSourceMode === 'link' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Nhập liên kết ngoài
                </button>
              </div>

              <form onSubmit={handleAddMaterial} className="space-y-4">
                {/* File Picker if Upload Mode */}
                {materialSourceMode === 'upload' && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      Chọn tệp tin (PDF, Word, MP4, MP3, Ảnh...)
                    </label>
                    <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-4 text-center bg-slate-50/60 hover:bg-slate-50 transition-colors">
                      <input
                        type="file"
                        id="admin-material-file-input"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.webm,.mov,.mp3,.wav,.m4a,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedMaterialFile(file);
                            if (!newMaterialTitle) {
                              const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                              setNewMaterialTitle(nameWithoutExt);
                            }
                            const ext = file.name.split('.').pop()?.toLowerCase() || '';
                            if (ext === 'pdf') setNewMaterialType('pdf');
                            else if (ext === 'doc' || ext === 'docx') setNewMaterialType('docx');
                            else if (['mp4', 'webm', 'mov'].includes(ext)) setNewMaterialType('video');
                            else if (['mp3', 'wav', 'm4a'].includes(ext)) setNewMaterialType('audio');
                            else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) setNewMaterialType('image');
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      {selectedMaterialFile ? (
                        <div className="space-y-1">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-900 rounded-xl flex items-center justify-center mx-auto">
                            <FileCheck className="w-5 h-5" />
                          </div>
                          <div className="text-xs font-bold text-slate-800 truncate max-w-xs mx-auto">
                            {selectedMaterialFile.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {(selectedMaterialFile.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                          <div className="text-[10px] text-indigo-600 font-semibold pt-1">
                            Click để chọn file khác
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                          <div className="text-xs font-bold text-slate-700">Kéo thả hoặc Nhấp để chọn file</div>
                          <div className="text-[10px] text-slate-400">
                            Hỗ trợ .docx, .doc, .pdf, .mp4 (video), .mp3 (audio), .jpg, .png...
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* URL Input if Link Mode */}
                {materialSourceMode === 'link' && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">Đường dẫn liên kết (URL)</label>
                    <input
                      type="url"
                      required
                      placeholder="https://youtube.com/watch?v=... hoặc https://drive.google.com/..."
                      value={newMaterialUrl}
                      onChange={(e) => {
                        setNewMaterialUrl(e.target.value);
                        if (e.target.value.includes('youtu')) setNewMaterialType('video');
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all font-mono"
                    />
                  </div>
                )}

                {/* Title */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Tiêu đề tài liệu</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Bài giảng Ngữ pháp Unit 1 / Đề cương Word (.docx)"
                    value={newMaterialTitle}
                    onChange={(e) => setNewMaterialTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all font-medium"
                  />
                </div>

                {/* Type selector */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Định dạng phân loại</label>
                  <select
                    value={newMaterialType}
                    onChange={(e) => setNewMaterialType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all cursor-pointer"
                  >
                    <option value="docx">📝 File Word (.docx / .doc)</option>
                    <option value="pdf">📄 Tài liệu PDF (.pdf)</option>
                    <option value="video">🎬 Video bài giảng (.mp4 / YouTube)</option>
                    <option value="audio">🎧 File Audio bài nghe (.mp3 / .wav)</option>
                    <option value="image">🖼️ Hình ảnh bài học (.png / .jpg)</option>
                    <option value="link">🔗 Trang web liên kết ngoài</option>
                    <option value="document">📁 Tài liệu khác</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Mô tả / Hướng dẫn học viên</label>
                  <textarea
                    placeholder="Mô tả nội dung chính, hướng dẫn học sinh đọc hoặc xem trước khi thi..."
                    value={newMaterialDesc}
                    onChange={(e) => setNewMaterialDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={materialSubmitting}
                  className="w-full bg-indigo-900 hover:bg-indigo-850 disabled:bg-indigo-300 text-white font-bold py-3.5 px-4 rounded-2xl text-xs shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  {materialSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                      Đang xử lý & lưu tài liệu...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Tải lên kho tài liệu
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Column 2: Materials List */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <span>Danh sách tài liệu ({materials.length})</span>
                  </h3>
                  {filteredAdminMaterials.length > 0 && (
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none ml-2">
                      <input
                        type="checkbox"
                        checked={
                          filteredAdminMaterials.length > 0 &&
                          filteredAdminMaterials.every((m) => selectedMaterialIds.includes(m.id))
                        }
                        onChange={() => handleSelectAllMaterials(filteredAdminMaterials)}
                        className="w-4 h-4 rounded text-indigo-900 focus:ring-indigo-900 border-slate-300 cursor-pointer"
                      />
                      <span>Chọn tất cả ({filteredAdminMaterials.length})</span>
                    </label>
                  )}
                </div>

                {/* Search box */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm tài liệu..."
                    value={materialSearchTerm}
                    onChange={(e) => setMaterialSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-900"
                  />
                </div>
              </div>

              {/* Bulk Action Bar for Materials */}
              {selectedMaterialIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs animate-fadeIn">
                  <span className="font-bold text-rose-900 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    Đã chọn {selectedMaterialIds.length} tài liệu
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMaterialIds([])}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors text-xs"
                    >
                      Bỏ chọn
                    </button>
                    <button
                      type="button"
                      disabled={isBulkDeletingMaterials}
                      onClick={handleBulkDeleteMaterials}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm text-xs"
                    >
                      {isBulkDeletingMaterials ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                          Đang xóa...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa {selectedMaterialIds.length} tài liệu đã chọn
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'docx', label: 'Word' },
                  { id: 'pdf', label: 'PDF' },
                  { id: 'video', label: 'Video' },
                  { id: 'audio', label: 'Audio' },
                  { id: 'image', label: 'Ảnh' },
                  { id: 'link', label: 'Link' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setMaterialFilterType(f.id)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      materialFilterType === f.id
                        ? 'bg-indigo-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredAdminMaterials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <BookOpen className="w-12 h-12 mb-2 stroke-1" />
                  <p className="text-xs font-semibold">Chưa có tài liệu nào trong chuyên mục này.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Vui lòng điền biểu mẫu bên trái để tải lên tài liệu mới.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto pr-1">
                  {filteredAdminMaterials.map((m) => (
                    <div
                      key={m.id}
                      className={`py-4 first:pt-0 last:pb-0 flex justify-between items-start gap-3 p-3 rounded-2xl transition-colors group ${
                        selectedMaterialIds.includes(m.id)
                          ? 'bg-indigo-50/80 border border-indigo-200'
                          : 'hover:bg-slate-50/70 border border-transparent'
                      }`}
                    >
                      <div className="pt-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedMaterialIds.includes(m.id)}
                          onChange={() => handleToggleSelectMaterial(m.id)}
                          className="w-4 h-4 rounded text-indigo-900 focus:ring-indigo-900 border-slate-300 cursor-pointer"
                          title="Chọn tài liệu này để xóa"
                        />
                      </div>

                      <div
                        onClick={() => handleOpenAdminPreview(m)}
                        className="flex gap-3 min-w-0 cursor-pointer flex-grow"
                      >
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl shrink-0 group-hover:bg-indigo-100/80 transition-colors">
                          {getIconForType(m.type, m.url)}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate group-hover:text-indigo-900 transition-colors">
                              {m.title}
                            </h4>
                            <span className="text-[9px] px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md text-indigo-900 font-mono font-bold">
                              {m.type}
                            </span>
                          </div>
                          {m.fileName && (
                            <p className="text-[10px] text-slate-400 font-mono truncate">
                              📁 {m.fileName}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {m.description || 'Không có mô tả.'}
                          </p>
                          <div className="flex items-center gap-3 pt-1 text-[10px]">
                            <span className="text-indigo-900 font-semibold inline-flex items-center gap-1">
                              <Eye className="w-3 h-3 text-indigo-700" /> Nhấn để xem trực tiếp
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pt-1">
                        {/* Direct Preview Button */}
                        <button
                          onClick={() => handleOpenAdminPreview(m)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-900 text-indigo-900 hover:text-white rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          title="Xem trực tiếp tài liệu"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem ngay
                        </button>
                        
                        {/* Download button */}
                        <a
                          href={m.url}
                          download={m.fileName || `${m.title}.${m.type === 'docx' ? 'docx' : 'pdf'}`}
                          className="text-slate-600 hover:text-indigo-900 p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Tải về máy"
                        >
                          <Download className="w-4 h-4" />
                        </a>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteMaterial(m.id)}
                          className="text-rose-600 hover:text-rose-800 p-2 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Xóa tài liệu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODE 2: STUDENT VIEW PREVIEW */}
        {adminMaterialViewMode === 'student_preview' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-blue-900 text-white p-6 rounded-3xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="px-2.5 py-1 bg-white/20 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                  Mô phỏng Giao diện Học sinh
                </span>
                <h3 className="text-lg font-black tracking-tight">KHO BÀI GIẢNG & HỌC LIỆU TRỰC TUYẾN</h3>
                <p className="text-xs text-indigo-100 mt-1 max-w-xl">
                  Đây là giao diện thực tế mà thí sinh nhìn thấy khi đăng nhập vào hệ thống. Bạn có thể bấm trực tiếp vào từng thẻ để đọc, nghe, hoặc tải tệp về máy.
                </p>
              </div>

              {/* Search in Student View */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-white/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm tài liệu bài học..."
                  value={materialSearchTerm}
                  onChange={(e) => setMaterialSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-2xl text-xs text-white placeholder:text-indigo-200 focus:outline-none focus:bg-white/20 focus:ring-2 focus:ring-white/40"
                />
              </div>
            </div>

            {/* Filter pills in Student View */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'Tất cả bài học' },
                { id: 'docx', label: 'File Word' },
                { id: 'pdf', label: 'Tài liệu PDF' },
                { id: 'video', label: 'Video bài giảng' },
                { id: 'audio', label: 'Audio bài nghe' },
                { id: 'image', label: 'Hình ảnh' },
                { id: 'link', label: 'Liên kết' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMaterialFilterType(f.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    materialFilterType === f.id
                      ? 'bg-indigo-900 text-white shadow-md scale-102'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Student Cards Grid */}
            {filteredAdminMaterials.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400 space-y-3">
                <BookOpen className="w-12 h-12 mx-auto stroke-1" />
                <h4 className="text-sm font-bold text-slate-700">Chưa tìm thấy tài liệu phù hợp</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Hãy chuyển sang tab "Quản lý & Tải lên" để thêm các bài giảng hoặc tài liệu ôn tập mới.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAdminMaterials.map((mat) => {
                  const badge = getMaterialTypeBadge(mat);
                  return (
                    <motion.div
                      key={mat.id}
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        {/* Header: Type Badge & File details */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${badge.bg}`}>
                            {badge.text}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(mat.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        {/* Title & Icon */}
                        <div className="flex items-start gap-3">
                          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-900 shrink-0 group-hover:scale-105 transition-transform">
                            {getIconForType(mat.type, mat.url)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-slate-900 line-clamp-2 leading-snug group-hover:text-indigo-900 transition-colors">
                              {mat.title}
                            </h4>
                            {mat.fileName && (
                              <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                📁 {mat.fileName}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {mat.description || 'Tài liệu hướng dẫn và ôn luyện dành cho học viên.'}
                        </p>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
                        <button
                          onClick={() => handleOpenAdminPreview(mat)}
                          className="flex-1 py-2.5 bg-indigo-900 hover:bg-indigo-850 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem bài học
                        </button>
                        <a
                          href={mat.url}
                          download={mat.fileName || `${mat.title}.${mat.type === 'docx' ? 'docx' : 'pdf'}`}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center transition-colors cursor-pointer"
                          title="Tải về máy"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FULL INTERACTIVE PREVIEW MODAL FOR WORD DOCX, PDF, VIDEO, AUDIO, IMAGES */}
        <DocumentReaderModal
          isOpen={!!adminPreviewItem}
          material={adminPreviewItem}
          onClose={() => {
            setAdminPreviewItem(null);
            setAdminPreviewType(null);
          }}
        />
      </div>
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const updatedSettings = {
        logoUrl,
        themeColor,
        slogan,
        teacherPhone,
        teacherEmail,
        geminiApiKey,
        teacherName,
        teacherZalo,
        teacherFacebook,
        teacherWebsite,
        teacherAddress,
        websiteName,
        primaryColor,
        secondaryColor,
        favicon,
        cefrThresholds: {
          a1Max: cefrA1Max,
          a2Max: cefrA2Max,
          b1Max: cefrB1Max,
          b2Max: cefrB2Max,
          c1Max: cefrC1Max
        }
      };
      await settingsService.updateSettings(updatedSettings);
      
      // Recalculate stats with the newly saved thresholds
      calculateDashboardStats(candidates, updatedSettings.cefrThresholds);
      
      showAlert('Thành công', 'Đã cập nhật cấu hình hệ thống thành công!', 'success');
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi lưu cấu hình.', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword.trim()) {
      showAlert('Lỗi', 'Vui lòng nhập mật khẩu hiện tại.', 'error');
      return;
    }
    if (!newPassword.trim()) {
      showAlert('Lỗi', 'Vui lòng nhập mật khẩu mới.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Lỗi', 'Mật khẩu xác nhận không khớp.', 'error');
      return;
    }
    setPasswordChangeLoading(true);
    try {
      const res = await authService.updateAdminPassword(oldPassword.trim(), newPassword.trim());
      if (!res.success) {
        throw new Error(res.error || 'Lỗi thay đổi mật khẩu.');
      }
      showAlert('Thành công', 'Đã thay đổi mật khẩu quản trị viên thành công!', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showAlert('Thất bại', err.message || 'Lỗi thay đổi mật khẩu.', 'error');
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const renderOverviewTab = () => {
    // 1. Calculate Daily Registrations for last 7 days
    const dailyStats: { [key: string]: number } = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    last7Days.forEach(day => {
      dailyStats[day] = 0;
    });

    candidates.forEach(c => {
      if (c.registeredAt) {
        const day = c.registeredAt.split('T')[0];
        if (dailyStats[day] !== undefined) {
          dailyStats[day]++;
        }
      }
    });

    // 2. Average Duration
    const completedCandidates = candidates.filter(c => c.submittedAt);
    const totalSecs = completedCandidates.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
    const avgMinutes = completedCandidates.length > 0 ? Math.round(totalSecs / completedCandidates.length / 60) : 0;

    // Max count for chart scaling
    const maxDailyCount = Math.max(...Object.values(dailyStats), 1);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-indigo-950 uppercase tracking-tight">Tổng quan hệ thống</h2>
          <p className="text-xs text-slate-500">Thống kê dữ liệu, lượt thi, trình độ năng lực và hoạt động của thí sinh.</p>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-900 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tổng số học sinh</p>
              <p className="text-2xl font-black text-indigo-950">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-700 shrink-0">
              <Clock className="w-6 h-6 text-amber-600 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Lượt đang làm bài</p>
              <p className="text-2xl font-black text-amber-600">{stats.active}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg text-green-700 shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Lượt đã hoàn thành</p>
              <p className="text-2xl font-black text-green-700">{stats.completed}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-rose-50 rounded-lg text-rose-700 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">T/g làm bài trung bình</p>
              <p className="text-2xl font-black text-rose-950">{avgMinutes} phút</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Candidate Statistics Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-900" /> Thống kê học sinh thi theo ngày
              </h3>
              <p className="text-xs text-slate-400 mb-4">Số lượng đăng ký thi trong 7 ngày gần nhất.</p>
            </div>

            {/* Pure CSS/Tailwind Chart */}
            <div className="flex items-end gap-3 h-56 pt-4 border-b border-l border-slate-100 px-2">
              {last7Days.map(day => {
                const count = dailyStats[day] || 0;
                const heightPct = Math.min((count / maxDailyCount) * 100, 100);
                // Format day as DD/MM
                const parts = day.split('-');
                const formattedDate = `${parts[2]}/${parts[1]}`;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <span className="text-[10px] font-bold text-indigo-900 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                      {count}
                    </span>
                    <div
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                      className="w-full bg-gradient-to-t from-indigo-900 to-indigo-600 rounded-t-lg transition-all duration-500 hover:from-amber-500 hover:to-amber-400 cursor-pointer shadow-xs relative"
                    >
                      {count > 0 && (
                        <div className="absolute inset-x-0 top-1 text-[9px] font-black text-white text-center sm:block hidden">
                          {count}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 shrink-0">
                      {formattedDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CEFR Level distribution */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Phân phối trình độ CEFR
            </h3>
            <p className="text-xs text-slate-400 mb-4">Xếp loại năng lực dựa trên điểm thi và ngưỡng cấu hình.</p>

            <div className="space-y-3.5">
              {[
                { label: 'A1', count: stats.bands.A1, range: `0% - ${cefrA1Max}%`, color: 'bg-slate-400' },
                { label: 'A2', count: stats.bands.A2, range: `${cefrA1Max + 1}% - ${cefrA2Max}%`, color: 'bg-emerald-500' },
                { label: 'B1', count: stats.bands.B1, range: `${cefrA2Max + 1}% - ${cefrB1Max}%`, color: 'bg-blue-500' },
                { label: 'B2', count: stats.bands.B2, range: `${cefrB1Max + 1}% - ${cefrB2Max}%`, color: 'bg-indigo-600' },
                { label: 'C1', count: stats.bands.C1, range: `${cefrB2Max + 1}% - ${cefrC1Max}%`, color: 'bg-violet-600' },
                { label: 'C2', count: stats.bands.C2 || 0, range: `${cefrC1Max + 1}% - 100%`, color: 'bg-amber-500' },
              ].map(level => {
                const bands = (stats.bands || {}) as Record<string, number>;
                const totalGraded = Object.values(bands).reduce((a, b) => a + b, 0);
                const pct = totalGraded > 0 ? Math.round(((level.count || 0) / totalGraded) * 100) : 0;
                return (
                  <div key={level.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${level.color}`} />
                        <span className="font-extrabold text-slate-800 text-sm">{level.label}</span>
                        <span className="text-[10px] text-slate-400">({level.range})</span>
                      </div>
                      <div className="font-bold text-slate-700">
                        {level.count} hs <span className="text-[10px] text-slate-400 font-mono">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${level.color} transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLogsTab = () => {
    // Collect and flatten logs from all candidates
    const allLogs: Array<{
      timestamp: string;
      candidateName: string;
      candidatePhone: string;
      action: string;
      details: string;
    }> = [];

    candidates.forEach(c => {
      if (c.logs && Array.isArray(c.logs)) {
        c.logs.forEach((log: any) => {
          allLogs.push({
            timestamp: log.timestamp || c.registeredAt || new Date().toISOString(),
            candidateName: c.fullName || 'Thí sinh',
            candidatePhone: c.phone || '',
            action: log.action || 'Thao tác',
            details: log.details || ''
          });
        });
      }
    });

    // Sort descending by timestamp
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-indigo-950 uppercase tracking-tight">Nhật ký hoạt động</h2>
          <p className="text-xs text-slate-500">Ghi nhận chi tiết tất cả hành động chuyển tab, nộp bài, rời phòng thi của thí sinh theo thời gian thực.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lịch sử sự kiện ({allLogs.length})</h3>
          </div>

          <div className="overflow-x-auto">
            {allLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Chưa ghi nhận hoạt động nào từ hệ thống.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Thí sinh</th>
                    <th className="py-3 px-4">Sự kiện</th>
                    <th className="py-3 px-4">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {allLogs.slice(0, 100).map((log, idx) => {
                    const timeStr = new Date(log.timestamp).toLocaleString('vi-VN');
                    let badgeColor = 'bg-slate-100 text-slate-700';
                    if (log.action.toLowerCase().includes('cheat') || log.action.toLowerCase().includes('switch') || log.action.toLowerCase().includes('exit')) {
                      badgeColor = 'bg-rose-100 text-rose-700 border border-rose-200 font-extrabold';
                    } else if (log.action.toLowerCase().includes('submit') || log.action.toLowerCase().includes('finish')) {
                      badgeColor = 'bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold';
                    } else if (log.action.toLowerCase().includes('start')) {
                      badgeColor = 'bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold';
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{timeStr}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{log.candidateName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{log.candidatePhone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide select-none ${badgeColor}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {allLogs.length > 100 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400 italic">
              Hiển thị tối đa 100 nhật ký hoạt động gần nhất.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettingsManager = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-indigo-950 uppercase tracking-tight">Cấu hình hệ thống</h2>
          <p className="text-xs text-slate-500">Tùy chỉnh giao diện, thông tin giáo viên, API Key quét đề bằng AI và mật khẩu quản trị viên.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Config Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-900" /> Cấu hình thương hiệu & Liên hệ
            </h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Tên website</label>
                  <input
                    type="text"
                    placeholder="English Placement"
                    value={websiteName}
                    onChange={(e) => setWebsiteName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Khẩu hiệu (Slogan)</label>
                  <input
                    type="text"
                    placeholder="Your English Journey Starts Here."
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Logo URL</label>
                  <input
                    type="text"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Favicon URL</label>
                  <input
                    type="text"
                    placeholder="https://example.com/favicon.ico"
                    value={favicon}
                    onChange={(e) => setFavicon(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Màu chính (Primary Color)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-8 p-0 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Màu phụ (Secondary Color)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-8 p-0 border border-slate-200 rounded-lg cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Tên Giáo viên</label>
                  <input
                    type="text"
                    placeholder="Teacher Anna"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">SĐT Giáo viên</label>
                  <input
                    type="text"
                    placeholder="0987.654.321"
                    value={teacherPhone}
                    onChange={(e) => setTeacherPhone(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Email Giáo viên</label>
                  <input
                    type="email"
                    placeholder="teacher@english.edu.vn"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Số Zalo hỗ trợ</label>
                  <input
                    type="text"
                    placeholder="0987.654.321"
                    value={teacherZalo}
                    onChange={(e) => setTeacherZalo(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Facebook URL</label>
                  <input
                    type="text"
                    placeholder="https://facebook.com/teacher.anna"
                    value={teacherFacebook}
                    onChange={(e) => setTeacherFacebook(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Website URL</label>
                  <input
                    type="text"
                    placeholder="https://placement.edu.vn"
                    value={teacherWebsite}
                    onChange={(e) => setTeacherWebsite(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">Địa chỉ liên hệ</label>
                <input
                  type="text"
                  placeholder="123 Đường Láng, Đống Đa, Hà Nội"
                  value={teacherAddress}
                  onChange={(e) => setTeacherAddress(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  GEMINI_API_KEY <span className="text-[9px] text-indigo-700 font-bold lowercase">(Mã quét đề AI)</span>
                </label>
                <input
                  type="password"
                  placeholder="AI Gemini API Key"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900 text-xs transition-all font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={settingsLoading}
                className="bg-indigo-900 hover:bg-indigo-850 disabled:bg-slate-300 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-md transition-colors cursor-pointer mt-2 w-full"
              >
                {settingsLoading ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            {/* CEFR Range Slider Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> Ngưỡng phân loại trình độ CEFR
              </h3>
              <p className="text-xs text-slate-500">Điều chỉnh mức điểm tối đa (percentage) để AI tự động xếp loại năng lực học sinh.</p>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Ngưỡng A1 (Tối đa)</span>
                    <span className="text-indigo-900">{cefrA1Max}% (Khoảng: 0% - {cefrA1Max}%)</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={cefrA1Max}
                    onChange={(e) => setCefrA1Max(Number(e.target.value))}
                    className="w-full accent-indigo-900 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Ngưỡng A2 (Tối đa)</span>
                    <span className="text-indigo-900">{cefrA2Max}% (Khoảng: {cefrA1Max + 1}% - {cefrA2Max}%)</span>
                  </div>
                  <input
                    type="range"
                    min={cefrA1Max + 1}
                    max="100"
                    value={cefrA2Max}
                    onChange={(e) => setCefrA2Max(Number(e.target.value))}
                    className="w-full accent-indigo-900 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Ngưỡng B1 (Tối đa)</span>
                    <span className="text-indigo-900">{cefrB1Max}% (Khoảng: {cefrA2Max + 1}% - {cefrB1Max}%)</span>
                  </div>
                  <input
                    type="range"
                    min={cefrA2Max + 1}
                    max="100"
                    value={cefrB1Max}
                    onChange={(e) => setCefrB1Max(Number(e.target.value))}
                    className="w-full accent-indigo-900 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Ngưỡng B2 (Tối đa)</span>
                    <span className="text-indigo-900">{cefrB2Max}% (Khoảng: {cefrB1Max + 1}% - {cefrB2Max}%)</span>
                  </div>
                  <input
                    type="range"
                    min={cefrB1Max + 1}
                    max="100"
                    value={cefrB2Max}
                    onChange={(e) => setCefrB2Max(Number(e.target.value))}
                    className="w-full accent-indigo-900 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Ngưỡng C1 (Tối đa)</span>
                    <span className="text-indigo-900">{cefrC1Max}% (Khoảng: {cefrB2Max + 1}% - {cefrC1Max}%)</span>
                  </div>
                  <input
                    type="range"
                    min={cefrB2Max + 1}
                    max="100"
                    value={cefrC1Max}
                    onChange={(e) => setCefrC1Max(Number(e.target.value))}
                    className="w-full accent-indigo-900 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-500 font-medium">
                  💡 Học sinh đạt kết quả trên <strong className="text-amber-600">{cefrC1Max}%</strong> sẽ tự động được xếp loại trình độ cao nhất <strong className="text-amber-600 font-extrabold">C2</strong>.
                </div>
              </div>
            </div>

            {/* Change Password Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-600" /> Đổi mật khẩu Admin
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu cũ để xác thực"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Mật khẩu mới</label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Xác nhận mật khẩu</label>
                  <input
                    type="password"
                    required
                    placeholder="Xác nhận mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordChangeLoading}
                  className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-md transition-colors cursor-pointer mt-2 w-full"
                >
                  {passwordChangeLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderExamsManager = () => {
    const handleLoadJsonTemplate = () => {
      const template = {
        "listeningPart1": [
          {
            "id": "l1_1",
            "type": "mcq",
            "text": "What is the speaker's main occupation?",
            "options": ["Teacher", "Engineer", "Doctor"],
            "answer": "B"
          }
        ],
        "listeningPart2": [
          {
            "id": "l2_1",
            "type": "blank",
            "text": "The reservation was made for the month of ____.",
            "answer": "September"
          }
        ],
        "speakingReadAloud": {
          "text": "Regular practice is key to mastering a new language. Speak as often as possible and don't be afraid of making mistakes.",
          "wordCount": 20
        },
        "speakingQuestions": [
          { "id": "sp_1", "text": "What is your favorite subject in school and why?" },
          { "id": "sp_2", "text": "Do you prefer studying alone or in a group?" },
          { "id": "sp_3", "text": "Why is learning English important for your future career?" }
        ],
        "grammar": [
          {
            "id": "g_1",
            "type": "mcq",
            "text": "She _______ to school every day.",
            "options": ["go", "goes", "going", "gone"],
            "answer": "B"
          }
        ],
        "vocabulary": [
          {
            "id": "v_1",
            "type": "mcq",
            "text": "The synonym of 'happy' is _______.",
            "options": ["sad", "joyful", "angry", "tired"],
            "answer": "B"
          }
        ],
        "readingPassage": {
          "title": "The Rise of Technology",
          "text": "Technology has evolved rapidly over the past few decades. It has transformed the way we communicate, work, and learn. Today, smartphones and computers are essential tools in daily life, enabling instant connectivity across the globe.",
          "questionsPartA": [
            {
              "id": "r_1",
              "type": "mcq",
              "text": "What has transformed the way we communicate and work?",
              "options": ["Nature", "Technology", "Agriculture", "History"],
              "answer": "B"
            }
          ],
          "questionsPartB": [
            {
              "id": "r_2",
              "type": "mcq",
              "options": ["True", "False", "Not Given"],
              "text": "Technology has remained unchanged over the last few decades.",
              "answer": "False"
            }
          ]
        },
        "writingQuestions": [
          {
            "id": "w_1",
            "text": "Dịch sang tiếng Anh: 'Tôi thích học tiếng Anh cùng bạn bè.'",
            "vietnamese": "Tôi thích học tiếng Anh cùng bạn bè."
          }
        ]
      };
      setExamQuestionsJson(JSON.stringify(template, null, 2));
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-indigo-950 uppercase tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-900" /> QUẢN LÝ ĐỀ THI & PHÒNG THI (EXAM MANAGEMENT BOARD)
            </h2>
            <p className="text-xs text-slate-500">Giáo viên tự tạo nhiều đề thi, chỉnh sửa thời gian làm bài, tải file nghe Audio, và sử dụng AI thông minh quét ảnh/file đề để tạo câu hỏi tự động.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Exams List (4 cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-fit space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                <span>DANH SÁCH ĐỀ THI ({exams.length})</span>
              </h3>
              {exams.filter(e => e.id !== 'default-exam').length > 0 && (
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      exams.filter(e => e.id !== 'default-exam').length > 0 &&
                      exams.filter(e => e.id !== 'default-exam').every(e => selectedExamIds.includes(e.id))
                    }
                    onChange={handleSelectAllExams}
                    className="w-4 h-4 rounded text-indigo-900 focus:ring-indigo-900 border-slate-300 cursor-pointer"
                  />
                  <span>Chọn tất cả</span>
                </label>
              )}
            </div>

            {/* Bulk Action Bar for Exams */}
            {selectedExamIds.length > 0 && (
              <div className="flex flex-col gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Đã chọn {selectedExamIds.length} đề thi
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedExamIds([])}
                    className="text-[11px] text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isBulkDeletingExams}
                  onClick={handleBulkDeleteExams}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm text-xs"
                >
                  {isBulkDeletingExams ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa {selectedExamIds.length} đề thi đã chọn
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Create New Button */}
            <button
              onClick={() => {
                setEditingExamId(null);
                setExamTitle('');
                setExamDesc('');
                setExamDuration(45);
                setExamAudio1Url('');
                setExamAudio2Url('');
                setExamQuestionsJson('');
                setExamActiveSubTab('builder');
              }}
              className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                !editingExamId 
                  ? 'bg-indigo-950 text-white ring-2 ring-indigo-900 shadow-md' 
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
              }`}
            >
              <Plus className="w-4 h-4" /> TẠO ĐỀ THI MỚI THỦ CÔNG
            </button>

            {exams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText className="w-12 h-12 mb-2 stroke-1" />
                <p className="text-xs font-semibold">Chưa có đề thi nào trong hệ thống.</p>
                <p className="text-[10px] text-slate-400">Vui lòng tạo đề thi mới ở biểu mẫu bên phải.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                {exams.map((ex) => {
                  const isSelected = editingExamId === ex.id;
                  const isChecked = selectedExamIds.includes(ex.id);
                  const qCount = 
                    (ex.questions?.listeningPart1?.length || 0) +
                    (ex.questions?.listeningPart2?.length || 0) +
                    (ex.questions?.grammar?.length || 0) +
                    (ex.questions?.vocabulary?.length || 0) +
                    (ex.questions?.readingPassage?.questionsPartA?.length || 0) +
                    (ex.questions?.readingPassage?.questionsPartB?.length || 0) +
                    (ex.questions?.writingQuestions?.length || 0) + 
                    (ex.questions?.speakingQuestions?.length || 0 ? 4 : 0);

                  const candCount = candidates.filter(c => c.examId === ex.id).length;

                  return (
                    <div 
                      key={ex.id} 
                      onClick={() => handleSelectEditExam(ex)}
                      className={`p-4 border rounded-xl transition-all cursor-pointer relative flex gap-3 items-start ${
                        isChecked
                          ? 'border-rose-400 bg-rose-50/40 ring-1 ring-rose-300'
                          : isSelected 
                            ? 'border-indigo-950 bg-indigo-50/40 ring-1 ring-indigo-950 shadow-sm' 
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      {ex.id !== 'default-exam' && (
                        <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectExam(ex.id)}
                            className="w-4 h-4 rounded text-indigo-900 focus:ring-indigo-900 border-slate-300 cursor-pointer"
                            title="Chọn đề thi này để xóa"
                          />
                        </div>
                      )}

                      <div className="pr-10 flex-grow min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{ex.title}</h4>
                          {isSelected && (
                            <span className="text-[9px] bg-indigo-900 text-white font-bold px-1.5 py-0.2 rounded">Đang chọn</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2">{ex.description || 'Không có mô tả.'}</p>
                        
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold rounded-md flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-500" /> {ex.durationMinutes}p
                          </span>
                          <span className="text-[9px] px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-100 font-mono font-bold rounded-md">
                            {qCount} câu hỏi
                          </span>
                          <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-mono font-bold rounded-md">
                            {candCount} thí sinh
                          </span>
                        </div>
                      </div>

                      <div className="absolute top-4 right-3 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSelectEditExam(ex)}
                          className="p-1.5 bg-white border border-slate-200 text-indigo-900 hover:bg-indigo-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                          title="Chỉnh sửa đề thi"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        
                        {ex.id !== 'default-exam' && (
                          <button
                            onClick={() => handleAdminDeleteExam(ex.id, ex.title)}
                            className="p-1.5 bg-white border border-red-200 text-rose-600 hover:bg-rose-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                            title="Xóa đề thi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Tabbed interface for participants or edit settings */}
          <div className="lg:col-span-8 space-y-6">
            {editingExamId ? (
              <>
                {/* Active Exam Header info with sub-tabs */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-950 text-white font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">ĐANG CHỌN ĐỀ THI</span>
                        <span className="text-[10px] font-mono text-slate-400">ID: {editingExamId}</span>
                      </div>
                      <h4 className="text-base font-black text-indigo-950 uppercase tracking-wide mt-1">{examTitle}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{examDesc || 'Không có mô tả.'}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingExamId(null);
                        setExamTitle('');
                        setExamDesc('');
                        setExamDuration(45);
                        setExamAudio1Url('');
                        setExamAudio2Url('');
                        setExamQuestionsJson('');
                        setExamActiveSubTab('builder');
                      }}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      Đóng / Tạo đề mới
                    </button>
                  </div>

                  {/* Sub-tabs selector */}
                  <div className="flex border-b border-slate-150 select-none">
                    <button
                      onClick={() => setExamActiveSubTab('builder')}
                      className={`flex-1 py-2.5 font-bold text-xs text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        examActiveSubTab === 'builder'
                          ? 'border-indigo-900 text-indigo-950 bg-indigo-50/30'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Sửa Đề Thi Thủ Công (Kỹ năng & Dạng bài)
                    </button>
                    <button
                      onClick={() => setExamActiveSubTab('candidates')}
                      className={`flex-1 py-2.5 font-bold text-xs text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        examActiveSubTab === 'candidates'
                          ? 'border-indigo-900 text-indigo-950 bg-indigo-50/30'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" /> Thí sinh tham gia ({candidates.filter(c => c.examId === editingExamId).length})
                    </button>
                    <button
                      onClick={() => setExamActiveSubTab('aiscan')}
                      className={`flex-1 py-2.5 font-bold text-xs text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        examActiveSubTab === 'aiscan'
                          ? 'border-indigo-900 text-indigo-950 bg-indigo-50/30'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quét Đề Bằng AI
                    </button>
                  </div>
                </div>

                {examActiveSubTab === 'candidates' ? (
                  /* SUBTAB 1: CANDIDATES LIST FOR SELECTED EXAM */
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                        Danh sách học sinh tham gia kỳ thi này
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        Exam ID: {editingExamId}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      {candidates.filter(c => c.examId === editingExamId).length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          Chưa có học sinh nào tham gia hoặc nộp bài cho đề thi này.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse text-[11px] font-medium text-slate-700">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-3">Học sinh</th>
                              <th className="py-2.5 px-3 text-center">Tab Switches</th>
                              <th className="py-2.5 px-3 text-center">Listening</th>
                              <th className="py-2.5 px-3 text-center">Grammar</th>
                              <th className="py-2.5 px-3 text-center">Vocab</th>
                              <th className="py-2.5 px-3 text-center">Reading</th>
                              <th className="py-2.5 px-3 text-center">Writing</th>
                              <th className="py-2.5 px-3 text-center">Tổng điểm</th>
                              <th className="py-2.5 px-3 text-right">Chi tiết</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {candidates.filter(c => c.examId === editingExamId).map((c) => {
                              const isCompleted = c.submittedAt !== null;
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-3">
                                    <span className="font-bold text-slate-900 block text-xs">{c.fullName}</span>
                                    <span className="text-[9px] text-indigo-950 font-mono font-bold block">{c.phone}</span>
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold">
                                    {countTabSwitches(c) > 0 ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-black animate-pulse">
                                        GIÁN LẬN ({countTabSwitches(c)})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[9px]">Không có</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center font-mono font-bold">{isCompleted ? `${c.scores?.listening}/17` : '-'}</td>
                                  <td className="py-3 px-3 text-center font-mono font-bold">{isCompleted ? `${c.scores?.grammar}/30` : '-'}</td>
                                  <td className="py-3 px-3 text-center font-mono font-bold">{isCompleted ? `${c.scores?.vocabulary}/22` : '-'}</td>
                                  <td className="py-3 px-3 text-center font-mono font-bold">{isCompleted ? `${c.scores?.reading}/6` : '-'}</td>
                                  <td className="py-3 px-3 text-center font-mono font-bold text-purple-900 bg-purple-50/20">{isCompleted ? `${c.writingScore}/10` : '-'}</td>
                                  <td className="py-3 px-3 text-center">
                                    {isCompleted ? (
                                      <div className="space-y-0.5">
                                        <strong className="text-indigo-950 text-xs font-black font-mono bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded inline-block">{c.scores?.total}</strong>
                                      </div>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold uppercase animate-pulse">Làm dở...</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-right">
                                    <div className="flex justify-end items-center gap-1.5">
                                      <button
                                        onClick={() => handleViewDetail(c.id)}
                                        className="bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-900 font-bold py-1 px-2 rounded-lg hover:shadow-xs transition-colors cursor-pointer text-[10px]"
                                      >
                                        Chi tiết
                                      </button>
                                      <button
                                        onClick={() => handleResetCandidate(c.id, c.fullName)}
                                        title="Reset lượt làm bài"
                                        className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg hover:shadow-xs transition-colors cursor-pointer"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCandidate(c.id, c.fullName)}
                                        title="Xóa vĩnh viễn thí sinh"
                                        className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-250 rounded-lg hover:shadow-xs transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ) : examActiveSubTab === 'aiscan' ? (
                  /* SUBTAB 2: AI SCANNER */
                  <div className="bg-indigo-950 text-white rounded-2xl p-6 shadow-md border border-indigo-900 relative overflow-hidden space-y-4">
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-900/40 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                      <h4 className="text-sm font-black uppercase tracking-wide text-amber-400">QUÉT ĐỀ TỰ ĐỘNG BẰNG AI (GEMINI AI EXAM SCANNER)</h4>
                    </div>
                    <p className="text-xs text-indigo-200 leading-relaxed">
                      Tải lên một file ảnh đề thi hoặc file PDF. Trí tuệ nhân tạo Gemini AI sẽ tự động phân tích và bóc tách dữ liệu câu hỏi rồi điền tự động vào cấu trúc đề thi.
                    </p>

                    <div className="relative border-2 border-dashed border-indigo-700/60 hover:border-indigo-500 rounded-xl p-8 bg-indigo-900/20 text-center transition-all">
                      {scanLoading ? (
                        <div className="py-6 flex flex-col items-center justify-center space-y-3">
                          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs font-bold text-amber-300">AI đang quét và phân tích đề thi... Vui lòng chờ 10-20 giây...</p>
                        </div>
                      ) : (
                        <label className="cursor-pointer block py-4">
                          <input 
                            type="file" 
                            accept="image/*,application/pdf" 
                            className="hidden" 
                            onChange={handleAIScanExam}
                          />
                          <Sparkles className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                          <span className="text-sm font-bold text-indigo-100 block">Kéo thả hoặc click chọn file Đề thi (Ảnh hoặc PDF)</span>
                          <span className="text-xs text-indigo-300 block mt-1">Hỗ trợ .png, .jpg, .jpeg, .pdf (Quét bằng Gemini AI)</span>
                        </label>
                      )}
                    </div>

                    {scanError && (
                      <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                        Lỗi quét: {scanError}
                      </div>
                    )}
                  </div>
                ) : (
                  /* SUBTAB 3: MANUAL EXAM BUILDER FOR SELECTED EXAM */
                  <ManualExamBuilder
                    key={editingExamId}
                    initialExam={{
                      id: editingExamId,
                      title: examTitle,
                      description: examDesc,
                      durationMinutes: examDuration,
                      audio1Url: examAudio1Url,
                      audio2Url: examAudio2Url,
                      questions: (() => {
                        try {
                          return examQuestionsJson ? JSON.parse(examQuestionsJson) : (exams.find(e => e.id === editingExamId)?.questions || {});
                        } catch (e) {
                          return exams.find(e => e.id === editingExamId)?.questions || {};
                        }
                      })()
                    }}
                    onSave={handleSaveExamFromBuilder}
                    onCancel={() => {
                      setEditingExamId(null);
                      setExamTitle('');
                      setExamDesc('');
                      setExamDuration(45);
                      setExamAudio1Url('');
                      setExamAudio2Url('');
                      setExamQuestionsJson('');
                      setExamActiveSubTab('builder');
                    }}
                    isLoading={examLoading}
                  />
                )}
              </>
            ) : (
              /* NO EXAM SELECTED -> RENDER MANUAL EXAM BUILDER TO CREATE NEW EXAM DIRECTLY */
              <div className="space-y-6">
                {/* AI quick scan option */}
                <div className="bg-gradient-to-r from-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-indigo-900 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0 border border-amber-400/30">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">Tùy chọn: Quét Đề Bằng AI Gemini</h4>
                      <p className="text-[11px] text-indigo-200">Bạn cũng có thể tải ảnh hoặc PDF đề thi có sẵn để AI tự động trích xuất các câu hỏi.</p>
                    </div>
                  </div>
                  <label className="bg-indigo-800 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl shadow cursor-pointer transition-all shrink-0 flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải file quét đề AI</span>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      className="hidden" 
                      onChange={handleAIScanExam}
                    />
                  </label>
                </div>

                {/* Manual Exam Builder Component */}
                <ManualExamBuilder
                  key="new-exam-builder"
                  initialExam={null}
                  onSave={handleSaveExamFromBuilder}
                  isLoading={examLoading}
                />
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  return (
    <div id="admin-dashboard-wrapper" className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Admin Navigation Header */}
      <nav className="bg-indigo-950 text-white py-4 px-6 shadow sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-amber-400 text-indigo-950 font-black text-xs px-2.5 py-1 rounded-md">ADMIN</span>
            <h1 className="text-lg font-bold tracking-tight">Placement Test Administration</h1>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <button
              onClick={onBackToTest}
              className="text-xs bg-indigo-900 hover:bg-indigo-800 text-slate-200 font-bold py-2 px-4 rounded-lg border border-indigo-800 transition-colors cursor-pointer"
            >
              Xem trang thi
            </button>
            <button
              onClick={handleLogout}
              className="text-xs bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      {/* Secondary Sub-navigation Tab Bar */}
      <div className="bg-white border-b border-slate-200 py-3 px-6 select-none shadow-xs shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-1 sm:pb-0">
            <button
              onClick={() => {
                setAdminTab('exams');
                setViewingDetailId(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                adminTab === 'exams'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Kỳ thi ({exams.length})
            </button>

            <button
              onClick={() => {
                setAdminTab('candidates');
                setViewingDetailId(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                adminTab === 'candidates'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Thí sinh ({stats.total})
            </button>

            <button
              onClick={() => {
                setAdminTab('materials');
                setViewingDetailId(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                adminTab === 'materials'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Tài liệu ({materials.length})
            </button>

            <button
              onClick={() => {
                setAdminTab('settings');
                setViewingDetailId(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                adminTab === 'settings'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Setting
            </button>

            <button
              onClick={() => {
                setAdminTab('logs');
                setViewingDetailId(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                adminTab === 'logs'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Nhật ký
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-mono self-end sm:self-auto">
            Role: Head Teacher / Admin
          </p>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex-grow space-y-8">
        
        {adminTab === 'candidates' ? (
          !viewingDetailId ? (
          <>
            {/* SIMPLIFIED REGISTERED CANDIDATES ROSTER */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              
              {/* Header Filters & Searches */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-5 border-b border-slate-100 gap-4 mb-5">
                <div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-950" />
                    Quản lý thí sinh & Bài làm theo kỳ thi
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">Lọc danh sách thí sinh theo từng kỳ thi, xem chi tiết bài làm thực tế, chấm điểm và reset lượt thi.</p>
                </div>

                <div className="w-full lg:w-auto flex flex-wrap items-center gap-3">
                  {/* Exam Selector Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Kỳ thi:</label>
                    <select
                      value={selectedExamFilter}
                      onChange={(e) => setSelectedExamFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold text-indigo-950 focus:ring-1 focus:ring-indigo-900 focus:outline-none max-w-[220px] sm:max-w-[280px] truncate"
                    >
                      <option value="all">Tất cả kỳ thi ({candidates.length} thí sinh)</option>
                      {exams.map((ex) => {
                        const count = candidates.filter((c) => (c.examId || 'default-exam') === ex.id).length;
                        return (
                          <option key={ex.id} value={ex.id}>
                            {ex.title} ({count} thí sinh)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Status filter pills */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        filterType === 'all' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => setFilterType('completed')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        filterType === 'completed' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Đã nộp bài
                    </button>
                    <button
                      onClick={() => setFilterType('active')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        filterType === 'active' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Đang thi
                    </button>
                  </div>

                  {/* Search box */}
                  <div className="relative flex-grow sm:w-56">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên, SĐT, ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-900 focus:outline-none"
                    />
                  </div>

                  {/* Export button */}
                  <button
                    onClick={exportToCSV}
                    disabled={candidates.length === 0}
                    className="flex items-center gap-1.5 bg-indigo-900 hover:bg-indigo-850 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold px-4 py-2 rounded-xl border border-indigo-950 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                </div>
              </div>

              {/* Bulk Action Bar for Candidates */}
              {selectedCandidateIds.length > 0 && (
                <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs mb-4 animate-fadeIn">
                  <span className="font-bold text-rose-900 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    Đã chọn {selectedCandidateIds.length} thí sinh
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCandidateIds([])}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors text-xs"
                    >
                      Bỏ chọn
                    </button>
                    <button
                      type="button"
                      disabled={isBulkDeletingCandidates}
                      onClick={handleBulkDeleteCandidates}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm text-xs"
                    >
                      {isBulkDeletingCandidates ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                          Đang xóa...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa {selectedCandidateIds.length} thí sinh đã chọn
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Candidates Table List */}
              <div className="overflow-x-auto select-none">
                {filteredCandidates.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm italic">
                    Chưa có thí sinh nào đăng ký cho kỳ thi này hoặc khớp với điều kiện tìm kiếm.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredCandidates.length > 0 &&
                              filteredCandidates.every((c) => selectedCandidateIds.includes(c.id))
                            }
                            onChange={handleSelectAllCandidates}
                            className="w-4 h-4 rounded text-indigo-900 focus:ring-indigo-900 border-slate-300 cursor-pointer"
                            title="Chọn tất cả thí sinh"
                          />
                        </th>
                        <th className="py-3 px-4">Thí sinh</th>
                        <th className="py-3 px-4">Số điện thoại</th>
                        <th className="py-3 px-4">Kỳ thi tham gia</th>
                        <th className="py-3 px-4">Trạng thái / Điểm số</th>
                        <th className="py-3 px-4 text-center">Khóa tài khoản</th>
                        <th className="py-3 px-4 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {filteredCandidates.map((c) => {
                        const candExam = exams.find(e => e.id === (c.examId || 'default-exam'));
                        const isSubmitted = !!c.submittedAt;
                        const isChecked = selectedCandidateIds.includes(c.id);

                        return (
                          <tr 
                            key={c.id} 
                            className={`transition-colors ${
                              isChecked 
                                ? 'bg-rose-50/50 hover:bg-rose-50' 
                                : 'hover:bg-slate-50/50'
                            }`}
                          >
                            <td className="py-4 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectCandidate(c.id)}
                                className="w-4 h-4 rounded text-indigo-900 focus:ring-indigo-900 border-slate-300 cursor-pointer"
                                title="Chọn thí sinh này để xóa"
                              />
                            </td>
                            <td className="py-4 px-4">
                              <span className="font-bold text-slate-900 text-sm block">{c.fullName}</span>
                              <span className="text-[10px] text-slate-400 font-mono tracking-wide">ID: {c.id}</span>
                            </td>
                            <td className="py-4 px-4 font-mono font-bold text-indigo-950">{c.phone}</td>
                            <td className="py-4 px-4">
                              <span className="font-bold text-indigo-950 block text-xs line-clamp-1">
                                {candExam?.title || 'Đề thi Placement Test'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">Mã: {c.examId || 'default-exam'}</span>
                            </td>
                            <td className="py-4 px-4">
                              {isSubmitted ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                      <CheckCircle className="w-3 h-3 text-emerald-600" /> ĐÃ NỘP BÀI
                                    </span>
                                    {c.scores && (
                                      <span className="font-black text-xs font-mono text-indigo-950">
                                        {c.scores.total}đ ({c.scores.percentage}%)
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {new Date(c.submittedAt!).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                                    <Clock className="w-3 h-3 text-amber-600" /> ĐANG LÀM / CHƯA NỘP
                                  </span>
                                  {c.startedAt && (
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                      Bắt đầu: {new Date(c.startedAt).toLocaleTimeString('vi-VN')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              {c.isLocked ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <Lock className="w-3 h-3 text-rose-700" /> ĐÃ KHÓA
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-150">
                                  <Unlock className="w-3 h-3 text-emerald-600" /> HOẠT ĐỘNG
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  onClick={() => handleViewDetail(c.id)}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg hover:shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
                                  title="Xem chi tiết kết quả và bài làm"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Chi tiết
                                </button>
                                <button
                                  onClick={() => handleResetCandidate(c.id, c.fullName)}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-250 hover:bg-amber-100 rounded-lg hover:shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
                                  title="Reset lượt thi dở (Cho phép thi lại)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Reset
                                </button>
                                <button
                                  onClick={() => handleToggleLockPhone(c.phone, !!c.isLocked)}
                                  disabled={lockLoadingPhone === c.phone}
                                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                    c.isLocked 
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100' 
                                      : 'bg-amber-50 text-amber-700 border-amber-250 hover:bg-amber-100'
                                  }`}
                                  title={c.isLocked ? "Mở khóa thí sinh" : "Khóa thí sinh"}
                                >
                                  {c.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                  {c.isLocked ? "Mở khóa" : "Khóa"}
                                </button>
                                <button
                                  onClick={() => handleDeleteCandidate(c.id, c.fullName)}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg hover:shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
                                  title="Xóa vĩnh viễn thí sinh này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          </>
        ) : (
          /* ================= CANDIDATE DETAILS VIEW PANEL ================= */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 space-y-8">
            
            {/* Header section with back button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-150 pb-5 gap-3">
              <button
                onClick={handleCloseDetail}
                className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-bold text-sm bg-slate-100 px-4 py-2 rounded-xl transition-colors cursor-pointer select-none"
              >
                <ChevronLeft className="w-4 h-4" /> Quay lại danh sách
              </button>
              
              {!selectedCandidate ? (
                <div className="animate-pulse text-indigo-900 font-bold text-sm">Đang tải chi tiết thí sinh...</div>
              ) : (
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 text-right">
                  <div className="flex gap-2 mr-0 sm:mr-4">
                    <button
                      onClick={() => handleResetCandidate(selectedCandidate.id, selectedCandidate.fullName)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-bold text-xs cursor-pointer shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset Bài Thi
                    </button>
                    <button
                      onClick={() => handleDeleteCandidate(selectedCandidate.id, selectedCandidate.fullName)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa Thí Sinh
                    </button>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">{selectedCandidate.fullName}</h2>
                    <p className="text-sm font-mono text-slate-500 font-bold">Số điện thoại: {selectedCandidate.phone} | ID: {selectedCandidate.id}</p>
                  </div>
                </div>
              )}
            </div>

            {selectedCandidate && (() => {
              const candidateExam = exams.find(e => e.id === (selectedCandidate.examId || 'default-exam')) || (selectedCandidate.examId === 'default-exam' || !selectedCandidate.examId ? exams.find(e => e.id === 'default-exam') : null);
              
              // Only fallback to hardcoded default questions if candidate explicitly took default-exam and exam object was not loaded from DB yet
              const isDefaultExamFallback = !candidateExam && (!selectedCandidate.examId || selectedCandidate.examId === 'default-exam');
              const qData = candidateExam?.questions || (isDefaultExamFallback ? {
                listeningPart1: LISTENING_PART_1,
                listeningPart2: LISTENING_PART_2,
                speakingReadAloud: SPEAKING_READ_ALOUD,
                speakingQuestions: SPEAKING_QUESTIONS,
                grammar: GRAMMAR_QUESTIONS,
                vocabulary: VOCABULARY_QUESTIONS,
                readingPassage: READING_PASSAGE,
                writingQuestions: WRITING_QUESTIONS,
              } : {});

              const speakingReadAloudText = (qData.speakingReadAloud?.text || '').trim();
              const speakingQuestionsList = Array.isArray(qData.speakingQuestions) ? qData.speakingQuestions.filter((q: any) => q && (q.text || q.prompt || q.question)) : [];
              const hasSpeaking = Boolean(speakingReadAloudText || speakingQuestionsList.length > 0);

              const writingQuestionsList = Array.isArray(qData.writingQuestions) ? qData.writingQuestions.filter((q: any) => q && (q.vietnamese || q.prompt || q.text)) : [];
              const hasWriting = writingQuestionsList.length > 0;

              const listeningP1List = Array.isArray(qData.listeningPart1) ? qData.listeningPart1 : [];
              const listeningP2List = Array.isArray(qData.listeningPart2) ? qData.listeningPart2 : [];
              const totalListeningCount = listeningP1List.length + listeningP2List.length;
              const hasListening = totalListeningCount > 0;

              const grammarQuestionsList = Array.isArray(qData.grammar) ? qData.grammar : [];
              const totalGrammarCount = grammarQuestionsList.length;
              const hasGrammar = totalGrammarCount > 0;

              const vocabQuestionsList = Array.isArray(qData.vocabulary) ? qData.vocabulary : [];
              const totalVocabCount = vocabQuestionsList.length;
              const hasVocabulary = totalVocabCount > 0;

              const readingPassageData = qData.readingPassage || null;
              const readingPartAList = Array.isArray(readingPassageData?.questionsPartA) ? readingPassageData.questionsPartA : [];
              const readingPartBList = Array.isArray(readingPassageData?.questionsPartB) ? readingPassageData.questionsPartB : [];
              const totalReadingCount = readingPartAList.length + readingPartBList.length;
              const hasReading = totalReadingCount > 0 || Boolean(readingPassageData?.text?.trim());

              const totalAutoGradedCount = totalListeningCount + totalGrammarCount + totalVocabCount + totalReadingCount;
              const hasAutoGradedSections = hasListening || hasGrammar || hasVocabulary || totalReadingCount > 0;

              // Compute stats for each section using candidateService helpers
              const getSectionStats = (sectionKey: string, qList: any[]) => {
                let correct = 0;
                let skipped = 0;
                let incorrect = 0;
                qList.forEach((q: any) => {
                  const ans = getCandidateAnswer(selectedCandidate, sectionKey, q.id);
                  const isSkipped = isAnswerSkipped(ans, selectedCandidate, q.id);
                  if (isSkipped) {
                    skipped++;
                  } else if (isAnswerCorrect(ans, q)) {
                    correct++;
                  } else {
                    incorrect++;
                  }
                });
                return { correct, skipped, incorrect, total: qList.length };
              };

              const l1Stats = getSectionStats('listeningPart1', listeningP1List);
              const l2Stats = getSectionStats('listeningPart2', listeningP2List);
              const listeningStats = {
                correct: l1Stats.correct + l2Stats.correct,
                skipped: l1Stats.skipped + l2Stats.skipped,
                incorrect: l1Stats.incorrect + l2Stats.incorrect,
                total: totalListeningCount
              };
              const grammarStats = getSectionStats('grammar', grammarQuestionsList);
              const vocabStats = getSectionStats('vocabulary', vocabQuestionsList);
              const rAStats = getSectionStats('readingPartA', readingPartAList);
              const rBStats = getSectionStats('readingPartB', readingPartBList);
              const readingStats = {
                correct: rAStats.correct + rBStats.correct,
                skipped: rAStats.skipped + rBStats.skipped,
                incorrect: rAStats.incorrect + rBStats.incorrect,
                total: totalReadingCount
              };

              const overallCorrectCount = listeningStats.correct + grammarStats.correct + vocabStats.correct + readingStats.correct;
              const overallSkippedCount = listeningStats.skipped + grammarStats.skipped + vocabStats.skipped + readingStats.skipped;
              const overallIncorrectCount = listeningStats.incorrect + grammarStats.incorrect + vocabStats.incorrect + readingStats.incorrect;

              // Compute available audit tabs strictly according to this exam's actual questions
              const availableTabs: { id: string; label: string; count: number; score: number; stats: typeof grammarStats }[] = [];
              if (hasListening) availableTabs.push({ id: 'listening', label: 'Listening', count: totalListeningCount, score: listeningStats.correct, stats: listeningStats });
              if (hasGrammar) availableTabs.push({ id: 'grammar', label: 'Grammar', count: totalGrammarCount, score: grammarStats.correct, stats: grammarStats });
              if (hasVocabulary) availableTabs.push({ id: 'vocabulary', label: 'Vocabulary', count: totalVocabCount, score: vocabStats.correct, stats: vocabStats });
              if (hasReading) availableTabs.push({ id: 'reading', label: 'Reading', count: totalReadingCount, score: readingStats.correct, stats: readingStats });

              const currentAuditTab = availableTabs.some(t => t.id === activeAuditTab)
                ? activeAuditTab
                : (availableTabs[0]?.id || 'listening');

              return (
              <div className="space-y-8">
                
                {/* 0. CANDIDATE EXAM BANNER */}
                <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900 block">Kỳ thi của bài làm này:</span>
                      <h3 className="text-sm font-black text-indigo-950">
                        {candidateExam?.title || 'Đề thi Placement Test'}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">Mã kỳ thi: {selectedCandidate.examId || 'default-exam'}</span>
                    </div>
                  </div>
                  <div className="text-right sm:self-center shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-white text-indigo-900 border border-indigo-200 rounded-lg shadow-xs">
                      Chỉ hiển thị bài làm thực tế của kỳ thi này
                    </span>
                  </div>
                </div>

                {/* 1. CANDIDATE TIME & LOG METRICS CARD */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                  <div>
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">THỜI GIAN LÀM BÀI CHI TIẾT</h4>
                    <div className="mt-1.5 space-y-1 text-xs font-semibold text-slate-700">
                      <div>Đăng ký: {new Date(selectedCandidate.registeredAt).toLocaleString('vi-VN')}</div>
                      <div>Bắt đầu: {selectedCandidate.startedAt ? new Date(selectedCandidate.startedAt).toLocaleString('vi-VN') : '-'}</div>
                      <div>Nộp bài: {selectedCandidate.submittedAt ? new Date(selectedCandidate.submittedAt).toLocaleString('vi-VN') : 'Chưa nộp'}</div>
                      <div>Tổng thời gian thi: <strong className="text-indigo-950">{formatDuration(selectedCandidate.durationSeconds)}</strong></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">CHỈ SỐ CHỐNG GIAN LẬN (ANTI-CHEAT INDEX)</h4>
                    <div className="mt-2 space-y-2">
                      {countTabSwitches(selectedCandidate) > 0 ? (
                        <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-r-xl space-y-1 text-xs text-rose-950 font-medium">
                          <div className="flex items-center gap-1.5 font-extrabold text-rose-800">
                            <ShieldAlert className="w-4 h-4 text-rose-600 animate-bounce" /> PHÁT HIỆN NGHI VẤN GIAN LẬN!
                          </div>
                          <p className="leading-snug">
                            Thí sinh này đã chuyển tab, mở tài liệu ngoài hoặc thoát chế độ thi <strong className="text-rose-700 font-bold underline">{countTabSwitches(selectedCandidate)} lần</strong>.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-xl space-y-1 text-xs text-emerald-950 font-medium">
                          <div className="flex items-center gap-1.5 font-extrabold text-emerald-800">
                            <CheckCircle className="w-4 h-4 text-emerald-600" /> TRUNG THỰC & AN TOÀN
                          </div>
                          <p className="leading-snug text-[11px] text-emerald-800/90">
                            Thí sinh không thực hiện hành vi chuyển tab hay thoát trang nào trong suốt bài thi.
                          </p>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 leading-normal pt-1">
                        * Chi tiết các mốc thời gian chuyển tab và vi phạm được ghi lại đầy đủ trong Nhật ký hoạt động bên phải.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">TỔNG ĐIỂM TRẮC NGHIỆM</h4>
                    {selectedCandidate.scores ? (
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="text-3xl font-black text-indigo-900 font-mono bg-indigo-50 border border-indigo-150 p-2.5 rounded-xl">
                          {selectedCandidate.scores.total} <span className="text-xs font-normal text-slate-400">/ {totalAutoGradedCount > 0 ? totalAutoGradedCount : (selectedCandidate.scores.maxPossible || 0)}</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-500">Tỷ lệ chính xác</div>
                          <div className="text-base font-black text-emerald-700">{selectedCandidate.scores.percentage}%</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic mt-2">Thí sinh chưa nộp bài thi chính thức.</div>
                    )}
                  </div>
                </div>

                {/* AI PLACEMENT RECOMMENDATION */}
                {selectedCandidate.scores && (
                  <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 text-white rounded-2xl p-6 border border-indigo-800 shadow-lg space-y-4 relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center gap-2 border-b border-indigo-800/80 pb-3">
                      <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                      <h3 className="font-extrabold text-xs uppercase tracking-wider text-indigo-100">ĐỀ XUẤT TRÌNH ĐỘ TIẾNG ANH CỦA AI (AI PLACEMENT RECOMMENDATION)</h3>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="flex flex-col items-center justify-center bg-indigo-950/80 border border-indigo-800 px-6 py-5 rounded-2xl shadow-inner shrink-0 text-center min-w-[200px]">
                        <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest block mb-1">RECOMMENDED CLASS</span>
                        <div className="text-4xl font-black text-amber-400 font-mono tracking-tight">
                          {selectedCandidate.scores.percentage <= 30 ? 'A1' :
                           selectedCandidate.scores.percentage <= 50 ? 'A2' :
                           selectedCandidate.scores.percentage <= 65 ? 'B1' :
                           selectedCandidate.scores.percentage <= 78 ? 'B2' : 'C1'}
                        </div>
                        <span className="text-[11px] font-bold text-white mt-1">
                          {selectedCandidate.scores.percentage <= 30 ? 'Lớp Starter / Elementary' :
                           selectedCandidate.scores.percentage <= 50 ? 'Lớp Pre-Intermediate' :
                           selectedCandidate.scores.percentage <= 65 ? 'Lớp Intermediate' :
                           selectedCandidate.scores.percentage <= 78 ? 'Lớp Upper-Intermediate' : 'Lớp Advanced'}
                        </span>
                      </div>

                      <div className="space-y-2 flex-grow text-sm leading-relaxed text-indigo-100/95 font-sans">
                        <p className="font-bold text-amber-400 text-xs">Phân tích kết quả kiểm tra năng lực thực tế:</p>
                        <ul className="text-xs space-y-1.5 list-disc list-inside font-medium text-justify">
                          {totalAutoGradedCount > 0 && (
                            <li>
                              Tổng điểm trắc nghiệm: <strong className="text-white font-mono">{selectedCandidate.scores.total} / {totalAutoGradedCount}</strong> câu (Tỉ lệ chính xác <strong className="text-white font-mono">{selectedCandidate.scores.percentage}%</strong>).
                            </li>
                          )}
                          {hasReading && (
                            <li>
                              Đọc hiểu (Reading): Đúng <strong className="text-white font-mono">{selectedCandidate.scores.reading || 0} / {totalReadingCount}</strong> câu.
                            </li>
                          )}
                          {hasGrammar && (
                            <li>
                              Ngữ pháp (Grammar): Đúng <strong className="text-white font-mono">{selectedCandidate.scores.grammar || 0} / {totalGrammarCount}</strong> câu.
                            </li>
                          )}
                          {hasVocabulary && (
                            <li>
                              Từ vựng (Vocabulary): Đúng <strong className="text-white font-mono">{selectedCandidate.scores.vocabulary || 0} / {totalVocabCount}</strong> câu.
                            </li>
                          )}
                          {hasListening && (
                            <li>
                              Kỹ năng Nghe (Listening): Đúng <strong className="text-white font-mono">{selectedCandidate.scores.listening || 0} / {totalListeningCount}</strong> câu.
                            </li>
                          )}
                          {hasSpeaking && (
                            <li>
                              Kỹ năng Nói (Speaking): Thí sinh đã thực hiện bài thi nói ({speakingQuestionsList.length + (speakingReadAloudText ? 1 : 0)} phần).
                            </li>
                          )}
                          {hasWriting && (
                            <li>
                              Kỹ năng Viết (Writing): Điểm viết do Giáo viên chấm là <strong className="text-white font-mono">{selectedCandidate.writingScore || 0} / 10</strong> điểm ({writingQuestionsList.length} câu tự luận).
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ACTIVITY CHRONOLOGICAL LOGS */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-2 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-indigo-950" /> NHẬT KÝ HOẠT ĐỘNG THÍ SINH (LOGS)
                  </h4>
                  <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-2">
                    {selectedCandidate.logs?.map((l: any, index: number) => (
                      <div key={index} className="flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-50 py-1 font-mono">
                        <span className="font-bold text-slate-700">{l.action}</span>
                        <span className="text-slate-400 shrink-0 ml-4">{new Date(l.timestamp).toLocaleTimeString('vi-VN')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. SPEAKING EVALUATOR BOARD */}
                {hasSpeaking && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-2.5 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-indigo-900" /> QUẢN LÝ BÀI THI SPEAKING (SPEAKING MANAGEMENT)
                    </h4>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-4">
                        
                        {/* Part 1 */}
                        {speakingReadAloudText && (
                          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl">
                            <h5 className="font-bold text-xs text-indigo-950 mb-2 uppercase">Bài 1: Đọc to đoạn văn</h5>
                            
                            {/* Target source text display */}
                            <div className="bg-indigo-50/40 border border-indigo-100 p-3.5 rounded-lg mb-3">
                              <span className="text-[10px] uppercase font-bold text-indigo-900 block mb-1">Văn bản cần đọc (Source Reading Passage):</span>
                              <p className="text-xs text-slate-800 leading-relaxed font-serif">"{speakingReadAloudText}"</p>
                            </div>

                            {selectedCandidate.answers?.speakingPart1?.audioPath && selectedCandidate.answers.speakingPart1.audioPath.trim() !== '' ? (
                              <div className="space-y-3">
                                <audio src={selectedCandidate.answers.speakingPart1.audioPath} controls className="w-full h-9 rounded-lg" preload="metadata" />
                                <a
                                  href={selectedCandidate.answers.speakingPart1.audioPath}
                                  download={`speaking_p1_${selectedCandidate.fullName}.webm`}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-900 hover:underline bg-white border border-slate-200 px-2 py-1 rounded"
                                >
                                  <Download className="w-3 h-3" /> Tải file ghi âm
                                </a>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Thí sinh không làm hoặc không có file ghi âm.</span>
                            )}
                          </div>
                        )}

                        {/* Part 2 interview audios */}
                        {speakingQuestionsList.length > 0 && (
                          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-4">
                            <h5 className="font-bold text-xs text-indigo-950 border-b border-slate-250 pb-1 uppercase">
                              Bài 2: Ghi âm Trả lời {speakingQuestionsList.length} Câu hỏi
                            </h5>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {speakingQuestionsList.map((spQ: any, idx: number) => {
                                const audioKey = `sp_${idx + 1}_audioPath` as keyof typeof selectedCandidate.answers.speakingPart2;
                                const audioPath = selectedCandidate.answers?.speakingPart2?.[audioKey];

                                return (
                                  <div key={spQ.id || idx} className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-150 flex flex-col justify-between">
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-extrabold uppercase shrink-0">CÂU {idx + 1}</p>
                                      <p className="text-xs font-bold text-slate-800 leading-snug my-1 italic shrink-0">"{spQ.text || spQ.prompt || spQ.question}"</p>
                                    </div>
                                    <div className="pt-2">
                                      {audioPath && typeof audioPath === 'string' && audioPath.trim() !== '' ? (
                                        <audio src={audioPath} controls className="w-full h-8" preload="metadata" />
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic block">Không có ghi âm</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                )}

                {/* 4. WRITING MANAGEMENT PANEL */}
                {hasWriting && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-2.5 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-950" /> QUẢN LÝ VÀ CHẤM ĐIỂM WRITING (WRITING MANAGEMENT)
                    </h4>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* View answers */}
                      <div className="lg:col-span-7 space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {writingQuestionsList.map((q: any, idx: number) => {
                          const answer = selectedCandidate.answers?.writing?.[q.id] || '';
                          const isSkipped = answer === '__SKIPPED__';
                          const note = selectedCandidate.answers?.writing?.[`__NOTE__${q.id}`] || '';
                          return (
                            <div key={q.id || idx} className={`p-3.5 border rounded-lg space-y-1.5 text-xs transition-all ${
                              isSkipped ? 'bg-amber-50/20 border-amber-200' : 'bg-slate-50 border-slate-150'
                            }`}>
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                <span className="flex items-center gap-1">
                                  CÂU HỎI {idx + 1}
                                  {isSkipped && (
                                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-extrabold uppercase text-[8px] flex items-center gap-0.5">
                                      <ShieldAlert className="w-2.5 h-2.5 text-amber-600" /> Đã bỏ qua
                                    </span>
                                  )}
                                </span>
                                <span className="text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">Tự luận</span>
                              </div>
                              <p className="font-bold text-slate-800 font-sans">{q.vietnamese || q.prompt || q.text}</p>
                              
                              <div className="pt-2 border-t border-slate-200/60">
                                <span className="text-[10px] font-bold text-indigo-900 block mb-1">BÀI LÀM CỦA THÍ SINH:</span>
                                {isSkipped ? (
                                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-950 font-sans leading-relaxed">
                                    <span className="font-extrabold block text-[9px] text-amber-600 uppercase">HỌC SINH ĐÃ CHỌN BỎ QUA CÂU NÀY:</span>
                                    <span className="italic font-bold block mt-1">
                                      Lý do: {note || <span className="font-normal text-slate-400">Không có lý do ghi chú.</span>}
                                    </span>
                                  </div>
                                ) : (
                                  <p className="font-sans italic text-slate-700 bg-white p-2.5 rounded border border-slate-200 select-all leading-relaxed whitespace-pre-wrap font-medium">
                                    {answer ? `"${answer}"` : <span className="text-red-500 font-normal">Thí sinh bỏ trống không làm câu này.</span>}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Grade box */}
                      <form className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4" onSubmit={handleGradeWriting}>
                        <h5 className="font-bold text-xs text-indigo-950 uppercase border-b border-slate-200 pb-2">CHẤM ĐIỂM THỦ CÔNG</h5>

                        {gradingSuccess && (
                          <div className="bg-green-50 text-green-700 p-3 rounded-xl border border-green-200 text-[11px] font-bold flex items-center gap-1">
                            <Check className="w-4 h-4" /> Đã lưu điểm và cập nhật học lực thí sinh thành công!
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Điểm thi viết (Thang điểm từ 0 đến 10)</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="10"
                            required
                            value={writingScore}
                            onChange={(e) => setWritingScore(parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-sm font-bold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-900"
                          />
                          <p className="text-[9px] text-slate-400 leading-normal">* Điểm tổng kết kỹ năng Viết của thí sinh.</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Nhận xét chi tiết của giáo viên</label>
                          <textarea
                            rows={6}
                            placeholder="Nhập nhận xét của giáo viên..."
                            value={writingComment}
                            onChange={(e) => setWritingComment(e.target.value)}
                            className="w-full p-3 border border-slate-200 bg-white rounded-xl text-xs font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-900 resize-y"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={gradingLoading}
                          className="w-full bg-indigo-900 hover:bg-indigo-850 disabled:bg-indigo-300 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow"
                        >
                          <Save className="w-4 h-4" /> {gradingLoading ? 'Đang lưu điểm...' : 'Lưu điểm và Nhận xét'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* 5. AUTO GRADED QUESTIONS AUDIT DETAILS */}
                {hasAutoGradedSections && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                    <div className="border-b border-slate-100 pb-4">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-950" /> CHI TIẾT BÀI LÀM TỪNG CÂU & THỐNG KÊ KẾT QUẢ
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Xem chi tiết từng câu hỏi thực tế của kỳ thi này, các đáp án học sinh đã chọn, câu đúng, câu sai và câu bỏ qua.
                      </p>
                    </div>

                    {/* Quick Statistics Banner */}
                    <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200/90 rounded-xl p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tổng kết toàn bộ bài thi trắc nghiệm</span>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="text-xs font-black text-slate-700 px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-xs">
                              Tổng số: <strong>{totalAutoGradedCount}</strong> câu
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <Check className="w-3.5 h-3.5" /> Đúng: {overallCorrectCount} ({totalAutoGradedCount > 0 ? Math.round((overallCorrectCount / totalAutoGradedCount) * 100) : 0}%)
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-black text-rose-800 bg-rose-100/80 border border-rose-200 px-2.5 py-1 rounded-lg">
                              <X className="w-3.5 h-3.5" /> Sai / Chưa làm: {overallIncorrectCount}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-100/80 border border-amber-200 px-2.5 py-1 rounded-lg">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> Bỏ qua: {overallSkippedCount}
                            </span>
                          </div>
                        </div>

                        {/* Filter buttons */}
                        <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-xl shadow-xs shrink-0">
                          <button
                            type="button"
                            onClick={() => setAuditStatusFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              auditStatusFilter === 'all' ? 'bg-indigo-950 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Tất cả ({totalAutoGradedCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuditStatusFilter('correct')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              auditStatusFilter === 'correct' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            Đúng ({overallCorrectCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuditStatusFilter('incorrect')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              auditStatusFilter === 'incorrect' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            Sai ({overallIncorrectCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuditStatusFilter('skipped')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              auditStatusFilter === 'skipped' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 hover:bg-amber-50'
                            }`}
                          >
                            Bỏ qua ({overallSkippedCount})
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tab switcher: Only render tabs for sections that actually exist */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 select-none">
                      {availableTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveAuditTab(tab.id as any)}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                            currentAuditTab === tab.id ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <div>{tab.label} ({tab.score}/{tab.count})</div>
                          <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                            {tab.stats.correct} đúng · {tab.stats.incorrect} sai{tab.stats.skipped > 0 ? ` · ${tab.stats.skipped} bỏ qua` : ''}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Audit list */}
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                      {currentAuditTab === 'listening' && hasListening && (
                        <div className="space-y-4">
                          {listeningP1List.length > 0 && (
                            <div className="space-y-4">
                              <div className="text-xs font-black text-indigo-950 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg">
                                PART 1: MULTIPLE CHOICE QUESTIONS (CÂU 1 - {listeningP1List.length})
                              </div>
                              {listeningP1List.map((q: any, idx: number) => {
                                const ans = getCandidateAnswer(selectedCandidate, 'listeningPart1', q.id);
                                const isSkipped = isAnswerSkipped(ans, selectedCandidate, q.id);
                                const isCorrect = isAnswerCorrect(ans, q);
                                const isIncorrect = !isCorrect && !isSkipped;
                                if (auditStatusFilter === 'correct' && !isCorrect) return null;
                                if (auditStatusFilter === 'incorrect' && !isIncorrect) return null;
                                if (auditStatusFilter === 'skipped' && !isSkipped) return null;

                                return (
                                  <div key={q.id || idx} className={`p-4 border rounded-xl space-y-3 transition-all ${
                                    isCorrect ? 'bg-emerald-50/40 border-emerald-200' :
                                    isSkipped ? 'bg-amber-50/30 border-amber-200' :
                                    'bg-rose-50/40 border-rose-150'
                                  }`}>
                                    <div className="flex justify-between items-start">
                                      <span className="font-extrabold text-[10px] text-slate-500 uppercase">Câu {idx + 1} (Listening Part 1)</span>
                                      <span className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                        isCorrect ? 'bg-emerald-100 text-emerald-850' :
                                        isSkipped ? 'bg-amber-100 text-amber-800' :
                                        'bg-rose-100 text-rose-800'
                                      }`}>
                                        {isCorrect ? <Check className="w-3.5 h-3.5" /> : isSkipped ? <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> : <X className="w-3.5 h-3.5" />}
                                        {isCorrect ? 'Chính xác (+1đ)' : isSkipped ? 'Đã bỏ qua (0đ)' : 'Chưa chính xác (0đ)'}
                                      </span>
                                    </div>
                                    <p className="font-bold text-slate-800 text-sm font-sans">{q.text}</p>
                                    
                                    {isSkipped ? (
                                      <div className="p-3 bg-amber-50 border border-amber-150 rounded-lg text-xs text-amber-900">
                                        <span className="font-extrabold block text-[10px] text-amber-600 uppercase">HỌC SINH ĐÃ CHỌN BỎ QUA CÂU NÀY</span>
                                        <span className="italic font-medium block mt-1">
                                          Ghi chú: {selectedCandidate.answers?.listeningPart1?.[`__NOTE__${q.id}`] || <span className="font-normal text-slate-400">Không có lý do ghi chú.</span>}
                                        </span>
                                        <div className="mt-2 text-slate-700">
                                          Đáp án đúng: <strong className="text-emerald-750 font-bold">{q.answer}</strong>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                        {q.options?.map((opt: string, oIdx: number) => {
                                          const letter = String.fromCharCode(65 + oIdx);
                                          const isSelected = ans.trim().toUpperCase() === letter || ans.trim().toUpperCase() === opt.trim().toUpperCase();
                                          const isCorrectLetter = (q.answer || '').trim().toUpperCase() === letter || (q.answer || '').trim().toUpperCase() === opt.trim().toUpperCase();
                                          return (
                                            <div key={letter} className={`p-2.5 rounded-lg border font-medium ${
                                              isSelected && isCorrectLetter ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold' :
                                              isSelected && !isCorrectLetter ? 'bg-rose-100 border-rose-300 text-rose-900 font-bold' :
                                              !isSelected && isCorrectLetter ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                              'bg-white border-slate-200 text-slate-600'
                                            }`}>
                                              <span className="font-bold mr-1.5">{letter}.</span> {opt}
                                              {isSelected && <span className="text-[9px] uppercase font-black ml-1.5 text-slate-600">(Đã chọn)</span>}
                                              {isCorrectLetter && <span className="text-[9px] uppercase font-black ml-1.5 text-emerald-700">(Đúng)</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {listeningP2List.length > 0 && (
                            <div className="space-y-4">
                              <div className="text-xs font-black text-indigo-950 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg mt-6">
                                PART 2: FILL IN THE BLANKS (CÂU {listeningP1List.length + 1} - {totalListeningCount})
                              </div>
                              {listeningP2List.map((q: any, idx: number) => {
                                const ans = getCandidateAnswer(selectedCandidate, 'listeningPart2', q.id);
                                const isSkipped = isAnswerSkipped(ans, selectedCandidate, q.id);
                                const isCorrect = isAnswerCorrect(ans, q);
                                const isIncorrect = !isCorrect && !isSkipped;
                                if (auditStatusFilter === 'correct' && !isCorrect) return null;
                                if (auditStatusFilter === 'incorrect' && !isIncorrect) return null;
                                if (auditStatusFilter === 'skipped' && !isSkipped) return null;

                                return (
                                  <div key={q.id || idx} className={`p-4 border rounded-xl space-y-3 transition-all ${
                                    isCorrect ? 'bg-emerald-50/40 border-emerald-200' :
                                    isSkipped ? 'bg-amber-50/30 border-amber-200' :
                                    'bg-rose-50/40 border-rose-150'
                                  }`}>
                                    <div className="flex justify-between items-start">
                                      <span className="font-extrabold text-[10px] text-slate-500 uppercase">Câu {idx + listeningP1List.length + 1} (Listening Part 2)</span>
                                      <span className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                        isCorrect ? 'bg-emerald-100 text-emerald-850' :
                                        isSkipped ? 'bg-amber-100 text-amber-800' :
                                        'bg-rose-100 text-rose-800'
                                      }`}>
                                        {isCorrect ? <Check className="w-3.5 h-3.5" /> : isSkipped ? <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> : <X className="w-3.5 h-3.5" />}
                                        {isCorrect ? 'Chính xác (+1đ)' : isSkipped ? 'Đã bỏ qua (0đ)' : 'Chưa chính xác (0đ)'}
                                      </span>
                                    </div>
                                    <p className="font-bold text-slate-800 text-sm font-sans">{q.text}</p>
                                    
                                    {isSkipped ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div className="p-3 rounded-lg border border-amber-250 bg-amber-50 text-xs text-amber-950">
                                          <span className="font-extrabold block text-[10px] text-amber-600 uppercase">HỌC SINH ĐÃ CHỌN BỎ QUA CÂU NÀY</span>
                                          <span className="italic font-medium block mt-1">
                                            Ghi chú: {selectedCandidate.answers?.listeningPart2?.[`__NOTE__${q.id}`] || <span className="font-normal text-slate-400">Không có lý do ghi chú.</span>}
                                          </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 flex flex-col justify-center">
                                          <span className="font-extrabold block text-[10px] text-slate-400 uppercase">ĐÁP ÁN ĐÚNG HOẶC CHẤP NHẬN:</span>
                                          <span className="font-mono text-sm font-bold block mt-0.5 text-emerald-850">"{q.answer}"</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div className={`p-3 rounded-lg border text-xs ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                                          <span className="font-extrabold block text-[10px] text-slate-400 uppercase">ĐÁP ÁN HỌC SINH NHẬP:</span>
                                          <span className="font-mono text-sm font-bold block mt-0.5">{ans ? `"${ans}"` : <span className="italic text-slate-400 font-normal">Bỏ trống</span>}</span>
                                        </div>
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800">
                                          <span className="font-extrabold block text-[10px] text-slate-400 uppercase">ĐÁP ÁN ĐÚNG HOẶC CHẤP NHẬN:</span>
                                          <span className="font-mono text-sm font-bold block mt-0.5 text-emerald-800">"{q.answer}"</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {currentAuditTab === 'grammar' && hasGrammar && (
                        <div className="space-y-4">
                          {grammarQuestionsList.map((q: any, idx: number) => {
                            const ans = getCandidateAnswer(selectedCandidate, 'grammar', q.id);
                            const isSkipped = isAnswerSkipped(ans, selectedCandidate, q.id);
                            const isCorrect = isAnswerCorrect(ans, q);
                            const isIncorrect = !isCorrect && !isSkipped;
                            if (auditStatusFilter === 'correct' && !isCorrect) return null;
                            if (auditStatusFilter === 'incorrect' && !isIncorrect) return null;
                            if (auditStatusFilter === 'skipped' && !isSkipped) return null;
                            
                            return (
                              <div key={q.id || idx} className={`p-4 border rounded-xl space-y-3 transition-all ${
                                isCorrect ? 'bg-emerald-50/40 border-emerald-200' :
                                isSkipped ? 'bg-amber-50/30 border-amber-200' :
                                'bg-rose-50/40 border-rose-150'
                              }`}>
                                <div className="flex justify-between items-start">
                                  <span className="font-extrabold text-[10px] text-slate-500 uppercase">Câu {idx + 1} (Grammar)</span>
                                  <span className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                    isCorrect ? 'bg-emerald-100 text-emerald-850' :
                                    isSkipped ? 'bg-amber-100 text-amber-800' :
                                    'bg-rose-100 text-rose-800'
                                  }`}>
                                    {isCorrect ? <Check className="w-3.5 h-3.5" /> : isSkipped ? <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> : <X className="w-3.5 h-3.5" />}
                                    {isCorrect ? 'Chính xác (+1đ)' : isSkipped ? 'Đã bỏ qua (0đ)' : 'Chưa chính xác (0đ)'}
                                  </span>
                                </div>
                                <p className="font-bold text-slate-800 text-sm font-sans">{q.text}</p>
                                
                                {isSkipped ? (
                                  <div className="p-3 bg-amber-50 border border-amber-150 rounded-lg text-xs text-amber-900">
                                    <span className="font-extrabold block text-[10px] text-amber-600 uppercase">HỌC SINH ĐÃ CHỌN BỎ QUA CÂU NÀY</span>
                                    <span className="italic font-medium block mt-1">
                                      Ghi chú: {selectedCandidate.answers?.grammar?.[`__NOTE__${q.id}`] || <span className="font-normal text-slate-400">Không có lý do ghi chú.</span>}
                                    </span>
                                    <div className="mt-2 text-slate-700">
                                      Đáp án đúng: <strong className="text-emerald-750 font-bold">{q.answer}</strong>
                                    </div>
                                  </div>
                                ) : (Array.isArray(q.options) && q.options.length > 0) ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                                    {q.options?.map((opt: string, oIdx: number) => {
                                      const letter = String.fromCharCode(65 + oIdx);
                                      const isSelected = ans.trim().toUpperCase() === letter || ans.trim().toUpperCase() === opt.trim().toUpperCase();
                                      const isCorrectLetter = (q.answer || '').trim().toUpperCase() === letter || (q.answer || '').trim().toUpperCase() === opt.trim().toUpperCase();
                                      return (
                                        <div key={letter} className={`p-2.5 rounded-lg border font-medium ${
                                          isSelected && isCorrectLetter ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold' :
                                          isSelected && !isCorrectLetter ? 'bg-rose-100 border-rose-300 text-rose-900 font-bold' :
                                          !isSelected && isCorrectLetter ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                          'bg-white border-slate-200 text-slate-600'
                                        }`}>
                                          <span className="font-bold mr-1">{letter}.</span> {opt}
                                          {isSelected && <span className="text-[9px] uppercase font-black ml-1.5 text-slate-600">(Đã chọn)</span>}
                                          {isCorrectLetter && <span className="text-[9px] uppercase font-black ml-1.5 text-emerald-700">(Đúng)</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div className={`p-3 rounded-lg border text-xs ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                                      <span className="font-extrabold block text-[10px] text-slate-400 uppercase">ĐÁP ÁN HỌC SINH NHẬP:</span>
                                      <span className="font-mono text-sm font-bold block mt-0.5">{ans ? `"${ans}"` : <span className="italic text-slate-400 font-normal">Bỏ trống</span>}</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800">
                                      <span className="font-extrabold block text-[10px] text-slate-400 uppercase">ĐÁP ÁN ĐÚNG HOẶC CHẤP NHẬN:</span>
                                      <span className="font-mono text-sm font-bold block mt-0.5 text-emerald-800">"{q.answer}"</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {currentAuditTab === 'vocabulary' && hasVocabulary && (
                        <div className="space-y-4">
                          {vocabQuestionsList.map((q: any, idx: number) => {
                            const ans = getCandidateAnswer(selectedCandidate, 'vocabulary', q.id);
                            const isSkipped = isAnswerSkipped(ans, selectedCandidate, q.id);
                            const isCorrect = isAnswerCorrect(ans, q);
                            const isIncorrect = !isCorrect && !isSkipped;
                            if (auditStatusFilter === 'correct' && !isCorrect) return null;
                            if (auditStatusFilter === 'incorrect' && !isIncorrect) return null;
                            if (auditStatusFilter === 'skipped' && !isSkipped) return null;
                            
                            return (
                              <div key={q.id || idx} className={`p-4 border rounded-xl space-y-3 transition-all ${
                                isCorrect ? 'bg-emerald-50/40 border-emerald-200' :
                                isSkipped ? 'bg-amber-50/30 border-amber-200' :
                                'bg-rose-50/40 border-rose-150'
                              }`}>
                                <div className="flex justify-between items-start">
                                  <span className="font-extrabold text-[10px] text-slate-500 uppercase">Câu {idx + 1} (Vocabulary)</span>
                                  <span className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                    isCorrect ? 'bg-emerald-100 text-emerald-850' :
                                    isSkipped ? 'bg-amber-100 text-amber-800' :
                                    'bg-rose-100 text-rose-800'
                                  }`}>
                                    {isCorrect ? <Check className="w-3.5 h-3.5" /> : isSkipped ? <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> : <X className="w-3.5 h-3.5" />}
                                    {isCorrect ? 'Chính xác (+1đ)' : isSkipped ? 'Đã bỏ qua (0đ)' : 'Chưa chính xác (0đ)'}
                                  </span>
                                </div>
                                <p className="font-bold text-slate-800 text-sm font-sans">{q.text}</p>
                                
                                {isSkipped ? (
                                  <div className="p-3 bg-amber-50 border border-amber-150 rounded-lg text-xs text-amber-900">
                                    <span className="font-extrabold block text-[10px] text-amber-600 uppercase">HỌC SINH ĐÃ CHỌN BỎ QUA CÂU NÀY</span>
                                    <span className="italic font-medium block mt-1">
                                      Ghi chú: {selectedCandidate.answers?.vocabulary?.[`__NOTE__${q.id}`] || <span className="font-normal text-slate-400">Không có lý do ghi chú.</span>}
                                    </span>
                                    <div className="mt-2 text-slate-700">
                                      Đáp án đúng: <strong className="text-emerald-750 font-bold">{q.answer}</strong>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                                    {q.options?.map((opt: string, oIdx: number) => {
                                      const letter = String.fromCharCode(65 + oIdx);
                                      const isSelected = ans.trim().toUpperCase() === letter || ans.trim().toUpperCase() === opt.trim().toUpperCase();
                                      const isCorrectLetter = (q.answer || '').trim().toUpperCase() === letter || (q.answer || '').trim().toUpperCase() === opt.trim().toUpperCase();
                                      return (
                                        <div key={letter} className={`p-2.5 rounded-lg border font-medium ${
                                          isSelected && isCorrectLetter ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold' :
                                          isSelected && !isCorrectLetter ? 'bg-rose-100 border-rose-300 text-rose-900 font-bold' :
                                          !isSelected && isCorrectLetter ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                          'bg-white border-slate-200 text-slate-600'
                                        }`}>
                                          <span className="font-bold mr-1">{letter}.</span> {opt}
                                          {isSelected && <span className="text-[9px] uppercase font-black ml-1.5 text-slate-600">(Đã chọn)</span>}
                                          {isCorrectLetter && <span className="text-[9px] uppercase font-black ml-1.5 text-emerald-700">(Đúng)</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {currentAuditTab === 'reading' && hasReading && (
                        <div className="space-y-4">
                          {/* Reading passage display */}
                          {readingPassageData?.text && (
                            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-5 mb-4 space-y-3 dark:bg-slate-850 dark:border-amber-900/40">
                              <h6 className="font-extrabold text-sm text-amber-900 dark:text-amber-400 border-b border-amber-200/60 dark:border-amber-900/20 pb-1.5 uppercase">
                                BÀI ĐỌC: {readingPassageData?.title || 'English Reading Passage'}
                              </h6>
                              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                                {readingPassageData?.text}
                              </div>
                            </div>
                          )}

                          {readingPartAList.length > 0 && (
                            <div className="space-y-4">
                              <div className="text-xs font-black text-indigo-950 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg">
                                PART A: MULTIPLE CHOICE QUESTIONS (CÂU 1 - {readingPartAList.length})
                              </div>
                              {readingPartAList.map((q: any, idx: number) => {
                                const ans = getCandidateAnswer(selectedCandidate, 'readingPartA', q.id);
                                const isSkipped = isAnswerSkipped(ans, selectedCandidate, q.id);
                                const isCorrect = isAnswerCorrect(ans, q);
                                const isIncorrect = !isCorrect && !isSkipped;
                                if (auditStatusFilter === 'correct' && !isCorrect) return null;
                                if (auditStatusFilter === 'incorrect' && !isIncorrect) return null;
                                if (auditStatusFilter === 'skipped' && !isSkipped) return null;

                                return (
                                  <div key={q.id || idx} className={`p-4 border rounded-xl space-y-3 transition-all ${
                                    isCorrect ? 'bg-emerald-50/40 border-emerald-200' :
                                    isSkipped ? 'bg-amber-50/30 border-amber-200' :
                                    'bg-rose-50/40 border-rose-150'
                                  }`}>
                                    <div className="flex justify-between items-start">
                                      <span className="font-extrabold text-[10px] text-slate-500 uppercase">Câu {idx + 1} (Reading Part A)</span>
                                      <span className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                        isCorrect ? 'bg-emerald-100 text-emerald-850' :
                                        isSkipped ? 'bg-amber-100 text-amber-800' :
                                        'bg-rose-100 text-rose-800'
                                      }`}>
                                        {isCorrect ? <Check className="w-3.5 h-3.5" /> : isSkipped ? <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> : <X className="w-3.5 h-3.5" />}
                                        {isCorrect ? 'Chính xác (+1đ)' : isSkipped ? 'Đã bỏ qua (0đ)' : 'Chưa chính xác (0đ)'}
                                      </span>
                                    </div>
                                    <p className="font-bold text-slate-800 text-sm font-sans">{q.text}</p>
                                    
                                    {isSkipped ? (
                                      <div className="p-3 bg-amber-50 border border-amber-150 rounded-lg text-xs text-amber-900">
                                        <span className="font-extrabold block text-[10px] text-amber-600 uppercase">HỌC SINH ĐÃ CHỌN BỎ QUA CÂU NÀY</span>
                                        <span className="italic font-medium block mt-1">
                                          Ghi chú: {selectedCandidate.answers?.readingPartA?.[`__NOTE__${q.id}`] || <span className="font-normal text-slate-400">Không có lý do ghi chú.</span>}
                                        </span>
                                        <div className="mt-2 text-slate-700">
                                          Đáp án đúng: <strong className="text-emerald-750 font-bold">{q.answer}</strong>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                                        {q.options?.map((opt: string, oIdx: number) => {
                                          const letter = String.fromCharCode(65 + oIdx);
                                          const isSelected = ans.trim().toUpperCase() === letter || ans.trim().toUpperCase() === opt.trim().toUpperCase();
                                          const isCorrectLetter = (q.answer || '').trim().toUpperCase() === letter || (q.answer || '').trim().toUpperCase() === opt.trim().toUpperCase();
                                          return (
                                            <div key={letter} className={`p-2.5 rounded-lg border font-medium ${
                                              isSelected && isCorrectLetter ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold' :
                                              isSelected && !isCorrectLetter ? 'bg-rose-100 border-rose-300 text-rose-900 font-bold' :
                                              !isSelected && isCorrectLetter ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                              'bg-white border-slate-200 text-slate-600'
                                            }`}>
                                              <span className="font-bold mr-1">{letter}.</span> {opt}
                                              {isSelected && <span className="text-[9px] uppercase font-black ml-1.5 text-slate-600">(Đã chọn)</span>}
                                              {isCorrectLetter && <span className="text-[9px] uppercase font-black ml-1.5 text-emerald-700">(Đúng)</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {readingPartBList.length > 0 && (
                            <div className="space-y-4">
                              <div className="text-xs font-black text-indigo-950 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg mt-6">
                                PART B: TRUE / FALSE / NOT GIVEN (CÂU {readingPartAList.length + 1} - {totalReadingCount})
                              </div>
                              {readingPartBList.map((q: any, idx: number) => {
                                const ans = getCandidateAnswer(selectedCandidate, 'readingPartB', q.id);
                                const isSkipped = isAnswerSkipped(ans, selectedCandidate, q.id);
                                const isCorrect = isAnswerCorrect(ans, q);
                                const isIncorrect = !isCorrect && !isSkipped;
                                if (auditStatusFilter === 'correct' && !isCorrect) return null;
                                if (auditStatusFilter === 'incorrect' && !isIncorrect) return null;
                                if (auditStatusFilter === 'skipped' && !isSkipped) return null;

                                return (
                                  <div key={q.id || idx} className={`p-4 border rounded-xl space-y-3 transition-all ${
                                    isCorrect ? 'bg-emerald-50/40 border-emerald-200' :
                                    isSkipped ? 'bg-amber-50/30 border-amber-200' :
                                    'bg-rose-50/40 border-rose-150'
                                  }`}>
                                    <div className="flex justify-between items-start">
                                      <span className="font-extrabold text-[10px] text-slate-500 uppercase">Câu {idx + readingPartAList.length + 1} (Reading Part B)</span>
                                      <span className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                        isCorrect ? 'bg-emerald-100 text-emerald-850' :
                                        isSkipped ? 'bg-amber-100 text-amber-800' :
                                        'bg-rose-100 text-rose-800'
                                      }`}>
                                        {isCorrect ? <Check className="w-3.5 h-3.5" /> : isSkipped ? <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> : <X className="w-3.5 h-3.5" />}
                                        {isCorrect ? 'Chính xác (+1đ)' : isSkipped ? 'Đã bỏ qua (0đ)' : 'Chưa chính xác (0đ)'}
                                      </span>
                                    </div>
                                    <p className="font-bold text-slate-800 text-sm font-sans">{q.text}</p>
                                    
                                    {isSkipped ? (
                                      <div className="p-3 bg-amber-50 border border-amber-150 rounded-lg text-xs text-amber-900">
                                        <span className="font-extrabold block text-[10px] text-amber-600 uppercase">HỌC SINH ĐÃ CHỌN BỎ QUA CÂU NÀY</span>
                                        <span className="italic font-medium block mt-1">
                                          Ghi chú: {selectedCandidate.answers?.readingPartB?.[`__NOTE__${q.id}`] || <span className="font-normal text-slate-400">Không có lý do ghi chú.</span>}
                                        </span>
                                        <div className="mt-2 text-slate-700">
                                          Đáp án đúng: <strong className="text-emerald-750 font-bold">{q.answer}</strong>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                        {q.options?.map((opt: string, oIdx: number) => {
                                          const letter = String.fromCharCode(65 + oIdx);
                                          const isSelected = ans.trim().toUpperCase() === opt.trim().toUpperCase() || ans.trim().toUpperCase() === letter;
                                          const isCorrectLetter = (q.answer || '').trim().toUpperCase() === opt.trim().toUpperCase() || (q.answer || '').trim().toUpperCase() === letter;
                                          return (
                                            <div key={letter} className={`p-2.5 rounded-lg border font-medium ${
                                              isSelected && isCorrectLetter ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold' :
                                              isSelected && !isCorrectLetter ? 'bg-rose-100 border-rose-300 text-rose-900 font-bold' :
                                              !isSelected && isCorrectLetter ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                              'bg-white border-slate-200 text-slate-600'
                                            }`}>
                                              <span className="font-bold mr-1">{letter}.</span> {opt}
                                              {isSelected && <span className="text-[9px] uppercase font-black ml-1.5 text-slate-600">(Đã chọn)</span>}
                                              {isCorrectLetter && <span className="text-[9px] uppercase font-black ml-1.5 text-emerald-700">(Đúng)</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            );
          })()}

          </div>
        )) : adminTab === 'materials' ? (
          renderMaterialsManager()
        ) : adminTab === 'exams' ? (
          renderExamsManager()
        ) : adminTab === 'settings' ? (
          renderSettingsManager()
        ) : (
          renderLogsTab()
        )}

      </main>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && confirmModalConfig && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-250 shadow-2xl p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-600">
              <ShieldAlert className="w-8 h-8 shrink-0" />
              <h3 className="text-base font-black uppercase text-indigo-950 dark:text-slate-100">XÁC NHẬN HÀNH ĐỘNG</h3>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {confirmModalConfig.type === 'delete' ? (
                <>Bạn có chắc chắn muốn <strong className="text-red-600 dark:text-red-400 font-extrabold">XÓA VĨNH VIỄN</strong> bài làm và thông tin của thí sinh <strong className="dark:text-white font-extrabold">"{confirmModalConfig.name}"</strong> không? Thao tác này KHÔNG THỂ khôi phục.</>
              ) : (
                <>Bạn có chắc chắn muốn <strong className="text-amber-600 dark:text-amber-400 font-extrabold font-mono">RESET</strong> lại toàn bộ bài làm của thí sinh <strong className="dark:text-white font-extrabold">"{confirmModalConfig.name}"</strong>? Thí sinh sẽ được phép đăng ký và thi lại từ đầu.</>
              )}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmedAction}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer ${
                  confirmModalConfig.type === 'delete' ? 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertConfig?.show && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-250 shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5">
              {alertConfig.type === 'success' ? (
                <CheckCircle className="w-7 h-7 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-7 h-7 text-red-600 shrink-0" />
              )}
              <h3 className="text-sm font-black uppercase text-indigo-950 dark:text-slate-100">{alertConfig.title}</h3>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              {alertConfig.message}
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setAlertConfig(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-900 hover:bg-indigo-850 rounded-lg transition-colors cursor-pointer"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
