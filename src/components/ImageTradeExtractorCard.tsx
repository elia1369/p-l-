import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Camera, 
  UploadCloud, 
  Sparkles, 
  FileImage, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Calculator, 
  DollarSign, 
  Table, 
  ArrowRight, 
  Info, 
  Layers, 
  Receipt, 
  Eye, 
  Coins, 
  PlusCircle,
  Filter,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { TradeRecord, Language, CurrencyKind } from '../types';
import { formatCurrency, formatPercent, formatNumber } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';

export interface ExtractedRow {
  id: string;
  symbol: string;
  currency: CurrencyKind;
  price: number;
  quantity: number;
  fee: number;
  feeUnit: 'COIN' | 'CURRENCY';
  side: 'BUY' | 'SELL';
  total?: number;
  date?: string;
  orderId?: string;
}

interface ExtractionResult {
  detectedAssets?: string[];
  detectedSymbol: string;
  detectedCurrency: string;
  exchangeName?: string;
  trades: ExtractedRow[];
  confidenceNotes?: string;
}

export interface AssetCalculation {
  symbol: string;
  currency: CurrencyKind;
  rows: ExtractedRow[];
  totalGrossSpend: number;
  totalPurchasedCoins: number;
  totalFeeCoins: number;
  totalFeeCurrency: number;
  feePercentage: number;
  // BUY vs SELL separated metrics
  buyCount: number;
  sellCount: number;
  totalBuyGross: number;
  totalBuyQty: number;
  buyFeeCoins: number;
  buyFeeCurrency: number;
  buyFeePercent: number;
  netBuyCoins: number;
  totalSellGross: number;
  totalSellQty: number;
  sellFeeCurrency: number;
  sellFeePercent: number;
  netSellRevenue: number;
  netHoldingQty: number;
  realizedPnL: number;
  // Cost Basis & Valuation
  netReceivedCoins: number;
  totalCostWithFees: number;
  costBasisPerUnit: number;
  rawAvgPrice: number;
  livePrice: number;
  activeHolding: number;
  currentMarketValue: number;
  diffPerUnit: number;
  pnlPercent: number;
  totalPnL: number;
  isProfit: boolean;
  isLoss: boolean;
}

interface Props {
  lang: Language;
  onApplyManualData: (trades: TradeRecord[], symbol: string, currency: CurrencyKind) => void;
  customPrices?: Record<string, number>;
  onUpdatePrice?: (symbol: string, newPrice: number) => void;
}

export const ImageTradeExtractorCard: React.FC<Props> = ({
  lang,
  onApplyManualData,
  customPrices = {},
  onUpdatePrice,
}) => {
  const isFa = lang === 'fa';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Uploaded Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // AI Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);

  // Config State
  const [assetSymbol, setAssetSymbol] = useState('ICP');
  const [quoteCurrency, setQuoteCurrency] = useState<CurrencyKind>('TMN');
  const [feeDeductionMode, setFeeDeductionMode] = useState<'DEDUCT_FROM_COIN' | 'ADD_TO_TOTAL_COST'>('DEDUCT_FROM_COIN');

  // Multi-Currency & Active Tab State
  const [extractedRows, setExtractedRows] = useState<ExtractedRow[]>([]);
  const [activeAssetTab, setActiveAssetTab] = useState<string>('ALL');
  const [livePrices, setLivePrices] = useState<Record<string, string>>({});

  // Clipboard Paste Listener: User can press Ctrl+V anywhere on the page to paste a screenshot!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleSelectImage(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Helper to optimize oversized images for faster multimodal transmission
  const optimizeImageForOCR = (dataUrl: string, mimeType: string): Promise<{ dataUrl: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1920;
        let width = img.width;
        let height = img.height;
        if (width <= maxDim && height <= maxDim && dataUrl.length < 2 * 1024 * 1024) {
          return resolve({ dataUrl, mimeType });
        }
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ dataUrl, mimeType });
        }
        ctx.drawImage(img, 0, 0, width, height);
        const optimized = canvas.toDataURL('image/jpeg', 0.90);
        resolve({ dataUrl: optimized, mimeType: 'image/jpeg' });
      };
      img.onerror = () => resolve({ dataUrl, mimeType });
      img.src = dataUrl;
    });
  };

  const parseErrorMessage = (err: any, isFaLang: boolean): string => {
    const raw = err?.message || String(err || '');
    if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
      return isFaLang 
        ? 'سرور هوش مصنوعی گوگل در این لحظه با ترافیک موقت بالا مواجه شد (کد ۵۰۳). مدل‌های جایگزین فعال شدند؛ لطفاً روی دکمه «تلاش مجدد» زیر کلیک فرمایید.'
        : 'Google AI server is experiencing temporary high demand (503). Fallback models are activated. Please click "Retry" below.';
    }
    if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
      return isFaLang
        ? 'ترافیک بالای موقت. لطفاً چند ثانیه دیگر روی «تلاش مجدد» کلیک کنید.'
        : 'Temporary rate limit. Please retry in a few seconds.';
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) {
        return parseErrorMessage(parsed.error, isFaLang);
      }
    } catch {}
    return raw || (isFaLang ? 'خطا در ارتباط با سرور و استخراج هوشمند.' : 'Extraction error.');
  };

  const handleSelectImage = async (file: File) => {
    setExtractionError(null);
    if (!file.type.startsWith('image/')) {
      setExtractionError(isFa ? 'لطفاً یک فایل تصویری (PNG, JPG, WebP) انتخاب فرمایید.' : 'Please select an image file.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      const optimized = await optimizeImageForOCR(result, file.type);
      triggerAiExtraction(optimized.dataUrl, optimized.mimeType);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectImage(e.dataTransfer.files[0]);
    }
  };

  // Perform AI Extraction using Gemini Vision OCR endpoint
  const triggerAiExtraction = async (base64Data: string, mimeType: string, attempt = 1) => {
    setIsExtracting(true);
    if (attempt === 1) {
      setExtractionError(null);
    }

    try {
      const res = await fetch('/api/extract-trades-from-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          userNotes: 'Extract all trade rows. Strictly distinguish BUY (خرید) from SELL (فروش) rows. NEVER sum or aggregate BUY and SELL quantities together. Keep each executed order as a separate row with its exact quantity, side, price, and fee.',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        // If transient 503 or 429 and first attempt, auto retry once after brief delay
        const errText = String(json.error || json.rawError || '');
        if (attempt < 2 && (errText.includes('503') || errText.includes('429') || errText.includes('high demand'))) {
          console.warn(`Transient server error encountered, auto-retrying (attempt ${attempt + 1})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return triggerAiExtraction(base64Data, mimeType, attempt + 1);
        }
        throw new Error(json.error || 'Failed to extract trade records from image.');
      }

      const data: ExtractionResult = json.data;
      setExtractionResult(data);

      const defaultSym = (data.detectedSymbol || 'ICP').toUpperCase().replace(/[^A-Z0-9]/g, '');
      setAssetSymbol(defaultSym);

      let defaultCurr: CurrencyKind = 'TMN';
      if (data.detectedCurrency) {
        const curr = data.detectedCurrency.toUpperCase();
        if (curr.includes('USD') || curr.includes('USDT') || curr === '$') {
          defaultCurr = 'USD';
        }
      }
      setQuoteCurrency(defaultCurr);

      // Populate extracted trade rows
      const rows: ExtractedRow[] = (data.trades || []).map((t: any, idx: number) => {
        let sym = t.symbol ? String(t.symbol).toUpperCase().replace(/[^A-Z0-9]/g, '') : defaultSym;
        if (!sym) sym = defaultSym;

        let c: CurrencyKind = defaultCurr;
        if (t.currency) {
          const cu = String(t.currency).toUpperCase();
          if (cu.includes('USD') || cu.includes('USDT') || cu === '$') c = 'USD';
          else c = 'TMN';
        }

        return {
          id: `extracted-${Date.now()}-${idx}`,
          symbol: sym,
          currency: c,
          price: Number(t.price) || 0,
          quantity: Number(t.quantity) || 0,
          fee: Number(t.fee) || 0,
          feeUnit: (t.feeUnit?.toUpperCase() === 'CURRENCY' ? 'CURRENCY' : 'COIN') as 'COIN' | 'CURRENCY',
          side: (t.side?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
          total: t.total ? Number(t.total) : undefined,
          date: t.date || undefined,
          orderId: t.orderId || `IMG-${idx + 1}`,
        };
      });

      setExtractedRows(rows);

      // Detect distinct assets
      const distinctSet = Array.from(new Set(rows.map(r => r.symbol))).filter(Boolean);
      if (distinctSet.length > 1) {
        setActiveAssetTab('ALL');
      } else if (distinctSet.length === 1) {
        setActiveAssetTab(distinctSet[0]);
      } else {
        setActiveAssetTab('ALL');
      }

      // Initialize live prices per asset
      const newLivePrices: Record<string, string> = { ...livePrices };
      distinctSet.forEach(sym => {
        const symRows = rows.filter(r => r.symbol === sym);
        if (symRows.length > 0 && !newLivePrices[sym]) {
          const avg = Math.round(symRows.reduce((a, b) => a + b.price, 0) / symRows.length);
          newLivePrices[sym] = String(avg);
        }
      });
      setLivePrices(newLivePrices);
    } catch (err: any) {
      console.error('Extraction Error:', err);
      const friendlyErr = parseErrorMessage(err, isFa);
      setExtractionError(friendlyErr);
    } finally {
      setIsExtracting(false);
    }
  };

  // Demo Generators
  const handleLoadSingleDemo = () => {
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
        <rect width="800" height="400" fill="#0f172a"/>
        <rect x="20" y="20" width="760" height="50" rx="8" fill="#1e293b"/>
        <text x="40" y="52" fill="#38bdf8" font-family="sans-serif" font-size="18" font-weight="bold">WALLEX - Trade History (Single Asset: ICP)</text>
        
        <rect x="20" y="85" width="760" height="35" fill="#334155"/>
        <text x="40" y="108" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Pair</text>
        <text x="140" y="108" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Side</text>
        <text x="240" y="108" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Price (TMN)</text>
        <text x="400" y="108" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Amount (ICP)</text>
        <text x="560" y="108" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Fee</text>
        <text x="680" y="108" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Total (TMN)</text>

        <rect x="20" y="125" width="760" height="42" fill="#1e293b"/>
        <text x="40" y="152" fill="#f8fafc" font-family="sans-serif" font-size="13">ICP/TMN</text>
        <text x="140" y="152" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="240" y="152" fill="#f8fafc" font-family="monospace" font-size="14">710,000</text>
        <text x="400" y="152" fill="#f8fafc" font-family="monospace" font-size="14">10.000</text>
        <text x="560" y="152" fill="#fbbf24" font-family="monospace" font-size="14">0.020 ICP</text>
        <text x="680" y="152" fill="#cbd5e1" font-family="monospace" font-size="14">7,100,000</text>

        <rect x="20" y="172" width="760" height="42" fill="#0f172a"/>
        <text x="40" y="199" fill="#f8fafc" font-family="sans-serif" font-size="13">ICP/TMN</text>
        <text x="140" y="199" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="240" y="199" fill="#f8fafc" font-family="monospace" font-size="14">715,000</text>
        <text x="400" y="199" fill="#f8fafc" font-family="monospace" font-size="14">15.000</text>
        <text x="560" y="199" fill="#fbbf24" font-family="monospace" font-size="14">0.030 ICP</text>
        <text x="680" y="199" fill="#cbd5e1" font-family="monospace" font-size="14">10,725,000</text>

        <rect x="20" y="219" width="760" height="42" fill="#1e293b"/>
        <text x="40" y="246" fill="#f8fafc" font-family="sans-serif" font-size="13">ICP/TMN</text>
        <text x="140" y="246" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="240" y="246" fill="#f8fafc" font-family="monospace" font-size="14">708,000</text>
        <text x="400" y="246" fill="#f8fafc" font-family="monospace" font-size="14">20.000</text>
        <text x="560" y="246" fill="#fbbf24" font-family="monospace" font-size="14">0.040 ICP</text>
        <text x="680" y="246" fill="#cbd5e1" font-family="monospace" font-size="14">14,160,000</text>
      </svg>
    `;

    loadSvgAsImage(svgString, 'demo_single_icp.png');
  };

  const handleLoadMultiDemo = () => {
    // Generate realistic multi-asset table containing both ICP and TON
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="820" height="440" viewBox="0 0 820 440">
        <rect width="820" height="440" fill="#0f172a"/>
        <rect x="20" y="20" width="780" height="52" rx="8" fill="#1e293b"/>
        <text x="40" y="52" fill="#38bdf8" font-family="sans-serif" font-size="18" font-weight="bold">WALLEX - Trade History (Multi-Currency: ICP &amp; TON)</text>
        
        <rect x="20" y="85" width="780" height="38" fill="#334155"/>
        <text x="40" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Asset / Pair</text>
        <text x="160" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Side</text>
        <text x="260" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Price (TMN)</text>
        <text x="410" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Volume</text>
        <text x="550" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Fee</text>
        <text x="690" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Total (TMN)</text>

        <!-- ICP Row 1 -->
        <rect x="20" y="128" width="780" height="44" fill="#1e293b"/>
        <text x="40" y="156" fill="#60a5fa" font-family="sans-serif" font-size="13" font-weight="bold">ICP/TMN</text>
        <text x="160" y="156" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="260" y="156" fill="#f8fafc" font-family="monospace" font-size="14">710,000</text>
        <text x="410" y="156" fill="#f8fafc" font-family="monospace" font-size="14">10.000 ICP</text>
        <text x="550" y="156" fill="#fbbf24" font-family="monospace" font-size="14">0.020 ICP</text>
        <text x="690" y="156" fill="#cbd5e1" font-family="monospace" font-size="14">7,100,000</text>

        <!-- ICP Row 2 -->
        <rect x="20" y="176" width="780" height="44" fill="#0f172a"/>
        <text x="40" y="204" fill="#60a5fa" font-family="sans-serif" font-size="13" font-weight="bold">ICP/TMN</text>
        <text x="160" y="204" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="260" y="204" fill="#f8fafc" font-family="monospace" font-size="14">715,000</text>
        <text x="410" y="204" fill="#f8fafc" font-family="monospace" font-size="14">15.000 ICP</text>
        <text x="550" y="204" fill="#fbbf24" font-family="monospace" font-size="14">0.030 ICP</text>
        <text x="690" y="204" fill="#cbd5e1" font-family="monospace" font-size="14">10,725,000</text>

        <!-- TON Row 1 -->
        <rect x="20" y="224" width="780" height="44" fill="#1e293b"/>
        <text x="40" y="252" fill="#06b6d4" font-family="sans-serif" font-size="13" font-weight="bold">TON/TMN</text>
        <text x="160" y="252" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="260" y="252" fill="#f8fafc" font-family="monospace" font-size="14">82,000</text>
        <text x="410" y="252" fill="#f8fafc" font-family="monospace" font-size="14">50.000 TON</text>
        <text x="550" y="252" fill="#fbbf24" font-family="monospace" font-size="14">0.100 TON</text>
        <text x="690" y="252" fill="#cbd5e1" font-family="monospace" font-size="14">4,100,000</text>

        <!-- TON Row 2 -->
        <rect x="20" y="272" width="780" height="44" fill="#0f172a"/>
        <text x="40" y="300" fill="#06b6d4" font-family="sans-serif" font-size="13" font-weight="bold">TON/TMN</text>
        <text x="160" y="300" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="260" y="300" fill="#f8fafc" font-family="monospace" font-size="14">84,000</text>
        <text x="410" y="300" fill="#f8fafc" font-family="monospace" font-size="14">80.000 TON</text>
        <text x="550" y="300" fill="#fbbf24" font-family="monospace" font-size="14">0.160 TON</text>
        <text x="690" y="300" fill="#cbd5e1" font-family="monospace" font-size="14">6,720,000</text>

        <!-- Footer status -->
        <text x="40" y="380" fill="#64748b" font-family="sans-serif" font-size="12">Verified Multi-Asset Exchange Table (Wallex / Nobitex format)</text>
      </svg>
    `;

    loadSvgAsImage(svgString, 'demo_multi_icp_ton.png');
  };

  const loadSvgAsImage = (svgString: string, filename: string) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const file = new File([svgBlob], filename, { type: 'image/png' });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 820;
      canvas.height = 440;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        setImagePreview(dataUrl);
        setImageFile(file);
        triggerAiExtraction(dataUrl, 'image/png');
      }
    };
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExtractionResult(null);
    setExtractedRows([]);
    setExtractionError(null);
    setActiveAssetTab('ALL');
    setLivePrices({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Row update handlers
  const handleUpdateRow = (id: string, field: keyof ExtractedRow, value: any) => {
    setExtractedRows(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleDeleteRow = (id: string) => {
    setExtractedRows(prev => prev.filter(r => r.id !== id));
  };

  const handleAddRow = () => {
    const defaultSym = activeAssetTab !== 'ALL' ? activeAssetTab : (distinctAssets[0] || assetSymbol || 'ICP');
    const newRow: ExtractedRow = {
      id: `extracted-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      symbol: defaultSym,
      currency: quoteCurrency,
      price: 0,
      quantity: 0,
      fee: 0,
      feeUnit: 'COIN',
      side: 'BUY',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      orderId: `MANUAL-${extractedRows.length + 1}`,
    };
    setExtractedRows(prev => [newRow, ...prev]);
  };

  // List of distinct cryptocurrency symbols in the extracted trades
  const distinctAssets = useMemo(() => {
    const set = new Set<string>();
    extractedRows.forEach(r => {
      const sym = (r.symbol || assetSymbol || '').trim().toUpperCase();
      if (sym) set.add(sym);
    });
    if (set.size === 0 && assetSymbol) set.add(assetSymbol.toUpperCase());
    return Array.from(set);
  }, [extractedRows, assetSymbol]);

  // -------------------------------------------------------------
  // Precise Accounting & Cost Basis Math per Individual Asset
  // Separates BUY and SELL fees:
  // - BUY fee is deducted from the purchased cryptocurrency (COIN)
  // - SELL fee is deducted from quote currency (CURRENCY)
  // -------------------------------------------------------------
  const perAssetCalculations = useMemo<Record<string, AssetCalculation>>(() => {
    const map: Record<string, AssetCalculation> = {};

    distinctAssets.forEach(sym => {
      const symRows = extractedRows.filter(r => (r.symbol || assetSymbol).toUpperCase() === sym);
      const curr = symRows[0]?.currency || quoteCurrency;

      let totalGrossSpend = 0;
      let totalPurchasedCoins = 0;
      let totalFeeCoins = 0;
      let totalFeeCurrency = 0;

      // BUY specific counters
      let buyCount = 0;
      let totalBuyGross = 0;
      let totalBuyQty = 0;
      let buyFeeCoins = 0;
      let buyFeeCurrency = 0;

      // SELL specific counters
      let sellCount = 0;
      let totalSellGross = 0;
      let totalSellQty = 0;
      let sellFeeCoins = 0;
      let sellFeeCurrency = 0;

      symRows.forEach(row => {
        const p = row.price;
        const q = row.quantity;
        const f = row.fee;
        const grossValue = row.total && row.total > 0 ? row.total : p * q;
        const isBuy = row.side === 'BUY';

        // Fee value in quote currency and coin terms
        let fCurrency = 0;
        let fCoins = 0;
        if (row.feeUnit === 'COIN') {
          fCoins = f;
          fCurrency = f * p;
        } else {
          fCurrency = f;
          fCoins = p > 0 ? f / p : 0;
        }

        totalFeeCurrency += fCurrency;
        totalFeeCoins += fCoins;

        if (isBuy) {
          buyCount += 1;
          totalBuyGross += grossValue;
          totalBuyQty += q;
          buyFeeCoins += fCoins;
          buyFeeCurrency += fCurrency;
          totalGrossSpend += grossValue;
          totalPurchasedCoins += q;
        } else {
          sellCount += 1;
          totalSellGross += grossValue;
          totalSellQty += q;
          sellFeeCoins += fCoins;
          sellFeeCurrency += fCurrency;
        }
      });

      // Buy side fee % and Sell side fee %
      const buyFeePercent = totalBuyGross > 0 ? (buyFeeCurrency / totalBuyGross) * 100 : 0;
      const sellFeePercent = totalSellGross > 0 ? (sellFeeCurrency / totalSellGross) * 100 : 0;

      // Net coins received from BUYs after subtracting coin fee
      const netBuyCoins = Math.max(0, totalBuyQty - buyFeeCoins);

      // Net proceeds from SELLs after subtracting quote currency fee
      const netSellRevenue = Math.max(0, totalSellGross - sellFeeCurrency);

      // Net remaining coin holding in wallet/account
      // If user had both buy and sell: remaining = netBuyCoins - totalSellQty
      const netHoldingQty = Math.max(0, netBuyCoins - totalSellQty);

      // Average buy price and cost basis per unit:
      // If fee deducted from coin: costBasisPerUnit = totalBuyGross / netBuyCoins
      // If fee added to currency: costBasisPerUnit = (totalBuyGross + buyFeeCurrency) / totalBuyQty
      let costBasisPerUnit = 0;
      let totalCostWithFees = totalBuyGross;

      if (feeDeductionMode === 'DEDUCT_FROM_COIN') {
        totalCostWithFees = totalBuyGross;
        costBasisPerUnit = netBuyCoins > 0 ? totalBuyGross / netBuyCoins : (totalBuyQty > 0 ? totalBuyGross / totalBuyQty : 0);
      } else {
        totalCostWithFees = totalBuyGross + buyFeeCurrency;
        costBasisPerUnit = totalBuyQty > 0 ? totalCostWithFees / totalBuyQty : 0;
      }

      const rawAvgPrice = totalBuyQty > 0 ? totalBuyGross / totalBuyQty : (totalSellQty > 0 ? totalSellGross / totalSellQty : 0);

      // Realized profit/loss on sold portions (if any sell orders exist)
      let realizedPnL = 0;
      if (totalSellQty > 0) {
        const closedCostBasis = costBasisPerUnit > 0 ? totalSellQty * costBasisPerUnit : totalSellQty * rawAvgPrice;
        realizedPnL = netSellRevenue - closedCostBasis;
      }

      // Total overall fee percentage
      const totalVolumeValue = totalBuyGross + totalSellGross;
      const feePercentage = totalVolumeValue > 0 ? (totalFeeCurrency / totalVolumeValue) * 100 : 0;

      // Active holding used for current valuation
      const activeHolding = (sellCount > 0) ? netHoldingQty : (feeDeductionMode === 'DEDUCT_FROM_COIN' ? netBuyCoins : totalBuyQty);

      const livePrice = parseFloat((livePrices[sym] || '').replace(/,/g, '')) || 0;
      const currentMarketValue = livePrice > 0 ? livePrice * activeHolding : 0;
      const diffPerUnit = livePrice > 0 && costBasisPerUnit > 0 ? livePrice - costBasisPerUnit : 0;
      const pnlPercent = costBasisPerUnit > 0 && livePrice > 0 ? ((livePrice - costBasisPerUnit) / costBasisPerUnit) * 100 : 0;
      
      // Total unrealized P&L on remaining holdings + realized P&L on closed sales
      const unrealizedPnL = livePrice > 0 && costBasisPerUnit > 0 ? (livePrice - costBasisPerUnit) * activeHolding : 0;
      const totalPnL = (sellCount > 0 && livePrice > 0) ? (realizedPnL + unrealizedPnL) : (livePrice > 0 ? diffPerUnit * activeHolding : realizedPnL);

      map[sym] = {
        symbol: sym,
        currency: curr,
        rows: symRows,
        totalGrossSpend,
        totalPurchasedCoins,
        totalFeeCoins,
        totalFeeCurrency,
        feePercentage,
        buyCount,
        sellCount,
        totalBuyGross,
        totalBuyQty,
        buyFeeCoins,
        buyFeeCurrency,
        buyFeePercent,
        netBuyCoins,
        totalSellGross,
        totalSellQty,
        sellFeeCurrency,
        sellFeePercent,
        netSellRevenue,
        netHoldingQty,
        realizedPnL,
        netReceivedCoins: netBuyCoins,
        totalCostWithFees,
        costBasisPerUnit,
        rawAvgPrice,
        livePrice,
        activeHolding,
        currentMarketValue,
        diffPerUnit,
        pnlPercent,
        totalPnL,
        isProfit: totalPnL > 0.0001,
        isLoss: totalPnL < -0.0001,
      };
    });

    return map;
  }, [extractedRows, distinctAssets, assetSymbol, quoteCurrency, feeDeductionMode, livePrices]);

  // Overall Aggregate Portfolio Calculations across all extracted assets
  const overallCalculations = useMemo(() => {
    let totalGrossSpend = 0;
    let totalSellRevenue = 0;
    let totalFeeCurrency = 0;
    let totalPnL = 0;
    let hasLivePrices = false;

    distinctAssets.forEach(sym => {
      const calc = perAssetCalculations[sym];
      if (calc) {
        totalGrossSpend += calc.totalBuyGross;
        totalSellRevenue += calc.netSellRevenue;
        totalFeeCurrency += calc.totalFeeCurrency;
        if (calc.livePrice > 0 || calc.sellCount > 0) {
          totalPnL += calc.totalPnL;
          if (calc.livePrice > 0) hasLivePrices = true;
        }
      }
    });

    const totalVolume = totalGrossSpend + totalSellRevenue;
    const feePercentage = totalVolume > 0 ? (totalFeeCurrency / totalVolume) * 100 : 0;

    return {
      totalGrossSpend,
      totalSellRevenue,
      totalFeeCurrency,
      feePercentage,
      totalPnL,
      hasLivePrices,
      distinctCount: distinctAssets.length,
      totalRows: extractedRows.length,
    };
  }, [perAssetCalculations, distinctAssets, extractedRows]);

  // Apply to Main Portfolio & Charts
  const handleApplyToApp = () => {
    if (extractedRows.length === 0) return;

    const trades: TradeRecord[] = extractedRows.map((r, i) => {
      const sym = (r.symbol || assetSymbol).trim().toUpperCase();
      const curr = r.currency || quoteCurrency;
      const pair = `${sym}/${curr}`;

      return {
        id: `ai-extracted-${Date.now()}-${i}`,
        date: r.date || new Date(Date.now() - (extractedRows.length - i) * 3600000).toISOString().replace('T', ' ').substring(0, 19),
        symbol: pair,
        currency: curr,
        side: r.side,
        price: r.price,
        quantity: r.quantity,
        fee: r.feeUnit === 'COIN' ? r.fee * r.price : r.fee,
        total: r.total && r.total > 0 ? r.total : r.price * r.quantity,
        orderId: r.orderId || `ORDER-${i + 1}`,
      };
    });

    const symbolsSummary = distinctAssets.join('_');
    onApplyManualData(trades, symbolsSummary, quoteCurrency);

    if (onUpdatePrice) {
      distinctAssets.forEach(sym => {
        const p = parseFloat((livePrices[sym] || '').replace(/,/g, ''));
        if (p > 0) {
          onUpdatePrice(`${sym}/${quoteCurrency}`, p);
          onUpdatePrice(`${sym}/TMN`, p);
          onUpdatePrice(`${sym}/USDT`, p);
        }
      });
    }
  };

  // Filtered rows for the table view
  const displayRows = useMemo(() => {
    if (activeAssetTab === 'ALL') {
      return extractedRows;
    }
    return extractedRows.filter(r => (r.symbol || assetSymbol).toUpperCase() === activeAssetTab);
  }, [extractedRows, activeAssetTab, assetSymbol]);

  return (
    <div 
      ref={containerRef}
      id="image-trade-extractor-card"
      className="rounded-2xl border border-indigo-500/30 dark:border-indigo-500/20 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all"
    >
      {/* Header Banner */}
      <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                  {isFa ? 'استخراج هوشمند معاملات از اسکرین‌شات (چند ارزی و تفکیک‌شده)' : 'AI Trade Screenshot & Multi-Currency Extractor'}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gemini Vision</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <Layers className="w-3 h-3" />
                  <span>{isFa ? 'تفکیک خودکار ارزها' : 'Multi-Asset'}</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {isFa 
                  ? 'اسکرین‌شات جدول معاملات صرافی را آپلود کنید یا Ctrl+V بزنید؛ هوش مصنوعی ردیف‌های تمام ارزها (مثلاً همزمان ICP و TON) را به صورت کاملاً مجزا تفکیک و بهای تمام شده هر ارز را جداگانه محاسبه می‌کند.'
                  : 'Upload or paste (Ctrl+V) trade history. Automatically detects, separates, and calculates each cryptocurrency asset independently.'}
              </p>
            </div>
          </div>

          {/* Quick Demo Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            <button
              type="button"
              onClick={handleLoadMultiDemo}
              disabled={isExtracting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              title={isFa ? 'تست تفکیک دو ارز ICP و TON در یک اسکرین‌شات' : 'Test multi-asset separation'}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isFa ? 'تست دو ارزی (ICP + TON تفکیک‌شده)' : 'Test Multi-Asset (ICP + TON)'}</span>
            </button>
            <button
              type="button"
              onClick={handleLoadSingleDemo}
              disabled={isExtracting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <span>{isFa ? 'تست تک ارزی (ICP)' : 'Test Single (ICP)'}</span>
            </button>
            {imagePreview && (
              <button
                type="button"
                onClick={handleClearImage}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFa ? 'حذف' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Section */}
      <div className="p-4 sm:p-6 space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp, image/bmp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleSelectImage(e.target.files[0]);
            }
          }}
        />

        {/* 1. Upload & Drag-and-Drop Area (or Active Image Preview) */}
        {!imagePreview ? (
          <div
            id="image-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.008]'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500/70 bg-slate-50/50 dark:bg-slate-900/50'
            }`}
          >
            <div className="flex flex-col items-center justify-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                {isFa ? 'بارگذاری اسکرین‌شات یا پیست مستقیم (Ctrl+V)' : 'Upload or Paste Screenshot (Ctrl+V)'}
              </h4>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                {isFa 
                  ? 'تصویر جدول معاملات صرافی را اینجا بیندازید یا کلیک کنید. در صورت وجود چند ارز، سیستم به صورت کاملاً خودکار هر ارز را تفکیک و جداگانه محاسبه می‌نماید.'
                  : 'Drop your order history screenshot here or click to browse. Multiple assets will be automatically separated.'}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  <FileImage className="w-4 h-4" />
                  <span>{isFa ? 'انتخاب عکس اسکرین‌شات' : 'Select Screenshot'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadMultiDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isFa ? 'تست نمونه دو ارزی (ICP + TON)' : 'Load Multi-Coin Demo'}</span>
                </button>
              </div>

              <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isFa ? 'پشتیبانی از صرافی‌های والکس، نوبیتکس، تبدیل، بایننس و جدول‌های چند ارزی' : 'Supports Wallex, Nobitex, Binance, multi-asset tables.'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Active Image Loaded Bar with Re-scan button */
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 w-full md:w-auto">
              <div className="relative w-20 h-14 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0 bg-slate-900 group">
                <img 
                  src={imagePreview} 
                  alt="Trade Screenshot" 
                  className="w-full h-full object-cover" 
                />
                <a
                  href={imagePreview}
                  target="_blank"
                  rel="noreferrer"
                  title={isFa ? 'مشاهده در ابعاد کامل' : 'View full size'}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                >
                  <Eye className="w-4 h-4" />
                </a>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                    {imageFile?.name || (isFa ? 'اسکرین‌شات معاملات' : 'Trade Screenshot')}
                  </span>
                  {extractionResult?.exchangeName && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                      {extractionResult.exchangeName}
                    </span>
                  )}
                  {distinctAssets.length > 1 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {isFa ? `${distinctAssets.length} ارز تفکیک‌شده` : `${distinctAssets.length} Assets Separated`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isExtracting 
                    ? (isFa ? 'در حال تحلیل با هوش مصنوعی و تفکیک ارزها...' : 'Analyzing with Gemini Vision...')
                    : (isFa ? `${extractedRows.length} معامله استخراج شد (${distinctAssets.join('، ')})` : `${extractedRows.length} trades extracted (${distinctAssets.join(', ')})`)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <button
                type="button"
                onClick={() => {
                  if (imagePreview) triggerAiExtraction(imagePreview, imageFile?.type || 'image/png');
                }}
                disabled={isExtracting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
                <span>{isExtracting ? (isFa ? 'در حال استخراج...' : 'Extracting...') : (isFa ? 'استخراج مجدد' : 'Re-extract')}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isFa ? 'تعویض عکس' : 'Change Image'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner during Extraction */}
        {isExtracting && (
          <div className="p-8 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 animate-spin" />
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {isFa ? 'هوش مصنوعی در حال خواندن جدول معاملات و تفکیک نمادها...' : 'Gemini AI Vision reading trade table & separating assets...'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {isFa 
                ? 'تفکیک هر ردیف معامله بر اساس نام ارز، قیمت خرید، حجم و کارمزد دقیق به صورت مجزا در حال انجام است.'
                : 'Extracting and separating trade rows per cryptocurrency symbol.'}
            </p>
          </div>
        )}

        {/* Error Notification with Interactive Retry Button */}
        {extractionError && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 text-rose-800 dark:text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="leading-relaxed font-medium">
                <span>{extractionError}</span>
              </div>
            </div>

            {imagePreview && (
              <button
                type="button"
                onClick={async () => {
                  const optimized = await optimizeImageForOCR(imagePreview, imageFile?.type || 'image/png');
                  triggerAiExtraction(optimized.dataUrl, optimized.mimeType);
                }}
                disabled={isExtracting}
                className="self-end sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
                <span>{isExtracting ? (isFa ? 'در حال تلاش مجدد...' : 'Retrying...') : (isFa ? 'تلاش مجدد فوری' : 'Retry Now')}</span>
              </button>
            )}
          </div>
        )}

        {/* 2. Multi-Currency Separation Banner & Asset Tab Switcher */}
        {extractedRows.length > 0 && (
          <div className="space-y-3">
            {distinctAssets.length > 1 && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="font-extrabold text-emerald-800 dark:text-emerald-200">
                    {isFa 
                      ? `شناسایی موفق ${distinctAssets.length} ارز مختلف در اسکرین‌شات (${distinctAssets.join(' و ')}):` 
                      : `Successfully separated ${distinctAssets.length} assets (${distinctAssets.join(', ')}):`}
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {isFa 
                      ? 'محاسبات بهای تمام شده، میانگین خرید و کارمزد برای هر ارز به طور کاملاً مستقل و تفکیک‌شده انجام شده است تا ارقام خرید با یکدیگر قاطی نشوند.'
                      : 'Calculations for each asset are isolated so prices and volumes are not mixed together.'}
                  </p>
                </div>
              </div>
            )}

            {/* Asset Switcher Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 me-1">
                  {isFa ? 'نمایش محاسبات:' : 'View Calculations:'}
                </span>

                <button
                  type="button"
                  onClick={() => setActiveAssetTab('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeAssetTab === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isFa ? 'همه ارزها (تفکیک‌شده)' : 'All Assets (Separated)'}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 text-current">
                    {extractedRows.length}
                  </span>
                </button>

                {distinctAssets.map((sym) => {
                  const assetData = perAssetCalculations[sym];
                  const count = assetData ? assetData.rows.length : 0;
                  const isActive = activeAssetTab === sym;

                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setActiveAssetTab(sym)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <CurrencyLogo currency={sym} lang={lang} size="xs" />
                      <span>{sym}</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 text-current font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Fee Mode Setting */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">
                  {isFa ? 'روش کارمزد:' : 'Fee Mode:'}
                </span>
                <select
                  value={feeDeductionMode}
                  onChange={(e) => setFeeDeductionMode(e.target.value as any)}
                  className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 text-xs"
                >
                  <option value="DEDUCT_FROM_COIN">{isFa ? 'کسر از کوین دریافتی' : 'Deduct from coin'}</option>
                  <option value="ADD_TO_TOTAL_COST">{isFa ? 'افزودن به هزینه ریالی' : 'Add to total cost'}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 3. CALCULATIONS DISPLAY */}
        {extractedRows.length > 0 && (
          <div className="space-y-6">
            {/* VIEW A: "ALL ASSETS" - SEPARATED CARDS GRID FOR EACH CRYPTO */}
            {activeAssetTab === 'ALL' ? (
              <div className="space-y-4">
                {/* Overall Portfolio Snapshot Header */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                        {isFa ? `خلاصه کلی پورتفوی استخراج‌شده (${distinctAssets.length} ارز مجزا):` : `Extracted Portfolio Summary (${distinctAssets.length} Assets):`}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isFa ? 'هر ارز به طور مستقل در کادر مجزای خود زیر نمایش داده شده است.' : 'Each asset is independently calculated below.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 font-sans block">{isFa ? 'کل خرید ناخالص:' : 'Gross Buy:'}</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(overallCalculations.totalGrossSpend, lang, quoteCurrency)}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-500 font-sans block">{isFa ? 'مجموع کارمزدها:' : 'Total Fees:'}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono">
                          {overallCalculations.feePercentage.toFixed(2)}%
                        </span>
                      </div>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(overallCalculations.totalFeeCurrency, lang, quoteCurrency)}
                      </span>
                    </div>

                    {overallCalculations.hasLivePrices && (
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 font-sans block">{isFa ? 'سود/زیان کل سبد:' : 'Total P&L:'}</span>
                        <span className={`font-bold ${overallCalculations.totalPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {overallCalculations.totalPnL > 0 ? '+' : ''}{formatCurrency(overallCalculations.totalPnL, lang, quoteCurrency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* INDIVIDUAL ASSET CARDS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {distinctAssets.map((sym) => {
                    const calc = perAssetCalculations[sym];
                    if (!calc) return null;

                    return (
                      <div 
                        key={sym} 
                        className="rounded-2xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 p-4 sm:p-5 shadow-xs space-y-4 hover:border-indigo-400/50 transition"
                      >
                        {/* Asset Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2.5">
                            <CurrencyLogo currency={sym} lang={lang} size="md" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-black text-slate-900 dark:text-slate-100 uppercase">
                                  {sym}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-sans">
                                  {isFa ? `${calc.rows.length} معامله` : `${calc.rows.length} trades`}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {isFa ? `ارز قیمت‌گذاری: ${calc.currency === 'TMN' ? 'تومان' : 'دلار ($)'}` : `Quote: ${calc.currency}`}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveAssetTab(sym)}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isFa ? 'تمرکز روی این ارز' : 'Focus'}</span>
                            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                          </button>
                        </div>

                        {/* BUY vs SELL Breakdown and Fees Grid */}
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          {/* 1. BUY Side Card */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                {isFa ? 'خریدها (حجم و کارمزد):' : 'BUYs & Fee:'}
                              </span>
                              {calc.buyCount > 0 && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                  {isFa ? `${calc.buyCount} خرید` : `${calc.buyCount} buys`}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-black font-mono text-slate-900 dark:text-slate-100">
                              {formatCurrency(calc.totalBuyGross, lang, calc.currency)}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {formatNumber(calc.totalBuyQty, lang)} {sym}
                            </div>
                            {calc.buyCount > 0 && (
                              <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                                <span>{isFa ? 'کارمزد خرید (از کوین):' : 'Buy Fee (Coin):'}</span>
                                <span className="font-bold">
                                  {formatNumber(calc.buyFeeCoins, lang)} {sym} ({calc.buyFeePercent.toFixed(2)}%)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 2. SELL Side Card */}
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">
                                {isFa ? 'فروش‌ها (ارزش و کارمزد):' : 'SELLs & Fee:'}
                              </span>
                              {calc.sellCount > 0 ? (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300">
                                  {isFa ? `${calc.sellCount} فروش` : `${calc.sellCount} sells`}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-sans">
                                  {isFa ? 'بدون فروش' : 'None'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-black font-mono text-slate-900 dark:text-slate-100">
                              {calc.totalSellGross > 0 ? formatCurrency(calc.totalSellGross, lang, calc.currency) : (isFa ? '۰' : '0')}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {formatNumber(calc.totalSellQty, lang)} {sym}
                            </div>
                            {calc.sellCount > 0 ? (
                              <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                                <span>{isFa ? 'کارمزد فروش (از پایه):' : 'Sell Fee (Quote):'}</span>
                                <span className="font-bold">
                                  {formatCurrency(calc.sellFeeCurrency, lang, calc.currency)} ({calc.sellFeePercent.toFixed(2)}%)
                                </span>
                              </div>
                            ) : (
                              <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[9px] text-slate-400">
                                {isFa ? 'هنوز فروشی ثبت نشده' : 'No sales registered'}
                              </div>
                            )}
                          </div>

                          {/* 3. Cost Basis / Unit */}
                          <div className="p-3 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/20 border border-indigo-500/20">
                            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 block">
                              {isFa ? 'بهای تمام شده هر واحد خرید:' : 'Cost Basis / Unit:'}
                            </span>
                            <div className="text-sm font-black font-mono text-indigo-800 dark:text-indigo-200 mt-1">
                              {formatCurrency(calc.costBasisPerUnit, lang, calc.currency)}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {isFa ? 'میانگین خام:' : 'Raw:'} {formatCurrency(calc.rawAvgPrice, lang, calc.currency)}
                            </div>
                          </div>

                          {/* 4. Net Remaining Coins */}
                          <div className="p-3 rounded-xl bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/20">
                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">
                              {calc.sellCount > 0 
                                ? (isFa ? 'مانده موجودی ولت (خالص):' : 'Remaining Holding:')
                                : (isFa ? 'موجودی خالص دریافتی:' : 'Net Received Coins:')
                              }
                            </span>
                            <div className="text-sm font-black font-mono text-blue-800 dark:text-blue-200 mt-1">
                              {formatNumber(calc.activeHolding, lang)} {sym}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {calc.sellCount > 0 
                                ? (isFa ? `فروش: ${formatNumber(calc.totalSellQty, lang)} ${sym}` : `Sold: ${formatNumber(calc.totalSellQty, lang)}`)
                                : (isFa ? 'پس از کسر کارمزد خرید' : 'After buy fee')}
                            </div>
                          </div>
                        </div>

                        {/* Live Market Price Input & P&L Card for THIS coin */}
                        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <label htmlFor={`live-price-${sym}`} className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{isFa ? `قیمت لحظه‌ای بازار (${sym}):` : `Live ${sym} Price:`}</span>
                            </label>

                            {calc.livePrice > 0 && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                calc.isProfit 
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                                  : calc.isLoss 
                                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' 
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {calc.isProfit ? (isFa ? 'سودده' : 'Profit') : calc.isLoss ? (isFa ? 'زیان‌ده' : 'Loss') : (isFa ? 'سر‌به‌سر' : 'Even')}
                                {' '}({calc.pnlPercent > 0 ? '+' : ''}{calc.pnlPercent.toFixed(1)}%)
                              </span>
                            )}
                          </div>

                          <div className="relative">
                            <input
                              id={`live-price-${sym}`}
                              type="text"
                              inputMode="decimal"
                              value={livePrices[sym] || ''}
                              onChange={(e) => setLivePrices(prev => ({ ...prev, [sym]: e.target.value }))}
                              placeholder={calc.currency === 'TMN' ? 'قیمت فعلی بازار به تومان...' : 'Current price in USD...'}
                              className="w-full font-mono text-sm font-bold py-1.5 px-3 pe-16 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                            />
                            <div className="absolute top-1/2 -translate-y-1/2 end-2.5 flex items-center gap-1 pointer-events-none text-xs font-bold text-slate-400">
                              <CurrencyLogo currency={calc.currency} lang={lang} size="xs" />
                            </div>
                          </div>

                          {calc.livePrice > 0 && (
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-500/20 font-mono">
                              <span className="text-slate-600 dark:text-slate-400 text-[11px] font-sans">
                                {isFa ? 'سود / زیان تخمینی:' : 'Est. P&L:'}
                              </span>
                              <span className={`font-black ${calc.isProfit ? 'text-emerald-600 dark:text-emerald-400' : calc.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600'}`}>
                                {calc.totalPnL > 0 ? '+' : ''}{formatCurrency(calc.totalPnL, lang, calc.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* VIEW B: SINGLE ASSET VIEW (Focused on the active asset tab) */
              (() => {
                const calc = perAssetCalculations[activeAssetTab] || perAssetCalculations[distinctAssets[0]];
                if (!calc) return null;

                return (
                  <div className="space-y-4">
                    {/* Live Price Box for Instant P&L */}
                    <div className="p-4 rounded-xl border-2 border-emerald-500/40 dark:border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <CurrencyLogo currency={calc.symbol} lang={lang} size="md" />
                        <div>
                          <label htmlFor={`ai-focused-live-price-${calc.symbol}`} className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                            {isFa ? `قیمت لحظه‌ای بازار (${calc.symbol}):` : `Current ${calc.symbol} Price:`}
                          </label>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {isFa ? 'قیمت فعلی بازار را وارد کنید تا سود/زیان دقیق در مقایسه با بهای تمام شده نهایی محاسبه شود' : 'Enter live market price to see instant profit/loss'}
                          </p>
                        </div>
                      </div>

                      <div className="relative min-w-[240px]">
                        <input
                          id={`ai-focused-live-price-${calc.symbol}`}
                          type="text"
                          inputMode="decimal"
                          value={livePrices[calc.symbol] || ''}
                          onChange={(e) => setLivePrices(prev => ({ ...prev, [calc.symbol]: e.target.value }))}
                          placeholder={calc.currency === 'TMN' ? 'مثلاً 745000' : 'مثلاً 105.5'}
                          className="w-full font-mono text-lg font-black py-2 px-3 pe-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 transition"
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 end-3 flex items-center gap-1 pointer-events-none text-xs font-bold text-slate-500 dark:text-slate-400">
                          <CurrencyLogo currency={calc.currency} lang={lang} size="xs" />
                        </div>
                      </div>
                    </div>

                    {/* Calculations Overview 4-Box Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Box 1: BUYs & Volume & Buy Fee */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            {isFa ? 'معاملات خرید (حجم و کارمزد):' : 'BUY Volume & Fee:'}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            {calc.buyCount} {isFa ? 'خرید' : 'buys'}
                          </span>
                        </div>
                        <div className="text-lg font-black font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(calc.totalBuyGross, lang, calc.currency)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {formatNumber(calc.totalBuyQty, lang)} {calc.symbol} {isFa ? 'خریداری شده' : 'bought'}
                        </div>
                        {calc.buyCount > 0 && (
                          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                            <span>{isFa ? 'کارمزد خرید (از کوین):' : 'Buy Fee (Coin):'}</span>
                            <span className="font-bold">
                              {formatNumber(calc.buyFeeCoins, lang)} {calc.symbol} ({calc.buyFeePercent.toFixed(2)}%)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Box 2: SELLs & Revenue & Sell Fee */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-750 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">
                            {isFa ? 'معاملات فروش (ارزش و کارمزد):' : 'SELL Volume & Fee:'}
                          </span>
                          {calc.sellCount > 0 ? (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300">
                              {calc.sellCount} {isFa ? 'فروش' : 'sells'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-sans">
                              {isFa ? 'بدون فروش' : 'None'}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-black font-mono text-slate-900 dark:text-slate-100">
                          {calc.totalSellGross > 0 ? formatCurrency(calc.totalSellGross, lang, calc.currency) : (isFa ? '۰' : '0')}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {formatNumber(calc.totalSellQty, lang)} {calc.symbol} {isFa ? 'فروخته شده' : 'sold'}
                        </div>
                        {calc.sellCount > 0 ? (
                          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                            <span>{isFa ? 'کارمزد فروش (از پایه):' : 'Sell Fee (Quote):'}</span>
                            <span className="font-bold">
                              {formatCurrency(calc.sellFeeCurrency, lang, calc.currency)} ({calc.sellFeePercent.toFixed(2)}%)
                            </span>
                          </div>
                        ) : (
                          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400">
                            {isFa ? 'کل کارمزد پورتفو: ' + formatCurrency(calc.totalFeeCurrency, lang, calc.currency) : 'Total fees: ' + formatCurrency(calc.totalFeeCurrency, lang, calc.currency)}
                          </div>
                        )}
                      </div>

                      {/* Box 3: Cost Basis per Unit */}
                      <div className="p-3.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/20 border border-indigo-500/20">
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          {isFa ? 'بهای تمام شده هر واحد خرید:' : 'Cost Basis / Unit:'}
                        </span>
                        <div className="text-lg font-black font-mono text-indigo-800 dark:text-indigo-200 mt-1">
                          {formatCurrency(calc.costBasisPerUnit, lang, calc.currency)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {isFa ? 'میانگین خام:' : 'Raw Avg:'} {formatCurrency(calc.rawAvgPrice, lang, calc.currency)}
                        </div>
                      </div>

                      {/* Box 4: Net Holdings */}
                      <div className="p-3.5 rounded-xl bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/20">
                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                          {calc.sellCount > 0 
                            ? (isFa ? 'مانده موجودی ولت (خالص):' : 'Remaining Holding:')
                            : (isFa ? 'کوین خالص دریافتی (پس از کارمزد):' : 'Net Received Coins:')
                          }
                        </span>
                        <div className="text-lg font-black font-mono text-blue-800 dark:text-blue-200 mt-1">
                          {formatNumber(calc.activeHolding, lang)} {calc.symbol}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {calc.sellCount > 0 
                            ? (isFa ? `دریافت خرید: ${formatNumber(calc.netBuyCoins, lang)} | فروش: ${formatNumber(calc.totalSellQty, lang)}` : `Bought: ${formatNumber(calc.netBuyCoins, lang)} | Sold: ${formatNumber(calc.totalSellQty, lang)}`)
                            : (isFa ? `هزینه کل: ${formatCurrency(calc.totalCostWithFees, lang, calc.currency)}` : 'Total spend')}
                        </div>
                      </div>
                    </div>

                    {/* Profit & Loss Card if Live Price is Present */}
                    {calc.livePrice > 0 && (
                      <div 
                        className={`p-4 rounded-xl border transition-all ${
                          calc.isProfit
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30'
                            : calc.isLoss
                            ? 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                {isFa ? `وضعیت پوزیشن ${calc.symbol}:` : `${calc.symbol} Position P&L:`}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                                calc.isProfit
                                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                  : calc.isLoss
                                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {calc.isProfit ? (isFa ? 'در سود' : 'In Profit') : calc.isLoss ? (isFa ? 'در زیان' : 'In Loss') : (isFa ? 'سر‌به‌سر' : 'Breakeven')}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-baseline gap-3 mt-1.5">
                              <span className={`text-2xl font-black font-mono ${
                                calc.isProfit ? 'text-emerald-600 dark:text-emerald-400' : calc.isLoss ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700'
                              }`}>
                                {calc.totalPnL > 0 ? '+' : ''}{formatCurrency(calc.totalPnL, lang, calc.currency)}
                              </span>
                              <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded-md ${
                                calc.isProfit ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : calc.isLoss ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'text-slate-700'
                              }`}>
                                {calc.pnlPercent > 0 ? '+' : ''}{calc.pnlPercent.toFixed(2)}%
                              </span>
                            </div>
                          </div>

                          <div className="text-xs font-mono space-y-1 text-slate-600 dark:text-slate-300 border-t md:border-t-0 md:border-s border-slate-300/60 dark:border-slate-700 md:ps-4 pt-2 md:pt-0">
                            <div>
                              {isFa ? 'ارزش فعلی کل دارایی:' : 'Market Value:'} 
                              <span className="font-bold text-slate-900 dark:text-slate-100 ms-1">
                                {formatCurrency(calc.currentMarketValue, lang, calc.currency)}
                              </span>
                            </div>
                            <div>
                              {isFa ? 'فاصله تا قیمت تمام شده:' : 'Diff to Cost Basis:'} 
                              <span className={`font-bold ms-1 ${calc.isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {calc.diffPerUnit > 0 ? '+' : ''}{formatCurrency(calc.diffPerUnit, lang, calc.currency)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* 4. Interactive Extracted Trades Review Table */}
        {extractedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
                  {isFa 
                    ? `جدول تراکنش‌های استخراج شده ${activeAssetTab !== 'ALL' ? `(نماد ${activeAssetTab})` : ''} (${displayRows.length} از ${extractedRows.length} سطر):` 
                    : `Extracted Trades Table (${displayRows.length} of ${extractedRows.length} rows):`}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-750 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-slate-700 transition cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isFa ? 'افزودن سطر جدید' : 'Add Row'}</span>
                </button>

                {activeAssetTab !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setActiveAssetTab('ALL')}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                  >
                    {isFa ? 'نمایش تمام سطرها' : 'Show all rows'}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-80 overflow-y-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700 z-10">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5 text-start w-28">{isFa ? 'ارز / نماد' : 'Asset'}</th>
                    <th className="p-2.5 text-start w-24">{isFa ? 'نوع (خرید/فروش)' : 'Side'}</th>
                    <th className="p-2.5 text-end">{isFa ? 'قیمت واحد' : 'Price'}</th>
                    <th className="p-2.5 text-end">{isFa ? 'حجم معامله' : 'Volume'}</th>
                    <th className="p-2.5 text-end">{isFa ? 'کارمزد و واحد' : 'Fee & Unit'}</th>
                    <th className="p-2.5 text-end">{isFa ? 'ارزش کارمزد' : 'Fee Value'}</th>
                    <th className="p-2.5 text-end">{isFa ? 'مجموع معامله' : 'Total Value'}</th>
                    <th className="p-2.5 text-center w-10">{isFa ? 'حذف' : 'Del'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
                  {displayRows.map((row, idx) => {
                    const rowFeeCurrency = row.feeUnit === 'COIN' ? row.fee * row.price : row.fee;
                    const rowTotalValue = row.total && row.total > 0 ? row.total : row.price * row.quantity;
                    const rowCurrency = row.currency || quoteCurrency;
                    const rowFeePercent = rowTotalValue > 0 ? (rowFeeCurrency / rowTotalValue) * 100 : 0;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-2.5 text-center text-slate-400 font-sans">{idx + 1}</td>

                        {/* Editable Asset Symbol */}
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <CurrencyLogo currency={row.symbol} lang={lang} size="xs" />
                            <input
                              type="text"
                              value={row.symbol}
                              onChange={(e) => handleUpdateRow(row.id, 'symbol', e.target.value.toUpperCase())}
                              className="w-16 px-1.5 py-0.5 text-center font-bold uppercase rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 text-xs"
                              placeholder="SYM"
                            />
                          </div>
                        </td>

                        {/* Toggleable Side (BUY / SELL) */}
                        <td className="p-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              const newSide = row.side === 'BUY' ? 'SELL' : 'BUY';
                              handleUpdateRow(row.id, 'side', newSide);
                              // Auto adapt feeUnit: BUY -> COIN, SELL -> CURRENCY
                              if (newSide === 'BUY' && row.feeUnit !== 'COIN') {
                                handleUpdateRow(row.id, 'feeUnit', 'COIN');
                              } else if (newSide === 'SELL' && row.feeUnit !== 'CURRENCY') {
                                handleUpdateRow(row.id, 'feeUnit', 'CURRENCY');
                              }
                            }}
                            title={isFa ? 'کلیک کنید برای تغییر بین خرید و فروش' : 'Click to toggle BUY / SELL'}
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-black transition cursor-pointer border ${
                              row.side === 'BUY' 
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25' 
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                            }`}
                          >
                            {row.side === 'BUY' ? (isFa ? '🟢 خرید' : '🟢 BUY') : (isFa ? '🔴 فروش' : '🔴 SELL')}
                          </button>
                        </td>

                        {/* Price */}
                        <td className="p-2.5 text-end">
                          <input
                            type="number"
                            value={row.price}
                            onChange={(e) => handleUpdateRow(row.id, 'price', parseFloat(e.target.value) || 0)}
                            className="w-24 px-1.5 py-0.5 text-end font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="p-2.5 text-end">
                          <input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => handleUpdateRow(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-20 px-1.5 py-0.5 text-end font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </td>

                        {/* Fee with toggleable Fee Unit (COIN / CURRENCY) */}
                        <td className="p-2.5 text-end">
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.0001"
                                value={row.fee}
                                onChange={(e) => handleUpdateRow(row.id, 'fee', parseFloat(e.target.value) || 0)}
                                className="w-20 px-1.5 py-0.5 text-end font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateRow(row.id, 'feeUnit', row.feeUnit === 'COIN' ? 'CURRENCY' : 'COIN')}
                                title={isFa ? 'تغییر واحد کارمزد (کوین یا ارز پایه)' : 'Toggle fee unit'}
                                className="text-[10px] font-sans px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer font-bold"
                              >
                                {row.feeUnit === 'COIN' ? row.symbol : rowCurrency}
                              </button>
                            </div>
                            {rowFeePercent > 0 && (
                              <span 
                                className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20"
                                title={isFa ? 'درصد کارمزد معامله' : 'Trade fee %'}
                              >
                                {rowFeePercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Fee Value */}
                        <td className="p-2.5 text-end">
                          <div className="text-amber-600 dark:text-amber-400 font-bold">
                            {formatCurrency(rowFeeCurrency, lang, rowCurrency)}
                          </div>
                          {rowFeePercent > 0 && (
                            <div className="text-[9px] text-slate-400 font-sans mt-0.5">
                              {rowFeePercent.toFixed(2)}% {isFa ? 'کارمزد' : 'fee'}
                            </div>
                          )}
                        </td>

                        {/* Total Value */}
                        <td className="p-2.5 text-end text-slate-900 dark:text-slate-100 font-bold">
                          {formatCurrency(rowTotalValue, lang, rowCurrency)}
                        </td>

                        {/* Delete */}
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-500 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action Bar: Apply to App */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isFa 
                  ? `با کلیک بر روی دکمه زیر، اطلاعات تمام ${distinctAssets.length} ارز به تفکیک در کل سامانه، نمودارهای سهم دارایی و تحلیل پورتفوی اعمال می‌شوند.`
                  : 'Apply all extracted assets and trades to portfolio analysis & charts.'}
              </div>

              <button
                type="button"
                onClick={handleApplyToApp}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs sm:text-sm font-black shadow-md transition cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isFa 
                    ? `ثبت و اعمال ${distinctAssets.length > 1 ? `${distinctAssets.length} ارز تفکیک‌شده` : 'معاملات'} در پورتفوی و نمودارها` 
                    : `Apply ${distinctAssets.length} Assets to Portfolio`}
                </span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
