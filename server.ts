import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import ytSearch from 'yt-search';
import { createServer as createViteServer } from 'vite';

interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  avatar: string;
  slogan: string;
}

interface RoomMedia {
  type?: string;
  id?: string | number;
  title?: string;
  poster_path?: string;
  backdrop_path?: string;
  season?: number;
  episode?: number;
  [key: string]: any;
}

interface ActiveRoom {
  id: string;
  roomName: string;
  hostName: string;
  password?: string;
  viewers: number;
  users: Record<string, string>;
  media?: RoomMedia | null;
  playing?: RoomMedia | null;
  currentTime: number;
  isPlaying: boolean;
  lastTimeUpdate: number;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());

  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-sxrverse-key-1234';

  // ── Pure-JS JSON "Database" ──────────────────────────────────
  const DB_PATH = path.join(process.cwd(), 'data', 'users.json');
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  let users: User[] = [];
  if (fs.existsSync(DB_PATH)) {
    try {
      users = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
      users = [];
    }
  }

  const saveUsers = () => {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
    } catch (err) {
      console.error('Failed to save users:', err);
    }
  };

  const findByEmail = (email: string) => users.find((u) => u.email === email);

  const createUser = (name: string, email: string, hashedPassword: string): User => {
    const id = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
    const user: User = { id, name, email, password: hashedPassword, avatar: '', slogan: '' };
    users.push(user);
    saveUsers();
    return user;
  };

  console.log(`SXRverse DB loaded — ${users.length} users.`);

  // ── Auth Routes ─────────────────────────────────────────────────────────────
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (findByEmail(email)) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = createUser(name, email, hashedPassword);

      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ user: { id: user.id, name, email, avatar: '', slogan: '' }, token });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = findByEmail(email);
      if (!user || !user.password) return res.status(400).json({ error: 'Invalid credentials' });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.json({
        user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar || '', slogan: user.slogan || '' },
        token,
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.put('/api/auth/profile', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No token provided' });

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
      const user = users.find((u) => u.id === decoded.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { name, avatar, slogan } = req.body;
      if (name !== undefined) user.name = name;
      if (avatar !== undefined) user.avatar = avatar;
      if (slogan !== undefined) user.slogan = slogan;
      saveUsers();

      res.json({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar || '', slogan: user.slogan || '' } });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ── Watch Party Rooms ───────────────────────────────────────────────────────
  const activeRooms: Record<string, ActiveRoom> = {};

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  app.post('/api/rooms', (req: Request, res: Response) => {
    const { roomName, host, password, media } = req.body;
    let roomId = '';
    do {
      roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (activeRooms[roomId]);

    activeRooms[roomId] = {
      id: roomId,
      roomName: roomName || `${host}'s Room`,
      hostName: host,
      password: password || '',
      viewers: 0,
      users: {},
      media: media,
      playing: media || null,
      currentTime: 0,
      isPlaying: false,
      lastTimeUpdate: Date.now(),
    };

    const publicRooms = Object.values(activeRooms).map((r) => ({
      id: r.id,
      roomName: r.roomName,
      host: r.hostName,
      hasPassword: !!r.password,
      viewers: r.viewers,
      media: r.media,
    }));
    io.emit('rooms_updated', publicRooms);

    // Purge unjoined rooms after 60 seconds
    setTimeout(() => {
      if (activeRooms[roomId] && activeRooms[roomId].viewers <= 0) {
        console.log(`Self-purging unjoined room: ${roomId}`);
        delete activeRooms[roomId];
        const updated = Object.values(activeRooms).map((r) => ({
          id: r.id,
          roomName: r.roomName,
          host: r.hostName,
          hasPassword: !!r.password,
          viewers: r.viewers,
          media: r.media,
        }));
        io.emit('rooms_updated', updated);
      }
    }, 60000);

    res.json({
      success: true,
      room: { id: roomId, roomName: activeRooms[roomId].roomName, host, hasPassword: !!password },
    });
  });

  app.get('/api/rooms', (req: Request, res: Response) => {
    const publicRooms = Object.values(activeRooms).map((r) => ({
      id: r.id,
      roomName: r.roomName,
      host: r.hostName,
      hasPassword: !!r.password,
      viewers: r.viewers,
      media: r.media,
    }));
    res.json(publicRooms);
  });

  app.post('/api/rooms/verify', (req: Request, res: Response) => {
    const { room, password } = req.body;
    if (!activeRooms[room]) return res.status(404).json({ error: 'Room not found' });
    if (activeRooms[room].password && activeRooms[room].password !== password) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    res.json({ success: true });
  });

  // ── YouTube Search API ──────────────────────────────────────────────────────
  app.get('/api/youtube', async (req: Request, res: Response) => {
    try {
      const q = req.query.q as string;
      if (!q || !q.trim()) return res.status(400).json({ error: 'Query string q is required' });

      const youtubeApiKey = process.env.YOUTUBE_API_KEY;

      if (youtubeApiKey) {
        // Official YouTube Data API v3
        try {
          const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(
            q + ' audio song music'
          )}&type=video&key=${youtubeApiKey}`;
          const ytRes = await fetch(ytUrl);
          if (ytRes.ok) {
            const data = (await ytRes.json()) as any;
            const videos = (data.items || []).map((item: any) => ({
              id: item.id?.videoId,
              videoId: item.id?.videoId,
              name: item.snippet?.title?.replace(/&quot;/g, '"')?.replace(/&#39;/g, "'") || 'Untitled Track',
              title: item.snippet?.title?.replace(/&quot;/g, '"')?.replace(/&#39;/g, "'") || 'Untitled Track',
              primaryArtists: item.snippet?.channelTitle || 'Artist',
              thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
              image: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
              duration: 210,
              url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
            }));
            return res.json(videos);
          }
        } catch (apiErr) {
          console.warn('YouTube API call failed, falling back to yt-search:', apiErr);
        }
      }

      // Backend search fallback using yt-search
      const r = await ytSearch(q + ' music audio');
      const videos = (r && r.videos ? r.videos.slice(0, 20) : []).map((v) => ({
        id: v.videoId,
        videoId: v.videoId,
        name: v.title,
        title: v.title,
        primaryArtists: v.author?.name || 'Artist',
        thumbnail: v.thumbnail,
        image: v.thumbnail,
        timestamp: v.timestamp,
        duration: v.seconds || 200,
        views: v.views,
        url: v.url,
      }));
      res.json(videos);
    } catch (error) {
      console.error('YouTube Search API Error:', error);
      res.status(500).json({ error: 'Failed to search YouTube music catalog' });
    }
  });

  // ── Manga Engine Cache & Deduplicated Proxy Architecture ─────────────────────
  interface CacheEntry {
    data: any;
    expiry: number;
    staleUntil: number;
  }
  const mangaCache: Record<string, CacheEntry> = {};
  const inFlightRequests = new Map<string, Promise<any>>();

  const getCachedEntry = (key: string) => {
    const item = mangaCache[key];
    if (!item) return null;
    const isFresh = item.expiry > Date.now();
    const isUsableStale = item.staleUntil > Date.now();
    return { data: item.data, isFresh, isUsableStale };
  };

  const setCachedEntry = (key: string, data: any, ttlSeconds = 600, staleGraceMultiplier = 4) => {
    const now = Date.now();
    mangaCache[key] = {
      data,
      expiry: now + ttlSeconds * 1000,
      staleUntil: now + ttlSeconds * staleGraceMultiplier * 1000,
    };
  };

  const deduplicate = <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key) as Promise<T>;
    }
    const promise = (async () => {
      try {
        return await fetcher();
      } finally {
        inFlightRequests.delete(key);
      }
    })();
    inFlightRequests.set(key, promise);
    return promise;
  };

  const fetchWithRetry = async (url: string, options: any = {}, maxRetries = 2, baseDelay = 500) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.status === 429) {
          const retryAfterSec = parseInt(res.headers.get('retry-after') || '2', 10);
          console.warn(`Upstream 429 rate limit on ${url}. Backoff attempt ${attempt + 1}/${maxRetries}`);
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, Math.max(retryAfterSec * 1000, baseDelay * (attempt + 1))));
            continue;
          }
        }
        return res;
      } catch (err) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Exhausted retries for ${url}`);
  };

  // Helper: Normalize MangaDex manga entity into standard app schema
  const normalizeMangaDex = (m: any) => {
    const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art');
    const coverFileName = coverRel?.attributes?.fileName;
    const coverUrl = coverFileName
      ? `https://uploads.mangadex.org/covers/${m.id}/${coverFileName}.512.jpg`
      : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';

    const titleObj = m.attributes?.title || {};
    const mainTitle = titleObj.en || titleObj['ja-ro'] || Object.values(titleObj)[0] || 'Unknown Manga';
    
    // Alt / Japanese titles
    const engAlt = m.attributes?.altTitles?.find((t: any) => t.en)?.en || mainTitle;
    const japAlt = m.attributes?.altTitles?.find((t: any) => t.ja || t['ja-ro']) || {};
    const japTitle = Object.values(japAlt)[0] || '';

    const descObj = m.attributes?.description || {};
    const synopsis = descObj.en || Object.values(descObj)[0] || '';

    const authorRel = m.relationships?.find((r: any) => r.type === 'author');
    const artistRel = m.relationships?.find((r: any) => r.type === 'artist');
    const authors = [
      authorRel?.attributes?.name ? { name: authorRel.attributes.name } : null,
      artistRel?.attributes?.name && artistRel?.attributes?.name !== authorRel?.attributes?.name ? { name: artistRel.attributes.name } : null
    ].filter(Boolean);

    const origLang = m.attributes?.originalLanguage;
    const typeStr = origLang === 'ko' ? 'Manhwa' : origLang === 'zh' ? 'Manhua' : 'Manga';

    return {
      id: m.id,
      provider: 'mangadex',
      providerId: m.id,
      mangadexId: m.id,
      mal_id: m.id,
      title: mainTitle,
      title_english: engAlt || mainTitle,
      title_japanese: japTitle || '',
      type: typeStr,
      status: m.attributes?.status === 'ongoing' ? 'Publishing' : 'Completed',
      synopsis,
      images: {
        jpg: {
          large_image_url: coverUrl,
          image_url: coverUrl,
        }
      },
      score: (m.attributes?.rating?.bayesian || 8.4).toFixed(1),
      chapters: m.attributes?.lastChapter || '??',
      volumes: m.attributes?.lastVolume || '??',
      authors: authors.length > 0 ? authors : [{ name: 'Unknown Creator' }],
      genres: (m.attributes?.tags || []).slice(0, 8).map((t: any) => ({ name: t.attributes?.name?.en })).filter((g: any) => g.name),
      demographics: m.attributes?.publicationDemographic ? [{ name: m.attributes.publicationDemographic.toUpperCase() }] : [{ name: 'General' }],
    };
  };

  // Helper: Find MangaDex UUID by title
  const resolveMangaDexId = async (title: string): Promise<string | null> => {
    if (!title || !title.trim()) return null;
    const cleanTitle = title.replace(/\((Manga|TV|Light Novel|Movie|Manhwa|Manhua)\)/gi, '').trim();
    const cacheKey = `md_resolve_${cleanTitle.toLowerCase()}`;
    const cached = getCachedEntry(cacheKey);
    if (cached && (cached.isFresh || cached.isUsableStale)) return cached.data;

    return deduplicate(cacheKey, async () => {
      try {
        const searchRes = await fetchWithRetry(
          `https://api.mangadex.org/manga?title=${encodeURIComponent(cleanTitle)}&limit=3&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`
        );
        if (searchRes.ok) {
          const json = await searchRes.json() as any;
          if (json.data && json.data.length > 0) {
            const matchedId = json.data[0].id;
            setCachedEntry(cacheKey, matchedId, 86400); // 24h
            return matchedId;
          }
        }
      } catch (e) {
        console.warn('resolveMangaDexId error:', e);
      }
      return null;
    });
  };

  // 1. Manga Details Endpoint
  app.get('/api/manga/details', async (req: Request, res: Response) => {
    try {
      const rawParam = (req.query.id as string || '').trim();
      if (!rawParam) return res.status(400).json({ error: 'Manga ID is required' });

      // Clean ID and determine provider prefix if present (e.g. "mangadex:uuid" or "jikan:123")
      let provider = 'auto';
      let cleanId = rawParam;
      if (rawParam.startsWith('mangadex:')) {
        provider = 'mangadex';
        cleanId = rawParam.replace('mangadex:', '');
      } else if (rawParam.startsWith('jikan:')) {
        provider = 'jikan';
        cleanId = rawParam.replace('jikan:', '');
      }

      const cacheKey = `manga_detail_${cleanId}`;
      const cached = getCachedEntry(cacheKey);
      if (cached && cached.isFresh) {
        return res.json({ data: cached.data, cached: true });
      }

      const result = await deduplicate(cacheKey, async () => {
        const isNumeric = /^\d+$/.test(cleanId);

        if (provider === 'mangadex' || (!isNumeric && provider !== 'jikan')) {
          // Fetch from MangaDex by UUID
          try {
            const mdRes = await fetchWithRetry(`https://api.mangadex.org/manga/${cleanId}?includes[]=cover_art&includes[]=author&includes[]=artist`);
            if (mdRes.ok) {
              const mdJson = await mdRes.json() as any;
              if (mdJson.data) {
                const normalized = normalizeMangaDex(mdJson.data);
                setCachedEntry(cacheKey, normalized, 3600);
                return normalized;
              }
            }
          } catch (mdErr) {
            console.warn(`MangaDex fetch for UUID ${cleanId} failed:`, mdErr);
          }
        }

        // Fetch from Jikan for numeric MAL IDs or secondary fallback
        if (isNumeric || provider === 'jikan') {
          try {
            const jikanRes = await fetchWithRetry(`https://api.jikan.moe/v4/manga/${cleanId}/full`);
            if (jikanRes.ok) {
              const jikanJson = await jikanRes.json() as any;
              if (jikanJson.data) {
                const jData = jikanJson.data;
                const mainTitle = jData.title_english || jData.title || 'Unknown Manga';
                const resolvedMdId = await resolveMangaDexId(mainTitle) || await resolveMangaDexId(jData.title);

                const normalized = {
                  id: jData.mal_id,
                  mal_id: jData.mal_id,
                  provider: 'jikan',
                  providerId: jData.mal_id,
                  mangadexId: resolvedMdId,
                  title: jData.title,
                  title_english: jData.title_english || jData.title,
                  title_japanese: jData.title_japanese || '',
                  type: jData.type || 'Manga',
                  status: jData.status || 'Publishing',
                  synopsis: jData.synopsis || 'No synopsis provided.',
                  score: jData.score ? jData.score.toFixed(1) : '8.5',
                  rank: jData.rank || null,
                  chapters: jData.chapters || '??',
                  volumes: jData.volumes || '??',
                  images: {
                    jpg: {
                      large_image_url: jData.images?.jpg?.large_image_url || jData.images?.jpg?.image_url,
                      image_url: jData.images?.jpg?.image_url,
                    }
                  },
                  authors: (jData.authors || []).map((a: any) => ({ name: a.name, mal_id: a.mal_id })),
                  genres: (jData.genres || []).map((g: any) => ({ name: g.name, mal_id: g.mal_id })),
                  demographics: (jData.demographics || []).map((d: any) => ({ name: d.name })),
                };

                setCachedEntry(cacheKey, normalized, 3600);
                return normalized;
              }
            }
          } catch (jikanErr) {
            console.warn(`Jikan fetch for ID ${cleanId} failed:`, jikanErr);
          }
        }

        // Fallback search MangaDex by title / text query
        try {
          const fallbackSearch = await fetchWithRetry(`https://api.mangadex.org/manga?title=${encodeURIComponent(cleanId)}&limit=1&includes[]=cover_art&includes[]=author`);
          if (fallbackSearch.ok) {
            const fbJson = await fallbackSearch.json() as any;
            if (fbJson.data && fbJson.data.length > 0) {
              const normalized = normalizeMangaDex(fbJson.data[0]);
              setCachedEntry(cacheKey, normalized, 3600);
              return normalized;
            }
          }
        } catch (fbErr) {
          console.warn('Fallback search error:', fbErr);
        }

        return null;
      });

      if (result) {
        return res.json({ data: result });
      }

      // Serve stale cache if available when upstream fails
      if (cached && cached.isUsableStale) {
        return res.json({ data: cached.data, cached: true, isStale: true, notice: 'Showing recently cached results' });
      }

      return res.status(404).json({ error: 'Manga not found in catalog' });
    } catch (err) {
      console.error('Manga Details API Error:', err);
      // Last-ditch check for any cache
      const cached = getCachedEntry(`manga_detail_${(req.query.id as string || '').trim()}`);
      if (cached && cached.data) {
        return res.json({ data: cached.data, cached: true, isStale: true, notice: 'Showing recently cached results' });
      }
      res.status(500).json({ error: 'Internal server error while fetching manga details' });
    }
  });

  // 2. Popular Manga
  app.get('/api/manga/popular', async (req: Request, res: Response) => {
    const cacheKey = 'manga_popular';
    const cached = getCachedEntry(cacheKey);
    if (cached && cached.isFresh) return res.json({ ...cached.data, cached: true });

    try {
      const data = await deduplicate(cacheKey, async () => {
        try {
          const mdRes = await fetchWithRetry(
            'https://api.mangadex.org/manga?limit=24&order[followedCount]=desc&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive'
          );
          if (mdRes.ok) {
            const mdData = await mdRes.json() as any;
            const normalized = {
              data: (mdData.data || []).map(normalizeMangaDex),
            };
            setCachedEntry(cacheKey, normalized, 900);
            return normalized;
          }
        } catch (mdErr) {
          console.warn('MangaDex popular failed, trying Jikan:', mdErr);
        }

        // Jikan Fallback
        const jikanRes = await fetchWithRetry('https://api.jikan.moe/v4/top/manga?limit=18&filter=bypopularity');
        if (jikanRes.ok) {
          const jData = await jikanRes.json();
          setCachedEntry(cacheKey, jData, 900);
          return jData;
        }
        throw new Error('All popular providers failed');
      });

      return res.json(data);
    } catch (err) {
      if (cached && cached.isUsableStale) {
        return res.json({ ...cached.data, cached: true, isStale: true, notice: 'Showing recently cached results' });
      }
      res.status(502).json({ error: 'Unable to fetch popular manga right now' });
    }
  });

  // 3. Trending Manga
  app.get('/api/manga/trending', async (req: Request, res: Response) => {
    const cacheKey = 'manga_trending';
    const cached = getCachedEntry(cacheKey);
    if (cached && cached.isFresh) return res.json({ ...cached.data, cached: true });

    try {
      const data = await deduplicate(cacheKey, async () => {
        try {
          const mdRes = await fetchWithRetry(
            'https://api.mangadex.org/manga?limit=18&order[rating]=desc&order[followedCount]=desc&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive'
          );
          if (mdRes.ok) {
            const mdData = await mdRes.json() as any;
            const normalized = {
              data: (mdData.data || []).map(normalizeMangaDex),
            };
            setCachedEntry(cacheKey, normalized, 900);
            return normalized;
          }
        } catch (mdErr) {
          console.warn('MangaDex trending failed, trying Jikan:', mdErr);
        }

        // Jikan Fallback
        const jikanRes = await fetchWithRetry('https://api.jikan.moe/v4/top/manga?limit=10&filter=publishing');
        if (jikanRes.ok) {
          const jData = await jikanRes.json();
          setCachedEntry(cacheKey, jData, 900);
          return jData;
        }
        throw new Error('All trending providers failed');
      });

      return res.json(data);
    } catch (err) {
      if (cached && cached.isUsableStale) {
        return res.json({ ...cached.data, cached: true, isStale: true, notice: 'Showing recently cached results' });
      }
      res.status(502).json({ error: 'Unable to fetch trending manga' });
    }
  });

  // 4. Latest Manga
  app.get('/api/manga/latest', async (req: Request, res: Response) => {
    const cacheKey = 'manga_latest';
    const cached = getCachedEntry(cacheKey);
    if (cached && cached.isFresh) return res.json({ ...cached.data, cached: true });

    try {
      const data = await deduplicate(cacheKey, async () => {
        const mdRes = await fetchWithRetry(
          'https://api.mangadex.org/manga?limit=24&order[latestUploadedChapter]=desc&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive'
        );
        if (mdRes.ok) {
          const mdData = await mdRes.json() as any;
          const normalized = {
            data: (mdData.data || []).map(normalizeMangaDex),
          };
          setCachedEntry(cacheKey, normalized, 600);
          return normalized;
        }
        throw new Error(`MangaDex status ${mdRes.status}`);
      });

      return res.json(data);
    } catch (err) {
      if (cached && cached.isUsableStale) {
        return res.json({ ...cached.data, cached: true, isStale: true, notice: 'Showing recently cached results' });
      }
      res.status(502).json({ error: 'Unable to fetch latest manga' });
    }
  });

  // 5. Manga Search
  app.get('/api/manga/search', async (req: Request, res: Response) => {
    try {
      const { title, q, genre } = req.query;
      const query = (title || q) as string;

      if (!query && !genre) return res.status(400).json({ error: 'Query or genre parameter is required' });

      const cleanQ = (query || genre || '').toString().trim().toLowerCase();
      const cacheKey = `manga_search_${cleanQ}`;
      const cached = getCachedEntry(cacheKey);
      if (cached && cached.isFresh) return res.json({ ...cached.data, cached: true });

      const data = await deduplicate(cacheKey, async () => {
        let url = `https://api.mangadex.org/manga?limit=28&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
        if (query) {
          url += `&title=${encodeURIComponent(query)}`;
        }

        try {
          const mdRes = await fetchWithRetry(url);
          if (mdRes.ok) {
            const mdData = await mdRes.json() as any;
            const normalized = {
              data: (mdData.data || []).map(normalizeMangaDex),
            };
            setCachedEntry(cacheKey, normalized, 600);
            return normalized;
          }
        } catch (mdErr) {
          console.warn('MangaDex search failed, trying Jikan fallback:', mdErr);
        }

        // Jikan search fallback
        if (query) {
          const jikanRes = await fetchWithRetry(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=24&order_by=popularity&sort=desc`);
          if (jikanRes.ok) {
            const jData = await jikanRes.json();
            setCachedEntry(cacheKey, jData, 600);
            return jData;
          }
        }

        throw new Error('Search failed across providers');
      });

      return res.json(data);
    } catch (error) {
      console.error('Manga Search Proxy Error:', error);
      const cached = getCachedEntry(`manga_search_${(req.query.title || req.query.q || req.query.genre || '').toString().toLowerCase()}`);
      if (cached && cached.isUsableStale) {
        return res.json({ ...cached.data, cached: true, isStale: true, notice: 'Showing recently cached results' });
      }
      res.status(500).json({ error: 'Failed to search manga repository' });
    }
  });

  // 6. Manga Feed / Chapters
  app.get('/api/manga/feed', async (req: Request, res: Response) => {
    try {
      const rawId = (req.query.id as string || '').trim();
      const title = (req.query.title as string || '').trim();
      if (!rawId && !title) return res.status(400).json({ error: 'Manga ID or Title is required' });

      let targetMdId = rawId;

      // If ID is numeric (MAL ID) or not a UUID, resolve MangaDex UUID first
      const isNumeric = /^\d+$/.test(rawId);
      if (isNumeric || rawId.length < 20) {
        if (title) {
          targetMdId = await resolveMangaDexId(title) || rawId;
        } else {
          try {
            const jRes = await fetchWithRetry(`https://api.jikan.moe/v4/manga/${rawId}`);
            if (jRes.ok) {
              const jData = await jRes.json() as any;
              const t = jData.data?.title_english || jData.data?.title;
              if (t) targetMdId = await resolveMangaDexId(t) || rawId;
            }
          } catch (e) {
            console.warn('Feed Jikan title lookup failed:', e);
          }
        }
      }

      const cacheKey = `manga_feed_${targetMdId}`;
      const cached = getCachedEntry(cacheKey);
      if (cached && cached.isFresh) return res.json({ ...cached.data, cached: true });

      const payload = await deduplicate(cacheKey, async () => {
        // Fetch English chapters
        const feedUrl1 = `https://api.mangadex.org/manga/${targetMdId}/feed?translatedLanguage[]=en&limit=100&offset=0&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
        const mdRes1 = await fetchWithRetry(feedUrl1);
        if (!mdRes1.ok) {
          throw new Error(`MangaDex feed error: ${mdRes1.status}`);
        }

        const rawFeed1 = await mdRes1.json() as any;
        let rawChapters = rawFeed1.data || [];
        const totalAvailable = rawFeed1.total || rawChapters.length;

        // If more than 100 chapters exist, fetch next pages with bounded parallelism
        if (totalAvailable > 100) {
          const offsets = [];
          for (let o = 100; o < Math.min(totalAvailable, 400); o += 100) {
            offsets.push(o);
          }
          const extraPages = await Promise.allSettled(
            offsets.map((offset) =>
              fetchWithRetry(
                `https://api.mangadex.org/manga/${targetMdId}/feed?translatedLanguage[]=en&limit=100&offset=${offset}&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`
              ).then((r) => (r.ok ? r.json() : null))
            )
          );
          extraPages.forEach((p) => {
            if (p.status === 'fulfilled' && p.value?.data) {
              rawChapters = rawChapters.concat(p.value.data);
            }
          });
        }

        // Deduplicate and normalize chapters
        const normalizedChapters = rawChapters
          .filter((ch: any) => ch.attributes && (ch.attributes.chapter || ch.attributes.title))
          .map((ch: any) => ({
            id: ch.id,
            chapter: ch.attributes?.chapter || '1',
            volume: ch.attributes?.volume || null,
            title: ch.attributes?.title || '',
            pages: ch.attributes?.pages || 0,
            externalUrl: ch.attributes?.externalUrl || null,
            publishAt: ch.attributes?.publishAt || ch.attributes?.readableAt,
            attributes: {
              chapter: ch.attributes?.chapter || '1',
              title: ch.attributes?.title || '',
              pages: ch.attributes?.pages || 0,
              externalUrl: ch.attributes?.externalUrl || null,
            },
          }))
          .sort((a: any, b: any) => parseFloat(a.chapter || '0') - parseFloat(b.chapter || '0'))
          .filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.chapter === v.chapter) === i);

        const responsePayload = {
          mangadexId: targetMdId,
          data: normalizedChapters,
          total: normalizedChapters.length,
        };

        setCachedEntry(cacheKey, responsePayload, 3600);
        return responsePayload;
      });

      return res.json(payload);
    } catch (error) {
      console.error('Manga Feed Proxy Error:', error);
      const cached = getCachedEntry(`manga_feed_${(req.query.id as string || '').trim()}`);
      if (cached && cached.isUsableStale) {
        return res.json({ ...cached.data, cached: true, isStale: true, notice: 'Showing recently cached results' });
      }
      res.status(500).json({ error: 'Failed to fetch manga chapter feed' });
    }
  });

  // 7. Manga Chapter Pages
  app.get('/api/manga/pages', async (req: Request, res: Response) => {
    try {
      const { id } = req.query;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Chapter ID is required' });

      const cacheKey = `manga_pages_${id}`;
      const cached = getCachedEntry(cacheKey);
      if (cached && cached.isFresh) return res.json({ ...cached.data, cached: true });

      const payload = await deduplicate(cacheKey, async () => {
        const chapterRes = await fetchWithRetry(`https://api.mangadex.org/at-home/server/${id}`);
        if (!chapterRes.ok) {
          throw new Error(`MangaDex at-home returned status ${chapterRes.status}`);
        }
        const chapterData = await chapterRes.json() as any;
        if (!chapterData.chapter) throw new Error('Chapter not found on MangaDex');

        const host = chapterData.baseUrl;
        const hash = chapterData.chapter.hash;
        const filenames = chapterData.chapter.data || chapterData.chapter.dataSaver || [];
        const type = chapterData.chapter.data ? 'data' : 'data-saver';

        const pages = filenames.map((f: string) => `${host}/${type}/${hash}/${f}`);
        const result = { pages, total: pages.length, host, hash };
        
        setCachedEntry(cacheKey, result, 7200); // 2 hours
        return result;
      });

      return res.json(payload);
    } catch (error) {
      console.error('Manga Pages Proxy Error:', error);
      const cached = getCachedEntry(`manga_pages_${req.query.id}`);
      if (cached && cached.isUsableStale) {
        return res.json({ ...cached.data, cached: true, isStale: true, notice: 'Showing recently cached results' });
      }
      res.status(500).json({ error: 'Unable to load chapter pages from provider' });
    }
  });

  // ── Socket.io Events ────────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    let currentRoomId = '';
    let currentUsername = '';

    socket.on('join_room', (data: { room: string; username?: string }) => {
      socket.join(data.room);
      currentRoomId = data.room;
      currentUsername = data.username || `Guest_${socket.id.substring(0, 4)}`;
      console.log(`${currentUsername} joined room: ${data.room}`);

      if (activeRooms[data.room]) {
        activeRooms[data.room].viewers += 1;
        activeRooms[data.room].users[socket.id] = currentUsername;

        const publicRooms = Object.values(activeRooms).map((r) => ({
          id: r.id,
          roomName: r.roomName,
          host: r.hostName,
          hasPassword: !!r.password,
          viewers: r.viewers,
          media: r.media,
        }));
        io.emit('rooms_updated', publicRooms);

        if (activeRooms[data.room].playing) {
          const room = activeRooms[data.room];
          let estimatedTime = room.currentTime || 0;
          if (room.isPlaying && room.lastTimeUpdate) {
            const elapsed = (Date.now() - room.lastTimeUpdate) / 1000;
            estimatedTime += elapsed;
          }
          socket.emit('video_sync', {
            ...room.playing,
            currentTime: Math.floor(estimatedTime),
            isPlaying: room.isPlaying,
          });
        }

        const roomUsers = Object.entries(activeRooms[data.room].users).map(([id, name]) => ({
          id,
          username: name,
          isHost: name === activeRooms[data.room].hostName,
        }));
        io.to(data.room).emit('room_users', roomUsers);
      }

      socket.to(data.room).emit('receive_message', {
        author: 'System',
        message: `${currentUsername} has joined the Watch Party! 🎉`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });

    socket.on('send_message', (data: any) => {
      socket.to(data.room).emit('receive_message', data);
    });

    socket.on('sync_play', (data: { room: string; currentTime?: number }) => {
      const room = activeRooms[data.room];
      if (room && currentUsername?.toLowerCase() === room.hostName?.toLowerCase()) {
        room.currentTime = data.currentTime || 0;
        room.isPlaying = true;
        room.lastTimeUpdate = Date.now();
        socket.to(data.room).emit('receive_sync_play', data);
      }
    });

    socket.on('sync_pause', (data: { room: string; currentTime?: number }) => {
      const room = activeRooms[data.room];
      if (room && currentUsername?.toLowerCase() === room.hostName?.toLowerCase()) {
        room.currentTime = data.currentTime || 0;
        room.isPlaying = false;
        room.lastTimeUpdate = Date.now();
        socket.to(data.room).emit('receive_sync_pause', data);
      }
    });

    socket.on('time_update', (data: { room: string; currentTime?: number; isPlaying?: boolean }) => {
      const room = activeRooms[data.room];
      if (room && currentUsername?.toLowerCase() === room.hostName?.toLowerCase()) {
        room.currentTime = data.currentTime || 0;
        room.isPlaying = data.isPlaying !== false;
        room.lastTimeUpdate = Date.now();

        socket.to(data.room).emit('video_sync', {
          type: room.playing?.type,
          id: room.playing?.id,
          currentTime: room.currentTime,
          isPlaying: room.isPlaying,
        });
      }
    });

    socket.on('kick_user', (data: { room: string; userId: string }) => {
      const room = activeRooms[data.room];
      if (room && currentUsername?.toLowerCase() === room.hostName?.toLowerCase()) {
        io.to(data.userId).emit('kicked');
      }
    });

    socket.on('start_video', (data: { room: string; type: string; id: string; title?: string }) => {
      const room = activeRooms[data.room];
      if (room && currentUsername?.toLowerCase() === room.hostName?.toLowerCase()) {
        console.log(`Host starting video ${data.type} ${data.id} in room ${data.room}`);
        room.playing = { type: data.type, id: data.id, title: data.title };
        room.currentTime = 0;
        room.isPlaying = true;
        room.lastTimeUpdate = Date.now();
        io.to(data.room).emit('video_sync', { ...data, currentTime: 0, isPlaying: true });
      }
    });

    socket.on('disconnect', () => {
      if (currentRoomId && activeRooms[currentRoomId]) {
        const room = activeRooms[currentRoomId];
        room.viewers = Math.max(0, room.viewers - 1);
        delete room.users[socket.id];

        if (room.viewers <= 0) {
          console.log(`Room ${currentRoomId} is empty. Deleting.`);
          delete activeRooms[currentRoomId];
        } else {
          const roomUsers = Object.entries(room.users).map(([id, name]) => ({
            id,
            username: name,
            isHost: name === room.hostName,
          }));
          io.to(currentRoomId).emit('room_users', roomUsers);
        }

        const publicRooms = Object.values(activeRooms).map((r) => ({
          id: r.id,
          roomName: r.roomName,
          host: r.hostName,
          hasPassword: !!r.password,
          viewers: r.viewers,
          media: r.media,
        }));
        io.emit('rooms_updated', publicRooms);
      }
    });
  });

  // ── Vite / Static serving ───────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SXRverse full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
