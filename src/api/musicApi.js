export const FEATURED_PLAYLISTS = [
  {
    id: 'top-bollywood',
    title: 'Top Hits Bollywood',
    name: 'Top Hits Bollywood',
    query: 'Top Hits Bollywood songs 2024',
    description: 'Trending Bollywood hits & chartbusters',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60'
  },
  {
    id: 'global-top',
    title: 'Global Top Hits',
    name: 'Global Top Hits',
    query: 'Billboard Hot 100 top music hits',
    description: 'The biggest global tracks right now',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60'
  },
  {
    id: 'lofi-chill',
    title: 'Lo-Fi Chill Beats',
    name: 'Lo-Fi Chill Beats',
    query: 'Lofi hip hop beats to relax study to',
    description: 'Relaxing ambient and lo-fi soundscapes',
    image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=60'
  },
  {
    id: 'anime-ost',
    title: 'Anime Openings & OST',
    name: 'Anime Openings & OST',
    query: 'Top Anime openings and OST songs',
    description: 'Iconic anime themes and emotional OSTs',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=60'
  },
  {
    id: 'punjabi-vibes',
    title: 'Punjabi Hits & Vibes',
    name: 'Punjabi Hits & Vibes',
    query: 'Top trending Punjabi songs 2024',
    description: 'Top trending Punjabi songs and chart toppers',
    image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop&q=60'
  },
  {
    id: 'edm-bangers',
    title: 'EDM & Dance Festival',
    name: 'EDM & Dance Festival',
    query: 'Top EDM electronic dance music bangers',
    description: 'High energy electronic and dance tracks',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&auto=format&fit=crop&q=60'
  }
];

export const getBestImage = (images) => {
  if (!images) return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
  if (typeof images === 'string') return images;
  if (Array.isArray(images) && images.length > 0) {
    const sorted = [...images].sort((a, b) => {
      const qA = parseInt(a?.quality || '0') || (a?.quality === '500x500' ? 500 : 0);
      const qB = parseInt(b?.quality || '0') || (b?.quality === '500x500' ? 500 : 0);
      return qB - qA;
    });
    return sorted[0]?.link || sorted[0]?.url || images[images.length - 1]?.link || images[images.length - 1]?.url || '';
  }
  return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
};

export const getBestAudio = (downloadUrl) => {
  if (!downloadUrl) return '';
  if (typeof downloadUrl === 'string') return downloadUrl;
  if (Array.isArray(downloadUrl) && downloadUrl.length > 0) {
    const highest = downloadUrl.find(d => d.quality === '320kbps') ||
                    downloadUrl.find(d => d.quality === '160kbps') ||
                    downloadUrl[downloadUrl.length - 1];
    return highest?.link || highest?.url || '';
  }
  return '';
};

export async function searchSongs(query) {
  if (!query || !query.trim()) return { results: [] };
  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';

  try {
    // 1. Try Backend YouTube Search proxy
    const ytRes = await fetch(`${backendUrl}/api/youtube?q=${encodeURIComponent(query)}`);
    if (ytRes.ok) {
      const ytData = await ytRes.json();
      if (Array.isArray(ytData) && ytData.length > 0) {
        return {
          results: ytData.map(item => ({
            id: item.id || item.videoId,
            videoId: item.videoId || item.id,
            name: item.name || item.title || 'Unknown Song',
            title: item.name || item.title || 'Unknown Song',
            primaryArtists: item.primaryArtists || 'Artist',
            duration: item.duration || 210,
            image: item.image || item.thumbnail,
            thumbnail: item.thumbnail || item.image,
            downloadUrl: item.downloadUrl || [],
            url: item.url || `https://www.youtube.com/watch?v=${item.videoId || item.id}`
          }))
        };
      }
    }
  } catch (err) {
    console.warn('Backend YouTube search error, attempting Saavn fallback:', err);
  }

  // 2. Secondary public provider (Saavn)
  try {
    const saavnApis = [
      `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=30`,
      `https://saavn.me/api/search/songs?query=${encodeURIComponent(query)}&limit=30`
    ];

    for (const url of saavnApis) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          const list = json?.data?.results || json?.data || [];
          if (Array.isArray(list) && list.length > 0) {
            const formatted = list.map(item => ({
              id: item.id,
              name: item.name || item.title || 'Untitled',
              title: item.name || item.title || 'Untitled',
              primaryArtists: item.primaryArtists || item.artists?.primary?.map(a => a.name).join(', ') || item.artist || '',
              duration: parseInt(item.duration) || 200,
              year: item.year || '',
              image: item.image || item.images || [],
              downloadUrl: item.downloadUrl || []
            }));
            return { results: formatted };
          }
        }
      } catch {}
    }
  } catch (err) {
    console.error('Saavn search error:', err);
  }

  return { results: [] };
}

export async function getPlaylistById(id) {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
  const meta = FEATURED_PLAYLISTS.find(p => p.id === id) || {
    id,
    title: 'Curated Playlist',
    name: 'Curated Playlist',
    query: `${id} popular music hits`,
    description: 'Dynamic mix curated in real-time',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60'
  };

  try {
    const q = meta.query || meta.title;
    const searchRes = await fetch(`${backendUrl}/api/youtube?q=${encodeURIComponent(q)}`);
    if (searchRes.ok) {
      const songs = await searchRes.json();
      if (Array.isArray(songs) && songs.length > 0) {
        return {
          id: meta.id,
          name: meta.title,
          title: meta.title,
          description: meta.description,
          image: meta.image,
          songCount: songs.length,
          songs: songs.map(item => ({
            id: item.id || item.videoId,
            videoId: item.videoId || item.id,
            name: item.name || item.title,
            title: item.name || item.title,
            primaryArtists: item.primaryArtists || 'Artist',
            duration: item.duration || 210,
            image: item.image || item.thumbnail || meta.image,
            thumbnail: item.thumbnail || meta.image,
            downloadUrl: item.downloadUrl || [],
            url: item.url || `https://www.youtube.com/watch?v=${item.videoId || item.id}`
          }))
        };
      }
    }
  } catch (err) {
    console.error(`Failed to load playlist ${id}:`, err);
  }

  return {
    id: meta.id,
    name: meta.title,
    title: meta.title,
    description: meta.description,
    image: meta.image,
    songCount: 0,
    songs: []
  };
}

export async function getLyrics(songId) {
  if (!songId) return null;
  try {
    const res = await fetch(`https://saavn.dev/api/songs/${songId}/lyrics`);
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.lyrics) {
        return data.data.lyrics;
      }
    }
  } catch {
    // fallback
  }
  return "♪ Instrumental / Synchronized lyrics not available for this track ♪";
}
