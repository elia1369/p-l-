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

export interface SavedPortfolio {
  id: string;
  name: string;
  savedAt: string;
  tradesCount: number;
  assetsCount: number;
  totalVolume: number;
  netPnL: number;
  trades: TradeRecord[];
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'ABOVE' | 'BELOW' | 'PNL_PROFIT' | 'PNL_LOSS';
  targetValue: number;
  currency: CurrencyKind;
  note?: string;
  createdAt: string;
  isActive: boolean;
}

export interface TaxFiscalYearReport {
  year: string;
  totalGrossProfit: number;
  totalGrossLoss: number;
  netTaxableGain: number;
  totalTradingFeesDeduction: number;
  estimatedTaxPayable: number;
  taxBracketPercent: number;
}

export interface WallexApiConfig {
  apiKey?: string;
  apiSecret?: string;
  isConnected: boolean;
  lastSyncAt?: string;
  autoSyncEnabled?: boolean;
}

export interface TradeJournalEntry {
  id: string;
  date: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'REVIEW';
  pnl?: number;
  emotion: 'LOGICAL' | 'GREED' | 'FEAR' | 'FOMO' | 'DISCIPLINED';
  lesson: string;
  strategyTag: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  phoneNumber?: string;
  memberTier: 'Standard' | 'Pro Trader' | 'VIP';
  createdAt: string;
  lastLoginAt?: string;
  savedPortfolios: SavedPortfolio[];
  watchlist: string[];
  notes?: string;
  wallexApi?: WallexApiConfig;
  alerts?: PriceAlert[];
  journalEntries?: TradeJournalEntry[];
}
