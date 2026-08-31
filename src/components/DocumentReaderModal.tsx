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
  BookOpen,
  RefreshCw,
  FileSpreadsheet
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
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<boolean>(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<'mammoth' | 'gview' | 'office' | 'rawText'>('mammoth');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const urlLower = (material?.url || '').toLowerCase();
  const typeLower = (material?.type || '').toLowerCase();
  const fileNameLower = (material?.fileName || '').toLowerCase();

  // Helper: Detect Google Drive, Docs, Sheets, Slides, Forms
  const getGoogleEmbedInfo = (url: string) => {
    if (!url) return null;
    
    // Google Drive File
    // e.g. https://drive.google.com/file/d/1A2B3C.../view?usp=sharing or https://drive.google.com/open?id=1A2B3C...
    const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/);
    if (driveMatch) {
      const fileId = driveMatch[1] || driveMatch[2];
      return {
        type: 'gdrive',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        title: 'Google Drive Document'
      };
    }

    // Google Docs Document
    const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch) {
      return {
        type: 'gdocs',
        embedUrl: `https://docs.google.com/document/d/${docsMatch[1]}/preview`,
        title: 'Google Docs Document'
      };
    }

    // Google Sheets Spreadsheet
    const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetsMatch) {
      return {
        type: 'gsheets',
        embedUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview`,
        title: 'Google Sheets Spreadsheet'
      };
    }

    // Google Slides Presentation
    const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (slidesMatch) {
      return {
        type: 'gslides',
        embedUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed?start=false&loop=false&delayms=3000`,
        title: 'Google Slides Presentation'
      };
    }

    // Google Forms
    const formsMatch = url.match(/docs\.google\.com\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
    if (formsMatch) {
      return {
        type: 'gforms',
        embedUrl: `https://docs.google.com/forms/d/${formsMatch[1]}/viewform?embedded=true`,
        title: 'Google Form'
      };
    }

    return null;
  };

  const googleEmbedInfo = getGoogleEmbedInfo(material?.url || '');

  // Media Type Flags
  const isWordDoc =
    !googleEmbedInfo &&
    (typeLower === 'docx' ||
      typeLower === 'doc' ||
      urlLower.endsWith('.docx') ||
      urlLower.endsWith('.doc') ||
      fileNameLower.endsWith('.docx') ||
      fileNameLower.endsWith('.doc') ||
      (typeLower === 'document' && !urlLower.endsWith('.pdf')));

  const isPdf =
    !googleEmbedInfo &&
    (typeLower === 'pdf' ||
      urlLower.endsWith('.pdf') ||
      fileNameLower.endsWith('.pdf') ||
      material?.url?.startsWith('data:application/pdf'));

  const isVideo =
    !googleEmbedInfo &&
    (typeLower === 'video' ||
      urlLower.includes('youtube.com') ||
      urlLower.includes('youtu.be') ||
      urlLower.includes('vimeo.com') ||
      urlLower.endsWith('.mp4') ||
      urlLower.endsWith('.webm') ||
      urlLower.endsWith('.mov') ||
      urlLower.endsWith('.m4v') ||
      fileNameLower.endsWith('.mp4'));

  const isAudio =
    !googleEmbedInfo &&
    (typeLower === 'audio' ||
      urlLower.endsWith('.mp3') ||
      urlLower.endsWith('.wav') ||
      urlLower.endsWith('.m4a') ||
      urlLower.endsWith('.ogg') ||
      urlLower.endsWith('.aac') ||
      fileNameLower.endsWith('.mp3') ||
      fileNameLower.endsWith('.wav'));

  const isImage =
    !googleEmbedInfo &&
    (typeLower === 'image' ||
      urlLower.endsWith('.png') ||
      urlLower.endsWith('.jpg') ||
      urlLower.endsWith('.jpeg') ||
      urlLower.endsWith('.webp') ||
      urlLower.endsWith('.gif') ||
      urlLower.endsWith('.svg') ||
      material?.url?.startsWith('data:image/'));

  const isSpreadsheet =
    !googleEmbedInfo &&
    (typeLower === 'xlsx' ||
      typeLower === 'xls' ||
      typeLower === 'csv' ||
      urlLower.endsWith('.xlsx') ||
      urlLower.endsWith('.xls') ||
      urlLower.endsWith('.csv') ||
      fileNameLower.endsWith('.xlsx') ||
      fileNameLower.endsWith('.xls') ||
      fileNameLower.endsWith('.csv'));

  const isPresentation =
    !googleEmbedInfo &&
    (typeLower === 'pptx' ||
      typeLower === 'ppt' ||
      urlLower.endsWith('.pptx') ||
      urlLower.endsWith('.ppt') ||
      fileNameLower.endsWith('.pptx') ||
      fileNameLower.endsWith('.ppt'));

  const isTextFile =
    !googleEmbedInfo &&
    (typeLower === 'txt' ||
      typeLower === 'text' ||
      typeLower === 'md' ||
      urlLower.endsWith('.txt') ||
      urlLower.endsWith('.md') ||
      urlLower.endsWith('.json') ||
      fileNameLower.endsWith('.txt') ||
      fileNameLower.endsWith('.md'));

  // Clean up Blob URLs on unmount/close
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // Convert Base64 PDF to blob URL for full native browser compatibility
  useEffect(() => {
    if (!isOpen || !material) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      return;
    }

    if (isPdf && material.url.startsWith('data:')) {
      try {
        const parts = material.url.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const b64 = parts[1];
        const binary = window.atob(b64);
        const len = binary.length;
        const buffer = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          buffer[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([buffer], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
      } catch (err) {
        console.warn('Failed to convert base64 PDF to blob:', err);
      }
    } else {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
    }
  }, [isOpen, material?.url, isPdf]);

  // Load Word (.docx) or Text Files
  useEffect(() => {
    if (!isOpen || !material) {
      setDocHtml('');
      setRawText('');
      setError(null);
      setViewerMode('mammoth');
      return;
    }

    if (isTextFile) {
      let isMounted = true;
      setLoading(true);
      setError(null);

      const loadText = async () => {
        try {
          let text = '';
          if (material.url.startsWith('data:')) {
            const base64Content = material.url.split(',')[1];
            text = decodeURIComponent(escape(window.atob(base64Content)));
          } else {
            const fetchUrl = material.url.startsWith('http')
              ? `/api/audio-proxy?url=${encodeURIComponent(material.url)}`
              : material.url;
            const res = await fetch(fetchUrl);
            text = await res.text();
          }
          if (isMounted) {
            setRawText(text);
            setDocHtml(`<pre class="whitespace-pre-wrap font-mono text-sm leading-relaxed">${text}</pre>`);
            setLoading(false);
          }
        } catch (e: any) {
          if (isMounted) {
            setError('Không thể tải tệp văn bản này.');
            setLoading(false);
          }
        }
      };

      loadText();
      return () => {
        isMounted = false;
      };
    }

    if (isWordDoc) {
      let isMounted = true;
      setLoading(true);
      setError(null);
      setViewerMode('mammoth');

      const loadWordDocument = async () => {
        try {
          let arrayBuffer: ArrayBuffer;

          if (material.url.startsWith('data:')) {
            const base64Content = material.url.split(',')[1];
            const binaryString = window.atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            arrayBuffer = bytes.buffer;
          } else {
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
            // Fallback: If it's a remote URL, offer Google Docs Viewer or Office Viewer
            if (material.url.startsWith('http')) {
              setViewerMode('gview');
              setLoading(false);
            } else {
              setError('Không thể phân tích trực tiếp định dạng tệp Word này. Bạn có thể tải tệp về máy để đọc hoặc xem online.');
              setLoading(false);
            }
          }
        }
      };

      loadWordDocument();

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, material, isWordDoc, isTextFile]);

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

  const activePdfUrl = pdfBlobUrl || material.url;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[12000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className={`bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 transition-all duration-300 ${
            isFullscreen ? 'w-full h-full rounded-none' : 'max-w-6xl w-full max-h-[94vh] h-[94vh]'
          }`}
        >
          {/* TOP BAR HEADER */}
          <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between gap-4 select-none shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-slate-800 rounded-xl text-indigo-300 shrink-0">
                {googleEmbedInfo ? (
                  <BookOpen className="w-5 h-5 text-amber-400" />
                ) : isWordDoc ? (
                  <FileCode className="w-5 h-5 text-blue-400" />
                ) : isPdf ? (
                  <FileText className="w-5 h-5 text-red-400" />
                ) : isSpreadsheet ? (
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                ) : isPresentation ? (
                  <FileText className="w-5 h-5 text-orange-400" />
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
                  {googleEmbedInfo?.title || material.fileName || material.type?.toUpperCase() || 'TÀI LIỆU HỌC TẬP TRỰC TUYẾN'}
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Reload / Refresh frame */}
              {(googleEmbedInfo || isPdf || isPresentation || isSpreadsheet || viewerMode === 'gview') && (
                <button
                  onClick={() => setIframeKey((prev) => prev + 1)}
                  className="text-slate-300 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Tải lại trang tài liệu"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {/* Open in external tab */}
              {material.url.startsWith('http') && (
                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Mở tài liệu trong tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

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

          {/* SUB-TOOLBAR FOR WORD / TEXT */}
          {(isWordDoc || isTextFile) && viewerMode === 'mammoth' && !loading && !error && (
            <div className="bg-slate-100 border-b border-slate-200 px-5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              {/* Left: Font controls */}
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
                  title="Đặt lại cỡ chữ mặc định"
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

              {/* Right: Actions */}
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

          {/* MAIN VIEWER BODY */}
          <div className="flex-grow overflow-y-auto bg-slate-100/70 p-2 sm:p-6 flex justify-center items-stretch">
            
            {/* 1. GOOGLE DRIVE / DOCS / SHEETS / SLIDES EMBEDDED VIEW */}
            {googleEmbedInfo && (
              <div className="w-full h-full min-h-[75vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                <iframe
                  key={`gembed-${iframeKey}`}
                  src={googleEmbedInfo.embedUrl}
                  title={material.title}
                  className="w-full h-full min-h-[75vh] border-0 rounded-2xl"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            )}

            {/* 2. WORD DOCUMENT VIEW (.docx / .doc) - DIRECT MAMMOTH HTML */}
            {!googleEmbedInfo && isWordDoc && viewerMode === 'mammoth' && (
              <div className="w-full max-w-4xl flex flex-col items-center">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-500">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                    <p className="text-sm font-bold text-slate-700">Đang đọc và định dạng tệp Word trực tiếp trên web...</p>
                    <p className="text-xs text-slate-400">Đang tối ưu bảng biểu, hình ảnh và cấu trúc văn bản</p>
                  </div>
                ) : error ? (
                  <div className="bg-white border border-amber-200 rounded-3xl p-8 max-w-md text-center space-y-4 shadow-sm my-8">
                    <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Không thể phân tích định dạng Word trực tiếp</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
                    <div className="flex flex-col gap-2 pt-2">
                      <a
                        href={material.url}
                        download={material.fileName || `${material.title}.docx`}
                        className="w-full py-3 bg-indigo-900 hover:bg-indigo-850 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                      >
                        <Download className="w-4 h-4" /> Tải file Word về máy để đọc
                      </a>
                      {material.url.startsWith('http') && (
                        <a
                          href={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(material.url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200"
                        >
                          <ExternalLink className="w-4 h-4" /> Mở qua Google Docs Viewer
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Rendered Word Document Page (A4 Paper Style) */
                  <div
                    ref={contentRef}
                    style={{ fontSize: `${fontSize}px` }}
                    className={`bg-white text-slate-900 w-full min-h-[850px] p-6 sm:p-12 rounded-2xl shadow-lg border border-slate-200/80 leading-relaxed ${
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
                      className="prose max-w-none space-y-4 text-slate-800"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 3. GOOGLE DOCS VIEWER FALLBACK (For remote PPTX, XLSX, DOCX, DOC) */}
            {!googleEmbedInfo && (isPresentation || isSpreadsheet || (isWordDoc && viewerMode === 'gview')) && material.url.startsWith('http') && (
              <div className="w-full h-full min-h-[75vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                <iframe
                  key={`gview-${iframeKey}`}
                  src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(material.url)}`}
                  title={material.title}
                  className="w-full h-full min-h-[75vh] border-0 rounded-2xl"
                  allowFullScreen
                />
              </div>
            )}

            {/* 4. PDF DOCUMENT VIEW */}
            {!googleEmbedInfo && isPdf && (
              <div className="w-full h-full min-h-[75vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                <iframe
                  key={`pdf-${iframeKey}`}
                  src={`${activePdfUrl}#toolbar=1`}
                  title={material.title}
                  className="w-full h-full min-h-[75vh] border-0 rounded-2xl"
                />
              </div>
            )}

            {/* 5. TEXT / MARKDOWN DOCUMENT VIEW */}
            {!googleEmbedInfo && isTextFile && (
              <div className="w-full max-w-4xl bg-white p-8 sm:p-12 rounded-2xl shadow-lg border border-slate-200 text-slate-900">
                <div className="border-b border-slate-200 pb-4 mb-6">
                  <h1 className="text-2xl font-black text-slate-950 mb-1">{material.title}</h1>
                  <p className="text-xs text-slate-400 font-mono">{material.fileName || 'Tài liệu văn bản'}</p>
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: docHtml }}
                  className="prose max-w-none text-slate-800"
                />
              </div>
            )}

            {/* 6. VIDEO VIEW */}
            {!googleEmbedInfo && isVideo && (
              <div className="w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center my-auto">
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

            {/* 7. AUDIO VIEW */}
            {!googleEmbedInfo && isAudio && (
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

            {/* 8. IMAGE VIEW */}
            {!googleEmbedInfo && isImage && (
              <div className="w-full max-w-4xl flex flex-col items-center justify-center space-y-4 my-auto">
                <div className="bg-white p-3 rounded-3xl shadow-xl border border-slate-200">
                  <img
                    src={material.url}
                    alt={material.title}
                    className="max-h-[75vh] max-w-full object-contain rounded-2xl"
                  />
                </div>
                <p className="text-xs text-slate-500 text-center font-semibold">{material.title}</p>
              </div>
            )}

            {/* 9. GENERIC WEB EMBED / LINK VIEW */}
            {!googleEmbedInfo &&
              !isWordDoc &&
              !isPdf &&
              !isVideo &&
              !isAudio &&
              !isImage &&
              !isTextFile &&
              !isSpreadsheet &&
              !isPresentation && (
                <div className="w-full h-full min-h-[75vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                  {material.url.startsWith('http') ? (
                    <iframe
                      key={`generic-${iframeKey}`}
                      src={material.url}
                      title={material.title}
                      className="w-full h-full min-h-[75vh] border-0 rounded-2xl"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  ) : (
                    <div className="p-8 text-center space-y-4 my-auto">
                      <ExternalLink className="w-12 h-12 text-indigo-900 mx-auto" />
                      <h4 className="text-lg font-bold text-slate-900">{material.title}</h4>
                      <p className="text-xs text-slate-500">{material.description || 'Liên kết học liệu trực tuyến.'}</p>
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-900 hover:bg-indigo-850 text-white rounded-xl font-bold text-xs shadow-md transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" /> Mở liên kết trong tab mới
                      </a>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* FOOTER BAR */}
          <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
            <div className="text-slate-500 text-[11px] truncate max-w-md">
              💡 {isWordDoc ? 'Bạn đang xem tài liệu trực tiếp trên hệ thống trực tuyến.' : 'Trình xem tài liệu học tập trực tiếp.'}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={material.url}
                download={material.fileName || material.title}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Tải về máy
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
