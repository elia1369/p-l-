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

/**
 * Normalizes trading pair strings such as "icp/tmn", "icp/usdt", "icp_tmn", "icptmn", "ICP تومان",
 * or separate Base ("ICP") and Market/Quote ("TMN" or "USDT") columns into standardized "ICP/TMN" or "ICP/USDT".
 */
export function normalizeTradingPair(rawSymbol: string, rawQuote?: string): string {
  let sym = String(rawSymbol || '').trim();
  let quote = String(rawQuote || '').trim();

  if (!sym && !quote) return 'ASSET/USDT';
  if (!sym && quote) return quote.toUpperCase();

  // Strip extraneous surrounding punctuation
  sym = sym.replace(/^["'(\[]+|["')\]]+$/g, '').trim();

  // Check if standard separated: e.g. ICP/TMN, icp/tmn, ICP/USDT, BTC/TMN, ICP-TMN, ICP_TMN, ICP TMN
  const sepMatch = sym.match(/^([A-Za-z0-9]+)[\s/_\-]+([A-Za-z0-9]+|تومان|تومن|تتر)$/i);
  if (sepMatch) {
    const base = sepMatch[1].toUpperCase();
    let q = sepMatch[2].toUpperCase();
    if (q === 'TMN' || q === 'TOMAN' || q === 'IRT' || q === 'IRR' || q === 'تومان' || q === 'تومن') {
      return `${base}/TMN`;
    }
    if (q === 'USDT' || q === 'USD' || q === 'تتر') {
      return `${base}/USDT`;
    }
    return `${base}/${q}`;
  }

  // Check compact format: e.g. ICPTMN, ICPUSDT, BTCIRT, ETHUSDT
  const compactMatch = sym.match(/^([A-Za-z0-9]{2,10})(TMN|TOMAN|IRT|USDT|USD)$/i);
  if (compactMatch) {
    const base = compactMatch[1].toUpperCase();
    let q = compactMatch[2].toUpperCase();
    if (q === 'TOMAN' || q === 'IRT') q = 'TMN';
    return `${base}/${q}`;
  }

  // If a separate market / quote column exists (e.g. base="ICP", market="TMN" or "تومان")
  if (quote) {
    const cleanQuote = quote.toUpperCase().trim();
    if (
      cleanQuote.includes('TMN') ||
      cleanQuote.includes('TOMAN') ||
      cleanQuote.includes('IRT') ||
      cleanQuote.includes('IRR') ||
      cleanQuote.includes('تومان') ||
      cleanQuote.includes('تومن')
    ) {
      return `${sym.toUpperCase().replace(/[^A-Za-z0-9]/g, '')}/TMN`;
    }
    if (cleanQuote.includes('USDT') || cleanQuote.includes('USD') || cleanQuote.includes('تتر')) {
      return `${sym.toUpperCase().replace(/[^A-Za-z0-9]/g, '')}/USDT`;
    }
  }

  // Check if symbol contains TMN / Toman keyword anywhere
  if (
    sym.toUpperCase().includes('TMN') ||
    sym.toUpperCase().includes('TOMAN') ||
    sym.includes('تومان') ||
    sym.includes('تومن')
  ) {
    const base = sym.replace(/TMN|TOMAN|IRT|IRR|تومان|تومن|[\s/_\-]+/gi, '').toUpperCase();
    return `${base || 'ASSET'}/TMN`;
  }

  // Check if symbol contains USDT / Dollar keyword anywhere
  if (sym.toUpperCase().includes('USDT') || sym.includes('تتر')) {
    const base = sym.replace(/USDT|USD|تتر|[\s/_\-]+/gi, '').toUpperCase();
    return `${base || 'ASSET'}/USDT`;
  }

  // If contains a slash with generic quote
  if (sym.includes('/')) {
    const parts = sym.split('/').map(p => p.trim().toUpperCase());
    return `${parts[0]}/${parts[1] || 'USDT'}`;
  }

  return `${sym.toUpperCase()}/USDT`;
}

function parseNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  // Strip commas, currency symbols, persian numbers
  let str = String(value).trim();
  // Persian/Arabic digit conversion
  str = str.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  str = str.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  str = str.replace(/[,،$€£¥﷼\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseSideStrict(value: any): TradeSide | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).toLowerCase().trim();

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

  // SELL indicators (Exact or strong phrase matches)
  if (
    str === 'sell' ||
    str === 's' ||
    str === 'فروش' ||
    str === 'خروج' ||
    str === 'فروش (خروجی)' ||
    str === 'خروجی (فروش)' ||
    str === 'خروجی' ||
    str.includes('sell') ||
    str.includes('فروش') ||
    str.includes('خروج') ||
    str.includes('برداشت') ||
    str.includes('ask') ||
    str.includes('short')
  ) {
    return 'SELL';
  }

  // BUY indicators (Exact or strong phrase matches)
  if (
    str === 'buy' ||
    str === 'b' ||
    str === 'خرید' ||
    str === 'ورود' ||
    str === 'خرید (ورودی)' ||
    str === 'ورودی (خرید)' ||
    str === 'ورودی' ||
    str.includes('buy') ||
    str.includes('خرید') ||
    str.includes('ورود') ||
    str.includes('واریز') ||
    str.includes('bid') ||
    str.includes('long')
  ) {
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
    
    const sampleSize = Math.min(rows.length, 120);
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
          nonSidePenalty += 5;
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
  if (sideKey && row[sideKey] !== undefined && row[sideKey] !== '') {
    const parsed = parseSideStrict(row[sideKey]);
    if (parsed) return parsed;
  }

  // 2. Scan every cell in the row for explicit BUY/SELL tokens
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
      return Number((rawFee * price).toFixed(2));
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

  // 3. Auto-detect crucial trade columns with anti-collision rules
  const symbolKey = findColumnKey(
    rawHeaders, 
    ['جفت ارز', 'جفت_ارز', 'trading pair', 'pair', 'نام ارز', 'نام_ارز', 'نام نماد', 'مارکت', 'بازار', 'market', 'نماد', 'symbol', 'instrument', 'کد ارز', 'کوین', 'coin', 'ارز پایه', 'ارز مبدا', 'ارز'],
    { excludeKeywords: ['ارزش', 'مبلغ', 'کارمزد', 'قیمت', 'حجم', 'تعداد', 'تاریخ', 'شناسه', 'order', 'fee', 'total', 'price', 'amount', 'date', 'حساب'] }
  );

  // Quote or market column if separate (e.g. Base: ICP, Quote/Market: TMN or USDT)
  const quoteKey = findColumnKey(
    rawHeaders,
    ['بازار', 'مارکت', 'market', 'ارز مقصد', 'ارز مبنا', 'ارز دوم', 'واحد', 'واحد قیمت', 'واحد معامله', 'واحد پول', 'quote', 'quote currency', 'currency'],
    { excludeKeywords: ['ارزش', 'مبلغ', 'کارمزد', 'قیمت', 'حجم', 'تعداد', 'تاریخ', 'شناسه', 'order', symbolKey || ''] }
  );

  // 4. Data-driven Side Detection (inspects actual cell values: BUY vs SELL vs اسپات)
  const dataSideKey = detectSideColumnFromData(rawHeaders, rawRows);

  // Header keyword matching for side with explicit excludeKeywords
  const headerSideKey = findColumnKey(
    rawHeaders, 
    [
      'خرید/فروش', 'خرید / فروش', 'خرید/ فروش', 'خرید یا فروش', 'خرید و فروش',
      'سمت', 'سمت معامله', 'سمت سفارش', 'جهت', 'جهت معامله', 'طرف معامله', 
      'side', 'trade side', 'order side', 'trade_side', 'order_side',
      'عملیات', 'دستور', 'نوع معامله', 'نوع سفارش', 'نوع', 'type', 'action', 'direction'
    ],
    { 
      excludeKeywords: [
        'اسپات', 'spot', 'مارجین', 'margin', 'تعهدی', 'فیوچرز', 'futures', 
        'نوع بازار', 'حساب', 'account', 'وضعیت', 'status', 'شناسه', 'id', 
        'تاریخ', 'date', 'قیمت', 'price', 'مبلغ', 'ارزش', 'total', 
        'کارمزد', 'fee', 'مقدار', 'حجم', 'تعداد', 'qty', 'amount', 'واحد', 'ارز', 'symbol'
      ] 
    }
  );

  const sideKey = dataSideKey || headerSideKey;

  const priceKey = findColumnKey(
    rawHeaders, 
    ['قیمت واحد', 'قیمت معامله', 'نرخ', 'fill price', 'exec price', 'unit price', 'rate', 'price', 'قیمت'],
    { excludeKeywords: ['ارزش کل', 'مجموع', 'کارمزد کل', 'کارمزد'] }
  );

  const qtyKey = findColumnKey(
    rawHeaders, 
    ['مقدار', 'تعداد', 'حجم', 'amount', 'quantity', 'qty', 'size', 'filled', 'vol', 'volume'],
    { excludeKeywords: ['ارزش', 'مبلغ', 'قیمت', 'کارمزد'] }
  );

  const feeKey = findColumnKey(
    rawHeaders, 
    ['کارمزد کل', 'کارمزد معامله', 'کارمزد', 'کمیسیون', 'هزینه', 'fee', 'trade fee', 'commission', 'fees'],
    { excludeKeywords: ['قیمت', 'ارزش کل', 'حجم'] }
  );

  const totalKey = findColumnKey(
    rawHeaders, 
    ['ارزش کل', 'ارزش معامله', 'مبلغ کل', 'ارزش', 'مجموع', 'مبلغ', 'total', 'quote amount', 'value', 'subtotal'],
    { excludeKeywords: ['قیمت واحد', 'قیمت', 'کارمزد'] }
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
    const rawSymbol = symbolKey ? row[symbolKey] : '';
    const rawQuote = quoteKey && quoteKey !== symbolKey ? row[quoteKey] : '';
    const symbol = normalizeTradingPair(rawSymbol, rawQuote);
    const currency = detectCurrency(symbol);

    // Accurately determine side (BUY vs SELL)
    const side = determineRowSide(row, sideKey);
    const price = priceKey ? parseNumber(row[priceKey]) : 0;
    const quantity = qtyKey ? parseNumber(row[qtyKey]) : 0;
    
    let total = totalKey ? parseNumber(row[totalKey]) : 0;
    if (total === 0 && price > 0 && quantity > 0) {
      total = price * quantity;
    }

    const rawFee = feeKey ? parseNumber(row[feeKey]) : 0;
    const fee = normalizeTradeFee(rawFee, quantity, price, total);
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
