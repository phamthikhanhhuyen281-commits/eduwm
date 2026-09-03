import React, { useRef, useState, useEffect } from 'react';
import { Play, Volume2, Headphones, AlertTriangle, HelpCircle, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import { candidateService } from '../services/candidateService';

interface ListeningSectionProps {
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, answer: string) => void;
  onSkipQuestion: (questionId: string) => void;
  currentQuestionId: string;
  setCurrentQuestionId: (id: string) => void;
  questionsPart1?: any[];
  questionsPart2?: any[];
  audio1Url?: string;
  audio2Url?: string;
  examId?: string;
  candidateId?: string;
  candidatePhone?: string;
  candidateAudioPlayback?: {
    audio1Played?: boolean;
    audio1PlayedAt?: string;
    audio2Played?: boolean;
    audio2PlayedAt?: string;
  };
  onAudioPlayed?: (audioType: 'audio1' | 'audio2') => void;
}

export default function ListeningSection({
  answers,
  onAnswerChange,
  onSkipQuestion,
  currentQuestionId,
  setCurrentQuestionId,
  questionsPart1 = [],
  questionsPart2 = [],
  audio1Url = '',
  audio2Url = '',
  examId = '',
  candidateId = '',
  candidatePhone = '',
  candidateAudioPlayback,
  onAudioPlayed
}: ListeningSectionProps) {
  const getAudio1Key = () => {
    const cleanCandidate = candidatePhone?.trim() || candidateId || 'guest';
    const cleanExam = examId || 'default';
    return `audio_l1_played_${cleanCandidate}_${cleanExam}`;
  };

  const getAudio2Key = () => {
    const cleanCandidate = candidatePhone?.trim() || candidateId || 'guest';
    const cleanExam = examId || 'default';
    return `audio_l2_played_${cleanCandidate}_${cleanExam}`;
  };

  const getProxiedUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    // Google Drive requires server proxy to bypass auth/cors
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      return `/api/audio-proxy?url=${encodeURIComponent(url)}`;
    }
    // Direct audio URLs from storage/CDN work natively and faster
    return url;
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sound Test Helper using Web Audio API chime
  const [testSoundPlaying, setTestSoundPlaying] = useState(false);
  const [soundTestSuccess, setSoundTestSuccess] = useState(false);

  const handleTestSpeaker = () => {
    try {
      setTestSoundPlaying(true);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        alert('Trình duyệt của bạn không hỗ trợ Web Audio. Vui lòng thử trên Chrome hoặc Edge.');
        setTestSoundPlaying(false);
        return;
      }
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Play a pleasant two-tone chime (523Hz C5 -> 659Hz E5 -> 784Hz G5)
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.15);

        gain.gain.setValueAtTime(0, now + index * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, now + index * 0.15 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.15 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.15);
        osc.stop(now + index * 0.15 + 0.4);
      });

      setTimeout(() => {
        setTestSoundPlaying(false);
        setSoundTestSuccess(true);
      }, 900);
    } catch (e) {
      console.error('Sound check failed:', e);
      setTestSoundPlaying(false);
    }
  };

  const renderInlineBlank = (qId: string, itemNum: number, displayNum: string) => {
    const currentVal = answers[qId] || '';
    const isSkipped = currentVal === '__SKIPPED__';
    const isActive = currentQuestionId === qId;
    
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          setCurrentQuestionId(qId);
        }}
        className={`inline-flex flex-col relative transition-all align-middle mx-1.5 p-1 rounded-lg border leading-normal ${
          isSkipped 
            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
            : isActive
            ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className="flex items-center gap-1.5 px-1">
          {/* Number badge matching image and preserving index */}
          <span className="text-[10px] font-black font-mono text-indigo-900 shrink-0 select-none bg-indigo-100/70 px-1 py-0.5 rounded leading-none">
            ({displayNum})
          </span>
          
          {isSkipped ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 leading-none">
              <span>Đã bỏ qua</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnswerChange(qId, '');
                }}
                className="text-[10px] text-indigo-900 hover:text-indigo-700 underline font-black uppercase cursor-pointer px-1 py-0.5"
              >
                Làm lại
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-1 leading-none">
              <input
                type="text"
                id={`input-blank-${qId}`}
                placeholder="..........."
                value={currentVal}
                onChange={(e) => {
                  onAnswerChange(qId, e.target.value);
                }}
                className="border-b border-dashed border-slate-400 focus:border-indigo-600 focus:bg-white outline-none px-1 font-bold text-indigo-950 w-24 text-xs bg-transparent py-0 transition-all text-center leading-none"
              />
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkipQuestion(qId);
                  onAnswerChange(qId, '__SKIPPED__');
                }}
                className="text-[9px] text-slate-400 hover:text-amber-700 hover:bg-amber-50 px-1 py-0.5 rounded transition-all font-bold cursor-pointer uppercase leading-none border border-slate-200"
                title="Bỏ qua câu này"
              >
                Bỏ qua
              </button>
            </span>
          )}
        </span>
        <span className="text-[8px] text-slate-400 leading-none px-1 mt-0.5 select-none font-medium text-center">
          Bỏ qua nếu không làm được
        </span>
      </span>
    );
  };

  const [audio1State, setAudio1State] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [audio2State, setAudio2State] = useState<'idle' | 'playing' | 'ended'>('idle');

  const [audio1Progress, setAudio1Progress] = useState(0);
  const [audio2Progress, setAudio2Progress] = useState(0);
  const [audio1CurrentTime, setAudio1CurrentTime] = useState(0);
  const [audio1Duration, setAudio1Duration] = useState(0);
  const [audio2CurrentTime, setAudio2CurrentTime] = useState(0);
  const [audio2Duration, setAudio2Duration] = useState(0);
  const [audio1ErrorMsg, setAudio1ErrorMsg] = useState<string | null>(null);
  const [audio2ErrorMsg, setAudio2ErrorMsg] = useState<string | null>(null);
  const [audio1UsingFallback, setAudio1UsingFallback] = useState(false);
  const [audio2UsingFallback, setAudio2UsingFallback] = useState(false);

  const audio1Ref = useRef<HTMLAudioElement | null>(null);
  const audio2Ref = useRef<HTMLAudioElement | null>(null);

  // Initialize audio state from candidate Firestore document and localStorage (Strict 1-time per account per exam)
  useEffect(() => {
    const key1 = getAudio1Key();
    const key2 = getAudio2Key();

    // Check if THIS specific candidate account has played this exam's audio
    const isL1Played = 
      candidateAudioPlayback?.audio1Played === true ||
      (candidateAudioPlayback?.audio1Played !== false && localStorage.getItem(key1) === 'true');
    const isL2Played = 
      candidateAudioPlayback?.audio2Played === true ||
      (candidateAudioPlayback?.audio2Played !== false && localStorage.getItem(key2) === 'true');
    
    if (isL1Played) {
      setAudio1State('ended');
      localStorage.setItem(key1, 'true');
    } else {
      setAudio1State('idle');
      localStorage.removeItem(key1);
    }

    if (isL2Played) {
      setAudio2State('ended');
      localStorage.setItem(key2, 'true');
    } else {
      setAudio2State('idle');
      localStorage.removeItem(key2);
    }
  }, [audio1Url, audio2Url, candidateId, candidatePhone, examId, candidateAudioPlayback?.audio1Played, candidateAudioPlayback?.audio2Played]);

  // Cleanup audio elements on unmount to prevent playing in background
  useEffect(() => {
    return () => {
      if (audio1Ref.current) {
        try {
          audio1Ref.current.pause();
        } catch (e) {}
      }
      if (audio2Ref.current) {
        try {
          audio2Ref.current.pause();
        } catch (e) {}
      }
    };
  }, []);

  // Scroll to targeted question when active question changes in Navigator
  useEffect(() => {
    if (currentQuestionId) {
      const targetElement = document.getElementById(`listening-q-${currentQuestionId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add temporary highlight effect
        targetElement.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
        const timer = setTimeout(() => {
          targetElement.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [currentQuestionId]);

  const handlePlayAudio1 = async () => {
    if (audio1State !== 'idle') return;
    setAudio1ErrorMsg(null);

    if (!audio1Ref.current) return;

    try {
      audio1Ref.current.volume = 1;
      audio1Ref.current.muted = false;

      // Unlock Web Audio context on the user gesture
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      }

      await audio1Ref.current.play();

      localStorage.setItem(getAudio1Key(), 'true');
      setAudio1State('playing');

      if (candidateId) {
        candidateService.recordAudioPlayed(candidateId, 'audio1').catch((err) => {
          console.warn('Failed to record audio1 playback:', err);
        });
        if (onAudioPlayed) {
          onAudioPlayed('audio1');
        }
      }
    } catch (err: any) {
      if (err && (err.name === 'AbortError' || err.message?.includes('interrupted') || err.message?.includes('removed'))) {
        console.warn('Audio 1 playback interrupted (benign):', err.message);
      } else {
        console.error('Audio 1 playback failed:', err);
        if (!audio1UsingFallback) {
          setAudio1UsingFallback(true);
          setAudio1ErrorMsg('Đang chuyển đổi phương thức phát âm thanh dự phòng...');
          setTimeout(async () => {
            if (audio1Ref.current) {
              try {
                audio1Ref.current.load();
                await audio1Ref.current.play();
                localStorage.setItem(getAudio1Key(), 'true');
                setAudio1State('playing');
                setAudio1ErrorMsg(null);
                if (candidateId) {
                  candidateService.recordAudioPlayed(candidateId, 'audio1').catch(() => {});
                  if (onAudioPlayed) {
                    onAudioPlayed('audio1');
                  }
                }
              } catch (e2: any) {
                setAudio1ErrorMsg('Không thể phát âm thanh: ' + (e2.message || 'Vui lòng kiểm tra quyền âm thanh trình duyệt và bấm Thử lại.'));
                setAudio1State('idle');
              }
            }
          }, 300);
        } else {
          setAudio1ErrorMsg('Trình duyệt đã chặn âm thanh hoặc file nghe không tải được. Vui lòng bấm vào đây để thử lại.');
          setAudio1State('idle');
        }
      }
    }
  };

  const handlePlayAudio2 = async () => {
    if (audio2State !== 'idle') return;
    setAudio2ErrorMsg(null);

    if (!audio2Ref.current) return;

    try {
      audio2Ref.current.volume = 1;
      audio2Ref.current.muted = false;

      // Unlock Web Audio context on user gesture
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
      }

      await audio2Ref.current.play();

      localStorage.setItem(getAudio2Key(), 'true');
      setAudio2State('playing');

      if (candidateId) {
        candidateService.recordAudioPlayed(candidateId, 'audio2').catch((err) => {
          console.warn('Failed to record audio2 playback:', err);
        });
        if (onAudioPlayed) {
          onAudioPlayed('audio2');
        }
      }
    } catch (err: any) {
      if (err && (err.name === 'AbortError' || err.message?.includes('interrupted') || err.message?.includes('removed'))) {
        console.warn('Audio 2 playback interrupted (benign):', err.message);
      } else {
        console.error('Audio 2 playback failed:', err);
        if (!audio2UsingFallback) {
          setAudio2UsingFallback(true);
          setAudio2ErrorMsg('Đang chuyển đổi phương thức phát âm thanh dự phòng...');
          setTimeout(async () => {
            if (audio2Ref.current) {
              try {
                audio2Ref.current.load();
                await audio2Ref.current.play();
                localStorage.setItem(getAudio2Key(), 'true');
                setAudio2State('playing');
                setAudio2ErrorMsg(null);
                if (candidateId) {
                  candidateService.recordAudioPlayed(candidateId, 'audio2').catch(() => {});
                  if (onAudioPlayed) {
                    onAudioPlayed('audio2');
                  }
                }
              } catch (e2: any) {
                setAudio2ErrorMsg('Không thể phát âm thanh: ' + (e2.message || 'Vui lòng kiểm tra quyền âm thanh trình duyệt.'));
                setAudio2State('idle');
              }
            }
          }, 300);
        } else {
          setAudio2ErrorMsg('Trình duyệt đã chặn âm thanh hoặc file nghe không tải được. Vui lòng bấm vào đây để thử lại.');
          setAudio2State('idle');
        }
      }
    }
  };

  const handleAudio1TimeUpdate = () => {
    if (audio1Ref.current) {
      const cur = audio1Ref.current.currentTime || 0;
      const dur = audio1Ref.current.duration || 0;
      setAudio1CurrentTime(cur);
      setAudio1Duration(dur);
      const prog = dur > 0 ? (cur / dur) * 100 : 0;
      setAudio1Progress(prog || 0);
    }
  };

  const handleAudio1Ended = () => {
    setAudio1State('ended');
    localStorage.setItem(getAudio1Key(), 'true');
    if (candidateId) {
      candidateService.recordAudioPlayed(candidateId, 'audio1').catch(() => {});
      if (onAudioPlayed) {
        onAudioPlayed('audio1');
      }
    }
  };

  const handleAudio2TimeUpdate = () => {
    if (audio2Ref.current) {
      const cur = audio2Ref.current.currentTime || 0;
      const dur = audio2Ref.current.duration || 0;
      setAudio2CurrentTime(cur);
      setAudio2Duration(dur);
      const prog = dur > 0 ? (cur / dur) * 100 : 0;
      setAudio2Progress(prog || 0);
    }
  };

  const handleAudio2Ended = () => {
    setAudio2State('ended');
    localStorage.setItem(getAudio2Key(), 'true');
    if (candidateId) {
      candidateService.recordAudioPlayed(candidateId, 'audio2').catch(() => {});
      if (onAudioPlayed) {
        onAudioPlayed('audio2');
      }
    }
  };

  const audio1ActualSrc = audio1UsingFallback
    ? (audio1Url.includes('drive.google.com') ? audio1Url : `/api/audio-proxy?url=${encodeURIComponent(audio1Url)}`)
    : getProxiedUrl(audio1Url);
  const audio2ActualSrc = audio2UsingFallback
    ? (audio2Url.includes('drive.google.com') ? audio2Url : `/api/audio-proxy?url=${encodeURIComponent(audio2Url)}`)
    : getProxiedUrl(audio2Url);

  return (
    <div id="listening-section-wrapper" className="space-y-6">
      
      {/* Skill Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="w-5 h-5 text-indigo-900" />
          <h2 className="text-base font-black text-slate-800 uppercase">KỸ NĂNG: NGHE (LISTENING)</h2>
        </div>
      </div>

      {/* Strict Warning Alert & Sound Check banner */}
      <div className="bg-gradient-to-r from-red-50 to-amber-50 text-red-950 border-l-4 border-red-600 p-4.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm border border-red-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-950 text-xs font-bold leading-relaxed">
              <strong className="uppercase">CHÚ Ý QUAN TRỌNG:</strong> Thí sinh <strong className="underline">CHỈ ĐƯỢC NGHE 1 LẦN DUY NHẤT</strong>. Khi đã nhấn Play, audio sẽ phát liên tục đến hết.
            </p>
            <p className="text-[11px] text-red-800/80 mt-0.5">
              Vui lòng bấm nút <strong>"Kiểm tra loa / tai nghe"</strong> bên cạnh để đảm bảo thiết bị có âm thanh trước khi bấm làm bài.
            </p>
          </div>
        </div>

        {/* Sound check test button */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestSpeaker}
            disabled={testSoundPlaying}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              testSoundPlaying
                ? 'bg-amber-500 text-white animate-pulse'
                : soundTestSuccess
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : 'bg-indigo-900 hover:bg-indigo-850 text-white'
            }`}
          >
            {testSoundPlaying ? (
              <>
                <Volume2 className="w-3.5 h-3.5 animate-bounce" /> ĐANG PHÁT TIẾNG CHUÔNG...
              </>
            ) : soundTestSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> ÂM THANH HOẠT ĐỘNG TỐT 🔊
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" /> KIỂM TRA LOA / TAI NGHE 🔊
              </>
            )}
          </button>
        </div>
      </div>

      {/* Audio Controls + All Questions displayed in place */}
      <div className="space-y-8 w-full">
        
        {/* ================= BÀI 1 SECTION ================= */}
        {questionsPart1 && questionsPart1.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-indigo-900" />
                <h3 className="text-base font-black text-slate-800 uppercase">Phần 1: Lisa Checking into a Hotel (Câu 1 - {questionsPart1.length})</h3>
              </div>
              <span className="text-xs font-mono bg-indigo-50 text-indigo-900 px-2.5 py-1 rounded-md font-bold">
                Trắc nghiệm MCQ
              </span>
            </div>

              {/* Audio 1 Control Panel */}
              {audio1Url && audio1Url !== '' ? (
                <div className="p-5 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/65 shadow-inner space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Volume2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                          Audio Clip 01
                          {audio1State === 'playing' && (
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              {formatSeconds(audio1CurrentTime)} / {formatSeconds(audio1Duration)}
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium leading-none mt-1">Audio can only be played ONCE. Please listen carefully.</p>
                      </div>
                    </div>

                    <audio
                      ref={audio1Ref}
                      src={audio1ActualSrc || undefined}
                      onTimeUpdate={handleAudio1TimeUpdate}
                      onEnded={handleAudio1Ended}
                      onLoadedMetadata={handleAudio1TimeUpdate}
                      onError={() => {
                        if (!audio1UsingFallback && audio1Url) {
                          setAudio1UsingFallback(true);
                        }
                      }}
                      preload="auto"
                      referrerPolicy="no-referrer"
                      controlsList="nodownload"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        id="play-audio1-btn"
                        onClick={handlePlayAudio1}
                        disabled={audio1State !== 'idle'}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer select-none transition-all sm:w-auto w-full justify-center ${
                          audio1State === 'idle'
                            ? 'bg-indigo-900 hover:bg-indigo-850 text-white'
                            : audio1State === 'playing'
                            ? 'bg-emerald-600 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none border border-slate-300'
                        }`}
                      >
                        {audio1State === 'idle' && <><Play className="w-3.5 h-3.5 fill-current" /> PLAY AUDIO 1</>}
                        {audio1State === 'playing' && <><Volume2 className="w-3.5 h-3.5 animate-bounce" /> ĐANG PHÁT AUDIO 1...</>}
                        {audio1State === 'ended' && <><Lock className="w-3.5 h-3.5 text-slate-400" /> ĐÃ HOÀN THÀNH (KHÓA AUDIO 1)</>}
                      </button>
                    </div>
                  </div>

                  {audio1State === 'ended' && (
                    <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 pt-1">
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Bài Audio 1 đã phát xong và được khóa lại theo quy chế thi. Mỗi tài khoản chỉ được nghe 01 lần duy nhất trong kỳ thi.</span>
                    </p>
                  )}

                  {audio1ErrorMsg && (
                    <div className="p-3 bg-red-100 text-red-900 text-xs rounded-xl flex items-center justify-between">
                      <span>⚠️ {audio1ErrorMsg}</span>
                      <button
                        type="button"
                        onClick={handlePlayAudio1}
                        className="bg-red-700 text-white px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer hover:bg-red-800"
                      >
                        Thử lại
                      </button>
                    </div>
                  )}

                  {/* Progress bar */}
                  {audio1State === 'playing' && (
                    <div className="w-full bg-slate-200/85 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-900 h-1.5 transition-all duration-300" style={{ width: `${audio1Progress}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-850 text-xs font-medium flex items-center gap-2 shadow-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>⚠️ Câu hỏi đã được tải nhưng đề thi chưa được cài đặt file nghe Audio 1. Giáo viên vui lòng vào mục quản trị để tải lên.</span>
                </div>
              )}

              {/* Questions list for Part 1 */}
              <div className="space-y-6 pt-2">
                <p className="text-sm font-semibold text-slate-700 leading-relaxed italic">
                  Listen to the audio recording, and for questions 1 to {questionsPart1.length}, choose the correct answer.
                </p>

                <div className="space-y-6">
                {questionsPart1.map((q, idx) => {
                  const currentAnswer = answers[q.id] || '';
                  const isSkipped = currentAnswer === '__SKIPPED__';
                  return (
                    <div
                      key={q.id}
                      id={`listening-q-${q.id}`}
                      className={`p-5 rounded-xl border transition-all ${
                        isSkipped 
                          ? 'border-amber-300 bg-amber-50/10' 
                          : currentAnswer 
                          ? 'border-indigo-100 bg-indigo-50/15' 
                          : 'border-slate-150 bg-slate-50/20'
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <span className="text-xs font-bold font-mono text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded-md mt-0.5 shrink-0">
                          Q{(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <h4 className="text-sm md:text-base font-bold text-slate-800 leading-snug">
                          {q.text || q.question}
                        </h4>
                      </div>

                      {q.imageUrl && q.imageUrl.trim() !== '' && (
                        <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-w-md shadow-xs">
                          <img
                            src={q.imageUrl}
                            alt={`Listening Question ${idx + 1}`}
                            className="w-full h-auto object-cover max-h-[300px]"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {q.audioUrl && q.audioUrl.trim() !== '' && (
                        <div className="mb-4 p-3 rounded-xl border border-indigo-100 bg-indigo-50/20 max-w-md flex items-center gap-3 shadow-xs">
                          <audio
                            src={getProxiedUrl(q.audioUrl) || undefined}
                            controls
                            className="w-full h-8"
                            preload="auto"
                            controlsList="nodownload"
                          />
                        </div>
                      )}

                      {isSkipped ? (
                        <div className="bg-amber-100/40 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-1.5 text-slate-700">
                            ⚠️ Bạn đã bỏ qua câu hỏi này.
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onAnswerChange(q.id, '');
                            }}
                            className="bg-white border border-amber-300 text-indigo-900 hover:bg-indigo-50 px-3 py-1 rounded-lg font-bold shadow-sm transition-colors cursor-pointer text-[11px]"
                          >
                            LÀM LẠI CÂU NÀY
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {q.options.map((option, oIdx) => {
                            const optionLetter = String.fromCharCode(65 + oIdx); // A, B, C
                            const isSelected = currentAnswer === optionLetter;

                            return (
                              <button
                                key={oIdx}
                                id={`option-${q.id}-${optionLetter}`}
                                onClick={() => {
                                  onAnswerChange(q.id, optionLetter);
                                  setCurrentQuestionId(q.id);
                                }}
                                className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-2.5 text-xs font-medium ${
                                  isSelected
                                    ? 'bg-indigo-900 border-indigo-900 text-white font-semibold'
                                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                  isSelected ? 'bg-white text-indigo-900 border-white' : 'border-slate-300 text-slate-400 bg-slate-50'
                                }`}>
                                  {optionLetter}
                                </div>
                                <span className="leading-tight">{option}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Skip button and Note */}
                      <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-dashed border-slate-200 text-[11px] text-slate-400">
                        <span className="font-medium italic">*(Bỏ qua nếu bạn không làm được)*</span>
                        {!isSkipped && (
                          <button
                            type="button"
                            onClick={() => {
                              onSkipQuestion(q.id);
                              onAnswerChange(q.id, '__SKIPPED__');
                            }}
                            className="text-slate-400 hover:text-amber-700 font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            BỎ QUA CÂU NÀY
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}

          {/* ================= BÀI 2 SECTION ================= */}
          {questionsPart2 && questionsPart2.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-indigo-900" />
                  <h3 className="text-base font-black text-slate-800 uppercase">Bài 2: Listening Part 2 (Câu {questionsPart1.length + 1} - {questionsPart1.length + questionsPart2.length})</h3>
                </div>
                <span className="text-xs font-mono bg-amber-50 text-amber-800 px-2.5 py-1 rounded-md font-bold">
                  Điền Từ Vào Chỗ Trống
                </span>
              </div>

              {/* Audio 2 Control Panel */}
              {audio2Url && audio2Url !== '' ? (
                <div className="p-5 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/65 shadow-inner space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Volume2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                          Audio Clip 02
                          {audio2State === 'playing' && (
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              {formatSeconds(audio2CurrentTime)} / {formatSeconds(audio2Duration)}
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium leading-none mt-1">Audio can only be played ONCE. Please listen carefully.</p>
                      </div>
                    </div>

                    <audio
                      ref={audio2Ref}
                      src={audio2ActualSrc || undefined}
                      onTimeUpdate={handleAudio2TimeUpdate}
                      onEnded={handleAudio2Ended}
                      onLoadedMetadata={handleAudio2TimeUpdate}
                      onError={() => {
                        if (!audio2UsingFallback && audio2Url) {
                          setAudio2UsingFallback(true);
                        }
                      }}
                      preload="auto"
                      referrerPolicy="no-referrer"
                      controlsList="nodownload"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        id="play-audio2-btn"
                        onClick={handlePlayAudio2}
                        disabled={audio2State !== 'idle'}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer select-none transition-all sm:w-auto w-full justify-center ${
                          audio2State === 'idle'
                            ? 'bg-indigo-900 hover:bg-indigo-850 text-white'
                            : audio2State === 'playing'
                            ? 'bg-emerald-600 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none border border-slate-300'
                        }`}
                      >
                        {audio2State === 'idle' && <><Play className="w-3.5 h-3.5 fill-current" /> PLAY AUDIO 2</>}
                        {audio2State === 'playing' && <><Volume2 className="w-3.5 h-3.5 animate-bounce" /> ĐANG PHÁT AUDIO 2...</>}
                        {audio2State === 'ended' && <><Lock className="w-3.5 h-3.5 text-slate-400" /> ĐÃ HOÀN THÀNH (KHÓA AUDIO 2)</>}
                      </button>
                    </div>
                  </div>

                  {audio2State === 'ended' && (
                    <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 pt-1">
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Bài Audio 2 đã phát xong và được khóa lại theo quy chế thi. Mỗi tài khoản chỉ được nghe 01 lần duy nhất trong kỳ thi.</span>
                    </p>
                  )}

                  {audio2ErrorMsg && (
                    <div className="p-3 bg-red-100 text-red-900 text-xs rounded-xl flex items-center justify-between">
                      <span>⚠️ {audio2ErrorMsg}</span>
                      <button
                        type="button"
                        onClick={handlePlayAudio2}
                        className="bg-red-700 text-white px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer hover:bg-red-800"
                      >
                        Thử lại
                      </button>
                    </div>
                  )}

                  {/* Progress bar */}
                  {audio2State === 'playing' && (
                    <div className="w-full bg-slate-200/85 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-900 h-1.5 transition-all duration-300" style={{ width: `${audio2Progress}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-850 text-xs font-medium flex items-center gap-2 shadow-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>⚠️ Câu hỏi đã được tải nhưng đề thi chưa được cài đặt file nghe Audio 2. Giáo viên vui lòng vào mục quản trị để tải lên.</span>
                </div>
              )}

            {/* Question as cohesive Renting Form / Text with inline inputs */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-700 italic leading-relaxed">
                Listen to the recording and fill in the blanks. Type <strong className="text-indigo-900 font-black underline uppercase">ONLY ONE WORD OR A NUMBER</strong> for each answer.
              </p>

              {questionsPart2.length === 10 && questionsPart2[0]?.id === 'l2_1' ? (
                <div className="border border-slate-200 rounded-2xl p-6 md:p-8 bg-white shadow-sm space-y-6 font-serif text-slate-900 leading-relaxed text-sm">
                  {/* Outer Frame with elegant header */}
                  <div className="border-b-2 border-indigo-950 pb-3 mb-4 text-center">
                    <h4 className="text-base md:text-lg font-bold font-sans text-indigo-950 tracking-wider uppercase">
                      RENTED PROPERTIES: INFORMATION ABOUT A HOUSE
                    </h4>
                  </div>

                  <div className="space-y-6">
                    {/* Availability & Pricing Group */}
                    <div className="space-y-3">
                      <h5 className="font-sans font-bold text-[#1e3a8a] border-b border-dashed border-slate-200 pb-1 text-xs uppercase tracking-wide">
                        Availability & Pricing
                      </h5>
                      <ul className="list-disc pl-5 space-y-2">
                        <li id="listening-q-l2_1" className="transition-all hover:bg-slate-50 p-1 rounded">
                          Available date: {renderInlineBlank('l2_1', 8, '8')}
                        </li>
                        <li id="listening-q-l2_2" className="transition-all hover:bg-slate-50 p-1 rounded">
                          Prices Rent: $ {renderInlineBlank('l2_2', 9, '9')} per month
                        </li>
                        <li className="text-slate-500 p-1">
                          Deposit: $1,500
                        </li>
                        <li id="listening-q-l2_3" className="transition-all hover:bg-slate-50 p-1 rounded">
                          Credit check: {renderInlineBlank('l2_3', 10, '10')}
                        </li>
                      </ul>
                    </div>

                    {/* Facilities Group */}
                    <div className="space-y-3">
                      <h5 className="font-sans font-bold text-[#1e3a8a] border-b border-dashed border-slate-200 pb-1 text-xs uppercase tracking-wide">
                        Facilities
                      </h5>
                      <ul className="list-disc pl-5 space-y-2">
                        <li className="text-slate-500 p-1">
                          Bedrooms and bathrooms: 3 bedrooms and 2 bathrooms
                        </li>
                        <li id="listening-q-l2_4" className="transition-all hover:bg-slate-50 p-1 rounded">
                          A remodelled: {renderInlineBlank('l2_4', 11, '11')}
                        </li>
                        <li id="listening-q-l2_5" className="transition-all hover:bg-slate-50 p-1 rounded">
                          No: {renderInlineBlank('l2_5', 12, '12')}
                        </li>
                        <li id="listening-q-l2_6" className="transition-all hover:bg-slate-50 p-1 rounded">
                          Parking: A {renderInlineBlank('l2_6', 13, '13')} with a work area
                        </li>
                      </ul>
                    </div>

                    {/* Utilities Group */}
                    <div className="space-y-3">
                      <h5 className="font-sans font-bold text-[#1e3a8a] border-b border-dashed border-slate-200 pb-1 text-xs uppercase tracking-wide">
                        Utilities
                      </h5>
                      <ul className="list-disc pl-5 space-y-2">
                        <li id="listening-q-l2_7" className="transition-all hover:bg-slate-50 p-1 rounded">
                          Garden care: The landlord will provide landscaping service, but the tenants must {renderInlineBlank('l2_7', 14, '14')} the grass.
                        </li>
                        <li id="listening-q-l2_8" className="transition-all hover:bg-slate-50 p-1 rounded">
                          The tenants should pay $15 for trashing and {renderInlineBlank('l2_8', 15, '15')} service.
                        </li>
                        <li className="text-slate-500 p-1">
                          Other bills: The tenants should pay for electricity, water and gas bills.
                        </li>
                      </ul>
                    </div>

                    {/* Other Information Group */}
                    <div className="space-y-3">
                      <h5 className="font-sans font-bold text-[#1e3a8a] border-b border-dashed border-slate-200 pb-1 text-xs uppercase tracking-wide">
                        Other Information
                      </h5>
                      <ul className="list-disc pl-5 space-y-2">
                        <li id="listening-q-l2_9" className="transition-all hover:bg-slate-50 p-1 rounded">
                          Air conditioning: There is no central air conditioning, but there is a {renderInlineBlank('l2_9', 16, '16')} conditioning unit.
                        </li>
                        <li id="listening-q-l2_10" className="transition-all hover:bg-slate-50 p-1 rounded">
                          Student's name: Sam {renderInlineBlank('l2_10', 17, '17')}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-150 rounded-2xl p-6 md:p-8 bg-slate-50/30 shadow-sm space-y-4">
                  {questionsPart2.map((q, idx) => {
                    const currentAnswer = answers[q.id] || '';
                    const isSkipped = currentAnswer === '__SKIPPED__';

                    return (
                      <div
                        key={q.id}
                        id={`listening-q-${q.id}`}
                        className={`p-4 rounded-xl border transition-all ${
                          isSkipped
                            ? 'border-amber-300 bg-amber-50/40'
                            : currentAnswer
                            ? 'border-indigo-100 bg-indigo-50/15'
                            : 'border-slate-150 bg-slate-50/20'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-slate-700 text-xs md:text-sm">
                          <span className="text-xs font-bold font-mono text-indigo-900 bg-indigo-100/70 px-2.5 py-1 rounded-md shrink-0">
                            Q{(idx + 1 + questionsPart1.length).toString().padStart(2, '0')}
                          </span>
                          <span className="font-bold text-slate-800 leading-snug grow">{q.text || q.question}</span>

                          {isSkipped ? (
                            <div className="flex items-center gap-2 bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0">
                              <span>⚠️ Đã bỏ qua câu này</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAnswerChange(q.id, '');
                                  setCurrentQuestionId(q.id);
                                }}
                                className="text-indigo-900 hover:text-indigo-700 underline font-black uppercase text-[11px] cursor-pointer ml-1"
                              >
                                Làm lại
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                type="text"
                                id={`input-blank-${q.id}`}
                                placeholder="Nhập câu trả lời..."
                                value={currentAnswer}
                                onChange={(e) => {
                                  onAnswerChange(q.id, e.target.value);
                                  setCurrentQuestionId(q.id);
                                }}
                                className="border-b-2 border-indigo-300 focus:border-indigo-600 focus:bg-indigo-50/30 outline-none px-2 font-bold text-indigo-950 min-w-[150px] bg-transparent py-1 text-center transition-all text-xs placeholder:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSkipQuestion(q.id);
                                  onAnswerChange(q.id, '__SKIPPED__');
                                  setCurrentQuestionId(q.id);
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-amber-800 hover:bg-amber-100/80 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 uppercase"
                                title="Bỏ qua câu này nếu không biết làm"
                              >
                                Bỏ qua
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}

          {(!questionsPart1 || questionsPart1.length === 0) && (!questionsPart2 || questionsPart2.length === 0) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center text-slate-500 space-y-3">
              <Headphones className="w-12 h-12 mx-auto stroke-1 text-slate-400 animate-pulse" />
              <h4 className="text-sm font-bold text-slate-700 uppercase">Phần thi nghe trống</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">Đề thi này hiện tại không có câu hỏi phần nghe do giáo viên biên soạn.</p>
            </div>
          )}

          {/* Bottom quote banner */}
          <div className="text-center bg-slate-100/60 py-3.5 rounded-2xl border border-slate-150 select-none">
            <p className="text-slate-500 text-xs italic font-sans font-medium">
              "Không sao nếu bạn chưa biết đáp án. Mỗi câu hỏi đều là một cơ hội để học hỏi."
            </p>
          </div>

        </div>

    </div>
  );
}
