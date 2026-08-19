import { fetchApi, getImageUrl } from '../api';
import { searchSongs, getBestImage } from './musicApi';

/**
 * Universal Search Result Schema:
 * {
 *   id: string | number,
 *   mediaType: 'movie' | 'tv' | 'anime' | 'manga' | 'music',
 *   title: string,
 *   subtitle: string,
 *   poster: string,
 *   backdrop: string,
 *   year: string,
 *   rating: string | number,
 *   overview: string,
 *   provider: 'tmdb' | 'mangadex' | 'jikan' | 'saavn' | 'youtube',
 *   providerId: string | number,
 *   route: string,
 *   raw: any
 * }
 */

export function normalizeSearchResult(item, explicitCategory = null) {
    if (!item) return null;

    // 1. Check if Music
    if (explicitCategory === 'music' || item.downloadUrl || item.videoId || item.primaryArtists) {
        const id = item.id || item.videoId || Math.random().toString(36).substring(7);
        const title = item.name || item.title || 'Untitled Song';
        const artist = item.primaryArtists || item.artist || 'Artist';
        const poster = getBestImage(item.image || item.thumbnail);
        return {
            id,
            mediaType: 'music',
            title,
            subtitle: artist,
            poster,
            backdrop: poster,
            year: item.year || '',
            rating: '',
            overview: `Track by ${artist}`,
            provider: item.videoId ? 'youtube' : 'saavn',
            providerId: id,
            route: `/music`,
            raw: item
        };
    }

    // 2. Check if Manga
    if (explicitCategory === 'manga' || item.mal_id || item.type === 'Manga' || item.type === 'Manhwa' || item.type === 'Manhua') {
        const id = item.mal_id || item.id;
        const title = item.title || item.title_english || 'Untitled Manga';
        const poster = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || item.cover || 'https://placehold.co/300x450?text=No+Cover';
        const score = item.score ? String(item.score) : '8.5';
        const format = item.type || 'Manga';
        return {
            id,
            mediaType: 'manga',
            title,
            subtitle: `${format} • ${item.status || 'Ongoing'}`,
            poster,
            backdrop: poster,
            year: item.year ? String(item.year) : (item.published?.from ? item.published.from.slice(0, 4) : ''),
            rating: score,
            overview: item.synopsis || 'Read online manga scan chapters on SAMAKSH MOVIE.',
            provider: 'mangadex',
            providerId: id,
            route: `/manga/${id}`,
            raw: item
        };
    }

    // 3. TMDB & Anime Media
    const tmdbType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const isAnime = explicitCategory === 'anime' || 
                    (item.genre_ids && item.genre_ids.includes(16) && item.original_language === 'ja') ||
                    (item.origin_country && item.origin_country.includes('JP') && item.genre_ids?.includes(16));
    
    const mediaType = isAnime ? 'anime' : (tmdbType === 'tv' ? 'tv' : 'movie');
    const id = item.id;
    const title = item.title || item.name || item.original_title || item.original_name || 'Untitled';
    const poster = getImageUrl(item.poster_path, 'w500');
    const backdrop = getImageUrl(item.backdrop_path, 'w780');
    const date = (item.release_date || item.first_air_date || '').slice(0, 4);
    const vote = item.vote_average ? Number(item.vote_average).toFixed(1) : '7.5';

    // Route calculation: Watch page handles movies, tv shows, and anime series
    const watchType = (mediaType === 'movie' || (isAnime && !item.first_air_date && item.release_date)) ? 'movie' : 'tv';
    const route = `/watch/${watchType}/${id}`;

    return {
        id,
        mediaType,
        title,
        subtitle: `${mediaType.toUpperCase()} • ${date || 'Stream'}`,
        poster,
        backdrop,
        year: date,
        rating: vote,
        overview: item.overview || 'Stream and watch instantly on SAMAKSH MOVIE.',
        provider: 'tmdb',
        providerId: id,
        route,
        raw: item
    };
}

/**
 * Universal Multi-Engine Search
 * Fetches from TMDB, Manga, and Music concurrently and returns structured results
 */
export async function executeUniversalSearch(query, category = 'all') {
    if (!query || !query.trim()) {
        return { all: [], movies: [], tv: [], anime: [], manga: [], music: [] };
    }

    const cleanQuery = query.trim();
    const results = {
        all: [],
        movies: [],
        tv: [],
        anime: [],
        manga: [],
        music: []
    };

    const promises = [];

    // 1. TMDB Multi Search (Movies & TV & Anime)
    if (category === 'all' || category === 'movies' || category === 'tv' || category === 'anime') {
        promises.push(
            fetchApi('/search/multi', { query: cleanQuery, include_adult: false })
                .then(data => {
                    if (data && Array.isArray(data.results)) {
                        data.results.forEach(item => {
                            if (item.media_type === 'person') return;
                            const normalized = normalizeSearchResult(item);
                            if (!normalized) return;

                            if (normalized.mediaType === 'movie') {
                                results.movies.push(normalized);
                            } else if (normalized.mediaType === 'tv') {
                                results.tv.push(normalized);
                            } else if (normalized.mediaType === 'anime') {
                                results.anime.push(normalized);
                            }
                        });
                    }
                })
                .catch(err => console.warn('TMDB search error:', err))
        );
    }

    // 2. Manga Search (Backend / Jikan / MangaDex)
    if (category === 'all' || category === 'manga') {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
        promises.push(
            fetch(`${backendUrl}/api/manga/search?q=${encodeURIComponent(cleanQuery)}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    const list = data?.data || [];
                    list.slice(0, 12).forEach(item => {
                        const normalized = normalizeSearchResult(item, 'manga');
                        if (normalized) results.manga.push(normalized);
                    });
                })
                .catch(err => console.warn('Manga search error:', err))
        );
    }

    // 3. Music Search (Saavn / YouTube Music)
    if (category === 'all' || category === 'music') {
        promises.push(
            searchSongs(cleanQuery)
                .then(data => {
                    const list = data?.results || [];
                    list.slice(0, 12).forEach(item => {
                        const normalized = normalizeSearchResult(item, 'music');
                        if (normalized) results.music.push(normalized);
                    });
                })
                .catch(err => console.warn('Music search error:', err))
        );
    }

    await Promise.allSettled(promises);

    // Build unified "all" list interweaving best results
    results.all = [
        ...results.movies.slice(0, 6),
        ...results.tv.slice(0, 6),
        ...results.anime.slice(0, 6),
        ...results.manga.slice(0, 6),
        ...results.music.slice(0, 6)
    ];

    return results;
}
