import { TradeRecord, AssetAnalysis, PortfolioSummary } from '../types';
import { detectCurrency } from './i18n';

/**
 * Ensures fees are realistic and not accidentally multiplied by price or corrupted
 */
export function getSanitizedTradeFee(trade: { price: number; quantity: number; fee?: number }): number {
  let fee = trade.fee || 0;
  const p = Number(trade.price) || 0;
  const q = Number(trade.quantity) || 0;
  const gross = p * q;
  // If fee is greater than 10% of gross trade turnover, it was likely miscalculated or multiplied by price accidentally
  if (gross > 0 && fee > gross * 0.1) {
    if (p > 0 && (fee / p) <= gross * 0.05) {
      fee = fee / p;
    } else {
      fee = gross * 0.002; // standard 0.2% fee fallback
    }
  }
  return fee;
}

/**
 * Calculates per-asset metrics including:
 * - Average Buy Price
 * - Average Sell Price
 * - Total Fees Paid
 * - Breakeven Price (Cost-Basis including fees)
 * - Realized & Unrealized P&L
 * - Comparison with Current Market Price
 */
export function calculateAssetAnalyses(
  trades: TradeRecord[],
  customCurrentPrices: Record<string, number> = {}
): AssetAnalysis[] {
  // Group trades by normalized symbol
  const grouped = new Map<string, TradeRecord[]>();
  
  trades.forEach(trade => {
    const sym = trade.symbol.trim().toUpperCase() || 'UNKNOWN';
    if (!grouped.has(sym)) {
      grouped.set(sym, []);
    }
    grouped.get(sym)!.push(trade);
  });

  const results: AssetAnalysis[] = [];

  grouped.forEach((assetTrades, symbol) => {
    let totalBuyQty = 0;
    let totalBuyCost = 0;
    let buyTradesCount = 0;
    let buyFees = 0;

    let totalSellQty = 0;
    let totalSellRevenue = 0;
    let sellTradesCount = 0;
    let sellFees = 0;

    let firstTradeDate: string | undefined;
    let lastTradeDate: string | undefined;

    // Stable chronological sort: preserves original index order if dates are identical
    const sortedTrades = assetTrades
      .map((t, idx) => ({ trade: t, originalIdx: idx }))
      .sort((a, b) => {
        const timeA = new Date(a.trade.date).getTime() || 0;
        const timeB = new Date(b.trade.date).getTime() || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.originalIdx - b.originalIdx;
      })
      .map(item => item.trade);

    if (sortedTrades.length > 0) {
      firstTradeDate = sortedTrades[0].date;
      lastTradeDate = sortedTrades[sortedTrades.length - 1].date;
    }

    // Separate BUY and SELL metrics and collect fee totals per side
    sortedTrades.forEach(trade => {
      const tradeFee = getSanitizedTradeFee(trade);
      if (trade.side === 'BUY') {
        buyTradesCount++;
        totalBuyQty += trade.quantity;
        totalBuyCost += trade.price * trade.quantity;
        buyFees += tradeFee;
      } else if (trade.side === 'SELL') {
        sellTradesCount++;
        totalSellQty += trade.quantity;
        totalSellRevenue += trade.price * trade.quantity;
        sellFees += tradeFee;
      }
    });

    const totalFees = buyFees + sellFees;
    const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
    const avgSellPrice = totalSellQty > 0 ? totalSellRevenue / totalSellQty : 0;
    const netQty = totalBuyQty - totalSellQty;

    // FIFO Sequential matching algorithm for accurate Realized P&L:
    // Tracks open buy inventory lots with remaining quantity, unit price, and fee basis
    interface BuyLot {
      remainingQty: number;
      price: number;
      unitFee: number;
    }
    const buyQueue: BuyLot[] = [];
    let realizedPnL = 0;
    let closedBuyCost = 0;
    let closedBuyFees = 0;
    let closedSellFees = 0;

    sortedTrades.forEach(trade => {
      const tradeFee = getSanitizedTradeFee(trade);
      if (trade.side === 'BUY') {
        if (trade.quantity > 0) {
          buyQueue.push({
            remainingQty: trade.quantity,
            price: trade.price,
            unitFee: tradeFee / trade.quantity,
          });
        }
      } else if (trade.side === 'SELL') {
        let sellQtyToMatch = trade.quantity;
        const sellPrice = trade.price;
        const sellUnitFee = trade.quantity > 0 ? tradeFee / trade.quantity : 0;

        while (sellQtyToMatch > 0.00000001 && buyQueue.length > 0) {
          const currentLot = buyQueue[0];
          const matchedQty = Math.min(sellQtyToMatch, currentLot.remainingQty);

          const lotGrossPnL = matchedQty * (sellPrice - currentLot.price);
          const lotBuyFee = matchedQty * currentLot.unitFee;
          const lotSellFee = matchedQty * sellUnitFee;

          realizedPnL += (lotGrossPnL - lotBuyFee - lotSellFee);
          closedBuyCost += matchedQty * currentLot.price;
          closedBuyFees += lotBuyFee;
          closedSellFees += lotSellFee;

          currentLot.remainingQty -= matchedQty;
          sellQtyToMatch -= matchedQty;

          if (currentLot.remainingQty <= 0.00000001) {
            buyQueue.shift();
          }
        }

        // If selling more than bought (short position or missing prior buy),
        // charge sell fee for the unmatched portion
        if (sellQtyToMatch > 0.00000001) {
          const unmatchedSellFee = sellQtyToMatch * sellUnitFee;
          realizedPnL -= unmatchedSellFee;
          closedSellFees += unmatchedSellFee;
        }
      }
    });

    // Unsold position and remaining fees for open lots
    const remainingOpenFees = buyQueue.reduce((sum, lot) => sum + (lot.remainingQty * lot.unitFee), 0);
    const remainingOpenCost = buyQueue.reduce((sum, lot) => sum + (lot.remainingQty * lot.price), 0);

    // Breakeven price calculation:
    // Breakeven price = (Unsold cost basis + unrecovered buy fees + anticipated exit fee) / remaining net quantity
    let breakevenPrice = 0;
    if (netQty > 0.000001) {
      breakevenPrice = (remainingOpenCost + remainingOpenFees) / netQty;
    } else if (netQty < -0.000001) {
      // Short position breakeven
      breakevenPrice = avgSellPrice;
    } else {
      // Fully closed: breakeven is effectively the avg buy price
      breakevenPrice = avgBuyPrice || avgSellPrice;
    }

    // Determine current market price:
    // 1. User entered custom price
    // 2. Fallback to last executed trade price, or avgBuyPrice
    let currentPrice = customCurrentPrices[symbol];
    if (currentPrice === undefined || currentPrice === null || currentPrice <= 0) {
      const lastTrade = sortedTrades[sortedTrades.length - 1];
      currentPrice = lastTrade ? lastTrade.price : (avgBuyPrice || avgSellPrice);
    }

    // Unrealized P&L on remaining open positions:
    // Market value of open lots - (Cost basis + open buy fees)
    let unrealizedPnL = 0;
    if (netQty > 0.000001) {
      unrealizedPnL = (currentPrice * netQty) - (remainingOpenCost + remainingOpenFees);
    } else if (netQty < -0.000001) {
      unrealizedPnL = (breakevenPrice - currentPrice) * Math.abs(netQty);
    }

    const netPnL = realizedPnL + unrealizedPnL;
    const capitalBase = totalBuyCost > 0 ? totalBuyCost : totalSellRevenue;
    const roiPercent = capitalBase > 0 ? (netPnL / capitalBase) * 100 : 0;

    let status: 'PROFIT' | 'LOSS' | 'BREAKEVEN' = 'BREAKEVEN';
    if (netPnL > 0.01) status = 'PROFIT';
    else if (netPnL < -0.01) status = 'LOSS';

    results.push({
      symbol,
      currency: detectCurrency(symbol),
      totalBuyQty,
      totalBuyCost,
      avgBuyPrice,
      buyFees,
      totalSellQty,
      totalSellRevenue,
      avgSellPrice,
      sellFees,
      totalFees,
      netQty,
      breakevenPrice,
      currentPrice,
      realizedPnL,
      unrealizedPnL,
      netPnL,
      roiPercent,
      status,
      tradesCount: assetTrades.length,
      buyTradesCount,
      sellTradesCount,
      firstTradeDate,
      lastTradeDate,
    });
  });

  return results.sort((a, b) => b.totalBuyCost + b.totalSellRevenue - (a.totalBuyCost + a.totalSellRevenue));
}

/**
 * Calculates overall aggregated portfolio summary
 */
export function calculatePortfolioSummary(
  assetAnalyses: AssetAnalysis[],
  trades: TradeRecord[]
): PortfolioSummary {
  let totalBuyValue = 0;
  let totalSellValue = 0;
  let totalFeesPaid = 0;
  let buyFeesPaid = 0;
  let sellFeesPaid = 0;
  let realizedPnL = 0;
  let unrealizedPnL = 0;
  let openPositionsCount = 0;
  let profitableAssetsCount = 0;
  let losingAssetsCount = 0;

  trades.forEach(t => {
    const fee = getSanitizedTradeFee(t);
    totalFeesPaid += fee;
    if (t.side === 'BUY') {
      totalBuyValue += t.price * t.quantity;
      buyFeesPaid += fee;
    } else {
      totalSellValue += t.price * t.quantity;
      sellFeesPaid += fee;
    }
  });

  assetAnalyses.forEach(asset => {
    realizedPnL += asset.realizedPnL;
    unrealizedPnL += asset.unrealizedPnL;
    if (Math.abs(asset.netQty) > 0.0001) {
      openPositionsCount++;
    }
    if (asset.netPnL > 0.01) {
      profitableAssetsCount++;
    } else if (asset.netPnL < -0.01) {
      losingAssetsCount++;
    }
  });

  const totalNetPnL = realizedPnL + unrealizedPnL;
  const investedCapital = totalBuyValue > 0 ? totalBuyValue : totalSellValue;
  const netPortfolioReturn = investedCapital > 0 ? (totalNetPnL / investedCapital) * 100 : 0;

  // Determine dominant portfolio currency: if any or majority of trades are in Toman (TMN), use TMN
  let tmnTradesCount = 0;
  let usdTradesCount = 0;
  trades.forEach(t => {
    if (detectCurrency(t.symbol) === 'TMN') {
      tmnTradesCount++;
    } else {
      usdTradesCount++;
    }
  });
  const primaryCurrency: 'TMN' | 'USD' = tmnTradesCount > 0 && tmnTradesCount >= usdTradesCount ? 'TMN' : 'USD';
  const hasTomanTrades = tmnTradesCount > 0;
  const hasUsdTrades = usdTradesCount > 0;

  // Separate calculations for Toman assets & trades
  let tmnSummary = undefined;
  if (hasTomanTrades) {
    const tmnTrades = trades.filter(t => detectCurrency(t.symbol) === 'TMN');
    const tmnAssets = assetAnalyses.filter(a => a.currency === 'TMN');
    let tmnBuyVal = 0;
    let tmnSellVal = 0;
    let tmnFees = 0;
    let tmnBuyFees = 0;
    let tmnSellFees = 0;
    tmnTrades.forEach(t => {
      const fee = getSanitizedTradeFee(t);
      tmnFees += fee;
      if (t.side === 'BUY') {
        tmnBuyVal += t.price * t.quantity;
        tmnBuyFees += fee;
      } else {
        tmnSellVal += t.price * t.quantity;
        tmnSellFees += fee;
      }
    });
    const tmnRealized = tmnAssets.reduce((sum, a) => sum + a.realizedPnL, 0);
    const tmnUnrealized = tmnAssets.reduce((sum, a) => sum + a.unrealizedPnL, 0);
    const tmnNetPnL = tmnRealized + tmnUnrealized;
    const tmnCap = tmnBuyVal > 0 ? tmnBuyVal : tmnSellVal;
    tmnSummary = {
      currency: 'TMN' as const,
      totalTrades: tmnTrades.length,
      totalBuyValue: tmnBuyVal,
      totalSellValue: tmnSellVal,
      totalFeesPaid: tmnFees,
      buyFeesPaid: tmnBuyFees,
      sellFeesPaid: tmnSellFees,
      realizedPnL: tmnRealized,
      unrealizedPnL: tmnUnrealized,
      totalNetPnL: tmnNetPnL,
      netPortfolioReturn: tmnCap > 0 ? (tmnNetPnL / tmnCap) * 100 : 0,
      assetsCount: tmnAssets.length,
    };
  }

  // Separate calculations for USD assets & trades
  let usdSummary = undefined;
  if (hasUsdTrades) {
    const usdTrades = trades.filter(t => detectCurrency(t.symbol) === 'USD');
    const usdAssets = assetAnalyses.filter(a => a.currency === 'USD');
    let usdBuyVal = 0;
    let usdSellVal = 0;
    let usdFees = 0;
    let usdBuyFees = 0;
    let usdSellFees = 0;
    usdTrades.forEach(t => {
      const fee = getSanitizedTradeFee(t);
      usdFees += fee;
      if (t.side === 'BUY') {
        usdBuyVal += t.price * t.quantity;
        usdBuyFees += fee;
      } else {
        usdSellVal += t.price * t.quantity;
        usdSellFees += fee;
      }
    });
    const usdRealized = usdAssets.reduce((sum, a) => sum + a.realizedPnL, 0);
    const usdUnrealized = usdAssets.reduce((sum, a) => sum + a.unrealizedPnL, 0);
    const usdNetPnL = usdRealized + usdUnrealized;
    const usdCap = usdBuyVal > 0 ? usdBuyVal : usdSellVal;
    usdSummary = {
      currency: 'USD' as const,
      totalTrades: usdTrades.length,
      totalBuyValue: usdBuyVal,
      totalSellValue: usdSellVal,
      totalFeesPaid: usdFees,
      buyFeesPaid: usdBuyFees,
      sellFeesPaid: usdSellFees,
      realizedPnL: usdRealized,
      unrealizedPnL: usdUnrealized,
      totalNetPnL: usdNetPnL,
      netPortfolioReturn: usdCap > 0 ? (usdNetPnL / usdCap) * 100 : 0,
      assetsCount: usdAssets.length,
    };
  }

  // If dominant currency is TMN, use TMN summary as the base to avoid mixed-currency numbers
  const dominantSummary = primaryCurrency === 'TMN' && tmnSummary ? tmnSummary : (usdSummary || tmnSummary);

  return {
    totalTrades: trades.length,
    totalBuyValue: dominantSummary ? dominantSummary.totalBuyValue : totalBuyValue,
    totalSellValue: dominantSummary ? dominantSummary.totalSellValue : totalSellValue,
    totalFeesPaid: dominantSummary ? dominantSummary.totalFeesPaid : totalFeesPaid,
    buyFeesPaid: dominantSummary ? dominantSummary.buyFeesPaid : buyFeesPaid,
    sellFeesPaid: dominantSummary ? dominantSummary.sellFeesPaid : sellFeesPaid,
    realizedPnL: dominantSummary ? dominantSummary.realizedPnL : realizedPnL,
    unrealizedPnL: dominantSummary ? dominantSummary.unrealizedPnL : unrealizedPnL,
    totalNetPnL: dominantSummary ? dominantSummary.totalNetPnL : totalNetPnL,
    netPortfolioReturn: dominantSummary ? dominantSummary.netPortfolioReturn : netPortfolioReturn,
    assetsCount: assetAnalyses.length,
    openPositionsCount,
    profitableAssetsCount,
    losingAssetsCount,
    primaryCurrency,
    hasTomanTrades,
    hasUsdTrades,
    tmnSummary,
    usdSummary,
  };
}
