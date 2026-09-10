import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Check, RefreshCw, AlertCircle, Play, Sparkles, Volume2, RotateCcw } from 'lucide-react';
import { candidateService } from '../services/candidateService';
import { storageService, createPlayableBlobUrl } from '../services/storageService';
import { speakingService } from '../services/speakingService';
import { SpeakingAudioPlayer } from './SpeakingAudioPlayer';

interface SpeakingSectionProps {
  candidateId: string;
  answers: Record<string, string>; // to see if speaking recordings already exist
  onAnswerChange: (questionId: string, value: string) => void;
  onRefreshSession: () => void;
  speakingQuestions?: any[];
  speakingReadAloud?: { text: string; wordCount: number };
}

export default function SpeakingSection({
  candidateId,
  answers,
  onAnswerChange,
  onRefreshSession,
  speakingQuestions = [],
  speakingReadAloud = { text: '', wordCount: 0 }
}: SpeakingSectionProps) {
  const [permission, setPermission] = useState<boolean | null>(null);
  const [recordingState, setRecordingState] = useState<Record<string, 'idle' | 'recording' | 'saving' | 'done'>>({});
  const [recordingSeconds, setRecordingSeconds] = useState<Record<string, number>>({});
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const mediaRecorders = useRef<Record<string, MediaRecorder>>({});
  const audioChunks = useRef<Record<string, Blob[]>>({});
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  // Restore recorded audios from existing candidate answers and IndexedDB
  useEffect(() => {
    if (answers) {
      const initialDone: Record<string, 'idle' | 'recording' | 'saving' | 'done'> = {};
      const initialUrls: Record<string, string> = {};
      ['speaking_p1', 'speaking_p2_q1', 'speaking_p2_q2', 'speaking_p2_q3'].forEach(k => {
        if (answers[k]) {
          initialDone[k] = 'done';
          // Use createPlayableBlobUrl to ensure base64 is converted to a native Blob URL for iOS
          initialUrls[k] = createPlayableBlobUrl(answers[k]);
        }
      });
      setRecordingState(prev => ({ ...initialDone, ...prev }));
      setAudioUrls(prev => ({ ...initialUrls, ...prev }));
    }
  }, [answers]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearInterval);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Request mic permission
  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermission(true);
      // Clean up stream immediately
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.warn('Microphone permission not granted yet:', err);
      setPermission(false);
    }
  };

  useEffect(() => {
    // Only check if mediaDevices is supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      requestPermission();
    }
  }, []);

  // Reset recording to allow candidate to re-record in case of error or audio issue
  const handleResetRecording = async (id: string) => {
    const confirmMsg = 'Bạn có chắc chắn muốn xóa bản ghi âm này và ghi âm lại không?';
    if (!window.confirm(confirmMsg)) return;

    // Stop active recorder/timers if any
    if (timers.current[id]) {
      clearInterval(timers.current[id]);
    }
    if (mediaRecorders.current[id] && mediaRecorders.current[id].state === 'recording') {
      try {
        mediaRecorders.current[id].stop();
      } catch (e) {}
    }
    audioChunks.current[id] = [];

    // Reset local component states
    setRecordingState(prev => ({ ...prev, [id]: 'idle' }));
    setRecordingSeconds(prev => ({ ...prev, [id]: 0 }));
    setAudioUrls(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    // Notify parent state
    onAnswerChange(id, '');

    // Reset in candidate document in DB
    let answersUpdate: any = {};
    if (id === 'speaking_p1') {
      answersUpdate.speakingPart1 = { audioPath: null, aiEvaluation: null };
    } else if (id === 'speaking_p2_q1') {
      answersUpdate.speakingPart2 = { sp_1_audioPath: null };
    } else if (id === 'speaking_p2_q2') {
      answersUpdate.speakingPart2 = { sp_2_audioPath: null };
    } else if (id === 'speaking_p2_q3') {
      answersUpdate.speakingPart2 = { sp_3_audioPath: null };
    }

    try {
      await candidateService.updateAnswers(candidateId, answersUpdate);
    } catch (err) {
      console.warn('Failed to reset candidate speaking answer in DB:', err);
    }

    // Clear local storage / indexedDB caches
    try {
      await storageService.removeLocalAudio(`${candidateId}_${id}`);
      const backupKey = `offline_speaking_${candidateId}`;
      const existingBackup = JSON.parse(localStorage.getItem(backupKey) || '{}');
      delete existingBackup[id];
      localStorage.setItem(backupKey, JSON.stringify(existingBackup));
    } catch (e) {}
  };

  const startRecording = async (id: string) => {
    // If already done, notify user they can use the re-record button
    if (answers[id] || recordingState[id] === 'done') {
      const retry = window.confirm('Bài nói này đã được lưu. Bạn có muốn ghi âm lại không?');
      if (retry) {
        await handleResetRecording(id);
      }
      return;
    }

    try {
      let options: MediaRecorderOptions = {};
      let mimeType = 'audio/webm';
      
      const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (isIOS) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' };
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/aac')) {
            options = { mimeType: 'audio/aac' };
            mimeType = 'audio/aac';
          }
        }
        
        if (!options.mimeType) {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = { mimeType: 'audio/webm;codecs=opus' };
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            options = { mimeType: 'audio/webm' };
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options = { mimeType: 'audio/mp4' };
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/aac')) {
            options = { mimeType: 'audio/aac' };
            mimeType = 'audio/aac';
          } else {
            options = {};
            mimeType = '';
          }
        }
      } else {
        options = {};
        mimeType = '';
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      setPermission(true);

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = options.mimeType ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      } catch (recInitErr) {
        console.warn('Fallback to standard MediaRecorder without mimeType options:', recInitErr);
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorders.current[id] = mediaRecorder;
      audioChunks.current[id] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.current[id].push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setRecordingState(prev => ({ ...prev, [id]: 'saving' }));
        
        try {
          const actualMime = mimeType || mediaRecorder.mimeType || (isIOS ? 'audio/mp4' : 'audio/webm');
          const audioBlob = new Blob(audioChunks.current[id], { type: actualMime });
          const localBlobUrl = URL.createObjectURL(audioBlob);
          
          // 1. Immediately store the pristine Blob URL for in-browser playback (100% iOS Safari compatible)
          setAudioUrls(prev => ({ ...prev, [id]: localBlobUrl }));

          // 2. Cache raw Blob to IndexedDB locally
          try {
            await storageService.saveLocalAudio(`${candidateId}_${id}`, audioBlob);
          } catch (cacheErr) {}

          // 3. Upload audio blob with multi-tier storage fallback
          let savedUrl = localBlobUrl;
          try {
            savedUrl = await storageService.uploadAudioBlob(audioBlob, candidateId, id);
          } catch (uploadErr) {
            console.warn('Storage upload error, using local fallback:', uploadErr);
            savedUrl = localBlobUrl;
          }

          // If upload produced a permanent HTTP/HTTPS URL, update audioUrls, otherwise retain localBlobUrl
          if (savedUrl && (savedUrl.startsWith('http') || savedUrl.startsWith('/'))) {
            setAudioUrls(prev => ({ ...prev, [id]: savedUrl }));
          }

          // Map the audio path to the proper sub-field of answers
          let answersUpdate: any = {};
          if (id === 'speaking_p1') {
            answersUpdate.speakingPart1 = { audioPath: savedUrl };
          } else if (id === 'speaking_p2_q1') {
            answersUpdate.speakingPart2 = { sp_1_audioPath: savedUrl };
          } else if (id === 'speaking_p2_q2') {
            answersUpdate.speakingPart2 = { sp_2_audioPath: savedUrl };
          } else if (id === 'speaking_p2_q3') {
            answersUpdate.speakingPart2 = { sp_3_audioPath: savedUrl };
          }

          // Update candidate document in Firestore / DB
          try {
            await candidateService.updateAnswers(candidateId, answersUpdate);
          } catch (dbErr) {
            console.warn('DB update failed for speaking answer, saving to local backup:', dbErr);
            try {
              const backupKey = `offline_speaking_${candidateId}`;
              const existingBackup = JSON.parse(localStorage.getItem(backupKey) || '{}');
              localStorage.setItem(backupKey, JSON.stringify({ ...existingBackup, [id]: savedUrl }));
            } catch (e) {}
          }
          
          // Mark answer as registered
          onAnswerChange(id, savedUrl);

          // If speaking_p1 (Read Aloud), trigger Gemini AI Pronunciation scoring automatically in background
          if (id === 'speaking_p1' && savedUrl) {
            try {
              fetch('/api/speaking/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: candidateId,
                  audioPath: savedUrl,
                  referenceText: speakingReadAloud?.text
                })
              })
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(async data => {
                  if (data?.evaluation) {
                    try {
                      const answersUpdateWithEvaluation = {
                        speakingPart1: {
                          audioPath: savedUrl,
                          aiEvaluation: data.evaluation
                        }
                      };
                      await candidateService.updateAnswers(candidateId, answersUpdateWithEvaluation);
                    } catch (e) {}
                    onRefreshSession();
                  }
                })
                .catch(() => {
                  // Ignore AI evaluation failure on static deployments
                });
            } catch (evalErr) {}
          }
        } catch (generalErr) {
          console.error('Error processing audio recording:', generalErr);
        } finally {
          // ALWAYS mark as done and release the mic hardware
          setRecordingState(prev => ({ ...prev, [id]: 'done' }));
          try {
            stream.getTracks().forEach(track => track.stop());
          } catch (e) {}
        }
      };

      // CRITICAL FOR IOS SAFARI:
      // DO NOT pass a timeslice (like start(1000)). In WebKit, chunked MP4 recordings produce
      // corrupted multi-part atoms that cannot be re-concatenated with new Blob(chunks).
      // Calling start() without arguments produces a single clean, fully valid MP4 file on stop!
      mediaRecorder.start();
      setRecordingState(prev => ({ ...prev, [id]: 'recording' }));
      setRecordingSeconds(prev => ({ ...prev, [id]: 0 }));

      // Start timer
      timers.current[id] = setInterval(() => {
        setRecordingSeconds(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      }, 1000);

    } catch (err) {
      console.error('Failed to start media recording:', err);
      alert('Không thể kết nối mic. Vui lòng cấp quyền micro cho trang web này trong Safari/trình duyệt của bạn.');
    }
  };

  const stopRecording = (id: string) => {
    const mediaRecorder = mediaRecorders.current[id];
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // NOTE: Do NOT call mediaRecorder.requestData() before stop()!
      // In Safari iOS, calling requestData() right before stop() emits an unneeded fragmented chunk.
      mediaRecorder.stop();
      if (timers.current[id]) {
        clearInterval(timers.current[id]);
      }
    }
  };

  const formatSeconds = (totalSeconds: number) => {
    if (!totalSeconds) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if recordings already exist in answers or local storage on mount/update
  useEffect(() => {
    const newStates = { ...recordingState };
    const newUrls = { ...audioUrls };

    const restoreRecordings = async () => {
      if (answers['speaking_p1']) {
        newStates['speaking_p1'] = 'done';
        newUrls['speaking_p1'] = createPlayableBlobUrl(answers['speaking_p1']);
      } else if (candidateId) {
        const local = await storageService.getLocalAudio(`${candidateId}_speaking_p1`);
        if (local) {
          const url = createPlayableBlobUrl(local);
          newStates['speaking_p1'] = 'done';
          newUrls['speaking_p1'] = url;
          onAnswerChange('speaking_p1', url);
        }
      }

      for (let idx = 0; idx < speakingQuestions.length; idx++) {
        const id = `speaking_p2_q${idx + 1}`;
        if (answers[id]) {
          newStates[id] = 'done';
          newUrls[id] = createPlayableBlobUrl(answers[id]);
        } else if (candidateId) {
          const local = await storageService.getLocalAudio(`${candidateId}_${id}`);
          if (local) {
            const url = createPlayableBlobUrl(local);
            newStates[id] = 'done';
            newUrls[id] = url;
            onAnswerChange(id, url);
          }
        }
      }

      setRecordingState(newStates);
      setAudioUrls(newUrls);
    };

    restoreRecordings();
  }, [answers, candidateId]);

  // AI Voice speech synthesizer for Part 2 Questions - Stuck-free Chrome fix
  const handleAISpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any currently playing audio
      
      // Delay-release ensure voice engine does not block
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.85; // Natural speed
        
        // Select an English voice if available
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => v.lang.startsWith('en-') || v.lang.startsWith('en_'));
        if (enVoice) {
          utterance.voice = enVoice;
        }
        
        window.speechSynthesis.speak(utterance);
      }, 80);
    } else {
      alert('Trình duyệt của bạn không hỗ trợ tính năng AI đọc câu hỏi.');
    }
  };

  return (
    <div id="speaking-section-wrapper" className="space-y-8">
      
      {/* Skill Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-indigo-900" />
          <h2 className="text-base font-black text-slate-800 uppercase">KỸ NĂNG: NÓI (SPEAKING)</h2>
        </div>
      </div>

      {/* Mic Authorization Check */}
      {permission === false && (
        <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm font-medium text-red-800 space-y-1">
              <p>
                <strong>CHƯA CẤP QUYỀN MICRO:</strong> Trình duyệt chưa cho phép trang web ghi âm.
              </p>
              <p className="text-xs text-red-700 leading-relaxed">
                Trên Safari iPhone/iPad: Nhấn nút <strong>"Cấp quyền Micro"</strong> bên cạnh, hoặc nhấn biểu tượng <strong>aA / 🔒</strong> trên thanh địa chỉ &gt; Cài đặt trang web &gt; Micro &gt; Cho phép.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestPermission}
            className="shrink-0 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all cursor-pointer shadow-sm"
          >
            Cấp quyền Micro ngay
          </button>
        </div>
      )}

      {/* PART 1: READ ALOUD */}
      {speakingReadAloud && speakingReadAloud.text && speakingReadAloud.text.trim().length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-900" />
              <h3 className="font-extrabold text-[#1e3a8a] text-base uppercase">PHẦN 1: ĐỌC THÀNH TIẾNG ĐOẠN VĂN</h3>
            </div>
            <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-900 px-2.5 py-1 rounded-md">
              Chỉ được ghi âm 1 lần
            </span>
          </div>

          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
            Đọc to và rõ ràng đoạn văn dưới đây vào microphone. Bạn chỉ có thể ghi âm <strong className="text-red-600 underline">1 lần duy nhất</strong> và không được sửa đổi hay ghi lại:
          </p>

          {/* Reading Text Container */}
          <div className="bg-slate-50 border border-slate-150 p-6 md:p-8 rounded-2xl font-serif text-base md:text-lg leading-relaxed text-slate-800 select-none shadow-inner text-justify">
            "{speakingReadAloud.text}"
          </div>

          {/* Recording Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              {recordingState['speaking_p1'] === 'recording' ? (
                <button
                  onClick={() => stopRecording('speaking_p1')}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" /> Stop (Dừng & Lưu)
                </button>
              ) : (
                <button
                  onClick={() => startRecording('speaking_p1')}
                  disabled={recordingState['speaking_p1'] === 'saving' || recordingState['speaking_p1'] === 'done'}
                  className="bg-indigo-900 hover:bg-indigo-850 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <Mic className="w-4 h-4" /> 
                  {recordingState['speaking_p1'] === 'done' ? 'Locked (Đã khóa ghi âm)' : 'Start Recording (Bắt đầu nói)'}
                </button>
              )}

              {/* Timer or Status indicators */}
              {recordingState['speaking_p1'] === 'recording' && (
                <div className="flex items-center gap-2 text-red-600 font-mono font-bold animate-pulse">
                  <span className="w-2.5 h-2.5 bg-red-600 rounded-full inline-block animate-ping" />
                  <span>{formatSeconds(recordingSeconds['speaking_p1'] || 0)}</span>
                </div>
              )}

              {recordingState['speaking_p1'] === 'saving' && (
                <div className="flex items-center gap-2 text-indigo-900 font-semibold animate-bounce text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Đang lưu ghi âm bài nói...
                </div>
              )}

              {recordingState['speaking_p1'] === 'done' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-xl text-xs font-extrabold">
                    <Check className="w-4 h-4" /> Đã lưu bài nói thành công ✓
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResetRecording('speaking_p1')}
                    className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                    title="Ghi âm lại nếu âm thanh bị lỗi hoặc muốn làm lại"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Ghi âm lại bài này
                  </button>
                </div>
              )}
            </div>

            {/* Reassurance text */}
            {recordingState['speaking_p1'] === 'done' && (
              <div className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                <span className="font-sans italic">Hệ thống đã lưu bản ghi âm an toàn.</span>
              </div>
            )}
          </div>

          {/* Audio Player Preview for Part 1 */}
          {Boolean((audioUrls['speaking_p1'] && audioUrls['speaking_p1'].trim() !== '') || (answers['speaking_p1'] && answers['speaking_p1'].trim() !== '')) && (
            <SpeakingAudioPlayer
              src={audioUrls['speaking_p1'] || answers['speaking_p1']}
              onReset={() => handleResetRecording('speaking_p1')}
              title="Nghe lại bản ghi âm Phần 1 của bạn:"
            />
          )}
        </div>
      )}

      {/* PART 2: INTERVIEW QUESTIONS */}
      {speakingQuestions && speakingQuestions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-indigo-900" />
              <h3 className="font-extrabold text-[#1e3a8a] text-base uppercase">PHẦN 2: TRẢ LỜI CÂU HỎI PHỎNG VẤN</h3>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-50 text-amber-850 px-2.5 py-1 rounded-md">
              Nghe câu hỏi + Ghi âm 1 lần duy nhất
            </span>
          </div>

          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
            Bấm nút AI để nghe câu hỏi đọc to. Sau đó bấm nút Ghi âm để trả lời câu hỏi (<span className="text-red-600 font-bold">Chỉ được ghi âm 1 lần duy nhất</span>):
          </p>

          {/* Questions Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {speakingQuestions.map((q, idx) => {
              const id = `speaking_p2_q${idx + 1}`;
              const state = recordingState[id] || 'idle';
              const seconds = recordingSeconds[id] || 0;
              const isCompleted = state === 'done';

              return (
                <div key={q.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <span className="text-xs font-extrabold text-indigo-900 tracking-wider block">CÂU HỎI {idx + 1}</span>
                    
                    {/* AI Read Question Aloud Button */}
                    <button
                      onClick={() => handleAISpeak(q.text)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-950 font-bold rounded-xl text-xs border border-indigo-200 transition-all select-none cursor-pointer"
                      title="Nhấp vào đây để AI đọc to câu hỏi này"
                    >
                      <Volume2 className="w-4 h-4 text-indigo-900 animate-pulse" />
                      <span>Nhấp vào đây để nghe câu hỏi</span>
                    </button>

                    <p className="text-sm font-extrabold text-slate-800 leading-relaxed font-sans italic pt-1 text-center">
                      "{q.text}"
                    </p>
                  </div>

                  {/* Recorder Control inside card */}
                  <div className="pt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-center gap-2">
                      {state === 'recording' ? (
                        <button
                          onClick={() => stopRecording(id)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" /> Stop (Dừng & Lưu)
                        </button>
                      ) : (
                        <button
                          onClick={() => startRecording(id)}
                          disabled={state === 'saving' || isCompleted}
                          className="w-full bg-indigo-900 hover:bg-indigo-850 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                        >
                          <Mic className="w-3.5 h-3.5" /> 
                          {isCompleted ? 'Locked (Đã khóa)' : 'Ghi âm'}
                        </button>
                      )}
                    </div>

                    {state === 'recording' && (
                      <div className="flex items-center justify-center gap-1.5 text-red-600 font-mono font-black text-xs animate-pulse">
                        <span className="w-2 h-2 bg-red-600 rounded-full inline-block animate-ping" />
                        <span>{formatSeconds(seconds)}</span>
                      </div>
                    )}

                    {state === 'saving' && (
                      <span className="text-indigo-900 font-extrabold text-xs flex items-center justify-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving audio file...
                      </span>
                    )}

                    {isCompleted && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 py-1 px-2 rounded-lg text-xs font-bold">
                            <Check className="w-3.5 h-3.5" /> Đã lưu ✓
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResetRecording(id)}
                            className="text-xs text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Ghi âm lại câu này"
                          >
                            <RotateCcw className="w-3 h-3" /> Ghi lại
                          </button>
                        </div>
                        {Boolean((audioUrls[id] && audioUrls[id].trim() !== '') || (answers[id] && answers[id].trim() !== '')) && (
                          <SpeakingAudioPlayer
                            src={audioUrls[id] || answers[id]}
                            onReset={() => handleResetRecording(id)}
                            title={`Nghe lại câu ${idx + 1}:`}
                            compact
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
