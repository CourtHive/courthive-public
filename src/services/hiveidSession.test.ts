import { describe, expect, it } from 'vitest';

import {
  HIVEID_SESSION_STORAGE_KEY,
  clearHiveIDSession,
  emptyCached,
  getDisplayName,
  isAuthenticated,
  readHiveIDSession,
  writeHiveIDSession,
  type HiveIDSession,
  type HiveIDSessionStorage,
} from './hiveidSession';

function makeStorage(initial: Record<string, string> = {}): HiveIDSessionStorage & { dump: () => Record<string, string> } {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
    dump: () => ({ ...store }),
  };
}

const SAMPLE: HiveIDSession = {
  token: 'jwt-1',
  refreshToken: 'rtok-1',
  personId: 'p-1',
  cached: {
    standardFamilyName: 'Doe',
    standardGivenName: 'Jane',
    birthDate: '1990-04-12',
    sex: 'F',
    nationalityCode: 'USA',
  },
};

describe('hiveidSession', () => {
  it('writes and reads a session through the storage adapter', () => {
    const storage = makeStorage();
    writeHiveIDSession(SAMPLE, storage);
    expect(storage.dump()[HIVEID_SESSION_STORAGE_KEY]).toBeDefined();
    expect(readHiveIDSession(storage)).toEqual(SAMPLE);
  });

  it('returns null when no session is stored', () => {
    expect(readHiveIDSession(makeStorage())).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    const storage = makeStorage({ [HIVEID_SESSION_STORAGE_KEY]: 'not-json' });
    expect(readHiveIDSession(storage)).toBeNull();
  });

  it('returns null on a session payload without a token', () => {
    const storage = makeStorage({ [HIVEID_SESSION_STORAGE_KEY]: JSON.stringify({ refreshToken: 'r' }) });
    expect(readHiveIDSession(storage)).toBeNull();
  });

  it('clearHiveIDSession removes the key', () => {
    const storage = makeStorage();
    writeHiveIDSession(SAMPLE, storage);
    clearHiveIDSession(storage);
    expect(storage.dump()[HIVEID_SESSION_STORAGE_KEY]).toBeUndefined();
  });

  it('isAuthenticated reports true only when a valid session is present', () => {
    const storage = makeStorage();
    expect(isAuthenticated(storage)).toBe(false);
    writeHiveIDSession(SAMPLE, storage);
    expect(isAuthenticated(storage)).toBe(true);
    clearHiveIDSession(storage);
    expect(isAuthenticated(storage)).toBe(false);
  });

  it('null-storage paths are no-ops (server-side / private mode)', () => {
    expect(readHiveIDSession(null)).toBeNull();
    expect(() => writeHiveIDSession(SAMPLE, null)).not.toThrow();
    expect(() => clearHiveIDSession(null)).not.toThrow();
  });

  describe('getDisplayName', () => {
    it('joins given + family with a space', () => {
      expect(getDisplayName(SAMPLE)).toBe('Jane Doe');
    });

    it('handles a partial name', () => {
      const partial = {
        ...SAMPLE,
        cached: { ...SAMPLE.cached, standardFamilyName: null },
      };
      expect(getDisplayName(partial)).toBe('Jane');
    });

    it('returns empty string for a null session', () => {
      expect(getDisplayName(null)).toBe('');
    });
  });

  it('emptyCached returns a null-shaped cached field set', () => {
    expect(emptyCached()).toEqual({
      standardFamilyName: null,
      standardGivenName: null,
      birthDate: null,
      sex: null,
      nationalityCode: null,
    });
  });
});
