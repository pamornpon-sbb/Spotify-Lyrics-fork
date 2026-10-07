/**
 * Used to update the data and synchronize with Popup and Lyrics Editor,
 * while the data is rendered into the PIP
 */
import { Cache } from 'duoyun-ui/lib/cache';

import { Message, Event } from '../common/constants';
import { sendEvent, events } from '../common/ga';

import { PopupStore } from '../popup/store';

import {
  Song,
  Lyric,
  fetchLyric,
  parseLyrics,
  matchingLyrics,
  correctionLyrics,
  hasSyncedLyrics,
  isUnsyncedLyrics,
  parseUnsyncedLyrics,
} from './lyrics';
import { fetchSongList, fetchGeniusLyrics } from './genius';
import { setSong, getSong } from './store';
import { optionsPromise } from './options';
import { captureException, querySelector } from './utils';
import { getCurrentAudio } from './element';
import { configPromise } from './config';
import { fetchNetEaseSongList } from './netease';
import { fetchLRCLIBSongList } from './lrclib';

interface CacheReq {
  name: string;
  artists: string;
  duration: number;
  getLyrics?: (fetchOptions: RequestInit) => Promise<string>;
}

interface CacheItem {
  name: string;
  artists: string;
  resolveDuration: (duration: number) => void;
  durationPromise: Promise<number>;
  getLyrics: (fetchOptions: RequestInit) => Promise<string>;
}

const cacheStore = new Cache<CacheItem>({ max: 100, renewal: true });
const getCache = (name: string, artists: string) => {
  return cacheStore.get([name, artists].join(), () => {
    let _resolveDuration = (_: number) => {
      //
    };
    const _durationPromise = new Promise<number>((res) => (_resolveDuration = res));
    return {
      name,
      artists,
      resolveDuration: _resolveDuration,
      durationPromise: _durationPromise,
      getLyrics: async () => '',
    };
  });
};

export class SharedData {
  // Popup data
  private _name = '';
  private _artists = '';
  private _id = 0;
  private _aId = 0;
  private _list: Song[] = [];

  // PIP data
  private _text = '';
  private _highlightLyrics: string[] | null = [];
  // length 0 is loading
  // null is no lyrics
  private _lyrics: Lyric = [];
  private _error: Error | null = null;
  private _abortController = new AbortController();
  // fetched lyrics of the current track, avoid fetching again for unsynced lyrics
  private _lyricsStrCache = new Map<number, string>();

  get cd1() {
    return `${this._name} - ${this._artists}`;
  }

  get cd2() {
    return `${this._id}`;
  }

  get req() {
    return { name: this._name, artists: this._artists };
  }

  get text() {
    return this._text;
  }

  get highlightLyrics() {
    return this._highlightLyrics;
  }

  get lyrics() {
    return this._lyrics;
  }

  get error() {
    return this._error;
  }

  get name() {
    return this._name;
  }

  get artists() {
    return this._artists;
  }

  setLyrics(lyrics: Lyric) {
    this._lyrics = lyrics && [...lyrics];
  }

  private _cancelRequest() {
    this._abortController.abort();
    this._abortController = new AbortController();
  }

  private _resetLyrics() {
    this._lyrics = [];
    this._error = null;
    this._lyricsStrCache.clear();
    this._cancelRequest();
  }

  resetData() {
    this._resetLyrics();
    this._id = 0;
    this._name = '';
    this._artists = '';
    this._aId = 0;
    this._list = [];
    this._text = '';
    this._highlightLyrics = [];
  }

  private async _getParseLyricsOptions() {
    const options = await optionsPromise;
    return {
      cleanLyrics: options['clean-lyrics'] === 'on',
      lyricsTransform: options['lyrics-transform'],
    };
  }

  // `unsynced`: only accept lyrics without timestamps
  private async _getLyricsFromAPI(fetchOptions: RequestInit, unsynced = false) {
    const id = this._id;
    if (id === 0) {
      return null;
    }
    let lyricsStr = this._lyricsStrCache.get(id);
    if (lyricsStr === undefined) {
      const options = await optionsPromise;
      lyricsStr = await fetchLyric(id, fetchOptions);
      this._lyricsStrCache.set(id, lyricsStr);
      if (lyricsStr === '') {
        sendEvent(options.cid, events.noLyrics, { cd1: this.cd1, cd2: this.cd2 });
      }
    }
    if (lyricsStr === '') {
      return null;
    }
    const parseLyricsOptions = await this._getParseLyricsOptions();
    if (unsynced) {
      return parseUnsyncedLyrics(lyricsStr, parseLyricsOptions);
    }
    // e.g. some NetEase lyrics only have credit lines
    return hasSyncedLyrics(lyricsStr) ? parseLyrics(lyricsStr, parseLyricsOptions) : null;
  }

  private async _getAnyLyricsFromAPI(fetchOptions: RequestInit) {
    return (
      (await this._getLyricsFromAPI(fetchOptions)) ||
      (await this._getLyricsFromAPI(fetchOptions, true))
    );
  }

  private async _getLyricsFromBuiltIn(fetchOptions: RequestInit) {
    const lrc = await getCache(this.name, this.artists).getLyrics(fetchOptions);
    return parseLyrics(lrc, await this._getParseLyricsOptions());
  }

  private async _fetchHighlight(fetchOptions: RequestInit) {
    try {
      const fetchTransName = async () => ({});
      const { id } = await matchingLyrics(this.req, {
        onlySearchName: false,
        fetchSongList,
        fetchTransName,
        fetchOptions,
      });
      if (id === 0) {
        this._highlightLyrics = null;
      } else {
        const { text, highlights } = await fetchGeniusLyrics(id, fetchOptions);
        this._lyrics = correctionLyrics(this._lyrics, text);
        this._text = text;
        this._highlightLyrics = highlights;
      }
    } catch {
      // `[]` is loading, show no lyrics instead of loading forever
      if (!fetchOptions.signal?.aborted) this._highlightLyrics = null;
    }
  }

  cacheTrackAndLyrics(info: CacheReq) {
    const cache = getCache(info.name, info.artists);
    cache.resolveDuration(info.duration);
    if (info.getLyrics) cache.getLyrics = info.getLyrics;
  }

  // can only modify `lyrics`/`id`/`aId`/`list`
  private async _matching(fetchOptions: RequestInit) {
    const audio = await getCurrentAudio();
    const startTime = audio.currentSrc ? performance.now() : null;
    const options = await optionsPromise;
    const parseLyricsOptions = await this._getParseLyricsOptions();
    // the selected lyrics server first, the other one is the fallback
    const [mainSongList, fallbackSongList] =
      options['lyrics-server'] === 'NetEase'
        ? [fetchNetEaseSongList, fetchLRCLIBSongList]
        : [fetchLRCLIBSongList, fetchNetEaseSongList];
    const matching = (fetchSongList: typeof fetchLRCLIBSongList) =>
      matchingLyrics(this.req, {
        fetchSongList,
        getDuration: () =>
          Promise.any<number>([
            getCache(this._name, this._artists).durationPromise,
            audio.duration ||
              new Promise<number>((res) =>
                audio.addEventListener('loadedmetadata', () => res(audio.duration), {
                  once: true,
                }),
              ),
            // 0 is unknown duration, avoid waiting forever
            new Promise<number>((res) => setTimeout(() => res(0), 3000)),
          ]),
        fetchOptions,
      });
    // server errors are treated as no lyrics, keep them to show if all servers fail
    const errors: Error[] = [];
    const ignoreServerError = <T>(promise: Promise<T>) =>
      promise.catch((err: Error) => {
        if (err.name === 'AbortError') throw err;
        errors.push(err);
        return null;
      });
    const [main, remoteData] = await Promise.all([
      ignoreServerError(matching(mainSongList)),
      // remote data is optional
      getSong(this.req, fetchOptions).catch((err: Error) => {
        if (err.name === 'AbortError') throw err;
        return undefined;
      }),
    ]);
    let id = main?.id || 0;
    this._list = main?.list || [];
    const reviewed = options['use-unreviewed-lyrics'] === 'on' || remoteData?.reviewed;
    const isSelf = remoteData?.user === options.cid;

    // 1. use uploaded lyrics
    if (isSelf && remoteData?.lyric) {
      this._lyrics = parseLyrics(remoteData.lyric, parseLyricsOptions);
      sendEvent(options.cid, events.useRemoteLyrics);
    }

    // 2. use selected lyrics
    else if (isSelf && remoteData?.neteaseID) {
      this._id = remoteData.neteaseID;
      this._aId = this._id;
      this._lyrics = await this._getAnyLyricsFromAPI(fetchOptions);
    }

    // 3. use other user upload lyrics
    else if (reviewed && remoteData?.lyric) {
      this._lyrics = parseLyrics(remoteData.lyric, parseLyricsOptions);
      sendEvent(options.cid, events.useRemoteLyrics);
    }

    // **default behavior**
    // 4. use build-in lyrics or netease lyrics
    else {
      this._id = (reviewed ? remoteData?.neteaseID || id : id || remoteData?.neteaseID) || 0;
      this._aId = this._id;
      this._lyrics = await ignoreServerError(this._getLyricsFromAPI(fetchOptions));
      // the selected server is down or has no lyrics/songs, try the other one
      if (!this._lyrics || !this._list.length) {
        const mainErrorCount = errors.length;
        const fallback = await ignoreServerError(matching(fallbackSongList));
        if (!this._lyrics && fallback?.id) {
          id = fallback.id;
          this._id = id;
          this._aId = id;
          this._lyrics = await ignoreServerError(this._getLyricsFromAPI(fetchOptions));
          // popup lists the songs of the server that has the lyrics
          if (this._lyrics) this._list = fallback.list;
        }
        if (!this._list.length) this._list = fallback?.list || [];
        if (!this._lyrics) {
          this._lyrics = await this._getLyricsFromBuiltIn(fetchOptions);
        }
        // no synced lyrics anywhere, try lyrics without timestamps
        if (!this._lyrics) {
          const syncedId = this._id;
          const candidates = [
            [main?.plainId, main],
            [main?.id, main],
            [fallback?.plainId, fallback],
            [fallback?.id, fallback],
          ] as const;
          for (const [unsyncedId, result] of candidates) {
            if (!unsyncedId || !result) continue;
            this._id = unsyncedId;
            this._lyrics = await ignoreServerError(this._getLyricsFromAPI(fetchOptions, true));
            if (this._lyrics) {
              id = unsyncedId;
              this._aId = unsyncedId;
              if (result.list.length) this._list = result.list;
              break;
            }
          }
          if (!this._lyrics) this._id = syncedId;
        }
        // show the error only when both servers fail
        if (!this._lyrics && mainErrorCount && errors.length > mainErrorCount) {
          throw errors[errors.length - 1];
        }
      }
    }
    if (this._lyrics && this._id !== id) {
      sendEvent(options.cid, events.useRemoteMatch);
    }
    if (!this._lyrics && id === 0) {
      sendEvent(options.cid, events.notMatch, { cd1: this.cd1 });
    }
    if (startTime) {
      const ev = (performance.now() - startTime).toFixed();
      sendEvent(options.cid, { ev, ...events.loadLyrics }, { cd1: this.cd1 });
    }

    // 5. use song highlight
    this._fetchHighlight(fetchOptions);
  }

  async confirmedMId() {
    const { _name, _artists, _id } = this;
    try {
      // unsynced lyrics are not saved to the shared store
      if (this._lyrics && !isUnsyncedLyrics(this._lyrics)) {
        await setSong({ name: _name, artists: _artists, id: _id });
      }
      this._aId = _id;
      this.sendToContentScript();
    } catch (e) {
      this._error = e;
    }
  }

  async chooseLyricsTrack({ id, name, artists }: PopupStore) {
    if (id === this._id) return;
    if (name !== this._name || artists !== this._artists) return;
    this._id = id;
    this._resetLyrics();
    try {
      const fetchOptions = { signal: this._abortController.signal };
      if (id === 0) {
        // reset
        await setSong({ name, artists, id });
        await this._matching(fetchOptions);
        this.sendToContentScript();
      } else {
        this._lyrics = await this._getAnyLyricsFromAPI(fetchOptions);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        this._error = e;
      }
    }
  }

  async dispatchTrackElementUpdateEvent(isUserAction = false) {
    const { TRACK_NAME_SELECTOR, TRACK_ARTIST_SELECTOR } = await configPromise;
    const name = querySelector(TRACK_NAME_SELECTOR)?.textContent;
    const artists = querySelector(TRACK_ARTIST_SELECTOR)?.textContent?.replaceAll(/\s+\/\s+/g, ',');

    try {
      if (this._name === name && this._artists === artists) {
        return;
      }
      if (!name || !artists) {
        if (isUserAction) {
          throw new Error(`Track info not found`);
        }
        return;
      }
      this.resetData();
      this._name = name;
      this._artists = artists;
      await this._matching({ signal: this._abortController.signal });
    } catch (e) {
      if (e.name !== 'AbortError') {
        this._error = e;
        captureException(e);
      }
    }
    this.sendToContentScript();
  }

  sendToContentScript() {
    const { _name, _artists, _id, _aId, _list } = this;
    const msg: Message<PopupStore> = {
      type: Event.SEND_SONGS,
      data: {
        name: _name,
        artists: _artists,
        id: _id,
        aId: _aId,
        list: _list,
      },
    };
    window.postMessage(msg, '*');
  }
}

export const sharedData = new SharedData();
