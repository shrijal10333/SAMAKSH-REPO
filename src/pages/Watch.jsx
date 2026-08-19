import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi, getImageUrl } from '../api';
import { 
    PlayCircle, ArrowLeft, Server, Star, List, Heart, SkipBack, SkipForward, 
    Plus, Share2, Zap, Triangle, Hexagon, Play, RefreshCw, AlertCircle, Home, Film, Tv
} from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { useContinueWatching } from '../hooks/useContinueWatching';

const SERVERS = [
    { name: 'Vidlink', url: (id, t, s, e, lang = 'en') => t === 'movie' ? `https://vidlink.pro/movie/${id}?primaryColor=ffcc00&audio=${lang}&lang=${lang}&ds=${lang}` : `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=ffcc00&audio=${lang}&lang=${lang}&ds=${lang}` },
    { name: 'VidSrc', url: (id, t, s, e, lang = 'en') => t === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}&lang=${lang}` : `https://vidsrc.me/embed/tv?tmdb=${id}&sea=${s}&epi=${e}&lang=${lang}` },
    { name: 'VidSrc PRO', url: (id, t, s, e, lang = 'en') => t === 'movie' ? `https://vidsrc.pm/embed/movie/${id}?audio=${lang}` : `https://vidsrc.pm/embed/tv/${id}/${s}/${e}?audio=${lang}` },
    { name: 'Embed.su', url: (id, t, s, e, lang = 'en') => t === 'movie' ? `https://embed.su/embed/movie/${id}?audio=${lang}` : `https://embed.su/embed/tv/${id}/${s}/${e}?audio=${lang}` },
];

export default function Watch({ explicitType, explicitId, startTime, partyRoom, isHost, username, socket }) {
    const params = useParams();
    const rawType = explicitType || params.type || 'movie';
    const id = explicitId || params.id;
    const navigate = useNavigate();

    // Normalize type: 'anime' or 'show' or 'series' -> 'tv', 'film' -> 'movie'
    const normalizedType = (rawType === 'anime' || rawType === 'show' || rawType === 'series' || rawType === 'tv') ? 'tv' : 'movie';
    const [activeMediaType, setActiveMediaType] = useState(normalizedType);

    const [detail, setDetail] = useState(null);
    const [loadingState, setLoadingState] = useState('loading'); // 'loading' | 'success' | 'error' | 'empty'
    const [errorMessage, setErrorMessage] = useState('');

    const [season, setSeason] = useState(1);
    const [episode, setEpisode] = useState(1);
    const [activeServer, setActiveServer] = useState(0);
    const [episodesList, setEpisodesList] = useState([]);
    const [activeTab, setActiveTab] = useState('Synopsis');
    const [selectedAudio, setSelectedAudio] = useState('Original');

    const AUDIO_TRACKS = [
        { id: 'en', label: 'Original', available: true },
        { id: 'hi', label: 'Hindi Dub', available: true },
        { id: 'ja', label: 'Japanese', available: detail?.original_language === 'ja' || rawType === 'anime' },
        { id: 'en-dub', label: 'English Dub', available: rawType === 'anime' || activeMediaType === 'tv' }
    ].filter(t => t.available);

    const { toggleWatchlist, isInWatchlist } = useWatchlist();
    const { history, addToHistory } = useContinueWatching();
    const inList = detail?.id ? isInWatchlist(detail.id, activeMediaType) : false;

    // Restore season & episode from history if available
    useEffect(() => {
        if (!id) return;
        const savedItem = history?.find(i => String(i.id) === String(id) && i.media_type === activeMediaType);
        if (savedItem && savedItem.season && savedItem.episode) {
            setSeason(Number(savedItem.season) || 1);
            setEpisode(Number(savedItem.episode) || 1);
        }
    }, [id, activeMediaType, history]);

    // Fetch Details with automatic fallback and robust error handling
    const loadDetails = useCallback(async () => {
        if (!id) {
            setLoadingState('error');
            setErrorMessage('Invalid or missing title identifier.');
            return;
        }

        setLoadingState('loading');
        setErrorMessage('');
        try {
            window.scrollTo(0, 0);

            // 1. Try primary requested type
            let data = await fetchApi(`/${activeMediaType}/${id}?append_to_response=credits,recommendations`);

            // 2. If not found and type might be inverted (e.g. movie vs tv)
            if (!data || !data.id || data.success === false) {
                const alternateType = activeMediaType === 'movie' ? 'tv' : 'movie';
                const altData = await fetchApi(`/${alternateType}/${id}?append_to_response=credits,recommendations`);
                if (altData && altData.id && altData.success !== false) {
                    data = altData;
                    setActiveMediaType(alternateType);
                }
            }

            if (data && data.id && data.success !== false) {
                setDetail(data);
                setLoadingState('success');
            } else {
                setDetail(null);
                setLoadingState('empty');
                setErrorMessage('This title could not be found in our streaming catalog.');
            }
        } catch (err) {
            console.error('Watch detail load failure:', err);
            setDetail(null);
            setLoadingState('error');
            setErrorMessage(err.message || 'Unable to connect to the video streaming metadata server.');
        }
    }, [id, activeMediaType]);

    useEffect(() => {
        loadDetails();
    }, [loadDetails]);

    // Fetch TV Season Episodes safely
    useEffect(() => {
        if (activeMediaType === 'tv' && id && detail?.id) {
            let isMounted = true;
            fetchApi(`/tv/${id}/season/${season}`)
                .then(data => {
                    if (isMounted && data && Array.isArray(data.episodes)) {
                        setEpisodesList(data.episodes);
                    } else if (isMounted) {
                        setEpisodesList([]);
                    }
                })
                .catch(err => {
                    console.warn('Failed to load season episodes:', err);
                    if (isMounted) setEpisodesList([]);
                });

            return () => {
                isMounted = false;
            };
        }
    }, [season, id, activeMediaType, detail]);

    // Record continue watching
    useEffect(() => {
        if (detail && detail.id) {
            addToHistory(detail, activeMediaType, season, episode);
        }
    }, [detail, activeMediaType, season, episode, addToHistory]);

    // Watch Party Socket Synchronization
    useEffect(() => {
        let tempSocket = socket;
        const storedRoom = sessionStorage.getItem('wp_room');
        const storedUser = sessionStorage.getItem('wp_username') || "Guest";
        const storedIsHost = sessionStorage.getItem('wp_isHost') === 'true';

        if (!tempSocket && storedRoom) {
            tempSocket = io(import.meta.env.VITE_API_URL || undefined);
            tempSocket.on('connect', () => {
                tempSocket.emit('join_room', { room: storedRoom, username: storedUser });
                if (storedIsHost || isHost) {
                    tempSocket.emit('start_video', { room: storedRoom, type: activeMediaType, id, title: document.title });
                }
            });
        } else if (tempSocket && partyRoom) {
            if (isHost || storedIsHost) {
                tempSocket.emit('start_video', { room: partyRoom, type: activeMediaType, id, title: document.title });
            }
        }
        
        return () => {
            if (tempSocket && !socket) tempSocket.disconnect();
        };
    }, [id, activeMediaType, partyRoom, isHost, socket]);

    // ================= STATES RENDERING =================

    // 1. LOADING STATE
    if (loadingState === 'loading') {
        return (
            <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center text-white space-y-6 px-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-white/10 border-t-[#ff4d4d] rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 bg-[#1db954] rounded-full animate-pulse"></div>
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#ff4d4d] block">
                        INITIALIZING STREAM NODE
                    </span>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                        Connecting to Secure Video Delivery Feed...
                    </p>
                </div>
            </div>
        );
    }

    // 2. ERROR OR EMPTY STATE
    if (loadingState === 'error' || loadingState === 'empty' || !detail || !detail.id) {
        return (
            <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-[#121212] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 flex items-center justify-center mx-auto text-[#ff4d4d]">
                        <AlertCircle size={32} />
                    </div>

                    <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff4d4d]">
                            SAMAKSH MOVIE • Stream Offline
                        </span>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                            Unable to Load This Title
                        </h2>
                        <p className="text-sm text-white/50 font-medium leading-relaxed">
                            {errorMessage || "The requested media stream is currently unavailable or the title ID could not be resolved."}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            onClick={loadDetails}
                            className="flex-1 bg-[#ff4d4d] hover:bg-[#ff3333] text-white py-3.5 px-6 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                        >
                            <RefreshCw size={14} /> Retry
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3.5 px-6 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all border border-white/10"
                        >
                            <ArrowLeft size={14} /> Back
                        </button>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                        <Link 
                            to="/" 
                            className="text-[11px] font-bold text-white/30 hover:text-white uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors"
                        >
                            <Home size={12} /> Return to Home Hub
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // 3. SUCCESS / ACTIVE PLAYER STATE
    const title = detail.title || detail.name || detail.original_title || 'Featured Title';
    const releaseYear = (detail.release_date || detail.first_air_date || '').slice(0, 4) || '2024';
    const rating = detail.vote_average ? Number(detail.vote_average).toFixed(1) : '7.8';
    const backdropUrl = getImageUrl(detail.backdrop_path, 'original');
    const overview = detail.overview || "Stream high-definition movies, television series, and anime with uninterrupted playback on SAMAKSH MOVIE.";

    const currentEpisodeData = episodesList.find(e => e.episode_number === episode) || { 
        name: `Episode ${episode}`, 
        overview: detail.overview || 'Enjoy this episode.' 
    };

    const selectedAudioCode = AUDIO_TRACKS.find(t => t.label === selectedAudio)?.id || 'en';
    const currentServerUrl = SERVERS[activeServer]?.url(id, activeMediaType, season, episode, selectedAudioCode) || '';

    return (
        <div className="min-h-screen bg-[#080808] text-white overflow-y-auto relative selection:bg-[#ff4d4d] selection:text-white pb-40 custom-scrollbar">
            {/* Backdrop HUD Atmosphere */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <img 
                    src={backdropUrl} 
                    className="w-full h-full object-cover opacity-20 blur-3xl scale-110" 
                    alt="" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/70 to-[#080808]/90"></div>
                
                <div className="absolute top-[20%] left-[5%] opacity-10 animate-pulse text-[#ff4d4d]">
                     <Triangle size={400} strokeWidth={0.5} />
                </div>
                <div className="absolute bottom-[10%] right-[-5%] opacity-10 text-[#ff4d4d]">
                     <Hexagon size={600} strokeWidth={0.5} />
                </div>
            </div>

            <div className="relative z-10 max-w-[1920px] mx-auto pt-6 pb-40 px-4 md:px-8 lg:px-16 flex flex-col gap-10 md:gap-16">
                {/* Back navigation & Badges */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-widest text-white/70 hover:text-white transition-all group"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-[#1db954] text-black text-[10px] font-black uppercase tracking-wider rounded-lg">
                            {activeMediaType === 'tv' ? 'TV Series' : 'Feature Film'}
                        </span>
                        <span className="px-3 py-1 bg-white/5 border border-white/10 text-white/50 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                            ID #{detail.id}
                        </span>
                    </div>
                </div>

                {/* Tactical Header */}
                <header className="animate-entrance grid grid-cols-1 md:grid-cols-12 items-end gap-8 md:gap-12">
                    <div className="md:col-span-8 min-w-0">
                        <div className="flex items-center gap-3 mb-4">
                             <div className="w-1.5 h-6 bg-[#ff4d4d] rounded-full"></div>
                             <span className="text-[11px] font-black uppercase tracking-widest text-[#ff4d4d]">
                                 {activeMediaType.toUpperCase()} STATION • ARCHIVE NODE
                             </span>
                        </div>
                        <h1 className="text-2xl md:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-tight mb-4 break-words">
                            {title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 mb-6">
                             <div className="flex items-center gap-2">
                                 <Star size={18} className="text-[#1db954] fill-[#1db954]" />
                                 <span className="text-lg font-black tracking-tight text-white">{rating}</span>
                                 <span className="opacity-40 text-xs">/ 10</span>
                             </div>
                             <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>
                             <span>Released {releaseYear}</span>
                             {detail.runtime ? (
                                 <>
                                     <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>
                                     <span>{Math.floor(detail.runtime / 60)}h {detail.runtime % 60}m</span>
                                 </>
                             ) : null}
                             {detail.number_of_seasons ? (
                                 <>
                                     <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>
                                     <span className="text-[#1db954]">{detail.number_of_seasons} Seasons</span>
                                 </>
                             ) : null}
                        </div>

                        <p className="text-white/70 text-sm md:text-base max-w-3xl leading-relaxed mb-8 line-clamp-3">
                            {overview}
                        </p>

                        <div className="flex flex-wrap gap-4 mb-8">
                            <button 
                                onClick={() => {
                                    const playerEl = document.getElementById('main-video-player');
                                    if (playerEl) playerEl.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="bg-[#ff4d4d] hover:bg-[#ff3333] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.03] transition-all flex items-center justify-center gap-2"
                            >
                                <Play size={16} fill="white" /> Watch Stream
                            </button>
                            <button 
                                onClick={() => toggleWatchlist(detail, activeMediaType)} 
                                className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${inList ? 'bg-white text-black shadow-lg' : 'bg-white/10 border border-white/10 text-white hover:bg-white/20'}`}
                            >
                                <Plus size={16} /> {inList ? 'In Watchlist' : 'Add to List'}
                            </button>
                        </div>

                        {/* Interactive Audio Selector */}
                        <div className="relative group w-full md:w-fit overflow-x-auto">
                            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 flex gap-1 items-center shadow-xl min-w-fit">
                                <div className="px-3 py-1.5 border-r border-white/5 opacity-40 text-[9px] font-black uppercase tracking-widest hidden sm:block shrink-0">
                                    Audio Track
                                </div>
                                <div className="flex gap-1">
                                    {AUDIO_TRACKS.map((track) => (
                                        <button
                                            key={track.id}
                                            onClick={() => setSelectedAudio(track.label)}
                                            className={`relative px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${selectedAudio === track.label ? 'bg-[#ff4d4d] text-white shadow-lg shadow-[#ff4d4d]/30' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {track.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Episode Preview for TV */}
                    {activeMediaType === 'tv' && (
                        <div className="md:col-span-4 flex flex-col gap-4">
                             <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 border-b border-white/10 pb-3 flex items-center justify-between">
                                 <span>Next Episodes</span>
                                 <span className="text-[#ff4d4d]">Season {season}</span>
                             </div>
                             {episodesList.length > 0 ? (
                                 episodesList.slice(episode, episode + 3).map((ep) => (
                                     <button 
                                         key={ep.id || ep.episode_number} 
                                         onClick={() => setEpisode(ep.episode_number)} 
                                         className="group flex gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-[#ff4d4d]/40 transition-all text-left"
                                     >
                                         <div className="w-24 aspect-video shrink-0 rounded-xl overflow-hidden relative border border-white/10 bg-white/5">
                                              <img src={getImageUrl(ep.still_path, 'w185')} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                   <PlayCircle size={18} className="text-[#ff4d4d]" fill="currentColor" />
                                              </div>
                                         </div>
                                         <div className="flex-1 min-w-0 flex flex-col justify-center">
                                              <span className="text-[8px] font-black text-[#ff4d4d] uppercase mb-0.5">EP 0{ep.episode_number}</span>
                                              <h4 className="text-[11px] font-black uppercase truncate group-hover:text-[#ff4d4d] transition-colors">{ep.name}</h4>
                                         </div>
                                     </button>
                                 ))
                             ) : (
                                 <div className="p-6 bg-white/5 rounded-2xl border border-white/5 text-center text-xs text-white/40 uppercase tracking-widest">
                                     Episodes syncing...
                                 </div>
                             )}
                        </div>
                    )}
                </header>

                {/* Main Content Node: Player + Station Selection */}
                <div id="main-video-player" className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start animate-entrance">
                    <main className="xl:col-span-8 flex flex-col gap-8">
                         {/* High-Precision Video Player Box */}
                         <div className="relative aspect-video rounded-2xl md:rounded-[2.5rem] overflow-hidden border-2 border-white/10 shadow-2xl bg-black">
                              <iframe
                                key={`${activeServer}-${season}-${episode}-${selectedAudioCode}`}
                                src={currentServerUrl}
                                className="w-full h-full border-none"
                                allowFullScreen
                                title="Video Player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              ></iframe>
                         </div>

                         {/* Server Selector Hub */}
                         <div className="bg-[#121212] border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-xl">
                              <div className="flex items-center justify-between mb-6">
                                   <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-[#ff4d4d] rounded-full"></div>
                                        <h3 className="text-base md:text-lg font-black uppercase tracking-wider">
                                            Streaming Server Node
                                        </h3>
                                   </div>
                                   <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                       Switch Server if stream buffers
                                   </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                   {SERVERS.map((srv, idx) => (
                                       <button 
                                          key={idx}
                                          onClick={() => setActiveServer(idx)}
                                          className={`p-4 rounded-2xl transition-all duration-300 border flex flex-col gap-2 text-left ${activeServer === idx ? 'bg-[#ff4d4d] border-[#ff4d4d] text-white shadow-[0_10px_30px_rgba(255,77,77,0.3)]' : 'bg-white/5 border-white/5 hover:border-white/20 text-white/60 hover:text-white hover:bg-white/10'}`}
                                       >
                                           <Server size={16} className={activeServer === idx ? 'text-white' : 'text-white/40'} />
                                           <span className="text-[10px] font-black uppercase tracking-widest">{srv.name}</span>
                                       </button>
                                   ))}
                              </div>
                         </div>
                    </main>

                    {/* Right Metadata Column */}
                    <aside className="xl:col-span-4 flex flex-col gap-8">
                         <div className="bg-[#121212] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 flex flex-col shadow-2xl space-y-6">
                              <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                                   {activeMediaType === 'tv' && (
                                       <div className="text-4xl font-black italic tracking-tighter text-[#ff4d4d] shrink-0">
                                           {String(episode).padStart(2, '0')}
                                       </div>
                                   )}
                                   <div className="flex flex-col min-w-0">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                                            {activeMediaType === 'tv' ? `Episode ${episode} of Season ${season}` : 'Feature Synopsis'}
                                        </span>
                                        <h3 className="text-base font-black uppercase tracking-tight truncate text-white">
                                            {activeMediaType === 'tv' ? currentEpisodeData.name : title}
                                        </h3>
                                   </div>
                              </div>

                              <div className="flex gap-4 border-b border-white/5 pb-2">
                                  {['Synopsis', 'Cast', 'Details'].map(tab => (
                                      <button 
                                        key={tab} 
                                        onClick={() => setActiveTab(tab)}
                                        className={`text-[10px] font-black uppercase tracking-wider transition-all relative pb-2 ${activeTab === tab ? 'text-[#ff4d4d] border-b-2 border-[#ff4d4d]' : 'text-white/30 hover:text-white'}`}
                                      >
                                          {tab}
                                      </button>
                                  ))}
                              </div>

                              {activeTab === 'Synopsis' && (
                                  <p className="text-xs md:text-sm font-medium leading-relaxed text-white/60">
                                      {activeMediaType === 'tv' ? (currentEpisodeData.overview || overview) : overview}
                                  </p>
                              )}

                              {activeTab === 'Cast' && (
                                  <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                      {detail.credits?.cast?.slice(0, 6).map((actor) => (
                                          <div key={actor.id} className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0">
                                                  <img src={getImageUrl(actor.profile_path, 'w92')} alt={actor.name} className="w-full h-full object-cover" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                  <h5 className="text-xs font-bold text-white truncate">{actor.name}</h5>
                                                  <p className="text-[9px] text-white/40 truncate">{actor.character}</p>
                                              </div>
                                          </div>
                                      )) || <p className="text-xs text-white/40">Cast information unavailable.</p>}
                                  </div>
                              )}

                              {activeTab === 'Details' && (
                                  <div className="space-y-2 text-xs">
                                      <div className="flex justify-between py-1 border-b border-white/5">
                                          <span className="text-white/40">Original Language</span>
                                          <span className="font-bold uppercase">{detail.original_language || 'EN'}</span>
                                      </div>
                                      <div className="flex justify-between py-1 border-b border-white/5">
                                          <span className="text-white/40">Status</span>
                                          <span className="font-bold text-[#1db954]">{detail.status || 'Released'}</span>
                                      </div>
                                      <div className="flex justify-between py-1">
                                          <span className="text-white/40">Genres</span>
                                          <span className="font-bold truncate max-w-[180px]">
                                              {detail.genres?.map(g => g.name).join(', ') || 'N/A'}
                                          </span>
                                      </div>
                                  </div>
                              )}

                              {activeMediaType === 'tv' && episodesList.length > 0 && (
                                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                                       <button 
                                          onClick={() => episode > 1 && setEpisode(episode - 1)}
                                          disabled={episode <= 1}
                                          className="py-3 bg-white/5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 flex items-center justify-center gap-2 disabled:opacity-30 transition-all"
                                       >
                                           <SkipBack size={12} /> Prev Ep
                                       </button>
                                       <button 
                                          onClick={() => episode < episodesList.length && setEpisode(episode + 1)}
                                          disabled={episode >= episodesList.length}
                                          className="py-3 bg-[#ff4d4d] rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:opacity-30 active:scale-95 transition-all"
                                       >
                                           Next Ep <SkipForward size={12} />
                                       </button>
                                  </div>
                              )}
                         </div>
                    </aside>
                </div>

                {/* Season & Episode Grid for TV Shows */}
                {activeMediaType === 'tv' && (
                    <section className="bg-[#121212] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-xl animate-entrance">
                         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-6">
                              <div className="flex items-center gap-4">
                                   <div className="w-1.5 h-8 bg-[#ff4d4d] rounded-full"></div>
                                   <div>
                                        <h2 className="text-2xl font-black uppercase tracking-tight">Episode Selection</h2>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Season {season} Catalog</p>
                                   </div>
                              </div>

                              {/* Season Pills */}
                              <div className="flex flex-wrap gap-2">
                                   {Array.from({ length: detail.number_of_seasons || 1 }).map((_, i) => (
                                       <button 
                                          key={i + 1}
                                          onClick={() => { setSeason(i + 1); setEpisode(1); }}
                                          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${season === i + 1 ? 'bg-[#1db954] text-black shadow-lg shadow-[#1db954]/20' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                       >
                                           Season {i + 1}
                                       </button>
                                   ))}
                              </div>
                         </div>

                         {episodesList.length > 0 ? (
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                  {episodesList.map((ep) => (
                                      <button 
                                         key={ep.id || ep.episode_number} 
                                         onClick={() => setEpisode(ep.episode_number)}
                                         className={`group relative aspect-video rounded-2xl overflow-hidden border transition-all duration-300 text-left ${episode === ep.episode_number ? 'border-[#ff4d4d] ring-2 ring-[#ff4d4d]/30' : 'border-white/5 hover:border-white/20'}`}
                                      >
                                          <img src={getImageUrl(ep.still_path, 'w300')} alt="" className={`w-full h-full object-cover transition-transform duration-500 ${episode === ep.episode_number ? 'scale-105 opacity-100' : 'opacity-40 group-hover:opacity-75'}`} />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                                          <div className="absolute bottom-2.5 left-2.5 right-2.5">
                                               <div className="flex items-center justify-between">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest ${episode === ep.episode_number ? 'text-[#ff4d4d]' : 'text-white/50'}`}>
                                                        EP {ep.episode_number}
                                                    </span>
                                                    {episode === ep.episode_number && <div className="w-1.5 h-1.5 bg-[#ff4d4d] rounded-full animate-pulse"></div>}
                                               </div>
                                               <h4 className="text-[10px] font-black uppercase truncate text-white mt-0.5">{ep.name}</h4>
                                          </div>
                                      </button>
                                  ))}
                             </div>
                         ) : (
                             <div className="py-12 text-center text-white/30 text-xs font-bold uppercase tracking-widest">
                                 No episodes returned for Season {season}.
                             </div>
                         )}
                    </section>
                )}

                {/* Recommendations Carousel */}
                {detail.recommendations?.results && detail.recommendations.results.length > 0 && (
                    <section className="space-y-6 pt-6">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                             <div className="w-1.5 h-6 bg-[#ff4d4d] rounded-full"></div>
                             <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Recommended Titles</h2>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {detail.recommendations.results.slice(0, 6).map((item) => {
                                 const itemType = item.media_type || activeMediaType;
                                 return (
                                     <Link 
                                         key={item.id} 
                                         to={`/watch/${itemType}/${item.id}`} 
                                         className="group block relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 hover:border-[#ff4d4d]/40 transition-all duration-300 bg-white/5"
                                     >
                                          <img src={getImageUrl(item.poster_path, 'w500')} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                              <div className="absolute bottom-3 left-3 right-3">
                                                  <span className="text-[8px] font-black uppercase text-[#ff4d4d] tracking-widest block mb-0.5">{itemType}</span>
                                                  <h4 className="text-[11px] font-black uppercase leading-tight truncate text-white">{item.title || item.name}</h4>
                                              </div>
                                          </div>
                                     </Link>
                                 );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
