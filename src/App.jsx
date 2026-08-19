import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MusicPlayer from './components/MusicPlayer';
import { AuthProvider } from './context/AuthContext';
import { MusicProvider } from './context/MusicContext';

// Pages
import Home from './pages/Home';
import Movies from './pages/Movies';
import TVShows from './pages/TVShows';
import Anime from './pages/Anime';
import Manga from './pages/Manga';
import MangaDetails from './pages/MangaDetails';
import MangaReader from './pages/MangaReader';
import Music from './pages/Music';
import NowPlaying from './pages/NowPlaying';
import Feed from './pages/Feed';
import Channels from './pages/Channels';
import WatchPartyLobby from './pages/WatchPartyLobby';
import PartyRoomWaiting from './pages/PartyRoomWaiting';
import Premium4K from './pages/Premium4K';
import Search from './pages/Search';
import MyList from './pages/MyList';
import History from './pages/History';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import OttHub from './pages/OttHub';
import OttPage from './pages/OttPage';
import Watch from './pages/Watch';
import LiveF1 from './pages/LiveF1';
import LiveCricket from './pages/LiveCricket';
import LiveEsports from './pages/LiveEsports';

function Layout({ children }) {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Close mobile sidebar on route change
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Check if the current route is an immersive full-screen view (like Reader or Watch)
    const isImmersive = location.pathname.startsWith('/manga/read') || 
                        location.pathname.startsWith('/manga/reader') || 
                        location.pathname.startsWith('/watch');

    return (
        <div className="min-h-screen bg-[#080808] text-white flex flex-col antialiased selection:bg-[#1db954] selection:text-black">
            {/* Hidden audio iframe for background YouTube music engine */}
            <div id="yt-music-player-hidden" className="hidden pointer-events-none" aria-hidden="true"></div>

            {/* Sidebar Navigation */}
            {!isImmersive && (
                <>
                    {/* Desktop Sidebar */}
                    <Sidebar 
                        isOpen={true} 
                        className="fixed top-0 left-0 bottom-0 w-64 hidden md:flex" 
                    />

                    {/* Mobile Sidebar Overlay */}
                    {isSidebarOpen && (
                        <div 
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] md:hidden transition-opacity"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                    )}

                    {/* Mobile Sidebar Drawer */}
                    <div className={`fixed top-0 bottom-0 left-0 w-72 z-[160] md:hidden transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                        <Sidebar isOpen={isSidebarOpen} className="h-full w-full" />
                    </div>
                </>
            )}

            {/* Navbar Header */}
            {!isImmersive && (
                <Navbar 
                    onMenuClick={() => setIsSidebarOpen(prev => !prev)} 
                    isSidebarHidden={isImmersive} 
                />
            )}

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col ${!isImmersive ? 'md:pl-64 pt-16 md:pt-20' : ''}`}>
                <main className="flex-1">
                    {children}
                </main>
            </div>

            {/* Persistent Global Floating Music Player */}
            <MusicPlayer />
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <MusicProvider>
                <Router>
                    <Layout>
                        <Routes>
                            {/* Main Hub */}
                            <Route path="/" element={<Home />} />
                            
                            {/* Video & Media */}
                            <Route path="/movies" element={<Movies />} />
                            <Route path="/tv" element={<TVShows />} />
                            <Route path="/anime" element={<Anime />} />
                            <Route path="/feed" element={<Feed />} />
                            <Route path="/4k" element={<Premium4K />} />
                            <Route path="/search" element={<Search />} />
                            <Route path="/watch/:type/:id" element={<Watch />} />
                            
                            {/* Manga Engine */}
                            <Route path="/manga" element={<Manga />} />
                            <Route path="/manga/:id" element={<MangaDetails />} />
                            <Route path="/manga/details/:id" element={<MangaDetails />} />
                            <Route path="/manga/read/:id" element={<MangaReader />} />
                            <Route path="/manga/read/:id/:chapterId" element={<MangaReader />} />
                            <Route path="/manga/reader/:id/:chapterId" element={<MangaReader />} />

                            {/* Music Hub */}
                            <Route path="/music" element={<Music />} />
                            <Route path="/nowplaying" element={<NowPlaying />} />

                            {/* Live & OTT */}
                            <Route path="/channels" element={<Channels />} />
                            <Route path="/ott" element={<OttHub />} />
                            <Route path="/ott/:id" element={<OttPage />} />
                            <Route path="/live/f1" element={<LiveF1 />} />
                            <Route path="/live/cricket" element={<LiveCricket />} />
                            <Route path="/live/esports" element={<LiveEsports />} />

                            {/* Social & Party */}
                            <Route path="/party" element={<WatchPartyLobby />} />
                            <Route path="/party/:roomCode" element={<PartyRoomWaiting />} />
                            <Route path="/party/room/:roomCode" element={<PartyRoomWaiting />} />

                            {/* User Profile & Library */}
                            <Route path="/mylist" element={<MyList />} />
                            <Route path="/history" element={<History />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/auth" element={<Auth />} />

                            {/* Fallback route */}
                            <Route path="*" element={<Home />} />
                        </Routes>
                    </Layout>
                </Router>
            </MusicProvider>
        </AuthProvider>
    );
}
