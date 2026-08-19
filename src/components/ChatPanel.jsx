import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, Users, X } from 'lucide-react';

let socket;

export default function ChatPanel({ room, onClose }) {
    const [messages, setMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState("");
    const [username, setUsername] = useState("");
    const [joined, setJoined] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        socket = io(import.meta.env.VITE_API_URL || undefined);

        socket.on('receive_message', (data) => {
            setMessages((list) => [...list, data]);
        });

        return () => socket.disconnect();
    }, []);

    const joinRoom = (e) => {
        e.preventDefault();
        if (username.trim()) {
            socket.emit('join_room', { room, username });
            setJoined(true);
            setMessages([{
                author: 'System',
                message: 'You have joined the Watch Party!',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (currentMessage.trim()) {
            const messageData = {
                room: room,
                author: username,
                message: currentMessage,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            await socket.emit('send_message', messageData);
            setMessages((list) => [...list, messageData]);
            setCurrentMessage("");
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="w-full bg-background flex flex-col h-full">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-card">
                <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-[0.2em]">
                    <Users size={18} className="text-primary" />
                    Chat <span className="text-[10px] bg-background/50 px-2.5 py-1 rounded-full text-textMuted tracking-normal lowercase">{room}</span>
                </h3>
                <button onClick={onClose} className="text-textMuted hover:text-white transition"><X size={18} /></button>
            </div>

            {!joined ? (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-[24px] flex items-center justify-center mb-6 text-primary shadow-inner">
                        <Users size={32} />
                    </div>
                    <h4 className="text-white font-bold text-lg mb-2 uppercase tracking-tighter">Join Chat</h4>
                    <p className="text-[11px] text-textMuted font-medium uppercase tracking-wider leading-relaxed mb-10">Enter your name to start chatting.</p>
                    <form onSubmit={joinRoom} className="w-full flex flex-col gap-4">
                        <input
                            type="text"
                            placeholder="Your name..."
                            disabled={joined}
                            className="bg-card border border-white/5 text-white text-xs font-black uppercase tracking-widest rounded-2xl p-4 outline-none focus:border-primary/50 text-center"
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <button type="submit" className="bg-primary hover:bg-primaryDark text-background font-bold text-xs uppercase tracking-wider py-4 rounded-2xl transition shadow-xl shadow-primary/20 active:scale-95">Join Chat</button>
                    </form>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-background/50 custom-scrollbar pb-10">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.author === username ? 'items-end' : 'items-start'}`}>
                                <span className="text-[8px] text-textMuted/60 mb-1.5 font-black uppercase tracking-widest italic">{msg.author} • {msg.time}</span>
                                <div className={`px-4 py-3 rounded-2xl text-[11px] font-bold max-w-[85%] leading-relaxed ${msg.author === 'System' ? 'bg-primary/5 text-primary w-full text-center text-[9px] uppercase tracking-[0.2em] border border-primary/10' : msg.author === username ? 'bg-primary text-background shadow-lg shadow-primary/10' : 'bg-card text-white border border-white/5'}`}>
                                    {msg.message}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={sendMessage} className="p-3 border-t border-white/5 bg-card flex gap-2">
                        <input
                            type="text"
                            value={currentMessage}
                            placeholder="Type a message..."
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            className="flex-1 bg-background border border-white/5 text-white text-[11px] font-bold rounded-full px-5 outline-none focus:border-primary/50"
                        />
                        <button type="submit" className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-background hover:bg-primaryDark transition flex-shrink-0 shadow-lg shadow-primary/20">
                            <Send size={16} className="-ml-1" />
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}
