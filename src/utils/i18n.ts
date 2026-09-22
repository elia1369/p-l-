import { Language } from '../types';

export const translations = {
  fa: {
    appTitle: 'تحلیل‌گر سود و زیان معاملات (P&L)',
    appSubtitle: 'محاسبه پیشرفته کارمزدها، میانگین خرید و فروش، نقطه سر‌به‌سر و شبیه‌ساز قیمت بازار با امنیت کامل PII',
    navTrades: 'معاملات',
    navAssets: 'تحلیل نمادها',
    navSimulator: 'شبیه‌ساز سود',
    navPii: 'امنیت PII',
    uploadTitle: 'بارگذاری فایل اکسل معاملات',
    uploadDesc: 'فایل اکسل (.xlsx, .xls) یا CSV گزارش معاملات خود را بکشید و رها کنید',
    uploadBtn: 'انتخاب فایل اکسل',
    loadDemoBtn: 'بارگذاری داده‌های نمونه ترید',
    downloadTemplateBtn: 'دریافت قالب استاندارد اکسل',
    dragDropText: 'فایل را اینجا رها کنید یا کلیک نمایید',
    supportedFormats: 'پشتیبانی از فرمت‌های XLSX, XLS, CSV (والکس، نوبیتکس، بایننس و سفارشی)',
    fileLoaded: 'فایل با موفقیت بارگذاری و تحلیل شد',
    clearData: 'پاک‌سازی داده‌ها',

    // Input mode tabs
    tabExcelUpload: 'بارگذاری فایل اکسل',
    tabManualInput: 'استخراج از عکس معاملات (OCR هوش مصنوعی)',
    tabManualBadge: 'Gemini AI',

    // PII & Security
    piiBadge: 'حفاظت ۱۰۰٪ حریم خصوصی (PII Shield)',
    piiModalTitle: 'گزارش امنیتی و محافظت از اطلاعات هویتی (PII)',
    piiModalDesc: 'تمام عملیات خواندن اکسل و پردازش اطلاعات صرفاً در حافظه محلی مرورگر شما (Client-side) صورت می‌گیرد و هیچ داده‌ای به سرور ارسال نمی‌شود.',
    piiStrippedNotice: 'ستون‌های حساس شناسایی و قبل از پردازش کاملاً حذف یا امن‌سازی شدند:',
    piiNoneFound: 'هیچ ستون هویتی پرخطری در فایل یافت نشد.',
    piiClientOnlyCheck: 'پردازش آفلاین در مرورگر تایید شد (عدم ارسال به سرور)',
    piiRowsScanned: 'تعداد سطرهای بررسی‌شده:',
    piiProtectedTags: ['نام کاربر', 'شماره حساب', 'ایمیل', 'شماره تماس', 'کد ملی', 'آدرس IP', 'کیف پول'],

    // Overview Cards
    netPnL: 'سود / زیان خالص کل',
    totalFeesPaid: 'مجموع کارمزد پرداختی',
    totalVolume: 'حجم کل معاملات',
    realizedPnL: 'سود/زیان محقق شده',
    unrealizedPnL: 'سود/زیان محقق نشده (باز)',
    totalBuyValue: 'ارزش کل خریدها',
    totalSellValue: 'ارزش کل فروش‌ها',
    openPositions: 'پوزیشن‌های باز',
    totalTrades: 'تعداد کل معاملات',
    roi: 'بازدهی سرمایه (ROI)',
    breakevenNotice: 'قیمت تمام شده شامل کلیه کارمزدهای پرداخت شده می‌باشد',

    // Asset Analysis Table & Inputs
    assetAnalysisTitle: 'تحلیل تفکیکی دارایی‌ها و مقایسه با قیمت فعلی',
    assetAnalysisSubtitle: 'قیمت فعلی بازار را برای هر نماد وارد کنید تا سود/زیان زنده و فاصله تا نقطه سر‌به‌سر محاسبه شود.',
    symbol: 'نماد / ارز',
    currentPrice: 'قیمت فعلی بازار',
    currentPriceInputPlaceholder: 'وارد کردن قیمت فعلی...',
    breakevenPrice: 'نقطه سر‌به‌سر (با کارمزد)',
    avgBuyPrice: 'میانگین خرید',
    avgSellPrice: 'میانگین فروش',
    totalBuyQty: 'کل حجم خرید',
    totalSellQty: 'کل حجم فروش',
    buyFees: 'کارمزد خرید',
    sellFees: 'کارمزد فروش',
    netPosition: 'موجودی باز (مانده)',
    status: 'وضعیت',
    profit: 'سودده',
    loss: 'زیان‌ده',
    neutral: 'سر‌به‌سر',
    aboveBreakeven: 'بالای قیمت تمام شده',
    belowBreakeven: 'پایین قیمت تمام شده',
    diffPercent: 'فاصله تا سر‌به‌سر',
    actions: 'عملیات',

    // Trade History Table
    tradeHistoryTitle: 'صورتحساب و تاریخچه گردش معاملات',
    searchPlaceholder: 'جستجو در نماد یا شناسه...',
    filterAll: 'همه گردش‌ها',
    filterBuy: 'ورودی‌ها (خرید)',
    filterSell: 'خروجی‌ها (فروش)',
    date: 'تاریخ / زمان',
    type: 'نوع معامله',
    price: 'قیمت واحد',
    quantity: 'مقدار / حجم',
    buyInflow: 'ورودی (خرید)',
    sellOutflow: 'خروجی (فروش)',
    runningBalance: 'مانده موجودی',
    total: 'ارزش معامله',
    fee: 'کارمزد پرداختی',
    noTradesFound: 'هیچ معامله‌ای یافت نشد',
    exportReport: 'خروجی گزارش صورتحساب Excel',

    // Charts Section
    chartsTitle: 'نمودارهای تحلیلی پورتفوی و تاریخچه معاملات',
    chartsSubtitle: 'توزیع وزنی دارایی‌ها و روند تجمعی حجم و جریان نقدینگی معاملات در طول زمان',
    portfolioDistribution: 'توزیع سبد دارایی (Portfolio Distribution)',
    distributionHoldings: 'ارزش دارایی‌های باز',
    distributionVolume: 'حجم کل معاملات',
    distributionBuyCost: 'سرمایه اولیه خرید',
    tradeHistoryTrend: 'روند تاریخچه معاملات (Trade Trend)',
    trendMetricVolume: 'حجم تجمعی و کارمزد',
    trendMetricCashflow: 'ارزش خرید در برابر فروش',
    cumulativeVolume: 'حجم تجمعی معاملات',
    cumulativeFees: 'کارمزد تجمعی',
    cumulativeBuys: 'ارزش تجمعی خرید',
    cumulativeSells: 'ارزش تجمعی فروش',
    dailyVolume: 'حجم این تاریخ',
    totalPortfolioValue: 'ارزش کل سبد',
    noOpenPositionsNotice: 'در حال حاضر موجودی باز وجود ندارد (نمایش بر اساس حجم کل معاملات).',
    percentOfPortfolio: 'سهم از سبد',
    tradesOnDate: 'معاملات در این تاریخ',
    assetsInPortfolio: 'تعداد دارایی‌ها',
    totalTradesRecorded: 'کل معاملات ثبت‌شده',

    // What-if / Simulator
    simulatorTitle: 'شبیه‌ساز سود در قیمت‌های مختلف (What-If)',
    simulatorDesc: 'بررسی کنید در صورت فروش موجودی باز در قیمت هدف، چقدر سود خالص کسب خواهید کرد',
    targetPrice: 'قیمت هدف فروش',
    projectedPnL: 'سود تخمینی',
    projectedRoi: 'بازدهی تخمینی',
    calculate: 'محاسبه',

    // Upload Box - Live Price & P&L Calculator
    calcBoxTitle: 'محاسبه سود و زیان با قیمت فعلی ارز',
    calcBoxDesc: 'بهای تمام شده خرید به صورت خودکار از فایل اکسل استخراج شده است؛ قیمت فعلی ارز را وارد نمایید تا میزان سود و زیان لحظه‌ای محاسبه شود.',
    costBasisLabel: 'بهای تمام شده خرید (از اکسل)',
    currentAssetPriceLabel: 'قیمت فعلی ارز',
    priceDifference: 'اختلاف قیمت با بهای خرید',
    calculatedPnL: 'محاسبه سود و زیان',
    positionPnL: 'سود/زیان کل موقعیت',
    currentHoldingValue: 'ارزش روز دارایی',
    selectAsset: 'انتخاب ارز / نماد',
    autoCalculatedFromExcel: 'محاسبه خودکار از روی فایل اکسل',
    userPriceInputNote: 'قیمت فعلی توسط کاربر در این کادر وارد می‌شود',
    remainingHolding: 'حجم دارایی موجود',
    unitProfitLoss: 'سود / زیان هر واحد',
    percentProfitLoss: 'درصد سود و زیان',
    noExcelFileYet: 'ابتدا فایل اکسل را بارگذاری کنید یا دکمه داده‌های نمونه را بزنید تا بهای تمام شده به صورت هوشمند محاسبه شود.',

    // Footer & Tooltips
    disclaimer: 'این ابزار صرفاً جهت مدیریت حسابداری و تحلیل شخصی معاملات است و توصیه مالی نمی‌باشد.',
    darkMode: 'حالت تیره',
    lightMode: 'حالت روشن',
    languageToggle: 'English',
    privacyGuaranteed: 'پردازش محلی، بدون سرور، کاملاً امن',
  },
  en: {
    appTitle: 'Trade P&L & Break-Even Analyzer',
    appSubtitle: 'Comprehensive analysis of fees paid, average buy/sell prices, cost basis, live market comparison with PII security',
    navTrades: 'Trades',
    navAssets: 'Asset Breakdown',
    navSimulator: 'Price Simulator',
    navPii: 'PII Security',
    uploadTitle: 'Upload Trade Excel File',
    uploadDesc: 'Drag and drop your trade history file (.xlsx, .xls, .csv)',
    uploadBtn: 'Browse Excel File',
    loadDemoBtn: 'Load Demo Trades',
    downloadTemplateBtn: 'Download Excel Template',
    dragDropText: 'Drop your file here or click to browse',
    supportedFormats: 'Supports XLSX, XLS, CSV from major exchanges & custom sheets',
    fileLoaded: 'File successfully parsed and analyzed',
    clearData: 'Clear Data',

    // Input mode tabs
    tabExcelUpload: 'Upload Excel File',
    tabManualInput: 'AI Screenshot OCR Extractor',
    tabManualBadge: 'Gemini AI',

    // PII & Security
    piiBadge: '100% Client-Side Privacy (PII Shield)',
    piiModalTitle: 'PII Security & Privacy Protection Report',
    piiModalDesc: 'All spreadsheet parsing and calculations happen exclusively in your browser memory. No trade logs or personal identifiers are ever sent to any server.',
    piiStrippedNotice: 'Potentially sensitive personal columns detected and sanitized:',
    piiNoneFound: 'No high-risk personal identifiers detected in the file.',
    piiClientOnlyCheck: 'Offline client-side processing verified (zero network leakage)',
    piiRowsScanned: 'Rows scanned:',
    piiProtectedTags: ['User Name', 'Account ID', 'Email', 'Phone', 'National ID', 'IP Address', 'Wallet Address'],

    // Overview Cards
    netPnL: 'Total Net P&L',
    totalFeesPaid: 'Total Fees Paid',
    totalVolume: 'Total Volume Traded',
    realizedPnL: 'Realized P&L',
    unrealizedPnL: 'Unrealized P&L (Open)',
    totalBuyValue: 'Total Buy Value',
    totalSellValue: 'Total Sell Value',
    openPositions: 'Open Positions',
    totalTrades: 'Total Trades',
    roi: 'Return on Capital (ROI)',
    breakevenNotice: 'Cost-basis includes all accumulated execution commissions',

    // Asset Analysis Table & Inputs
    assetAnalysisTitle: 'Asset Performance & Live Market Comparison',
    assetAnalysisSubtitle: 'Enter the current market price for each asset to calculate live P&L and cost-basis variance.',
    symbol: 'Symbol / Asset',
    currentPrice: 'Current Market Price',
    currentPriceInputPlaceholder: 'Enter current price...',
    breakevenPrice: 'Breakeven Price (Cost-Basis)',
    avgBuyPrice: 'Avg Buy Price',
    avgSellPrice: 'Avg Sell Price',
    totalBuyQty: 'Total Buy Qty',
    totalSellQty: 'Total Sell Qty',
    buyFees: 'Buy Fees',
    sellFees: 'Sell Fees',
    netPosition: 'Net Open Position',
    status: 'Status',
    profit: 'Profit',
    loss: 'Loss',
    neutral: 'Breakeven',
    aboveBreakeven: 'Above Breakeven',
    belowBreakeven: 'Below Breakeven',
    diffPercent: 'Distance to Breakeven',
    actions: 'Actions',

    // Trade History Table
    tradeHistoryTitle: 'Trade Ledger & Transaction Statement',
    searchPlaceholder: 'Search symbol or ID...',
    filterAll: 'All Flow',
    filterBuy: 'Inflow (Buys)',
    filterSell: 'Outflow (Sells)',
    date: 'Date / Time',
    type: 'Type',
    price: 'Unit Price',
    quantity: 'Amount / Qty',
    buyInflow: 'Inflow (Buy)',
    sellOutflow: 'Outflow (Sell)',
    runningBalance: 'Balance',
    total: 'Trade Value',
    fee: 'Fee Paid',
    noTradesFound: 'No trades found',
    exportReport: 'Export Ledger Report',

    // Charts Section
    chartsTitle: 'Portfolio Distribution & Trade Trend Analytics',
    chartsSubtitle: 'Visual asset weight allocation and cumulative trading volume/cashflow progression over time',
    portfolioDistribution: 'Portfolio Distribution',
    distributionHoldings: 'Open Position Value',
    distributionVolume: 'Total Trading Volume',
    distributionBuyCost: 'Invested Capital',
    tradeHistoryTrend: 'Trade History Trend',
    trendMetricVolume: 'Cumulative Volume & Fees',
    trendMetricCashflow: 'Buy vs Sell Value',
    cumulativeVolume: 'Cumulative Volume',
    cumulativeFees: 'Cumulative Fees',
    cumulativeBuys: 'Cumulative Buys',
    cumulativeSells: 'Cumulative Sells',
    dailyVolume: 'Daily Volume',
    totalPortfolioValue: 'Total Portfolio Value',
    noOpenPositionsNotice: 'No open positions currently held (displaying by total trading volume).',
    percentOfPortfolio: 'Share of Portfolio',
    tradesOnDate: 'Trades on Date',
    assetsInPortfolio: 'Assets in Portfolio',
    totalTradesRecorded: 'Total Trades Logged',

    // What-if / Simulator
    simulatorTitle: 'What-If Price Simulator',
    simulatorDesc: 'Simulate your net profit if your remaining open position is sold at a specific target price',
    targetPrice: 'Target Exit Price',
    projectedPnL: 'Projected Net P&L',
    projectedRoi: 'Projected ROI',
    calculate: 'Calculate',

    // Upload Box - Live Price & P&L Calculator
    calcBoxTitle: 'P&L Calculator with Current Asset Price',
    calcBoxDesc: 'Cost basis is automatically calculated from Excel; enter the current asset price to see instant P&L.',
    costBasisLabel: 'Cost Basis / Buy Price (From Excel)',
    currentAssetPriceLabel: 'Current Asset Price',
    priceDifference: 'Price Difference vs Cost Basis',
    calculatedPnL: 'Calculated P&L',
    positionPnL: 'Total Position P&L',
    currentHoldingValue: 'Current Market Value',
    selectAsset: 'Select Asset',
    autoCalculatedFromExcel: 'Auto-calculated from Excel trade logs',
    userPriceInputNote: 'Enter the current market price in this field',
    remainingHolding: 'Remaining Holding',
    unitProfitLoss: 'Unit Profit / Loss',
    percentProfitLoss: 'P&L Percentage',
    noExcelFileYet: 'Upload an Excel file or load demo trades to automatically calculate the cost basis.',

    // Footer & Tooltips
    disclaimer: 'This tool is designed for trading accounting and educational analysis. Not financial advice.',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    languageToggle: 'فارسی',
    privacyGuaranteed: '100% In-Browser Local Processing, Zero Server Logs',
  }
};

export type CurrencyKind = 'TMN' | 'USD';

/**
 * Detects whether a symbol or currency representation is Toman (TMN / IRT / IRR) or Dollar (USD / USDT)
 */
export function detectCurrency(symbolOrAsset?: string): CurrencyKind {
  if (!symbolOrAsset) return 'USD';
  const clean = String(symbolOrAsset).toUpperCase().trim();

  // Explicit Toman indicators (e.g. icp/tmn, ICP/TMN, icptmn, icp-tmn, irt, toman, تومان, تومن, etc.)
  if (
    clean.includes('TMN') ||
    clean.includes('TOMAN') ||
    clean.includes('IRT') ||
    clean.includes('IRR') ||
    clean.includes('تومان') ||
    clean.includes('تومن') ||
    clean.includes('ریال')
  ) {
    return 'TMN';
  }

  return 'USD';
}

/**
 * Returns human-readable currency label
 */
export function getCurrencyLabel(currencyOrSymbol?: string, lang: Language = 'fa'): string {
  const kind = detectCurrency(currencyOrSymbol);
  if (kind === 'TMN') {
    return lang === 'fa' ? 'تومان' : 'TMN (Toman)';
  }
  return lang === 'fa' ? 'دلار ($)' : 'USD ($)';
}

/**
 * Formats financial amounts with Latin numerals (0-9) and correct currency positioning
 * - Toman: e.g. "1,250,000 تومان" or "1,250,000 TMN"
 * - Dollar: e.g. "$1,250.50" or "-$1,250.50"
 */
export function formatCurrency(
  num: number, 
  lang: Language = 'fa', 
  currencyOrSymbol?: string
): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  
  const kind = detectCurrency(currencyOrSymbol);
  const isToman = kind === 'TMN';
  const absNum = Math.abs(num);

  // Determine fraction digits based on currency
  let maxDecimals = 2;
  let minDecimals = 0;

  if (isToman) {
    // For Toman, integer amounts don't need decimal zeros; small numbers get up to 2 decimals
    maxDecimals = absNum < 10 && absNum > 0 ? 2 : (Number.isInteger(absNum) ? 0 : 2);
    minDecimals = 0;
  } else {
    // For USD, standard 2 decimals, or 4 decimals if micro-cent
    maxDecimals = absNum < 1 && absNum > 0 ? 4 : 2;
    minDecimals = absNum < 1 && absNum > 0 ? 4 : 2;
  }

  // ALWAYS format using 'en-US' so numbers appear in Latin digits (0-9)
  const formatted = absNum.toLocaleString('en-US', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: minDecimals,
  });

  const sign = num < 0 ? '-' : '';

  if (isToman) {
    const unit = lang === 'fa' ? 'تومان' : 'TMN';
    return `${sign}${formatted} ${unit}`;
  } else {
    return `${sign}$${formatted}`;
  }
}

/**
 * Formats numbers strictly in Latin digits (0-9) with commas
 */
export function formatNumber(num: number, _lang: Language = 'fa', maxDecimals = 4): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  // ALWAYS format using 'en-US' so numbers appear in Latin digits
  return num.toLocaleString('en-US', {
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Formats percentages strictly in Latin digits (0-9)
 */
export function formatPercent(num: number, _lang: Language = 'fa'): string {
  if (num === undefined || num === null || isNaN(num)) return '0%';
  const sign = num > 0 ? '+' : '';
  const formatted = Math.abs(num).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  return `${sign}${num < 0 ? '-' : ''}${formatted}%`;
}
