export type Language = 'fa' | 'en';
export type ThemeMode = 'dark' | 'light';

export type TradeSide = 'BUY' | 'SELL';

export type CurrencyKind = 'TMN' | 'USD';

export interface TradeRecord {
  id: string;
  date: string;
  symbol: string;
  side: TradeSide;
  price: number;
  quantity: number;
  total: number;
  fee: number;
  feeAsset?: string;
  orderId?: string;
  rawPiiRemoved?: string[];
  currency?: CurrencyKind;
}

export interface AssetAnalysis {
  symbol: string;
  currency: CurrencyKind;
  totalBuyQty: number;
  totalBuyCost: number;
  avgBuyPrice: number;
  buyFees: number; // Fees paid specifically on BUY orders
  totalSellQty: number;
  totalSellRevenue: number;
  avgSellPrice: number;
  sellFees: number; // Fees paid specifically on SELL orders
  totalFees: number;
  netQty: number; // Remaining position balance
  breakevenPrice: number; // Price required to exit remaining balance without loss (including remaining fees)
  currentPrice: number; // Entered by user or default
  realizedPnL: number; // Closed trades profit/loss
  unrealizedPnL: number; // (currentPrice - avgBuyPrice) * netQty - remainingFees
  netPnL: number; // Realized + Unrealized - totalFees
  roiPercent: number; // ROI percentage
  status: 'PROFIT' | 'LOSS' | 'BREAKEVEN';
  tradesCount: number;
  buyTradesCount: number;
  sellTradesCount: number;
  firstTradeDate?: string;
  lastTradeDate?: string;
}

export interface CurrencySummary {
  currency: CurrencyKind;
  totalTrades: number;
  totalBuyValue: number;
  totalSellValue: number;
  totalFeesPaid: number;
  buyFeesPaid: number;
  sellFeesPaid: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalNetPnL: number;
  netPortfolioReturn: number;
  assetsCount: number;
}

export interface PortfolioSummary {
  totalTrades: number;
  totalBuyValue: number;
  totalSellValue: number;
  totalFeesPaid: number;
  buyFeesPaid?: number;
  sellFeesPaid?: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalNetPnL: number;
  netPortfolioReturn: number;
  assetsCount: number;
  openPositionsCount: number;
  profitableAssetsCount: number;
  losingAssetsCount: number;
  primaryCurrency: CurrencyKind;
  hasTomanTrades: boolean;
  hasUsdTrades: boolean;
  tmnSummary?: CurrencySummary;
  usdSummary?: CurrencySummary;
}

export interface PIIReport {
  columnsSanitized: string[];
  rowsScanned: number;
  sensitiveValuesDetected: number;
  clientOnlyVerified: boolean;
  scanTimestamp: string;
}

export interface ParsedExcelResult {
  trades: TradeRecord[];
  piiReport: PIIReport;
  rawHeaders: string[];
  fileName: string;
}
