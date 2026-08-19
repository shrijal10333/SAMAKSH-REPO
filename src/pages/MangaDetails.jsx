import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchMangaDetails, fetchMangaChapters } from '../api';
import { BookOpen, Star, Zap, Layers, ArrowRight, Search, RefreshCw, ExternalLink } from 'lucide-react';

export default function MangaDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [chapters, setChapters] = useState([]);
    const [fetchingChapters, setFetchingChapters] = useState(false);
    const [chapterSearch, setChapterSearch] = useState('');
    const [resolvedMdId, setResolvedMdId] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        let isMounted = true;

        const loadDetailsAndChapters = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Fetch Manga specifications via dedicated proxy
                const mangaData = await fetchMangaDetails(id);

                if (!isMounted) return;
                setDetail(mangaData);

                if (mangaData) {
                    setFetchingChapters(true);
                    const targetId = mangaData.mangadexId || mangaData.id || id;
                    const targetTitle = mangaData.title_english || mangaData.title || '';
                    
                    const feedRes = await fetchMangaChapters(targetId, targetTitle);
                    if (isMounted && feedRes) {
                        setChapters(feedRes.data || []);
                        if (feedRes.mangadexId) {
                            setResolvedMdId(feedRes.mangadexId);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load manga details:', err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setFetchingChapters(false);
                }
            }
        };

        loadDetailsAndChapters();

        return () => {
            isMounted = false;
        };
    }, [id]);

    const filteredChapters = chapters.filter(ch => {
        if (!chapterSearch.trim()) return true;
        const query = chapterSearch.toLowerCase();
        const chNum = (ch.chapter || ch.attributes?.chapter || '').toString();
        const chTitle = (ch.title || ch.attributes?.title || '').toLowerCase();
        return chNum.includes(query) || chTitle.includes(query);
    });

    const firstChapter = chapters[0];
    const latestChapter = chapters[chapters.length - 1];

    if (loading) {
        return (
            <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center text-white space-y-4">
                <div className="w-12 h-12 border-4 border-[#1db954] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white/60 font-black uppercase tracking-widest text-xs">Loading Manga Specifications...</p>
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center text-white p-8 text-center space-y-6">
                <Layers size={64} className="text-white/20" />
                <h1 className="text-2xl font-black uppercase tracking-tight">Manga Archive Not Found</h1>
                <p className="text-white/40 text-sm max-w-md">The requested manga could not be retrieved from the catalog.</p>
                <button 
                    onClick={() => navigate('/manga')} 
                    className="px-8 py-3 bg-[#1db954] text-black font-black uppercase text-xs tracking-widest rounded-2xl hover:scale-105 transition-transform"
                >
                    Back to Manga Catalog
                </button>
            </div>
        );
    }

    const coverUrl = detail.images?.jpg?.large_image_url || detail.images?.jpg?.image_url;
    const readerId = resolvedMdId || detail.mangadexId || detail.id || id;

    return (
        <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden relative selection:bg-[#1db954] selection:text-black pb-40">
            {/* Header Hero Canvas */}
            <section className="relative min-h-[60vh] md:min-h-[70vh] w-full flex items-end pt-32 pb-16">
                <div className="absolute inset-0 z-0">
                    <img 
                        src={coverUrl} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-20 blur-3xl scale-110" 
                        alt="" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/80 to-transparent"></div>
                </div>

                <div className="relative z-10 max-w-[1920px] mx-auto px-6 md:px-16 w-full">
                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-end">
                        {/* Cover Poster */}
                        <div className="w-56 md:w-72 aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border border-white/10 shrink-0 group relative bg-white/5">
                            <img src={coverUrl} alt={detail.title} referrerPolicy="no-referrer" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            {detail.score && (
                                <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-black text-[#1db954] border border-white/10 flex items-center gap-1.5 shadow-lg">
                                    <Star size={14} className="fill-[#1db954]" /> {detail.score}
                                </div>
                            )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="flex-1 flex flex-col gap-4 text-center lg:text-left">
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
                                <span className="px-3 py-1 bg-[#1db954] text-black text-[10px] font-black uppercase tracking-wider rounded-lg">
                                    {detail.type || 'Manga'}
                                </span>
                                <span className="px-3 py-1 bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-white/5">
                                    {detail.status || 'Active'}
                                </span>
                                {detail.rank && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                        Rank #{detail.rank}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white leading-none">
                                {detail.title}
                            </h1>

                            {detail.title_english && detail.title_english !== detail.title && (
                                <h2 className="text-sm md:text-base font-bold text-white/40 uppercase tracking-wider">
                                    {detail.title_english}
                                </h2>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
                                {firstChapter ? (
                                    <Link 
                                        to={`/manga/read/${readerId}?chapter=${firstChapter.id}&chNum=${firstChapter.chapter || firstChapter.attributes?.chapter || '1'}`}
                                        className="bg-[#1db954] text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Zap size={16} fill="currentColor" /> Read Chapter {firstChapter.chapter || firstChapter.attributes?.chapter || '1'}
                                    </Link>
                                ) : (
                                    <Link 
                                        to={`/manga/read/${readerId}`}
                                        className="bg-[#1db954] text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Zap size={16} fill="currentColor" /> Start Reading
                                    </Link>
                                )}

                                {latestChapter && (
                                    <Link 
                                        to={`/manga/read/${readerId}?chapter=${latestChapter.id}&chNum=${latestChapter.chapter || latestChapter.attributes?.chapter || 'Latest'}`}
                                        className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2"
                                    >
                                        Latest (CH. {latestChapter.chapter || latestChapter.attributes?.chapter})
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content Layout */}
            <div className="max-w-[1920px] mx-auto px-6 md:px-16 grid grid-cols-1 xl:grid-cols-12 gap-12 mt-12">
                {/* Left Column: Chapters & Details */}
                <div className="xl:col-span-8 space-y-12">
                    {/* Synopsis Card */}
                    <div className="bg-[#121212] border border-white/5 rounded-3xl p-8 md:p-10 shadow-xl space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1db954]">Synopsis & Overview</h3>
                        <p className="text-sm md:text-base font-normal text-white/70 leading-relaxed">
                            {detail.synopsis || "No description provided for this publication."}
                        </p>
                    </div>

                    {/* Chapters Directory */}
                    <div className="bg-[#121212] border border-white/5 rounded-3xl p-8 md:p-10 shadow-xl space-y-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                            <div>
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                                    <BookOpen size={22} className="text-[#1db954]" /> Chapters Directory
                                </h2>
                                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">
                                    {chapters.length} Chapters Available
                                </p>
                            </div>

                            {/* Chapter Search Filter */}
                            <div className="relative w-full sm:w-64">
                                <input 
                                    type="text" 
                                    placeholder="Filter chapters (e.g. 10)..." 
                                    value={chapterSearch}
                                    onChange={(e) => setChapterSearch(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-white placeholder-white/30 focus:border-[#1db954] outline-none transition-colors"
                                />
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                            </div>
                        </div>

                        {fetchingChapters ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse border border-white/5"></div>
                                ))}
                            </div>
                        ) : filteredChapters.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                                {filteredChapters.map((ch) => {
                                    const chNumber = ch.chapter || ch.attributes?.chapter || '??';
                                    const chTitle = ch.title || ch.attributes?.title || '';
                                    return (
                                        <Link
                                            key={ch.id}
                                            to={`/manga/read/${readerId}?chapter=${ch.id}&chNum=${chNumber}`}
                                            className="group p-4 bg-white/5 hover:bg-[#1db954] border border-white/5 hover:border-[#1db954] rounded-2xl transition-all duration-300 flex items-center justify-between"
                                        >
                                            <div className="min-w-0">
                                                <span className="text-[12px] font-black uppercase text-white group-hover:text-black transition-colors block truncate">
                                                    Chapter {chNumber}
                                                </span>
                                                {chTitle && (
                                                    <span className="text-[9px] font-medium text-white/40 group-hover:text-black/70 truncate block transition-colors">
                                                        {chTitle}
                                                    </span>
                                                )}
                                            </div>
                                            <ArrowRight size={14} className="text-white/30 group-hover:text-black shrink-0 ml-2 group-hover:translate-x-0.5 transition-all" />
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : chapters.length > 0 ? (
                            <div className="p-12 text-center text-white/40 text-xs font-bold uppercase tracking-widest">
                                No chapters matching "{chapterSearch}"
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-black/30 rounded-2xl border border-white/5 space-y-4">
                                <p className="text-white/40 text-xs font-medium">
                                    Online scan chapters are syncing for this title. You can open the reader to stream direct releases.
                                </p>
                                <Link 
                                    to={`/manga/read/${readerId}`}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#1db954] text-black font-black uppercase text-xs tracking-widest rounded-xl hover:scale-105 transition-transform"
                                >
                                    <Zap size={14} fill="currentColor" /> Launch Reader Engine
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Publication Specs Sidebar */}
                <aside className="xl:col-span-4 space-y-8">
                    <div className="bg-[#121212] border border-white/5 rounded-3xl p-8 shadow-xl space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 pb-4 border-b border-white/5">
                            Publication Information
                        </h3>

                        <div className="space-y-5">
                            <InfoRow label="Score Rating" value={detail.score ? `${detail.score} / 10` : '8.5 / 10'} />
                            <InfoRow label="Status" value={detail.status || 'Publishing'} highlight />
                            <InfoRow label="Format" value={detail.type || 'Manga'} />
                            <InfoRow label="Total Volumes" value={detail.volumes || 'Ongoing'} />
                            <InfoRow label="Total Chapters" value={detail.chapters || (chapters.length ? `${chapters.length} loaded` : 'Ongoing')} />
                            <InfoRow label="Demographic" value={(detail.demographics || []).map(d => d.name).join(', ') || 'General'} />
                        </div>

                        {/* Authors Section */}
                        {detail.authors && detail.authors.length > 0 && (
                            <div className="pt-4 border-t border-white/5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">
                                    Authors & Creators
                                </span>
                                <div className="space-y-1">
                                    {detail.authors.map((a, idx) => (
                                        <p key={idx} className="text-xs font-bold text-white">{a.name}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Genres Section */}
                        {detail.genres && detail.genres.length > 0 && (
                            <div className="pt-4 border-t border-white/5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-3">
                                    Genres & Tags
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {detail.genres.map((g, idx) => (
                                        <Link 
                                            key={idx} 
                                            to={`/manga?genre=${encodeURIComponent(g.name)}`}
                                            className="px-3 py-1 bg-white/5 hover:bg-[#1db954] hover:text-black border border-white/5 rounded-lg text-[10px] font-bold text-white/60 transition-colors"
                                        >
                                            {g.name}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}

function InfoRow({ label, value, highlight }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-white/40 font-bold uppercase tracking-wider text-[10px]">{label}</span>
            <span className={`font-black uppercase tracking-tight ${highlight ? 'text-[#1db954]' : 'text-white'}`}>{value}</span>
        </div>
    );
}
