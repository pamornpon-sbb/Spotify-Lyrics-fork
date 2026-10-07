import { configPromise } from './config';
import { request } from './request';

interface Artist {
  name: string;
  alias: string[];
  transNames?: string[];
}

interface Album {
  name: string;
}

export interface Song {
  id: number;
  name: string;
  artists: Artist[];
  album: Album;
  /**ms */
  duration?: number;
}

interface SearchSongsResult {
  result?: {
    songs?: Song[];
  };
}

interface SearchArtistsResult {
  result?: {
    artists?: Artist[];
  };
}

export interface SongLyricResult {
  lrc?: {
    lyric?: string;
  };
  tlyric?: {
    lyric?: string;
  };
}

export async function fetchNetEaseChineseName(
  s: string,
  fetchOptions?: RequestInit,
): Promise<SearchArtistsResult> {
  const { API_HOST } = await configPromise;
  const searchQuery = new URLSearchParams({
    keywords: s,
    type: '100',
    limit: '100',
  });
  return request(`${API_HOST}/search?${searchQuery}`, fetchOptions);
}

// fallback to lrclib is handled by `SharedData`
export async function fetchNetEaseSongList(s: string, fetchOptions?: RequestInit) {
  const { API_HOST } = await configPromise;
  const searchQuery = new URLSearchParams({
    keywords: s,
    type: '1',
    limit: '100',
  });

  const res: SearchSongsResult = await request(`${API_HOST}/search?${searchQuery}`, fetchOptions);
  return res.result?.songs || [];
}

export async function fetchNetEaseLyric(
  songId: number,
  fetchOptions?: RequestInit,
): Promise<SongLyricResult> {
  const { API_HOST } = await configPromise;
  return request(`${API_HOST}/lyric?${new URLSearchParams({ id: String(songId) })}`, fetchOptions);
}
