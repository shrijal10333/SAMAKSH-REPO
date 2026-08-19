import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { executeUniversalSearch } from '../api/searchNormalizer';
import { useMusic } from '../context/MusicContext';
import { 
    Search as SearchIcon, Film, Tv, Sparkles, BookOpen, Music as MusicIcon, 
    Star, Play, PlayCircle, RefreshCw, AlertCircle, ArrowRight
} from 'lucide-react';

const CATEGORIES = [
    { id: 'all', label: 'All Results', icon: Sparkles },
    { id: 'movies', label: 'Movies', icon: Film },
    { id: 'tv', label: 'TV Shows', icon: Tv },
    { id: 'anime', label: 'Anime', icon: Sparkles },
    { id: 'manga', label: 'Manga', icon: BookOpen },
    { id: 'music', label: 'Music', icon: MusicIcon },
];

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const initialCategory = searchParams.get('category') || 'all';

    const [activeCategory, setActiveCategory] = useState(initialCategory);
    const [searchInput, setSearchInput] = useState(query);
    const [resultsMap, setResultsMap] = useState({
        all: [],
        movies: [],
        tv: [],
        anime: [],
        manga: [],
        music: []
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const { playSong } = useMusic();

    const runSearch = useCallback(async (searchQuery, category) => {
        if (!searchQuery || !searchQuery.trim()) {
            setResultsMap({ all: [], movies: [], tv: [], anime: [], manga: [], music: [] });
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await executeUniversalSearch(searchQuery, category);
            setResultsMap(data);
        } catch (err) {
            console.error('Universal Search failed:', err);
            setError('Search service experienced an error while retrieving catalog streams.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setSearchInput(query);
        runSearch(query, activeCategory);
    }, [query, activeCategory, runSearch]);

    const handleSearchSubmit = (e) => {
        e?.preventDefault();
        if (searchInput.trim()) {
            setSearchParams({ q: searchInput.trim(), category: activeCategory });
        }
    };

    const handleCategorySwitch = (catId) => {
        setActiveCategory(catId);
        if (query) {
            setSearchParams({ q: query, category: catId });
        }
    };

    const handleItemClick = (item) => {
        if (item.mediaType === 'music') {
            const musicQueue = resultsMap.music.map(m => m.raw);
            playSong(item.raw, musicQueue.length > 0 ? musicQueue : [item.raw], 0);
        } else {
            navigate(item.route);
        }
    };

    const currentDisplayItems = resultsMap[activeCategory] || [];

    return (
        <div className="min-h-screen bg-[#080808] text-white pt-8 pb-40 px-4 md:px-12 lg:px-20 overflow-x-hidden">
            <div className="max-w-[1920px] mx-auto space-y-10">

                {/* Hero Search Box */}
                <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#1db954] block mb-1">
                                UNIVERSAL CATALOG SEARCH
                            </span>
                            <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white">
                                {query ? `Results for "${query}"` : 'Discover Media & Streams'}
                            </h1>
                        </div>
                    </div>

                    <form onSubmit={handleSearchSubmit} className="relative w-full">
                        <input
                            type="text"
                            placeholder="Search Movies, TV Shows, Anime, Manga chapters, or Music..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full bg-black/60 border-2 border-white/10 rounded-2xl py-4 md:py-5 pl-14 pr-32 text-sm md:text-base font-bold text-white placeholder-white/30 focus:border-[#1db954] outline-none transition-all shadow-inner"
                            autoFocus={!query}
                        />
                        <SearchIcon size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
                        <button
                            type="submit"
                            className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-[#1db954] hover:bg-[#1aa34a] text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg active:scale-95"
                        >
                            Search
                        </button>
                    </form>

                    {/* Category Filter Tabs */}
                    <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
                        {CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            const count = (resultsMap[cat.id] || []).length;
                            const isActive = activeCategory === cat.id;

                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategorySwitch(cat.id)}
                                    className={`whitespace-nowrap px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2.5 border ${
                                        isActive
                                            ? 'bg-[#1db954] text-black border-[#1db954] shadow-lg shadow-[#1db954]/20 scale-105'
                                            : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    <Icon size={14} className={isActive ? 'text-black' : 'text-white/40'} />
                                    <span>{cat.label}</span>
                                    {query && !loading && count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${isActive ? 'bg-black/20 text-black' : 'bg-white/10 text-white/40'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Results Grid / States */}
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-4 border-[#1db954] border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-white/40 text-xs font-black uppercase tracking-widest">
                            Scanning Movies, TV, Anime, Manga & Music...
                        </p>
                    </div>
                ) : error ? (
                    <div className="py-16 text-center max-w-md mx-auto bg-[#121212] border border-white/10 rounded-3xl p-8 space-y-4 shadow-xl">
                        <AlertCircle size={40} className="text-[#ff4d4d] mx-auto" />
                        <h3 className="text-xl font-black uppercase text-white">Search Error</h3>
                        <p className="text-white/40 text-xs leading-relaxed">{error}</p>
                        <button
                            onClick={() => runSearch(query, activeCategory)}
                            className="px-6 py-3 bg-[#1db954] text-black rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all"
                        >
                            <RefreshCw size={14} className="inline mr-2" /> Try Again
                        </button>
                    </div>
                ) : !query.trim() ? (
                    <div className="py-24 text-center space-y-4 bg-white/[0.02] border border-white/5 rounded-3xl p-12">
                        <SearchIcon size={48} className="text-white/10 mx-auto" />
                        <h3 className="text-xl font-black uppercase tracking-tight text-white/80">Search Across All Entertainment</h3>
                        <p className="text-white/30 text-xs max-w-md mx-auto">
                            Enter any movie title, TV series, anime, manga publication, or music artist to stream instantly.
                        </p>
                    </div>
                ) : currentDisplayItems.length === 0 ? (
                    <div className="py-24 text-center space-y-4 bg-white/[0.02] border border-white/5 rounded-3xl p-12">
                        <SearchIcon size={48} className="text-white/10 mx-auto" />
                        <h3 className="text-xl font-black uppercase tracking-tight text-white">No Results Found</h3>
                        <p className="text-white/40 text-xs max-w-md mx-auto">
                            No titles found matching "{query}" in category "{activeCategory}". Try switching categories or checking your spelling.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
                        {currentDisplayItems.map((item, idx) => {
                            const isMusic = item.mediaType === 'music';
                            const isManga = item.mediaType === 'manga';

                            return (
                                <div
                                    key={`${item.mediaType}-${item.id}-${idx}`}
                                    onClick={() => handleItemClick(item)}
                                    className="group relative flex flex-col bg-[#121212] border border-white/5 hover:border-[#1db954]/50 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:-translate-y-1.5"
                                >
                                    {/* Media Poster / Image */}
                                    <div className="aspect-[2/3] w-full overflow-hidden relative bg-white/5">
                                        <img
                                            src={item.poster}
                                            alt={item.title}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-[#1db954] text-black flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                                                {isMusic ? <Play size={20} fill="currentColor" className="ml-1" /> : <PlayCircle size={24} fill="currentColor" />}
                                            </div>
                                        </div>

                                        {/* Category Badge */}
                                        <div className="absolute top-3 left-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-lg ${
                                                isMusic
                                                    ? 'bg-[#8B5CF6] text-white'
                                                    : isManga
                                                    ? 'bg-[#FBBF24] text-black'
                                                    : item.mediaType === 'anime'
                                                    ? 'bg-[#ff4d4d] text-white'
                                                    : item.mediaType === 'tv'
                                                    ? 'bg-[#34D399] text-black'
                                                    : 'bg-[#1db954] text-black'
                                            }`}>
                                                {item.mediaType}
                                            </span>
                                        </div>

                                        {/* Rating */}
                                        {item.rating && (
                                            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black text-[#1db954] border border-white/10 flex items-center gap-1">
                                                <Star size={10} className="fill-[#1db954]" /> {item.rating}
                                            </div>
                                        )}
                                    </div>

                                    {/* Text Info */}
                                    <div className="p-4 flex flex-col flex-1 justify-between gap-1.5 bg-[#121212]">
                                        <h3 className="text-xs md:text-sm font-black uppercase tracking-tight text-white group-hover:text-[#1db954] transition-colors truncate">
                                            {item.title}
                                        </h3>
                                        <div className="flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-wider">
                                            <span className="truncate max-w-[120px]">{item.subtitle || item.year || item.mediaType}</span>
                                            {item.year && <span>{item.year}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
