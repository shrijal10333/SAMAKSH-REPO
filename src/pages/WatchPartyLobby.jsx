import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LogIn, Plus, Lock, Unlock, PlayCircle, EyeOff, Eye } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { fetchApi, getImageUrl } from '../api';
import { Search, X, Loader2, RefreshCw, Calendar, MessageCircle } from 'lucide-react';

let socket;

export default function WatchPartyLobby() {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [showCreatePassword, setShowCreatePassword] = useState(false);

    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [connectionError, setConnectionError] = useState(false);

    const [activeRooms, setActiveRooms] = useState([]);
    const [promptRoom, setPromptRoom] = useState(null);

    // Create Room Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState(1);
    const [episodesList, setEpisodesList] = useState([]);
    const [isPrivate, setIsPrivate] = useState(false);
    const [customRoomName, setCustomRoomName] = useState('');

    const { user } = useAuth();

    useEffect(() => {
        try {
            socket = io(import.meta.env.VITE_API_URL || undefined, {
                timeout: 5000,
                reconnectionAttempts: 3,
            });

            socket.on('connect', () => setConnectionError(false));
            socket.on('connect_error', () => setConnectionError(true));

            socket.on('rooms_updated', (rooms) => {
                setActiveRooms(rooms);
            });
        } catch (err) {
            setConnectionError(true);
        }

        const apiBase = import.meta.env.VITE_API_URL || '';
        fetch(`${apiBase}/api/rooms`)
            .then(res => res.json())
            .then(data => setActiveRooms(data))
            .catch(() => setConnectionError(true));

        return () => { if (socket) socket.disconnect(); };
    }, []);

    const getFinalUsername = () => {
        return user ? user.name : (username.trim() || 'Guest_' + Math.floor(1000 + Math.random() * 9000));
    };

    const handleRefresh = () => {
        const apiBase = import.meta.env.VITE_API_URL || '';
        fetch(`${apiBase}/api/rooms`)
            .then(res => res.json())
            .then(data => setActiveRooms(data))
            .catch(console.error);
    };

    const handleSearch = async (q) => {
        setSearchQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        const data = await fetchApi('/search/multi', { query: q });
        setSearchResults(data?.results?.filter(r => r.media_type !== 'person') || []);
        setIsSearching(false);
    };

    const handleSelectMedia = async (media) => {
        setSelectedMedia(media);
        setCustomRoomName(media.title || media.name);
        if (media.media_type === 'tv') {
            const data = await fetchApi(`/tv/${media.id}/season/1`);
            setEpisodesList(data?.episodes || []);
        }
    };

    const changeSeason = async (s) => {
        setSelectedSeason(s);
        setSelectedEpisode(1);
        const data = await fetchApi(`/tv/${selectedMedia.id}/season/${s}`);
        setEpisodesList(data?.episodes || []);
    };

    const handleCreateRoom = async () => {
        setError('');
        const finalUsername = getFinalUsername();

        const mediaData = {
            id: selectedMedia.id,
            type: selectedMedia.media_type,
            title: selectedMedia.title || selectedMedia.name,
            poster_path: selectedMedia.poster_path,
            season: selectedMedia.media_type === 'tv' ? selectedSeason : null,
            episode: selectedMedia.media_type === 'tv' ? selectedEpisode : null
        };

        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName: customRoomName,
                    host: finalUsername,
                    password: isPrivate ? createPassword : '',
                    media: mediaData
                })
            });
            const data = await res.json();

            if (res.ok) {
                sessionStorage.setItem('wp_username', finalUsername);
                sessionStorage.setItem('wp_room', data.room.id);
                sessionStorage.setItem('wp_isHost', 'true');
                navigate('/party/room/' + data.room.id);
            } else {
                setError('Failed to create room.');
            }
        } catch (err) {
            setError('Server connection failed.');
        }
    };

    const attemptJoinRoom = async (code, pass = '') => {
        setError('');
        setPasswordError('');
        const finalUsername = getFinalUsername();

        try {
            const apiBase = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiBase}/api/rooms/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: code.toUpperCase(), password: pass })
            });
            const data = await res.json();

            if (res.ok) {
                sessionStorage.setItem('wp_username', finalUsername);
                sessionStorage.setItem('wp_room', code.toUpperCase());
                sessionStorage.setItem('wp_isHost', 'false');
                navigate('/party/room/' + code.toUpperCase());
            } else {
                if (res.status === 401) {
                    setPasswordError('Incorrect password.');
                    setPromptRoom(code.toUpperCase());
                } else if (res.status === 404) {
                    setError('Room not found!');
                }
            }
        } catch (err) {
            setError('Server connection failed.');
        }
    };

    const handleJoinWithCode = (e) => {
        e.preventDefault();
        if (!roomCode.trim()) { setError('Enter a room code.'); return; }
        attemptJoinRoom(roomCode);
    };

    const handleJoinClickFromList = (room) => {
        if (room.hasPassword) {
            setPromptRoom(room.id);
            setJoinPassword('');
            setPasswordError('');
        } else {
            attemptJoinRoom(room.id);
        }
    };

    const submitPasswordPrompt = (e) => {
        e.preventDefault();
        attemptJoinRoom(promptRoom, joinPassword);
    };

    return (
        <div className="min-h-screen bg-[#080808] px-4 md:px-8 lg:px-16 pb-20">
            <div className="max-w-[1400px] mx-auto">
                
                {/* Password Prompt Modal */}
                {promptRoom && (
                    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                        <div className="bg-[#121212] border border-white/10 p-8 rounded-2xl max-w-sm w-full">
                            <Lock size={32} className="text-[#ff4d4d] mx-auto mb-4" />
                            <h3 className="text-xl font-black text-center mb-1 uppercase tracking-tight">Private Room</h3>
                            <p className="text-white/30 text-center text-xs mb-6">Enter password to join</p>

                            <form onSubmit={submitPasswordPrompt} className="space-y-4">
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={joinPassword}
                                    onChange={e => setJoinPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-4 outline-none focus:border-[#1db954]/40 text-sm text-white text-center"
                                    autoFocus
                                />
                                {passwordError && <p className="text-red-400 text-xs text-center">{passwordError}</p>}
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setPromptRoom(null)} className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-bold transition">Cancel</button>
                                    <button type="submit" className="flex-1 py-3 rounded-lg bg-[#ff4d4d] text-white text-sm font-bold transition">Join</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Header */}
                <header className="py-6 md:py-10 mb-6 md:mb-10">
                    <p className="text-[10px] font-bold text-[#1db954] uppercase tracking-widest mb-2">Samaksh Party Hub</p>
                    <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white mb-2">
                        Watch Together
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
                        <span className="flex items-center gap-1.5"><Users size={14} className="text-[#ff4d4d]" /> {activeRooms.length} rooms online</span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> Secure Connection</span>
                    </div>
                    
                    {error && <p className="mt-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">{error}</p>}
                    {connectionError && <p className="mt-4 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-lg">⚠️ Server is offline. Watch Party requires the backend server at {import.meta.env.VITE_API_URL || 'localhost:3001'}. Rooms will not load.</p>}
                </header>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                    <form onSubmit={handleJoinWithCode} className="flex-1 flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Enter room code..." 
                            value={roomCode}
                            onChange={e => setRoomCode(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#1db954]/40" 
                        />
                        <button type="submit" className="shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-white hover:bg-white/20 transition active:scale-95">
                            Join
                        </button>
                    </form>
                    <div className="flex gap-2">
                        <button onClick={handleRefresh} className="p-3 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-[#1db954] transition active:scale-95">
                            <RefreshCw size={18} />
                        </button>
                        <button onClick={() => setShowCreateModal(true)} className="flex-1 sm:flex-none flex items-center gap-2 px-6 py-3 bg-[#ff4d4d] rounded-lg text-sm font-bold text-white active:scale-95 transition">
                            <Plus size={16} /> Create Party
                        </button>
                    </div>
                </div>

                {/* Room List */}
                {activeRooms.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-white/[0.02]">
                        <Users size={48} className="text-white/10 mb-4" />
                        <p className="text-sm text-white/20 mb-4">No active parties found</p>
                        <button onClick={() => setShowCreateModal(true)} className="text-xs font-bold text-[#1db954] underline underline-offset-4">Create one</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {activeRooms.map((room, idx) => (
                            <div key={room.id} className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition group">
                                {/* Room poster */}
                                <div className="relative aspect-video overflow-hidden">
                                    <img 
                                        src={room.media?.poster_path ? getImageUrl(room.media.poster_path, 'w500') : ''} 
                                        alt="" 
                                        className="w-full h-full object-cover opacity-30 group-hover:opacity-50 group-hover:scale-105 transition-all duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#080808] to-transparent"></div>
                                    
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 rounded text-[8px] font-bold text-white/50 uppercase tracking-widest">
                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div> Live
                                    </div>
                                    {room.hasPassword && <Lock size={12} className="absolute top-3 right-3 text-[#ff4d4d]" />}

                                    <div className="absolute bottom-3 left-3 right-3">
                                        <h3 className="text-base font-bold text-white truncate">{room.roomName}</h3>
                                        <p className="text-[10px] text-white/30 uppercase">{room.id}</p>
                                    </div>
                                </div>

                                {/* Room info */}
                                <div className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-[#1db954]/20 flex items-center justify-center text-xs font-bold text-[#1db954]">
                                            {room.host.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-white truncate block">{room.host}</span>
                                            <span className="text-[9px] text-white/20">{room.viewers} watching</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleJoinClickFromList(room)}
                                        className="px-4 py-2 bg-[#ff4d4d] rounded-lg text-xs font-bold text-white active:scale-95 transition"
                                    >
                                        Join
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-end sm:items-center justify-center">
                    <div className="bg-[#121212] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h2 className="text-lg font-black uppercase tracking-tight">Create Party</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-white transition">
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search movie or show..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-[#1db954]/40"
                                />
                            </div>

                            {!selectedMedia ? (
                                <div className="grid grid-cols-3 gap-3 min-h-[200px]">
                                    {searchResults.map(item => (
                                        <button key={item.id} onClick={() => handleSelectMedia(item)} className="text-left group">
                                            <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 group-hover:border-[#1db954]/40 transition bg-white/5">
                                                {item.poster_path && <img src={getImageUrl(item.poster_path, 'w185')} alt="" className="w-full h-full object-cover" />}
                                            </div>
                                            <p className="mt-2 text-[10px] font-bold truncate text-white/60 group-hover:text-white">{item.title || item.name}</p>
                                        </button>
                                    ))}
                                    {isSearching && <div className="col-span-3 py-10 text-center text-xs text-white/20 animate-pulse">Searching...</div>}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Selected media */}
                                    <div className="flex gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                                        {selectedMedia.poster_path && <img src={getImageUrl(selectedMedia.poster_path, 'w92')} className="w-14 rounded" alt="" />}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-white truncate">{selectedMedia.title || selectedMedia.name}</h3>
                                            <span className="text-[10px] text-[#1db954] uppercase">{selectedMedia.media_type}</span>
                                            <button onClick={() => setSelectedMedia(null)} className="block text-[10px] text-white/30 mt-1 hover:text-white">Change</button>
                                        </div>
                                    </div>

                                    {/* Room name */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1 block">Room Name</label>
                                        <input 
                                            type="text" 
                                            value={customRoomName}
                                            onChange={e => setCustomRoomName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-[#1db954]/40"
                                        />
                                    </div>

                                    {/* Private toggle */}
                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                        <div>
                                            <span className="text-xs font-bold text-white">Private Room</span>
                                            <p className="text-[10px] text-white/30">Requires password</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff4d4d]"></div>
                                        </label>
                                    </div>

                                    {isPrivate && (
                                        <input 
                                            type="password"
                                            placeholder="Set password..."
                                            value={createPassword}
                                            onChange={e => setCreatePassword(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-[#1db954]/40"
                                        />
                                    )}

                                    <button 
                                        onClick={handleCreateRoom}
                                        className="w-full py-4 bg-[#ff4d4d] text-white rounded-lg font-bold uppercase tracking-widest text-sm active:scale-95 transition"
                                    >
                                        Create Room
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
