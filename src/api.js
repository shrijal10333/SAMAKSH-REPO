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

// Manga Engine API via Dedicated Backend Proxy
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

export const fetchManga = async (path, params = {}, retryCount = 0) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
    
    // Check if we have dedicated backend proxy routes for common manga queries
    if (path === '/top/manga' || path.startsWith('/top/manga')) {
        const filter = params.filter;
        const endpoint = filter === 'publishing' ? '/api/manga/trending' : '/api/manga/popular';
        try {
            const res = await fetch(`${backendUrl}${endpoint}`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('Backend proxy failed, attempting Jikan fallback:', e);
        }
    }

    if (path === '/manga' && !params.q && (params.type || params.order_by)) {
        try {
            const res = await fetch(`${backendUrl}/api/manga/popular`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('Backend proxy failed, attempting Jikan fallback:', e);
        }
    }

    if (path === '/manga' && params.q) {
        try {
            const res = await fetch(`${backendUrl}/api/manga/search?q=${encodeURIComponent(params.q)}`);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn('Backend search proxy failed:', e);
        }
    }

    if (path.startsWith('/manga/') && path.includes('/full')) {
        const idMatch = path.match(/\/manga\/([^/]+)\/full/);
        if (idMatch && idMatch[1]) {
            try {
                const res = await fetch(`${backendUrl}/api/manga/details?id=${encodeURIComponent(idMatch[1])}`);
                if (res.ok) return await res.json();
            } catch (e) {
                console.warn('Backend details proxy failed:', e);
            }
        }
    }

    return (jikanQueue = jikanQueue.then(async () => {
        const url = new URL(`https://api.jikan.moe/v4${path}`);
        Object.keys(params).forEach(key => url.searchParams.set(key, params[key]));

        try {
            const res = await fetch(url.toString());
            await delay(400);

            if (res.status === 429 && retryCount < 3) {
                console.warn(`Jikan 429 Rate Limit. Backing off retry ${retryCount + 1}...`);
                await delay(1500 * (retryCount + 1));
                return fetchManga(path, params, retryCount + 1);
            }

            const data = await res.json();
            return data;
        } catch (error) {
            console.error('Manga API Error:', error);
            return null;
        }
    }));
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
