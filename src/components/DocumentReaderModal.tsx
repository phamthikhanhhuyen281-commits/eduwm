import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
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
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Sparkles,
  Presentation,
  Volume2
} from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { renderAsync } from 'docx-preview';
import * as pdfjsLib from 'pdfjs-dist';
import { storageService } from '../services/storageService';
import { materialService } from '../services/materialService';
import { UploadCloud } from 'lucide-react';

// Configure PDF.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker setup fallback:', e);
}

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

interface PptxSlide {
  slideNumber: number;
  title: string;
  paragraphs: string[];
}

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({
  isOpen,
  onClose,
  material
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('Đang nạp tài liệu...');
  const [error, setError] = useState<string | null>(null);

  // Word State
  const [wordViewMode, setWordViewMode] = useState<'page' | 'clean' | 'raw'>('page');
  const [docHtml, setDocHtml] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [docxRenderSuccess, setDocxRenderSuccess] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(16);
  const [isSerif, setIsSerif] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // PDF State
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number>(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1.2);
  const [pdfViewMode, setPdfViewMode] = useState<'scroll' | 'single'>('scroll');

  // Excel State
  const [excelSheets, setExcelSheets] = useState<{ name: string; data: any[][] }[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [sheetSearch, setSheetSearch] = useState<string>('');

  // PowerPoint State
  const [slides, setSlides] = useState<PptxSlide[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);

  // Media / Audio / Video / Image State
  const [audioError, setAudioError] = useState<boolean>(false);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [imageLoadFailed, setImageLoadFailed] = useState<boolean>(false);
  const [imageSourceUrl, setImageSourceUrl] = useState<string>((material?.url || '').trim());

  // Viewer Mode Fallback
  const [viewerMode, setViewerMode] = useState<'native' | 'iframe'>('native');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [overrideUrl, setOverrideUrl] = useState<string | null>(null);
  const [isUploadingReplacement, setIsUploadingReplacement] = useState<boolean>(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const singlePageCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse and normalize URLs and file extensions
  const cleanUrl = (overrideUrl || material?.url || '').trim();
  const cleanUrlNoQuery = cleanUrl.split('?')[0].split('#')[0].toLowerCase();
  const typeLower = (material?.type || '').trim().toLowerCase();
  const fileNameLower = (material?.fileName || '').trim().toLowerCase();

  // Helper: Detect Google Drive, Docs, Sheets, Slides, Forms
  const getGoogleEmbedInfo = (url: string) => {
    if (!url) return null;

    // Google Drive File
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

  const googleEmbedInfo = getGoogleEmbedInfo(cleanUrl);

  // Robust File Type Detection
  const isPdf =
    !googleEmbedInfo &&
    (typeLower === 'pdf' ||
      cleanUrlNoQuery.endsWith('.pdf') ||
      fileNameLower.endsWith('.pdf') ||
      cleanUrl.startsWith('data:application/pdf'));

  const isWordDoc =
    !googleEmbedInfo &&
    (typeLower === 'docx' ||
      typeLower === 'doc' ||
      typeLower === 'word' ||
      cleanUrlNoQuery.endsWith('.docx') ||
      cleanUrlNoQuery.endsWith('.doc') ||
      fileNameLower.endsWith('.docx') ||
      fileNameLower.endsWith('.doc') ||
      cleanUrl.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
      cleanUrl.startsWith('data:application/msword') ||
      (typeLower === 'document' && !isPdf && !cleanUrlNoQuery.endsWith('.pdf') && !fileNameLower.endsWith('.pdf')));

  const isExcelDoc =
    !googleEmbedInfo &&
    (typeLower === 'xlsx' ||
      typeLower === 'xls' ||
      typeLower === 'csv' ||
      typeLower === 'excel' ||
      typeLower === 'spreadsheet' ||
      cleanUrlNoQuery.endsWith('.xlsx') ||
      cleanUrlNoQuery.endsWith('.xls') ||
      cleanUrlNoQuery.endsWith('.csv') ||
      fileNameLower.endsWith('.xlsx') ||
      fileNameLower.endsWith('.xls') ||
      fileNameLower.endsWith('.csv'));

  const isPresentation =
    !googleEmbedInfo &&
    (typeLower === 'pptx' ||
      typeLower === 'ppt' ||
      typeLower === 'powerpoint' ||
      typeLower === 'presentation' ||
      cleanUrlNoQuery.endsWith('.pptx') ||
      cleanUrlNoQuery.endsWith('.ppt') ||
      fileNameLower.endsWith('.pptx') ||
      fileNameLower.endsWith('.ppt'));

  const isVideo =
    !googleEmbedInfo &&
    (typeLower === 'video' ||
      cleanUrl.includes('youtube.com') ||
      cleanUrl.includes('youtu.be') ||
      cleanUrl.includes('vimeo.com') ||
      cleanUrlNoQuery.endsWith('.mp4') ||
      cleanUrlNoQuery.endsWith('.webm') ||
      cleanUrlNoQuery.endsWith('.mov') ||
      cleanUrlNoQuery.endsWith('.m4v') ||
      cleanUrlNoQuery.endsWith('.avi') ||
      fileNameLower.endsWith('.mp4') ||
      fileNameLower.endsWith('.webm') ||
      fileNameLower.endsWith('.mov'));

  const isAudio =
    !googleEmbedInfo &&
    (typeLower === 'audio' ||
      typeLower === 'sound' ||
      cleanUrlNoQuery.endsWith('.mp3') ||
      cleanUrlNoQuery.endsWith('.wav') ||
      cleanUrlNoQuery.endsWith('.m4a') ||
      cleanUrlNoQuery.endsWith('.ogg') ||
      cleanUrlNoQuery.endsWith('.aac') ||
      fileNameLower.endsWith('.mp3') ||
      fileNameLower.endsWith('.wav') ||
      fileNameLower.endsWith('.m4a') ||
      cleanUrl.startsWith('data:audio/'));

  const isImage =
    !googleEmbedInfo &&
    (typeLower === 'image' ||
      typeLower === 'img' ||
      typeLower === 'picture' ||
      typeLower === 'photo' ||
      cleanUrlNoQuery.endsWith('.png') ||
      cleanUrlNoQuery.endsWith('.jpg') ||
      cleanUrlNoQuery.endsWith('.jpeg') ||
      cleanUrlNoQuery.endsWith('.webp') ||
      cleanUrlNoQuery.endsWith('.gif') ||
      cleanUrlNoQuery.endsWith('.svg') ||
      cleanUrlNoQuery.endsWith('.bmp') ||
      cleanUrlNoQuery.endsWith('.ico') ||
      cleanUrlNoQuery.endsWith('.avif') ||
      fileNameLower.endsWith('.png') ||
      fileNameLower.endsWith('.jpg') ||
      fileNameLower.endsWith('.jpeg') ||
      fileNameLower.endsWith('.webp') ||
      fileNameLower.endsWith('.gif') ||
      fileNameLower.endsWith('.svg') ||
      fileNameLower.endsWith('.bmp') ||
      fileNameLower.endsWith('.ico') ||
      fileNameLower.endsWith('.avif') ||
      cleanUrl.startsWith('data:image/'));

  const isTextFile =
    !googleEmbedInfo &&
    (typeLower === 'txt' ||
      typeLower === 'text' ||
      typeLower === 'md' ||
      cleanUrlNoQuery.endsWith('.txt') ||
      cleanUrlNoQuery.endsWith('.md') ||
      cleanUrlNoQuery.endsWith('.json') ||
      fileNameLower.endsWith('.txt') ||
      fileNameLower.endsWith('.md'));

  // Universal ArrayBuffer Fetcher with multi-tier resilient fallback
  const fetchDocumentArrayBuffer = useCallback(async (url: string, fileName?: string, materialId?: string): Promise<ArrayBuffer> => {
    if (!url) throw new Error('Không tìm thấy đường dẫn tệp tin.');

    // Helper: Base64 decode to ArrayBuffer
    const decodeBase64ToArrayBuffer = (base64Str: string): ArrayBuffer => {
      const commaIdx = base64Str.indexOf(',');
      const base64Content = commaIdx >= 0 ? base64Str.slice(commaIdx + 1) : base64Str;
      const cleanBase64 = base64Content.trim().replace(/\s/g, '');
      const binaryString = window.atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    };

    // 1. Base64 Data URI manual decode (instant, 100% reliable)
    if (url.startsWith('data:')) {
      return decodeBase64ToArrayBuffer(url);
    }

    // 2. Blob URI
    if (url.startsWith('blob:')) {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.arrayBuffer();
      } catch (e) {}
    }

    // 3. Try Native fetch for relative or absolute URLs
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        // Check if the response is actually an HTML error page (SPA rewrite)
        if (buf.byteLength < 5000) {
          const header = new Uint8Array(buf.slice(0, 15));
          const strHeader = String.fromCharCode(...header).toLowerCase();
          if (strHeader.includes('<!doctype') || strHeader.includes('<html')) {
            throw new Error('Máy chủ trả về trang HTML thay vì file tài liệu.');
          }
        }
        return buf;
      }
    } catch (fetchErr) {
      console.warn('Native fetch failed for URL, checking IndexedDB cache:', fetchErr);
    }

    // 4. Try IndexedDB cache fallback (e.g. previously saved files)
    try {
      if (fileName) {
        const local = await storageService.getLocalFile(`file_${fileName}`);
        if (local) {
          if (typeof local === 'string') return decodeBase64ToArrayBuffer(local);
          if (local instanceof Blob) return await local.arrayBuffer();
        }
      }
      if (materialId) {
        const local = await storageService.getLocalFile(`material_${materialId}`);
        if (local) {
          if (typeof local === 'string') return decodeBase64ToArrayBuffer(local);
          if (local instanceof Blob) return await local.arrayBuffer();
        }
      }
    } catch (idbErr) {}

    // 5. Remote URL file-proxy fallback
    if (url.startsWith('http')) {
      try {
        const proxyUrl = `/api/file-proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) return await res.arrayBuffer();
      } catch (e) {}
    }

    // 6. Descriptive guidance for local server files on Vercel
    if (url.startsWith('/recordings/') || url.startsWith('/')) {
      throw new Error('Tệp này trước đây được lưu trên ổ đĩa máy chủ cục bộ (local). Khi triển khai lên Vercel tĩnh, vui lòng bấm nút "Chọn lại tệp từ máy tính" bên dưới để mở ngay và lưu trữ vĩnh viễn trên đám mây.');
    }

    throw new Error('Lỗi đọc tệp từ máy chủ (404)');
  }, []);

  // Handler for uploading/replacing missing file directly inside modal
  const handleManualFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingReplacement(true);
      setError(null);
      setLoading(true);
      setLoadingProgress('Đang đọc và lưu tệp tin mới...');

      // 1. Read locally as Base64 Data URL immediately for instant rendering
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Đọc file thất bại'));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Set override URL so modal parses the doc immediately
      setOverrideUrl(base64);

      // 3. Save to IndexedDB
      await storageService.saveLocalFile(`file_${file.name}`, base64);
      if (material?.id) {
        await storageService.saveLocalFile(`material_${material.id}`, base64);
      }

      // 4. Upload to Firebase Storage in background and update Firestore
      storageService.uploadFile(file, 'materials')
        .then(async (uploadedCloudUrl) => {
          const finalUrl = uploadedCloudUrl || base64;
          setOverrideUrl(finalUrl);

          if (material?.id) {
            await materialService.saveMaterial({
              id: material.id,
              title: material.title || file.name.replace(/\.[^/.]+$/, ''),
              description: material.description || '',
              url: finalUrl,
              type: (material.type || 'docx') as any,
              fileName: file.name,
              fileSize: file.size,
              createdAt: material.createdAt || new Date().toISOString()
            });
          }
        })
        .catch((uploadErr) => {
          console.warn('Background cloud upload error:', uploadErr);
        });

    } catch (err: any) {
      console.error('Failed to replace file:', err);
      setError('Lỗi khi nạp tệp từ máy: ' + (err.message || ''));
    } finally {
      setIsUploadingReplacement(false);
      setLoading(false);
    }
  };

  // Update Image Source when opening image
  useEffect(() => {
    if (material && isImage) {
      setImageLoadFailed(false);
      setImageRotation(0);
      setImageZoom(1);
      // If direct url is relative or data, use it. Otherwise direct with fallback.
      setImageSourceUrl(cleanUrl);
    }
  }, [material, isImage, cleanUrl]);

  // Main Document Loading Effect
  useEffect(() => {
    if (!isOpen || !material) {
      setDocHtml('');
      setRawText('');
      setError(null);
      setPdfDoc(null);
      setPdfNumPages(0);
      setPdfCurrentPage(1);
      setExcelSheets([]);
      setActiveSheetIndex(0);
      setSheetSearch('');
      setSlides([]);
      setActiveSlideIndex(0);
      setImageRotation(0);
      setImageZoom(1);
      setPlaybackRate(1);
      setViewerMode('native');
      setWordViewMode('page');
      setDocxRenderSuccess(false);
      return;
    }

    let isMounted = true;
    setError(null);
    setImageSourceUrl(cleanUrl);
    setImageLoadFailed(false);
    setAudioError(false);

    // 1. PDF DOCUMENTS
    if (isPdf) {
      setLoading(true);
      setLoadingProgress('Đang tải và chuẩn bị tài liệu PDF...');
      const loadPdf = async () => {
        try {
          const buffer = await fetchDocumentArrayBuffer(cleanUrl, material?.fileName, material?.id);
          const loadedDoc = await pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/',
            cMapPacked: true
          }).promise;

          if (isMounted) {
            setPdfDoc(loadedDoc);
            setPdfNumPages(loadedDoc.numPages);
            setPdfCurrentPage(1);
            setLoading(false);
          }
        } catch (err: any) {
          console.warn('PDF.js parsing failed, switching to iframe fallback:', err);
          if (isMounted) {
            setPdfDoc(null);
            setViewerMode('iframe');
            setLoading(false);
          }
        }
      };
      loadPdf();
      return () => { isMounted = false; };
    }

    // 2. WORD DOCUMENTS (.docx / .doc)
    if (isWordDoc) {
      setLoading(true);
      setLoadingProgress('Đang phân tích cấu trúc tài liệu Word...');
      const loadWord = async () => {
        try {
          const arrayBuffer = await fetchDocumentArrayBuffer(cleanUrl, material?.fileName, material?.id);
          let parsedAny = false;

          // Attempt 1: Mammoth HTML conversion with embedded images support
          try {
            const mammothOptions = {
              convertImage: mammoth.images.imgElement((image: any) => {
                return image.read("base64").then((imageBuffer: string) => {
                  return {
                    src: `data:${image.contentType};base64,${imageBuffer}`
                  };
                });
              })
            };

            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer.slice(0) }, mammothOptions);
            const textResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer.slice(0) });
            
            if (isMounted && result.value) {
              setDocHtml(result.value);
              setRawText(textResult.value || '');
              parsedAny = true;
            }
          } catch (mammothErr) {
            console.warn('Mammoth convert failed, attempting ZIP XML fallback:', mammothErr);
          }

          // Attempt 2: docx-preview for pixel-perfect page layout
          if (docxContainerRef.current) {
            try {
              docxContainerRef.current.innerHTML = '';
              await renderAsync(arrayBuffer.slice(0), docxContainerRef.current, undefined, {
                className: 'docx-preview',
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false
              });
              if (isMounted) {
                setDocxRenderSuccess(true);
                parsedAny = true;
              }
            } catch (docxErr) {
              console.warn('docx-preview render failed:', docxErr);
              if (isMounted) {
                setDocxRenderSuccess(false);
              }
            }
          }

          // Attempt 3: JSZip XML extraction fallback
          if (!parsedAny) {
            try {
              const zip = await JSZip.loadAsync(arrayBuffer);
              const docXml = await zip.file('word/document.xml')?.async('text');
              if (docXml) {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(docXml, 'text/xml');
                const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
                const lines = paragraphs
                  .map((p) => {
                    const texts = Array.from(p.getElementsByTagName('w:t')).map((t) => t.textContent || '');
                    return texts.join('');
                  })
                  .filter((line) => line.trim().length > 0);

                if (lines.length > 0 && isMounted) {
                  const fallbackHtml = lines.map((l) => `<p class="my-2">${l}</p>`).join('');
                  setDocHtml(fallbackHtml);
                  setRawText(lines.join('\n'));
                  setWordViewMode('clean');
                  parsedAny = true;
                }
              }
            } catch (zipErr) {
              console.warn('JSZip document XML parse failed:', zipErr);
            }
          }

          // Attempt 4: Binary text extraction for legacy .doc (Word 97-2003)
          if (!parsedAny) {
            try {
              const bytes = new Uint8Array(arrayBuffer);
              let extracted = '';
              for (let i = 0; i < bytes.length; i++) {
                const code = bytes[i];
                if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code >= 192) {
                  extracted += String.fromCharCode(code);
                } else if (extracted.length > 0 && !extracted.endsWith(' ')) {
                  extracted += ' ';
                }
              }
              const cleanWords = extracted
                .split(/\s{2,}/)
                .filter((w) => w.length > 3 && /[a-zA-Z0-9à-ỹÀ-Ỹ]/.test(w));

              if (cleanWords.length > 5 && isMounted) {
                const textParagraphs = cleanWords.join(' ');
                setDocHtml(`<p class="leading-relaxed text-slate-800">${textParagraphs}</p>`);
                setRawText(textParagraphs);
                setWordViewMode('clean');
                parsedAny = true;
              }
            } catch (binErr) {
              console.warn('Binary text extraction failed:', binErr);
            }
          }

          if (isMounted) {
            setLoading(false);
            if (!parsedAny && !cleanUrl.startsWith('http')) {
              setError('Tài liệu Word này có định dạng đặc biệt. Bạn có thể tải tệp tin về máy để xem.');
            }
          }
        } catch (err: any) {
          if (isMounted) {
            console.error('Error loading word doc:', err);
            setError(err.message || 'Lỗi tải tệp Word.');
            setLoading(false);
          }
        }
      };
      loadWord();
      return () => { isMounted = false; };
    }

    // 3. EXCEL SPREADSHEETS (.xlsx, .xls, .csv)
    if (isExcelDoc) {
      setLoading(true);
      setLoadingProgress('Đang nạp bảng tính Excel...');
      const loadExcel = async () => {
        try {
          const arrayBuffer = await fetchDocumentArrayBuffer(cleanUrl, material?.fileName, material?.id);
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });

          const sheets: { name: string; data: any[][] }[] = [];
          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
            sheets.push({
              name: sheetName,
              data: jsonData
            });
          });

          if (isMounted) {
            setExcelSheets(sheets);
            setActiveSheetIndex(0);
            setLoading(false);
          }
        } catch (err: any) {
          console.warn('Excel parse failed:', err);
          if (isMounted) {
            setError('Không thể phân tích dữ liệu bảng tính Excel này.');
            setLoading(false);
          }
        }
      };
      loadExcel();
      return () => { isMounted = false; };
    }

    // 4. POWERPOINT PRESENTATIONS (.pptx, .ppt)
    if (isPresentation) {
      setLoading(true);
      setLoadingProgress('Đang đọc các trang trình chiếu PowerPoint...');
      const loadPptx = async () => {
        try {
          const arrayBuffer = await fetchDocumentArrayBuffer(cleanUrl, material?.fileName, material?.id);
          const zip = await JSZip.loadAsync(arrayBuffer);
          const slideFiles = Object.keys(zip.files).filter(
            (fileName) => fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')
          );

          slideFiles.sort((a, b) => {
            const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
            const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
            return numA - numB;
          });

          const extractedSlides: PptxSlide[] = [];
          for (let i = 0; i < slideFiles.length; i++) {
            const xmlContent = await zip.files[slideFiles[i]].async('text');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const textNodes = Array.from(xmlDoc.getElementsByTagName('a:t'));
            const texts = textNodes.map((n) => n.textContent?.trim() || '').filter(Boolean);

            extractedSlides.push({
              slideNumber: i + 1,
              title: texts[0] || `Trang trình chiếu ${i + 1}`,
              paragraphs: texts.slice(1)
            });
          }

          if (isMounted) {
            if (extractedSlides.length > 0) {
              setSlides(extractedSlides);
              setActiveSlideIndex(0);
              setLoading(false);
            } else if (cleanUrl.startsWith('http')) {
              setViewerMode('iframe');
              setLoading(false);
            } else {
              setError('Không tìm thấy nội dung slide trong tệp này.');
              setLoading(false);
            }
          }
        } catch (err: any) {
          console.warn('PowerPoint extraction failed:', err);
          if (isMounted) {
            if (cleanUrl.startsWith('http')) {
              setViewerMode('iframe');
              setLoading(false);
            } else {
              setError('Không thể mở tệp PowerPoint này trực tiếp.');
              setLoading(false);
            }
          }
        }
      };
      loadPptx();
      return () => { isMounted = false; };
    }

    // 5. TEXT / MARKDOWN FILES
    if (isTextFile) {
      setLoading(true);
      setLoadingProgress('Đang nạp văn bản...');
      const loadText = async () => {
        try {
          let text = '';
          if (cleanUrl.startsWith('data:')) {
            const base64Content = cleanUrl.split(',')[1];
            text = decodeURIComponent(escape(window.atob(base64Content)));
          } else {
            const arrayBuffer = await fetchDocumentArrayBuffer(cleanUrl);
            const decoder = new TextDecoder('utf-8');
            text = decoder.decode(arrayBuffer);
          }
          if (isMounted) {
            setRawText(text);
            setDocHtml(`<pre class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200">${text}</pre>`);
            setLoading(false);
          }
        } catch (err: any) {
          if (isMounted) {
            setError('Không thể đọc tệp văn bản này.');
            setLoading(false);
          }
        }
      };
      loadText();
      return () => { isMounted = false; };
    }

    // Images, Audio, Video, Links don't require heavy asynchronous decoding
    setLoading(false);
    return () => { isMounted = false; };
  }, [isOpen, material, isPdf, isWordDoc, isExcelDoc, isPresentation, isTextFile, cleanUrl, fetchDocumentArrayBuffer]);

  // Delayed docx render when docxContainerRef mounts
  useEffect(() => {
    if (isWordDoc && !loading && wordViewMode === 'page' && docxContainerRef.current && cleanUrl) {
      fetchDocumentArrayBuffer(cleanUrl)
        .then((arrayBuffer) => {
          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = '';
            renderAsync(arrayBuffer, docxContainerRef.current, undefined, {
              className: 'docx-preview',
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false
            }).then(() => {
              setDocxRenderSuccess(true);
            }).catch((err) => {
              console.warn('Delayed docx-preview failed:', err);
            });
          }
        })
        .catch(() => {});
    }
  }, [isWordDoc, loading, wordViewMode, cleanUrl, fetchDocumentArrayBuffer]);

  // Render PDF pages on canvas
  const renderPdfPage = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: pdfScale * (window.devicePixelRatio || 1) });
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
      canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    } catch (err) {
      console.warn(`Error rendering PDF page ${pageNum}:`, err);
    }
  }, [pdfDoc, pdfScale]);

  // Render single page PDF
  useEffect(() => {
    if (isPdf && pdfDoc && pdfViewMode === 'single' && singlePageCanvasRef.current) {
      renderPdfPage(pdfCurrentPage, singlePageCanvasRef.current);
    }
  }, [isPdf, pdfDoc, pdfViewMode, pdfCurrentPage, pdfScale, renderPdfPage]);

  if (!isOpen || !material) return null;

  const handleCopyText = () => {
    if (!rawText && !contentRef.current && !docxContainerRef.current) return;
    const textToCopy = rawText || contentRef.current?.innerText || docxContainerRef.current?.innerText || '';
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
    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    return `/api/file-proxy?url=${encodeURIComponent(url)}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filtered Excel Rows
  const currentSheet = excelSheets[activeSheetIndex];
  const filteredExcelRows = currentSheet?.data?.filter((row) => {
    if (!sheetSearch.trim()) return true;
    return row.some((cell) => String(cell).toLowerCase().includes(sheetSearch.toLowerCase()));
  }) || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[12000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          className={`bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 transition-all duration-300 ${
            isFullscreen ? 'w-full h-full rounded-none' : 'max-w-6xl w-full max-h-[94vh] h-[94vh]'
          }`}
        >
          {/* 1. TOP HEADER BAR */}
          <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between gap-4 select-none shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-slate-800/90 rounded-2xl text-indigo-300 shrink-0 border border-slate-700 shadow-inner">
                {googleEmbedInfo ? (
                  <BookOpen className="w-5 h-5 text-amber-400" />
                ) : isWordDoc ? (
                  <FileCode className="w-5 h-5 text-blue-400" />
                ) : isPdf ? (
                  <FileText className="w-5 h-5 text-red-400" />
                ) : isExcelDoc ? (
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                ) : isPresentation ? (
                  <Presentation className="w-5 h-5 text-purple-400" />
                ) : isVideo ? (
                  <Video className="w-5 h-5 text-purple-400" />
                ) : isAudio ? (
                  <Headphones className="w-5 h-5 text-emerald-400" />
                ) : isImage ? (
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                ) : (
                  <ExternalLink className="w-5 h-5 text-cyan-400" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base text-white truncate max-w-md sm:max-w-xl">
                    {material.title}
                  </h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-indigo-300 shrink-0">
                    {googleEmbedInfo ? 'Google Docs' : isWordDoc ? 'Word .docx' : isPdf ? 'PDF' : isExcelDoc ? 'Excel' : isPresentation ? 'PowerPoint' : isVideo ? 'Video' : isAudio ? 'Audio' : isImage ? 'Hình ảnh' : 'Liên kết'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 truncate">
                  {material.fileName && <span>📁 {material.fileName}</span>}
                  {material.fileSize && <span>⚖ {formatFileSize(material.fileSize)}</span>}
                  {material.description && <span className="hidden sm:inline italic">"{material.description}"</span>}
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-red-950/60 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2. SECONDARY CONTROLS TOOLBAR (Dependent on Document Type) */}

          {/* WORD TOOLBAR */}
          {isWordDoc && !loading && !error && (
            <div className="bg-slate-50 dark:bg-slate-850 px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Chế độ xem:</span>
                <div className="bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl flex items-center gap-1">
                  <button
                    onClick={() => setWordViewMode('page')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      wordViewMode === 'page'
                        ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Bố cục trang in (Word)
                  </button>
                  <button
                    onClick={() => setWordViewMode('clean')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      wordViewMode === 'clean'
                        ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Đọc tối ưu (Smart Clean)
                  </button>
                  <button
                    onClick={() => setWordViewMode('raw')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      wordViewMode === 'raw'
                        ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Văn bản thuần túy (Text)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {wordViewMode === 'clean' && (
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-xl">
                    <button
                      onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                      className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                      title="Giảm cỡ chữ"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 px-1">{fontSize}px</span>
                    <button
                      onClick={() => setFontSize((s) => Math.min(28, s + 1))}
                      className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                      title="Tăng cỡ chữ"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={handleCopyText}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Đã sao chép' : 'Sao chép văn bản'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" /> In tài liệu
                </button>
              </div>
            </div>
          )}

          {/* PDF TOOLBAR */}
          {isPdf && !loading && !error && pdfDoc && (
            <div className="bg-slate-50 dark:bg-slate-850 px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl">
                  <button
                    onClick={() => setPdfViewMode('scroll')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      pdfViewMode === 'scroll'
                        ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Cuộn liên tục ({pdfNumPages} trang)
                  </button>
                  <button
                    onClick={() => setPdfViewMode('single')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      pdfViewMode === 'single'
                        ? 'bg-white dark:bg-slate-700 text-indigo-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Từng trang
                  </button>
                </div>

                {pdfViewMode === 'single' && (
                  <div className="flex items-center gap-2 font-mono">
                    <button
                      disabled={pdfCurrentPage <= 1}
                      onClick={() => setPdfCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>{pdfCurrentPage} / {pdfNumPages}</span>
                    <button
                      disabled={pdfCurrentPage >= pdfNumPages}
                      onClick={() => setPdfCurrentPage((p) => Math.min(pdfNumPages, p + 1))}
                      className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-xl">
                  <button
                    onClick={() => setPdfScale((s) => Math.max(0.7, parseFloat((s - 0.15).toFixed(2))))}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs font-bold px-1">{Math.round(pdfScale * 100)}%</span>
                  <button
                    onClick={() => setPdfScale((s) => Math.min(2.5, parseFloat((s + 0.15).toFixed(2))))}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> In PDF
                </button>
              </div>
            </div>
          )}

          {/* EXCEL TOOLBAR */}
          {isExcelDoc && !loading && !error && excelSheets.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-850 px-5 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-thin">
                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Trang tính:</span>
                {excelSheets.map((sh, idx) => (
                  <button
                    key={sh.name}
                    onClick={() => setActiveSheetIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                      activeSheetIndex === idx
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {sh.name}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm ô tính..."
                  value={sheetSearch}
                  onChange={(e) => setSheetSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* IMAGE TOOLBAR */}
          {isImage && (
            <div className="bg-slate-50 dark:bg-slate-850 px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Thao tác ảnh:</span>
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-xl">
                  <button
                    onClick={() => setImageZoom((z) => Math.max(0.3, parseFloat((z - 0.2).toFixed(1))))}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs font-bold px-1">{Math.round(imageZoom * 100)}%</span>
                  <button
                    onClick={() => setImageZoom((z) => Math.min(3, parseFloat((z + 0.2).toFixed(1))))}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                    title="Phóng to"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setImageRotation((r) => (r + 90) % 360)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Xoay 90 độ"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Xoay ảnh
                </button>

                <button
                  onClick={() => { setImageZoom(1); setImageRotation(0); }}
                  className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl font-bold cursor-pointer"
                  title="Đặt lại kích thước gốc"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={material.url}
                  download={material.fileName || `${material.title}.png`}
                  className="px-3.5 py-1.5 bg-indigo-900 hover:bg-indigo-850 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Tải ảnh gốc
                </a>
              </div>
            </div>
          )}

          {/* MAIN VIEWER CONTAINER */}
          <div className="flex-grow overflow-y-auto bg-slate-100/70 dark:bg-slate-950 p-2 sm:p-6 flex justify-center items-stretch relative">

            {/* LOADING STATE */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-500 my-auto">
                <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{loadingProgress}</p>
                <p className="text-xs text-slate-400">Trình đọc đang nạp tài liệu trực tiếp trên trình duyệt</p>
              </div>
            )}

            {/* ERROR STATE */}
            {!loading && error && (
              <div className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900 rounded-3xl p-8 max-w-lg text-center space-y-4 shadow-xl my-auto">
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Không thể mở tệp tin trực tiếp</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 font-mono">
                  {error}
                </p>

                <div className="flex flex-col gap-2.5 pt-2">
                  <label className="w-full py-3 px-4 bg-indigo-900 hover:bg-indigo-850 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer">
                    {isUploadingReplacement ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Đang xử lý tệp...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>Chọn lại tệp từ máy tính để mở & lưu ngay</span>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".docx,.doc,.pdf,.xlsx,.xls,.pptx,.ppt,.txt,.png,.jpg,.jpeg,.mp3,.mp4"
                      onChange={handleManualFileSelect}
                      disabled={isUploadingReplacement}
                    />
                  </label>

                  {material.url && !material.url.startsWith('/') && (
                    <a
                      href={material.url}
                      download={material.fileName || material.title}
                      className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-slate-600 cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Tải tệp tin về máy
                    </a>
                  )}

                  {material.url && material.url.startsWith('http') && (
                    <a
                      href={material.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" /> Mở liên kết trong tab mới
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* A. GOOGLE DRIVE / DOCS / SHEETS / SLIDES EMBED */}
            {!loading && !error && googleEmbedInfo && (
              <div className="w-full h-full min-h-[75vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700">
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

            {/* B. PDF VIEWER (PDF.JS CANVAS) */}
            {!loading && !error && !googleEmbedInfo && isPdf && viewerMode === 'native' && pdfDoc && (
              <div className="w-full max-w-4xl flex flex-col items-center space-y-6 pb-12">
                {pdfViewMode === 'scroll' ? (
                  Array.from({ length: pdfNumPages }, (_, i) => i + 1).map((pageNum) => (
                    <PdfPageCanvas
                      key={pageNum}
                      pdfDoc={pdfDoc}
                      pageNum={pageNum}
                      scale={pdfScale}
                    />
                  ))
                ) : (
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-700">
                    <canvas ref={singlePageCanvasRef} className="rounded-lg shadow-sm" />
                  </div>
                )}
              </div>
            )}

            {/* C. WORD DOCUMENT VIEW (.DOCX / .DOC) */}
            {!loading && !error && !googleEmbedInfo && isWordDoc && (
              <div className="w-full max-w-4xl flex flex-col items-center">
                {/* 1. Page View via docx-preview */}
                <div
                  ref={docxContainerRef}
                  className={`w-full ${wordViewMode === 'page' && docxRenderSuccess ? 'block' : 'hidden'}`}
                />

                {/* 2. Smart Clean Reading View */}
                {(wordViewMode === 'clean' || (wordViewMode === 'page' && !docxRenderSuccess)) && (
                  <div
                    ref={contentRef}
                    style={{ fontSize: `${fontSize}px` }}
                    className={`bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full min-h-[850px] p-6 sm:p-12 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 leading-relaxed ${
                      isSerif ? 'font-serif' : 'font-sans'
                    } docx-rendered-content`}
                  >
                    {/* Document Header */}
                    <div className="border-b border-slate-200 dark:border-slate-800 pb-6 mb-8">
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white mb-2 leading-tight">
                        {material.title}
                      </h1>
                      {material.description && (
                        <p className="text-slate-600 dark:text-slate-400 text-sm italic mb-2">
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

                    {/* Word HTML content */}
                    {docHtml ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: docHtml }}
                        className="space-y-4 text-slate-800 dark:text-slate-200"
                      />
                    ) : (
                      <div className="text-center py-12 text-slate-400">
                        <p className="italic">Nội dung tài liệu đang được mở...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Raw Text View */}
                {wordViewMode === 'raw' && (
                  <div className="w-full bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                      {rawText || 'Không có văn bản trích xuất.'}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* D. POWERPOINT PRESENTATION SLIDES VIEW */}
            {!loading && !error && !googleEmbedInfo && isPresentation && viewerMode === 'native' && slides.length > 0 && (
              <div className="w-full max-w-4xl flex flex-col items-center space-y-6 my-auto">
                <div className="w-full aspect-[16/9] bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl border border-indigo-800/60 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-white/10 px-3 py-1 rounded-full text-xs font-mono font-bold text-indigo-200">
                    Trang {activeSlideIndex + 1} / {slides.length}
                  </div>

                  <div className="space-y-4 min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      {slides[activeSlideIndex]?.title}
                    </h2>
                    <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-2 scrollbar-thin">
                      {slides[activeSlideIndex]?.paragraphs.map((p, pIdx) => (
                        <p key={pIdx} className="text-sm sm:text-base text-indigo-100 leading-relaxed flex items-start gap-2">
                          <span className="text-amber-400 mt-1 shrink-0">•</span>
                          <span>{p}</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-white/10 text-xs text-indigo-300">
                    <span>{material.title}</span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={activeSlideIndex <= 0}
                        onClick={() => setActiveSlideIndex((i) => Math.max(0, i - 1))}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold disabled:opacity-30 cursor-pointer"
                      >
                        Trước
                      </button>
                      <button
                        disabled={activeSlideIndex >= slides.length - 1}
                        onClick={() => setActiveSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold disabled:opacity-30 cursor-pointer"
                      >
                        Tiếp theo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* E. EXCEL TABLE VIEW */}
            {!loading && !error && !googleEmbedInfo && isExcelDoc && viewerMode === 'native' && currentSheet && (
              <div className="w-full h-full min-h-[75vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
                <div className="flex-grow overflow-auto p-4 scrollbar-thin">
                  {filteredExcelRows.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-sm italic">
                      Không tìm thấy dữ liệu phù hợp trong trang tính "{currentSheet.name}"
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-xs text-slate-800 dark:text-slate-200">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 sticky top-0 z-10">
                          <th className="p-2 border border-slate-300 dark:border-slate-700 text-center font-mono font-bold text-slate-500 bg-slate-200/80 dark:bg-slate-800 w-12 shrink-0">
                            #
                          </th>
                          {filteredExcelRows[0]?.map((_, colIdx) => (
                            <th
                              key={colIdx}
                              className="p-2.5 border border-slate-300 dark:border-slate-700 text-left font-black uppercase text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 min-w-[120px]"
                            >
                              {String.fromCharCode(65 + (colIdx % 26))}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExcelRows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/40 transition-colors odd:bg-white dark:odd:bg-slate-900 even:bg-slate-50/60 dark:even:bg-slate-800/40">
                            <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-mono text-slate-400 bg-slate-100/60 dark:bg-slate-800/60 font-bold">
                              {rowIdx + 1}
                            </td>
                            {row.map((cell, colIdx) => (
                              <td key={colIdx} className="p-2.5 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium break-words">
                                {cell !== undefined && cell !== null ? String(cell) : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* F. IFRAME FALLBACK */}
            {!loading && !error && viewerMode === 'iframe' && cleanUrl && (
              <div className="w-full h-full min-h-[75vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700">
                <iframe
                  key={`iframe-fallback-${iframeKey}`}
                  src={
                    cleanUrl.startsWith('http')
                      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(cleanUrl)}`
                      : (cleanUrl || undefined)
                  }
                  title={material.title}
                  className="w-full h-full min-h-[75vh] border-0 rounded-2xl"
                  allowFullScreen
                />
              </div>
            )}

            {/* G. TEXT / MARKDOWN VIEW */}
            {!loading && !error && !googleEmbedInfo && isTextFile && (
              <div className="w-full max-w-4xl bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                  <h1 className="text-2xl font-black text-slate-950 dark:text-white mb-1">{material.title}</h1>
                  <p className="text-xs text-slate-400 font-mono">{material.fileName || 'Tài liệu văn bản'}</p>
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: docHtml }}
                  className="text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            {/* H. VIDEO VIEW */}
            {!loading && !error && !googleEmbedInfo && isVideo && cleanUrl && (
              <div className="w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center my-auto">
                {cleanUrl.includes('youtube') || cleanUrl.includes('youtu.be') ? (
                  <iframe
                    src={getYoutubeEmbedUrl(cleanUrl) || undefined}
                    title={material.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={getProxiedUrl(cleanUrl) || undefined}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}

            {/* I. AUDIO VIEW */}
            {!loading && !error && !googleEmbedInfo && isAudio && cleanUrl && (
              <div className="w-full max-w-lg bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6 my-auto">
                <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Headphones className="w-12 h-12" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white">{material.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    {material.description || 'Bài nghe luyện thi và bài giảng âm thanh.'}
                  </p>
                </div>

                <audio
                  src={(audioError ? cleanUrl : getProxiedUrl(cleanUrl)) || undefined}
                  controls
                  autoPlay
                  onError={() => setAudioError(true)}
                  className="w-full h-12"
                />

                <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Tốc độ:</span>
                  {[0.75, 1, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        setPlaybackRate(rate);
                        const audios = document.querySelectorAll('audio');
                        audios.forEach((a) => (a.playbackRate = rate));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        playbackRate === rate ? 'bg-indigo-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <a
                    href={cleanUrl}
                    download={material.fileName || `${material.title}.mp3`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Tải file Audio về máy
                  </a>
                </div>
              </div>
            )}

            {/* J. IMAGE VIEW */}
            {!loading && !error && !googleEmbedInfo && isImage && (
              <div className="w-full max-w-4xl flex flex-col items-center justify-center space-y-4 my-auto overflow-auto p-4">
                <div
                  className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 transition-transform duration-200 ease-out flex items-center justify-center"
                  style={{
                    transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`
                  }}
                >
                  {!imageLoadFailed && imageSourceUrl && imageSourceUrl.trim() !== '' ? (
                    <img
                      src={imageSourceUrl}
                      alt={material.title}
                      onError={() => {
                        // If direct load failed, try proxy
                        if (imageSourceUrl === cleanUrl && cleanUrl.startsWith('http')) {
                          setImageSourceUrl(getProxiedUrl(cleanUrl));
                        } else {
                          setImageLoadFailed(true);
                        }
                      }}
                      className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-sm"
                    />
                  ) : (
                    <div className="text-center p-8 space-y-3">
                      <ImageIcon className="w-12 h-12 text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Không thể tải trực tiếp hình ảnh này</p>
                      {cleanUrl && (
                        <a
                          href={cleanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-900 text-white text-xs font-bold rounded-xl"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Mở ảnh trong tab mới
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* K. GENERIC WEB EMBED / LINK VIEW */}
            {!loading &&
              !error &&
              !googleEmbedInfo &&
              !isWordDoc &&
              !isPdf &&
              !isExcelDoc &&
              !isVideo &&
              !isAudio &&
              !isImage &&
              !isTextFile &&
              !isPresentation && (
                <div className="w-full h-full min-h-[75vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
                  {cleanUrl && cleanUrl.startsWith('http') ? (
                    <div className="flex flex-col h-full">
                      {/* Notice Header for iframe security */}
                      <div className="bg-amber-50 dark:bg-slate-800 px-4 py-2 text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between border-b border-amber-200 dark:border-slate-700">
                        <span>Đang xem trang web trực tuyến</span>
                        <a
                          href={cleanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline flex items-center gap-1 hover:text-indigo-900"
                        >
                          <ExternalLink className="w-3 h-3" /> Mở trong tab mới nếu trang bị chặn
                        </a>
                      </div>
                      <iframe
                        key={`generic-${iframeKey}`}
                        src={cleanUrl || undefined}
                        title={material.title}
                        className="w-full flex-grow min-h-[70vh] border-0"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    </div>
                  ) : (
                    <div className="p-8 text-center space-y-4 my-auto">
                      <ExternalLink className="w-12 h-12 text-indigo-900 dark:text-indigo-400 mx-auto" />
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white">{material.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{material.description || 'Liên kết học liệu trực tuyến.'}</p>
                      {cleanUrl && (
                        <a
                          href={cleanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-900 hover:bg-indigo-850 text-white rounded-xl font-bold text-xs shadow-md transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" /> Mở liên kết trong tab mới
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* FOOTER BAR */}
          <div className="bg-white dark:bg-slate-900 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs shrink-0 select-none">
            <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>
                {isPdf
                  ? `Trình đọc PDF trực tiếp (${pdfNumPages} trang)`
                  : isWordDoc
                  ? 'Trình đọc tài liệu Word chuẩn A4 trực tiếp trên web'
                  : isPresentation
                  ? `Trình chiếu PowerPoint (${slides.length} slide)`
                  : isExcelDoc
                  ? `Bảng tính Excel trực tiếp (${excelSheets.length} trang tính)`
                  : isImage
                  ? 'Trình xem hình ảnh chất lượng cao'
                  : 'Trình xem học liệu trực tiếp'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={cleanUrl}
                download={material.fileName || material.title}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
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

// Internal component to render a single PDF page on a canvas in continuous scroll mode
const PdfPageCanvas: React.FC<{
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
}> = ({ pdfDoc, pageNum, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isCancelled = false;
    const renderPage = async () => {
      if (!canvasRef.current || !pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
        canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;
      } catch (err) {
        console.warn(`Error rendering page ${pageNum}:`, err);
      }
    };

    renderPage();
    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNum, scale]);

  return (
    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-lg border border-slate-200/90 dark:border-slate-800 flex flex-col items-center relative group">
      <div className="absolute top-4 right-4 z-10 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xs opacity-60 group-hover:opacity-100 transition-opacity">
        Trang {pageNum}
      </div>
      <canvas ref={canvasRef} className="rounded-lg max-w-full" />
    </div>
  );
};
