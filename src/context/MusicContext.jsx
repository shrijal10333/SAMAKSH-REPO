import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { getBestAudio } from '../api/musicApi';
import { useMusicLibrary } from '../hooks/useMusicLibrary';

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  const audioRef = useRef(new Audio());
  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const [ytReady, setYtReady] = useState(false);
  const [playbackType, setPlaybackType] = useState('audio'); // 'audio' | 'youtube'

  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none'); // 'none' | 'one' | 'all'
  const [sleepTimer, setSleepTimer] = useState(null); // minutes or null
  const sleepTimeoutRef = useRef(null);
  const { addToRecent } = useMusicLibrary();

  const audio = audioRef.current;

  // Initialize YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initYTPlayer();
      };
    } else if (window.YT && window.YT.Player) {
      initYTPlayer();
    }

    function initYTPlayer() {
      if (ytPlayerRef.current) return;
      const el = document.getElementById('yt-music-player-hidden');
      if (!el) return;

      ytPlayerRef.current = new window.YT.Player('yt-music-player-hidden', {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            setYtReady(true);
            try {
              ytPlayerRef.current.setVolume(volume * 100);
            } catch {}
          },
          onStateChange: (event) => {
            // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3
            if (event.data === 1) {
              setIsPlaying(true);
              setIsLoading(false);
              try {
                setDuration(ytPlayerRef.current.getDuration() || 0);
              } catch {}
            } else if (event.data === 2) {
              setIsPlaying(false);
            } else if (event.data === 3) {
              setIsLoading(true);
            } else if (event.data === 0) {
              handleNext(true);
            }
          },
          onError: () => {
            setIsLoading(false);
            handleNext(true);
          }
        }
      });
    }
  }, []);

  // HTML5 audio volume & mute
  useEffect(() => {
    audio.volume = volume;
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      try {
        ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
      } catch {}
    }
  }, [volume, isMuted]);

  useEffect(() => {
    audio.muted = isMuted;
    if (ytPlayerRef.current && ytPlayerRef.current.mute && ytPlayerRef.current.unMute) {
      try {
        if (isMuted) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      } catch {}
    }
  }, [isMuted]);

  // Track progress for HTML5 audio
  useEffect(() => {
    const onTime = () => {
      if (playbackType === 'audio') setProgress(audio.currentTime);
    };
    const onDuration = () => {
      if (playbackType === 'audio') setDuration(audio.duration || 0);
    };
    const onEnded = () => {
      if (playbackType === 'audio') handleNext(true);
    };
    const onWaiting = () => {
      if (playbackType === 'audio') setIsLoading(true);
    };
    const onCanPlay = () => {
      if (playbackType === 'audio') setIsLoading(false);
    };
    const onPlay = () => {
      if (playbackType === 'audio') setIsPlaying(true);
    };
    const onPause = () => {
      if (playbackType === 'audio') setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [playbackType, queue, queueIndex, repeatMode]);

  // YouTube polling timer for progress
  useEffect(() => {
    if (playbackType !== 'youtube' || !isPlaying) return;
    const timer = setInterval(() => {
      if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        try {
          const t = ytPlayerRef.current.getCurrentTime() || 0;
          const d = ytPlayerRef.current.getDuration() || 0;
          setProgress(t);
          if (d > 0) setDuration(d);
        } catch {}
      }
    }, 500);
    return () => clearInterval(timer);
  }, [playbackType, isPlaying]);

  const playSong = useCallback((song, songQueue = [], idx = 0) => {
    if (!song) return;
    const url = getBestAudio(song.downloadUrl);
    const videoId = song.videoId || (typeof song.id === 'string' && song.id.length === 11 ? song.id : null);

    setCurrentSong(song);
    addToRecent(song);
    setProgress(0);

    if (songQueue.length > 0) {
      setQueue(songQueue);
      setQueueIndex(idx);
    }

    if (url) {
      // Use direct HTML5 Audio
      setPlaybackType('audio');
      if (ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
        try { ytPlayerRef.current.stopVideo(); } catch {}
      }
      audio.src = url;
      audio.play().catch(e => console.warn('Audio play failed:', e));
    } else if (videoId) {
      // Use YouTube player
      setPlaybackType('youtube');
      audio.pause();
      audio.src = '';
      setIsLoading(true);

      if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
        try {
          ytPlayerRef.current.loadVideoById(videoId);
          ytPlayerRef.current.playVideo();
        } catch (e) {
          console.warn('YT loadVideoById error:', e);
        }
      } else {
        // Fallback: wait for YT to be ready
        setTimeout(() => {
          if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
            try {
              ytPlayerRef.current.loadVideoById(videoId);
              ytPlayerRef.current.playVideo();
            } catch {}
          }
        }, 800);
      }
    }
  }, [addToRecent, volume, isMuted]);

  const togglePlay = useCallback(() => {
    if (playbackType === 'audio') {
      if (isPlaying) audio.pause();
      else audio.play().catch(() => {});
    } else if (playbackType === 'youtube') {
      if (ytPlayerRef.current) {
        try {
          if (isPlaying) ytPlayerRef.current.pauseVideo();
          else ytPlayerRef.current.playVideo();
        } catch {}
      }
    }
  }, [playbackType, isPlaying]);

  const handleNext = useCallback((auto = false) => {
    if (repeatMode === 'one' && auto) {
      seek(0);
      if (playbackType === 'audio') audio.play().catch(() => {});
      else if (ytPlayerRef.current?.playVideo) ytPlayerRef.current.playVideo();
      return;
    }
    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      const nextSong = queue[nextIdx];
      playSong(nextSong, queue, nextIdx);
    } else if (repeatMode === 'all' && queue.length > 0) {
      const firstSong = queue[0];
      playSong(firstSong, queue, 0);
    }
  }, [queue, queueIndex, repeatMode, playbackType, playSong]);

  const handlePrev = useCallback(() => {
    if (progress > 3) {
      seek(0);
      return;
    }
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) {
      const prevSong = queue[prevIdx];
      playSong(prevSong, queue, prevIdx);
    }
  }, [queue, queueIndex, progress, playSong]);

  const seek = useCallback((time) => {
    setProgress(time);
    if (playbackType === 'audio') {
      audio.currentTime = time;
    } else if (playbackType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
      try {
        ytPlayerRef.current.seekTo(time, true);
      } catch {}
    }
  }, [playbackType]);

  const cyclRepeat = useCallback(() => {
    setRepeatMode(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none');
  }, []);

  const stopMusic = useCallback(() => {
    audio.pause();
    audio.src = '';
    if (ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
      try { ytPlayerRef.current.stopVideo(); } catch {}
    }
    setCurrentSong(null);
    setQueue([]);
    setQueueIndex(0);
    setIsPlaying(false);
  }, []);

  const addToQueue = useCallback((song) => {
    setQueue(q => [...q, song]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (!currentSong) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) { handleNext(false); } 
          else { seek(Math.min(progress + 10, duration)); }
          break;
        case 'ArrowLeft':
          if (e.shiftKey) { handlePrev(); }
          else { seek(Math.max(progress - 10, 0)); }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'KeyM':
          setIsMuted(m => !m);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSong, togglePlay, handleNext, handlePrev, seek, progress, duration]);

  // Sleep timer
  const startSleepTimer = useCallback((minutes) => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    if (!minutes) {
      setSleepTimer(null);
      return;
    }
    setSleepTimer(minutes);
    sleepTimeoutRef.current = setTimeout(() => {
      stopMusic();
      setSleepTimer(null);
    }, minutes * 60 * 1000);
  }, [stopMusic]);

  const clearSleepTimer = useCallback(() => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    setSleepTimer(null);
  }, []);

  return (
    <MusicContext.Provider value={{
      currentSong, queue, queueIndex,
      isPlaying, progress, duration,
      volume, setVolume, isMuted, setIsMuted,
      isLoading, isShuffled, setIsShuffled,
      repeatMode, cyclRepeat,
      playSong, togglePlay, stopMusic,
      handleNext: () => handleNext(false),
      handlePrev, seek, addToQueue,
      sleepTimer, startSleepTimer, clearSleepTimer,
    }}>
      {children}
      {/* Hidden YouTube container for smooth audio playback */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', opacity: 0 }}>
        <div id="yt-music-player-hidden" />
      </div>
    </MusicContext.Provider>
  );
}

export const useMusic = () => useContext(MusicContext);
