import { useEffect, useState, useCallback } from 'react';
import { fetchManga } from '../api';
import { Search, Zap, TrendingUp, Filter, ArrowRight, Star, RefreshCw, BookOpen, Layers } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

const GENRES = [
    'All', 'Action', 'Adventure', 'Fantasy', 'Romance', 'Drama', 
    'Sci-Fi', 'Horror', 'Mystery', 'Comedy', 'Slice of Life', 
    'Isekai', 'Supernatural', 'Sports', 'Thriller'
];

const TYPES = ['All', 'Manga', 'Manhwa', 'Manhua'];
const STATUSES = ['All', 'Publishing', 'Completed'];

export default function Manga() {
    const [searchParams, setSearchParams] = useSearchParams();
    const urlGenre = searchParams.get('genre') || 'All';
    const urlType = searchParams.get('type') || 'All';
    const urlSearch = searchParams.get('q') || '';

    const [popular, setPopular] = useState([]);
    const [trending, setTrending] = useState([]);
    const [latest, setLatest] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [mostViewed, setMostViewed] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    
    const [viewTab, setViewTab] = useState('Day');
    const [searchQuery, setSearchQuery] = useState(urlSearch);
    const [selectedGenre, setSelectedGenre] = useState(urlGenre);
    const [selectedType, setSelectedType] = useState(urlType);
    const [selectedStatus, setSelectedStatus] = useState('All');

    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';

    const loadMangaHub = useCallback(async () => {
        setLoading(true);
        setHasError(false);
        try {
            // 1. Fetch Popular
            const popRes = await fetch(`${backendUrl}/api/manga/popular`);
            const popData = popRes.ok ? await popRes.json() : await fetchManga('/top/manga?limit=18&filter=bypopularity');
            const popList = popData?.data || [];
            setPopular(popList);
            setMostViewed(popList.slice(0, 8));

            // 2. Fetch Trending
            const trendRes = await fetch(`${backendUrl}/api/manga/trending`);
            const trendData = trendRes.ok ? await trendRes.json() : await fetchManga('/top/manga?limit=12&filter=publishing');
            setTrending(trendData?.data || []);

            // 3. Fetch Latest
            const latestRes = await fetch(`${backendUrl}/api/manga/latest`);
            const latestData = latestRes.ok ? await latestRes.json() : await fetchManga('/manga?limit=18&order_by=start_date&sort=desc');
            setLatest(latestData?.data || []);

        } catch (err) {
            console.error('Failed to load Manga Hub:', err);
            setHasError(true);
        } finally {
            setLoading(false);
        }
    }, [backendUrl]);

    useEffect(() => {
        loadMangaHub();
    }, [loadMangaHub]);

    // Handle Search or Filtering
    const executeSearch = useCallback(async (query, genre, type) => {
        if (!query && genre === 'All' && type === 'All') {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            let resData = null;
            if (query) {
                const searchRes = await fetch(`${backendUrl}/api/manga/search?q=${encodeURIComponent(query)}`);
                if (searchRes.ok) {
                    resData = await searchRes.json();
                } else {
                    resData = await fetchManga(`/manga?q=${encodeURIComponent(query)}&limit=24&order_by=popularity&sort=desc`);
                }
            } else if (genre !== 'All' || type !== 'All') {
                const filterQuery = genre !== 'All' ? genre : type;
                const searchRes = await fetch(`${backendUrl}/api/manga/search?q=${encodeURIComponent(filterQuery)}`);
                if (searchRes.ok) {
                    resData = await searchRes.json();
                } else {
                    resData = await fetchManga(`/manga?q=${encodeURIComponent(filterQuery)}&limit=24&order_by=popularity&sort=desc`);
                }
            }

            let results = resData?.data || [];
            if (type !== 'All') {
                results = results.filter(m => m.type?.toLowerCase() === type.toLowerCase());
            }
            if (selectedStatus !== 'All') {
                results = results.filter(m => m.status?.toLowerCase().includes(selectedStatus.toLowerCase()));
            }
            setSearchResults(results);
        } catch (err) {
            console.error('Search failed:', err);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }, [backendUrl, selectedStatus]);

    useEffect(() => {
        if (urlSearch || urlGenre !== 'All' || urlType !== 'All') {
            executeSearch(urlSearch, urlGenre, urlType);
        }
    }, [urlSearch, urlGenre, urlType, executeSearch]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setSearchParams({ q: searchQuery, genre: selectedGenre, type: selectedType });
        executeSearch(searchQuery, selectedGenre, selectedType);
    };

    const handleGenreChange = (genre) => {
        setSelectedGenre(genre);
        setSearchParams({ q: searchQuery, genre, type: selectedType });
        executeSearch(searchQuery, genre, selectedType);
    };

    const handleTypeChange = (type) => {
        setSelectedType(type);
        setSearchParams({ q: searchQuery, genre: selectedGenre, type });
        executeSearch(searchQuery, selectedGenre, type);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedGenre('All');
        setSelectedType('All');
        setSelectedStatus('All');
        setSearchParams({});
        setSearchResults([]);
    };

    const isFiltering = searchQuery.trim().length > 0 || selectedGenre !== 'All' || selectedType !== 'All';
    const hero = trending[0] || popular[0];

    return (
        <div className="min-h-screen bg-[#080808] text-white pt-24 md:pt-32 pb-40 selection:bg-[#1db954] selection:text-black">
            {/* Spotlight Banner */}
            {!isFiltering && hero && (
                <section className="max-w-[1920px] mx-auto px-4 md:px-12 lg:px-20 mb-12 animate-entrance">
                    <div className="relative h-[380px] md:h-[480px] rounded-3xl md:rounded-[2.5rem] overflow-hidden group border border-white/5 shadow-2xl">
                        <div className="absolute inset-0">
                            <img 
                                src={hero.images?.jpg?.large_image_url || hero.images?.jpg?.image_url} 
                                alt={hero.title} 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/80 to-transparent"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent"></div>
                        </div>

                        <div className="relative z-10 h-full flex flex-col justify-center max-w-3xl pl-6 md:pl-16 pr-6 space-y-4 md:space-y-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="px-3 py-1 bg-[#1db954] text-black text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg">
                                    Featured Manga
                                </span>
                                <span className="text-white/60 text-xs font-bold uppercase tracking-widest">
                                    {hero.type || 'Manga'} • {hero.status || 'Publishing'}
                                </span>
                                {hero.score && (
                                    <span className="flex items-center gap-1 text-[11px] font-black text-[#1db954] bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-lg">
                                        <Star size={12} className="fill-[#1db954]" /> {hero.score}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-2xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white line-clamp-2 leading-none">
                                {hero.title}
                            </h1>

                            <p className="text-white/60 text-xs md:text-base line-clamp-2 md:line-clamp-3 max-w-xl font-medium leading-relaxed">
                                {hero.synopsis || "Dive into this captivating manga chapter on SAMAKSH MOVIE."}
                            </p>

                            <div className="flex items-center gap-4 pt-2">
                                <Link 
                                    to={`/manga/read/${hero.mal_id || hero.id}`} 
                                    className="bg-[#1db954] text-black px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-white hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <Zap size={16} fill="currentColor" /> Read Chapter 1
                                </Link>
                                <Link 
                                    to={`/manga/${hero.mal_id || hero.id}`} 
                                    className="bg-white/10 backdrop-blur-md border border-white/10 text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/20 transition-all flex items-center gap-2"
                                >
                                    <BookOpen size={16} /> Details & Chapters
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Unified Search & Discovery Filter Bar */}
            <section className="max-w-[1920px] mx-auto px-4 md:px-12 lg:px-20 mb-16 relative z-20">
                <div className="bg-[#121212] border border-white/5 rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl backdrop-blur-3xl">
                    <div className="flex flex-col gap-6">
                        {/* Search Input Form */}
                        <form onSubmit={handleSearchSubmit} className="relative flex-1">
                            <input 
                                type="text" 
                                placeholder="Search manga, manhwa, manhua by title, genre, author..." 
                                className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 md:py-5 pl-14 pr-32 text-sm font-bold tracking-tight outline-none focus:border-[#1db954] transition-all text-white placeholder-white/30"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30" />
                            <button 
                                type="submit" 
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#1db954] text-black px-6 md:px-8 py-2.5 rounded-xl font-black uppercase text-[10px] md:text-[11px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                            >
                                Search
                            </button>
                        </form>
                        
                        {/* Interactive Filter Pills */}
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2 border-t border-white/5">
                            {/* Genre Scrollable Filter */}
                            <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 md:pb-0 scrollbar-hide">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 shrink-0 mr-2 flex items-center gap-1">
                                    <Filter size={12} /> Genre:
                                </span>
                                {GENRES.slice(0, 10).map((g) => (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => handleGenreChange(g)}
                                        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all border ${
                                            selectedGenre === g 
                                                ? 'bg-[#1db954] text-black border-[#1db954] shadow-lg shadow-[#1db954]/20' 
                                                : 'bg-white/5 text-white/50 border-white/5 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>

                            {/* Type & Reset Controls */}
                            <div className="flex items-center gap-3 shrink-0 ml-auto">
                                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                                    {TYPES.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => handleTypeChange(t)}
                                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                                selectedType === t ? 'bg-[#1db954] text-black' : 'text-white/40 hover:text-white'
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>

                                {isFiltering && (
                                    <button 
                                        onClick={clearFilters}
                                        className="text-[10px] font-black uppercase tracking-wider text-[#ff4d4d] hover:underline px-3 py-1.5"
                                    >
                                        Reset All
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Error Recovery Alert */}
            {hasError && !loading && (
                <div className="max-w-[1920px] mx-auto px-4 md:px-12 lg:px-20 mb-12">
                    <div className="p-8 bg-[#121212] border border-[#ff4d4d]/30 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                        <div>
                            <h3 className="text-lg font-black uppercase text-white tracking-tight">Manga Provider Rate-Limited</h3>
                            <p className="text-white/40 text-xs font-medium mt-1">External public manga APIs throttled connection. Click retry to reload via our cached backend proxy.</p>
                        </div>
                        <button 
                            onClick={loadMangaHub} 
                            className="bg-[#1db954] text-black px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:scale-105 transition-all shadow-xl"
                        >
                            <RefreshCw size={14} /> Retry Connection
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Layout */}
            <main className="max-w-[1920px] mx-auto px-4 md:px-12 lg:px-20 grid grid-cols-1 xl:grid-cols-12 gap-12">
                {/* Left Column: Filtered Search Results or Categorized Rows */}
                <div className="xl:col-span-9 space-y-16">
                    {isFiltering ? (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <h2 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                                    <span className="w-2 h-8 bg-[#1db954] rounded-full mr-1"></span>
                                    {searchQuery ? `Search Results for "${searchQuery}"` : `${selectedGenre} Manga`}
                                    <span className="text-xs font-bold text-white/30 uppercase tracking-widest ml-2">
                                        ({searchResults.length} items found)
                                    </span>
                                </h2>
                            </div>

                            {searchLoading ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="space-y-3 animate-pulse">
                                            <div className="aspect-[3/4] bg-white/5 rounded-2xl"></div>
                                            <div className="h-4 bg-white/5 rounded w-3/4"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                    {searchResults.map((item) => (
                                        <MangaCard key={item.mal_id || item.id} item={item} />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-24 text-center bg-[#121212] border border-white/5 rounded-3xl p-8 space-y-4">
                                    <Layers size={48} className="mx-auto text-white/20" />
                                    <h3 className="text-lg font-black uppercase text-white tracking-widest">No Manga Found</h3>
                                    <p className="text-white/40 text-xs font-medium max-w-sm mx-auto">
                                        We couldn't find any results matching your search and filter criteria. Try adjusting your query or genre.
                                    </p>
                                    <button 
                                        onClick={clearFilters}
                                        className="px-6 py-2.5 bg-[#1db954] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-105 transition-transform"
                                    >
                                        Clear All Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Popular Manga Section */}
                            <MangaRow 
                                title="Most Popular Manga" 
                                data={popular} 
                                loading={loading} 
                                onSeeAll={() => handleTypeChange('Manga')} 
                            />

                            {/* Trending Manhwa Section */}
                            <MangaRow 
                                title="Trending Manhwa & Webtoons" 
                                data={trending} 
                                loading={loading} 
                                onSeeAll={() => handleTypeChange('Manhwa')} 
                            />

                            {/* Latest Updates Section */}
                            <MangaRow 
                                title="Recently Updated Releases" 
                                data={latest} 
                                loading={loading} 
                                onSeeAll={() => handleGenreChange('Action')} 
                            />
                        </>
                    )}
                </div>

                {/* Right Column: Most Viewed Sidebar + Genres */}
                <aside className="xl:col-span-3 space-y-8">
                    {/* Top Ranking Widget */}
                    <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl">
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                                    <TrendingUp size={18} className="text-[#1db954]" /> Top Chart Rankings
                                </h2>
                            </div>

                            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                                {['Day', 'Week', 'Month'].map((tab) => (
                                    <button 
                                        key={tab}
                                        onClick={() => setViewTab(tab)}
                                        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                            viewTab === tab ? 'bg-[#1db954] text-black shadow-lg' : 'text-white/40 hover:text-white'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3 mt-2">
                                {mostViewed.map((item, idx) => (
                                    <Link 
                                        key={item.mal_id || item.id} 
                                        to={`/manga/${item.mal_id || item.id}`} 
                                        className="flex items-center gap-3.5 group p-2 rounded-2xl hover:bg-white/5 transition-all"
                                    >
                                        <div className={`text-xl font-black italic tracking-tighter w-6 shrink-0 text-center ${
                                            idx === 0 ? 'text-[#1db954]' : idx === 1 ? 'text-white/70' : idx === 2 ? 'text-white/50' : 'text-white/20'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <div className="w-11 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 group-hover:border-[#1db954]/50 transition-colors bg-white/5">
                                            <img 
                                                src={item.images?.jpg?.image_url || item.images?.jpg?.large_image_url} 
                                                alt={item.title} 
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-[11px] font-bold uppercase tracking-tight truncate text-white group-hover:text-[#1db954] transition-colors mb-0.5">
                                                {item.title}
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">
                                                    {item.type || 'Manga'}
                                                </span>
                                                <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                                <div className="flex items-center gap-1">
                                                    <Star size={8} className="text-[#1db954] fill-[#1db954]" />
                                                    <span className="text-[8px] font-black text-[#1db954]">
                                                        {item.score || '8.5'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* All Genres Cloud Widget */}
                    <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl">
                        <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-6 pb-4 border-b border-white/5 flex items-center justify-between">
                            <span>Browse Genres</span>
                            <span className="text-[9px] text-[#1db954]">{GENRES.length} Tags</span>
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {GENRES.map((g) => (
                                <button
                                    key={g}
                                    onClick={() => handleGenreChange(g)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                                        selectedGenre === g 
                                            ? 'bg-[#1db954] text-black border-[#1db954]' 
                                            : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}

function MangaRow({ title, data, loading, onSeeAll }) {
    if (!loading && (!data || data.length === 0)) return null;

    return (
        <div className="space-y-6 animate-entrance">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                    <span className="w-2 h-7 bg-[#1db954] rounded-full mr-1"></span> {title}
                </h2>
                {onSeeAll && (
                    <button 
                        onClick={onSeeAll}
                        className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-[#1db954] transition-colors flex items-center gap-1.5 group"
                    >
                        View More <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 md:gap-6">
                {loading 
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="space-y-3 animate-pulse">
                            <div className="aspect-[3/4] bg-white/5 rounded-2xl"></div>
                            <div className="h-4 bg-white/5 rounded w-3/4"></div>
                        </div>
                    ))
                    : data.slice(0, 12).map((item) => (
                        <MangaCard key={item.mal_id || item.id} item={item} />
                    ))
                }
            </div>
        </div>
    );
}

function MangaCard({ item }) {
    const id = item.mal_id || item.id;
    const coverUrl = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url;

    return (
        <Link 
            to={`/manga/${id}`} 
            className="group transition-all duration-300 flex flex-col"
        >
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 mb-3 group-hover:border-[#1db954]/50 group-hover:shadow-[0_10px_30px_rgba(29,185,84,0.15)] transition-all duration-300 bg-white/5">
                <img 
                    src={coverUrl} 
                    alt={item.title} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    loading="lazy"
                />
                
                {/* Overlay Details */}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent">
                    <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider">
                        <span className="px-1.5 py-0.5 bg-[#1db954] text-black rounded font-black">
                            {item.type || 'Manga'}
                        </span>
                        <span className="text-white/60">
                            {item.status === 'Publishing' ? 'ONGOING' : 'COMPLETE'}
                        </span>
                    </div>
                </div>

                {/* Score Pill */}
                {item.score && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-lg text-[8px] font-black text-[#1db954] uppercase tracking-widest border border-white/10 flex items-center gap-1">
                        <Star size={8} className="fill-[#1db954]" /> {item.score}
                    </div>
                )}
            </div>
            
            <h3 className="text-xs font-bold tracking-tight text-white line-clamp-1 group-hover:text-[#1db954] transition-colors">
                {item.title}
            </h3>
            <div className="text-[9px] text-white/40 font-medium uppercase tracking-widest mt-1">
                {item.chapters ? `CH. ${item.chapters}` : 'LATEST'} • {item.status || 'Active'}
            </div>
        </Link>
    );
}
