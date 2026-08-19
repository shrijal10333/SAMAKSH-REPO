import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Users, Loader2, Film, MessageCircle, ArrowLeft, Send, Share2, X, Check } from 'lucide-react';
import { io } from 'socket.io-client';
import Watch from './Watch';

let socket;

export default function PartyRoomWaiting() {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState("Waiting for Host...");
    const [playingVideo, setPlayingVideo] = useState(null);
    const [messages, setMessages] = useState([]);
    const [currentMsg, setCurrentMsg] = useState("");
    const [viewers, setViewers] = useState([]);
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'info'
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [connectionError, setConnectionError] = useState(false);
    const lastVideoRef = useRef(null); // format: "type-id"

    const isHost = sessionStorage.getItem('wp_isHost') === 'true';
    const username = sessionStorage.getItem('wp_username') || "Guest";
    const messagesEndRef = useRef(null);

    useEffect(() => {
        try {
            socket = io(import.meta.env.VITE_API_URL || undefined, {
                timeout: 5000,
                reconnectionAttempts: 3,
            });

            socket.on('connect', () => {
                setConnectionError(false);
                socket.emit('join_room', { room: roomCode, username });
            });

            socket.on('connect_error', () => {
                setConnectionError(true);
            });

            socket.on('video_sync', (data) => {
                if (data.type && data.id) {
                    const videoKey = `${data.type}-${data.id}`;
                    if (lastVideoRef.current !== videoKey) {
                        lastVideoRef.current = videoKey;
                        setPlayingVideo({
                            type: data.type,
                            id: data.id,
                            currentTime: data.currentTime || 0
                        });
                    }
                }
            });

            socket.on('receive_message', (msg) => {
                setMessages(prev => [...prev, msg]);
            });

            socket.on('room_users', (users) => {
                setViewers(users);
            });

            socket.on('kicked', () => {
                alert("You have been removed from the session by the host.");
                navigate('/party');
            });
        } catch (err) {
            setConnectionError(true);
        }

        return () => { if (socket) socket.disconnect(); };
    }, [roomCode, username]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!currentMsg.trim()) return;
        const msgData = {
            room: roomCode,
            author: username,
            message: currentMsg,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        socket.emit('send_message', msgData);
        setMessages(prev => [...prev, msgData]);
        setCurrentMsg("");
    };

    const handleKick = (userId, targetUsername) => {
        if (window.confirm(`Are you sure you want to dismiss ${targetUsername}?`)) {
            socket.emit('kick_user', { room: roomCode, userId });
        }
    };

    const handleInvite = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
    };

    const forceSync = () => {
        // Clear lastVideoRef so the next video_sync event (coming every 10s) will trigger a reload
        lastVideoRef.current = null;
    };

    const handleBack = () => {
        sessionStorage.removeItem('wp_room');
        sessionStorage.removeItem('wp_isHost');
        navigate('/party');
    };

    return (
        <div className="flex flex-col h-screen bg-background text-white overflow-y-auto custom-scrollbar">
            {/* Connection Error */}
            {connectionError && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 flex items-center justify-between shrink-0">
                    <p className="text-sm text-red-400 font-medium">Unable to connect to server. Watch Party features require the backend server to be running.</p>
                    <button onClick={() => navigate('/party')} className="shrink-0 px-4 py-1.5 bg-white/10 rounded-lg text-xs font-bold text-white hover:bg-white/20 transition">Go Back</button>
                </div>
            )}
            {/* Top Bar */}
            <div className="h-16 px-4 md:px-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-card/50 backdrop-blur-xl z-20">
                <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                    <button onClick={handleBack} className="p-2 hover:bg-white/5 rounded-xl transition text-textMuted hover:text-white shrink-0">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="h-6 w-[1px] bg-white/10 mx-1 md:mx-2 shrink-0"></div>
                    <div className="truncate">
                        <h1 className="text-sm md:text-lg font-black tracking-tighter flex items-center gap-2 truncate">
                            ROOM <span className="text-primary bg-primary/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-[12px] font-bold">{roomCode}</span>
                        </h1>
                        <div className="flex items-center gap-1.5 text-[7px] md:text-[9px] text-textMuted font-black uppercase tracking-widest whitespace-nowrap">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                            {viewers.length} Online
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isHost && playingVideo && (
                        <button
                            onClick={forceSync}
                            className="flex items-center gap-2 px-3 py-2 bg-accent/10 hover:bg-accent/20 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition border border-accent/20 text-accent"
                        >
                            <Check size={12} /> Sync
                        </button>
                    )}
                    <button
                        onClick={handleInvite}
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition border border-white/5 text-textMuted hover:text-white"
                    >
                        <Share2 size={12} /> <span className="hidden sm:inline">Invite</span>
                    </button>
                    {isHost && (
                        <Link to="/" className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-primary hover:bg-primaryDark text-background rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition shadow-lg shadow-primary/20">
                            <Film size={12} /> <span className="hidden sm:inline">Library</span>
                        </Link>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`p-2 rounded-xl transition ${isSidebarOpen ? 'bg-primary text-background' : 'bg-white/5 text-textMuted'}`}
                    >
                        <MessageCircle size={18} />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Main Content Area: Player or Waiting */}
                <div className="flex-1 flex flex-col min-w-0 bg-background relative">
                    {playingVideo ? (
                        <div className="flex-1 bg-black flex flex-col overflow-y-auto relative custom-scrollbar">
                            <Watch explicitType={playingVideo.type} explicitId={playingVideo.id} startTime={playingVideo.currentTime} partyRoom={roomCode} isHost={isHost} username={username} socket={socket} />

                            {/* Floating Overlay Toggle when Sidebar is closed */}
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className={`absolute bottom-6 right-6 z-[60] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all cursor-pointer ${isSidebarOpen ? 'bg-white text-black' : 'bg-primary text-background'}`}
                                title="Open Chat"
                            >
                                {isSidebarOpen ? <X size={24} /> : <MessageCircle size={24} />}
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center bg-background overflow-y-auto">
                            <div className="relative mb-6 md:mb-8 shrink-0">
                                <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full"></div>
                                <div className="relative w-20 h-20 md:w-24 md:h-24 bg-card border border-white/10 rounded-[28px] md:rounded-[32px] flex items-center justify-center text-primary shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                    <Loader2 className="animate-spin" size={32} />
                                </div>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-white">Select a Video</h2>
                            <p className="text-textMuted max-w-sm text-[11px] md:text-[13px] leading-relaxed">
                                {isHost
                                    ? "Browse the library and pick a movie or show to start the party."
                                    : "Waiting for the host to select a movie or show to play."}
                            </p>

                            {isHost && (
                                <div className="mt-8 md:mt-12 flex gap-3 md:gap-4 shrink-0">
                                    <Link to="/movies" className="px-6 md:px-10 py-3 md:py-4 bg-white text-black rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition">
                                        Movies
                                    </Link>
                                    <Link to="/anime" className="px-6 md:px-10 py-3 md:py-4 bg-primary/10 border border-primary/20 text-primary rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-primary/20 hover:scale-105 active:scale-95 transition">
                                        Anime
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar: Chat & Participants */}
                <div className={`
                    fixed md:relative inset-y-0 right-0 z-40 
                    w-full md:w-80 border-l border-white/10 bg-card/95 backdrop-blur-3xl flex flex-col shrink-0
                    transform transition-all duration-500 ease-in-out shadow-[-20px_0_40px_rgba(0,0,0,0.8)]
                    ${isSidebarOpen 
                        ? 'translate-y-0 md:translate-y-0 opacity-100' 
                        : 'translate-y-full md:translate-x-full md:translate-y-0 opacity-0 pointer-events-none md:w-0 md:opacity-0 md:border-none'
                    }
                    h-[60vh] md:h-full top-auto bottom-0 md:top-0 md:bottom-auto
                    rounded-t-[32px] md:rounded-none
                `}>
                    <div className="md:hidden w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-2 shrink-0" onClick={() => setIsSidebarOpen(false)}></div>
                    <div className="p-4 flex gap-2 border-b border-white/5">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition ${activeTab === 'chat' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'bg-white/5 text-textMuted hover:text-white'}`}
                        >
                            <MessageCircle size={14} /> Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition ${activeTab === 'info' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'bg-white/5 text-textMuted hover:text-white'}`}
                        >
                            <Users size={14} /> Viewers
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {activeTab === 'chat' ? (
                            <div className="h-full flex flex-col">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 md:space-y-6 custom-scrollbar pb-10">
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`flex flex-col ${msg.author === username ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-center gap-1.5 mb-1.5 px-1">
                                                <span className="text-[10px] font-bold text-textMuted/60">{msg.author}</span>
                                                <span className="text-[10px] text-textMuted/40">{msg.time}</span>
                                            </div>
                                            <div className={`px-4 py-2.5 md:py-3 rounded-2xl text-[10px] md:text-[11px] leading-relaxed max-w-[90%] font-bold ${msg.author === username ? 'bg-primary text-background' : 'bg-card text-white border border-white/5'}`}>
                                                {msg.message}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                <form onSubmit={handleSendMessage} className="p-4 bg-background/80 backdrop-blur-xl border-t border-white/5">
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={currentMsg}
                                            onChange={(e) => setCurrentMsg(e.target.value)}
                                            placeholder="Type a message..."
                                            className="w-full bg-card border border-white/5 text-white rounded-2xl py-3 pl-4 pr-12 outline-none focus:border-primary/50 transition text-[10px] md:text-[11px] font-bold"
                                        />
                                        <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-background transition hover:scale-110 active:scale-95">
                                            <Send size={14} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="p-4 space-y-4 h-full overflow-y-auto custom-scrollbar">
                                <p className="text-[11px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2">Online ({viewers.length})</p>
                                {viewers.map((u, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white/[0.03] p-3 rounded-2xl border border-white/5 group transition-all hover:bg-white/5">
                                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-card to-background flex items-center justify-center text-white font-black text-xs md:text-sm relative border border-white/10 group-hover:border-primary/50 transition-colors shadow-inner">
                                            {u.username.charAt(0).toUpperCase()}
                                            {u.isHost && (
                                                <div className="absolute -top-1 -right-1 bg-primary text-background p-0.5 rounded-full shadow-lg border-2 border-background">
                                                    <Users size={8} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate flex items-center gap-2">
                                                {u.username}
                                                {u.isHost && <span className="text-[7px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase font-bold">Host</span>}
                                            </p>
                                            <p className="text-[9px] text-textMuted font-medium uppercase tracking-wide opacity-60">Verified Member</p>
                                        </div>

                                        {isHost && !u.isHost && (
                                            <button
                                                onClick={() => handleKick(u.id, u.username)}
                                                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all transform scale-90 group-hover:scale-100"
                                                title="Remove User"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
