export interface WallexMarket {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  fa_base_asset?: string;
  fa_quote_asset?: string;
  en_base_asset?: string;
  en_quote_asset?: string;
  price: string;
  change_24h?: number;
  highest_24h_price?: string;
  lowest_24h_price?: string;
  volume_24h?: number;
}

interface WallexApiResponse {
  result?: {
    markets?: WallexMarket[];
  };
  success?: boolean;
}

// In-memory cache to avoid excessive requests
let cachedMarkets: WallexMarket[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 15_000; // 15 seconds

/**
 * Fetches all markets from Wallex API (GET /hector/web/v1/markets)
 * Uses local proxy with graceful fallback
 */
export async function fetchWallexMarkets(forceRefresh = false): Promise<WallexMarket[]> {
  const now = Date.now();
  if (!forceRefresh && cachedMarkets && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedMarkets;
  }

  // Endpoints to try in order
  const endpoints = [
    '/hector/web/v1/markets',
    '/api/wallex/markets',
    'https://api.wallex.ir/hector/web/v1/markets'
  ];

  let lastError: any = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!res.ok) continue;
      const data: WallexApiResponse = await res.json();
      const markets = data?.result?.markets;
      if (Array.isArray(markets) && markets.length > 0) {
        cachedMarkets = markets;
        lastFetchTime = Date.now();
        return markets;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (cachedMarkets && cachedMarkets.length > 0) {
    return cachedMarkets;
  }

  throw lastError || new Error('خطا در دریافت لیست بازارهای والکس');
}

/**
 * Finds matching Wallex market for a given raw symbol or asset name (e.g. "HBAR/TMN", "HBAR", "هدرا", "ICP", "BTC")
 */
export function findWallexMarket(
  markets: WallexMarket[],
  rawSymbol: string,
  preferredQuote?: string
): WallexMarket | undefined {
  if (!rawSymbol || !markets || markets.length === 0) return undefined;

  const quote = preferredQuote?.toUpperCase() || (rawSymbol.toUpperCase().includes('USDT') ? 'USDT' : 'TMN');

  // Strip delimiters: "HBAR/TMN" -> "HBARTMN"
  const compact = rawSymbol.replace(/[\/\-_ ]/g, '').toUpperCase();

  // 1. Direct symbol match
  const exact = markets.find(m => m.symbol.toUpperCase() === compact);
  if (exact) return exact;

  // 2. Base asset extract: "HBAR/TMN" -> "HBAR"
  const parts = rawSymbol.split(/[\/\-_ ]/);
  const base = parts[0].trim().toUpperCase();

  // Hedera Persian aliases
  if (
    rawSymbol.includes('هدرا') ||
    rawSymbol.toLowerCase().includes('hedera') ||
    base === 'HBAR'
  ) {
    const hbarMatch = markets.find(m => m.base_asset.toUpperCase() === 'HBAR' && m.quote_asset.toUpperCase() === quote);
    if (hbarMatch) return hbarMatch;
    const anyHbar = markets.find(m => m.base_asset.toUpperCase() === 'HBAR');
    if (anyHbar) return anyHbar;
  }

  // General Base + Quote match
  const baseQuoteMatch = markets.find(
    m => m.base_asset.toUpperCase() === base && m.quote_asset.toUpperCase() === quote
  );
  if (baseQuoteMatch) return baseQuoteMatch;

  // Base only match
  const baseOnlyMatch = markets.find(m => m.base_asset.toUpperCase() === base);
  if (baseOnlyMatch) return baseOnlyMatch;

  // Persian asset name match
  const faMatch = markets.find(
    m => (m.fa_base_asset && m.fa_base_asset.includes(rawSymbol)) ||
         (m.en_base_asset && m.en_base_asset.toLowerCase() === rawSymbol.toLowerCase())
  );
  if (faMatch) return faMatch;

  return undefined;
}
