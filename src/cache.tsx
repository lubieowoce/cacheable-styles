import React, { createContext, useContext } from "react";

export type StyleCache = {
  cache: Map<string, string>;
  stats: CacheStats;
  get: (key: string) => string | null;
  set: (key: string, val: string) => void;
};

export type CacheStats = {
  calls: number;
  hits: number;
  misses: number;
  bailouts: number;
};

export type StyleCtxValue = StyleCache;

export const createStyleCache = (): StyleCache => {
  return {
    cache: new Map<string, string>(),
    stats: { calls: 0, hits: 0, misses: 0, bailouts: 0 },
    get(key: string) {
      this.stats.calls += 1;
      const existing = this.cache.get(key);
      if (existing) {
        this.stats.hits += 1;
        return existing;
      } else {
        this.stats.misses += 1;
        return null;
      }
    },
    set(key, val) {
      this.cache.set(key, val);
    }
  };
};

const StyleCacheCtx = createContext<StyleCtxValue | null>(null);

export const StyleCacheProvider = ({
  children,
  cache
}: React.PropsWithChildren<{ cache: StyleCache }>) => {
  return (
    <StyleCacheCtx.Provider value={cache}>{children}</StyleCacheCtx.Provider>
  );
};

export const useStyleCache = (): StyleCtxValue | null => {
  return useContext(StyleCacheCtx);
};
