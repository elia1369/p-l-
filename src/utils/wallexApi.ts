import { TradeRecord } from '../types';

export interface WallexRawTrade {
  id: number | string;
  symbol: string;
  side: 'buy' | 'sell' | 'BUY' | 'SELL';
  price: string | number;
  quantity: string | number;
  sum?: string | number;
  fee: string | number;
  fee_asset?: string;
  created_at?: string;
  isBuyer?: boolean;
  isMaker?: boolean;
}

export interface PositionAnalysis {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  totalGrossBuyQty: number;
  totalGrossSellQty: number;
  netHoldingQty: number; // حجم واقعی باقیمانده پس از کسر کارمزدهای ارزی
  avgBuyPrice: number; // میانگین وزنی ورود
  costBasisPerUnit: number; // قیمت تمام شده هر واحد با کارمزد
  breakEvenPrice: number; // قیمت خروج بدون سود و زیان
  realizedPnL: number; // سود/زیان محقق شده به تومان/تتر
  totalFeesPaid: Record<string, number>; // کارمزدها به تفکیک ارز
  roiPercent: number; // درصد بازدهی
  totalBuyVolume: number; // حجم خرید
  totalSellVolume: number; // حجم فروش
  openCostBasis: number; // ارزش تمام شده پوزیشن باز
}

export interface AggregatePortfolioPnL {
  // مجموع سود و زیان محقق شده (Realized)
  totalRealizedPnL_TMN: number;
  totalRealizedPnL_USDT: number;
  totalRealizedPnL_CombinedTMN: number;

  // مجموع حجم معاملات
  totalBuyVolume_TMN: number;
  totalSellVolume_TMN: number;
  totalBuyVolume_USDT: number;
  totalSellVolume_USDT: number;
  totalTradeVolume_CombinedTMN: number;

  // ارزش و هزینه پوزیشن‌های باز (Open Positions)
  totalOpenPositionsCost_TMN: number;
  totalOpenPositionsCost_USDT: number;
  totalOpenPositionsCost_CombinedTMN: number;

  // کارمزدها به تفکیک هر ارز و تخمین کل به تومان
  totalFeesByAsset: Record<string, number>;
  totalFeesEstimated_TMN: number;

  // آمار کلی عملکرد معاملات
  totalTradesCount: number;
  activePositionsCount: number;
  profitablePositionsCount: number;
  losingPositionsCount: number;
  breakEvenPositionsCount: number;
  overallPortfolioROI_Percent: number;

  // نرخ مرجع تتر به تومان
  usdtTmnRate: number;
}

export interface WallexPortfolioResult {
  positions: PositionAnalysis[];
  aggregate: AggregatePortfolioPnL;
  trades: WallexRawTrade[];
}

interface BuyLot {
  remainingNetQty: number;
  price: number;
  unitCostInQuote: number;
}

export interface WallexMarket {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  fa_base_asset?: string;
  fa_quote_asset?: string;
  en_base_asset?: string;
  en_quote_asset?: string;
  price?: string;
  change_24h?: number;
  highest_24h_price?: string;
  lowest_24h_price?: string;
  volume_24h?: number;
}

/**
 * 1. Fetch all market symbols directly from GET https://api.wallex.ir/v1/markets
 */
export async function fetchWallexMarkets(forceRefresh = false): Promise<WallexMarket[]> {
  const endpoints = [
    '/v1/markets',
    '/api/wallex/markets',
    '/hector/web/v1/markets',
    'https://api.wallex.ir/v1/markets',
    'https://api.wallex.ir/hector/web/v1/markets'
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const rawMarkets = data?.result?.symbols || data?.result?.markets || (Array.isArray(data?.result) ? data.result : []);
      
      if (Array.isArray(rawMarkets) && rawMarkets.length > 0) {
        return rawMarkets.map((m: any) => ({
          symbol: String(m.symbol || `${m.base_asset}${m.quote_asset}`).toUpperCase(),
          base_asset: String(m.base_asset || m.baseAsset || '').toUpperCase(),
          quote_asset: String(m.quote_asset || m.quoteAsset || '').toUpperCase(),
          fa_base_asset: m.fa_base_asset,
          fa_quote_asset: m.fa_quote_asset,
          en_base_asset: m.en_base_asset,
          en_quote_asset: m.en_quote_asset,
          price: String(m.price || m.stats?.lastPrice || '0'),
          change_24h: m.change_24h || m.stats?.change_24h,
          highest_24h_price: m.highest_24h_price,
          lowest_24h_price: m.lowest_24h_price,
          volume_24h: m.volume_24h,
        }));
      }

      if (typeof data?.result?.symbols === 'object' && !Array.isArray(data.result.symbols)) {
        return Object.entries<any>(data.result.symbols).map(([symKey, m]) => ({
          symbol: symKey.toUpperCase(),
          base_asset: String(m.base_asset || m.baseAsset || '').toUpperCase(),
          quote_asset: String(m.quote_asset || m.quoteAsset || '').toUpperCase(),
          fa_base_asset: m.fa_base_asset,
          fa_quote_asset: m.fa_quote_asset,
          en_base_asset: m.en_base_asset,
          en_quote_asset: m.en_quote_asset,
          price: String(m.price || m.stats?.lastPrice || '0'),
          change_24h: m.change_24h,
          highest_24h_price: m.highest_24h_price,
          lowest_24h_price: m.lowest_24h_price,
          volume_24h: m.volume_24h,
        }));
      }
    } catch {
      // try next
    }
  }

  throw new Error('خطا در دریافت لیست نمادهای بازارهای والکس');
}

/**
 * Helper to normalize raw trade item from Wallex API
 */
function normalizeWallexTrade(t: any, fallbackSymbol?: string): WallexRawTrade {
  const sym = String(t.symbol || fallbackSymbol || '').toUpperCase();
  const isBuyer = t.isBuyer === true || String(t.side).toLowerCase() === 'buy';
  const side = isBuyer ? 'BUY' : 'SELL';
  const feeAsset = t.feeAsset || t.fee_asset || '';
  const createdAt = t.timestamp || t.created_at || new Date().toISOString();

  return {
    id: t.id || t.trade_id || `wlx-${Date.now()}-${Math.random()}`,
    symbol: sym,
    side,
    price: t.price,
    quantity: t.quantity || t.qty,
    sum: t.sum || t.total,
    fee: t.fee || 0,
    fee_asset: feeAsset,
    created_at: createdAt,
    isBuyer,
    isMaker: t.isMaker ?? t.is_maker,
  };
}

/**
 * 2. Fetch all trade pages for a specific symbol or global latest trades using auto-pagination
 * GET https://api.wallex.ir/v1/account/trades
 */
export async function fetchWallexTradesForSymbolPages(
  apiKey: string,
  symbol?: string
): Promise<WallexRawTrade[]> {
  const cleanKey = apiKey.trim();
  const cleanSym = symbol ? symbol.trim().toUpperCase().replace(/[\/\-_ ]/g, '') : '';
  const allSymbolTrades: WallexRawTrade[] = [];

  let currentPage = 1;
  let hasMorePages = true;
  const maxPages = 20;

  const headers = {
    'x-api-key': cleanKey,
    'Accept': 'application/json'
  };

  while (hasMorePages && currentPage <= maxPages) {
    let tradesData: any = null;
    const query = cleanSym ? `symbol=${encodeURIComponent(cleanSym)}&page=${currentPage}&per_page=50` : `page=${currentPage}&per_page=50`;

    const tradeEndpoints = [
      `/api/wallex/account/trades?${query}`,
      `https://api.wallex.ir/v1/account/trades?${query}`
    ];

    for (const tUrl of tradeEndpoints) {
      try {
        const res = await fetch(tUrl, { headers });
        if (res.ok) {
          tradesData = await res.json();
          break;
        }
      } catch {
        // try next endpoint
      }
    }

    if (!tradesData) break;

    const rawList: any[] = 
      tradesData?.result?.AccountLatestTrades ||
      tradesData?.result?.trades ||
      (Array.isArray(tradesData?.result) ? tradesData.result : []);

    if (Array.isArray(rawList) && rawList.length > 0) {
      for (const t of rawList) {
        allSymbolTrades.push(normalizeWallexTrade(t, cleanSym));
      }
    }

    if (tradesData?.result_info && typeof tradesData.result_info.has_more_pages === 'boolean') {
      hasMorePages = tradesData.result_info.has_more_pages;
    } else {
      hasMorePages = false;
    }

    currentPage++;
  }

  return allSymbolTrades;
}

/**
 * 3. calculatePositionsPnL:
 * - Groups trades by symbol
 * - Applies FIFO matching algorithm
 * - For BUY: reduces netReceivedCoin if fee_asset === baseAsset
 * - For SELL: deducts fee from revenue if fee_asset === quoteAsset
 */
export function calculatePositionsPnL(trades: WallexRawTrade[]): PositionAnalysis[] {
  const grouped = new Map<string, WallexRawTrade[]>();
  trades.forEach(t => {
    const sym = t.symbol.toUpperCase();
    if (!grouped.has(sym)) grouped.set(sym, []);
    grouped.get(sym)!.push(t);
  });

  const positions: PositionAnalysis[] = [];

  grouped.forEach((tradeList, symbol) => {
    // Chronological sort
    const sorted = [...tradeList].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    const baseAsset = symbol.replace(/TMN|USDT|IRT/g, '');
    const quoteAsset = symbol.endsWith('USDT') ? 'USDT' : 'TMN';

    let totalGrossBuyQty = 0;
    let totalGrossSellQty = 0;
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    const feeTotals: Record<string, number> = {};

    const buyQueue: BuyLot[] = [];
    let realizedPnL = 0;
    let closedCost = 0;

    for (const trade of sorted) {
      const price = parseFloat(String(trade.price)) || 0;
      const qty = parseFloat(String(trade.quantity)) || 0;
      const fee = parseFloat(String(trade.fee || '0')) || 0;
      const feeAsset = (trade.fee_asset || '').toUpperCase();
      const tradeSum = parseFloat(String(trade.sum || '0')) || (price * qty);
      const isBuy = String(trade.side).toLowerCase() === 'buy';

      if (fee > 0 && feeAsset) {
        feeTotals[feeAsset] = (feeTotals[feeAsset] || 0) + fee;
      }

      if (isBuy) {
        totalGrossBuyQty += qty;
        totalBuyVolume += tradeSum;
        let netReceivedCoin = qty;
        let costInQuote = tradeSum;

        // For BUY: reduce netReceivedCoin if fee_asset === baseAsset
        if (feeAsset === baseAsset || feeAsset === 'BTC' || feeAsset === 'ETH' || feeAsset === 'ICP' || feeAsset === 'DASH' || feeAsset === 'SLVON') {
          netReceivedCoin = Math.max(0, qty - fee);
        } else {
          costInQuote += fee;
        }

        if (netReceivedCoin > 0) {
          buyQueue.push({
            remainingNetQty: netReceivedCoin,
            price,
            unitCostInQuote: costInQuote / netReceivedCoin,
          });
        }
      } else {
        totalGrossSellQty += qty;
        totalSellVolume += tradeSum;
        let sellQtyToMatch = qty;
        let netSellRevenue = tradeSum;

        // For SELL: deduct fee from revenue if fee_asset === quoteAsset
        if (feeAsset === quoteAsset) {
          netSellRevenue -= fee;
        }

        const effectiveSellUnit = qty > 0 ? (netSellRevenue / qty) : price;

        // FIFO matching
        while (sellQtyToMatch > 1e-8 && buyQueue.length > 0) {
          const lot = buyQueue[0];
          const matched = Math.min(sellQtyToMatch, lot.remainingNetQty);

          const lotCost = matched * lot.unitCostInQuote;
          const lotRev = matched * effectiveSellUnit;

          realizedPnL += (lotRev - lotCost);
          closedCost += lotCost;

          lot.remainingNetQty -= matched;
          sellQtyToMatch -= matched;

          if (lot.remainingNetQty <= 1e-8) {
            buyQueue.shift();
          }
        }
      }
    }

    const netHoldingQty = buyQueue.reduce((acc, l) => acc + l.remainingNetQty, 0);
    const openCostBasis = buyQueue.reduce((acc, l) => acc + (l.remainingNetQty * l.unitCostInQuote), 0);
    const avgBuyPrice = totalGrossBuyQty > 0 ? totalBuyVolume / totalGrossBuyQty : 0;
    const costBasisPerUnit = netHoldingQty > 0 ? openCostBasis / netHoldingQty : avgBuyPrice;

    // Break-even price with 0.2% estimated exit fee
    const exitFeeRate = 0.002;
    const breakEvenPrice = netHoldingQty > 0 
      ? openCostBasis / (netHoldingQty * (1 - exitFeeRate)) 
      : costBasisPerUnit;

    const roiPercent = closedCost > 0 ? (realizedPnL / closedCost) * 100 : 0;

    positions.push({
      symbol,
      baseAsset,
      quoteAsset,
      totalGrossBuyQty,
      totalGrossSellQty,
      netHoldingQty,
      avgBuyPrice,
      costBasisPerUnit,
      breakEvenPrice,
      realizedPnL,
      totalFeesPaid: feeTotals,
      roiPercent,
      totalBuyVolume,
      totalSellVolume,
      openCostBasis,
    });
  });

  return positions;
}

/**
 * 4. محاسبه سود و زیان و عملکرد تجمیعی کل پورتفوی (Aggregate Portfolio PnL)
 */
export function calculateAggregatePnL(
  positions: PositionAnalysis[],
  trades: WallexRawTrade[],
  usdtTmnRate = 268000
): AggregatePortfolioPnL {
  let totalRealizedPnL_TMN = 0;
  let totalRealizedPnL_USDT = 0;

  let totalBuyVolume_TMN = 0;
  let totalSellVolume_TMN = 0;
  let totalBuyVolume_USDT = 0;
  let totalSellVolume_USDT = 0;

  let totalOpenPositionsCost_TMN = 0;
  let totalOpenPositionsCost_USDT = 0;

  const totalFeesByAsset: Record<string, number> = {};

  let profitablePositionsCount = 0;
  let losingPositionsCount = 0;
  let breakEvenPositionsCount = 0;

  for (const pos of positions) {
    if (pos.quoteAsset === 'USDT') {
      totalRealizedPnL_USDT += pos.realizedPnL;
      totalBuyVolume_USDT += pos.totalBuyVolume;
      totalSellVolume_USDT += pos.totalSellVolume;
      totalOpenPositionsCost_USDT += pos.openCostBasis;
    } else {
      totalRealizedPnL_TMN += pos.realizedPnL;
      totalBuyVolume_TMN += pos.totalBuyVolume;
      totalSellVolume_TMN += pos.totalSellVolume;
      totalOpenPositionsCost_TMN += pos.openCostBasis;
    }

    // Merge fees
    for (const [fAsset, fVal] of Object.entries(pos.totalFeesPaid)) {
      totalFeesByAsset[fAsset] = (totalFeesByAsset[fAsset] || 0) + fVal;
    }

    // Profitability breakdown
    if (pos.realizedPnL > 1) {
      profitablePositionsCount++;
    } else if (pos.realizedPnL < -1) {
      losingPositionsCount++;
    } else {
      breakEvenPositionsCount++;
    }
  }

  const totalRealizedPnL_CombinedTMN = totalRealizedPnL_TMN + (totalRealizedPnL_USDT * usdtTmnRate);
  const totalTradeVolume_CombinedTMN = totalBuyVolume_TMN + totalSellVolume_TMN + ((totalBuyVolume_USDT + totalSellVolume_USDT) * usdtTmnRate);
  const totalOpenPositionsCost_CombinedTMN = totalOpenPositionsCost_TMN + (totalOpenPositionsCost_USDT * usdtTmnRate);

  // Estimate total fee impact in TMN
  let totalFeesEstimated_TMN = (totalFeesByAsset['TMN'] || 0) + ((totalFeesByAsset['USDT'] || 0) * usdtTmnRate);
  if (totalFeesByAsset['ICP']) totalFeesEstimated_TMN += totalFeesByAsset['ICP'] * 850000;
  if (totalFeesByAsset['DASH']) totalFeesEstimated_TMN += totalFeesByAsset['DASH'] * 15800000;
  if (totalFeesByAsset['SLVON']) totalFeesEstimated_TMN += totalFeesByAsset['SLVON'] * 14114000;

  const totalInvestedCapital = totalBuyVolume_TMN + (totalBuyVolume_USDT * usdtTmnRate);
  const overallPortfolioROI_Percent = totalInvestedCapital > 0 
    ? (totalRealizedPnL_CombinedTMN / totalInvestedCapital) * 100 
    : 0;

  return {
    totalRealizedPnL_TMN,
    totalRealizedPnL_USDT,
    totalRealizedPnL_CombinedTMN,
    totalBuyVolume_TMN,
    totalSellVolume_TMN,
    totalBuyVolume_USDT,
    totalSellVolume_USDT,
    totalTradeVolume_CombinedTMN,
    totalOpenPositionsCost_TMN,
    totalOpenPositionsCost_USDT,
    totalOpenPositionsCost_CombinedTMN,
    totalFeesByAsset,
    totalFeesEstimated_TMN,
    totalTradesCount: trades.length,
    activePositionsCount: positions.length,
    profitablePositionsCount,
    losingPositionsCount,
    breakEvenPositionsCount,
    overallPortfolioROI_Percent,
    usdtTmnRate,
  };
}

/**
 * 5. syncWallexPortfolio:
 * - Fetches all global latest trades and per-market trades
 * - Flattens into a single array
 * - Returns per-position analysis AND aggregate portfolio P&L
 */
export async function syncWallexPortfolio(apiKey: string): Promise<WallexPortfolioResult> {
  const globalTrades = await fetchWallexTradesForSymbolPages(apiKey);
  let allTrades = globalTrades;

  if (allTrades.length === 0) {
    const markets = await fetchWallexMarkets();
    const allSymbols = markets.map(m => m.symbol.toUpperCase());
    const batchSize = 4;
    for (let i = 0; i < allSymbols.length; i += batchSize) {
      const batch = allSymbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(sym => fetchWallexTradesForSymbolPages(apiKey, sym))
      );
      for (const tradeList of batchResults) {
        if (tradeList.length > 0) {
          allTrades.push(...tradeList);
        }
      }
    }
  }

  const positions = calculatePositionsPnL(allTrades);
  const aggregate = calculateAggregatePnL(positions, allTrades);

  return {
    positions,
    aggregate,
    trades: allTrades,
  };
}

/**
 * Returns clean TradeRecord array directly from market symbols trades
 */
export async function syncWallexRawTrades(
  apiKey: string,
  dateRange?: { startDate?: string; endDate?: string }
): Promise<TradeRecord[]> {
  let rawTrades = await fetchWallexTradesForSymbolPages(apiKey);

  if (rawTrades.length === 0) {
    const markets = await fetchWallexMarkets();
    const allSymbols = markets.map(m => m.symbol.toUpperCase());
    const batchSize = 4;
    for (let i = 0; i < allSymbols.length; i += batchSize) {
      const batch = allSymbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(sym => fetchWallexTradesForSymbolPages(apiKey, sym))
      );
      for (const tradeList of batchResults) {
        if (tradeList.length > 0) {
          rawTrades.push(...tradeList);
        }
      }
    }
  }

  const allTrades: TradeRecord[] = [];

  for (const t of rawTrades) {
    const price = parseFloat(String(t.price)) || 0;
    const qty = parseFloat(String(t.quantity)) || 0;
    const sum = parseFloat(String(t.sum || '0')) || (price * qty);
    const fee = parseFloat(String(t.fee || '0')) || 0;
    const isToman = t.symbol.endsWith('TMN') || t.symbol.endsWith('IRT');

    const formattedSymbol = t.symbol.endsWith('TMN')
      ? `${t.symbol.replace('TMN', '')}/TMN`
      : t.symbol.endsWith('USDT')
        ? `${t.symbol.replace('USDT', '')}/USDT`
        : t.symbol;

    const tradeSide = (String(t.side).toLowerCase() === 'buy') ? 'BUY' : 'SELL';

    allTrades.push({
      id: `wallex-trade-${t.id}`,
      orderId: `ORD-WLX-${t.id}`,
      symbol: formattedSymbol,
      date: (t.created_at || new Date().toISOString()).replace('T', ' ').substring(0, 19),
      side: tradeSide,
      price,
      quantity: qty,
      total: sum,
      fee,
      feeAsset: t.fee_asset || (isToman ? 'TMN' : 'USDT'),
      currency: isToman ? 'TMN' : 'USD',
      rawPiiRemoved: ['Wallex_x_api_key', 'User_IP', 'National_ID'],
    });
  }

  // Filter by date range if specified
  let finalTrades = allTrades;
  if (dateRange && (dateRange.startDate || dateRange.endDate)) {
    const startMs = dateRange.startDate ? new Date(dateRange.startDate).getTime() : 0;
    const endMs = dateRange.endDate ? new Date(dateRange.endDate + ' 23:59:59').getTime() : Infinity;

    finalTrades = allTrades.filter(t => {
      const tMs = new Date(t.date).getTime();
      return tMs >= startMs && tMs <= endMs;
    });
  }

  finalTrades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return finalTrades;
}

export function findWallexMarket(
  markets: WallexMarket[],
  rawSymbol: string,
  preferredQuote?: string
): WallexMarket | undefined {
  if (!rawSymbol || !markets || markets.length === 0) return undefined;

  const quote = preferredQuote?.toUpperCase() || (rawSymbol.toUpperCase().includes('USDT') ? 'USDT' : 'TMN');
  const compact = rawSymbol.replace(/[\/\-_ ]/g, '').toUpperCase();

  const exact = markets.find(m => m.symbol.toUpperCase() === compact);
  if (exact) return exact;

  const parts = rawSymbol.split(/[\/\-_ ]/);
  const base = parts[0].trim().toUpperCase();

  const baseQuoteMatch = markets.find(
    m => m.base_asset.toUpperCase() === base && m.quote_asset.toUpperCase() === quote
  );
  if (baseQuoteMatch) return baseQuoteMatch;

  const baseOnlyMatch = markets.find(m => m.base_asset.toUpperCase() === base);
  if (baseOnlyMatch) return baseOnlyMatch;

  return undefined;
}
