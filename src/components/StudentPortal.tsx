import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Award,
  BookOpen,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Play,
  Clock,
  ChevronRight,
  Search,
  CheckCircle2,
  Phone,
  LogOut,
  Sparkles,
  FileCode,
  Eye,
  X,
  Volume2,
  HelpCircle,
  Sun,
  Moon,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';
import { Material } from '../services/materialService';
import { Language, languageService } from '../services/languageService';
import { candidateService, Candidate } from '../services/candidateService';
import LanguageToggle from './LanguageToggle';
import { DocumentReaderModal } from './DocumentReaderModal';

interface StudentPortalProps {
  candidate: any;
  activeExam: any;
  exams: any[];
  onSelectExam: (examId: string) => void;
  onStartTest: () => void;
  onLogout: () => void;
  materials: Material[];
  testCompleted: boolean;
  settings?: any;
  onContactTeacher?: () => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function StudentPortal({
  candidate,
  activeExam,
  exams = [],
  onSelectExam,
  onStartTest,
  onLogout,
  materials = [],
  testCompleted,
  settings = {},
  darkMode,
  onToggleDarkMode
}: StudentPortalProps) {
  const [activeTab, setActiveTab] = useState<'test' | 'materials'>('test');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [candidateExamsMap, setCandidateExamsMap] = useState<Record<string, Candidate>>({});
  
  // Load status for all exams taken by this student's phone
  useEffect(() => {
    if (candidate?.phone) {
      candidateService.getCandidatesByPhone(candidate.phone)
        .then((records) => {
          const map: Record<string, Candidate> = {};
          records.forEach((r) => {
            const exId = r.examId || 'default-exam';
            if (!map[exId] || (!map[exId].submittedAt && r.submittedAt)) {
              map[exId] = r;
            }
          });
          setCandidateExamsMap(map);
        })
        .catch((err) => console.warn('Error loading candidate exam statuses:', err));
    }
  }, [candidate?.phone, candidate?.examId, activeExam?.id]);
  
  // Preview Modal States
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [previewType, setPreviewType] = useState<'video' | 'audio' | 'pdf' | 'image' | 'word' | null>(null);
  const [audioError, setAudioError] = useState(false);

  const getProxiedUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    return `/api/audio-proxy?url=${encodeURIComponent(url)}`;
  };

  const t = (key: Parameters<typeof languageService.t>[0]) => languageService.t(key);

  const getExamSkills = () => {
    if (!activeExam || activeExam.id === 'default-exam') {
      return ['Listening', 'Speaking', 'Grammar', 'Vocabulary', 'Reading', 'Writing'];
    }
    const q = activeExam.questions || {};
    const skills: string[] = [];
    if (q.listeningPart1?.length > 0 || q.listeningPart2?.length > 0) skills.push('Listening');
    if (q.speakingQuestions?.length > 0 || q.speakingReadAloud?.text?.trim()) skills.push('Speaking');
    if (q.grammar?.length > 0) skills.push('Grammar');
    if (q.vocabulary?.length > 0) skills.push('Vocabulary');
    if (q.readingPassage?.questionsPartA?.length > 0 || q.readingPassage?.questionsPartB?.length > 0 || q.readingPassage?.text?.trim()) skills.push('Reading');
    if (q.writingQuestions?.length > 0) skills.push('Writing');
    return skills.length > 0 ? skills : ['Tổng hợp'];
  };

  const currentSkills = getExamSkills();

  // Filter materials based on search and category
  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    
    const cleanUrl = (m.url || '').split('?')[0].split('#')[0].toLowerCase();
    const type = (m.type || '').toLowerCase();
    const fileName = (m.fileName || '').toLowerCase();

    if (selectedCategory === 'pdf') return type === 'pdf' || cleanUrl.endsWith('.pdf') || fileName.endsWith('.pdf');
    if (selectedCategory === 'docx') return type === 'docx' || type === 'doc' || cleanUrl.endsWith('.doc') || cleanUrl.endsWith('.docx') || fileName.endsWith('.docx');
    if (selectedCategory === 'video') return type === 'video' || m.url.toLowerCase().includes('youtu') || cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov');
    if (selectedCategory === 'audio') return type === 'audio' || cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.ogg');
    if (selectedCategory === 'image') return type === 'image' || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.gif') || cleanUrl.endsWith('.svg') || fileName.endsWith('.png') || fileName.endsWith('.jpg');
    if (selectedCategory === 'link') return type === 'link';
    return true;
  });

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : '';
  };

  const handleOpenPreview = (mat: Material) => {
    setPreviewMaterial(mat);
  };

  const getMaterialIcon = (mat: Material) => {
    const cleanUrl = (mat.url || '').split('?')[0].split('#')[0].toLowerCase();
    const type = (mat.type || '').toLowerCase();
    const fileName = (mat.fileName || '').toLowerCase();

    if (type === 'pdf' || cleanUrl.endsWith('.pdf') || fileName.endsWith('.pdf')) return <FileText className="w-5 h-5 text-red-500 dark:text-red-400" />;
    if (type === 'docx' || type === 'doc' || cleanUrl.endsWith('.docx') || cleanUrl.endsWith('.doc') || fileName.endsWith('.docx')) return <FileCode className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
    if (type === 'video' || mat.url.toLowerCase().includes('youtu') || cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm')) return <Video className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
    if (type === 'audio' || cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a')) return <Headphones className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />;
    if (type === 'image' || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.svg') || fileName.endsWith('.png') || fileName.endsWith('.jpg')) return <ImageIcon className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
    if (type === 'link') return <ExternalLink className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />;
    return <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
  };

  const getMaterialTypeBadge = (mat: Material) => {
    const cleanUrl = (mat.url || '').split('?')[0].split('#')[0].toLowerCase();
    const type = (mat.type || '').toLowerCase();
    const fileName = (mat.fileName || '').toLowerCase();

    if (type === 'pdf' || cleanUrl.endsWith('.pdf') || fileName.endsWith('.pdf')) return { text: 'Tài liệu PDF', bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' };
    if (type === 'docx' || type === 'doc' || cleanUrl.endsWith('.docx') || cleanUrl.endsWith('.doc') || fileName.endsWith('.docx')) return { text: 'File Word', bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' };
    if (type === 'video' || mat.url.toLowerCase().includes('youtu') || cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm')) return { text: 'Video bài giảng', bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' };
    if (type === 'audio' || cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.m4a')) return { text: 'Audio bài nghe', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' };
    if (type === 'image' || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.svg') || fileName.endsWith('.png') || fileName.endsWith('.jpg')) return { text: 'Hình ảnh', bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' };
    if (type === 'link') return { text: 'Liên kết ngoài', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800' };
    return { text: 'Tài liệu học tập', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' };
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b111e] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="bg-indigo-950 text-white shadow-lg sticky top-0 z-40 border-b border-indigo-900 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center shadow-inner">
              <Award className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="text-sm md:text-base font-black tracking-tight uppercase text-white leading-tight">
                {settings.centerName || 'English Placement Test'}
              </div>
              <div className="text-[10px] md:text-xs text-indigo-200 font-medium">
                Cổng thông tin & Học liệu Thí sinh
              </div>
            </div>
          </div>

          {/* User info & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-white flex items-center gap-1 justify-end">
                <GraduationCap className="w-3.5 h-3.5 text-amber-300" /> {candidate?.fullName}
              </span>
              <span className="text-[11px] text-indigo-300 font-mono">{candidate?.phone}</span>
            </div>

            {/* Dark Mode Toggle */}
            {onToggleDarkMode && (
              <button
                onClick={onToggleDarkMode}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer border border-white/15"
                title={darkMode ? 'Chuyển giao diện Sáng' : 'Chuyển giao diện Tối'}
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-200" />}
              </button>
            )}

            <LanguageToggle />

            <button
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
              title="Đăng xuất / Đổi thí sinh"
            >
              <LogOut className="w-4 h-4 text-rose-300" />
              <span className="hidden sm:inline">Thoát</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-grow">
        {/* Welcome Greeting Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-bold text-indigo-200 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Cổng học tập & khảo thí trực tuyến
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Xin chào, <span className="text-amber-300">{candidate?.fullName}</span>!
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 font-normal leading-relaxed">
              Bạn có <strong>02 lựa chọn</strong>: Bấm <strong>"Làm bài kiểm tra"</strong> để tiến hành bài thi khảo sát năng lực 6 kỹ năng hoặc bấm <strong>"Xem tài liệu học tập"</strong> để tra cứu đề cương và bài giảng do giáo viên tải lên.
            </p>
          </div>
        </div>

        {/* 2 Main Choice Cards / Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* LỰA CHỌN 1: LÀM BÀI TEST */}
          <button
            id="tab-test-choice"
            onClick={() => setActiveTab('test')}
            className={`p-6 sm:p-7 rounded-3xl border-2 transition-all duration-200 text-left flex items-start gap-4 cursor-pointer relative overflow-hidden ${
              activeTab === 'test'
                ? 'bg-white dark:bg-slate-900 border-indigo-900 dark:border-indigo-500 shadow-xl ring-4 ring-indigo-900/10 dark:ring-indigo-500/20'
                : 'bg-white/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <div className={`p-4 rounded-2xl shrink-0 ${activeTab === 'test' ? 'bg-indigo-900 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
              <Award className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 flex-grow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-400">Lựa chọn 1</span>
                {activeTab === 'test' ? (
                  <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-300 rounded-full text-[10px] font-bold">Đang xem</span>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Bấm để chọn</span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">1. LÀM BÀI KIỂM TRA (TEST)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Tham gia thi {currentSkills.length} kỹ năng ({currentSkills.join(', ')}) với đồng hồ tính giờ tự động.
              </p>
            </div>
          </button>

          {/* LỰA CHỌN 2: XEM TÀI LIỆU ADMIN TẢI LÊN */}
          <button
            id="tab-materials-choice"
            onClick={() => setActiveTab('materials')}
            className={`p-6 sm:p-7 rounded-3xl border-2 transition-all duration-200 text-left flex items-start gap-4 cursor-pointer relative overflow-hidden ${
              activeTab === 'materials'
                ? 'bg-white dark:bg-slate-900 border-indigo-900 dark:border-indigo-500 shadow-xl ring-4 ring-indigo-900/10 dark:ring-indigo-500/20'
                : 'bg-white/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <div className={`p-4 rounded-2xl shrink-0 ${activeTab === 'materials' ? 'bg-indigo-900 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 flex-grow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-400">Lựa chọn 2</span>
                <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 rounded-full text-[10px] font-bold font-mono border border-indigo-200 dark:border-indigo-800">
                  {materials.length} tài liệu
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">2. XEM TÀI LIỆU HỌC TẬP</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Tra cứu, xem và tải về toàn bộ các tài liệu PDF, file Word, video bài giảng, tệp audio ôn tập do Admin/Giáo viên tải lên.
              </p>
            </div>
          </button>
        </div>

        {/* Tab Content 1: LÀM BÀI KIỂM TRA */}
        {activeTab === 'test' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-400 uppercase tracking-wide mb-1">
                    <Award className="w-4 h-4" /> Thông tin bài kiểm tra
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {activeExam?.title || 'English Placement Test'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                    {activeExam?.description || `Bài kiểm tra tiếng Anh đánh giá năng lực ${currentSkills.join(', ')} theo chuẩn quốc tế.`}
                  </p>
                </div>

                {/* Exam Selector Dropdown & Quick Switcher */}
                {exams.length > 1 && (
                  <div className="w-full lg:w-80 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5 flex items-center justify-between">
                      <span>Chọn bộ đề thi khác:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold lowercase">({exams.length} đề)</span>
                    </label>
                    <select
                      value={activeExam?.id || exams[0]?.id}
                      onChange={(e) => onSelectExam(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-900 cursor-pointer"
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} ({ex.durationMinutes || 45} phút){ex.isClosed ? ' [ĐÃ ĐÓNG]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* All Available Exams Card Grid (if > 1 exam exists) */}
              {exams.length > 1 && (
                <div className="py-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Danh sách các bộ đề thi ({exams.length} đề):
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Bấm vào đề bất kỳ để chuyển đề
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {exams.map((ex) => {
                      const isCurrent = (activeExam?.id || exams[0]?.id) === ex.id;
                      const cardCand = candidateExamsMap[ex.id] || (candidate?.examId === ex.id ? candidate : null);
                      const isCardSubmitted = Boolean(cardCand?.submittedAt);
                      const isCardInProgress = Boolean(!isCardSubmitted && cardCand?.durationSeconds && cardCand.durationSeconds > 0);
                      
                      // Calculate skills for this exam
                      const q = ex.questions || {};
                      const exSkills: string[] = [];
                      if (q.listeningPart1?.length > 0 || q.listeningPart2?.length > 0) exSkills.push('Listening');
                      if (q.speakingQuestions?.length > 0 || q.speakingReadAloud?.text?.trim()) exSkills.push('Speaking');
                      if (q.grammar?.length > 0) exSkills.push('Grammar');
                      if (q.vocabulary?.length > 0) exSkills.push('Vocabulary');
                      if (q.readingPassage?.questionsPartA?.length > 0 || q.readingPassage?.questionsPartB?.length > 0 || q.readingPassage?.text?.trim()) exSkills.push('Reading');
                      if (q.writingQuestions?.length > 0) exSkills.push('Writing');
                      const displaySkills = exSkills.length > 0 ? exSkills : ['Tổng hợp'];

                      return (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => onSelectExam(ex.id)}
                          className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                            isCurrent
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-900 dark:border-indigo-500 shadow-sm ring-2 ring-indigo-900/10'
                              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-black text-slate-900 dark:text-slate-100 line-clamp-1">
                                {ex.title}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-indigo-600" /> {ex.durationMinutes || 45}p
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {ex.description || 'Đề thi khảo sát năng lực tiếng Anh'}
                            </p>
                            
                            {/* Exam Status Badge */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex flex-wrap gap-1">
                                {displaySkills.map((sk) => (
                                  <span
                                    key={sk}
                                    className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded text-[9px] font-semibold"
                                  >
                                    {sk}
                                  </span>
                                ))}
                              </div>

                              {isCardSubmitted ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shrink-0">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Đã nộp
                                </span>
                              ) : isCardInProgress ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Đang làm
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-150 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                                  Chưa thi
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                            {isCurrent ? (
                              <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Đang chọn
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1">
                                Bấm để đổi sang đề này <ChevronRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Exam Info Matrix */}
              {(() => {
                const currentActiveCand = candidateExamsMap[activeExam?.id] || (candidate?.examId === activeExam?.id ? candidate : null);
                const isCurrentSubmitted = Boolean(currentActiveCand?.submittedAt);
                const isCurrentInProgress = Boolean(!isCurrentSubmitted && currentActiveCand?.durationSeconds && currentActiveCand.durationSeconds > 0);

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Thời gian làm bài
                        </div>
                        <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                          {activeExam?.durationMinutes || 45} Phút
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Số phần thi
                        </div>
                        <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                          {currentSkills.length} Kỹ năng
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Trạng thái
                        </div>
                        <div className="text-sm font-black mt-1">
                          {isCurrentSubmitted ? (
                            <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">Đã nộp bài</span>
                          ) : isCurrentInProgress ? (
                            <span className="text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">Đang làm dở</span>
                          ) : (
                            <span className="text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">Sẵn sàng</span>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Giáo viên phụ trách
                        </div>
                        <div className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                          {settings.teacherName || 'Teacher Anna'}
                        </div>
                      </div>
                    </div>

                    {/* Instructions list */}
                    <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-4 sm:p-5 mb-6 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                      <div className="font-bold uppercase tracking-wide flex items-center gap-1.5 text-amber-950 dark:text-amber-300">
                        <HelpCircle className="w-4 h-4" /> Lưu ý quy chế phòng thi:
                      </div>
                      <ul className="list-disc list-inside space-y-1 pl-1">
                        <li>Chuẩn bị tai nghe hoặc loa để làm bài nghe Listening (Mỗi bài audio chỉ được nghe 01 lần duy nhất).</li>
                        <li>Cấp quyền Micro trên trình duyệt để ghi âm phần thi Speaking.</li>
                        <li>Hạn chế chuyển tab hoặc thoát ứng dụng để tránh bị ghi nhận vi phạm gian lận.</li>
                        <li>Đáp án được tự động lưu liên tục lên máy chủ đám mây.</li>
                      </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => setActiveTab('materials')}
                        className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4" /> Xem tài liệu ôn tập trước
                      </button>

                      <button
                        id="start-exam-button"
                        onClick={onStartTest}
                        className="w-full sm:w-auto px-8 py-4 bg-indigo-900 hover:bg-indigo-850 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-extrabold rounded-2xl text-sm shadow-xl shadow-indigo-950/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isCurrentSubmitted
                          ? 'XEM LẠI KẾT QUẢ BÀI THI'
                          : isCurrentInProgress
                          ? 'TIẾP TỤC LÀM BÀI THI'
                          : 'BẮT ĐẦU VÀO LÀM BÀI'}{' '}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}

        {/* Tab Content 2: KHO TÀI LIỆU HỌC TẬP */}
        {activeTab === 'materials' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Search & Category Filter Controls */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                <div className="relative flex-grow max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm tài liệu theo tiêu đề, từ khóa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-900 dark:focus:ring-indigo-500 text-slate-800 dark:text-slate-100 transition-all"
                  />
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold text-right">
                  Hiển thị <span className="text-indigo-900 dark:text-indigo-400 font-bold">{filteredMaterials.length}</span> tài liệu
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {[
                  { id: 'all', label: 'Tất cả', icon: BookOpen },
                  { id: 'pdf', label: 'Tài liệu PDF', icon: FileText },
                  { id: 'docx', label: 'File Word', icon: FileCode },
                  { id: 'video', label: 'Video bài giảng', icon: Video },
                  { id: 'audio', label: 'Audio bài nghe', icon: Headphones },
                  { id: 'image', label: 'Hình ảnh', icon: ImageIcon },
                  { id: 'link', label: 'Liên kết ngoài', icon: ExternalLink }
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-900 dark:bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Materials Grid */}
            {filteredMaterials.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-3">
                <BookOpen className="w-12 h-12 mx-auto stroke-1 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Không tìm thấy tài liệu phù hợp</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Giáo viên sẽ sớm bổ sung thêm tài liệu học tập trong chuyên mục này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMaterials.map((mat) => {
                  const badge = getMaterialTypeBadge(mat);
                  const isEmbedVideo = mat.type === 'video' || mat.url.includes('youtu') || mat.url.endsWith('.mp4');
                  const isAudio = mat.type === 'audio' || mat.url.endsWith('.mp3') || mat.url.endsWith('.wav');
                  const isDoc = mat.type === 'pdf' || mat.type === 'docx' || mat.url.endsWith('.pdf') || mat.url.endsWith('.docx') || mat.url.endsWith('.doc');

                  return (
                    <motion.div
                      key={mat.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${badge.bg}`}>
                            {badge.text}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {mat.createdAt ? new Date(mat.createdAt).toLocaleDateString('vi-VN') : ''}
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shrink-0 group-hover:scale-105 transition-transform">
                            {getMaterialIcon(mat)}
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                              {mat.title}
                            </h4>
                            {mat.fileName && (
                              <div className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                                📁 {mat.fileName}
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                          {mat.description || 'Tài liệu ôn tập và bài giảng hướng dẫn do giáo viên cung cấp.'}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                        {/* Primary View / Play Button */}
                        <button
                          onClick={() => handleOpenPreview(mat)}
                          className="flex-1 bg-indigo-900 hover:bg-indigo-850 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {isEmbedVideo ? (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" /> Xem Video
                            </>
                          ) : isAudio ? (
                            <>
                              <Volume2 className="w-3.5 h-3.5" /> Nghe Audio
                            </>
                          ) : isDoc ? (
                            <>
                              <Eye className="w-3.5 h-3.5" /> Xem / Tải về
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3.5 h-3.5" /> Mở liên kết
                            </>
                          )}
                        </button>

                        {/* Direct Download button if file */}
                        {mat.url && (
                          <a
                            href={mat.url}
                            download={mat.fileName || mat.title}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                            title="Tải xuống tệp tin"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div>
            © {new Date().getFullYear()} <strong>{settings.centerName || 'English Placement Test'}</strong>. All Rights Reserved.
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            {settings.teacherPhone && (
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                <Phone className="w-3.5 h-3.5 text-indigo-900 dark:text-indigo-400" /> {settings.teacherPhone}
              </span>
            )}
            <span>Giáo viên: {settings.teacherName || 'Teacher Anna'}</span>
          </div>
        </div>
      </footer>

      {/* PREVIEW / PLAY MODAL FOR ALL MEDIA & DOCX */}
      <DocumentReaderModal
        isOpen={!!previewMaterial}
        material={previewMaterial}
        onClose={() => {
          setPreviewMaterial(null);
          setPreviewType(null);
        }}
      />
    </div>
  );
}
