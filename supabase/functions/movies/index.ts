import { createClient } from 'jsr:@supabase/supabase-js@2';

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TMDB_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

interface RequestBody {
  genre?: string | number | null;
  decade?: string | null;
  page?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!TMDB_API_KEY) {
      return new Response(JSON.stringify({ error: 'TMDB_API_KEY is not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: RequestBody = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    } else {
      const url = new URL(req.url);
      body = {
        genre: url.searchParams.get('genre'),
        decade: url.searchParams.get('decade'),
        page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!, 10) : 1,
      };
    }

    const { genre, decade, page = 1 } = body;

    let tmdbUrl: string;
    if (genre === 'trending') {
      tmdbUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;
    } else {
      tmdbUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&vote_count.gte=50&page=${page}`;

      if (genre && genre !== 'all' && genre !== 'trending') {
        tmdbUrl += `&with_genres=${encodeURIComponent(String(genre))}`;
      }

      if (decade === '2020s') {
        tmdbUrl += '&primary_release_date.gte=2020-01-01&primary_release_date.lte=2029-12-31';
      } else if (decade === '2010s') {
        tmdbUrl += '&primary_release_date.gte=2010-01-01&primary_release_date.lte=2019-12-31';
      } else if (decade === '2000s') {
        tmdbUrl += '&primary_release_date.gte=2000-01-01&primary_release_date.lte=2009-12-31';
      } else if (decade === '90s') {
        tmdbUrl += '&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31';
      }
    }

    const tmdbRes = await fetch(tmdbUrl);
    if (!tmdbRes.ok) {
      const errText = await tmdbRes.text();
      return new Response(JSON.stringify({ error: 'TMDB API call failed', details: errText }), {
        status: tmdbRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tmdbData = await tmdbRes.json();
    const rawMovies: any[] = tmdbData.results ?? [];

    const formattedMovies = rawMovies
      .filter((m) => m.title && (m.poster_path || m.backdrop_path))
      .map((m) => {
        const year = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null;
        const genres = (m.genre_ids || [])
          .map((id: number) => TMDB_GENRES[id])
          .filter(Boolean)
          .slice(0, 2)
          .join(', ');
        const meta = [year, genres].filter(Boolean).join(' • ');

        return {
          external_id: `tmdb:${m.id}`,
          kind: 'movie',
          title: m.title,
          meta: meta || null,
          image_url: m.poster_path
            ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
            : `https://image.tmdb.org/t/p/w500${m.backdrop_path}`,
          rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
          year,
          genre: genres || null,
          overview: m.overview || null,
          couple_id: null,
        };
      });

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    let savedItems: any[] = [];
    if (formattedMovies.length > 0) {
      const { data, error } = await adminClient
        .from('picker_items')
        .upsert(formattedMovies, { onConflict: 'external_id' })
        .select('id, kind, title, meta, image_url, rating, year, genre, overview, external_id');

      if (error) {
        console.error('Error saving picker_items:', error);
      } else {
        savedItems = data ?? [];
        // Preserve TMDB's exact ranked discovery order
        const orderMap = new Map(formattedMovies.map((m, idx) => [m.external_id, idx]));
        savedItems.sort((a, b) => (orderMap.get(a.external_id) ?? 0) - (orderMap.get(b.external_id) ?? 0));
      }
    }

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: userData } = await adminClient.auth.getUser(token);
      userId = userData?.user?.id ?? null;
    }

    let swipedIds = new Set<string>();
    if (userId) {
      const { data: swipes } = await adminClient
        .from('picker_swipes')
        .select('item_id')
        .eq('user_id', userId);

      swipedIds = new Set((swipes ?? []).map((s: { item_id: string }) => s.item_id));
    }

    const queue = savedItems
      .filter((item) => !swipedIds.has(item.id))
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        meta: item.meta,
        imageUrl: item.image_url,
        rating: item.rating ? Number(item.rating) : null,
        year: item.year,
        genre: item.genre,
        overview: item.overview,
      }));

    return new Response(JSON.stringify({ cards: queue, total: queue.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
