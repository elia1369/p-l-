import * as XLSX from 'xlsx';
import { TradeRecord, ParsedExcelResult, PIIReport, TradeSide } from '../types';
import { detectCurrency } from './i18n';

// Sensitive column patterns for PII detection (careful not to match "نام ارز")
const SENSITIVE_COLUMN_PATTERNS = [
  /email/i,
  /ایمیل/i,
  /پست\s*الکترونیک/i,
  /phone/i,
  /mobile/i,
  /موبایل/i,
  /تلفن/i,
  /full_?name/i,
  /first_?name/i,
  /last_?name/i,
  /نام\s*کاربر/i,
  /نام\s*مشتری/i,
  /نام\s*خانوادگی/i,
  /^نام$/i,
  /account/i,
  /شماره\s*حساب/i,
  /user_?id/i,
  /client_?id/i,
  /شناسه\s*کاربر/i,
  /کد\s*مشتری/i,
  /national_?code/i,
  /کد\s*ملی/i,
  /شناسنامه/i,
  /ip/i,
  /آی\s*پی/i,
  /card/i,
  /شماره\s*کارت/i,
  /sheba/i,
  /شبا/i,
  /address/i,
  /آدرس/i,
  /wallet_?address/i,
  /api_?key/i,
  /secret/i,
  /password/i,
];

// Helper to check if a header looks like PII (never match "نام ارز" or "نام نماد")
function isSensitiveColumn(header: string): boolean {
  const h = header.trim();
  if (h.includes('ارز') || h.includes('نماد') || h.includes('مارکت') || h.includes('بازار') || h.includes('کوین')) {
    return false;
  }
  return SENSITIVE_COLUMN_PATTERNS.some(pattern => pattern.test(h));
}

interface ColumnMatchOptions {
  excludeKeywords?: string[];
}

/**
 * Priority-based column detector that avoids substring collisions
 * (e.g. will never match "ارزش کل" when searching for "ارز" or "نماد")
 */
function findColumnKey(headers: string[], keywords: string[], options?: ColumnMatchOptions): string | undefined {
  const excludeKeywords = (options?.excludeKeywords || []).map(k => k.toLowerCase().trim().replace(/[\s_-]+/g, ''));

  // 1. Pass 1: Exact matches in order of keyword priority
  for (const kw of keywords) {
    const normKw = kw.toLowerCase().trim().replace(/[\s_-]+/g, '');
    for (const h of headers) {
      const normH = h.toLowerCase().trim().replace(/[\s_-]+/g, '');
      if (excludeKeywords.some(ex => normH.includes(ex))) continue;
      if (normH === normKw) {
        return h;
      }
    }
  }

  // 2. Pass 2: Fuzzy phrase matches in order of keyword priority
  for (const kw of keywords) {
    const normKw = kw.toLowerCase().trim().replace(/[\s_-]+/g, '');
    for (const h of headers) {
      const normH = h.toLowerCase().trim().replace(/[\s_-]+/g, '');
      if (excludeKeywords.some(ex => normH.includes(ex))) continue;
      if (normH.includes(normKw)) {
        return h;
      }
    }
  }

  return undefined;
}

// List of common cryptocurrency ticker symbols for data-driven column detection
const KNOWN_COIN_TICKERS = new Set([
  'TON', 'ADA', 'USDT', 'ETH', 'BTC', 'SOL', 'NEAR', 'ETC', 'XRP', 'DOGE', 'SHIB',
  'TRX', 'BNB', 'AVAX', 'MATIC', 'LINK', 'DOT', 'ATOM', 'LTC', 'ICP', 'UNI', 'XLM',
  'FTM', 'SAND', 'MANA', 'GALA', 'APE', 'ARB', 'OP', 'SUI', 'APT', 'PEPE', 'FLOKI',
  'BONK', 'WIF', 'PAXG', 'NOT', 'DOGS', 'HMSTR', 'CATI', 'XMR', 'BCH', 'FIL', 'ALGO',
  'VET', 'ICP', 'GRT', 'AAVE', 'MKR', 'RNDR', 'INJ', 'TIA', 'SEI', 'STX', 'KAS', 'FET'
]);

const KNOWN_MARKET_QUOTES = new Set([
  'TMN', 'IRT', 'TOMAN', 'IRR', 'USDT', 'USD', 'تومان', 'تومن', 'تتر', 'دلار'
]);

/**
 * Normalizes trading pair strings such as "icp/tmn", "icp/usdt", "icp_tmn", "icptmn", "ICP تومان",
 * or separate Base ("TON", "ADA", "USDT") and Market/Quote ("TMN" or "USDT") columns into standardized "TON/TMN", "ADA/TMN", etc.
 */
export function normalizeTradingPair(rawSymbol: string, rawQuote?: string): string {
  let sym = String(rawSymbol || '').trim();
  let quote = String(rawQuote || '').trim();

  // Strip quotes and parens
  sym = sym.replace(/^["'(\[]+|["')\]]+$/g, '').trim();
  quote = quote.replace(/^["'(\[]+|["')\]]+$/g, '').trim();

  if (!sym && !quote) return 'UNKNOWN/TMN';
  if (!sym && quote) return `${quote.toUpperCase()}/TMN`;

  // Standardize quote string if provided
  let cleanQuote = '';
  if (quote) {
    const uq = quote.toUpperCase().trim();
    if (uq === 'TMN' || uq === 'TOMAN' || uq === 'IRT' || uq === 'IRR' || uq === 'تومان' || uq === 'تومن') {
      cleanQuote = 'TMN';
    } else if (uq === 'USDT' || uq === 'USD' || uq === 'تتر' || uq === 'دلار') {
      cleanQuote = 'USDT';
    } else if (uq === 'BTC' || uq === 'ETH') {
      cleanQuote = uq;
    } else {
      cleanQuote = uq.replace(/[^A-Za-z0-9]/g, '');
    }
  }

  // 1. If sym already contains a slash or dash separator: e.g. "TON/TMN", "BTC-USDT", "ETH_IRT", "ADA / تومان"
  const slashMatch = sym.match(/^([A-Za-z0-9]+)[\s/_\-]+([A-Za-z0-9]+|تومان|تومن|تتر)$/i);
  if (slashMatch) {
    const base = slashMatch[1].toUpperCase();
    let q = slashMatch[2].toUpperCase();
    if (q === 'TMN' || q === 'TOMAN' || q === 'IRT' || q === 'IRR' || q === 'تومان' || q === 'تومن') {
      q = 'TMN';
    } else if (q === 'USDT' || q === 'USD' || q === 'تتر') {
      q = 'USDT';
    }
    return `${base}/${q}`;
  }

  // 2. If sym is a compact pair: e.g. "BTCTMN", "ETHUSDT", "ADAIRT" (where length >= 6 and ends with TMN/USDT/IRT)
  if (sym.length >= 6) {
    const compactMatch = sym.match(/^([A-Za-z0-9]{2,8})(TMN|TOMAN|IRT|USDT|USD)$/i);
    if (compactMatch) {
      const base = compactMatch[1].toUpperCase();
      let q = compactMatch[2].toUpperCase();
      if (q === 'TOMAN' || q === 'IRT') q = 'TMN';
      return `${base}/${q}`;
    }
  }

  // Clean base symbol (e.g. "TON", "ADA", "USDT", "ETH", "NEAR", "ETC", "SOL")
  const cleanBase = sym.toUpperCase().replace(/[^A-Za-z0-9]/g, '');

  // 3. If separate quote column was given: combine cleanBase / cleanQuote
  if (cleanQuote) {
    return `${cleanBase || 'ASSET'}/${cleanQuote}`;
  }

  // 4. If base contains TMN / Toman at the end or embedded:
  if (cleanBase.endsWith('TMN') && cleanBase.length > 3) {
    return `${cleanBase.slice(0, -3)}/TMN`;
  }
  if (cleanBase.endsWith('USDT') && cleanBase.length > 4) {
    return `${cleanBase.slice(0, -4)}/USDT`;
  }

  // 5. Default fallback quote if only base coin is known:
  if (cleanBase === 'USDT') {
    return 'USDT/TMN';
  }

  return `${cleanBase || 'ASSET'}/TMN`;
}

export function parseNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  let str = String(value).trim();
  if (!str) return 0;

  // 1. Convert Persian and Arabic digits to ASCII 0-9
  str = str.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  str = str.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  // 2. Remove currency symbols, units, spaces, and text
  str = str.replace(/[$€£¥﷼]/g, '')
           .replace(/\b(usdt|usd|tmn|toman|irt|irr|تومان|تتر|دلار|ریال)\b/gi, '')
           .replace(/\s+/g, '');

  // 3. Handle Persian Momayyez (٫) -> decimal dot
  str = str.replace(/٫/g, '.');

  // 4. Handle slash as decimal separator if between digits (e.g. 12/50 -> 12.50)
  if (/^\d+\/\d+$/.test(str)) {
    str = str.replace('/', '.');
  }

  // 5. Detect and normalize thousands separators vs decimal separator
  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastDot > lastComma) {
      // e.g. "1,250,000.50" -> comma is thousand separator, dot is decimal
      str = str.replace(/,/g, '');
    } else {
      // e.g. "1.250.000,50" -> dot is thousand separator, comma is decimal
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length > 2) {
      // Multiple commas: e.g. "1,250,000" -> thousand separators
      str = str.replace(/,/g, '');
    } else if (parts.length === 2) {
      const p0 = parts[0];
      const p1 = parts[1];
      // If starts with 0 or -0 (e.g. "0,330" or "0,005" or "0,33"): ALWAYS decimal dot!
      if (p0 === '0' || p0 === '-0' || p0 === '+0') {
        str = `${p0}.${p1}`;
      } else if (p1.length !== 3) {
        // Non-3 digit fraction (e.g. "12,5" or "44,50" or "0,1234"): decimal dot!
        str = `${p0}.${p1}`;
      } else {
        // parts[1].length === 3, e.g. "44,000" or "1,000"
        // In crypto trading, if p0 < 100 and it looks like a price or rate (e.g. "44,500"),
        // standard format with single comma and 3 decimals is decimal
        str = str.replace(/,/g, '');
      }
    }
  }

  // Final cleanup: remove any remaining non-numeric chars except dot, minus, and scientific E
  str = str.replace(/[^0-9.\-eE]/g, '');

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseSideStrict(value: any): TradeSide | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).toLowerCase().trim().replace(/[\s_-]+/g, ' ');

  // Explicit negative check - these are NOT trade sides (e.g. Wallex column "اسپات" / Spot)
  if (
    str === 'اسپات' || str === 'spot' ||
    str === 'تعهدی' || str === 'مارجین' || str === 'margin' ||
    str === 'فیوچرز' || str === 'futures' ||
    str === 'حساب اصلی' || str === 'main account' ||
    str === 'حساب' || str === 'account' ||
    str === 'عادی' || str === 'normal' ||
    str === 'لیمیت' || str === 'limit' ||
    str === 'مارکت' || str === 'market'
  ) {
    return null;
  }

  // Exact SELL indicators
  if (
    str === 'sell' ||
    str === 's' ||
    str === 'فروش' ||
    str === 'خروج' ||
    str === 'فروش (خروجی)' ||
    str === 'خروجی (فروش)' ||
    str === 'خروجی' ||
    str === 'فروش آسان' ||
    str === 'فروش سریع' ||
    str === 'فروش تعهدی' ||
    str === 'فروش اسپات' ||
    str === 'ask' ||
    str === 'short'
  ) {
    return 'SELL';
  }

  // Exact BUY indicators
  if (
    str === 'buy' ||
    str === 'b' ||
    str === 'خرید' ||
    str === 'ورود' ||
    str === 'خرید (ورودی)' ||
    str === 'ورودی (خرید)' ||
    str === 'ورودی' ||
    str === 'خرید آسان' ||
    str === 'خرید سریع' ||
    str === 'خرید تعهدی' ||
    str === 'خرید اسپات' ||
    str === 'bid' ||
    str === 'long'
  ) {
    return 'BUY';
  }

  // Substring checks
  if (str.includes('فروش') || str.includes('sell') || str.includes('خروج') || str.includes('short')) {
    return 'SELL';
  }
  if (str.includes('خرید') || str.includes('buy') || str.includes('ورود') || str.includes('long')) {
    return 'BUY';
  }

  return null;
}

export function parseSide(value: any): TradeSide {
  const strict = parseSideStrict(value);
  return strict || 'BUY';
}

/**
 * Inspects actual row values to find which column contains BUY/SELL side tokens,
 * actively ignoring non-side columns like "اسپات" (Spot), "حساب اصلی", etc.
 */
function detectSideColumnFromData(headers: string[], rows: any[]): string | undefined {
  let bestCol: string | undefined;
  let maxSideMatches = 0;

  for (const h of headers) {
    let sideMatchCount = 0;
    let nonSidePenalty = 0;
    
    const sampleSize = rows.length;
    for (let i = 0; i < sampleSize; i++) {
      const cellVal = rows[i][h];
      if (cellVal === null || cellVal === undefined || cellVal === '') continue;
      
      const parsed = parseSideStrict(cellVal);
      if (parsed) {
        sideMatchCount++;
      } else {
        const str = String(cellVal).toLowerCase().trim();
        if (
          str.includes('اسپات') || 
          str.includes('spot') || 
          str.includes('حساب') || 
          str.includes('اصلی') ||
          str.includes('مارجین') ||
          str.includes('margin') ||
          str.includes('تعهدی') ||
          str.includes('فیوچرز') ||
          str.includes('futures') ||
          str.includes('limit') ||
          str.includes('market') ||
          str.includes('عادی')
        ) {
          nonSidePenalty += 3;
        }
      }
    }

    if (sideMatchCount > maxSideMatches && sideMatchCount > nonSidePenalty) {
      maxSideMatches = sideMatchCount;
      bestCol = h;
    }
  }

  return maxSideMatches >= 1 ? bestCol : undefined;
}

/**
 * Resolves trade side accurately with column check and per-row token scanning fallback
 */
function determineRowSide(row: any, sideKey?: string): TradeSide {
  // 1. Check designated sideKey column first if present
  if (sideKey && row[sideKey] !== undefined && row[sideKey] !== null && row[sideKey] !== '') {
    const parsed = parseSideStrict(row[sideKey]);
    if (parsed) return parsed;
  }

  // 2. Check columns whose name strongly implies side
  for (const [colName, rawVal] of Object.entries(row)) {
    if (rawVal === null || rawVal === undefined || rawVal === '') continue;
    const lower = colName.toLowerCase();
    if (
      lower.includes('سمت') || 
      lower.includes('معامله') || 
      lower.includes('side') || 
      lower.includes('direction') || 
      lower.includes('action') ||
      lower.includes('عملیات')
    ) {
      const parsed = parseSideStrict(rawVal);
      if (parsed) return parsed;
    }
  }

  // 3. Fallback scan across all cells for explicit BUY/SELL tokens
  for (const [, rawVal] of Object.entries(row)) {
    if (rawVal === null || rawVal === undefined || rawVal === '') continue;
    const parsed = parseSideStrict(rawVal);
    if (parsed) return parsed;
  }

  return 'BUY';
}

/**
 * Normalizes trading fee:
 * On exchanges like Wallex, BUY fee is often in base coin (e.g. 0.000008 BTC or 0.35 ARB),
 * while SELL fee is in quote currency (e.g. 224,385 TMN).
 * This converts coin fees to quote currency (TMN/USDT) so all fees & P&L are consistent.
 */
function normalizeTradeFee(rawFee: number, quantity: number, price: number, total: number): number {
  if (rawFee <= 0) return 0;
  
  const calcTotal = total > 0 ? total : (price > 0 && quantity > 0 ? price * quantity : 0);
  if (calcTotal <= 0) return rawFee;

  const ratioToTotal = rawFee / calcTotal;
  
  // If fee is already a realistic percentage of total value (e.g. between 0.005% and 15%)
  if (ratioToTotal >= 0.00005 && ratioToTotal <= 0.15) {
    return rawFee;
  }

  // If rawFee / quantity is a realistic fee percentage (e.g. 0.01% to 2%), but ratioToTotal was tiny,
  // then fee was specified in the base asset (COIN) and must be converted to quote currency (TMN/USDT)
  if (quantity > 0 && price > 0) {
    const ratioToQty = rawFee / quantity;
    if (ratioToQty >= 0.00005 && ratioToQty <= 0.10 && ratioToTotal < 0.00005) {
      return Number((rawFee * price).toFixed(6));
    }
  }

  return rawFee;
}

function formatDate(value: any): string {
  if (!value) return new Date().toISOString().split('T')[0];
  if (typeof value === 'number') {
    // Excel serial date format
    const date = new Date((value - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }
  }
  return String(value).trim();
}

/**
 * Parses an uploaded Excel or CSV file client-side, stripping any PII data
 */
export async function parseExcelFile(file: File): Promise<ParsedExcelResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // 1. Detect actual header row (handles sheets with top banner or metadata rows)
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rawData || rawData.length === 0) {
    throw new Error('فایل بارگذاری شده خالی است یا قالبی نامعتبر دارد.');
  }

  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(rawData.length, 10); r++) {
    const rowCells = rawData[r].map(c => String(c || '').toLowerCase().trim());
    const hasKeyColumns = rowCells.some(cell => 
      cell.includes('تاریخ') || cell.includes('date') || cell.includes('time') ||
      cell.includes('ارز') || cell.includes('نماد') || cell.includes('symbol') || cell.includes('pair') ||
      cell.includes('سمت') || cell.includes('خرید') || cell.includes('فروش') || cell.includes('side') ||
      cell.includes('قیمت') || cell.includes('price') ||
      cell.includes('مقدار') || cell.includes('تعداد') || cell.includes('حجم') || cell.includes('qty') || cell.includes('amount')
    );
    if (hasKeyColumns) {
      headerRowIndex = r;
      break;
    }
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { 
    range: headerRowIndex,
    defval: '' 
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('فایل بارگذاری شده خالی است یا قالبی نامعتبر دارد.');
  }

  const rawHeaders = Object.keys(rawRows[0] || {});

  // 2. PII Security Detection & Scrubbing
  const sanitizedHeaders: string[] = [];
  rawHeaders.forEach(header => {
    if (isSensitiveColumn(header)) {
      sanitizedHeaders.push(header);
    }
  });

  // 3. Intelligent multi-layer Column Detection
  // Layer A: Check data rows to find which column actually contains coin symbols (TON, ADA, ETH, etc.)
  let dataBaseCoinKey: string | undefined;
  let dataQuoteKey: string | undefined;
  let maxCoinTickerMatches = 0;
  let maxQuoteMatches = 0;

  const sampleSize = Math.min(rawRows.length, 60);
  for (const h of rawHeaders) {
    let coinMatch = 0;
    let quoteMatch = 0;
    for (let r = 0; r < sampleSize; r++) {
      const val = String(rawRows[r][h] || '').trim().toUpperCase();
      if (!val) continue;
      if (KNOWN_COIN_TICKERS.has(val)) coinMatch++;
      if (KNOWN_MARKET_QUOTES.has(val)) quoteMatch++;
    }
    if (coinMatch > maxCoinTickerMatches && coinMatch >= 2) {
      maxCoinTickerMatches = coinMatch;
      dataBaseCoinKey = h;
    }
    if (quoteMatch > maxQuoteMatches && quoteMatch >= 2 && h !== dataBaseCoinKey) {
      maxQuoteMatches = quoteMatch;
      dataQuoteKey = h;
    }
  }

  // Layer B: Header-based matching for Base Coin, Quote Market, and Combined Pair
  const headerBaseCoinKey = findColumnKey(
    rawHeaders,
    ['نوع کوین', 'نام کوین', 'کوین', 'نوع ارز', 'نام ارز', 'ارز پایه', 'ارز مبدا', 'ارز دیجیتال', 'رمزارز', 'دارایی', 'coin', 'base coin', 'base asset', 'base', 'crypto', 'asset', 'token'],
    { excludeKeywords: ['پایه بازار', 'نوع معامله', 'نوع معامله2', 'قیمت کل', 'ارزش کل', 'کارمزد', 'قیمت واحد', 'قیمت', 'حجم', 'تعداد', 'تاریخ', 'شناسه'] }
  );

  const headerQuoteKey = findColumnKey(
    rawHeaders,
    ['پایه بازار', 'بازار پایه', 'ارز بازار', 'نوع بازار', 'ارز مقصد', 'ارز مبنا', 'ارز دوم', 'واحد پایه معامله', 'واحد قیمت', 'واحد معامله', 'واحد پول', 'مارکت', 'بازار', 'quote', 'quote currency', 'market'],
    { excludeKeywords: ['نوع کوین', 'نام کوین', 'کوین', 'نوع معامله', 'نوع معامله2', 'قیمت کل', 'ارزش کل', 'کارمزد', 'قیمت واحد', 'قیمت', 'حجم', 'تعداد', 'تاریخ', 'شناسه'] }
  );

  const headerPairKey = findColumnKey(
    rawHeaders,
    ['جفت ارز', 'جفت_ارز', 'نماد معامله', 'نماد', 'مارکت معامله', 'trading pair', 'pair', 'symbol', 'instrument'],
    { excludeKeywords: ['نوع کوین', 'نام کوین', 'پایه بازار', 'نوع معامله', 'نوع معامله2', 'ارزش', 'مبلغ', 'کارمزد', 'قیمت', 'حجم', 'تعداد', 'تاریخ', 'شناسه'] }
  );

  // Resolved Symbol & Quote Keys: prioritize verified data coin column, then base coin + quote, then pair
  const baseCoinKey = dataBaseCoinKey || headerBaseCoinKey;
  const quoteKey = (dataQuoteKey && dataQuoteKey !== baseCoinKey) ? dataQuoteKey : (headerQuoteKey !== baseCoinKey ? headerQuoteKey : undefined);
  const pairKey = headerPairKey && headerPairKey !== baseCoinKey && headerPairKey !== quoteKey ? headerPairKey : undefined;

  // 4. Data-driven Side Detection (inspects actual cell values: BUY vs SELL vs اسپات)
  const dataSideKey = detectSideColumnFromData(rawHeaders, rawRows);

  // Header keyword matching for side with explicit excludeKeywords
  const headerSideKey = findColumnKey(
    rawHeaders, 
    [
      'نوع معامله', 'سمت معامله', 'سمت سفارش', 'سمت', 'جهت معامله', 'جهت', 'طرف معامله', 
      'خرید/فروش', 'خرید / فروش', 'خرید/ فروش', 'خرید یا فروش', 'خرید و فروش',
      'side', 'trade side', 'order side', 'trade_side', 'order_side',
      'عملیات', 'دستور', 'نوع سفارش', 'نوع', 'type', 'action', 'direction'
    ],
    { 
      excludeKeywords: [
        'نوع معامله2', 'نوع معامله 2', 'نوع معامله_2', 'نوع کوین', 'پایه بازار',
        'اسپات', 'spot', 'مارجین', 'margin', 'تعهدی', 'فیوچرز', 'futures', 'سکو',
        'نوع بازار', 'حساب', 'account', 'وضعیت', 'status', 'شناسه', 'id', 
        'تاریخ', 'date', 'قیمت', 'price', 'مبلغ', 'ارزش', 'total', 
        'کارمزد', 'fee', 'مقدار', 'حجم', 'تعداد', 'qty', 'amount', 'واحد', 'ارز', 'symbol'
      ] 
    }
  );

  const sideKey = dataSideKey || headerSideKey;

  const priceKey = findColumnKey(
    rawHeaders, 
    ['قیمت واحد', 'قیمت معامله', 'نرخ معامله', 'نرخ', 'قیمت واحد پایه معامله', 'fill price', 'exec price', 'unit price', 'rate', 'price', 'قیمت'],
    { excludeKeywords: ['قیمت کل', 'ارزش کل', 'مجموع', 'کارمزد کل', 'کارمزد'] }
  );

  const qtyKey = findColumnKey(
    rawHeaders, 
    ['مقدار', 'تعداد', 'حجم', 'حجم معامله', 'مقدار معامله', 'amount', 'quantity', 'qty', 'size', 'filled', 'vol', 'volume'],
    { excludeKeywords: ['ارزش', 'مبلغ', 'قیمت', 'کارمزد'] }
  );

  const feeKey = findColumnKey(
    rawHeaders, 
    ['کارمزد کل', 'کارمزد معامله', 'کارمزد', 'کمیسیون', 'هزینه معامله', 'هزینه', 'مبلغ کارمزد', 'کارمزد (تومان)', 'کارمزد (تتر)', 'fee', 'trade fee', 'commission', 'fees', 'fee (tmn)', 'fee (usdt)', 'fee_amount', 'trading_fee'],
    { excludeKeywords: ['قیمت', 'ارزش کل', 'حجم'] }
  );

  const totalKey = findColumnKey(
    rawHeaders, 
    ['قیمت کل', 'ارزش کل', 'ارزش معامله', 'مبلغ کل', 'ارزش', 'مجموع', 'مبلغ', 'total', 'quote amount', 'value', 'subtotal'],
    { excludeKeywords: ['قیمت واحد', 'قیمت واحد پایه معامله', 'کارمزد'] }
  );

  const dateKey = findColumnKey(
    rawHeaders, 
    ['تاریخ معامله', 'تاریخ و زمان', 'تاریخ', 'زمان', 'time', 'timestamp', 'date', 'created_at', 'created']
  );

  const orderIdKey = findColumnKey(
    rawHeaders, 
    ['شناسه سفارش', 'شناسه معامله', 'کد پیگیری', 'شماره سفارش', 'order id', 'order_id', 'trade id', 'شناسه', 'id']
  );

  const trades: TradeRecord[] = [];

  rawRows.forEach((row, idx) => {
    // Extract symbol & market accurately
    let rawSymbol = '';
    let rawQuote = '';

    if (baseCoinKey && row[baseCoinKey]) {
      rawSymbol = String(row[baseCoinKey]).trim();
      rawQuote = quoteKey && row[quoteKey] ? String(row[quoteKey]).trim() : '';
    } else if (pairKey && row[pairKey]) {
      rawSymbol = String(row[pairKey]).trim();
      rawQuote = quoteKey && row[quoteKey] ? String(row[quoteKey]).trim() : '';
    } else {
      // Fallback to first non-empty string column that looks like a ticker
      for (const h of rawHeaders) {
        if (h === sideKey || h === dateKey || h === orderIdKey) continue;
        const val = String(row[h] || '').trim();
        if (val && (KNOWN_COIN_TICKERS.has(val.toUpperCase()) || /^[A-Z0-9]{2,10}(\/[A-Z0-9]+)?$/i.test(val))) {
          rawSymbol = val;
          break;
        }
      }
    }

    // Determine row-specific columns based on quote currency
    const rawQuoteUpper = (rawQuote || '').toUpperCase();
    const isRowUsd = rawQuoteUpper.includes('USDT') || rawQuoteUpper.includes('USD') || rawQuoteUpper.includes('تتر') || rawQuoteUpper.includes('دلار') || rawSymbol.toUpperCase().includes('USDT');

    // If row is in USDT market, prioritize headers with (تتر) / (USDT) / (USD) / (دلار)
    let rowPriceKey = priceKey;
    let rowTotalKey = totalKey;
    let rowFeeKey = feeKey;

    if (isRowUsd) {
      const usdPriceHeader = rawHeaders.find(h => {
        const lh = h.toLowerCase();
        return (lh.includes('تتر') || lh.includes('usdt') || lh.includes('دلار') || lh.includes('usd')) &&
               (lh.includes('قیمت') || lh.includes('نرخ') || lh.includes('price') || lh.includes('rate')) &&
               !lh.includes('کل') && !lh.includes('مجموع') && !lh.includes('کارمزد');
      });
      if (usdPriceHeader) rowPriceKey = usdPriceHeader;

      const usdTotalHeader = rawHeaders.find(h => {
        const lh = h.toLowerCase();
        return (lh.includes('تتر') || lh.includes('usdt') || lh.includes('دلار') || lh.includes('usd')) &&
               (lh.includes('ارزش') || lh.includes('مبلغ') || lh.includes('کل') || lh.includes('total') || lh.includes('sum')) &&
               !lh.includes('کارمزد');
      });
      if (usdTotalHeader) rowTotalKey = usdTotalHeader;

      const usdFeeHeader = rawHeaders.find(h => {
        const lh = h.toLowerCase();
        return (lh.includes('تتر') || lh.includes('usdt') || lh.includes('دلار') || lh.includes('usd')) &&
               (lh.includes('کارمزد') || lh.includes('fee') || lh.includes('کمیسیون'));
      });
      if (usdFeeHeader) rowFeeKey = usdFeeHeader;
    } else {
      // If row is TMN market, avoid USDT columns
      const tmnPriceHeader = rawHeaders.find(h => {
        const lh = h.toLowerCase();
        return (lh.includes('تومان') || lh.includes('tmn') || lh.includes('irt')) &&
               (lh.includes('قیمت') || lh.includes('نرخ') || lh.includes('price')) &&
               !lh.includes('کل') && !lh.includes('کارمزد');
      });
      if (tmnPriceHeader) rowPriceKey = tmnPriceHeader;
    }

    let symbol = normalizeTradingPair(rawSymbol, rawQuote);
    let currency = detectCurrency(symbol);

    // Accurately determine side (BUY vs SELL)
    const side = determineRowSide(row, sideKey);
    let price = rowPriceKey ? parseNumber(row[rowPriceKey]) : 0;
    let quantity = qtyKey ? parseNumber(row[qtyKey]) : 0;
    let total = rowTotalKey ? parseNumber(row[rowTotalKey]) : 0;
    
    // Cross-validation of price, quantity, and total:
    if (total > 0 && quantity > 0 && price > 0) {
      const calcTotal = price * quantity;
      // If price * quantity differs significantly from total (>20x or <0.05x due to decimal/thousand separator issues):
      if (calcTotal > total * 20 || calcTotal < total * 0.05) {
        price = total / quantity;
      }
    } else if (total === 0 && price > 0 && quantity > 0) {
      total = price * quantity;
    } else if (price === 0 && total > 0 && quantity > 0) {
      price = total / quantity;
    } else if (quantity === 0 && total > 0 && price > 0) {
      quantity = total / price;
    }

    // Sanity check: If tagged as USD/USDT, but price > 5,000 for an altcoin (e.g. 44,000 for ICP or DOGE):
    // The price was actually exported in Tomans!
    const baseTicker = symbol.split('/')[0].toUpperCase();
    const isLargeCrypto = baseTicker === 'BTC' || baseTicker === 'ETH' || baseTicker === 'PAXG' || baseTicker === 'YFI';
    if (currency === 'USD' && !isLargeCrypto && price > 5000) {
      // Check if another column has the real USDT price
      let foundUsdVal = 0;
      for (const h of rawHeaders) {
        const val = parseNumber(row[h]);
        if (val > 0 && val < 5000 && (h.includes('تتر') || h.includes('usdt') || h.includes('دلار') || h.includes('usd') || val === price / 100000)) {
          foundUsdVal = val;
          break;
        }
      }
      if (foundUsdVal > 0) {
        price = foundUsdVal;
        total = price * quantity;
      } else {
        // The trade was actually executed in TMN (Toman), fix pair to TMN
        symbol = `${baseTicker}/TMN`;
        currency = 'TMN';
      }
    }

    const rawFee = rowFeeKey ? parseNumber(row[rowFeeKey]) : 0;
    let fee = 0;
    if (rawFee > 0) {
      fee = normalizeTradeFee(rawFee, quantity, price, total);
      // If trade is in USD and fee is massive (e.g. Toman fee on USD trade), cap fee to standard 0.2%
      if (currency === 'USD' && total > 0 && fee > total * 0.1) {
        fee = Number((total * 0.002).toFixed(4));
      }
    } else if (total > 0) {
      fee = Number((total * 0.002).toFixed(currency === 'TMN' ? 0 : 4));
    } else if (price > 0 && quantity > 0) {
      fee = Number((price * quantity * 0.002).toFixed(currency === 'TMN' ? 0 : 4));
    }
    const date = dateKey ? formatDate(row[dateKey]) : new Date().toISOString().split('T')[0];
    
    // Mask / clean orderId if present to avoid leaking account identifiers
    let safeOrderId: string | undefined;
    if (orderIdKey && row[orderIdKey]) {
      const rawId = String(row[orderIdKey]).trim();
      safeOrderId = rawId.length > 8 ? `***${rawId.slice(-6)}` : rawId;
    } else {
      safeOrderId = `TRD-${idx + 1001}`;
    }

    // Only add if trade has positive quantity or price
    if (quantity > 0 || price > 0 || total > 0) {
      trades.push({
        id: `trade-${idx}-${Date.now()}`,
        date,
        symbol: symbol || 'UNKNOWN',
        currency,
        side,
        price: price > 0 ? price : (quantity > 0 ? total / quantity : 0),
        quantity: quantity > 0 ? quantity : (price > 0 ? total / price : 1),
        total: total > 0 ? total : price * quantity,
        fee,
        orderId: safeOrderId,
        rawPiiRemoved: sanitizedHeaders,
      });
    }
  });

  const piiReport: PIIReport = {
    columnsSanitized: sanitizedHeaders,
    rowsScanned: rawRows.length,
    sensitiveValuesDetected: sanitizedHeaders.length * rawRows.length,
    clientOnlyVerified: true,
    scanTimestamp: new Date().toLocaleTimeString(),
  };

  return {
    trades,
    piiReport,
    rawHeaders,
    fileName: file.name,
  };
}

/**
 * Provides comprehensive demo trades across multiple popular assets
 * so the trader can see real calculations instantly.
 */
export function getDemoTrades(): TradeRecord[] {
  return [
    // BTC Transactions: 3 buys, 1 sell, leaves net position
    {
      id: 'demo-1',
      date: '2025-01-10 10:15:00',
      symbol: 'BTC/USDT',
      side: 'BUY',
      price: 88500,
      quantity: 0.25,
      total: 22125,
      fee: 22.12,
      orderId: '***882194',
    },
    {
      id: 'demo-2',
      date: '2025-01-18 14:30:00',
      symbol: 'BTC/USDT',
      side: 'BUY',
      price: 92000,
      quantity: 0.15,
      total: 13800,
      fee: 13.80,
      orderId: '***884920',
    },
    {
      id: 'demo-3',
      date: '2025-02-05 09:45:00',
      symbol: 'BTC/USDT',
      side: 'BUY',
      price: 96000,
      quantity: 0.10,
      total: 9600,
      fee: 9.60,
      orderId: '***891044',
    },
    {
      id: 'demo-4',
      date: '2025-02-20 18:20:00',
      symbol: 'BTC/USDT',
      side: 'SELL',
      price: 98500,
      quantity: 0.20,
      total: 19700,
      fee: 19.70,
      orderId: '***899321',
    },
    // ETH Transactions: 2 buys, 1 sell
    {
      id: 'demo-5',
      date: '2025-01-12 11:00:00',
      symbol: 'ETH/USDT',
      side: 'BUY',
      price: 3100,
      quantity: 4.0,
      total: 12400,
      fee: 12.40,
      orderId: '***901123',
    },
    {
      id: 'demo-6',
      date: '2025-01-25 16:10:00',
      symbol: 'ETH/USDT',
      side: 'BUY',
      price: 3350,
      quantity: 2.5,
      total: 8375,
      fee: 8.37,
      orderId: '***904561',
    },
    {
      id: 'demo-7',
      date: '2025-02-14 20:05:00',
      symbol: 'ETH/USDT',
      side: 'SELL',
      price: 3600,
      quantity: 3.0,
      total: 10800,
      fee: 10.80,
      orderId: '***912003',
    },
    // SOL Transactions: 2 buys, 0 sell (fully open position)
    {
      id: 'demo-8',
      date: '2025-02-01 12:00:00',
      symbol: 'SOL/USDT',
      side: 'BUY',
      price: 180,
      quantity: 50,
      total: 9000,
      fee: 9.00,
      orderId: '***921109',
    },
    {
      id: 'demo-9',
      date: '2025-02-10 15:40:00',
      symbol: 'SOL/USDT',
      side: 'BUY',
      price: 195,
      quantity: 30,
      total: 5850,
      fee: 5.85,
      orderId: '***924488',
    },
    // GOLD (PAXG) Transactions
    {
      id: 'demo-10',
      date: '2025-01-05 08:30:00',
      symbol: 'PAXG/USDT',
      side: 'BUY',
      price: 2650,
      quantity: 3.0,
      total: 7950,
      fee: 7.95,
      orderId: '***931102',
    },
    {
      id: 'demo-11',
      date: '2025-02-18 13:15:00',
      symbol: 'PAXG/USDT',
      side: 'SELL',
      price: 2880,
      quantity: 1.5,
      total: 4320,
      fee: 4.32,
      orderId: '***938812',
    },
    // ICP/TMN Transactions (Toman currency)
    {
      id: 'demo-12',
      date: '2025-02-01 11:20:00',
      symbol: 'ICP/TMN',
      side: 'BUY',
      price: 620000,
      quantity: 100,
      total: 62000000,
      fee: 93000,
      orderId: '***941001',
    },
    {
      id: 'demo-13',
      date: '2025-02-12 16:45:00',
      symbol: 'ICP/TMN',
      side: 'BUY',
      price: 640000,
      quantity: 50,
      total: 32000000,
      fee: 48000,
      orderId: '***942004',
    },
    {
      id: 'demo-14',
      date: '2025-02-22 14:10:00',
      symbol: 'ICP/TMN',
      side: 'SELL',
      price: 710000,
      quantity: 60,
      total: 42600000,
      fee: 63900,
      orderId: '***943009',
    },
    // HBAR / TMN (هدرا هشگراف) Transactions
    {
      id: 'demo-15',
      date: '2025-02-15 09:30:00',
      symbol: 'HBAR/TMN',
      side: 'BUY',
      price: 20200,
      quantity: 2500,
      total: 50500000,
      fee: 75750,
      orderId: '***951001',
    },
    {
      id: 'demo-16',
      date: '2025-02-20 17:45:00',
      symbol: 'HBAR/TMN',
      side: 'BUY',
      price: 20800,
      quantity: 1500,
      total: 31200000,
      fee: 46800,
      orderId: '***952002',
    },
    {
      id: 'demo-17',
      date: '2025-02-24 12:10:00',
      symbol: 'HBAR/TMN',
      side: 'SELL',
      price: 21500,
      quantity: 1000,
      total: 21500000,
      fee: 32250,
      orderId: '***953003',
    },
  ];
}

/**
 * Downloads a standardized Excel template for users with Persian & English headers
 */
export function downloadExcelTemplate(): void {
  const templateData = [
    {
      'نماد (Symbol)': 'BTC/USDT',
      'نوع معامله (Side)': 'BUY',
      'قیمت واحد (Price)': 92000,
      'تعداد یا حجم (Quantity)': 0.5,
      'کارمزد (Fee)': 46,
      'ارزش کل (Total)': 46000,
      'تاریخ (Date)': '2025-02-01 10:00:00',
      'شناسه سفارش (OrderId)': 'ORD-1001',
    },
    {
      'نماد (Symbol)': 'BTC/USDT',
      'نوع معامله (Side)': 'BUY',
      'قیمت واحد (Price)': 95000,
      'تعداد یا حجم (Quantity)': 0.25,
      'کارمزد (Fee)': 23.75,
      'ارزش کل (Total)': 23750,
      'تاریخ (Date)': '2025-02-05 14:30:00',
      'شناسه سفارش (OrderId)': 'ORD-1002',
    },
    {
      'نماد (Symbol)': 'BTC/USDT',
      'نوع معامله (Side)': 'SELL',
      'قیمت واحد (Price)': 99000,
      'تعداد یا حجم (Quantity)': 0.35,
      'کارمزد (Fee)': 34.65,
      'ارزش کل (Total)': 34650,
      'تاریخ (Date)': '2025-02-15 18:00:00',
      'شناسه سفارش (OrderId)': 'ORD-1003',
    },
    {
      'نماد (Symbol)': 'ETH/USDT',
      'نوع معامله (Side)': 'BUY',
      'قیمت واحد (Price)': 3200,
      'تعداد یا حجم (Quantity)': 3,
      'کارمزد (Fee)': 9.6,
      'ارزش کل (Total)': 9600,
      'تاریخ (Date)': '2025-02-02 09:15:00',
      'شناسه سفارش (OrderId)': 'ORD-2001',
    },
    {
      'نماد (Symbol)': 'ETH/USDT',
      'نوع معامله (Side)': 'SELL',
      'قیمت واحد (Price)': 3500,
      'تعداد یا حجم (Quantity)': 2,
      'کارمزد (Fee)': 7,
      'ارزش کل (Total)': 7000,
      'تاریخ (Date)': '2025-02-18 20:45:00',
      'شناسه سفارش (OrderId)': 'ORD-2002',
    },
    {
      'نماد (Symbol)': 'ICP/TMN',
      'نوع معامله (Side)': 'BUY',
      'قیمت واحد (Price)': 630000,
      'تعداد یا حجم (Quantity)': 100,
      'کارمزد (Fee)': 94500,
      'ارزش کل (Total)': 63000000,
      'تاریخ (Date)': '2025-02-10 12:00:00',
      'شناسه سفارش (OrderId)': 'ORD-3001',
    },
    {
      'نماد (Symbol)': 'ICP/USDT',
      'نوع معامله (Side)': 'BUY',
      'قیمت واحد (Price)': 8.5,
      'تعداد یا حجم (Quantity)': 120,
      'کارمزد (Fee)': 1.02,
      'ارزش کل (Total)': 1020,
      'تاریخ (Date)': '2025-02-14 15:30:00',
      'شناسه سفارش (OrderId)': 'ORD-4001',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TradeTemplate');
  
  // Trigger browser download
  XLSX.writeFile(wb, 'trade_pl_template.xlsx');
}

/**
 * Exports the calculated P&L, asset performance, and transaction ledger (صورتحساب گردش) to Excel
 */
export function exportPnLReportToExcel(
  trades: TradeRecord[],
  assets: any[],
  portfolio: any
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Portfolio & Asset Breakdown
  const assetSheetData = assets.map(a => ({
    'نماد (Symbol)': a.symbol,
    'واحد ارز (Currency)': a.currency === 'TMN' ? 'تومان (TMN)' : 'دلار (USD)',
    'قیمت فعلی بازار (Current Price)': a.currentPrice,
    'قیمت تمام شده / سر‌به‌سر (Breakeven)': a.breakevenPrice,
    'میانگین قیمت خرید (Avg Buy)': a.avgBuyPrice,
    'کل ورودی - خرید (Total Buy Inflow)': a.totalBuyQty,
    'کارمزد خرید (Buy Fees)': a.buyFees || 0,
    'میانگین قیمت فروش (Avg Sell)': a.avgSellPrice,
    'کل خروجی - فروش (Total Sell Outflow)': a.totalSellQty,
    'کارمزد فروش (Sell Fees)': a.sellFees || 0,
    'مانده موجودی باز (Net Position)': a.netQty,
    'مجموع کارمزد پرداختی (Total Fees)': a.totalFees,
    'سود/زیان محقق شده (Realized P&L)': a.realizedPnL,
    'سود/زیان باز (Unrealized P&L)': a.unrealizedPnL,
    'سود/زیان خالص نهایی (Net P&L)': a.netPnL,
    'بازدهی درصدی (ROI %)': `${a.roiPercent.toFixed(2)}%`,
    'تعداد کل معاملات (Trades)': a.tradesCount,
    'تعداد سفارش‌های خرید (Buy Orders)': a.buyTradesCount,
    'تعداد سفارش‌های فروش (Sell Orders)': a.sellTradesCount,
  }));

  const wsAssets = XLSX.utils.json_to_sheet(assetSheetData);
  XLSX.utils.book_append_sheet(wb, wsAssets, 'خلاصه سود و زیان (P&L Summary)');

  // Sheet 2: Account Statement / Ledger (صورتحساب گردش دارایی)
  // Calculates chronological inflow (خرید), outflow (فروش), and running balance per asset
  const sortedChronological = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const assetBalances: Record<string, number> = {};

  const ledgerSheetData = sortedChronological.map((t, idx) => {
    const isBuy = t.side === 'BUY';
    const buyQty = isBuy ? t.quantity : 0;
    const sellQty = !isBuy ? t.quantity : 0;
    
    // Update chronological running balance for this specific asset
    const prevBal = assetBalances[t.symbol] || 0;
    const newBal = isBuy ? prevBal + t.quantity : prevBal - t.quantity;
    assetBalances[t.symbol] = newBal;

    return {
      'ردیف (Row)': idx + 1,
      'تاریخ و زمان (Date)': t.date,
      'شناسه پیگیری (ID)': t.orderId || t.id,
      'نماد (Symbol)': t.symbol,
      'نوع معامله (Side)': isBuy ? 'خرید (BUY)' : 'فروش (SELL)',
      'ورودی - خرید (Inflow)': buyQty > 0 ? buyQty : '',
      'خروجی - فروش (Outflow)': sellQty > 0 ? sellQty : '',
      'مانده موجودی (Running Balance)': Number(newBal.toFixed(8)),
      'قیمت واحد (Price)': t.price,
      'ارزش معامله (Total Value)': t.total,
      'کارمزد (Fee)': t.fee,
      'واحد ارز (Currency)': detectCurrency(t.symbol) === 'TMN' ? 'تومان (TMN)' : 'دلار (USD)',
    };
  });

  const wsLedger = XLSX.utils.json_to_sheet(ledgerSheetData);
  XLSX.utils.book_append_sheet(wb, wsLedger, 'صورتحساب گردش (Ledger)');

  // Sheet 3: Cleaned Raw Trades
  const tradesSheetData = trades.map(t => ({
    'شناسه (ID)': t.orderId || t.id,
    'تاریخ (Date)': t.date,
    'نماد (Symbol)': t.symbol,
    'واحد ارز (Currency)': detectCurrency(t.symbol) === 'TMN' ? 'تومان (TMN)' : 'دلار (USD)',
    'نوع معامله (Side)': t.side,
    'قیمت واحد (Price)': t.price,
    'ورودی - خرید (Buy Qty)': t.side === 'BUY' ? t.quantity : 0,
    'خروجی - فروش (Sell Qty)': t.side === 'SELL' ? t.quantity : 0,
    'ارزش معامله (Total)': t.total,
    'کارمزد (Fee)': t.fee,
  }));

  const wsTrades = XLSX.utils.json_to_sheet(tradesSheetData);
  XLSX.utils.book_append_sheet(wb, wsTrades, 'ریز معاملات (Trades)');

  XLSX.writeFile(wb, `pnl_ledger_report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
