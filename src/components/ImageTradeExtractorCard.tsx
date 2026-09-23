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
  TrendingDown,
  X,
  Images,
  Plus
} from 'lucide-react';
import { TradeRecord, Language, CurrencyKind } from '../types';
import { formatCurrency, formatPercent, formatNumber } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';
import { fetchWallexMarkets, findWallexMarket, WallexMarket } from '../utils/wallexApi';

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

export interface UploadedImageItem {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  size?: number;
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

export function sanitizeExtractedFee(
  price: number,
  quantity: number,
  fee: number,
  feeUnit?: string,
  side?: string,
  currency?: string,
  symbol?: string,
  total?: number
): { fee: number; feeUnit: 'COIN' | 'CURRENCY' } {
  const p = Number(price) || 0;
  const q = Number(quantity) || 0;
  let rawFee = Number(fee) || 0;
  const totalVal = total && total > 0 ? total : p * q;
  const unit = (feeUnit || '').trim().toUpperCase();

  const isCurrencyUnit =
    unit === 'CURRENCY' ||
    unit === 'TMN' ||
    unit === 'TOMAN' ||
    unit === 'تومان' ||
    unit === 'USD' ||
    unit === 'USDT' ||
    unit === 'IRR' ||
    unit === 'RIAL' ||
    unit === '$' ||
    (currency && unit === currency.toUpperCase());

  const isCoinUnit =
    unit === 'COIN' ||
    (symbol && unit === symbol.toUpperCase()) ||
    unit === 'BASE';

  let cleanFeeUnit: 'COIN' | 'CURRENCY';
  if (isCurrencyUnit) {
    cleanFeeUnit = 'CURRENCY';
  } else if (isCoinUnit) {
    cleanFeeUnit = 'COIN';
  } else {
    cleanFeeUnit = side === 'SELL' ? 'CURRENCY' : 'COIN';
  }

  // Guard rails against mislabeling or multiplication errors:
  // Cryptocurrency exchange fees are strictly between 0.05% and 0.4%
  if (totalVal > 0 && p > 0 && rawFee > 0) {
    if (cleanFeeUnit === 'COIN') {
      const feeInCurrency = rawFee * p;
      if (feeInCurrency > totalVal * 0.1 || (q > 0 && rawFee > q * 0.1)) {
        if (rawFee <= totalVal * 0.05) {
          cleanFeeUnit = 'CURRENCY';
        } else if (q > 0 && (rawFee / p) <= q * 0.05) {
          rawFee = rawFee / p;
        } else {
          rawFee = q * 0.002;
        }
      }
    } else if (cleanFeeUnit === 'CURRENCY') {
      if (rawFee > totalVal * 0.1) {
        if (rawFee * p <= totalVal * 0.05) {
          cleanFeeUnit = 'COIN';
        } else {
          rawFee = totalVal * 0.002;
        }
      }
    }
  }

  return { fee: rawFee, feeUnit: cleanFeeUnit };
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

  // Uploaded Images State (supports single or multiple screenshots simultaneously)
  const [uploadedImages, setUploadedImages] = useState<UploadedImageItem[]>([]);
  const [modalPreviewImage, setModalPreviewImage] = useState<{ url: string; name: string } | null>(null);
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

  // Wallex Live Market Pricing State
  const [wallexMarkets, setWallexMarkets] = useState<WallexMarket[]>([]);
  const [isLoadingWallex, setIsLoadingWallex] = useState<boolean>(false);
  const [wallexError, setWallexError] = useState<string | null>(null);
  const [marketMetadata, setMarketMetadata] = useState<Record<string, {
    price: number;
    change24h?: number;
    highest24h?: string;
    lowest24h?: string;
    marketSymbol: string;
    fetchedAt: number;
  }>>({});
  const [manualOverrideFlags, setManualOverrideFlags] = useState<Record<string, boolean>>({});

  // Fetches live market prices from Wallex API and automatically populates livePrices
  const fetchAndApplyLivePrices = async (
    symbolsToApply?: string[],
    forceRefresh = false,
    fallbackRows?: ExtractedRow[]
  ) => {
    setIsLoadingWallex(true);
    setWallexError(null);
    try {
      const markets = await fetchWallexMarkets(forceRefresh);
      setWallexMarkets(markets);

      const symbols = symbolsToApply && symbolsToApply.length > 0
        ? symbolsToApply
        : (distinctAssets.length > 0 ? distinctAssets : [assetSymbol]);

      const pendingPriceUpdates: { sym: string; livePriceNum: number; pair: string }[] = [];

      setLivePrices(prevPrices => {
        const updatedPrices = { ...prevPrices };
        const updatedMeta = { ...marketMetadata };

        symbols.forEach(rawSym => {
          const sym = (rawSym || '').trim().toUpperCase();
          if (!sym) return;

          const matched = findWallexMarket(markets, sym, quoteCurrency);
          const livePriceNum = matched ? parseFloat(matched.price) : 0;

          if (matched && livePriceNum > 0) {
            updatedMeta[sym] = {
              price: livePriceNum,
              change24h: matched.change_24h,
              highest24h: matched.highest_24h_price,
              lowest24h: matched.lowest_24h_price,
              marketSymbol: matched.symbol,
              fetchedAt: Date.now(),
            };

            // Auto-fill price field if not manually overridden, or if forceRefresh is true
            if (!manualOverrideFlags[sym] || forceRefresh) {
              updatedPrices[sym] = String(livePriceNum);
              pendingPriceUpdates.push({ sym, livePriceNum, pair: `${sym}/${quoteCurrency}` });
            }
          } else if (!updatedPrices[sym]) {
            // Check if passed in customPrices prop has it
            if (customPrices && customPrices[sym] && customPrices[sym] > 0) {
              updatedPrices[sym] = String(customPrices[sym]);
            } else if (fallbackRows && fallbackRows.length > 0) {
              // Fallback to average of rows for this symbol if Wallex market is offline or symbol not listed
              const symRows = fallbackRows.filter(r => (r.symbol || '').toUpperCase() === sym);
              if (symRows.length > 0) {
                const avg = Math.round(symRows.reduce((a, b) => a + b.price, 0) / symRows.length);
                if (avg > 0) updatedPrices[sym] = String(avg);
              }
            }
          }
        });

        setMarketMetadata(updatedMeta);
        return updatedPrices;
      });

      // Notify parent safely outside of the setState callback cycle
      if (onUpdatePrice && pendingPriceUpdates.length > 0) {
        setTimeout(() => {
          pendingPriceUpdates.forEach(({ sym, livePriceNum, pair }) => {
            onUpdatePrice(sym, livePriceNum);
            onUpdatePrice(pair, livePriceNum);
          });
        }, 0);
      }
    } catch (err: any) {
      console.warn('Failed to fetch Wallex live prices:', err);
      setWallexError(err?.message || (isFa ? 'خطا در ارتباط با وب‌سرویس قیمت لحظه‌ای والکس' : 'Failed to connect to Wallex live price API'));

      // If network failed and we have fallbackRows, make sure prices aren't empty
      if (fallbackRows && fallbackRows.length > 0) {
        setLivePrices(prevPrices => {
          const updated = { ...prevPrices };
          const symbols = symbolsToApply || distinctAssets;
          symbols.forEach(sym => {
            if (!updated[sym]) {
              const symRows = fallbackRows.filter(r => (r.symbol || '').toUpperCase() === sym.toUpperCase());
              if (symRows.length > 0) {
                const avg = Math.round(symRows.reduce((a, b) => a + b.price, 0) / symRows.length);
                if (avg > 0) updated[sym] = String(avg);
              }
            }
          });
          return updated;
        });
      }
    } finally {
      setIsLoadingWallex(false);
    }
  };

  // Initial load of Wallex markets
  useEffect(() => {
    fetchAndApplyLivePrices(distinctAssets.length > 0 ? distinctAssets : [assetSymbol]);
  }, []);

  // Re-fetch Wallex live prices when quote currency changes (TMN <-> USDT)
  useEffect(() => {
    if (distinctAssets.length > 0) {
      fetchAndApplyLivePrices(distinctAssets, true);
    }
  }, [quoteCurrency]);

  // Sync with incoming customPrices
  useEffect(() => {
    if (customPrices && Object.keys(customPrices).length > 0) {
      setLivePrices(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(customPrices).forEach(([sym, val]) => {
          const numVal = Number(val);
          if (numVal > 0 && !next[sym]) {
            next[sym] = String(numVal);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [customPrices]);

  // Helper to optimize oversized images for faster multimodal transmission
  const optimizeImageForOCR = (dataUrl: string, mimeType: string): Promise<{ dataUrl: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        
        // If image is already a reasonably sized JPEG under 500KB and within dimensions, keep it
        if (mimeType === 'image/jpeg' && width <= maxDim && height <= maxDim && dataUrl.length < 600 * 1024) {
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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const optimized = canvas.toDataURL('image/jpeg', 0.88);
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
        ? 'سرور هوش مصنوعی گوگل در این لحظه با ترافیک موقت بالا مواجه شد (کد ۵۰۳). با سیستم تلاش مجدد خودکار، لطفاً روی دکمه «تلاش مجدد فوری» کلیک فرمایید.'
        : 'Google AI server is experiencing temporary high demand (503). Automatic retries engaged; please click "Retry Now".';
    }
    if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
      return isFaLang
        ? 'محدودیت تعداد درخواست موقت سرور هوش مصنوعی. لطفاً چند لحظه دیگر روی «تلاش مجدد فوری» کلیک فرمایید.'
        : 'Temporary rate limit. Please click "Retry Now" in a few moments.';
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message) {
        return parseErrorMessage(parsed.error, isFaLang);
      }
    } catch {}
    return raw || (isFaLang ? 'خطا در ارتباط با سرور و استخراج هوشمند.' : 'Extraction error.');
  };

  // Process and append multiple or single selected image files
  const handleSelectImages = async (files: FileList | File[]) => {
    setExtractionError(null);
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setExtractionError(isFa ? 'لطفاً فایل‌های تصویری معتبر (PNG, JPG, WebP) انتخاب فرمایید.' : 'Please select valid image files.');
      return;
    }

    const newItems: UploadedImageItem[] = [];
    for (const file of imageFiles) {
      const rawDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });

      if (rawDataUrl) {
        const optimized = await optimizeImageForOCR(rawDataUrl, file.type);
        newItems.push({
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          name: file.name || `Screenshot_${uploadedImages.length + newItems.length + 1}`,
          dataUrl: optimized.dataUrl,
          mimeType: optimized.mimeType,
          size: file.size,
        });
      }
    }

    if (newItems.length === 0) return;

    setUploadedImages(prev => {
      const combined = [...prev, ...newItems];
      triggerAiExtraction(combined);
      return combined;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clipboard Paste Listener: User can press Ctrl+V anywhere on the page to paste one or multiple screenshots!
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }
      if (pastedFiles.length > 0) {
        handleSelectImages(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [uploadedImages]);

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
      handleSelectImages(e.dataTransfer.files);
    }
  };

  // Remove a single image from the list and re-extract remaining
  const handleRemoveImage = (id: string) => {
    setUploadedImages(prev => {
      const remaining = prev.filter(img => img.id !== id);
      if (remaining.length > 0) {
        triggerAiExtraction(remaining);
      } else {
        handleClearAllImages();
      }
      return remaining;
    });
  };

  // Clear all uploaded images and reset extracted data
  const handleClearAllImages = () => {
    setUploadedImages([]);
    setExtractionResult(null);
    setExtractedRows([]);
    setExtractionError(null);
    setActiveAssetTab('ALL');
    setLivePrices({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Perform AI Extraction using Gemini Vision OCR endpoint supporting multiple screenshots
  const triggerAiExtraction = async (imagesToProcess?: UploadedImageItem[], attempt = 1) => {
    const targetImages = imagesToProcess || uploadedImages;
    if (!targetImages || targetImages.length === 0) return;

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
          images: targetImages.map(img => ({
            imageBase64: img.dataUrl,
            mimeType: img.mimeType,
            name: img.name,
          })),
          userNotes: `Canonical Iranian exchange (Wallex) 10-column layout:
From Right to Left (RTL): [۱. بازار] [۲. فروشنده] [۳. خریدار] [۴. قیمت واحد] [۵. مقدار] [۶. قیمت کل] [۷. کارمزد فروشنده (تومان)] [۸. کارمزد خریدار (کوین)] [۹. تاریخ] [۱۰. نوع معامله].
From Left to Right (LTR): [1. نوع معامله] [2. تاریخ] [3. کارمزد خریدار (کوین)] [4. کارمزد فروشنده (تومان)] [5. قیمت کل] [6. مقدار] [7. قیمت واحد] [8. خریدار] [9. فروشنده] [10. بازار].
CRITICAL RULES:
- Even when headers are cut off or not visible, strictly assume this exact 10-column order.
- Verify: Unit Price * Quantity MUST equal Total Price. Never swap them!
- For buyer (خرید), user fee is from the Buyer Fee column (in crypto coin).
- For seller (فروش), user fee is from the Seller Fee column (in TMN quote currency).
- Deduplicate identical orders across images.`,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        // If transient 503 or 429, auto retry up to 3 times with progressive backoff
        const errText = String(json.error || json.rawError || '');
        if (attempt < 3 && (errText.includes('503') || errText.includes('429') || errText.includes('high demand') || errText.includes('UNAVAILABLE'))) {
          console.warn(`Transient server error encountered (attempt ${attempt}/3). Auto-retrying in ${attempt * 1200}ms...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
          return triggerAiExtraction(targetImages, attempt + 1);
        }
        throw new Error(json.error || 'Failed to extract trade records from images.');
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

      // Automatically query and register live market prices from Wallex API into inputs
      await fetchAndApplyLivePrices(distinctSet, true, rows);
    } catch (err: any) {
      console.error('Extraction Error:', err);
      const friendlyErr = parseErrorMessage(err, isFa);
      setExtractionError(friendlyErr);
    } finally {
      setIsExtracting(false);
    }
  };

  // Convert SVG string to a canvas DataURL (PNG)
  const convertSvgToDataUrl = (svgString: string, width = 820, height = 440): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
    });
  };

  // Demo Generators
  const handleLoadSingleDemo = async () => {
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

    const dataUrl = await convertSvgToDataUrl(svgString, 800, 400);
    if (dataUrl) {
      const item: UploadedImageItem = {
        id: `demo-single-${Date.now()}`,
        name: 'wallex_history_icp.png',
        dataUrl,
        mimeType: 'image/png',
      };
      setUploadedImages([item]);
      triggerAiExtraction([item]);
    }
  };

  const handleLoadMultiDemo = async () => {
    // Generate realistic multi-page demo: Page 1 for ICP and Page 2 for TON
    const svgPage1 = `
      <svg xmlns="http://www.w3.org/2000/svg" width="820" height="380" viewBox="0 0 820 380">
        <rect width="820" height="380" fill="#0f172a"/>
        <rect x="20" y="20" width="780" height="50" rx="8" fill="#1e293b"/>
        <text x="40" y="52" fill="#38bdf8" font-family="sans-serif" font-size="17" font-weight="bold">WALLEX - Order History [Page 1: ICP / TMN]</text>
        
        <rect x="20" y="85" width="780" height="38" fill="#334155"/>
        <text x="40" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Pair</text>
        <text x="160" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Side</text>
        <text x="260" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Price (TMN)</text>
        <text x="410" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Amount</text>
        <text x="550" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Fee</text>
        <text x="690" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Total (TMN)</text>

        <rect x="20" y="128" width="780" height="44" fill="#1e293b"/>
        <text x="40" y="156" fill="#60a5fa" font-family="sans-serif" font-size="13" font-weight="bold">ICP/TMN</text>
        <text x="160" y="156" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="260" y="156" fill="#f8fafc" font-family="monospace" font-size="14">710,000</text>
        <text x="410" y="156" fill="#f8fafc" font-family="monospace" font-size="14">10.000 ICP</text>
        <text x="550" y="156" fill="#fbbf24" font-family="monospace" font-size="14">0.020 ICP</text>
        <text x="690" y="156" fill="#cbd5e1" font-family="monospace" font-size="14">7,100,000</text>

        <rect x="20" y="176" width="780" height="44" fill="#0f172a"/>
        <text x="40" y="204" fill="#60a5fa" font-family="sans-serif" font-size="13" font-weight="bold">ICP/TMN</text>
        <text x="160" y="204" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="260" y="204" fill="#f8fafc" font-family="monospace" font-size="14">715,000</text>
        <text x="410" y="204" fill="#f8fafc" font-family="monospace" font-size="14">15.000 ICP</text>
        <text x="550" y="204" fill="#fbbf24" font-family="monospace" font-size="14">0.030 ICP</text>
        <text x="690" y="204" fill="#cbd5e1" font-family="monospace" font-size="14">10,725,000</text>
      </svg>
    `;

    const svgPage2 = `
      <svg xmlns="http://www.w3.org/2000/svg" width="820" height="380" viewBox="0 0 820 380">
        <rect width="820" height="380" fill="#0f172a"/>
        <rect x="20" y="20" width="780" height="50" rx="8" fill="#1e293b"/>
        <text x="40" y="52" fill="#38bdf8" font-family="sans-serif" font-size="17" font-weight="bold">WALLEX - Order History [Page 2: TON / TMN]</text>
        
        <rect x="20" y="85" width="780" height="38" fill="#334155"/>
        <text x="40" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Pair</text>
        <text x="160" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Side</text>
        <text x="260" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Price (TMN)</text>
        <text x="410" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Amount</text>
        <text x="550" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Fee</text>
        <text x="690" y="110" fill="#cbd5e1" font-family="sans-serif" font-size="12" font-weight="bold">Total (TMN)</text>

        <rect x="20" y="128" width="780" height="44" fill="#1e293b"/>
        <text x="40" y="156" fill="#06b6d4" font-family="sans-serif" font-size="13" font-weight="bold">TON/TMN</text>
        <text x="160" y="156" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="260" y="156" fill="#f8fafc" font-family="monospace" font-size="14">82,000</text>
        <text x="410" y="156" fill="#f8fafc" font-family="monospace" font-size="14">50.000 TON</text>
        <text x="550" y="156" fill="#fbbf24" font-family="monospace" font-size="14">0.100 TON</text>
        <text x="690" y="156" fill="#cbd5e1" font-family="monospace" font-size="14">4,100,000</text>

        <rect x="20" y="176" width="780" height="44" fill="#0f172a"/>
        <text x="40" y="204" fill="#06b6d4" font-family="sans-serif" font-size="13" font-weight="bold">TON/TMN</text>
        <text x="160" y="204" fill="#10b981" font-family="sans-serif" font-size="13" font-weight="bold">BUY</text>
        <text x="260" y="204" fill="#f8fafc" font-family="monospace" font-size="14">84,000</text>
        <text x="410" y="204" fill="#f8fafc" font-family="monospace" font-size="14">80.000 TON</text>
        <text x="550" y="204" fill="#fbbf24" font-family="monospace" font-size="14">0.160 TON</text>
        <text x="690" y="204" fill="#cbd5e1" font-family="monospace" font-size="14">6,720,000</text>
      </svg>
    `;

    const dataUrl1 = await convertSvgToDataUrl(svgPage1, 820, 380);
    const dataUrl2 = await convertSvgToDataUrl(svgPage2, 820, 380);
    if (dataUrl1 && dataUrl2) {
      const items: UploadedImageItem[] = [
        {
          id: `demo-p1-${Date.now()}`,
          name: 'wallex_history_page1_icp.png',
          dataUrl: dataUrl1,
          mimeType: 'image/png',
        },
        {
          id: `demo-p2-${Date.now() + 1}`,
          name: 'wallex_history_page2_ton.png',
          dataUrl: dataUrl2,
          mimeType: 'image/png',
        },
      ];
      setUploadedImages(items);
      triggerAiExtraction(items);
    }
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
    if (defaultSym && !livePrices[defaultSym]) {
      fetchAndApplyLivePrices([defaultSym]);
    }
  };

  const handleSetAllSide = (side: 'BUY' | 'SELL') => {
    setExtractedRows(prev => prev.map(r => ({ ...r, side })));
  };

  const handleToggleAllSides = () => {
    setExtractedRows(prev => prev.map(r => ({ ...r, side: r.side === 'BUY' ? 'SELL' : 'BUY' })));
  };

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

      const { fee: safeFee, feeUnit: safeUnit } = sanitizeExtractedFee(
        r.price,
        r.quantity,
        r.fee,
        r.feeUnit,
        r.side,
        curr,
        r.symbol,
        r.total
      );
      const computedFee = safeUnit === 'COIN' ? safeFee * r.price : safeFee;

      return {
        id: `ai-extracted-${Date.now()}-${i}`,
        date: r.date || new Date(Date.now() - (extractedRows.length - i) * 3600000).toISOString().replace('T', ' ').substring(0, 19),
        symbol: pair,
        currency: curr,
        side: r.side,
        price: r.price,
        quantity: r.quantity,
        fee: computedFee,
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
            {uploadedImages.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllImages}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFa ? 'حذف همه' : 'Clear All'}</span>
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
          multiple
          accept="image/png, image/jpeg, image/webp, image/bmp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleSelectImages(e.target.files);
            }
          }}
        />

        {/* 1. Upload & Drag-and-Drop Area OR Multi-Image Gallery */}
        {uploadedImages.length === 0 ? (
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
                <Images className="w-8 h-8" />
              </div>

              <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                {isFa ? 'بارگذاری همزمان یک یا چند اسکرین‌شات (Ctrl+V)' : 'Upload Multiple Screenshots or Paste (Ctrl+V)'}
              </h4>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                {isFa 
                  ? 'می‌توانید چند عکس مختلف یا اسکرین‌شات‌های اسکرول شده از تاریخچه معاملات را همزمان انتخاب کنید. هوش مصنوعی معاملات را از تمام عکس‌ها استخراج و در صورت اشتراک صفحات، تجمیع و اصلاح می‌نماید.'
                  : 'Select or drag multiple screenshots simultaneously. Gemini analyzes all images together, deduplicating overlapping trades.'}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  <FileImage className="w-4 h-4" />
                  <span>{isFa ? 'انتخاب چند عکس با هم' : 'Select Multiple Screenshots'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadMultiDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isFa ? 'تست نمونه چند عکسی (۲ صفحه)' : 'Load Multi-Image Demo'}</span>
                </button>
              </div>

              <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>{isFa ? 'قابلیت انتخاب همزمان چندین فایل یا پیست کردن پی‌درپی با کلید میانبر Ctrl+V' : 'Supports multi-file selection or multiple paste operations (Ctrl+V)'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Image Gallery Container */
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
            {/* Header of Image Gallery */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Images className="w-4 h-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {isFa 
                        ? `${uploadedImages.length} اسکرین‌شات بارگذاری‌شده` 
                        : `${uploadedImages.length} Screenshot(s) Loaded`}
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
                      ? (isFa ? 'در حال تحلیل با هوش مصنوعی روی تمام عکس‌ها...' : 'Analyzing all screenshots with Gemini Vision...')
                      : (isFa ? `${extractedRows.length} ردیف معامله استخراج و تجمیع شد` : `${extractedRows.length} trades extracted & consolidated`)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerAiExtraction()}
                  disabled={isExtracting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  title={isFa ? 'استخراج و پردازش مجدد تمام عکس‌ها با هوش مصنوعی' : 'Re-extract all images'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isExtracting ? 'animate-spin' : ''}`} />
                  <span>{isExtracting ? (isFa ? 'در حال پردازش...' : 'Extracting...') : (isFa ? 'استخراج مجدد' : 'Re-extract')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 transition cursor-pointer"
                  title={isFa ? 'افزودن اسکرین‌شات‌های بیشتر' : 'Add more screenshots'}
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isFa ? 'افزودن عکس' : 'Add Image'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllImages}
                  className="p-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  title={isFa ? 'حذف تمام عکس‌ها' : 'Clear all'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thumbnails Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {uploadedImages.map((imgItem, idx) => (
                <div 
                  key={imgItem.id} 
                  className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-video flex flex-col justify-end"
                >
                  <img 
                    src={imgItem.dataUrl} 
                    alt={imgItem.name} 
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Dark gradient overlay at bottom for name and badges */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {/* Top Bar on Card: Index & Remove Button */}
                  <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between z-10">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs">
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(imgItem.id);
                      }}
                      className="w-5 h-5 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                      title={isFa ? 'حذف این عکس' : 'Remove image'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Middle click: View full size */}
                  <button
                    type="button"
                    onClick={() => setModalPreviewImage({ url: imgItem.dataUrl, name: imgItem.name })}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition z-5 cursor-pointer text-white text-xs font-semibold gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{isFa ? 'مشاهده' : 'View'}</span>
                  </button>

                  {/* Bottom Filename */}
                  <div className="relative z-10 px-2 py-1 text-[10px] text-slate-200 truncate font-mono">
                    {imgItem.name}
                  </div>
                </div>
              ))}

              {/* Add More Photos Card in Grid */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-white/50 dark:bg-slate-800/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 aspect-video flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[11px] font-bold">{isFa ? 'افزودن عکس' : 'Add Screenshot'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal: Full Size Image Inspector */}
        {modalPreviewImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setModalPreviewImage(null)}
          >
            <div 
              className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 text-white">
                <span className="text-xs font-mono font-bold truncate max-w-md">{modalPreviewImage.name}</span>
                <button
                  type="button"
                  onClick={() => setModalPreviewImage(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-auto p-2 bg-slate-950 flex items-center justify-center">
                <img 
                  src={modalPreviewImage.url} 
                  alt={modalPreviewImage.name} 
                  className="max-h-[75vh] w-auto object-contain rounded-lg"
                />
              </div>
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

            {uploadedImages.length > 0 && (
              <button
                type="button"
                onClick={() => triggerAiExtraction()}
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

              {/* Fee Mode & Wallex Sync Bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => fetchAndApplyLivePrices(undefined, true)}
                  disabled={isLoadingWallex}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition cursor-pointer disabled:opacity-50"
                  title={isFa ? 'بروزرسانی آخرین قیمت‌های بازار از API والکس' : 'Sync live prices from Wallex API'}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWallex ? 'animate-spin' : ''}`} />
                  <span>{isFa ? 'بروزرسانی نرخ والکس (API)' : 'Sync Wallex'}</span>
                </button>

                <div className="flex items-center gap-1.5 border-s border-slate-300 dark:border-slate-700 ps-2">
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

            {wallexError && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{wallexError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchAndApplyLivePrices(undefined, true)}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 font-bold cursor-pointer"
                >
                  {isFa ? 'تلاش مجدد' : 'Retry'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. CALCULATIONS DISPLAY */}
        {extractedRows.length > 0 && (
          <div className="space-y-6">
            {/* VIEW A: "ALL ASSETS" - SEPARATED CARDS GRID FOR EACH CRYPTO */}
            {activeAssetTab === 'ALL' ? (
              <div className="space-y-4">
                {/* Overall Portfolio Snapshot Header */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                        {isFa ? `خلاصه کلی پورتفوی استخراج‌شده (${distinctAssets.length} ارز مجزا):` : `Extracted Portfolio Summary (${distinctAssets.length} Assets):`}
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
                        {isFa ? 'هر ارز به طور مستقل در کادر مجزای خود زیر نمایش داده شده است.' : 'Each asset is independently calculated below.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-sans block">{isFa ? 'کل خرید ناخالص:' : 'Gross Buy:'}</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight break-all">
                        {formatCurrency(overallCalculations.totalGrossSpend, lang, quoteCurrency)}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-sans block">{isFa ? 'مجموع کارمزدها:' : 'Total Fees:'}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono">
                          {overallCalculations.feePercentage.toFixed(2)}%
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 tracking-tight break-all">
                        {formatCurrency(overallCalculations.totalFeeCurrency, lang, quoteCurrency)}
                      </span>
                    </div>

                    {overallCalculations.hasLivePrices && (
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-sans block">{isFa ? 'سود/زیان کل سبد:' : 'Total P&L:'}</span>
                        <span className={`text-xs sm:text-sm font-bold tracking-tight break-all ${overallCalculations.totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs space-y-3 hover:border-indigo-400/50 transition overflow-hidden"
                      >
                        {/* Asset Header */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CurrencyLogo currency={sym} lang={lang} size="md" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md text-xs font-black bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 uppercase tracking-wide font-mono shadow-2xs">
                                  {sym}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-sans">
                                  {isFa ? `${calc.rows.length} معامله` : `${calc.rows.length} trades`}
                                </span>
                              </div>
                              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-sans mt-0.5 block truncate">
                                {isFa ? `ارز قیمت‌گذاری: ${calc.currency === 'TMN' ? 'تومان' : 'دلار ($)'}` : `Quote: ${calc.currency}`}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveAssetTab(sym)}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer shrink-0 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                          >
                            <span>{isFa ? 'تمرکز روی این ارز' : 'Focus'}</span>
                            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                          </button>
                        </div>

                        {/* BUY vs SELL Breakdown and Fees Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* 1. BUY Side Card */}
                          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                {isFa ? 'خریدها (حجم و کارمزد):' : 'BUYs & Fee:'}
                              </span>
                              {calc.buyCount > 0 && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  {isFa ? `${calc.buyCount} خرید` : `${calc.buyCount} buys`}
                                </span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight break-all">
                              {formatCurrency(calc.totalBuyGross, lang, calc.currency)}
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-300 font-mono break-all">
                              {formatNumber(calc.totalBuyQty, lang)} {sym}
                            </div>
                            {calc.buyCount > 0 && (
                              <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                                <span>{isFa ? 'کارمزد خرید (از کوین):' : 'Buy Fee (Coin):'}</span>
                                <span className="font-bold">
                                  {formatNumber(calc.buyFeeCoins, lang)} {sym} ({calc.buyFeePercent.toFixed(2)}%)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 2. SELL Side Card */}
                          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] sm:text-[11px] font-bold text-rose-800 dark:text-rose-300">
                                {isFa ? 'فروش‌ها (ارزش و کارمزد):' : 'SELLs & Fee:'}
                              </span>
                              {calc.sellCount > 0 ? (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  {isFa ? `${calc.sellCount} فروش` : `${calc.sellCount} sells`}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-sans font-medium">
                                  {isFa ? 'بدون فروش' : 'None'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight break-all">
                              {calc.totalSellGross > 0 ? formatCurrency(calc.totalSellGross, lang, calc.currency) : (isFa ? '۰' : '0')}
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-300 font-mono break-all">
                              {formatNumber(calc.totalSellQty, lang)} {sym}
                            </div>
                            {calc.sellCount > 0 ? (
                              <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                                <span>{isFa ? 'کارمزد فروش (از پایه):' : 'Sell Fee (Quote):'}</span>
                                <span className="font-bold">
                                  {formatCurrency(calc.sellFeeCurrency, lang, calc.currency)} ({calc.sellFeePercent.toFixed(2)}%)
                                </span>
                              </div>
                            ) : (
                              <div className="pt-1 border-t border-slate-200 dark:border-slate-700 text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                                {isFa ? 'هنوز فروشی ثبت نشده' : 'No sales registered'}
                              </div>
                            )}
                          </div>

                          {/* 3. Cost Basis / Unit */}
                          <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-1">
                            <span className="text-[10px] sm:text-[11px] font-bold text-indigo-900 dark:text-indigo-200 block">
                              {isFa ? 'بهای تمام شده هر واحد خرید:' : 'Cost Basis / Unit:'}
                            </span>
                            <div className="text-xs sm:text-sm font-black font-mono text-indigo-950 dark:text-indigo-100 tracking-tight break-all">
                              {formatCurrency(calc.costBasisPerUnit, lang, calc.currency)}
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-300 font-mono break-all">
                              <span className="font-sans text-slate-500 dark:text-slate-400">{isFa ? 'میانگین خام: ' : 'Raw: '}</span>
                              {formatCurrency(calc.rawAvgPrice, lang, calc.currency)}
                            </div>
                          </div>

                          {/* 4. Net Remaining Coins */}
                          <div className="p-2.5 sm:p-3 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-1">
                            <span className="text-[10px] sm:text-[11px] font-bold text-sky-900 dark:text-sky-200 block">
                              {calc.sellCount > 0 
                                ? (isFa ? 'مانده موجودی ولت (خالص):' : 'Remaining Holding:')
                                : (isFa ? 'موجودی خالص دریافتی:' : 'Net Received Coins:')
                              }
                            </span>
                            <div className="text-xs sm:text-sm font-black font-mono text-sky-950 dark:text-sky-100 tracking-tight break-all">
                              {formatNumber(calc.activeHolding, lang)} {sym}
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-300 font-sans break-all">
                              {calc.sellCount > 0 
                                ? (isFa ? `فروش: ${formatNumber(calc.totalSellQty, lang)} ${sym}` : `Sold: ${formatNumber(calc.totalSellQty, lang)}`)
                                : (isFa ? 'پس از کسر کارمزد خرید' : 'After buy fee')}
                            </div>
                          </div>
                        </div>

                        {/* Live Market Price Input & P&L Card for THIS coin */}
                        <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-500/30 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/30 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <label htmlFor={`live-price-${sym}`} className="text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>{isFa ? `قیمت لحظه‌ای بازار (${sym}):` : `Live ${sym} Price:`}</span>
                              </label>

                              {marketMetadata[sym] && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 dark:bg-slate-950 text-emerald-400 border border-emerald-500/40 font-mono shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>{marketMetadata[sym].marketSymbol}</span>
                                </span>
                              )}

                              {marketMetadata[sym]?.change24h !== undefined && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
                                  marketMetadata[sym].change24h! >= 0 
                                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700' 
                                    : 'bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                                }`}>
                                  {marketMetadata[sym].change24h! > 0 ? '+' : ''}{marketMetadata[sym].change24h}%
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {calc.livePrice > 0 && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                  calc.isProfit 
                                    ? 'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700' 
                                    : calc.isLoss 
                                    ? 'bg-rose-100 dark:bg-rose-900/70 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700' 
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                                }`}>
                                  {calc.isProfit ? (isFa ? 'سودده' : 'Profit') : calc.isLoss ? (isFa ? 'زیان‌ده' : 'Loss') : (isFa ? 'سر‌به‌سر' : 'Even')}
                                  {' '}({calc.pnlPercent > 0 ? '+' : ''}{calc.pnlPercent.toFixed(1)}%)
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => fetchAndApplyLivePrices([sym], true)}
                                disabled={isLoadingWallex}
                                title={isFa ? 'استعلام مجدد از API والکس' : 'Refresh from Wallex API'}
                                className="p-1 rounded-md text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWallex ? 'animate-spin' : ''}`} />
                              </button>
                            </div>
                          </div>

                          <div className="relative">
                            <input
                              id={`live-price-${sym}`}
                              type="text"
                              inputMode="decimal"
                              value={livePrices[sym] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLivePrices(prev => ({ ...prev, [sym]: val }));
                                setManualOverrideFlags(prev => ({ ...prev, [sym]: true }));
                                const num = parseFloat(val.replace(/,/g, ''));
                                if (!isNaN(num) && onUpdatePrice) onUpdatePrice(sym, num);
                              }}
                              placeholder={calc.currency === 'TMN' ? 'قیمت فعلی بازار به تومان...' : 'Current price in USD...'}
                              className="w-full font-mono text-xs sm:text-sm font-bold py-1.5 px-3 pe-16 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                            />
                            <div className="absolute top-1/2 -translate-y-1/2 end-2.5 flex items-center gap-1 pointer-events-none text-xs font-bold text-slate-500 dark:text-slate-400">
                              <CurrencyLogo currency={calc.currency} lang={lang} size="xs" />
                            </div>
                          </div>

                          {manualOverrideFlags[sym] && marketMetadata[sym] && (
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="text-amber-700 dark:text-amber-300 font-medium">
                                {isFa ? 'تغییر دستی انجام شده' : 'Manually edited'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const p = marketMetadata[sym].price;
                                  setLivePrices(prev => ({ ...prev, [sym]: String(p) }));
                                  setManualOverrideFlags(prev => ({ ...prev, [sym]: false }));
                                  if (onUpdatePrice) onUpdatePrice(sym, p);
                                }}
                                className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                              >
                                {isFa ? `بازگشت به نرخ والکس (${formatNumber(marketMetadata[sym].price, lang)})` : `Reset to Wallex (${marketMetadata[sym].price})`}
                              </button>
                            </div>
                          )}

                          {calc.livePrice > 0 && (
                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-500/20 font-mono">
                              <span className="text-slate-700 dark:text-slate-300 text-[10px] sm:text-[11px] font-sans font-bold">
                                {isFa ? 'سود / زیان تخمینی:' : 'Est. P&L:'}
                              </span>
                              <span className={`font-black text-xs sm:text-sm tracking-tight break-all ${calc.isProfit ? 'text-emerald-700 dark:text-emerald-400' : calc.isLoss ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
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
                    <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CurrencyLogo currency={calc.symbol} lang={lang} size="md" />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <label htmlFor={`ai-focused-live-price-${calc.symbol}`} className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                              {isFa ? `قیمت لحظه‌ای بازار والکس (${calc.symbol}):` : `Wallex Live Price (${calc.symbol}):`}
                            </label>
                            {marketMetadata[calc.symbol] && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 dark:bg-slate-950 text-emerald-400 border border-emerald-500/40 font-mono shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>{marketMetadata[calc.symbol].marketSymbol}</span>
                              </span>
                            )}
                            {marketMetadata[calc.symbol]?.change24h !== undefined && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
                                marketMetadata[calc.symbol].change24h! >= 0
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                              }`}>
                                {marketMetadata[calc.symbol].change24h! > 0 ? '+' : ''}{marketMetadata[calc.symbol].change24h}% (24h)
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                            {isFa 
                              ? 'استعلام مستقیم از وب‌سرویس والکس و اعمال خودکار بر محاسبات سود و زیان' 
                              : 'Real-time price automatically fetched from Wallex market API'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative min-w-[200px]">
                          <input
                            id={`ai-focused-live-price-${calc.symbol}`}
                            type="text"
                            inputMode="decimal"
                            value={livePrices[calc.symbol] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLivePrices(prev => ({ ...prev, [calc.symbol]: val }));
                              setManualOverrideFlags(prev => ({ ...prev, [calc.symbol]: true }));
                              const num = parseFloat(val.replace(/,/g, ''));
                              if (!isNaN(num) && onUpdatePrice) onUpdatePrice(calc.symbol, num);
                            }}
                            placeholder={calc.currency === 'TMN' ? 'قیمت فعلی به تومان...' : 'Current price in USD...'}
                            className="w-full font-mono text-sm sm:text-base font-bold py-1.5 px-3 pe-16 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 transition"
                          />
                          <div className="absolute top-1/2 -translate-y-1/2 end-3 flex items-center gap-1 pointer-events-none text-xs font-bold text-slate-500 dark:text-slate-400">
                            <CurrencyLogo currency={calc.currency} lang={lang} size="xs" />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => fetchAndApplyLivePrices([calc.symbol], true)}
                          disabled={isLoadingWallex}
                          title={isFa ? 'استعلام مجدد از وب‌سرویس والکس' : 'Refresh from Wallex'}
                          className="p-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-200 transition cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0"
                        >
                          <RefreshCw className={`w-4 h-4 ${isLoadingWallex ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Calculations Overview 4-Box Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* Box 1: BUYs & Volume & Buy Fee */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                            {isFa ? 'معاملات خرید (حجم و کارمزد):' : 'BUY Volume & Fee:'}
                          </span>
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {calc.buyCount} {isFa ? 'خرید' : 'buys'}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight break-all">
                          {formatCurrency(calc.totalBuyGross, lang, calc.currency)}
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-300 font-mono break-all">
                          {formatNumber(calc.totalBuyQty, lang)} {calc.symbol} {isFa ? 'خریداری شده' : 'bought'}
                        </div>
                        {calc.buyCount > 0 && (
                          <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                            <span>{isFa ? 'کارمزد خرید (از کوین):' : 'Buy Fee (Coin):'}</span>
                            <span className="font-bold">
                              {formatNumber(calc.buyFeeCoins, lang)} {calc.symbol} ({calc.buyFeePercent.toFixed(2)}%)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Box 2: SELLs & Revenue & Sell Fee */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] sm:text-[11px] font-bold text-rose-800 dark:text-rose-300">
                            {isFa ? 'معاملات فروش (ارزش و کارمزد):' : 'SELL Volume & Fee:'}
                          </span>
                          {calc.sellCount > 0 ? (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              {calc.sellCount} {isFa ? 'فروش' : 'sells'}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-sans font-medium">
                              {isFa ? 'بدون فروش' : 'None'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight break-all">
                          {calc.totalSellGross > 0 ? formatCurrency(calc.totalSellGross, lang, calc.currency) : (isFa ? '۰' : '0')}
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-300 font-mono break-all">
                          {formatNumber(calc.totalSellQty, lang)} {calc.symbol} {isFa ? 'فروخته شده' : 'sold'}
                        </div>
                        {calc.sellCount > 0 ? (
                          <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[9px] sm:text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                            <span>{isFa ? 'کارمزد فروش (از پایه):' : 'Sell Fee (Quote):'}</span>
                            <span className="font-bold">
                              {formatCurrency(calc.sellFeeCurrency, lang, calc.currency)} ({calc.sellFeePercent.toFixed(2)}%)
                            </span>
                          </div>
                        ) : (
                          <div className="pt-1 border-t border-slate-200 dark:border-slate-700 text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                            {isFa ? 'کل کارمزد: ' + formatCurrency(calc.totalFeeCurrency, lang, calc.currency) : 'Total fees: ' + formatCurrency(calc.totalFeeCurrency, lang, calc.currency)}
                          </div>
                        )}
                      </div>

                      {/* Box 3: Cost Basis per Unit */}
                      <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-1">
                        <span className="text-[10px] sm:text-[11px] font-bold text-indigo-900 dark:text-indigo-200 block">
                          {isFa ? 'بهای تمام شده هر واحد خرید:' : 'Cost Basis / Unit:'}
                        </span>
                        <div className="text-xs sm:text-sm font-black font-mono text-indigo-950 dark:text-indigo-100 tracking-tight break-all">
                          {formatCurrency(calc.costBasisPerUnit, lang, calc.currency)}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-300 font-mono break-all">
                          <span className="font-sans text-slate-500 dark:text-slate-400">{isFa ? 'میانگین خام: ' : 'Raw Avg: '}</span>
                          {formatCurrency(calc.rawAvgPrice, lang, calc.currency)}
                        </div>
                      </div>

                      {/* Box 4: Net Holdings */}
                      <div className="p-3 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-1">
                        <span className="text-[10px] sm:text-[11px] font-bold text-sky-900 dark:text-sky-200 block">
                          {calc.sellCount > 0 
                            ? (isFa ? 'مانده موجودی ولت (خالص):' : 'Remaining Holding:')
                            : (isFa ? 'کوین خالص دریافتی:' : 'Net Received Coins:')
                          }
                        </span>
                        <div className="text-xs sm:text-sm font-black font-mono text-sky-950 dark:text-sky-100 tracking-tight break-all">
                          {formatNumber(calc.activeHolding, lang)} {calc.symbol}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-300 font-sans break-all">
                          {calc.sellCount > 0 
                            ? (isFa ? `خرید: ${formatNumber(calc.netBuyCoins, lang)} | فروش: ${formatNumber(calc.totalSellQty, lang)}` : `Bought: ${formatNumber(calc.netBuyCoins, lang)} | Sold: ${formatNumber(calc.totalSellQty, lang)}`)
                            : (isFa ? `هزینه کل: ${formatCurrency(calc.totalCostWithFees, lang, calc.currency)}` : 'Total spend')}
                        </div>
                      </div>
                    </div>

                    {/* Profit & Loss Card if Live Price is Present */}
                    {calc.livePrice > 0 && (
                      <div 
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                          calc.isProfit
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60'
                            : calc.isLoss
                            ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/60'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {isFa ? `وضعیت پوزیشن ${calc.symbol}:` : `${calc.symbol} Position P&L:`}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${
                                calc.isProfit
                                  ? 'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                                  : calc.isLoss
                                  ? 'bg-rose-100 dark:bg-rose-900/70 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                              }`}>
                                {calc.isProfit ? (isFa ? 'در سود' : 'In Profit') : calc.isLoss ? (isFa ? 'در زیان' : 'In Loss') : (isFa ? 'سر‌به‌سر' : 'Breakeven')}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-baseline gap-2.5 mt-1">
                              <span className={`text-lg sm:text-xl font-black font-mono tracking-tight break-all ${
                                calc.isProfit ? 'text-emerald-700 dark:text-emerald-300' : calc.isLoss ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'
                              }`}>
                                {calc.totalPnL > 0 ? '+' : ''}{formatCurrency(calc.totalPnL, lang, calc.currency)}
                              </span>
                              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md border ${
                                calc.isProfit ? 'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700' : calc.isLoss ? 'bg-rose-100 dark:bg-rose-900/70 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700' : 'text-slate-700'
                              }`}>
                                {calc.pnlPercent > 0 ? '+' : ''}{calc.pnlPercent.toFixed(2)}%
                              </span>
                            </div>
                          </div>

                          <div className="text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300 border-t md:border-t-0 md:border-s border-slate-300/80 dark:border-slate-700 md:ps-4 pt-2 md:pt-0">
                            <div>
                              {isFa ? 'ارزش فعلی کل دارایی:' : 'Market Value:'} 
                              <span className="font-bold text-slate-900 dark:text-slate-100 ms-1 break-all">
                                {formatCurrency(calc.currentMarketValue, lang, calc.currency)}
                              </span>
                            </div>
                            <div>
                              {isFa ? 'فاصله تا قیمت تمام شده:' : 'Diff to Cost Basis:'} 
                              <span className={`font-bold ms-1 break-all ${calc.isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
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
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                  {isFa 
                    ? `جدول تراکنش‌های استخراج شده ${activeAssetTab !== 'ALL' ? `(نماد ${activeAssetTab})` : ''} (${displayRows.length} از ${extractedRows.length} سطر):` 
                    : `Extracted Trades Table (${displayRows.length} of ${extractedRows.length} rows):`}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800/60 transition cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isFa ? 'افزودن سطر جدید' : 'Add Row'}</span>
                </button>

                {activeAssetTab !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setActiveAssetTab('ALL')}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-bold"
                  >
                    {isFa ? 'نمایش تمام سطرها' : 'Show all rows'}
                  </button>
                )}
              </div>
            </div>

            {/* Canonical Wallex Columns Reference Banner & Quick Side Switch */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
                  {isFa ? 'ترتیب ستون‌ها (مطابق سرستون رسمی والکس):' : 'Standard Wallex Column Order (RTL):'}
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-sans text-[10px] sm:text-[11px]">
                  {isFa 
                    ? '۱. بازار | ۲. فروشنده | ۳. خریدار | ۴. قیمت واحد | ۵. مقدار | ۶. قیمت کل | ۷. کارمزد فروشنده (تومان) | ۸. کارمزد خریدار (کوین) | ۹. تاریخ | ۱۰. نوع معامله'
                    : '1. Market | 2. Seller | 3. Buyer | 4. Unit Price | 5. Qty | 6. Total | 7. Seller Fee (TMN) | 8. Buyer Fee (Coin) | 9. Date | 10. Type'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                <button
                  type="button"
                  onClick={() => handleSetAllSide('BUY')}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 transition cursor-pointer"
                  title={isFa ? 'تنظیم نوع تمام سطرها به خرید' : 'Set all rows to BUY'}
                >
                  {isFa ? 'همه: خرید 🟢' : 'All: BUY 🟢'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllSide('SELL')}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 transition cursor-pointer"
                  title={isFa ? 'تنظیم نوع تمام سطرها به فروش' : 'Set all rows to SELL'}
                >
                  {isFa ? 'همه: فروش 🔴' : 'All: SELL 🔴'}
                </button>
                <button
                  type="button"
                  onClick={handleToggleAllSides}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition cursor-pointer"
                  title={isFa ? 'معکوس کردن خرید و فروش در تمام سطرها' : 'Invert BUY and SELL for all rows'}
                >
                  {isFa ? 'معکوس کردن ⇄' : 'Invert ⇄'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700 max-h-80 overflow-y-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] sticky top-0 border-b border-slate-300 dark:border-slate-700 z-10 shadow-2xs backdrop-blur-xs">
                  <tr>
                    <th className="p-2 text-center w-10">#</th>
                    <th className="p-2 text-start w-28">{isFa ? 'ارز / نماد' : 'Asset'}</th>
                    <th className="p-2 text-start w-24">{isFa ? 'نوع (خرید/فروش)' : 'Side'}</th>
                    <th className="p-2 text-end">{isFa ? 'قیمت واحد' : 'Price'}</th>
                    <th className="p-2 text-end">{isFa ? 'حجم معامله' : 'Volume'}</th>
                    <th className="p-2 text-end">{isFa ? 'کارمزد و واحد' : 'Fee & Unit'}</th>
                    <th className="p-2 text-end">{isFa ? 'ارزش کارمزد' : 'Fee Value'}</th>
                    <th className="p-2 text-end">{isFa ? 'مجموع معامله' : 'Total Value'}</th>
                    <th className="p-2 text-center w-10">{isFa ? 'حذف' : 'Del'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                  {displayRows.map((row, idx) => {
                    const rowFeeCurrency = row.feeUnit === 'COIN' ? row.fee * row.price : row.fee;
                    const rowTotalValue = row.total && row.total > 0 ? row.total : row.price * row.quantity;
                    const rowCurrency = row.currency || quoteCurrency;
                    const rowFeePercent = rowTotalValue > 0 ? (rowFeeCurrency / rowTotalValue) * 100 : 0;

                    return (
                      <tr key={row.id} className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition">
                        <td className="p-2 text-center text-slate-600 dark:text-slate-400 font-sans font-bold text-xs">{idx + 1}</td>

                        {/* Editable Asset Symbol */}
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            <CurrencyLogo currency={row.symbol} lang={lang} size="xs" />
                            <input
                              type="text"
                              value={row.symbol}
                              onChange={(e) => handleUpdateRow(row.id, 'symbol', e.target.value.toUpperCase())}
                              className="w-16 px-1.5 py-0.5 text-center font-bold uppercase rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-indigo-900 dark:text-indigo-200 text-xs shadow-2xs"
                              placeholder="SYM"
                            />
                          </div>
                        </td>

                        {/* Toggleable Side (BUY / SELL) */}
                        <td className="p-2">
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
                            className={`px-2 py-0.5 rounded text-[11px] font-sans font-black transition cursor-pointer border shadow-2xs ${
                              row.side === 'BUY' 
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900' 
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700 hover:bg-rose-200 dark:hover:bg-rose-900'
                            }`}
                          >
                            {row.side === 'BUY' ? (isFa ? '🟢 خرید' : '🟢 BUY') : (isFa ? '🔴 فروش' : '🔴 SELL')}
                          </button>
                        </td>

                        {/* Price */}
                        <td className="p-2 text-end">
                          <input
                            type="number"
                            value={row.price}
                            onChange={(e) => handleUpdateRow(row.id, 'price', parseFloat(e.target.value) || 0)}
                            className="w-24 px-1.5 py-0.5 text-end font-mono font-bold text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="p-2 text-end">
                          <input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => handleUpdateRow(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-24 px-1.5 py-0.5 text-end font-mono font-bold text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                          />
                        </td>

                        {/* Fee with toggleable Fee Unit (COIN / CURRENCY) */}
                        <td className="p-2 text-end">
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.0001"
                                value={row.fee}
                                onChange={(e) => handleUpdateRow(row.id, 'fee', parseFloat(e.target.value) || 0)}
                                className="w-20 px-1.5 py-0.5 text-end font-mono rounded border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-slate-950 text-amber-900 dark:text-amber-200 font-bold text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateRow(row.id, 'feeUnit', row.feeUnit === 'COIN' ? 'CURRENCY' : 'COIN')}
                                title={isFa ? 'تغییر واحد کارمزد (کوین یا ارز پایه)' : 'Toggle fee unit'}
                                className="text-[10px] font-sans px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer font-bold"
                              >
                                {row.feeUnit === 'COIN' ? row.symbol : rowCurrency}
                              </button>
                            </div>
                            {rowFeePercent > 0 && (
                              <span 
                                className="text-[10px] font-mono font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-700"
                                title={isFa ? 'درصد کارمزد معامله' : 'Trade fee %'}
                              >
                                {rowFeePercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Fee Value */}
                        <td className="p-2 text-end">
                          <div className="text-amber-900 dark:text-amber-300 font-bold text-xs tracking-tight break-all">
                            {formatCurrency(rowFeeCurrency, lang, rowCurrency)}
                          </div>
                          {rowFeePercent > 0 && (
                            <div className="text-[10px] text-slate-600 dark:text-slate-400 font-sans font-medium mt-0.5">
                              {rowFeePercent.toFixed(2)}% {isFa ? 'کارمزد' : 'fee'}
                            </div>
                          )}
                        </td>

                        {/* Total Value */}
                        <td className="p-2 text-end text-slate-900 dark:text-slate-100 font-bold text-xs tracking-tight break-all">
                          {formatCurrency(rowTotalValue, lang, rowCurrency)}
                        </td>

                        {/* Delete */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition cursor-pointer"
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
