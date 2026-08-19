export const API_KEY = '8265bd1679663a7ea12ac168da84d2e8';
// Using api.tmdb.org instead of api.themoviedb.org to avoid ISP blocking !
export const BASE_URL = 'https://api.tmdb.org/3';
export const IMG_URL = 'https://image.tmdb.org/t/p/';

export const fetchApi = async (path, params = {}) => {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set('api_key', API_KEY);
    const userLang = localStorage.getItem('app_lang') || 'en-US';
    url.searchParams.set('language', userLang);
    Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));

    try {
        const res = await fetch(url.toString());
        const data = await res.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
};

export const getImageUrl = (path, size = 'w342') => {
    if (!path) return 'https://placehold.co/160x240?text=No+Image';
    return `${IMG_URL}${size}${path}`;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Global Queue for Jikan to prevent 429 Parallel Hits
let jikanQueue = Promise.resolve();

// Manga Engine API via Dedicated Backend Proxy (Zero direct client-side external hits)
export const fetchMangaPopular = async () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    try {
        const res = await fetch(`${backendUrl}/api/manga/popular`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn('fetchMangaPopular backend error:', e);
    }
    return { data: [] };
};

export const fetchMangaTrending = async () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    try {
        const res = await fetch(`${backendUrl}/api/manga/trending`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn('fetchMangaTrending backend error:', e);
    }
    return { data: [] };
};

export const fetchMangaLatest = async () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    try {
        const res = await fetch(`${backendUrl}/api/manga/latest`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn('fetchMangaLatest backend error:', e);
    }
    return { data: [] };
};

export const fetchMangaDetails = async (id) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    try {
        const res = await fetch(`${backendUrl}/api/manga/details?id=${encodeURIComponent(id)}`);
        if (res.ok) {
            const data = await res.json();
            return data.data || data;
        }
    } catch (e) {
        console.warn('fetchMangaDetails backend error:', e);
    }
    return null;
};

export const fetchMangaChapters = async (id, title = '') => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    try {
        const queryParams = new URLSearchParams({ id: id || '' });
        if (title) queryParams.set('title', title);
        const res = await fetch(`${backendUrl}/api/manga/feed?${queryParams.toString()}`);
        if (res.ok) {
            const data = await res.json();
            return data;
        }
    } catch (e) {
        console.warn('fetchMangaChapters backend error:', e);
    }
    return { data: [], mangadexId: null, total: 0 };
};

export const fetchMangaPages = async (chapterId) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    try {
        const res = await fetch(`${backendUrl}/api/manga/pages?id=${encodeURIComponent(chapterId)}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('fetchMangaPages backend error:', e);
    }
    return { pages: [], total: 0 };
};

export const fetchMangaSearch = async (query, genre = '') => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (genre) params.set('genre', genre);
        const res = await fetch(`${backendUrl}/api/manga/search?${params.toString()}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('fetchMangaSearch backend error:', e);
    }
    return { data: [] };
};

export const fetchManga = async (path, params = {}) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    
    if (path === '/top/manga' || path.startsWith('/top/manga')) {
        const filter = params.filter;
        const endpoint = filter === 'publishing' ? '/api/manga/trending' : '/api/manga/popular';
        try {
            const res = await fetch(`${backendUrl}${endpoint}`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('fetchManga proxy error:', e);
        }
    }

    if (path === '/manga' && !params.q) {
        try {
            const res = await fetch(`${backendUrl}/api/manga/popular`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('fetchManga popular proxy error:', e);
        }
    }

    if (path === '/manga' && params.q) {
        try {
            const res = await fetch(`${backendUrl}/api/manga/search?q=${encodeURIComponent(params.q)}`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('fetchManga search proxy error:', e);
        }
    }

    if (path.startsWith('/manga/')) {
        const idMatch = path.match(/\/manga\/([^/]+)/);
        if (idMatch && idMatch[1]) {
            try {
                const res = await fetch(`${backendUrl}/api/manga/details?id=${encodeURIComponent(idMatch[1])}`);
                if (res.ok) return await res.json();
            } catch (e) {
                console.warn('fetchManga details proxy error:', e);
            }
        }
    }

    return { data: [] };
};

export const fetchYouTube = async (query) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    try {
        const res = await fetch(`${backendUrl}/api/youtube?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`YouTube API returned status ${res.status}`);
        const data = await res.json();
        return data || [];
    } catch (error) {
        console.error('YouTube Fetch Error:', error);
        return [];
    }
};
