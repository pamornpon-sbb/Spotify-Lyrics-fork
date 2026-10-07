import { expect, test, describe, vi } from 'vitest';

import {
  parseLyrics,
  Lyric,
  matchingLyrics,
  Song,
  hasSyncedLyrics,
  isUnsyncedLyrics,
  parseUnsyncedLyrics,
} from './lyrics';

vi.mock('./netease', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./netease')>()),
  // NetEase artist search, used to find the singer's alias
  fetchNetEaseChineseName: async () => ({
    result: { artists: [{ name: 'Tai Orathai', alias: ['ต่าย อรทัย'] }] },
  }),
}));

describe('parse lyrics', () => {
  test('edge case', () => {
    expect(parseLyrics('')).toEqual<Lyric>(null);
    expect(parseLyrics(' ')).toEqual<Lyric>(null);
    expect(parseLyrics('\n')).toEqual<Lyric>(null);
    expect(parseLyrics('BY:MT')).toEqual<Lyric>(null);
    expect(parseLyrics('BY:MT\nBY:MT')).toEqual<Lyric>(null);
    expect(parseLyrics('[ar:Beyond]')).toEqual<Lyric>([{ startTime: null, text: 'AR: Beyond' }]);
    expect(parseLyrics('[invalid]')).toEqual<Lyric>(null);
  });
  test('lyrics line', () => {
    expect(parseLyrics('Text', { keepPlainText: true })).toEqual<Lyric>([
      { startTime: null, text: 'Text' },
    ]);
    expect(parseLyrics('[02:00]词\n[02:01]\n')).toEqual<Lyric>([
      { startTime: 120, text: '词' },
      { startTime: 121, text: '' },
    ]);
    expect(parseLyrics('[02:01]\n')).toEqual<Lyric>(null);
    expect(parseLyrics('[02:01]编')).toEqual<Lyric>([{ startTime: 121, text: '编' }]);
    expect(parseLyrics('[02:01]编：xx')).toEqual<Lyric>([{ startTime: 121, text: '编: xx' }]);
    expect(parseLyrics('[02:01]编：', { lyricsTransform: 'Traditional' })).toEqual<Lyric>([
      { startTime: 121, text: '編:' },
    ]);
    expect(parseLyrics('[02:01]编：', { cleanLyrics: true })).toEqual<Lyric>(null);
  });
});

describe('matching track', () => {
  test('basic', async () => {
    const query = { name: '夜雪', artists: 'Dicky Cheung' };
    const songs: Song[] = [
      { id: 1, artists: [{ name: '张卫健', alias: [] }], name: '夜雪(Live)', album: { name: '' } },
      { id: 2, artists: [{ name: '张卫健', alias: [] }], name: '夜雪', album: { name: '' } },
    ];
    let search = '';
    const fetchSongList = async (s: string) => {
      if (!search) search = s;
      return songs;
    };
    const fetchTransName = async () => ({});
    const result = await matchingLyrics(query, { fetchSongList, fetchTransName });
    expect(search).toBe('张卫健 夜雪');
    expect(result.id).toBe(2);
  });
});

describe('thai lyrics', () => {
  const thaiSong: Song = {
    id: 1.1,
    artists: [{ name: 'ต่าย อรทัย', alias: [] }],
    name: 'ดอกหญ้าในป่าปูน',
    album: { name: '' },
    duration: 229_000,
  };

  test('match thai name of the singer', async () => {
    const query = { name: 'ดอกหญ้าในป่าปูน', artists: 'Tai Orathai' };
    const fetchSongList = async () => [thaiSong];
    expect((await matchingLyrics(query, { fetchSongList })).id).toBe(1.1);
    const getDuration = async () => 229;
    expect((await matchingLyrics(query, { fetchSongList, getDuration })).id).toBe(1.1);
    // without alias: name 10 + duration 10 is not enough
    const fetchTransName = async () => ({});
    expect((await matchingLyrics(query, { fetchSongList, fetchTransName })).id).toBe(0);
  });

  test('unsynced song never wins over synced song', async () => {
    const query = { name: 'ฝากฟ้าทะเลฝัน', artists: 'Bird Thongchai' };
    const artists = [{ name: 'Bird Thongchai', alias: [] }];
    const songs: Song[] = [
      { id: 1.1, artists, name: 'ฝากฟ้าทะเลฝัน', album: { name: '' }, plainOnly: true },
      { id: 2.1, artists, name: 'ฝากฟ้าทะเลฝัน (หาดทราย สายลม สองเรา)', album: { name: '' } },
    ];
    const fetchSongList = async () => songs;
    const fetchTransName = async () => ({});
    const result = await matchingLyrics(query, { fetchSongList, fetchTransName });
    expect(result.id).toBe(2.1);
    expect(result.plainId).toBe(1.1);
  });

  test('credit lines are not lyrics', () => {
    expect(hasSyncedLyrics('[00:00.00]作词 : A\n[00:01.00]作曲 : B\n[00:02.00]人声 : C')).toBe(
      false,
    );
    expect(hasSyncedLyrics('[00:01]ก\n[00:02]ข\n[00:03]ค')).toBe(true);
    expect(
      parseLyrics('[00:01]คำร้อง : ก\n[00:02]ทำนอง : ข\n[00:03]ค', { cleanLyrics: true }),
    ).toEqual<Lyric>([{ startTime: 3, text: 'ค' }]);
  });

  test('unsynced lyrics', () => {
    expect(
      parseUnsyncedLyrics('作词：A\n一\n\n二\n三', { lyricsTransform: 'Simplified' }),
    ).toEqual<Lyric>([
      { startTime: null, text: '一' },
      { startTime: null, text: '' },
      { startTime: null, text: '二' },
      { startTime: null, text: '三' },
    ]);
    expect(parseUnsyncedLyrics('愛\n二\n三', { lyricsTransform: 'Simplified' })?.[0].text).toBe(
      '爱',
    );
    expect(parseUnsyncedLyrics('[00:01]一\n二\n三\n四')).toEqual<Lyric>(null);
    expect(parseUnsyncedLyrics('一\n二')).toEqual<Lyric>(null);
    expect(isUnsyncedLyrics([])).toBe(false);
    expect(isUnsyncedLyrics(null)).toBe(false);
  });
});
