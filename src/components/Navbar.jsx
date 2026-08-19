import { Search, Bell, Menu, Sparkles, ArrowLeft, Loader2, Play, BookOpen, Music as MusicIcon, Film, Tv } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { ProfileAvatar } from '../pages/Profile';
import { executeUniversalSearch } from '../api/searchNormalizer';

export default function Navbar({ onMenuClick, isSidebarHidden }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mobileSearch, setMobileSearch] = useState(false);
    const { user } = useAuth();
    const { playSong } = useMusic();
    const navigate = useNavigate();
    const location = useLocation();
    const suggestionsRef = useRef(null);
    const mobileInputRef = useRef(null);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (mobileSearch && mobileInputRef.current) {
            mobileInputRef.current.focus();
        }
    }, [mobileSearch]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length > 1) {
                setLoading(true);
                try {
                    const data = await executeUniversalSearch(query.trim(), 'all');
                    setSuggestions((data.all || []).slice(0, 6));
                } catch (e) {
                    console.warn('Navbar suggestions error:', e);
                    setSuggestions([]);
                } finally {
                    setLoading(false);
                }
            } else {
                setSuggestions([]);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (query.trim()) {
            navigate(`/search?q=${encodeURIComponent(query.trim())}`);
            setQuery('');
            setShowSuggestions(false);
            setMobileSearch(false);
        }
    };

    const handleSuggestionClick = (item) => {
        setQuery('');
        setShowSuggestions(false);
        setMobileSearch(false);

        if (item.mediaType === 'music') {
            playSong(item.raw, [item.raw], 0);
        } else {
            navigate(item.route);
        }
    };

    return (
        <nav className={`fixed top-0 ${isSidebarHidden ? 'left-0' : 'left-0 md:left-64'} right-0 z-[100] transition-all duration-500 ${isScrolled ? 'bg-[#0b0b0b]/90 backdrop-blur-3xl py-2 md:py-3 border-b border-white/5 shadow-2xl' : 'bg-transparent py-4 md:py-6'}`}>
            <div className="max-w-[1920px] mx-auto px-4 md:px-10 flex items-center justify-between gap-6">
                
                {/* Desktop Search */}
                <div className="hidden md:flex flex-1 max-w-2xl relative group" ref={suggestionsRef}>
                    <Search className={`absolute left-6 top-1/2 -translate-y-1/2 transition-colors ${query ? 'text-[#1db954]' : 'text-white/20'}`} size={18} />
                    <form onSubmit={handleSearch} className="w-full">
                        <input
                            type="text"
                            placeholder="SEARCH MOVIES, SHOWS, ANIME, MANGA, MUSIC..."
                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 pl-16 pr-6 text-[11px] font-black tracking-widest text-white placeholder:text-white/20 outline-none focus:bg-white/10 focus:border-[#1db954]/40 transition-all uppercase"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                        />
                    </form>
                    
                    {/* Search suggestions */}
                    {showSuggestions && query.trim().length > 1 && (suggestions.length > 0 || loading) && (
                        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-[#121212] border border-white/10 rounded-3xl overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)] animate-entrance p-2 z-[200]">
                            {loading ? (
                                <div className="p-8 flex flex-col items-center gap-3">
                                    <Loader2 className="animate-spin text-[#1db954]" size={24} />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Scanning Catalog Nodes...</span>
                                </div>
                            ) : (
                                <div className="grid gap-1">
                                    {suggestions.map((item, idx) => (
                                        <button
                                            key={`${item.mediaType}-${item.id}-${idx}`}
                                            onClick={() => handleSuggestionClick(item)}
                                            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all group text-left w-full"
                                        >
                                            <div className="w-12 h-16 rounded-xl overflow-hidden border border-white/5 shrink-0 bg-white/5">
                                                <img 
                                                    src={item.poster} 
                                                    alt="" 
                                                    referrerPolicy="no-referrer" 
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-black text-white uppercase truncate group-hover:text-[#1db954] transition-colors">
                                                    {item.title}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                     <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                                         item.mediaType === 'music' ? 'bg-[#8B5CF6] text-white' :
                                                         item.mediaType === 'manga' ? 'bg-[#FBBF24] text-black' :
                                                         item.mediaType === 'anime' ? 'bg-[#ff4d4d] text-white' :
                                                         item.mediaType === 'tv' ? 'bg-[#34D399] text-black' :
                                                         'bg-[#1db954] text-black'
                                                     }`}>
                                                         {item.mediaType}
                                                     </span>
                                                     {item.year && (
                                                         <>
                                                             <div className="w-1 h-1 bg-white/10 rounded-full"></div>
                                                             <span className="text-[9px] font-bold text-white/40">{item.year}</span>
                                                         </>
                                                     )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    <div className="p-2 border-t border-white/5 mt-1">
                                        <button
                                            onClick={handleSearch}
                                            className="w-full py-2.5 bg-white/5 hover:bg-[#1db954] hover:text-black rounded-xl text-center text-[10px] font-black uppercase tracking-widest text-white/60 transition-colors"
                                        >
                                            View all results for "{query}" →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-3 md:gap-6 ml-auto">
                    {/* Mobile: Search + Menu */}
                    <div className="flex md:hidden items-center gap-3">
                         <button onClick={() => setMobileSearch(true)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
                             <Search size={20} />
                         </button>
                         <button onClick={onMenuClick} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
                             <Menu size={20} />
                         </button>
                    </div>

                    <Link to="/feed" className="hidden sm:flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all group">
                         <Bell size={18} className="group-hover:rotate-12 transition-transform" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Feed</span>
                    </Link>

                    {user ? (
                        <Link to="/profile" className="flex items-center gap-4 group">
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-[#1db954] to-emerald-700 p-[1px] group-hover:rotate-[10deg] transition-all">
                                 <div className="w-full h-full rounded-[15px] bg-[#0b0b0b] flex items-center justify-center overflow-hidden">
                                     <ProfileAvatar user={user} size="sm" />
                                 </div>
                             </div>
                        </Link>
                    ) : (
                        <Link to="/auth" className="bg-[#1db954] hover:bg-white text-black px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95">
                            Sign In
                        </Link>
                    )}
                </div>
            </div>

            {/* Mobile Search Overlay */}
            {mobileSearch && (
                <div className="fixed inset-0 bg-[#0b0b0b] z-[300] md:hidden p-4 animate-entrance">
                    <div className="flex items-center gap-4 mb-6">
                         <button onClick={() => setMobileSearch(false)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
                             <ArrowLeft size={20} />
                         </button>
                         <div className="flex-1 relative">
                              <input
                                 ref={mobileInputRef}
                                 type="text"
                                 placeholder="SEARCH CATALOG..."
                                 className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xs font-bold text-white uppercase outline-none focus:border-[#1db954]/40 ring-0"
                                 value={query}
                                 onChange={(e) => setQuery(e.target.value)}
                                 onKeyDown={(e) => {
                                     if (e.key === 'Enter') handleSearch(e);
                                 }}
                              />
                              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                         </div>
                    </div>

                    {/* Mobile Suggestions list */}
                    {query.trim().length > 1 && (
                        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-120px)] custom-scrollbar">
                            {loading ? (
                                <div className="p-8 text-center text-white/40 text-xs font-bold">
                                    <Loader2 className="animate-spin text-[#1db954] mx-auto mb-2" size={24} />
                                    Searching...
                                </div>
                            ) : (
                                suggestions.map((item, idx) => (
                                    <button
                                        key={`m-${item.id}-${idx}`}
                                        onClick={() => handleSuggestionClick(item)}
                                        className="w-full flex items-center gap-4 p-3 bg-white/5 rounded-2xl text-left border border-white/5"
                                    >
                                        <div className="w-12 h-16 rounded-xl overflow-hidden bg-white/5 shrink-0">
                                            <img src={item.poster} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-black uppercase text-white truncate">{item.title}</h4>
                                            <span className="text-[9px] font-bold text-[#1db954] uppercase">{item.mediaType}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
}
