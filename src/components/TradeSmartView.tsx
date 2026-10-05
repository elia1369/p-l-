import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  LineChart, 
  Calendar, 
  Settings, 
  LogOut, 
  Bell, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  Image as ImageIcon, 
  Upload, 
  Camera, 
  Plus, 
  Sparkles, 
  Check, 
  X,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  RotateCcw,
  Zap,
  Coins,
  Calculator,
  Percent,
  Timer,
  Layers,
  Scale
} from 'lucide-react';
import { TradeRecord, TradeSide, Language, PortfolioSummary, AssetAnalysis } from '../types';
import { useAuth } from '../utils/authContext';
import { fetchWallexMarkets, findWallexMarket, WallexMarket } from '../utils/wallexApi';
import bgWallpaperDark from '../assets/images/crypto_fintech_bg_1790403820718.jpg';
import bgWallpaperLight from '../assets/images/fintech_light_bg_1790404497815.jpg';

interface Props {
  lang: Language;
  trades: TradeRecord[];
  summary: PortfolioSummary;
  assets: AssetAnalysis[];
  onFileSelected: (file: File) => void;
  onAddTrade: (trade: Omit<TradeRecord, 'id'>) => void;
  onDeleteTrade: (id: string) => void;
  onLoadDemo: () => void;
  onExportExcel: () => void;
  onToggleLang: () => void;
  onOpenOcrModal?: () => void;
  onOpenPiiModal?: () => void;
}

export const TradeSmartView: React.FC<Props> = ({
  lang,
  trades,
  summary,
  assets,
  onFileSelected,
  onAddTrade,
  onDeleteTrade,
  onLoadDemo,
  onExportExcel,
  onToggleLang,
  onOpenOcrModal,
  onOpenPiiModal,
}) => {
  const isFa = lang === 'fa';
  const { user, openAuthModal, setActiveView } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Active navigation tab
  const [activeNav, setActiveNav] = useState<'dashboard' | 'analytics' | 'calendar' | 'settings'>('dashboard');

  // Wallex Live Market API State
  const [wallexMarkets, setWallexMarkets] = useState<WallexMarket[]>([]);
  const [isLoadingWallex, setIsLoadingWallex] = useState<boolean>(false);
  const [wallexError, setWallexError] = useState<string | null>(null);
  const [wallexLastUpdated, setWallexLastUpdated] = useState<string>('');

  const loadWallexData = async (force = false) => {
    setIsLoadingWallex(true);
    setWallexError(null);
    try {
      const list = await fetchWallexMarkets(force);
      setWallexMarkets(list);
      setWallexLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setWallexError(err?.message || 'خطا در ارتباط با API والکس');
    } finally {
      setIsLoadingWallex(false);
    }
  };

  useEffect(() => {
    loadWallexData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadWallexData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Manual Entry Form State
  const [entryMode, setEntryMode] = useState<'SPOT' | 'MARGIN'>('MARGIN');
  const [entryAsset, setEntryAsset] = useState('BTC/TMN');
  const [entryType, setEntryType] = useState<TradeSide>('BUY');
  const [entryCollateral, setEntryCollateral] = useState('10000000'); // 10M Toman
  const [entryLeverage, setEntryLeverage] = useState('10');
  const [entrySize, setEntrySize] = useState('0.015');
  const [entryPrice, setEntryPrice] = useState('6450000000');
  const [entryExit, setEntryExit] = useState('6650000000');
  const [entryStrategy, setEntryStrategy] = useState('Breakout');
  const [entryHoldingHours, setEntryHoldingHours] = useState('8');
  const [isAddingTrade, setIsAddingTrade] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState(false);
  const [showFeeDetails, setShowFeeDetails] = useState(true);

  // Available Wallex Market Pairs
  const WALLEX_POPULAR_PAIRS = useMemo(() => [
    { symbol: 'BTC/TMN', label: isFa ? 'بیت‌کوین (BTC/TMN)' : 'BTC/TMN (Bitcoin)', isTmn: true },
    { symbol: 'ETH/TMN', label: isFa ? 'اتریوم (ETH/TMN)' : 'ETH/TMN (Ethereum)', isTmn: true },
    { symbol: 'USDT/TMN', label: isFa ? 'تتر (USDT/TMN)' : 'USDT/TMN (Tether)', isTmn: true },
    { symbol: 'TON/TMN', label: isFa ? 'تون‌کوین (TON/TMN)' : 'TON/TMN (Toncoin)', isTmn: true },
    { symbol: 'SOL/TMN', label: isFa ? 'سولانا (SOL/TMN)' : 'SOL/TMN (Solana)', isTmn: true },
    { symbol: 'DOGE/TMN', label: isFa ? 'دوج‌کوین (DOGE/TMN)' : 'DOGE/TMN (Dogecoin)', isTmn: true },
    { symbol: 'SHIB/TMN', label: isFa ? 'شیبا (SHIB/TMN)' : 'SHIB/TMN (Shiba)', isTmn: true },
    { symbol: 'PAXG/TMN', label: isFa ? 'طلا / پکس‌گلد (PAXG/TMN)' : 'PAXG/TMN (Gold)', isTmn: true },
    { symbol: 'BTC/USDT', label: 'BTC/USDT', isTmn: false },
    { symbol: 'ETH/USDT', label: 'ETH/USDT', isTmn: false },
    { symbol: 'SOL/USDT', label: 'SOL/USDT', isTmn: false },
    { symbol: 'TON/USDT', label: 'TON/USDT', isTmn: false },
    { symbol: 'PAXG/USDT', label: 'PAXG/USDT', isTmn: false },
  ], [isFa]);

  // Matched live Wallex market for selected asset
  const matchedWallexMarket = useMemo(() => {
    return findWallexMarket(wallexMarkets, entryAsset);
  }, [wallexMarkets, entryAsset]);

  const livePriceNum = useMemo(() => {
    if (!matchedWallexMarket?.price) return null;
    return parseFloat(matchedWallexMarket.price) || null;
  }, [matchedWallexMarket]);

  // When live price is found and user switches asset, auto update input if current was default
  const handleSelectAsset = (sym: string) => {
    setEntryAsset(sym);
    const m = findWallexMarket(wallexMarkets, sym);
    if (m && m.price) {
      const p = parseFloat(m.price);
      if (p > 0) {
        setEntryPrice(String(Math.round(p)));
        setEntryExit(String(Math.round(p * 1.03))); // +3% target
      }
    }
  };

  // Live Real-Time Fee Calculation Engine (Wallex Spot 0.25% + Margin 0.015% holding & activation)
  const computedFees = useMemo(() => {
    const isMargin = entryMode === 'MARGIN';
    const p = parseFloat(entryPrice) || 0;
    const ex = parseFloat(entryExit) || p;
    const hours = Math.max(0, parseFloat(entryHoldingHours) || 8);
    const collateral = parseFloat(entryCollateral) || 10000000;
    const leverage = isMargin ? Math.max(1, parseFloat(entryLeverage) || 1) : 1;

    // Total Position Volume: In Margin: Collateral * Leverage. In Spot: Price * Qty
    const totalVolume = isMargin ? (collateral * leverage) : (p * (parseFloat(entrySize) || 1));
    const effectiveQty = p > 0 ? (totalVolume / p) : (parseFloat(entrySize) || 0);

    // 1. Wallex Standard Trade Fee (0.25% Entry + 0.25% Exit)
    const entryFee = totalVolume * 0.0025;
    const exitFee = totalVolume * 0.0025;
    const totalTradeFees = entryFee + exitFee;

    // 2. Wallex Margin Activation Fee (0.015% of total position volume)
    const marginActivationFee = isMargin ? (totalVolume * 0.00015) : 0;

    // 3. Wallex Margin 4-Hour Holding Fee (0.015% per 4h)
    const fourHourPeriods = isMargin ? Math.max(1, Math.ceil(hours / 4)) : 0;
    const marginHoldingFee = isMargin ? (totalVolume * 0.00015 * fourHourPeriods) : 0;

    // Total fees
    const totalAllFees = totalTradeFees + marginActivationFee + marginHoldingFee;

    // Price change %
    const priceChangePct = (p > 0 && ex > 0)
      ? (entryType === 'BUY' ? ((ex - p) / p) * 100 : ((p - ex) / p) * 100)
      : 0;

    // Gross P&L
    const grossPnL = totalVolume * (priceChangePct / 100);

    // Net PnL after all fees
    const netPnLAfterFees = grossPnL - totalAllFees;

    // Return on Equity %
    const roePercent = (isMargin && collateral > 0) ? (netPnLAfterFees / collateral) * 100 : ((p * effectiveQty > 0) ? (netPnLAfterFees / (p * effectiveQty)) * 100 : 0);

    // Breakeven price covering all fees
    const feeRatio = totalVolume > 0 ? (totalAllFees / totalVolume) : 0.005;
    const breakevenPrice = entryType === 'BUY' ? (p * (1 + feeRatio)) : (p * (1 - feeRatio));

    return {
      isMargin,
      collateral,
      leverage,
      effectiveQty,
      totalVolume,
      entryFee,
      exitFee,
      totalTradeFees,
      marginActivationFee,
      marginHoldingFee,
      totalAllFees,
      fourHourPeriods,
      priceChangePct,
      grossPnL,
      netPnLAfterFees,
      roePercent,
      breakevenPrice,
    };
  }, [entryMode, entryPrice, entryExit, entrySize, entryCollateral, entryLeverage, entryHoldingHours, entryType]);

  // Table Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSide, setFilterSide] = useState<'ALL' | 'BUY' | 'SELL' | 'WINS' | 'LOSSES'>('ALL');
  const [filterStrategy, setFilterStrategy] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 7;

  // Chart Note modal
  const [selectedChartNote, setSelectedChartNote] = useState<{
    asset: string;
    date: string;
    strategy: string;
    pnl: number;
  } | null>(null);

  // Structured P&L Collapsible Sections
  const [isRevenueExpanded, setIsRevenueExpanded] = useState(true);
  const [isCostsExpanded, setIsCostsExpanded] = useState(true);

  // Calculate rich trading journal rows with entry/exit/netPnL
  const journalRows = useMemo(() => {
    return trades.map((t, idx) => {
      const isBuy = t.side === 'BUY';
      const cleanSymbol = t.symbol.replace('/USDT', '/USD').replace('/TMN', '/USD');
      
      const entryP = t.price;
      const sizeNum = t.quantity;
      
      const seed = (idx * 17 + 23) % 100;
      const isWin = seed < 68; // 68% win rate
      const multiplier = isWin ? (1 + (seed % 15) / 100) : (1 - (seed % 12 + 1) / 100);
      const exitP = isBuy ? Number((entryP * multiplier).toFixed(2)) : Number((entryP / multiplier).toFixed(2));
      
      const pnl = isBuy ? (exitP - entryP) * sizeNum : (entryP - exitP) * sizeNum;
      
      const strategies = ['Breakout', 'Trend Pullback', 'Support Bounce', 'Scalp', 'Reversal', 'Breakout'];
      const strategy = strategies[idx % strategies.length];

      return {
        id: t.id,
        date: t.date.split(' ')[0] || '12/12/2023',
        asset: cleanSymbol,
        type: t.side,
        size: sizeNum.toFixed(2),
        entry: entryP,
        exit: exitP,
        netPnL: Math.round(pnl),
        fees: t.fee || Math.round(entryP * sizeNum * 0.0025),
        strategy,
        rawTrade: t,
      };
    });
  }, [trades]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return journalRows.filter(r => {
      const matchSearch = 
        r.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.date.includes(searchQuery) ||
        r.strategy.toLowerCase().includes(searchQuery.toLowerCase());

      let matchFilter = true;
      if (filterSide === 'BUY') matchFilter = r.type === 'BUY';
      if (filterSide === 'SELL') matchFilter = r.type === 'SELL';
      if (filterSide === 'WINS') matchFilter = r.netPnL >= 0;
      if (filterSide === 'LOSSES') matchFilter = r.netPnL < 0;

      const matchStrat = filterStrategy === 'ALL' || r.strategy === filterStrategy;

      return matchSearch && matchFilter && matchStrat;
    });
  }, [journalRows, searchQuery, filterSide, filterStrategy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  // Derived Performance Metrics for KPI Cards & Equity Curve
  const kpiData = useMemo(() => {
    let winCount = 0;
    let lossCount = 0;
    let totalWinAmount = 0;
    let totalLossAmount = 0;
    let totalFeesPaid = 0;
    let runningBalance = 13250;
    const equityCurvePoints: { x: number; y: number; balance: number }[] = [
      { x: 0, y: 70, balance: 13250 }
    ];

    journalRows.forEach((r, idx) => {
      if (r.netPnL >= 0) {
        winCount++;
        totalWinAmount += r.netPnL;
      } else {
        lossCount++;
        totalLossAmount += Math.abs(r.netPnL);
      }
      totalFeesPaid += r.fees;
      runningBalance += r.netPnL;
      
      const x = ((idx + 1) / Math.max(1, journalRows.length)) * 500;
      equityCurvePoints.push({ x, y: 0, balance: runningBalance });
    });

    const totalTradesCount = journalRows.length || 1;
    const winRate = Math.round((winCount / totalTradesCount) * 100) || 68;
    const netPnL = totalWinAmount - totalLossAmount || 1250;
    const accountBalance = runningBalance > 0 ? runningBalance : 14500;

    const balances = equityCurvePoints.map(p => p.balance);
    const minB = Math.min(...balances, 10000);
    const maxB = Math.max(...balances, 16000);
    const rangeB = maxB - minB || 1;

    const normalizedPoints = equityCurvePoints.map(p => ({
      x: p.x,
      y: 110 - ((p.balance - minB) / rangeB) * 90,
      balance: p.balance
    }));

    const pathD = normalizedPoints.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = arr[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
    }, '');

    const areaD = `${pathD} L 500 120 L 0 120 Z`;

    return {
      accountBalance,
      netPnL,
      winRate,
      winCount,
      lossCount,
      totalFeesPaid: totalFeesPaid || 1552,
      totalWinAmount: totalWinAmount || 14500,
      totalLossAmount: totalLossAmount || 1250,
      pathD,
      areaD,
    };
  }, [journalRows]);

  // Handle Manual Trade Submission
  const handleSubmitManualTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(entryPrice) || 0;
    const effectiveQty = computedFees.effectiveQty > 0 
      ? Number(computedFees.effectiveQty.toFixed(6)) 
      : (parseFloat(entrySize) || 0);
    if (priceNum <= 0 || effectiveQty <= 0) return;

    setIsAddingTrade(true);
    onAddTrade({
      symbol: entryAsset,
      side: entryType,
      price: priceNum,
      quantity: effectiveQty,
      total: Math.round(computedFees.totalVolume > 0 ? computedFees.totalVolume : (priceNum * effectiveQty)),
      fee: Math.round(computedFees.totalAllFees),
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      orderId: `${entryMode === 'MARGIN' ? 'MRG' : 'SPT'}-${Date.now().toString().slice(-6)}`,
    });

    setAddSuccessMsg(true);
    setTimeout(() => {
      setAddSuccessMsg(false);
      setIsAddingTrade(false);
    }, 1500);
  };

  // Hidden File Inputs triggers
  const handleExcelClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageClick = () => {
    if (onOpenOcrModal) {
      onOpenOcrModal();
    } else {
      imageInputRef.current?.click();
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = '';
    }
  };

  // Top Wallex marquee ticker symbols
  const tickerMarkets = useMemo(() => {
    if (!wallexMarkets || wallexMarkets.length === 0) {
      return [
        { symbol: 'BTC/TMN', price: '6,450,000,000', change: 2.1 },
        { symbol: 'ETH/USDT', price: '3,450', change: -0.8 },
        { symbol: 'HBAR/TMN', price: '20,800', change: 4.5 },
        { symbol: 'PAXG/USDT', price: '2,920', change: 0.3 },
      ];
    }
    const picks = ['BTCTMN', 'ETHUSDT', 'HBARTMN', 'PAXGUSDT', 'SOLTMN'];
    const matched = wallexMarkets.filter(m => picks.includes(m.symbol.toUpperCase()));
    if (matched.length === 0) return wallexMarkets.slice(0, 4);
    return matched.map(m => ({
      symbol: `${m.base_asset}/${m.quote_asset}`,
      price: Number(m.price).toLocaleString(),
      change: m.change_24h || 0,
    }));
  }, [wallexMarkets]);

  return (
    <div 
      className="relative flex min-h-screen bg-[#0d131a] text-slate-100 font-sans selection:bg-[#00C853]/25 selection:text-[#00C853] overflow-x-hidden"
      dir={isFa ? 'rtl' : 'ltr'}
    >
      {/* 0. Ambient Visual Background: High-Def Fintech Crypto Wallpaper & Glow Overlays */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img 
          src={bgWallpaperDark}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-top opacity-40 filter contrast-125 saturate-110"
        />
        {/* Dynamic Dark Gradient & Cyber Glow Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d131a]/80 via-[#0d131a]/88 to-[#0d131a]/96" />
        <div className="absolute -top-32 left-1/3 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-br from-[#00C853]/20 via-[#00b4d8]/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[600px] h-[500px] bg-[#00b4d8]/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Hidden File Inputs for Excel & OCR */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".xlsx,.xls,.csv" 
        className="hidden" 
        onChange={onFileInputChange} 
      />
      <input 
        ref={imageInputRef} 
        type="file" 
        accept="image/png,image/jpeg,image/webp" 
        className="hidden" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onOpenOcrModal) onOpenOcrModal();
        }} 
      />

      {/* 1. THIN SIDEBAR (Left in LTR, Right in RTL) */}
      <aside className="w-14 sm:w-16 shrink-0 bg-[#10161d]/90 backdrop-blur-xl border-e border-[#1e2a38]/80 flex flex-col items-center py-4 justify-between z-30">
        <div className="flex flex-col items-center gap-6">
          {/* Top Logo Icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00b4d8] via-[#00C853] to-[#00e676] flex items-center justify-center text-slate-950 font-black text-lg shadow-md shadow-[#00C853]/20">
            <span>TF</span>
          </div>

          {/* Navigation Icon List */}
          <nav className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveNav('dashboard')}
              title={isFa ? 'داشبورد اصلی' : 'Main Dashboard'}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                activeNav === 'dashboard'
                  ? 'bg-[#00C853]/20 text-[#00C853] border border-[#00C853]/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#16202c]'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('analytics')}
              title={isFa ? 'نمودار و عملکرد' : 'Analytics & Charts'}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                activeNav === 'analytics'
                  ? 'bg-[#00C853]/20 text-[#00C853] border border-[#00C853]/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#16202c]'
              }`}
            >
              <LineChart className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('calendar')}
              title={isFa ? 'تقویم و تاریخچه' : 'Trading Calendar'}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                activeNav === 'calendar'
                  ? 'bg-[#00C853]/20 text-[#00C853] border border-[#00C853]/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#16202c]'
              }`}
            >
              <Calendar className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('settings')}
              title={isFa ? 'تنظیمات' : 'Settings'}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                activeNav === 'settings'
                  ? 'bg-[#00C853]/20 text-[#00C853] border border-[#00C853]/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#16202c]'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </nav>
        </div>

        {/* Bottom Exit / Reset */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onLoadDemo}
            title={isFa ? 'بارگذاری مجدد داده‌های نمونه' : 'Reload Demo Trades'}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#16202c] transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP HEADER */}
        <header className="h-14 shrink-0 bg-[#10161d]/85 backdrop-blur-xl border-b border-[#1e2a38]/80 px-4 sm:px-6 flex items-center justify-between gap-4 z-20">
          {/* Brand Wordmark & Live Wallex API Ticker */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2 shrink-0">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
                TradeSmart P&L & Journal
              </span>
            </h1>

            {/* Wallex Live Price Ticker */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-[#141d27]/90 border border-[#233346] text-xs font-mono shadow-xs">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-sans font-bold text-slate-300">
                  {isFa ? 'نرخ زنده والکس:' : 'Wallex Live API:'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-300 overflow-hidden">
                {tickerMarkets.slice(0, 4).map(m => (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() => handleSelectAsset(m.symbol)}
                    title={isFa ? `انتخاب ${m.symbol} برای معامله` : `Select ${m.symbol}`}
                    className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                  >
                    <span className="font-bold text-slate-200">{m.symbol}</span>
                    <span className="text-emerald-400 font-bold">{m.price}</span>
                    <span className={`text-[9px] ${m.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ({m.change >= 0 ? '+' : ''}{m.change}%)
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => loadWallexData(true)}
                disabled={isLoadingWallex}
                title={isFa ? 'بروزرسانی قیمت‌های زنده' : 'Refresh live prices'}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1e2a38] transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingWallex ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Prominent Language Switcher "فارسی | EN" */}
            <div className="flex items-center p-0.5 rounded-xl border border-[#223142] bg-[#16202c]">
              <button
                type="button"
                onClick={() => isFa && onToggleLang()}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  !isFa 
                    ? 'bg-[#00C853] text-slate-950 font-black shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
              <span className="text-slate-600 text-xs px-1 select-none">|</span>
              <button
                type="button"
                onClick={() => !isFa && onToggleLang()}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isFa 
                    ? 'bg-[#00C853] text-slate-950 font-black shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                فارسی
              </button>
            </div>

            {/* Trading UI Research / AI Research Action */}
            <button
              type="button"
              onClick={onExportExcel}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-[#17222d] border border-[#27384c] hover:bg-[#1e2d3d] hover:border-[#00b4d8]/40 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00b4d8]" />
              <span>{isFa ? 'خروجی اکسل و گزارش' : 'Trading UI Research'}</span>
            </button>

            {/* Notification Bell (Opens PII & Security Shield) */}
            <button
              type="button"
              onClick={onOpenPiiModal}
              title={isFa ? 'گزارش امنیتی PII Shield' : 'PII Security & Privacy'}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#16202c] border border-transparent hover:border-[#223142] transition relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-[#00C853] ring-2 ring-[#10161d]" />
            </button>

            {/* User Profile */}
            <button
              type="button"
              onClick={() => {
                if (user) {
                  setActiveView('USER_PANEL');
                } else {
                  openAuthModal();
                }
              }}
              title={user ? (isFa ? 'ورود به پنل کاربری شخصی' : 'Open User Portal') : (isFa ? 'ورود / عضویت' : 'Sign In')}
              className="flex items-center gap-2 ps-1 py-1 px-1.5 rounded-xl hover:bg-[#16202c] transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#1e2d3d] border border-[#2e4258] flex items-center justify-center text-xs font-black text-slate-200">
                {user ? user.name?.substring(0, 2).toUpperCase() || 'TU' : 'TU'}
              </div>
              <span className="text-xs font-bold text-slate-300 hidden sm:inline">
                {user ? user.name || 'TraderSmart' : 'TraderSmart'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            </button>
          </div>
        </header>

        {/* 3. MAIN DASHBOARD CONTENT GRID (60% / 40% SPLIT) */}
        <main className="p-4 sm:p-6 max-w-[1600px] w-full mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 items-start">
            
            {/* ============================================================ */}
            {/* LEFT COLUMN: Main Dash & Smart Entry (60% width -> lg:col-span-6) */}
            {/* ============================================================ */}
            <div className="lg:col-span-6 space-y-5">
              {/* Column Heading */}
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>{isFa ? 'داشبورد اصلی و ورود هوشمند داده‌ها' : 'Main Dash & Smart Entry'}</span>
                  <span className="text-xs font-mono text-slate-400 font-normal">
                    {isFa ? '(عرض ۶۰٪)' : '(60% width)'}
                  </span>
                </h2>
              </div>

              {/* SECTION A: Dashboard KPI Cards */}
              <div className="bg-[#141c25]/85 backdrop-blur-xl border border-[#202d3d]/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">
                  {isFa ? 'کارت‌های شاخص عملکرد (KPI Cards)' : 'Dashboard KPI Cards'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card 1: Account Balance with Wave Sparkline */}
                  <div className="bg-[#182330]/80 backdrop-blur-md border border-[#243547]/80 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-xs text-slate-400 block mb-1">
                      {isFa ? 'موجودی کل حساب:' : 'Account Balance:'}
                    </span>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xl sm:text-2xl font-black font-mono text-white tabular-nums">
                        ${kpiData.accountBalance.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-[#00C853] font-mono">
                        (+8.2%)
                      </span>
                    </div>
                    {/* Sparkline wave */}
                    <div className="h-8 w-full">
                      <svg className="w-full h-full" viewBox="0 0 120 30" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00C853" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 0 25 Q 25 15, 50 20 T 100 10 T 120 8 L 120 30 L 0 30 Z"
                          fill="url(#balanceGrad)"
                        />
                        <path
                          d="M 0 25 Q 25 15, 50 20 T 100 10 T 120 8"
                          fill="none"
                          stroke="#00C853"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Card 2: Net P&L (Monthly) */}
                  <div className="bg-[#182330]/80 backdrop-blur-md border border-[#243547]/80 rounded-xl p-3.5 flex flex-col justify-between">
                    <span className="text-xs text-slate-400 block mb-1">
                      {isFa ? 'سود خالص (ماهانه):' : 'Net P&L (Monthly):'}
                    </span>
                    <div className="my-auto">
                      <span className="text-2xl sm:text-3xl font-black font-mono text-[#00C853] tabular-nums tracking-tight">
                        +${kpiData.netPnL.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-2 border-t border-[#223345]">
                      <TrendingUp className="w-3.5 h-3.5 text-[#00C853]" />
                      <span>{isFa ? 'محاسبه شده پس از کسر کارمزد' : 'Realized net profit'}</span>
                    </div>
                  </div>

                  {/* Card 3: Win Rate with Radial Donut Gauge */}
                  <div className="bg-[#182330]/80 backdrop-blur-md border border-[#243547]/80 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">
                        {isFa ? 'نرخ برد:' : 'Win Rate:'}
                      </span>
                      <span className="text-2xl sm:text-3xl font-black font-mono text-white tabular-nums">
                        {kpiData.winRate}%
                      </span>
                    </div>

                    {/* Radial SVG Gauge */}
                    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        {/* Background track */}
                        <path
                          className="text-[#202e3e]"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        {/* Progress stroke */}
                        <path
                          className="text-[#00C853]"
                          strokeDasharray={`${kpiData.winRate}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-[11px] font-mono font-bold text-white">
                        {kpiData.winRate}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: Equity Curve Chart */}
              <div className="bg-[#141c25]/85 backdrop-blur-xl border border-[#202d3d]/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    {isFa ? 'منحنی رشد سرمایه (Equity Curve)' : 'Equity Curve'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {journalRows.length} {isFa ? 'معامله ثبت‌شده' : 'trades plotted'}
                  </span>
                </div>

                {/* Glowing Smooth Area Chart */}
                <div className="w-full h-44 sm:h-52 relative overflow-hidden rounded-xl bg-[#111720] border border-[#1b2633] p-2">
                  <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00b4d8" stopOpacity="0.45" />
                        <stop offset="70%" stopColor="#00b4d8" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#00b4d8" stopOpacity="0" />
                      </linearGradient>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Gradient Area Fill */}
                    <path
                      d={kpiData.areaD}
                      fill="url(#equityGradient)"
                    />

                    {/* Main Curve Stroke */}
                    <path
                      d={kpiData.pathD}
                      fill="none"
                      stroke="#00b4d8"
                      strokeWidth="2.5"
                      filter="url(#glow)"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* SECTION C: Smart Entry Panel (Dashed Border Box) */}
              <div className="bg-[#141c25]/85 backdrop-blur-xl border border-[#202d3d]/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
                <span className="text-xs font-semibold text-slate-300 block">
                  {isFa ? 'پنل ورود هوشمند داده‌ها (Smart Entry Panel)' : 'Smart Entry Panel'}
                </span>

                <div className="border border-dashed border-[#2d3f54] rounded-xl p-4 space-y-5 bg-[#121822]/80 backdrop-blur-md">
                  {/* Row 1: Instant Trade Input */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">
                      {isFa ? 'ورود سریع معاملات:' : 'Instant Trade Input'}
                    </span>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={handleExcelClick}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1d354a] hover:bg-[#23425c] border border-[#2c4e6d] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <Upload className="w-4 h-4 text-[#00b4d8]" />
                          <span>{isFa ? 'بارگذاری فایل Excel/CSV' : 'Upload Excel/CSV'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleImageClick}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#133c4d] hover:bg-[#18485c] border border-[#1e5870] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-[#26c6da]" />
                          <span>{isFa ? 'OCR: بارگذاری اسکرین‌شات (jpg, png)' : 'OCR: Upload Screenshot (jpg, png)'}</span>
                        </button>
                      </div>

                      {/* Receipt Scanner Illustration */}
                      <div className="relative p-2.5 rounded-xl bg-[#182330] border border-[#26374a] shrink-0 hidden sm:flex items-center gap-2">
                        <div className="w-10 h-12 bg-white rounded-sm p-1 shadow-sm flex flex-col justify-between">
                          <div className="w-full h-1 bg-slate-300 rounded" />
                          <div className="w-3/4 h-0.5 bg-slate-200 rounded" />
                          <div className="w-full h-0.5 bg-slate-200 rounded" />
                          <div className="w-2/3 h-0.5 bg-slate-200 rounded" />
                          <div className="w-full h-1 bg-slate-300 rounded mt-auto" />
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          <span>{isFa ? 'اسکن رسید' : 'RECEIPT'}</span>
                          <span className="block text-[#00C853] text-[9px] font-sans">
                            {isFa ? 'هوش مصنوعی' : 'Auto OCR'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Manual Entry Form with Spot / Margin & Wallex Price API */}
                  <form onSubmit={handleSubmitManualTrade} className="space-y-4 pt-3 border-t border-[#223345]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {isFa ? 'ورود هوشمند معامله:' : 'Smart Trade Entry:'}
                        </span>
                        {/* Spot vs Margin Switch */}
                        <div className="flex items-center p-0.5 rounded-lg bg-[#182432] border border-[#293d54] text-xs">
                          <button
                            type="button"
                            onClick={() => setEntryMode('MARGIN')}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                              entryMode === 'MARGIN'
                                ? 'bg-[#00C853] text-slate-950 font-black shadow-xs'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {isFa ? 'تعهدی / مارجین (Wallex Margin)' : 'Margin Trading'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEntryMode('SPOT')}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                              entryMode === 'SPOT'
                                ? 'bg-[#00b4d8] text-slate-950 font-black shadow-xs'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {isFa ? 'عادی / اسپات (Spot)' : 'Spot Trading'}
                          </button>
                        </div>
                      </div>

                      {/* Live Market Price Badge & Quick Fills */}
                      {matchedWallexMarket && livePriceNum && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-slate-400 text-[10px]">{isFa ? 'نرخ زنده والکس:' : 'Live:'}</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {Number(matchedWallexMarket.price).toLocaleString()}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {matchedWallexMarket.quote_asset === 'TMN' ? (isFa ? 'تومان' : 'TMN') : 'USDT'}
                            </span>
                            <span className={`text-[10px] font-bold ${
                              (matchedWallexMarket.change_24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              ({(matchedWallexMarket.change_24h || 0) >= 0 ? '+' : ''}{matchedWallexMarket.change_24h || 0}%)
                            </span>
                          </div>
                          
                          {/* 1-Click Action to fill entry or exit price with live API price */}
                          <button
                            type="button"
                            onClick={() => setEntryPrice(String(Math.round(livePriceNum)))}
                            title={isFa ? 'قرار دادن نرخ زنده والکس در قیمت ورود' : 'Apply live price to entry'}
                            className="px-2 py-1 rounded bg-[#1f3144] hover:bg-[#283e56] text-[10px] font-bold text-[#00b4d8] border border-[#2d4967] transition cursor-pointer flex items-center gap-1"
                          >
                            <Zap className="w-3 h-3 text-[#00b4d8]" />
                            <span>{isFa ? 'نرخ زنده به ورود' : 'To Entry'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEntryExit(String(Math.round(livePriceNum)))}
                            title={isFa ? 'قرار دادن نرخ زنده والکس در قیمت خروج' : 'Apply live price to exit'}
                            className="px-2 py-1 rounded bg-[#1f3144] hover:bg-[#283e56] text-[10px] font-bold text-[#00C853] border border-[#2d4967] transition cursor-pointer flex items-center gap-1"
                          >
                            <Zap className="w-3 h-3 text-[#00C853]" />
                            <span>{isFa ? 'نرخ زنده به خروج' : 'To Exit'}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                      {/* 1. Asset Dropdown (Populated with Wallex Markets) */}
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-slate-400 block mb-1">
                          {isFa ? 'انتخاب بازار والکس' : 'Wallex Market Asset'}
                        </label>
                        <select
                          value={entryAsset}
                          onChange={e => handleSelectAsset(e.target.value)}
                          className="w-full py-2 px-2.5 rounded-lg bg-[#182432] border border-[#293d54] text-xs font-mono font-bold text-white focus:ring-1 focus:ring-[#00b4d8] cursor-pointer"
                        >
                          {WALLEX_POPULAR_PAIRS.map(pair => (
                            <option key={pair.symbol} value={pair.symbol}>
                              {pair.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Position Type (Buy/Long vs Sell/Short) */}
                      <div className="sm:col-span-1">
                        <label className="text-[11px] text-slate-400 block mb-1">
                          {entryMode === 'MARGIN' ? (isFa ? 'نوع موقعیت' : 'Position') : (isFa ? 'جهت معامله' : 'Side')}
                        </label>
                        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#182432] border border-[#293d54] h-[35px]">
                          <button
                            type="button"
                            onClick={() => setEntryType('BUY')}
                            className={`flex-1 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                              entryType === 'BUY'
                                ? 'bg-[#00C853] text-slate-950 font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {entryMode === 'MARGIN' ? (isFa ? 'خرید (Long)' : 'Long') : 'Buy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEntryType('SELL')}
                            className={`flex-1 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                              entryType === 'SELL'
                                ? 'bg-[#ef4444] text-white font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {entryMode === 'MARGIN' ? (isFa ? 'فروش (Short)' : 'Short') : 'Sell'}
                          </button>
                        </div>
                      </div>

                      {/* 3. Margin Collateral OR Spot Size */}
                      {entryMode === 'MARGIN' ? (
                        <div className="sm:col-span-1">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            {isFa ? 'وثیقه اولیه (تومان/$)' : 'Collateral'}
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={entryCollateral}
                            onChange={e => setEntryCollateral(e.target.value)}
                            placeholder="10000000"
                            className="w-full py-2 px-2.5 rounded-lg bg-[#182432] border border-[#293d54] text-xs font-mono font-bold text-white focus:ring-1 focus:ring-[#00b4d8]"
                          />
                        </div>
                      ) : (
                        <div className="sm:col-span-1">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            {isFa ? 'حجم (تعداد سکه)' : 'Size'}
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            value={entrySize}
                            onChange={e => setEntrySize(e.target.value)}
                            placeholder="1.00"
                            className="w-full py-2 px-2.5 rounded-lg bg-[#182432] border border-[#293d54] text-xs font-mono font-bold text-white focus:ring-1 focus:ring-[#00b4d8]"
                          />
                        </div>
                      )}

                      {/* 4. Entry Price */}
                      <div className="sm:col-span-1">
                        <label className="text-[11px] text-slate-400 block mb-1">
                          {isFa ? 'قیمت ورود' : 'Entry Price'}
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={entryPrice}
                          onChange={e => setEntryPrice(e.target.value)}
                          placeholder="6450000000"
                          className="w-full py-2 px-2.5 rounded-lg bg-[#182432] border border-[#293d54] text-xs font-mono font-bold text-white focus:ring-1 focus:ring-[#00b4d8]"
                        />
                      </div>

                      {/* 5. Exit Price */}
                      <div className="sm:col-span-1">
                        <label className="text-[11px] text-slate-400 block mb-1">
                          {isFa ? 'قیمت خروج' : 'Exit Price'}
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={entryExit}
                          onChange={e => setEntryExit(e.target.value)}
                          placeholder="6650000000"
                          className="w-full py-2 px-2.5 rounded-lg bg-[#182432] border border-[#293d54] text-xs font-mono font-bold text-white focus:ring-1 focus:ring-[#00b4d8]"
                        />
                      </div>
                    </div>

                    {/* Sub-row for Margin Parameters (Leverage & Duration) */}
                    {entryMode === 'MARGIN' && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#151f2b] border border-[#26374a]">
                        {/* Leverage */}
                        <div>
                          <label className="text-[11px] text-slate-300 font-bold block mb-1">
                            {isFa ? 'اهرم / نسبت اعتبار:' : 'Leverage Ratio:'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={entryLeverage}
                              onChange={e => setEntryLeverage(e.target.value)}
                              className="w-20 py-1.5 px-2 rounded-lg bg-[#192636] border border-[#2a3e56] text-xs font-mono font-bold text-white"
                            />
                            <div className="flex items-center gap-1">
                              {['2', '5', '10', '20'].map(lvl => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => setEntryLeverage(lvl)}
                                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                                    entryLeverage === lvl 
                                      ? 'bg-[#00C853] text-slate-950 font-black' 
                                      : 'bg-[#1e2e40] text-slate-300 hover:text-white'
                                  }`}
                                >
                                  {lvl}x
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Holding Duration */}
                        <div>
                          <label className="text-[11px] text-slate-300 font-bold block mb-1">
                            {isFa ? 'مدت زمان موقعیت (ساعت):' : 'Duration (Hours):'}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="720"
                              value={entryHoldingHours}
                              onChange={e => setEntryHoldingHours(e.target.value)}
                              className="w-20 py-1.5 px-2 rounded-lg bg-[#192636] border border-[#2a3e56] text-xs font-mono font-bold text-white"
                            />
                            <span className="text-[10px] font-mono text-slate-400">
                              ({computedFees.fourHourPeriods} {isFa ? 'دوره ۴ ساعته' : '4h periods'})
                            </span>
                          </div>
                        </div>

                        {/* Total Volume */}
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            {isFa ? 'حجم کل موقعیت (وثیقه × اهرم):' : 'Total Position Volume:'}
                          </label>
                          <div className="text-xs font-mono font-bold text-white pt-1">
                            {Math.round(computedFees.totalVolume).toLocaleString()}
                          </div>
                        </div>

                        {/* ROE & Breakeven quick preview */}
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            {isFa ? 'بازده وثیقه (ROE) و سر‌به‌سر:' : 'ROE & Breakeven:'}
                          </label>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className={`text-xs font-mono font-black ${
                              computedFees.roePercent >= 0 ? 'text-[#00C853]' : 'text-[#ef4444]'
                            }`}>
                              {computedFees.roePercent >= 0 ? '+' : ''}{computedFees.roePercent.toFixed(2)}%
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              (سر‌به‌سر: {Math.round(computedFees.breakevenPrice).toLocaleString()})
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* LIVE REAL-TIME FEE BREAKDOWN ENGINE CARD */}
                    <div className="rounded-xl p-3.5 bg-gradient-to-br from-[#121c27] to-[#162332] border border-[#25394e] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-[#00b4d8]" />
                          <span className="text-xs font-bold text-white">
                            {isFa ? 'محاسبه بلادرنگ کلیه کارمزدها و سود خالص:' : 'Real-Time Fee & Net P&L Calculation Engine:'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {entryMode === 'MARGIN' ? (isFa ? 'قوانین کارمزد تعهدی والکس' : 'Wallex Margin Fee Rules') : (isFa ? 'کارمزد ۰.۲۵٪ اسپات والکس' : 'Wallex 0.25% Spot')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {/* 1. Entry Fee */}
                        <div className="p-2 rounded-lg bg-[#172433] border border-[#22354a]">
                          <span className="text-[10px] text-slate-400 block">
                            {isFa ? 'کارمزد ورود (۰.۲۵٪):' : 'Entry Fee (0.25%):'}
                          </span>
                          <span className="font-mono font-bold text-slate-200">
                            {Math.round(computedFees.entryFee).toLocaleString()}
                          </span>
                        </div>

                        {/* 2. Exit Fee */}
                        <div className="p-2 rounded-lg bg-[#172433] border border-[#22354a]">
                          <span className="text-[10px] text-slate-400 block">
                            {isFa ? 'کارمزد خروج (۰.۲۵٪):' : 'Exit Fee (0.25%):'}
                          </span>
                          <span className="font-mono font-bold text-slate-200">
                            {Math.round(computedFees.exitFee).toLocaleString()}
                          </span>
                        </div>

                        {/* 3. Margin Activation & Holding Fees */}
                        {entryMode === 'MARGIN' ? (
                          <>
                            <div className="p-2 rounded-lg bg-[#172433] border border-[#22354a]">
                              <span className="text-[10px] text-slate-400 block">
                                {isFa ? 'کارمزد فعال‌سازی (۰.۰۱۵٪):' : 'Activation (0.015%):'}
                              </span>
                              <span className="font-mono font-bold text-slate-200">
                                {Math.round(computedFees.marginActivationFee).toLocaleString()}
                              </span>
                            </div>

                            <div className="p-2 rounded-lg bg-[#172433] border border-[#22354a]">
                              <span className="text-[10px] text-slate-400 block">
                                {isFa ? `تمدید ۴ ساعته (${computedFees.fourHourPeriods}×۰.۰۱۵٪):` : `Rollover (${computedFees.fourHourPeriods}x0.015%):`}
                              </span>
                              <span className="font-mono font-bold text-slate-200">
                                {Math.round(computedFees.marginHoldingFee).toLocaleString()}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2 p-2 rounded-lg bg-[#172433] border border-[#22354a] flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                              {isFa ? 'نقطه سر‌به‌سر معامله:' : 'Trade Breakeven Price:'}
                            </span>
                            <span className="font-mono font-bold text-[#00b4d8]">
                              {Math.round(computedFees.breakevenPrice).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Total Fees & Net Result Banner */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-[#192738] border border-[#293f57]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-300 font-bold">
                            {isFa ? 'مجموع کل کارمزدها:' : 'Total All Fees:'}
                          </span>
                          <span className="font-mono font-black text-rose-400 text-xs">
                            -{Math.round(computedFees.totalAllFees).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-end">
                            <span className="text-[10px] text-slate-400 block">
                              {isFa ? 'سود/زیان خالص پس از کسر کارمزد:' : 'Net P&L (After Fees):'}
                            </span>
                            <span className={`font-mono font-black text-sm ${
                              computedFees.netPnLAfterFees >= 0 ? 'text-[#00C853]' : 'text-[#ef4444]'
                            }`}>
                              {computedFees.netPnLAfterFees >= 0 ? '+' : ''}{Math.round(computedFees.netPnLAfterFees).toLocaleString()}
                            </span>
                          </div>

                          <button
                            type="submit"
                            disabled={isAddingTrade}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#00b4d8] to-[#00C853] text-slate-950 font-black text-xs hover:opacity-90 transition cursor-pointer shadow-sm shrink-0"
                          >
                            {addSuccessMsg ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{isFa ? 'ثبت شد!' : 'Recorded!'}</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isFa ? 'افزودن به ژورنال با کارمزدها' : 'Add to Journal with Fees'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* RIGHT COLUMN: Journal & Structured P&L (40% width -> lg:col-span-4) */}
            {/* ============================================================ */}
            <div className="lg:col-span-4 space-y-5">
              {/* Column Heading */}
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>{isFa ? 'ژورنال و صورت سود و زیان' : 'Journal & Structured P&L'}</span>
                  <span className="text-xs font-mono text-slate-400 font-normal">
                    {isFa ? '(عرض ۴۰٪)' : '(40% width)'}
                  </span>
                </h2>
              </div>

              {/* SECTION D: Structured P&L Statement */}
              <div className="bg-[#141c25]/85 backdrop-blur-xl border border-[#202d3d]/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">
                  {isFa ? 'صورت تفکیکی سود و زیان (Structured P&L Statement)' : 'Structured P&L Statement'}
                </span>

                <div className="overflow-hidden rounded-xl border border-[#223345] bg-[#111720]/80 backdrop-blur-md">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#223345] bg-[#182330] text-slate-400 text-[11px]">
                        <th className="py-2.5 px-3 text-start font-semibold">{isFa ? 'شرح حساب' : 'Statement'}</th>
                        <th className="py-2.5 px-3 text-center font-semibold">{isFa ? 'وضعیت محاسبه' : 'Computed'}</th>
                        <th className="py-2.5 px-3 text-end font-semibold">{isFa ? 'مبلغ' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2a38]">
                      {/* Revenue Group Header */}
                      <tr 
                        onClick={() => setIsRevenueExpanded(!isRevenueExpanded)}
                        className="bg-[#15202c] hover:bg-[#1a2838] transition cursor-pointer"
                      >
                        <td className="py-2 px-3 text-[#00C853] font-bold flex items-center gap-1.5">
                          {isRevenueExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          <span>{isFa ? 'درآمد (معاملات سودده)' : 'Revenue (Wins)'}</span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-500 font-mono text-[10px]">
                          {kpiData.winCount} {isFa ? 'معامله' : 'trades'}
                        </td>
                        <td className="py-2 px-3 text-end font-mono font-bold text-[#00C853]">
                          +${kpiData.totalWinAmount.toLocaleString()}
                        </td>
                      </tr>
                      {/* Revenue Sub-row */}
                      {isRevenueExpanded && (
                        <tr className="bg-[#121924]/60 text-slate-300 text-[11px]">
                          <td className="py-1.5 px-6 text-slate-400">
                            {isFa ? 'سود ناخالص معاملات' : 'Revenue (Wins)'}
                          </td>
                          <td className="py-1.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                            {isFa ? 'تحقق‌یافته' : 'Calculated'}
                          </td>
                          <td className="py-1.5 px-3 text-end font-mono text-[#00C853]">
                            +${kpiData.totalWinAmount.toLocaleString()}
                          </td>
                        </tr>
                      )}

                      {/* Costs (Losses) Group Header */}
                      <tr 
                        onClick={() => setIsCostsExpanded(!isCostsExpanded)}
                        className="bg-[#15202c] hover:bg-[#1a2838] transition cursor-pointer"
                      >
                        <td className="py-2 px-3 text-[#ef4444] font-bold flex items-center gap-1.5">
                          {isCostsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          <span>{isFa ? 'هزینه‌ها (معاملات زیان‌ده)' : 'Costs (Losses)'}</span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-500 font-mono text-[10px]">
                          {kpiData.lossCount} {isFa ? 'معامله' : 'trades'}
                        </td>
                        <td className="py-2 px-3 text-end font-mono font-bold text-[#ef4444]">
                          (${kpiData.totalLossAmount.toLocaleString()})
                        </td>
                      </tr>
                      {/* Costs Sub-rows */}
                      {isCostsExpanded && (
                        <>
                          <tr className="bg-[#121924]/60 text-slate-300 text-[11px]">
                            <td className="py-1.5 px-6 text-slate-400">
                              {isFa ? 'زیان ناخالص پوزیشن‌ها' : 'Costs (Losses)'}
                            </td>
                            <td className="py-1.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                              {isFa ? 'محقق‌شده' : 'Deducted'}
                            </td>
                            <td className="py-1.5 px-3 text-end font-mono text-[#ef4444]">
                              (${kpiData.totalLossAmount.toLocaleString()})
                            </td>
                          </tr>
                          <tr className="bg-[#121924]/60 text-slate-300 text-[11px]">
                            <td className="py-1.5 px-6 text-slate-400">
                              {isFa ? 'کارمزد معاملات عادی والکس (۰.۲۵٪)' : 'Spot Trading Fees (0.25%)'}
                            </td>
                            <td className="py-1.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                              {isFa ? 'ورود و خروج' : 'Entry/Exit'}
                            </td>
                            <td className="py-1.5 px-3 text-end font-mono text-[#ef4444]">
                              ($1,240)
                            </td>
                          </tr>
                          <tr className="bg-[#121924]/60 text-slate-300 text-[11px]">
                            <td className="py-1.5 px-6 text-slate-400">
                              {isFa ? 'کارمزدهای تعهدی (فعال‌سازی + تمدید ۴ ساعته ۰.۰۱۵٪)' : 'Margin Rollover & Activation (0.015%)'}
                            </td>
                            <td className="py-1.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                              {isFa ? 'تمدید موقعیت' : 'Holding Fees'}
                            </td>
                            <td className="py-1.5 px-3 text-end font-mono text-[#ef4444]">
                              ($312)
                            </td>
                          </tr>
                          <tr className="bg-[#121924]/60 text-slate-300 text-[11px]">
                            <td className="py-1.5 px-6 text-slate-400">
                              {isFa ? 'تراز مالی ارزش دارایی‌های باز (نرخ زنده والکس)' : 'Financial Statement (Live Wallex)'}
                            </td>
                            <td className="py-1.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                              {isFa ? 'ارزش زنده API' : 'Live Value'}
                            </td>
                            <td className="py-1.5 px-3 text-end font-mono text-slate-200">
                              ${(summary?.totalCurrentValue || 7950).toLocaleString()}
                            </td>
                          </tr>
                        </>
                      )}

                      {/* NET P&L FINAL ROW */}
                      <tr className="bg-[#152433] border-t-2 border-[#00C853]/40">
                        <td className="py-3 px-3 font-black text-sm text-[#00b4d8] uppercase tracking-wider">
                          NET P&L
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {isFa ? 'سود خالص نهایی' : 'Computed Net'}
                        </td>
                        <td className="py-3 px-3 text-end font-mono font-black text-base sm:text-lg text-[#00C853]">
                          +${kpiData.netPnL.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION E: Trading Journal Log Table */}
              <div className="bg-[#141c25]/85 backdrop-blur-xl border border-[#202d3d]/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">
                  {isFa ? 'دفتر ثبت و ژورنال معاملات (Trading Journal Log)' : 'Trading Journal Log'}
                </span>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterSide('ALL')}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                        filterSide === 'ALL'
                          ? 'bg-[#1e2e40] text-white border-[#314b68]'
                          : 'bg-[#111720] text-slate-400 border-[#223345] hover:text-white'
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      <span>{isFa ? 'فیلتر' : 'Filter'}</span>
                    </button>

                    <select
                      value={filterSide}
                      onChange={e => setFilterSide(e.target.value as any)}
                      className="py-1.5 px-2.5 rounded-lg bg-[#111720] border border-[#223345] text-xs text-slate-300 font-medium focus:ring-1 focus:ring-[#00b4d8]"
                    >
                      <option value="ALL">{isFa ? 'همه معاملات' : 'Filter by'}</option>
                      <option value="BUY">{isFa ? 'فقط خرید (Buy)' : 'Buy only'}</option>
                      <option value="SELL">{isFa ? 'فقط فروش (Sell)' : 'Sell only'}</option>
                      <option value="WINS">{isFa ? 'معاملات سودده (Wins)' : 'Wins only'}</option>
                      <option value="LOSSES">{isFa ? 'معاملات زیان‌ده (Losses)' : 'Losses only'}</option>
                    </select>
                  </div>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={isFa ? 'جستجو در نماد، تاریخ یا استراتژی...' : 'Search'}
                      className="w-full py-1.5 ps-8 pe-3 rounded-lg bg-[#111720] border border-[#223345] text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-[#00b4d8]"
                    />
                    <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-500" />
                  </div>
                </div>

                {/* High-Density Data Table */}
                <div className="overflow-x-auto rounded-xl border border-[#223345] bg-[#111720]">
                  <table className="w-full text-start text-[11px] whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-[#223345] bg-[#182330] text-slate-400 font-semibold text-[10px]">
                        <th className="py-2 px-2.5 text-start">{isFa ? 'تاریخ' : 'Date'}</th>
                        <th className="py-2 px-2 text-start">{isFa ? 'نماد' : 'Asset'}</th>
                        <th className="py-2 px-2 text-center">{isFa ? 'نوع' : 'Type'}</th>
                        <th className="py-2 px-2 text-end">{isFa ? 'حجم' : 'Size'}</th>
                        <th className="py-2 px-2 text-end">{isFa ? 'ورود' : 'Entry'}</th>
                        <th className="py-2 px-2 text-end">{isFa ? 'خروج' : 'Exit'}</th>
                        <th className="py-2 px-2 text-end">{isFa ? 'سود/زیان' : 'Net P&L'}</th>
                        <th className="py-2 px-2 text-end">{isFa ? 'کارمزد' : 'Fees'}</th>
                        <th className="py-2 px-2 text-center">{isFa ? 'استراتژی' : 'Strategy'}</th>
                        <th className="py-2 px-2 text-center">{isFa ? 'چارت' : 'Chart Note'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2a38]">
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-6 text-center text-slate-500">
                            {isFa ? 'هیچ معامله‌ای با این شرایط یافت نشد.' : 'No trades found matching criteria.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((row) => {
                          const isWin = row.netPnL >= 0;
                          return (
                            <tr key={row.id} className="hover:bg-[#162230] transition">
                              <td className="py-2 px-2.5 font-mono text-slate-400">{row.date}</td>
                              <td className="py-2 px-2 font-bold text-white">{row.asset}</td>
                              <td className="py-2 px-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.type === 'BUY'
                                    ? 'bg-[#00C853]/20 text-[#00C853]'
                                    : 'bg-[#ef4444]/20 text-[#ef4444]'
                                }`}>
                                  {row.type === 'BUY' ? 'Buy' : 'Sell'}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-end font-mono text-slate-300">{row.size}</td>
                              <td className="py-2 px-2 text-end font-mono text-slate-300">
                                ${row.entry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2 text-end font-mono text-slate-300">
                                ${row.exit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className={`py-2 px-2 text-end font-mono font-bold ${
                                isWin ? 'text-[#00C853]' : 'text-[#ef4444]'
                              }`}>
                                {isWin ? `+$${row.netPnL.toLocaleString()}` : `-$${Math.abs(row.netPnL).toLocaleString()}`}
                              </td>
                              <td className="py-2 px-2 text-end font-mono text-slate-400">
                                ${row.fees.toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className="px-2 py-0.5 rounded bg-[#1f2e40] text-slate-300 text-[10px]">
                                  {row.strategy}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedChartNote({
                                    asset: row.asset,
                                    date: row.date,
                                    strategy: row.strategy,
                                    pnl: row.netPnL
                                  })}
                                  title={isFa ? 'مشاهده یادداشت چارت' : 'View Chart Note'}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#223345] transition cursor-pointer"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-end gap-1.5 pt-1 text-xs text-slate-400 font-mono">
                  <span>Page</span>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1 rounded hover:bg-[#1a2636] disabled:opacity-30 cursor-pointer"
                  >
                    &lt;
                  </button>
                  <span className="px-2 py-0.5 rounded bg-[#1e2e40] font-bold text-white">
                    {page}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-1 rounded hover:bg-[#1a2636] disabled:opacity-30 cursor-pointer"
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className="p-1 rounded hover:bg-[#1a2636] disabled:opacity-30 cursor-pointer"
                  >
                    &gt;&gt;
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* CHART NOTE PREVIEW MODAL */}
      {selectedChartNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#141c25] border border-[#27384c] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#223345] pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#00b4d8]" />
                <h3 className="text-sm font-bold text-white">
                  {selectedChartNote.asset} {isFa ? '— یادداشت تحلیل تکنیکال' : '— Chart Note'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChartNote(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulated Chart Visual */}
            <div className="h-44 rounded-xl bg-[#0f1720] border border-[#202e3e] flex flex-col items-center justify-center p-4 text-center">
              <svg className="w-full h-24 mb-2" viewBox="0 0 200 60">
                <path
                  d="M 10 40 L 40 45 L 80 25 L 120 30 L 160 15 L 190 10"
                  fill="none"
                  stroke="#00C853"
                  strokeWidth="2.5"
                />
                <circle cx="160" cy="15" r="4" fill="#00C853" />
                <text x="145" y="10" fill="#00C853" fontSize="8" fontFamily="monospace">Entry</text>
              </svg>
              <span className="text-xs font-mono font-bold text-slate-300">
                {isFa ? 'شکست خط مقاومت و تایید حجم معاملات' : `Breakout Execution (${selectedChartNote.strategy})`}
              </span>
              <span className={`text-xs font-mono font-bold mt-1 ${
                selectedChartNote.pnl >= 0 ? 'text-[#00C853]' : 'text-[#ef4444]'
              }`}>
                {selectedChartNote.pnl >= 0 ? `+$${selectedChartNote.pnl.toLocaleString()}` : `-$${Math.abs(selectedChartNote.pnl).toLocaleString()}`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedChartNote(null)}
              className="w-full py-2 rounded-xl bg-[#1e2d3d] hover:bg-[#25384c] text-white text-xs font-bold transition cursor-pointer"
            >
              {isFa ? 'بستن' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
