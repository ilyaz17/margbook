'use client';

import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Barcode,
  Layers,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { Code128BarcodeSvg } from './QrAndBarcodeWidgets';
import { useMargBooks } from './MargBooksContext';

type LabelTemplate = 'thermal-38x25' | 'shelf-50x25' | 'a4-24up';

interface PrintQueueRow {
  itemId: number;
  copies: number;
}

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BarcodeStudioPage() {
  const searchParams = useSearchParams();
  const preselectedItemId = Number(searchParams.get('itemId') || 0);

  const { workspace, showToast } = useMargBooks();
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [template, setTemplate] = useState<LabelTemplate>('shelf-50x25');
  const [packDate, setPackDate] = useState('2026-11-26');
  const [showMrpSavings, setShowMrpSavings] = useState(true);

  const [queue, setQueue] = useState<PrintQueueRow[]>(() => {
    if (preselectedItemId && workspace.items.some((i) => i.id === preselectedItemId)) {
      return [{ itemId: preselectedItemId, copies: 6 }];
    }
    return workspace.items.slice(0, 4).map((it) => ({ itemId: it.id, copies: 2 }));
  });

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    workspace.items.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [workspace.items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workspace.items.filter((it) => {
      const catOk = categoryFilter === 'All' || it.category === categoryFilter;
      const qOk =
        !q ||
        it.name.toLowerCase().includes(q) ||
        it.barcode.toLowerCase().includes(q) ||
        it.sku.toLowerCase().includes(q) ||
        it.brand.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [workspace.items, categoryFilter, searchQuery]);

  const addToQueue = (itemId: number, delta = 2) => {
    setQueue((prev) => {
      const existing = prev.find((q) => q.itemId === itemId);
      if (existing) {
        return prev.map((q) =>
          q.itemId === itemId ? { ...q, copies: Math.min(48, q.copies + delta) } : q
        );
      }
      return [...prev, { itemId, copies: Math.max(1, delta) }];
    });
  };

  const updateCopies = (itemId: number, nextCopies: number) => {
    if (nextCopies <= 0) {
      setQueue((prev) => prev.filter((q) => q.itemId !== itemId));
      return;
    }
    setQueue((prev) =>
      prev.map((q) =>
        q.itemId === itemId ? { ...q, copies: Math.min(48, Math.floor(nextCopies)) } : q
      )
    );
  };

  const loadPreset = (mode: 'weighed' | 'low-stock' | 'bestsellers') => {
    if (mode === 'weighed') {
      const weighed = workspace.items.filter((i) => i.isWeighed || i.uqc === 'KG');
      setQueue(weighed.map((i) => ({ itemId: i.id, copies: 2 })));
      showToast(`Loaded ${weighed.length} loose-weight PLU items into print queue.`, 'info');
      return;
    }
    if (mode === 'low-stock') {
      const low = workspace.items.filter((it) => {
        const total = workspace.batches
          .filter((b) => b.itemId === it.id)
          .reduce((s, b) => s + b.qtyOnHand, 0);
        return total <= it.reorderLevel;
      });
      setQueue(
        (low.length > 0 ? low : workspace.items.slice(0, 4)).map((i) => ({
          itemId: i.id,
          copies: 3,
        }))
      );
      showToast('Loaded low-stock shelf restock labels.', 'info');
      return;
    }
    setQueue(workspace.items.slice(0, 6).map((i) => ({ itemId: i.id, copies: 2 })));
    showToast('Loaded top 6 supermarket SKUs into print queue.', 'info');
  };

  const catalogItems = workspace.items;
  const expandedLabels = useMemo(() => {
    const out: Array<{ key: string; item: (typeof catalogItems)[number] }> = [];
    queue.forEach((entry) => {
      const item = catalogItems.find((i) => i.id === entry.itemId);
      if (!item) return;
      for (let c = 0; c < entry.copies; c++) {
        out.push({ key: `${item.id}-${c}`, item });
      }
    });
    return out;
  }, [queue, catalogItems]);

  const totalStickers = expandedLabels.length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Barcode &amp; Shelf-Price Sticker Studio
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Generate genuine Code-128 thermal stickers, shelf-edge MRP offer tags, and A4 24-up sheets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/pos"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Back to POS
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={totalStickers === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print {totalStickers} Labels</span>
          </button>
        </div>
      </div>

      {/* Controls + Print Studio Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Item Picker & Print Queue Controls */}
        <section className="no-print xl:col-span-5 space-y-4">
          {/* Template & Print Settings */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Label Format &amp; Roll Size
              </h2>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {totalStickers} queued
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'thermal-38x25', title: '38×25mm', sub: 'Thermal Roll' },
                  { id: 'shelf-50x25', title: '50×25mm', sub: 'Shelf MRP Tag' },
                  { id: 'a4-24up', title: 'A4 24-Up', sub: 'Laser Sheet' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTemplate(opt.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                    template === opt.id
                      ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold">{opt.title}</div>
                  <div className="text-[11px] opacity-75">{opt.sub}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Pack / Print Date
                </label>
                <input
                  type="date"
                  value={packDate}
                  onChange={(e) => setPackDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 w-full cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMrpSavings}
                    onChange={(e) => setShowMrpSavings(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Show &ldquo;Save ₹&rdquo; Tag</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => loadPreset('bestsellers')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-emerald-600" />
                Top 6 SKUs
              </button>
              <button
                type="button"
                onClick={() => loadPreset('weighed')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 cursor-pointer"
              >
                <Tag className="h-3 w-3 text-emerald-600" />
                Loose-Weight PLUs
              </button>
              <button
                type="button"
                onClick={() => loadPreset('low-stock')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 cursor-pointer"
              >
                <Layers className="h-3 w-3 text-amber-600" />
                Low-Stock Restock
              </button>
              <button
                type="button"
                onClick={() => setQueue([])}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-600 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </button>
            </div>
          </div>

          {/* Active Print Queue */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Active Print Queue ({queue.length} SKUs)
            </h2>
            {queue.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                No items queued. Pick supermarket products below to add barcode labels.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                {queue.map((row) => {
                  const item = workspace.items.find((i) => i.id === row.itemId);
                  if (!item) return null;
                  return (
                    <div
                      key={row.itemId}
                      className="flex items-center justify-between gap-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {item.barcode} · {formatInr(item.saleRate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCopies(row.itemId, row.copies - 1)}
                          aria-label={`Decrease copies for ${item.name}`}
                          className="rounded border border-slate-200 dark:border-slate-700 p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {row.copies}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCopies(row.itemId, row.copies + 1)}
                          aria-label={`Increase copies for ${item.name}`}
                          className="rounded border border-slate-200 dark:border-slate-700 p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCopies(row.itemId, 0)}
                          aria-label={`Remove ${item.name}`}
                          className="ml-1 rounded p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Supermarket Catalog Picker */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item name, barcode, or PLU..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
              {filteredItems.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-2 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {it.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {it.barcode} · MRP ₹{it.mrp} · Rate ₹{it.saleRate}/{it.uqc}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToQueue(it.id, 2)}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    Add +2
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Live Printable Sticker Sheet */}
        <section className="xl:col-span-7">
          <div className="print-sheet rounded-xl border border-slate-200 dark:border-slate-800 bg-white p-5 text-slate-900">
            <div className="no-print flex items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Barcode className="h-4 w-4 text-emerald-700" />
                <span className="font-semibold text-slate-900">
                  Live Print Sheet Preview
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {template === 'thermal-38x25'
                    ? '38×25mm Thermal Roll'
                    : template === 'shelf-50x25'
                      ? '50×25mm Shelf MRP Offer Tag'
                      : 'A4 24-Up Sticker Sheet'}
                </span>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                ISO Code-128B Vector
              </span>
            </div>

            {expandedLabels.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Add supermarket items from the catalog to preview printable barcode stickers.
              </div>
            ) : (
              <div
                className={
                  template === 'thermal-38x25'
                    ? 'grid grid-cols-2 sm:grid-cols-3 gap-3'
                    : template === 'shelf-50x25'
                      ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5'
                      : 'grid grid-cols-2 sm:grid-cols-3 gap-2.5'
                }
              >
                {expandedLabels.map(({ key, item }) => {
                  const mrpSave = Math.max(0, Number((item.mrp - item.saleRate).toFixed(2)));
                  if (template === 'shelf-50x25') {
                    return (
                      <div
                        key={key}
                        className="barcode-label-card rounded-lg border border-slate-300 bg-white p-3 flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold text-emerald-800 truncate">
                              {activeCompany?.name || 'FreshMart Superstore'}
                            </div>
                            <div className="font-display text-sm font-bold text-slate-900 leading-tight line-clamp-2">
                              {item.name}
                            </div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {item.rackLocation} · {item.uqc} · PKD {packDate}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {item.mrp > item.saleRate && (
                              <div className="font-mono text-[11px] text-slate-400 line-through tabular-nums">
                                MRP ₹{item.mrp}
                              </div>
                            )}
                            <div className="font-mono text-xl font-bold text-slate-950 leading-none tabular-nums">
                              ₹{item.saleRate}
                            </div>
                            {showMrpSavings && mrpSave > 0 && (
                              <div className="mt-1 text-[10px] font-bold text-emerald-700 tabular-nums">
                                SAVE ₹{mrpSave}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="pt-1 border-t border-dashed border-slate-200">
                          <Code128BarcodeSvg value={item.barcode} height={36} showText />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={key}
                      className="barcode-label-card rounded border border-slate-300 bg-white p-2.5 flex flex-col justify-between gap-1.5"
                    >
                      <div className="text-center">
                        <div className="text-[9px] font-semibold text-slate-600 truncate">
                          {activeCompany?.name || 'FreshMart Superstore'}
                        </div>
                        <div className="text-[11px] font-bold text-slate-900 truncate">
                          {item.name}
                        </div>
                      </div>
                      <Code128BarcodeSvg
                        value={item.barcode}
                        height={template === 'thermal-38x25' ? 30 : 34}
                        showText
                      />
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-900 pt-1 border-t border-slate-200 tabular-nums">
                        <span className="font-bold">
                          ₹{item.saleRate}/{item.uqc}
                        </span>
                        {item.mrp > item.saleRate ? (
                          <span className="text-slate-500 line-through">MRP ₹{item.mrp}</span>
                        ) : (
                          <span className="text-slate-500">PKD {packDate.slice(5)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
