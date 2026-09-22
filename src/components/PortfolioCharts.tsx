import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PieChart as PieChartIcon, TrendingUp, DollarSign, Layers } from 'lucide-react';
import { AssetAnalysis, TradeRecord, Language } from '../types';
import { translations, formatCurrency, formatNumber, formatPercent, detectCurrency } from '../utils/i18n';

interface Props {
  assets: AssetAnalysis[];
  trades: TradeRecord[];
  lang: Language;
}

// Curated distinctive color palette for portfolio visual assets
const CHART_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#84cc16', // Lime
];

type PieMetric = 'holdings' | 'volume' | 'buyCost';
type TrendMetric = 'volume_fees' | 'buys_sells';

export const PortfolioCharts: React.FC<Props> = ({ assets, trades, lang }) => {
  const t = translations[lang];
  const [pieMetric, setPieMetric] = useState<PieMetric>('holdings');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('volume_fees');
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  const dominantCurrency = useMemo(() => {
    if (!trades || trades.length === 0) return 'TMN';
    let tmnCount = 0;
    trades.forEach(t => {
      if (detectCurrency(t.symbol) === 'TMN') tmnCount++;
    });
    return tmnCount >= trades.length / 2 ? 'TMN' : 'USD';
  }, [trades]);

  // 1. Prepare Portfolio Distribution Pie Data
  const { pieData, totalPieValue, hasOpenHoldings } = useMemo(() => {
    // Check if there are any positive open positions
    const openPositionsValue = assets.reduce((sum, a) => {
      const val = a.netQty > 0.000001 ? a.netQty * (a.currentPrice || a.avgBuyPrice || 0) : 0;
      return sum + val;
    }, 0);

    const hasHoldings = openPositionsValue > 0.01;
    // If user selected holdings but there are no open positions, fall back visually or display
    const effectiveMetric = (pieMetric === 'holdings' && !hasHoldings) ? 'volume' : pieMetric;

    let total = 0;
    const items = assets
      .map((asset, idx) => {
        let value = 0;
        if (effectiveMetric === 'holdings') {
          value = asset.netQty > 0.000001 ? asset.netQty * (asset.currentPrice || asset.avgBuyPrice || 0) : 0;
        } else if (effectiveMetric === 'volume') {
          value = asset.totalBuyCost + asset.totalSellRevenue;
        } else {
          // buyCost
          value = asset.totalBuyCost;
        }

        total += value;
        return {
          name: asset.symbol,
          symbol: asset.symbol,
          value: Math.max(0, value),
          color: CHART_COLORS[idx % CHART_COLORS.length],
          netQty: asset.netQty,
          currentPrice: asset.currentPrice,
          avgBuyPrice: asset.avgBuyPrice,
          roiPercent: asset.roiPercent,
          tradesCount: asset.tradesCount,
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      pieData: items,
      totalPieValue: total,
      hasOpenHoldings: hasHoldings,
    };
  }, [assets, pieMetric]);

  // 2. Prepare Trade History Trend Data
  const trendData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // Sort trades chronologically
    const sorted = [...trades].sort((a, b) => {
      const tA = new Date(a.date).getTime() || 0;
      const tB = new Date(b.date).getTime() || 0;
      return tA - tB;
    });

    // Group by Date string (e.g. YYYY-MM-DD or full date)
    const dateMap = new Map<string, {
      rawDate: string;
      buys: number;
      sells: number;
      fees: number;
      count: number;
    }>();

    sorted.forEach(trade => {
      // Extract date part (first 10 chars: YYYY-MM-DD) or fallback
      let dateKey = trade.date ? trade.date.split(' ')[0] : 'Unknown';
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          rawDate: dateKey,
          buys: 0,
          sells: 0,
          fees: 0,
          count: 0,
        });
      }
      const entry = dateMap.get(dateKey)!;
      entry.count += 1;
      entry.fees += trade.fee || 0;
      if (trade.side === 'BUY') {
        entry.buys += trade.total || (trade.price * trade.quantity);
      } else {
        entry.sells += trade.total || (trade.price * trade.quantity);
      }
    });

    let runningVolume = 0;
    let runningFees = 0;
    let runningBuys = 0;
    let runningSells = 0;

    return Array.from(dateMap.values()).map(item => {
      const dayVolume = item.buys + item.sells;
      runningVolume += dayVolume;
      runningFees += item.fees;
      runningBuys += item.buys;
      runningSells += item.sells;

      return {
        date: item.rawDate,
        displayDate: item.rawDate,
        dayVolume,
        dayBuys: item.buys,
        daySells: item.sells,
        dayFees: item.fees,
        tradesCount: item.count,
        cumulativeVolume: Math.round(runningVolume * 100) / 100,
        cumulativeFees: Math.round(runningFees * 100) / 100,
        cumulativeBuys: Math.round(runningBuys * 100) / 100,
        cumulativeSells: Math.round(runningSells * 100) / 100,
        netCashflow: Math.round((runningSells - runningBuys - runningFees) * 100) / 100,
      };
    });
  }, [trades]);

  // Custom Tooltip for Pie Chart
  const renderPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percent = totalPieValue > 0 ? (item.value / totalPieValue) * 100 : 0;

      return (
        <div 
          className="p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 min-w-[170px]"
          dir={lang === 'fa' ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 font-bold">
            <span className="flex items-center gap-1.5">
              <span 
                className="w-2.5 h-2.5 rounded-full inline-block" 
                style={{ backgroundColor: item.color }} 
              />
              <span className="text-slate-900 dark:text-slate-100">{item.symbol}</span>
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              {percent.toFixed(1)}%
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>{t.total}:</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {formatCurrency(item.value, lang, item.symbol)}
            </span>
          </div>

          {item.netQty > 0 && (
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>{t.netPosition}:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formatNumber(item.netQty, lang)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span>{t.totalTrades}:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {item.tradesCount}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Line Chart
  const renderTrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div 
          className="p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2 min-w-[210px]"
          dir={lang === 'fa' ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 font-bold">
            <span className="text-slate-900 dark:text-slate-100">{label}</span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {dataPoint.tradesCount} {lang === 'fa' ? 'تراکنش' : 'trades'}
            </span>
          </div>

          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span 
                    className="w-2 h-2 rounded-full inline-block" 
                    style={{ backgroundColor: entry.color }} 
                  />
                  <span>{entry.name}:</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(entry.value, lang, dominantCurrency)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
            <span>{t.dailyVolume}:</span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {formatCurrency(dataPoint.dayVolume, lang, dominantCurrency)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section id="portfolio-charts-section" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span>{t.chartsTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.chartsSubtitle}
          </p>
        </div>
      </div>

      {/* Grid: 2 Visual Charts side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. Portfolio Distribution Pie Chart */}
        <div 
          id="chart-portfolio-distribution"
          className="lg:col-span-5 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <PieChartIcon className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.portfolioDistribution}
              </h3>
            </div>

            {/* Metric Switcher */}
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setPieMetric('holdings')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  pieMetric === 'holdings'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.distributionHoldings}
              </button>
              <button
                type="button"
                onClick={() => setPieMetric('volume')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  pieMetric === 'volume'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.distributionVolume}
              </button>
            </div>
          </div>

          {!hasOpenHoldings && pieMetric === 'holdings' && (
            <div className="mb-2 p-2 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
              {t.noOpenPositionsNotice}
            </div>
          )}

          {/* Pie Chart Canvas */}
          <div className="h-[250px] w-full relative my-auto">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={renderPieTooltip} />
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={4}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActivePieIndex(index)}
                      onMouseLeave={() => setActivePieIndex(null)}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.symbol}-${index}`}
                          fill={entry.color}
                          stroke="transparent"
                          className="transition-all duration-200 outline-none"
                          style={{
                            filter: activePieIndex === index ? 'brightness(1.15)' : 'none',
                            transform: activePieIndex === index ? 'scale(1.04)' : 'scale(1)',
                            transformOrigin: 'center center',
                          }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Badge showing Total Value */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {t.totalPortfolioValue}
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalPieValue, lang, dominantCurrency)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {pieData.length} {lang === 'fa' ? 'دارایی' : 'assets'}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {t.noTradesFound}
              </div>
            )}
          </div>

          {/* Asset Chips / Legend */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {pieData.slice(0, 6).map((item) => {
              const percent = totalPieValue > 0 ? (item.value / totalPieValue) * 100 : 0;
              return (
                <div 
                  key={item.symbol} 
                  className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {item.symbol}
                    </span>
                  </div>
                  <span className="font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    {percent.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Trade History Trend Line Chart */}
        <div 
          id="chart-trade-history-trend"
          className="lg:col-span-7 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t.tradeHistoryTrend}
                </h3>
              </div>
            </div>

            {/* Metric Mode Switcher */}
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setTrendMetric('volume_fees')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  trendMetric === 'volume_fees'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.trendMetricVolume}
              </button>
              <button
                type="button"
                onClick={() => setTrendMetric('buys_sells')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  trendMetric === 'buys_sells'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.trendMetricCashflow}
              </button>
            </div>
          </div>

          {/* Line Chart Canvas */}
          <div className="h-[250px] w-full mt-2">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={trendData} 
                  margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    stroke="#88888825"
                  />
                  <XAxis 
                    dataKey="displayDate" 
                    tickLine={false}
                    axisLine={{ stroke: '#88888830' }}
                    tick={{ fontSize: 10, fill: '#888888' }}
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#888888' }}
                    tickFormatter={(val) => {
                      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return val;
                    }}
                    width={40}
                  />
                  <Tooltip content={renderTrendTooltip} />
                  <Legend 
                    verticalAlign="top"
                    height={30}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '2px' }}
                  />

                  {trendMetric === 'volume_fees' ? (
                    <>
                      <Line
                        name={t.cumulativeVolume}
                        type="monotone"
                        dataKey="cumulativeVolume"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                      <Line
                        name={t.cumulativeFees}
                        type="monotone"
                        dataKey="cumulativeFees"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 2, fill: '#f59e0b', strokeWidth: 0 }}
                        activeDot={{ r: 5, stroke: '#f59e0b', strokeWidth: 2 }}
                      />
                    </>
                  ) : (
                    <>
                      <Line
                        name={t.cumulativeBuys}
                        type="monotone"
                        dataKey="cumulativeBuys"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                        activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                      />
                      <Line
                        name={t.cumulativeSells}
                        type="monotone"
                        dataKey="cumulativeSells"
                        stroke="#ec4899"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#ec4899', strokeWidth: 0 }}
                        activeDot={{ r: 6, stroke: '#ec4899', strokeWidth: 2 }}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {t.noTradesFound}
              </div>
            )}
          </div>

          {/* Quick Summary Highlights beneath Trend Chart */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{t.totalTradesRecorded}:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {trades.length}
              </span>
            </div>
            {trendData.length > 0 && (
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span>{trendData[0].date}</span>
                <span>→</span>
                <span>{trendData[trendData.length - 1].date}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
