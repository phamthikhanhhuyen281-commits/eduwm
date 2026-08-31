import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  FileText,
  FileCode,
  Video,
  Headphones,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  AlertCircle,
  Loader2,
  BookOpen
} from 'lucide-react';
import mammoth from 'mammoth';

interface DocumentReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: {
    id?: string;
    title: string;
    description?: string;
    url: string;
    type?: string;
    fileName?: string;
    fileSize?: number;
    createdAt?: string;
  } | null;
}

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({
  isOpen,
  onClose,
  material
}) => {
  const [loading, setLoading] = useState(false);
  const [docHtml, setDocHtml] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(16);
  const [isSerif, setIsSerif] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Determine media type
  const urlLower = (material?.url || '').toLowerCase();
  const typeLower = (material?.type || '').toLowerCase();

  const isWordDoc =
    typeLower === 'docx' ||
    typeLower === 'doc' ||
    urlLower.endsWith('.docx') ||
    urlLower.endsWith('.doc') ||
    urlLower.includes('word') ||
    (material?.fileName && (material.fileName.endsWith('.docx') || material.fileName.endsWith('.doc')));

  const isPdf =
    typeLower === 'pdf' ||
    urlLower.endsWith('.pdf') ||
    (material?.fileName && material.fileName.endsWith('.pdf'));

  const isVideo =
    typeLower === 'video' ||
    urlLower.includes('youtube.com') ||
    urlLower.includes('youtu.be') ||
    urlLower.endsWith('.mp4') ||
    urlLower.endsWith('.webm') ||
    urlLower.endsWith('.mov');

  const isAudio =
    typeLower === 'audio' ||
    urlLower.endsWith('.mp3') ||
    urlLower.endsWith('.wav') ||
    urlLower.endsWith('.m4a') ||
    urlLower.endsWith('.ogg');

  const isImage =
    typeLower === 'image' ||
    urlLower.endsWith('.png') ||
    urlLower.endsWith('.jpg') ||
    urlLower.endsWith('.jpeg') ||
    urlLower.endsWith('.webp');

  // Convert Base64 or URL to ArrayBuffer and render with Mammoth for DOCX
  useEffect(() => {
    if (!isOpen || !material) {
      setDocHtml('');
      setRawText('');
      setError(null);
      return;
    }

    if (isWordDoc) {
      let isMounted = true;
      setLoading(true);
      setError(null);

      const loadWordDocument = async () => {
        try {
          let arrayBuffer: ArrayBuffer;

          if (material.url.startsWith('data:')) {
            // Base64 data URL
            const base64Content = material.url.split(',')[1];
            const binaryString = window.atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            arrayBuffer = bytes.buffer;
          } else {
            // Remote or relative URL
            const fetchUrl = material.url.startsWith('http')
              ? `/api/audio-proxy?url=${encodeURIComponent(material.url)}`
              : material.url;
            const res = await fetch(fetchUrl);
            if (!res.ok) throw new Error('Không thể tải tệp từ máy chủ.');
            arrayBuffer = await res.arrayBuffer();
          }

          // Mammoth conversion to rich HTML
          const result = await mammoth.convertToHtml({ arrayBuffer });
          const textResult = await mammoth.extractRawText({ arrayBuffer });

          if (isMounted) {
            setDocHtml(result.value || '<p class="text-slate-500 italic">Tài liệu không có nội dung văn bản.</p>');
            setRawText(textResult.value || '');
            setLoading(false);
          }
        } catch (err: any) {
          console.warn('Mammoth DOCX parsing failed:', err);
          if (isMounted) {
            setError('Không thể tự động phân tích định dạng tệp Word này trực tiếp. Bạn có thể tải tệp về máy hoặc mở qua Office Online.');
            setLoading(false);
          }
        }
      };

      loadWordDocument();

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, material, isWordDoc]);

  if (!isOpen || !material) return null;

  const handleCopyText = () => {
    if (!rawText && !contentRef.current) return;
    const textToCopy = rawText || contentRef.current?.innerText || '';
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[12000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className={`bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 transition-all duration-300 ${
            isFullscreen ? 'w-full h-full rounded-none' : 'max-w-5xl w-full max-h-[92vh] h-[92vh]'
          }`}
        >
          {/* Top Bar Header */}
          <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between gap-4 select-none shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-slate-800 rounded-xl text-indigo-300 shrink-0">
                {isWordDoc ? (
                  <FileCode className="w-5 h-5 text-blue-400" />
                ) : isPdf ? (
                  <FileText className="w-5 h-5 text-red-400" />
                ) : isVideo ? (
                  <Video className="w-5 h-5 text-purple-400" />
                ) : isAudio ? (
                  <Headphones className="w-5 h-5 text-emerald-400" />
                ) : isImage ? (
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                ) : (
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black truncate text-white leading-snug">{material.title}</h3>
                <p className="text-[11px] text-slate-400 truncate font-mono">
                  {material.fileName || material.type?.toUpperCase() || 'TÀI LIỆU HỌC TẬP'}
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Fullscreen Toggle */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-slate-300 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="text-slate-300 hover:text-white p-2 hover:bg-red-600 rounded-xl transition-colors cursor-pointer ml-1"
                title="Đóng trình đọc"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sub-toolbar (Only for Document/Word/PDF view) */}
          {isWordDoc && !loading && !error && (
            <div className="bg-slate-100 border-b border-slate-200 px-5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              {/* Left Toolbar: Font size & Typography */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Cỡ chữ:</span>
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-bold text-slate-700 cursor-pointer shadow-xs"
                  title="Giảm cỡ chữ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-slate-700 font-bold px-1">{fontSize}px</span>
                <button
                  onClick={() => setFontSize(Math.min(28, fontSize + 2))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-bold text-slate-700 cursor-pointer shadow-xs"
                  title="Tăng cỡ chữ"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setFontSize(16)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer ml-1"
                  title="Đặt lại cỡ chữ"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-300 mx-2" />

                {/* Serif Toggle */}
                <button
                  onClick={() => setIsSerif(!isSerif)}
                  className={`px-3 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                    isSerif
                      ? 'bg-indigo-900 text-white border-indigo-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Đổi font chữ Sách báo / Chuẩn"
                >
                  {isSerif ? 'Font Sách (Serif)' : 'Font Chuẩn (Sans)'}
                </button>
              </div>

              {/* Right Toolbar: Copy, Print, Download */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyText}
                  className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Sao chép toàn bộ văn bản"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? 'Đã sao chép!' : 'Sao chép văn bản'}
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="In tài liệu"
                >
                  <Printer className="w-3.5 h-3.5" /> In
                </button>
                <a
                  href={material.url}
                  download={material.fileName || `${material.title}.docx`}
                  className="px-3 py-1 bg-indigo-900 hover:bg-indigo-850 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Tải file về máy"
                >
                  <Download className="w-3.5 h-3.5" /> Tải về máy
                </a>
              </div>
            </div>
          )}

          {/* Main Viewer Body */}
          <div className="flex-grow overflow-y-auto bg-slate-100/70 p-4 sm:p-8 flex justify-center items-start">
            {/* 1. WORD DOCUMENT VIEW (.docx / .doc) */}
            {isWordDoc && (
              <div className="w-full max-w-4xl flex flex-col items-center">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                    <p className="text-sm font-bold text-slate-700">Đang đọc và định dạng tệp Word trực tiếp...</p>
                    <p className="text-xs text-slate-400">Đang chuyển đổi bảng biểu, hình ảnh và cấu trúc văn bản</p>
                  </div>
                ) : error ? (
                  <div className="bg-white border border-amber-200 rounded-3xl p-8 max-w-md text-center space-y-4 shadow-sm my-8">
                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Không thể xem trực tiếp tệp Word này</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
                    <div className="flex flex-col gap-2 pt-2">
                      <a
                        href={material.url}
                        download={material.fileName || `${material.title}.docx`}
                        className="w-full py-3 bg-indigo-900 hover:bg-indigo-850 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                      >
                        <Download className="w-4 h-4" /> Tải file Word về máy để đọc
                      </a>
                      <a
                        href={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(material.url)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200"
                      >
                        <ExternalLink className="w-4 h-4" /> Mở qua Microsoft Office Online
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Rendered Word Document Page (A4 Paper Style) */
                  <div
                    ref={contentRef}
                    style={{ fontSize: `${fontSize}px` }}
                    className={`bg-white text-slate-900 w-full min-h-[850px] p-8 sm:p-14 rounded-2xl shadow-lg border border-slate-200/80 leading-relaxed ${
                      isSerif ? 'font-serif' : 'font-sans'
                    } docx-rendered-content`}
                  >
                    {/* Document Header Meta */}
                    <div className="border-b border-slate-200 pb-6 mb-8">
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-950 mb-2 leading-tight">
                        {material.title}
                      </h1>
                      {material.description && (
                        <p className="text-slate-600 text-sm italic mb-2">
                          {material.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                        {material.fileName && <span>📁 {material.fileName}</span>}
                        {material.createdAt && (
                          <span>🕒 {new Date(material.createdAt).toLocaleDateString('vi-VN')}</span>
                        )}
                      </div>
                    </div>

                    {/* Word Converted HTML */}
                    <div
                      dangerouslySetInnerHTML={{ __html: docHtml }}
                      className="prose max-w-none space-y-4"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 2. PDF DOCUMENT VIEW */}
            {isPdf && (
              <div className="w-full h-full min-h-[75vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                <object
                  data={`${material.url}#toolbar=1`}
                  type="application/pdf"
                  className="w-full h-full min-h-[75vh] rounded-2xl"
                >
                  <iframe
                    src={`${material.url}#toolbar=1`}
                    title={material.title}
                    className="w-full h-full min-h-[75vh] border-0"
                  >
                    <div className="p-8 text-center space-y-4">
                      <p className="text-slate-600">Trình duyệt không hỗ trợ nhúng trực tiếp PDF.</p>
                      <a
                        href={material.url}
                        download
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-900 text-white rounded-xl font-bold text-xs"
                      >
                        <Download className="w-4 h-4" /> Tải về để xem
                      </a>
                    </div>
                  </iframe>
                </object>
              </div>
            )}

            {/* 3. VIDEO VIEW */}
            {isVideo && (
              <div className="w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center">
                {material.url.includes('youtube') || material.url.includes('youtu.be') ? (
                  <iframe
                    src={getYoutubeEmbedUrl(material.url)}
                    title={material.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={material.url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}

            {/* 4. AUDIO VIEW */}
            {isAudio && (
              <div className="w-full max-w-lg bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6 my-auto">
                <div className="w-24 h-24 bg-indigo-50 text-indigo-900 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Headphones className="w-12 h-12" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">{material.title}</h4>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {material.description || 'Bài nghe luyện thi và bài giảng âm thanh.'}
                  </p>
                </div>
                <audio
                  src={audioError ? material.url : getProxiedUrl(material.url)}
                  controls
                  autoPlay
                  onError={() => setAudioError(true)}
                  className="w-full h-12"
                />
                <div className="pt-2">
                  <a
                    href={material.url}
                    download={material.fileName || `${material.title}.mp3`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Tải file Audio về máy
                  </a>
                </div>
              </div>
            )}

            {/* 5. IMAGE VIEW */}
            {isImage && (
              <div className="w-full max-w-4xl flex flex-col items-center justify-center space-y-4">
                <div className="bg-white p-3 rounded-3xl shadow-xl border border-slate-200">
                  <img
                    src={material.url}
                    alt={material.title}
                    className="max-h-[75vh] max-w-full object-contain rounded-2xl"
                  />
                </div>
                <p className="text-xs text-slate-500 text-center">{material.title}</p>
              </div>
            )}

            {/* 6. GENERIC / LINK VIEW */}
            {!isWordDoc && !isPdf && !isVideo && !isAudio && !isImage && (
              <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6 my-auto">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-900 rounded-full flex items-center justify-center mx-auto">
                  <ExternalLink className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900">{material.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {material.description || 'Liên kết học liệu trực tuyến ngoài.'}
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-indigo-900 hover:bg-indigo-850 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" /> Mở trang web liên kết
                  </a>
                  <a
                    href={material.url}
                    download={material.fileName || material.title}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Tải về máy
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
            <div className="text-slate-500 text-[11px] truncate max-w-md">
              💡 {isWordDoc ? 'Bạn đang đọc trực tiếp văn bản Word trên trình duyệt web.' : 'Trình xem tài liệu học tập trực tiếp.'}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={material.url}
                download={material.fileName || material.title}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Tải về
              </a>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-indigo-900 hover:bg-indigo-850 text-white font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
