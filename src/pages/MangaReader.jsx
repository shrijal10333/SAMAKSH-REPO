import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchMangaDetails, fetchMangaChapters, fetchMangaPages } from '../api';
import { ArrowLeft, Maximize2, Monitor, BookOpen, List, ChevronLeft, ChevronRight, RefreshCw, ZoomIn, ZoomOut, AlertCircle, ExternalLink } from 'lucide-react';

export default function MangaReader() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const paramChapterId = searchParams.get('chapter');
    const paramChapterNum = searchParams.get('chNum');

    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pageLoading, setPageLoading] = useState(true);
    const [zoom, setZoom] = useState(100);
    const [progress, setProgress] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [readingMode, setReadingMode] = useState('vertical'); // vertical or horizontal
    const [showHeader, setShowHeader] = useState(true);
    const lastScrollTop = useRef(0);
    const containerRef = useRef(null);

    const [pages, setPages] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [currentChapter, setCurrentChapter] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

    // Load Manga metadata & chapter list
    useEffect(() => {
        let isMounted = true;
        const loadMangaMetadata = async () => {
            if (!id) return;
            setLoading(true);
            setErrorMsg(null);
            try {
                const mangaData = await fetchMangaDetails(id);

                if (!isMounted) return;
                setDetail(mangaData);

                const targetId = mangaData?.mangadexId || mangaData?.id || id;
                const targetTitle = mangaData?.title_english || mangaData?.title || '';

                const feedRes = await fetchMangaChapters(targetId, targetTitle);
                if (isMounted && feedRes) {
                    const uniqueChapters = feedRes.data || [];
                    setChapters(uniqueChapters);

                    // If chapter param provided in URL, find it; otherwise default to first
                    if (paramChapterId) {
                        const matching = uniqueChapters.find(ch => ch.id === paramChapterId);
                        if (matching) {
                            setCurrentChapter(matching);
                        } else {
                            setCurrentChapter({
                                id: paramChapterId,
                                chapter: paramChapterNum || '1',
                                title: '',
                                attributes: { chapter: paramChapterNum || '1', title: '' }
                            });
                        }
                    } else if (uniqueChapters.length > 0) {
                        setCurrentChapter(uniqueChapters[0]);
                    }
                } else if (paramChapterId && isMounted) {
                    setCurrentChapter({
                        id: paramChapterId,
                        chapter: paramChapterNum || '1',
                        title: '',
                        attributes: { chapter: paramChapterNum || '1', title: '' }
                    });
                }
            } catch (err) {
                console.error("Manga metadata loading failed:", err);
                if (isMounted) setErrorMsg("Could not load manga metadata.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadMangaMetadata();

        return () => {
            isMounted = false;
        };
    }, [id, paramChapterId, paramChapterNum]);

    // Load Chapter Pages whenever currentChapter changes
    useEffect(() => {
        let isMounted = true;
        const loadPages = async () => {
            if (!currentChapter?.id) {
                setPageLoading(false);
                return;
            }

            setPageLoading(true);
            setErrorMsg(null);
            try {
                const proxyData = await fetchMangaPages(currentChapter.id);
                if (proxyData?.pages && proxyData.pages.length > 0) {
                    if (isMounted) {
                        setPages(proxyData.pages);
                        if (containerRef.current) containerRef.current.scrollTo(0, 0);
                    }
                } else {
                    throw new Error('No page images returned');
                }
            } catch (err) {
                console.error("Failed to load chapter pages:", err);
                if (isMounted) {
                    setPages([]);
                    setErrorMsg("Unable to stream chapter pages. The chapter server may be temporarily rate limited.");
                }
            } finally {
                if (isMounted) setPageLoading(false);
            }
        };

        loadPages();

        return () => {
            isMounted = false;
        };
    }, [currentChapter]);

    // Scroll progress & Header auto-hide
    useEffect(() => {
        const handleScroll = () => {
            if (containerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
                const total = scrollHeight - clientHeight;
                const scrolled = total > 0 ? (scrollTop / total) * 100 : 0;
                setProgress(scrolled);

                if (scrollTop > lastScrollTop.current && scrollTop > 120) {
                    setShowHeader(false);
                } else {
                    setShowHeader(true);
                }
                lastScrollTop.current = scrollTop;
            }
        };

        const container = containerRef.current;
        if (container) container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            if (container) container.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Previous and Next Chapter Helpers
    const currentIndex = chapters.findIndex(ch => ch.id === currentChapter?.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex !== -1 && currentIndex < chapters.length - 1;

    const goToPrevChapter = () => {
        if (hasPrev) setCurrentChapter(chapters[currentIndex - 1]);
    };

    const goToNextChapter = () => {
        if (hasNext) setCurrentChapter(chapters[currentIndex + 1]);
    };

    const getChNumber = (ch) => ch?.chapter || ch?.attributes?.chapter || '1';
    const getChTitle = (ch) => ch?.title || ch?.attributes?.title || '';

    if (loading) {
        return (
            <div className="h-screen bg-[#080808] flex flex-col items-center justify-center text-white space-y-4">
                <div className="w-12 h-12 border-4 border-[#1db954] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white/60 font-black uppercase tracking-widest text-xs">Initializing Manga Reader Engine...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#080808] z-[100] flex flex-col overflow-hidden text-white font-sans selection:bg-[#1db954] selection:text-black">
            {/* Tactical Header */}
            <header
                className={`fixed top-0 left-0 right-0 h-16 md:h-20 border-b border-white/5 bg-[#080808]/90 backdrop-blur-2xl flex items-center justify-between px-4 md:px-8 z-[110] transition-transform duration-500 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}
            >
                <div className="flex items-center gap-4 md:gap-6">
                    <button 
                        onClick={() => navigate(`/manga/${id}`)} 
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-white/70 hover:text-white border border-white/5"
                        title="Back to Details"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-xs md:text-sm font-black text-white uppercase tracking-widest leading-none mb-1 truncate max-w-[180px] md:max-w-[360px]">
                            {detail?.title || 'Manga Reader'}
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#1db954] font-black uppercase tracking-wider">
                                Chapter {getChNumber(currentChapter)}
                            </span>
                            {getChTitle(currentChapter) && (
                                <span className="text-[10px] text-white/40 font-medium truncate max-w-[200px] hidden sm:inline">
                                    • {getChTitle(currentChapter)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Header Controls */}
                <div className="flex items-center gap-2 md:gap-4">
                    {/* Chapter Prev/Next shortcuts */}
                    <div className="flex items-center bg-white/5 border border-white/5 rounded-xl p-1">
                        <button 
                            onClick={goToPrevChapter} 
                            disabled={!hasPrev}
                            className="p-2 text-white/70 hover:text-white disabled:opacity-20 disabled:hover:text-white/70 transition-colors"
                            title="Previous Chapter"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button 
                            onClick={goToNextChapter} 
                            disabled={!hasNext}
                            className="p-2 text-white/70 hover:text-white disabled:opacity-20 disabled:hover:text-white/70 transition-colors"
                            title="Next Chapter"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Mode Toggle */}
                    <div className="hidden sm:flex bg-white/5 p-1 rounded-xl border border-white/5 items-center">
                        <button 
                            onClick={() => setReadingMode(readingMode === 'vertical' ? 'horizontal' : 'vertical')} 
                            className="p-2 text-white/60 hover:text-white transition-all flex items-center gap-2"
                        >
                            <Monitor size={14} className={readingMode === 'horizontal' ? 'text-[#1db954]' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none hidden md:block">
                                {readingMode}
                            </span>
                        </button>
                    </div>

                    {/* Chapters Drawer Button */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="px-4 py-2.5 bg-[#1db954] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 hover:scale-105 active:scale-95 shadow-lg shadow-[#1db954]/20"
                    >
                        <List size={16} />
                        <span className="hidden sm:inline">Chapters ({chapters.length})</span>
                    </button>
                </div>
            </header>

            {/* Main Reading Canvas */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center bg-[#0d0d0d] ${readingMode === 'horizontal' ? 'overflow-x-auto snap-x snap-mandatory' : ''}`}
            >
                <div className={`w-full flex ${readingMode === 'horizontal' ? 'flex-row' : 'flex-col items-center'} pt-24 md:pt-32 pb-40`}>
                    {pageLoading ? (
                        <div className="py-32 flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-3 border-[#1db954] border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-white/40 text-xs font-black uppercase tracking-widest">
                                Loading Chapter {getChNumber(currentChapter)} Pages...
                            </p>
                        </div>
                    ) : pages.length > 0 ? (
                        pages.map((url, i) => (
                            <div
                                key={i}
                                className={`relative group mb-3 md:mb-6 transition-all duration-500 flex flex-col items-center ${readingMode === 'horizontal' ? 'snap-center flex-shrink-0 w-screen h-[calc(100vh-120px)]' : 'w-full px-2 sm:px-4'}`}
                                style={{ width: readingMode === 'vertical' ? `${zoom}%` : '', maxWidth: readingMode === 'vertical' ? '1000px' : '' }}
                            >
                                <img
                                    src={url}
                                    alt={`Page ${i + 1}`}
                                    referrerPolicy="no-referrer"
                                    className={`${readingMode === 'horizontal' ? 'h-full w-auto object-contain' : 'w-full h-auto'} block select-none shadow-2xl rounded-lg bg-[#151515]`}
                                    loading="lazy"
                                />
                                <div className="mt-2 text-[9px] font-black text-white/20 uppercase tracking-widest">
                                    Page {i + 1} / {pages.length}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-24 text-center w-full px-6 max-w-lg mx-auto space-y-6">
                            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/30">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-tight text-white">Chapter Pages Unavailable</h3>
                            <p className="text-white/40 text-xs font-medium leading-relaxed">
                                {errorMsg || "No pages could be loaded for this chapter from the provider."}
                            </p>
                            <div className="flex flex-wrap gap-4 justify-center pt-2">
                                {(currentChapter?.externalUrl || currentChapter?.attributes?.externalUrl) && (
                                    <a 
                                        href={currentChapter.externalUrl || currentChapter.attributes.externalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-6 py-3 bg-[#1db954] text-black rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                                    >
                                        <ExternalLink size={14} /> Read on Official Source
                                    </a>
                                )}
                                <button 
                                    onClick={() => navigate(`/manga/${id}`)}
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Return to Chapters List
                                </button>
                                {hasNext && (
                                    <button 
                                        onClick={goToNextChapter}
                                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all"
                                    >
                                        Try Next Chapter
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Chapter Completion Bar */}
                    {pages.length > 0 && (
                        <div className="py-20 flex flex-col items-center text-center w-full max-w-md mx-auto px-6">
                            <div className="w-16 h-16 rounded-2xl bg-[#1db954]/10 border border-[#1db954]/20 flex items-center justify-center text-[#1db954] mb-6 shadow-xl">
                                <BookOpen size={28} />
                            </div>
                            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">End of Chapter {getChNumber(currentChapter)}</h2>
                            <p className="text-white/40 font-medium text-xs mb-8">You've completed reading this chapter.</p>

                            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                                {hasNext ? (
                                    <button 
                                        onClick={goToNextChapter}
                                        className="px-8 py-4 bg-[#1db954] text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-xl flex items-center justify-center gap-2"
                                    >
                                        Next Chapter <ChevronRight size={16} />
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => navigate(`/manga/${id}`)}
                                        className="px-8 py-4 bg-[#1db954] text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-xl"
                                    >
                                        Back to Manga Info
                                    </button>
                                )}
                                <button
                                    onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                                    className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-colors"
                                >
                                    Scroll to Top
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom HUD Bar */}
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] transition-transform duration-500 ${showHeader ? 'translate-y-0' : 'translate-y-24'}`}>
                <div className="bg-[#121212]/90 backdrop-blur-2xl border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-6 shadow-2xl">
                    <div className="flex flex-col items-center gap-1 min-w-[120px]">
                        <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-[#1db954] transition-all duration-200" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{Math.round(progress)}% Complete</span>
                    </div>

                    <div className="h-6 w-[1px] bg-white/10"></div>

                    {/* Zoom */}
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setZoom(Math.max(50, zoom - 10))} 
                            className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/5"
                            title="Zoom Out"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span className="text-[10px] font-black text-white w-10 text-center">{zoom}%</span>
                        <button 
                            onClick={() => setZoom(Math.min(150, zoom + 10))} 
                            className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/5"
                            title="Zoom In"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    <div className="h-6 w-[1px] bg-white/10"></div>

                    <button 
                        onClick={() => {
                            if (!document.fullscreenElement) {
                                document.documentElement.requestFullscreen();
                            } else {
                                document.exitFullscreen();
                            }
                        }}
                        className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5"
                        title="Toggle Fullscreen"
                    >
                        <Maximize2 size={16} />
                    </button>
                </div>
            </div>

            {/* Chapters Drawer Sidebar */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[150] flex justify-end">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
                    <div className="relative w-80 md:w-[400px] bg-[#101010] border-l border-white/10 h-full flex flex-col shadow-2xl z-10">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-white tracking-tight uppercase">Chapters Directory</h3>
                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">{chapters.length} Available</p>
                            </div>
                            <button 
                                onClick={() => setIsSidebarOpen(false)} 
                                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-all"
                            >
                                <ArrowLeft size={16} className="rotate-180" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                            {chapters.map((ch) => {
                                const isCurrent = currentChapter?.id === ch.id;
                                const chNum = getChNumber(ch);
                                const chTitle = getChTitle(ch);
                                return (
                                    <button
                                        key={ch.id}
                                        onClick={() => {
                                            setCurrentChapter(ch);
                                            setIsSidebarOpen(false);
                                        }}
                                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                                            isCurrent
                                                ? 'bg-[#1db954] border-[#1db954] text-black font-black'
                                                : 'bg-white/5 border-white/5 text-white/70 hover:border-white/20 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-black uppercase tracking-wider">
                                                Chapter {chNum}
                                            </div>
                                            {chTitle && (
                                                <div className={`text-[10px] truncate max-w-[220px] ${isCurrent ? 'text-black/70' : 'text-white/40'}`}>
                                                    {chTitle}
                                                </div>
                                            )}
                                        </div>
                                        <BookOpen size={14} className={isCurrent ? 'text-black' : 'text-white/30'} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
