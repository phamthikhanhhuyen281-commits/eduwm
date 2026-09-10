import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, AlertCircle, Volume2 } from 'lucide-react';
import { createPlayableBlobUrl } from '../services/storageService';

interface SpeakingAudioPlayerProps {
  src: string;
  onReset?: () => void;
  title?: string;
  compact?: boolean;
}

export function SpeakingAudioPlayer({ src, title, compact = false }: SpeakingAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string>('');

  // Convert data URI to Blob URL whenever src changes
  useEffect(() => {
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (!src) {
      setBlobUrl('');
      return;
    }

    const resolved = createPlayableBlobUrl(src);
    setBlobUrl(resolved);

    return () => {
      // If it was a created blob URL from data URL, it stays valid in memory
    };
  }, [src]);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        setHasError(false);
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Audio playback error (iOS policy or format):', err);
        setHasError(true);
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      setHasError(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleError = () => {
    console.warn('Audio player encountered error loading src');
    setHasError(true);
    setIsPlaying(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '00:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!src && !blobUrl) return null;

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-xl ${compact ? 'p-2.5' : 'p-3'} space-y-2`}>
      {/* Hidden/Native Audio Element */}
      <audio
        ref={audioRef}
        src={blobUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        playsInline
        preload="metadata"
      />

      {/* Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Volume2 className="w-3.5 h-3.5 text-indigo-700" />
          <span>{title || 'Nghe lại bản ghi âm của bạn:'}</span>
        </div>
        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
          Đã khóa ghi âm (1 lần duy nhất)
        </span>
      </div>

      {/* Error State Banner */}
      {hasError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 space-y-1">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Bản ghi âm đã được ghi nhận</p>
              <p className="text-amber-700 text-[11px] mt-0.5">
                Bài nói của bạn đã được hệ thống lưu trữ trên máy chủ để gửi cho giáo viên đánh giá.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Custom Modern Audio Player Controls */
        <div className="flex items-center gap-3 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-xs">
          <button
            type="button"
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-indigo-900 hover:bg-indigo-850 text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-xs cursor-pointer"
            title={isPlaying ? 'Tạm dừng' : 'Phát lại'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Progress bar */}
          <div className="flex-1 flex flex-col justify-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-900"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
