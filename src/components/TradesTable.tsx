import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Trash2, 
  Plus, 
  FileSpreadsheet, 
  Calendar,
  X
} from 'lucide-react';
import { TradeRecord, TradeSide, Language } from '../types';
import { translations, formatCurrency, formatNumber } from '../utils/i18n';
import { CurrencyLogo } from './CurrencyLogo';

interface Props {
  trades: TradeRecord[];
  lang: Language;
  onDeleteTrade: (id: string) => void;
  onAddTrade: (trade: Omit<TradeRecord, 'id'>) => void;
  onExportExcel: () => void;
  onToggleSide?: (id: string) => void;
}

export const TradesTable: React.FC<Props> = ({
  trades,
  lang,
  onDeleteTrade,
  onAddTrade,
  onExportExcel,
  onToggleSide,
}) => {
  const t = translations[lang];

  const [searchQuery, setSearchQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modal for adding a manual trade
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState('BTC/USDT');
  const [newSide, setNewSide] = useState<TradeSide>('BUY');
  const [newPrice, setNewPrice] = useState<string>('');
  const [newQty, setNewQty] = useState<string>('');
  const [newFee, setNewFee] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().replace('T', ' ').substring(0, 19));

  // Available unique symbols for filter
  const uniqueSymbols = useMemo(() => {
    const set = new Set<string>();
    trades.forEach(t => set.add(t.symbol));
    return Array.from(set);
  }, [trades]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter(tr => {
      const matchSearch = 
        tr.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tr.orderId && tr.orderId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        tr.date.includes(searchQuery);

      const matchSide = sideFilter === 'ALL' || tr.side === sideFilter;
      const matchSymbol = symbolFilter === 'ALL' || tr.symbol === symbolFilter;

      return matchSearch && matchSide && matchSymbol;
    });
  }, [trades, searchQuery, sideFilter, symbolFilter]);

  // Compute running balance per trade by sorting trades chronologically
  const tradeBalances = useMemo(() => {
    const balances = new Map<string, number>();
    const assetTotals: Record<string, number> = {};
    const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(t => {
      const prev = assetTotals[t.symbol] || 0;
      const next = t.side === 'BUY' ? prev + t.quantity : prev - t.quantity;
      assetTotals[t.symbol] = next;
      balances.set(t.id, Number(next.toFixed(8)));
    });

    return balances;
  }, [trades]);

  const totalPages = Math.ceil(filteredTrades.length / pageSize) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, page]);

  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newPrice);
    const quantity = parseFloat(newQty);
    const fee = parseFloat(newFee) || 0;

    if (!newSymbol || isNaN(price) || price <= 0 || isNaN(quantity) || quantity <= 0) {
      return;
    }

    onAddTrade({
      symbol: newSymbol.trim().toUpperCase(),
      side: newSide,
      price,
      quantity,
      total: price * quantity,
      fee,
      date: newDate || new Date().toISOString().replace('T', ' ').substring(0, 19),
      orderId: `MANUAL-${Math.floor(Math.random() * 10000)}`,
    });

    // Reset and close
    setNewPrice('');
    setNewQty('');
    setNewFee('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{t.tradeHistoryTitle}</span>
              <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                {filteredTrades.length} {lang === 'fa' ? 'ردیف' : 'records'}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="add-manual-trade-btn"
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'افزودن معامله جدید' : 'Add Trade'}</span>
            </button>

            <button
              id="export-trades-btn"
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{t.exportReport}</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 sm:right-auto sm:left-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t.searchPlaceholder}
              className={`w-full py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            />
          </div>

          {/* Side Filter Pills */}
          <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setSideFilter('ALL'); setPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                sideFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.filterAll}
            </button>
            <button
              type="button"
              onClick={() => { setSideFilter('BUY'); setPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                sideFilter === 'BUY'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.filterBuy}
            </button>
            <button
              type="button"
              onClick={() => { setSideFilter('SELL'); setPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                sideFilter === 'SELL'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.filterSell}
            </button>
          </div>

          {/* Symbol Select */}
          {uniqueSymbols.length > 1 && (
            <select
              value={symbolFilter}
              onChange={e => {
                setSymbolFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">{lang === 'fa' ? 'تمام نمادها' : 'All Symbols'}</option>
              {uniqueSymbols.map(sym => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
            </select>
          )}
        </div>

        {/* Quick Side-Aware Volume & Fee Summary Badge */}
        {filteredTrades.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-[11px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{lang === 'fa' ? 'مجموع ورودی (خرید):' : 'Total Inflow (Buy):'}</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  {formatNumber(filteredTrades.filter(t => t.side === 'BUY').reduce((acc, t) => acc + t.quantity, 0), lang)}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  ({filteredTrades.filter(t => t.side === 'BUY').length} {lang === 'fa' ? 'معامله' : 'trades'} | {t.fee}: {formatNumber(filteredTrades.filter(t => t.side === 'BUY').reduce((acc, t) => acc + (t.fee || 0), 0), lang)})
                </span>
              </span>

              <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>{lang === 'fa' ? 'مجموع خروجی (فروش):' : 'Total Outflow (Sell):'}</span>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                  {formatNumber(filteredTrades.filter(t => t.side === 'SELL').reduce((acc, t) => acc + t.quantity, 0), lang)}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  ({filteredTrades.filter(t => t.side === 'SELL').length} {lang === 'fa' ? 'معامله' : 'trades'} | {t.fee}: {formatNumber(filteredTrades.filter(t => t.side === 'SELL').reduce((acc, t) => acc + (t.fee || 0), 0), lang)})
                </span>
              </span>
            </div>

            <div className="text-slate-500 dark:text-slate-400 font-mono">
              <span>{lang === 'fa' ? 'مانده موجودی باز:' : 'Net Open Balance:'} </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(
                  filteredTrades.filter(t => t.side === 'BUY').reduce((acc, t) => acc + t.quantity, 0) -
                  filteredTrades.filter(t => t.side === 'SELL').reduce((acc, t) => acc + t.quantity, 0),
                  lang
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right sm:text-right" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">{t.date}</th>
              <th className="py-3 px-4">{t.symbol}</th>
              <th className="py-3 px-4">{t.type}</th>
              <th className="py-3 px-4">{t.price}</th>
              <th className="py-3 px-4 text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50/40 dark:bg-emerald-950/20">
                {t.buyInflow}
              </th>
              <th className="py-3 px-4 text-rose-700 dark:text-rose-300 font-bold bg-rose-50/40 dark:bg-rose-950/20">
                {t.sellOutflow}
              </th>
              <th className="py-3 px-4 font-bold bg-slate-100/60 dark:bg-slate-800/80">
                {t.runningBalance}
              </th>
              <th className="py-3 px-4">{t.total}</th>
              <th className="py-3 px-4">{t.fee}</th>
              <th className="py-3 px-4 text-center">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {paginatedTrades.length > 0 ? (
              paginatedTrades.map((trade) => {
                const isBuy = trade.side === 'BUY';
                const bal = tradeBalances.get(trade.id);
                return (
                  <tr 
                    key={trade.id} 
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {trade.date}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{trade.symbol}</span>
                        <CurrencyLogo symbolOrCurrency={trade.symbol} lang={lang} size="xs" showLabel={false} />
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onToggleSide && onToggleSide(trade.id)}
                        disabled={!onToggleSide}
                        title={onToggleSide ? (lang === 'fa' ? 'کلیک برای تغییر نوع معامله (خرید/فروش)' : 'Click to toggle Buy/Sell') : undefined}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] transition ${
                          onToggleSide ? 'cursor-pointer hover:opacity-80 active:scale-95' : ''
                        } ${
                          isBuy 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                      >
                        {isBuy ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        <span>{isBuy ? (lang === 'fa' ? 'ورودی (خرید)' : 'BUY') : (lang === 'fa' ? 'خروجی (فروش)' : 'SELL')}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap font-medium">
                      {formatCurrency(trade.price, lang, trade.symbol)}
                    </td>
                    {/* Separate Buy Inflow Column */}
                    <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap bg-emerald-50/20 dark:bg-emerald-950/10">
                      {isBuy ? (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          +{formatNumber(trade.quantity, lang)}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>
                    {/* Separate Sell Outflow Column */}
                    <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap bg-rose-50/20 dark:bg-rose-950/10">
                      {!isBuy ? (
                        <span className="text-rose-700 dark:text-rose-300">
                          -{formatNumber(trade.quantity, lang)}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>
                    {/* Running Balance */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap bg-slate-50/50 dark:bg-slate-800/40">
                      {bal !== undefined ? formatNumber(bal, lang) : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatCurrency(trade.total, lang, trade.symbol)}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{formatCurrency(trade.fee, lang, trade.symbol)}</span>
                        {trade.total > 0 && trade.fee > 0 && (
                          <span 
                            className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                            title={lang === 'fa' ? 'درصد کارمزد از مجموع معامله' : 'Fee % of trade total'}
                          >
                            {((trade.fee / trade.total) * 100).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onDeleteTrade(trade.id)}
                        title={lang === 'fa' ? 'حذف این ردیف' : 'Delete record'}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  {t.noTradesFound}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            {lang === 'fa' 
              ? `صفحه ${page} از ${totalPages}` 
              : `Page ${page} of ${totalPages}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
            >
              {lang === 'fa' ? 'قبلی' : 'Previous'}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition cursor-pointer"
            >
              {lang === 'fa' ? 'بعدی' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Modal for Manual Trade Entry */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div 
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {lang === 'fa' ? 'افزودن معامله جدید' : 'Add New Trade'}
              </h4>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {t.symbol}
                </label>
                <input
                  type="text"
                  required
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value)}
                  placeholder="e.g. BTC/USDT"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    {t.type}
                  </label>
                  <select
                    value={newSide}
                    onChange={e => setNewSide(e.target.value as TradeSide)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="BUY">{lang === 'fa' ? 'خرید (BUY)' : 'BUY'}</option>
                    <option value="SELL">{lang === 'fa' ? 'فروش (SELL)' : 'SELL'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    {t.quantity}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    placeholder="e.g. 0.5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    {t.price}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    placeholder="e.g. 95000"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-600 dark:text-slate-300 font-medium">
                      {t.fee}
                    </label>
                    {parseFloat(newPrice) > 0 && parseFloat(newQty) > 0 && parseFloat(newFee) > 0 && (
                      <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded">
                        {((parseFloat(newFee) / (parseFloat(newPrice) * parseFloat(newQty))) * 100).toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={newFee}
                    onChange={e => setNewFee(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {t.date}
                </label>
                <input
                  type="text"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer"
                >
                  {lang === 'fa' ? 'ثبت معامله' : 'Save Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
