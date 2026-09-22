import React, { useState, useMemo } from 'react';
import { 
  ClipboardPaste, 
  Coins, 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  PlusCircle, 
  TrendingUp, 
  DollarSign,
  Layers,
  RotateCcw,
  Sparkles,
  Table,
  Sliders,
  Trash2,
  HelpCircle,
  Calculator,
  Info,
  ArrowRight
} from 'lucide-react';
import { TradeRecord, Language, CurrencyKind } from '../types';
import { formatCurrency, formatPercent, formatNumber } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';

interface Props {
  lang: Language;
  onApplyManualData: (trades: TradeRecord[], symbol: string, currency: CurrencyKind) => void;
  customPrices?: Record<string, number>;
  onUpdatePrice?: (symbol: string, newPrice: number) => void;
}

/**
 * Normalizes Persian and Arabic numerals to standard English 0-9 digits.
 */
export function normalizeDigits(str: string): string {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.split(persianDigits[i]).join(String(i));
    res = res.split(arabicDigits[i]).join(String(i));
  }
  return res;
}

/**
 * Normalizes Persian/European decimals (slash, comma, momayyez) to standard dots.
 * Distinguishes thousand separators (e.g. 710,000) from decimal separators (e.g. 0,002 or 1,5).
 */
export function normalizeDecimals(str: string): string {
  if (!str) return '';
  let s = normalizeDigits(str);
  // Persian momayyez (٫) -> dot
  s = s.replace(/٫/g, '.');
  // Slash between digits (e.g. 0/002 or 1/5 or ۰/۵) -> dot
  s = s.replace(/(\d)\/(\d)/g, '$1.$2');
  // Comma starting with zero (e.g. 0,002 or 0,015) -> ALWAYS decimal dot
  s = s.replace(/\b0,(\d+)\b/g, '0.$1');
  // Comma followed by 1 or 2 digits (e.g. 1,5 or 12,75) -> ALWAYS decimal dot
  s = s.replace(/(\d),(\d{1,2})\b/g, '$1.$2');
  // Comma followed by 4+ digits (e.g. 0,00025) -> decimal dot
  s = s.replace(/(\d),(\d{4,})\b/g, '$1.$2');
  return s;
}

/**
 * Cleans and parses a single numeric string.
 */
export function cleanNumber(str: string): number {
  if (!str) return 0;
  let clean = normalizeDecimals(str);
  clean = clean.replace(/تومان|تومن|تتر|ریال|TMN|USDT|USD|IRR|\$/gi, '');
  clean = clean.replace(/[,\s٬']/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * Smartly tokenizes free-form text into an array of numbers.
 * Supports:
 * - Coin decimals (0.002, 0/002, 0,002)
 * - Thousand separated numbers (710,000)
 * - Space, comma, tab, newline, or mixed delimiters
 */
export function extractNumbersList(text: string): number[] {
  if (!text || !text.trim()) return [];

  let str = normalizeDecimals(text);
  // Standardize remaining Persian thousand separators
  str = str.replace(/[٬']/g, ',');
  // Strip currency words
  str = str.replace(/تومان|تومن|تتر|ریال|ریالی|TMN|USDT|USD|\$|IRR/gi, ' ');

  // Regex matches:
  // 1. Numbers with thousand commas (e.g. 710,000 or 1,420,000.5)
  // 2. Standard decimal/integers (e.g. 0.002, 1.5, 710000)
  const regex = /(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g;
  const matches = str.match(regex);
  if (!matches) return [];

  const results: number[] = [];
  for (const m of matches) {
    const cleaned = m.replace(/,/g, '');
    const val = parseFloat(cleaned);
    if (!isNaN(val) && val > 0) {
      results.push(val);
    }
  }
  return results;
}

export type ColumnMappingType = 
  | 'PRICE_QTY_FEE' 
  | 'PRICE_FEE' 
  | 'PRICE_TOTAL_FEE' 
  | 'INDEX_PRICE_QTY_FEE'
  | 'FEE_PRICE_QTY'
  | 'PRICE_FEE_QTY';

export type VolumeInputType = 'COIN_QTY' | 'TOTAL_SPEND';
export type FeeUnitType = 'COIN' | 'CURRENCY';
export type FeeDeductionMode = 'DEDUCT_FROM_COIN' | 'ADD_TO_TOTAL_COST';

export interface ParsedItem {
  id: string;
  index: number;
  price: number;
  rawVolume: number;
  rawFee: number;
  // Computed values
  quantity: number;
  feeCoin: number;
  feeCurrency: number;
  grossBuyCost: number;
  totalCostWithFee: number;
  netReceivedQuantity: number;
  rowCostBasisPerUnit: number;
}

export const ManualBatchInputCard: React.FC<Props> = ({
  lang,
  onApplyManualData,
  customPrices = {},
  onUpdatePrice,
}) => {
  const isFa = lang === 'fa';

  // Input Mode: All-in-One Table Paste (Single Box) vs Separate Columns (Multi-Box)
  const [pasteMode, setPasteMode] = useState<'ALL_IN_ONE' | 'SEPARATE'>('ALL_IN_ONE');

  // Asset Settings
  const [assetName, setAssetName] = useState('ICP');
  const [currency, setCurrency] = useState<CurrencyKind>('TMN');
  const [livePriceText, setLivePriceText] = useState('');

  // Formula & Accounting Settings
  // 1. Fee Unit: 'COIN' (Default: fee is in coin and multiplied by price) vs 'CURRENCY' (fee is already in TMN)
  const [feeUnit, setFeeUnit] = useState<FeeUnitType>('COIN');
  // 2. Volume Input Type: 'COIN_QTY' (Quantity in coins, e.g. 10 ICP) vs 'TOTAL_SPEND' (Total amount in TMN, e.g. 7,100,000)
  const [volumeInputType, setVolumeInputType] = useState<VolumeInputType>('COIN_QTY');
  // 3. Fee Accounting: 'DEDUCT_FROM_COIN' (Exchange took fee from purchased coins) vs 'ADD_TO_TOTAL_COST'
  const [feeDeductionMode, setFeeDeductionMode] = useState<FeeDeductionMode>('DEDUCT_FROM_COIN');
  // Default volume if not provided
  const [defaultQtyPerTrade, setDefaultQtyPerTrade] = useState('1');

  // 1. All-in-One Raw Table Paste State
  const [tablePasteText, setTablePasteText] = useState('');
  const [columnMapping, setColumnMapping] = useState<ColumnMappingType>('PRICE_QTY_FEE');

  // 2. Separate Boxes State
  const [pricesText, setPricesText] = useState('');
  const [feesText, setFeesText] = useState('');
  const [quantitiesText, setQuantitiesText] = useState('');

  // Helper to compute a single row's values according to formula
  const computeRow = (
    index: number,
    price: number,
    rawVol: number,
    rawFee: number
  ): ParsedItem => {
    const fallbackQty = cleanNumber(defaultQtyPerTrade) || 1;
    const vol = rawVol > 0 ? rawVol : fallbackQty;

    // A. Quantity & Gross Cost calculation
    let quantity = 0;
    let grossBuyCost = 0;

    if (volumeInputType === 'COIN_QTY') {
      // Input is number of coins (e.g. 10 ICP)
      quantity = vol;
      grossBuyCost = price * vol;
    } else {
      // Input is total amount spent in TMN (e.g. 7,100,000 TMN)
      grossBuyCost = vol;
      quantity = price > 0 ? vol / price : 0;
    }

    // B. Fee calculation
    let feeCoin = 0;
    let feeCurrency = 0;

    if (feeUnit === 'COIN') {
      // Fee is in coin (e.g. 0.002 ICP) -> Multiply by price to get currency fee!
      feeCoin = rawFee;
      feeCurrency = rawFee * price;
    } else {
      // Fee is already in quote currency (TMN)
      feeCurrency = rawFee;
      feeCoin = price > 0 ? rawFee / price : 0;
    }

    // C. Total Cost and Cost Basis per Unit
    let totalCostWithFee = grossBuyCost;
    let netReceivedQuantity = quantity;
    let rowCostBasisPerUnit = price;

    if (feeDeductionMode === 'DEDUCT_FROM_COIN') {
      // Standard Spot Exchange: Fee is deducted from the purchased coins
      // User spent grossBuyCost, received (quantity - feeCoin)
      netReceivedQuantity = Math.max(0.00000001, quantity - feeCoin);
      totalCostWithFee = grossBuyCost;
      rowCostBasisPerUnit = netReceivedQuantity > 0 ? grossBuyCost / netReceivedQuantity : price;
    } else {
      // Fee added on top of purchase
      totalCostWithFee = grossBuyCost + feeCurrency;
      netReceivedQuantity = quantity;
      rowCostBasisPerUnit = quantity > 0 ? totalCostWithFee / quantity : price;
    }

    return {
      id: `row-${index}-${price}-${rawVol}`,
      index,
      price,
      rawVolume: vol,
      rawFee,
      quantity,
      feeCoin,
      feeCurrency,
      grossBuyCost,
      totalCostWithFee,
      netReceivedQuantity,
      rowCostBasisPerUnit,
    };
  };

  // Parsed Items from All-in-One Table Paste
  const allInOneItems = useMemo<ParsedItem[]>(() => {
    if (!tablePasteText.trim()) return [];
    const lines = tablePasteText.split(/[\n\r]+/);
    const fallbackQty = cleanNumber(defaultQtyPerTrade) || 1;
    const items: ParsedItem[] = [];

    lines.forEach((line) => {
      const nums = extractNumbersList(line);
      if (nums.length === 0) return;

      let p = 0;
      let vol = fallbackQty;
      let f = 0;

      switch (columnMapping) {
        case 'PRICE_QTY_FEE':
          // 1. Price, 2. Volume/Qty, 3. Fee in coin
          p = nums[0] || 0;
          if (nums.length >= 3) {
            vol = nums[1];
            f = nums[2];
          } else if (nums.length === 2) {
            // If only 2 numbers: assume Price and Fee
            f = nums[1];
          }
          break;
        case 'PRICE_FEE':
          // 1. Price, 2. Fee in coin
          p = nums[0] || 0;
          f = nums[1] || 0;
          if (nums[2] !== undefined) vol = nums[2];
          break;
        case 'PRICE_TOTAL_FEE':
          // 1. Price, 2. Total TMN spend, 3. Fee in coin
          p = nums[0] || 0;
          vol = nums[1] || fallbackQty;
          f = nums[2] || 0;
          break;
        case 'INDEX_PRICE_QTY_FEE':
          // 1. Row index, 2. Price, 3. Volume/Qty, 4. Fee in coin
          p = nums[1] || 0;
          vol = nums[2] || fallbackQty;
          f = nums[3] || 0;
          break;
        case 'FEE_PRICE_QTY':
          // 1. Fee, 2. Price, 3. Volume
          f = nums[0] || 0;
          p = nums[1] || 0;
          vol = nums[2] || fallbackQty;
          break;
        case 'PRICE_FEE_QTY':
          // 1. Price, 2. Fee, 3. Volume
          p = nums[0] || 0;
          f = nums[1] || 0;
          vol = nums[2] || fallbackQty;
          break;
      }

      if (p > 0) {
        items.push(computeRow(items.length + 1, p, vol, f));
      }
    });

    return items;
  }, [tablePasteText, columnMapping, defaultQtyPerTrade, volumeInputType, feeUnit, feeDeductionMode]);

  // Parsed Items from Separate Boxes
  const separateItems = useMemo<ParsedItem[]>(() => {
    const prices = extractNumbersList(pricesText);
    const fees = extractNumbersList(feesText);
    const quantities = extractNumbersList(quantitiesText);
    const fallbackQty = cleanNumber(defaultQtyPerTrade) || 1;

    return prices.map((price, idx) => {
      const vol = quantities[idx] !== undefined && quantities[idx] > 0 ? quantities[idx] : fallbackQty;
      const f = fees[idx] !== undefined ? fees[idx] : 0;
      return computeRow(idx + 1, price, vol, f);
    });
  }, [pricesText, feesText, quantitiesText, defaultQtyPerTrade, volumeInputType, feeUnit, feeDeductionMode]);

  // Active items based on current active tab
  const activeItems = pasteMode === 'ALL_IN_ONE' ? allInOneItems : separateItems;
  const totalTradesCount = activeItems.length;

  // Aggregate Metrics
  const totalGrossBuyCost = useMemo(() => {
    return activeItems.reduce((acc, item) => acc + item.grossBuyCost, 0);
  }, [activeItems]);

  const totalQuantity = useMemo(() => {
    return activeItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [activeItems]);

  const totalNetReceivedQuantity = useMemo(() => {
    return activeItems.reduce((acc, item) => acc + item.netReceivedQuantity, 0);
  }, [activeItems]);

  const totalFeeCoin = useMemo(() => {
    return activeItems.reduce((acc, item) => acc + item.feeCoin, 0);
  }, [activeItems]);

  const totalFeeCurrency = useMemo(() => {
    return activeItems.reduce((acc, item) => acc + item.feeCurrency, 0);
  }, [activeItems]);

  // Total Monetary Cost (Buy value + fees)
  const totalCostWithFees = useMemo(() => {
    if (feeDeductionMode === 'DEDUCT_FROM_COIN') {
      // Money spent was totalGrossBuyCost, but net coin received is less
      return totalGrossBuyCost;
    } else {
      // Fee added to total monetary cost
      return totalGrossBuyCost + totalFeeCurrency;
    }
  }, [totalGrossBuyCost, totalFeeCurrency, feeDeductionMode]);

  // Final Cost Basis per Unit (قیمت تمام شده هر واحد با احتساب کارمزد)
  const costBasisPerUnit = useMemo(() => {
    if (feeDeductionMode === 'DEDUCT_FROM_COIN') {
      return totalNetReceivedQuantity > 0 ? totalCostWithFees / totalNetReceivedQuantity : 0;
    } else {
      return totalQuantity > 0 ? totalCostWithFees / totalQuantity : 0;
    }
  }, [totalCostWithFees, totalNetReceivedQuantity, totalQuantity, feeDeductionMode]);

  // Weighted Average Buy Price (خام بدون کارمزد)
  const avgRawBuyPrice = totalQuantity > 0 ? totalGrossBuyCost / totalQuantity : 0;

  // Live market price entered by user
  const livePrice = cleanNumber(livePriceText);

  // Profit / Loss against Cost Basis (قیمت تمام شده)
  const activeHoldingUnits = feeDeductionMode === 'DEDUCT_FROM_COIN' ? totalNetReceivedQuantity : totalQuantity;
  const diffPerUnit = livePrice > 0 && costBasisPerUnit > 0 ? livePrice - costBasisPerUnit : 0;
  const pnlPercent = costBasisPerUnit > 0 && livePrice > 0 ? ((livePrice - costBasisPerUnit) / costBasisPerUnit) * 100 : 0;
  const totalPnL = livePrice > 0 ? diffPerUnit * activeHoldingUnits : 0;
  const currentTotalMarketValue = livePrice > 0 ? livePrice * activeHoldingUnits : 0;

  const isProfit = diffPerUnit > 0.0001;
  const isLoss = diffPerUnit < -0.0001;

  // Presets for quick demonstration
  const handleLoadSample = (count: number) => {
    setAssetName('ICP');
    setCurrency('TMN');
    setFeeUnit('COIN');
    setVolumeInputType('COIN_QTY');
    setFeeDeductionMode('DEDUCT_FROM_COIN');
    setDefaultQtyPerTrade('10');

    if (pasteMode === 'ALL_IN_ONE') {
      const basePrices = [710000, 715000, 708000, 722000, 718000, 725000, 712000, 720000];
      const rows: string[] = [];
      for (let i = 0; i < count; i++) {
        const p = basePrices[i % basePrices.length] + (Math.floor(i / 8) * 1000);
        const q = 10; // 10 ICP
        const fCoin = 0.02; // 0.02 ICP fee
        rows.push(`${p}\t${q}\t${fCoin}`);
      }
      setTablePasteText(rows.join('\n'));
      setColumnMapping('PRICE_QTY_FEE');
      setLivePriceText('745000');
    } else {
      const basePrices = [710000, 715000, 708000, 722000, 718000, 725000, 712000, 720000];
      const pList: number[] = [];
      const fList: string[] = [];
      const qList: number[] = [];
      for (let i = 0; i < count; i++) {
        const p = basePrices[i % basePrices.length] + (Math.floor(i / 8) * 1000);
        pList.push(p);
        qList.push(10);
        fList.push('0.02');
      }
      setPricesText(pList.join('  '));
      setQuantitiesText(qList.join('  '));
      setFeesText(fList.join('  '));
      setLivePriceText('745000');
    }
  };

  const handleClear = () => {
    setTablePasteText('');
    setPricesText('');
    setFeesText('');
    setQuantitiesText('');
    setLivePriceText('');
  };

  // Convert manual entries into standard portfolio trades
  const handleApplyToPortfolio = () => {
    if (activeItems.length === 0) return;
    const pairSymbol = `${assetName.toUpperCase().trim() || 'ASSET'}/${currency}`;

    const generatedTrades: TradeRecord[] = activeItems.map((item, idx) => ({
      id: `manual-batch-${Date.now()}-${idx}`,
      date: new Date(Date.now() - (activeItems.length - idx) * 3600000).toISOString().replace('T', ' ').substring(0, 19),
      symbol: pairSymbol,
      currency,
      side: 'BUY' as const,
      price: item.price,
      quantity: feeDeductionMode === 'DEDUCT_FROM_COIN' ? item.netReceivedQuantity : item.quantity,
      fee: item.feeCurrency, // Stored in quote currency (TMN) for global charts
      total: item.grossBuyCost,
      orderId: `MANUAL-${idx + 1}`,
    }));

    onApplyManualData(generatedTrades, pairSymbol, currency);

    if (livePrice > 0 && onUpdatePrice) {
      onUpdatePrice(pairSymbol, livePrice);
    }
  };

  return (
    <div 
      id="manual-batch-input-card"
      className="rounded-2xl border border-blue-500/30 dark:border-blue-500/20 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
    >
      {/* Top Banner / Header */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-400 shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  {isFa ? 'محاسبه‌گر پیشرفته بهای تمام شده و کارمزد کوینی' : 'Advanced Cost Basis & Coin Fee Calculator'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  {isFa ? 'پشتیبانی از کارمزد کوینی و اعشار دقیق' : 'Coin Fee & Precision Decimal Support'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {isFa 
                  ? 'کارمزد پرداختی به صورت کوین (مثلاً 0.002 ICP) به طور خودکار در قیمت خرید ضرب می‌شود تا کارمزد تومانی بدست آید. همچنین فرمول حجم و بهای تمام شده مطابق استانداردهای مدیریت سرمایه صرافی‌های کریپتو تنظیم شده است.' 
                  : 'Fee paid in coin (e.g. 0.002 ICP) is multiplied by buy price to get currency fee. Volume and cost basis formulas strictly conform to crypto exchange accounting.'}
              </p>
            </div>
          </div>

          {/* Quick Action Presets */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
              {isFa ? 'تست فوری:' : 'Quick Test:'}
            </span>
            <button
              type="button"
              onClick={() => handleLoadSample(8)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-slate-700 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{isFa ? '۸ معامله' : '8 Trades'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample(25)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-slate-700 transition cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isFa ? '۲۵ معامله' : '25 Trades'}</span>
            </button>

            {(tablePasteText || pricesText || feesText || quantitiesText) && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition cursor-pointer"
                title={isFa ? 'پاک کردن کادرها' : 'Clear inputs'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isFa ? 'پاک‌سازی' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Currency & Symbol Configuration Selector */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'نام کوین:' : 'Coin Symbol:'}
              </span>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value.toUpperCase())}
                placeholder="مثلاً ICP یا BTC"
                className="w-24 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold uppercase text-center"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'واحد محاسبه ارزش:' : 'Quote Currency:'}
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setCurrency('TMN')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold transition cursor-pointer ${
                    currency === 'TMN'
                      ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CurrencyLogo currency="TMN" lang={lang} size="xs" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold transition cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CurrencyLogo currency="USD" lang={lang} size="xs" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400">
                {isFa ? 'حجم پیش‌فرض (در صورت خالی بودن):' : 'Default Volume:'}
              </span>
              <input
                type="text"
                value={defaultQtyPerTrade}
                onChange={(e) => setDefaultQtyPerTrade(e.target.value)}
                placeholder="1"
                className="w-14 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-center"
              />
            </div>
          </div>

          {/* Sub-mode selector: All-in-One Paste vs Separate Boxes */}
          <div className="inline-flex p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPasteMode('ALL_IN_ONE')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                pasteMode === 'ALL_IN_ONE'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-blue-600" />
              <span>{isFa ? 'پیست یکجای جدول از سایت (سریع)' : 'All-in-One Table Paste'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPasteMode('SEPARATE')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                pasteMode === 'SEPARATE'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>{isFa ? 'کادرهای تفکیک‌شده (آزاد با فاصله)' : 'Separate Boxes'}</span>
            </button>
          </div>
        </div>

        {/* Calculation Formula & Accounting Parameters Bar */}
        <div className="mt-3 p-3 rounded-xl bg-blue-50/80 dark:bg-slate-800/60 border border-blue-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* Setting 1: Fee Unit */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'واحد کارمزد پرداختی:' : 'Fee Unit:'}
              </span>
              <select
                value={feeUnit}
                onChange={(e) => setFeeUnit(e.target.value as FeeUnitType)}
                className="px-2 py-1 rounded-lg border border-blue-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-blue-800 dark:text-blue-300 text-xs"
              >
                <option value="COIN">{isFa ? `به صورت کوین (${assetName}) - ضرب در قیمت` : `In Coin (${assetName}) - Multiply by price`}</option>
                <option value="CURRENCY">{isFa ? `به صورت ${currency} (بدون نیاز به ضرب)` : `In ${currency} (Direct value)`}</option>
              </select>
            </div>

            {/* Setting 2: Volume Input Type */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'نوع ستون حجم/میزان:' : 'Volume Column Type:'}
              </span>
              <select
                value={volumeInputType}
                onChange={(e) => setVolumeInputType(e.target.value as VolumeInputType)}
                className="px-2 py-1 rounded-lg border border-blue-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-blue-800 dark:text-blue-300 text-xs"
              >
                <option value="COIN_QTY">{isFa ? `تعداد کوین (مثلاً 10 ${assetName})` : `Coin Quantity (e.g. 10 ${assetName})`}</option>
                <option value="TOTAL_SPEND">{isFa ? `مبلغ کل خرید به ${currency} (ارزش ریالی)` : `Total Spend in ${currency}`}</option>
              </select>
            </div>

            {/* Setting 3: Fee Deduction Mode */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'نحوه احتساب کارمزد کوینی:' : 'Coin Fee Accounting:'}
              </span>
              <select
                value={feeDeductionMode}
                onChange={(e) => setFeeDeductionMode(e.target.value as FeeDeductionMode)}
                className="px-2 py-1 rounded-lg border border-blue-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-blue-800 dark:text-blue-300 text-xs"
              >
                <option value="DEDUCT_FROM_COIN">{isFa ? 'کسر کارمزد از کوین دریافتی (استاندارد صرافی)' : 'Deduct fee from received coins'}</option>
                <option value="ADD_TO_TOTAL_COST">{isFa ? 'کارمزد مازاد بر خرید (افزودن به هزینه کل)' : 'Add fee to total monetary cost'}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-300">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              {feeUnit === 'COIN' 
                ? (isFa ? `فرمول فعال: کارمزد تومانی = ${assetName} × قیمت خرید` : `Formula: Fee = Coin × Price`) 
                : (isFa ? 'کارمزد مستقیماً با ارزش ریالی جمع می‌شود' : 'Direct fee addition')}
            </span>
          </div>
        </div>
      </div>

      {/* Main Input Section */}
      <div className="p-4 sm:p-6 space-y-5">
        {pasteMode === 'ALL_IN_ONE' ? (
          /* Mode 1: All-in-One Table Paste */
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Table className="w-4 h-4 text-blue-600" />
                  <span>{isFa ? 'پیست یکجای جدول کپی‌شده از سایت:' : 'Paste Entire Table from Website:'}</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa 
                    ? 'سطرهای جدول را از سایت کپی و مستقیماً اینجا Ctrl+V بزنید. اعشارها (مانند 0.002 یا 0/002) و جداکننده‌های تب و فاصله خودکار تفکیک می‌شوند.' 
                    : 'Copy rows directly from your exchange site. Decimals (e.g. 0.002 or 0/002) and tabs/spaces are handled automatically.'}
                </p>
              </div>

              {/* Column order mapping selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">{isFa ? 'ترتیب ستون‌های کپی‌شده:' : 'Columns Order:'}</span>
                <select
                  value={columnMapping}
                  onChange={(e) => setColumnMapping(e.target.value as ColumnMappingType)}
                  className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold"
                >
                  <option value="PRICE_QTY_FEE">{isFa ? '۱. قیمت خرید | ۲. حجم (تعداد) | ۳. کارمزد کوینی' : '1. Price | 2. Volume | 3. Coin Fee'}</option>
                  <option value="PRICE_FEE">{isFa ? '۱. قیمت خرید | ۲. کارمزد کوینی' : '1. Price | 2. Coin Fee'}</option>
                  <option value="PRICE_TOTAL_FEE">{isFa ? `۱. قیمت خرید | ۲. مبلغ کل (${currency}) | ۳. کارمزد کوین` : '1. Price | 2. Total Spend | 3. Coin Fee'}</option>
                  <option value="INDEX_PRICE_QTY_FEE">{isFa ? '۱. ردیف | ۲. قیمت | ۳. حجم | ۴. کارمزد' : '1. Row# | 2. Price | 3. Vol | 4. Fee'}</option>
                  <option value="PRICE_FEE_QTY">{isFa ? '۱. قیمت خرید | ۲. کارمزد | ۳. حجم' : '1. Price | 2. Fee | 3. Volume'}</option>
                  <option value="FEE_PRICE_QTY">{isFa ? '۱. کارمزد | ۲. قیمت خرید | ۳. حجم' : '1. Fee | 2. Price | 3. Volume'}</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <textarea
                rows={7}
                value={tablePasteText}
                onChange={(e) => setTablePasteText(e.target.value)}
                placeholder={isFa 
                  ? "مثال (با تب یا فاصله):\n710000\t10\t0.02\n715000\t10\t0.02\n708000\t10\t0.02\n...\n(می‌توانید هر تعداد معامله، ۱۰، ۵۰ یا صدها سطر را کپی و پیست نمایید)"
                  : "Example:\n710000\t10\t0.02\n715000\t10\t0.02\n..."}
                className="w-full p-3 font-mono text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition leading-relaxed resize-y"
              />
              <div className="absolute bottom-3 end-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/10 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold pointer-events-none">
                <span>{allInOneItems.length}</span>
                <span className="font-sans font-medium">{isFa ? 'معامله شناسایی شد' : 'trades parsed'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Mode 2: Separate Columns with Smart Free-form Delimiter Parser */
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>
                {isFa 
                  ? 'اعداد را به سادگی با فاصله یا کاما پیست کنید. نیازی به تفکیک خط‌به‌خط نیست. کارمزد کوین به صورت خودکار در قیمت ضرب می‌شود.' 
                  : 'Paste numbers separated by spaces or commas. No line-by-line formatting needed. Coin fees are automatically multiplied by price.'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Column 1: Prices */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{isFa ? 'قیمت‌های خرید' : 'Buy Prices'}</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    {extractNumbersList(pricesText).length} {isFa ? 'مورد' : 'items'}
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={pricesText}
                  onChange={(e) => setPricesText(e.target.value)}
                  placeholder={isFa 
                    ? "مثال (با فاصله یا کاما):\n710000 715000 708000 722000 ...\n(نامحدود، ۱۰ یا ۱۰۰ عدد با هم)" 
                    : "e.g. 710000 715000 708000 ..."}
                  className="w-full p-3 font-mono text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition leading-relaxed resize-y"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {isFa ? 'پشتیبانی از جداکننده کاما، فاصله یا اینتر' : 'Supports commas, spaces, or newlines.'}
                </p>
              </div>

              {/* Column 2: Quantities / Volumes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <span>
                      {isFa 
                        ? (volumeInputType === 'COIN_QTY' ? `حجم خرید (تعداد ${assetName})` : `مبلغ کل خرید (${currency})`)
                        : 'Volume'}
                    </span>
                  </label>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                    {extractNumbersList(quantitiesText).length > 0 
                      ? `${extractNumbersList(quantitiesText).length} ${isFa ? 'مورد' : 'items'}` 
                      : (isFa ? 'پیش‌فرض' : 'Default')}
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={quantitiesText}
                  onChange={(e) => setQuantitiesText(e.target.value)}
                  placeholder={isFa 
                    ? "مثال:\n10 10 15 20 12 ...\n(اگر خالی بماند، مقدار پیش‌فرض اعمال می‌شود)" 
                    : "e.g. 10 10 15 (Defaults if empty)"}
                  className="w-full p-3 font-mono text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition leading-relaxed resize-y"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {isFa 
                    ? (volumeInputType === 'COIN_QTY' ? 'تعداد کوین در قیمت ضرب شده و ارزش معامله را می‌سازد.' : 'مبلغ کل خرید مستقیماً اعمال شده و دوباره در قیمت ضرب نمی‌شود.')
                    : 'Values are treated per selected volume mode.'}
                </p>
              </div>

              {/* Column 3: Fees (In Coin) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-amber-500" />
                    <span>
                      {isFa ? `کارمزد پرداختی (${feeUnit === 'COIN' ? `به ${assetName}` : currency})` : 'Fees'}
                    </span>
                  </label>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    {extractNumbersList(feesText).length} {isFa ? 'مورد' : 'items'}
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={feesText}
                  onChange={(e) => setFeesText(e.target.value)}
                  placeholder={isFa 
                    ? "مثال اعشاری کوین (با فاصله یا کاما):\n0.02 0.02 0.015 0.025 ...\n(یا با ممیز فارسی: ۰/۰۲)" 
                    : "e.g. 0.02 0.015 0.025 ..."}
                  className="w-full p-3 font-mono text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none transition leading-relaxed resize-y"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {isFa ? 'کارمزد کوینی برای هر سطر در قیمت خرید همان سطر ضرب می‌شود.' : 'Coin fees are multiplied by respective buy prices.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Live Price Input Field Box */}
        <div className="p-4 rounded-xl border-2 border-emerald-500/40 dark:border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <label htmlFor="manual-live-price-input" className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                {isFa ? `قیمت فعلی ${assetName}:` : `Current ${assetName} Price:`}
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFa ? 'قیمت لحظه‌ای بازار را وارد کنید تا مقایسه سود/زیان با بهای تمام شده نهایی محاسبه شود' : 'Enter live market price to compute instant P&L against cost basis'}
              </p>
            </div>
          </div>

          <div className="relative min-w-[240px]">
            <input
              id="manual-live-price-input"
              type="text"
              inputMode="decimal"
              value={livePriceText}
              onChange={(e) => setLivePriceText(e.target.value)}
              placeholder={currency === 'TMN' ? 'مثلاً 745000' : 'مثلاً 105.5'}
              className="w-full font-mono text-lg font-black py-2 px-3 pe-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 transition"
            />
            <div className="absolute top-1/2 -translate-y-1/2 end-3 flex items-center gap-1 pointer-events-none text-xs font-bold text-slate-500 dark:text-slate-400">
              <CurrencyLogo currency={currency} lang={lang} size="xs" />
            </div>
          </div>
        </div>

        {/* Automatic Calculation & Breakdown Cards */}
        {totalTradesCount > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {isFa ? `خروجی دقیق محاسبات (${totalTradesCount} معامله):` : `Calculations Output (${totalTradesCount} trades):`}
              </span>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {formatNumber(activeHoldingUnits, lang)} {assetName} {feeDeductionMode === 'DEDUCT_FROM_COIN' ? (isFa ? '(خالص پس از کسر کارمزد)' : 'net coins') : ''}
              </span>
            </div>

            {/* Formula Explanation Card */}
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span>{isFa ? 'فرمول و منطق محاسباتی فعال:' : 'Active Calculation Logic:'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono leading-relaxed pt-1">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="font-sans font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                    {isFa ? '۱. محاسبه ارزش کارمزد کوینی:' : '1. Coin Fee Valuation:'}
                  </span>
                  <span>{isFa ? 'کارمزد کل' : 'Total Fee'} = {formatNumber(totalFeeCoin, lang)} {assetName} × {isFa ? 'قیمت میانگین خرید' : 'Avg Price'} = </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalFeeCurrency, lang, currency)}</span>
                </div>

                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="font-sans font-bold text-blue-700 dark:text-blue-400 block mb-0.5">
                    {isFa ? '۲. فرمول قیمت تمام شده هر واحد (Cost Basis):' : '2. Cost Basis per Unit:'}
                  </span>
                  {feeDeductionMode === 'DEDUCT_FROM_COIN' ? (
                    <span>
                      {formatCurrency(totalGrossBuyCost, lang, currency)} ÷ {formatNumber(totalNetReceivedQuantity, lang)} {assetName} = 
                      <span className="font-bold text-blue-600 dark:text-blue-400 ms-1">{formatCurrency(costBasisPerUnit, lang, currency)}</span>
                    </span>
                  ) : (
                    <span>
                      ({formatCurrency(totalGrossBuyCost, lang, currency)} + {formatCurrency(totalFeeCurrency, lang, currency)}) ÷ {formatNumber(totalQuantity, lang)} = 
                      <span className="font-bold text-blue-600 dark:text-blue-400 ms-1">{formatCurrency(costBasisPerUnit, lang, currency)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics 4-Box Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Raw Buy Cost */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {isFa ? 'مجموع ارزش خرید ناخالص:' : 'Gross Buy Total:'}
                </span>
                <div className="text-lg font-black font-mono text-slate-900 dark:text-slate-100 mt-1">
                  {formatCurrency(totalGrossBuyCost, lang, currency)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {formatNumber(totalQuantity, lang)} {assetName} {isFa ? 'خریداری شده' : 'purchased'}
                </div>
              </div>

              {/* 2. Total Fees Paid (In Coin and Currency) */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  {isFa ? 'کل کارمزد پرداختی (به ارزش روز خرید):' : 'Total Fees Paid:'}
                </span>
                <div className="text-lg font-black font-mono text-amber-700 dark:text-amber-400 mt-1">
                  {formatCurrency(totalFeeCurrency, lang, currency)}
                </div>
                <div className="text-[10px] font-mono text-amber-600/90 dark:text-amber-400/90 mt-0.5">
                  {isFa ? 'معادل:' : 'Eq:'} {formatNumber(totalFeeCoin, lang)} {assetName}
                  {totalGrossBuyCost > 0 ? ` (${((totalFeeCurrency / totalGrossBuyCost) * 100).toFixed(2)}%)` : ''}
                </div>
              </div>

              {/* 3. Cost Basis per Unit (with Fees) */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/20">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  {isFa ? 'قیمت تمام شده نهایی هر واحد:' : 'Final Cost Basis / Unit:'}
                </span>
                <div className="text-lg font-black font-mono text-blue-800 dark:text-blue-200 mt-1">
                  {formatCurrency(costBasisPerUnit, lang, currency)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa ? 'میانگین خام:' : 'Raw Avg:'} {formatCurrency(avgRawBuyPrice, lang, currency)}
                </div>
              </div>

              {/* 4. Total Cost with Fees */}
              <div className="p-3.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/20 border border-indigo-500/20">
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  {isFa ? 'هزینه کل پرداختی:' : 'Total Cost with Fees:'}
                </span>
                <div className="text-lg font-black font-mono text-indigo-800 dark:text-indigo-200 mt-1">
                  {formatCurrency(totalCostWithFees, lang, currency)}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa ? `دریافتی خالص: ${formatNumber(totalNetReceivedQuantity, lang)} ${assetName}` : `Net: ${formatNumber(totalNetReceivedQuantity, lang)} ${assetName}`}
                </div>
              </div>
            </div>

            {/* Profit & Loss Section if live price is given */}
            {livePrice > 0 && (
              <div 
                className={`p-4 rounded-xl border transition-all ${
                  isProfit
                    ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30'
                    : isLoss
                    ? 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`w-5 h-5 ${isProfit ? 'text-emerald-600' : isLoss ? 'text-rose-600' : 'text-slate-600'}`} />
                    <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                      {isFa ? 'سنجش دقیق سود و زیان بر اساس بهای تمام شده نهایی:' : 'P&L against Final Cost Basis:'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black font-mono ${
                      isProfit ? 'bg-emerald-500 text-white' : isLoss ? 'bg-rose-500 text-white' : 'bg-slate-600 text-white'
                    }`}>
                      {isProfit ? '+' : ''}{formatPercent(pnlPercent, lang)}
                      <span className="font-sans font-bold ms-1">
                        {isProfit ? (isFa ? 'سود' : 'Profit') : isLoss ? (isFa ? 'زیان' : 'Loss') : (isFa ? 'سر‌به‌سر' : 'Breakeven')}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {isFa ? 'اختلاف سود/زیان هر واحد:' : 'Unit P&L:'}
                    </span>
                    <div className={`text-base font-black font-mono ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700'}`}>
                      {diffPerUnit > 0 ? '+' : ''}{formatCurrency(diffPerUnit, lang, currency)}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {isFa ? `سود / زیان کل دارایی (${formatNumber(activeHoldingUnits, lang)} ${assetName}):` : 'Total Position P&L:'}
                    </span>
                    <div className={`text-base font-black font-mono ${totalPnL > 0 ? 'text-emerald-600 dark:text-emerald-400' : totalPnL < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700'}`}>
                      {totalPnL > 0 ? '+' : ''}{formatCurrency(totalPnL, lang, currency)}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {isFa ? 'ارزش روز کل دارایی موجود:' : 'Market Value:'}
                    </span>
                    <div className="text-base font-black font-mono text-slate-900 dark:text-slate-100">
                      {formatCurrency(currentTotalMarketValue, lang, currency)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Interactive Preview of Parsed Rows */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{isFa ? `ریز محاسبات تک‌تک ردیف‌ها (${activeItems.length} سطر معامله)` : `Row by row calculation preview (${activeItems.length} rows)`}</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  {isFa ? 'ضرب خودکار کارمزد کوینی در قیمت خرید هر سطر' : 'Coin fee multiplied per row price'}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[11px] sticky top-0">
                    <tr>
                      <th className="p-2 text-center w-10">#</th>
                      <th className="p-2 text-start">{isFa ? 'قیمت خرید' : 'Price'}</th>
                      <th className="p-2 text-start">{isFa ? `حجم (${assetName})` : 'Qty'}</th>
                      <th className="p-2 text-start">{isFa ? `ارزش ناخالص (${currency})` : 'Gross Buy'}</th>
                      <th className="p-2 text-start">{isFa ? `کارمزد کوینی` : 'Coin Fee'}</th>
                      <th className="p-2 text-start">{isFa ? `ارزش کارمزد (${currency})` : 'Fee in Cur.'}</th>
                      <th className="p-2 text-start">{isFa ? 'بهای تمام شده هر واحد' : 'Unit Cost Basis'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {activeItems.slice(0, 50).map((item) => {
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2 text-center text-slate-400">{item.index}</td>
                          <td className="p-2 font-bold text-slate-800 dark:text-slate-200">
                            {formatNumber(item.price, lang)}
                          </td>
                          <td className="p-2 text-slate-700 dark:text-slate-300">
                            {formatNumber(item.quantity, lang)}
                          </td>
                          <td className="p-2 text-slate-800 dark:text-slate-200">
                            {formatCurrency(item.grossBuyCost, lang, currency)}
                          </td>
                          <td className="p-2 text-amber-700 dark:text-amber-400 font-bold">
                            {formatNumber(item.feeCoin, lang)} {assetName}
                          </td>
                          <td className="p-2 text-amber-600 dark:text-amber-400">
                            {formatCurrency(item.feeCurrency, lang, currency)}
                          </td>
                          <td className="p-2 font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(item.rowCostBasisPerUnit, lang, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {activeItems.length > 50 && (
                <div className="p-2 bg-slate-50 dark:bg-slate-900 text-center text-xs text-slate-500">
                  {isFa ? `... و ${activeItems.length - 50} ردیف دیگر (همه در محاسبات کل اعمال شده‌اند)` : `... and ${activeItems.length - 50} more rows`}
                </div>
              )}
            </div>

            {/* Action button to load into charts, simulator, and full dashboard */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isFa 
                  ? 'انتقال معاملات محاسبه‌شده به پورتفوی جهت نمایش در نمودارها و تحلیل جامع' 
                  : 'Transfer trades to portfolio for chart visualization and full analysis'}
              </span>

              <button
                type="button"
                onClick={handleApplyToPortfolio}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>{isFa ? 'اعمال در کل پورتفوی و نمودارها' : 'Apply to Full Portfolio & Charts'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isFa 
                ? 'اطلاعات قیمت، حجم و کارمزد کوینی را پیست کنید، یا از دکمه‌های تست سریع بالا استفاده نمایید.' 
                : 'Paste price, volume, and coin fee numbers to compute exact cost basis.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
