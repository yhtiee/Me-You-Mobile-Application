export type MovieGenreFilter = {
  id: string | number;
  label: string;
};

export const MOVIE_GENRES: MovieGenreFilter[] = [
  { id: 'trending', label: '🔥 Trending' },
  { id: 10749, label: '💖 Romance' },
  { id: 35, label: '😂 Comedy' },
  { id: 28, label: '💥 Action' },
  { id: 18, label: '🎭 Drama' },
  { id: 27, label: '👻 Horror' },
  { id: 16, label: '🍿 Animation' },
  { id: 878, label: '🚀 Sci-Fi' },
  { id: 53, label: '⚡ Thriller' },
  { id: 10751, label: '✨ Family' },
  { id: 9648, label: '🔍 Mystery' },
];

export type MovieDecadeFilter = 'all' | '2020s' | '2010s' | '2000s' | '90s';

export const MOVIE_DECADES: { id: MovieDecadeFilter; label: string }[] = [
  { id: 'all', label: 'Any Era' },
  { id: '2020s', label: '2020s (Recent)' },
  { id: '2010s', label: '2010s' },
  { id: '2000s', label: '2000s' },
  { id: '90s', label: '90s Throwbacks' },
];
