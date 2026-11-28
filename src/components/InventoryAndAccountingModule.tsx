'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, BellRing, Plus, Trash2 } from 'lucide-react';
import {
  classifyExpiryStatus,
  computeWastageSummary,
  round2,
} from '../lib/erp-engine';
import type {
  VoucherType,
  WastageDisposalMethod,
  WastageReason,
} from '../types/erp';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function StockInventoryModule() {
  const { workspace, dispatchAction, broadcastOpsEvent, syncing } = useMargBooks();
  const wastageEnabled = workspace.controlRoom.enabledAddons?.wastage_tracking !== false;
  const [subTab, setSubTab] = useState<'batches' | 'alerts' | 'wastage' | 'movements'>('batches');
  const [godownFilter, setGodownFilter] = useState('All');

  // Wastage & Shrinkage Write-Off Form State
  const [wastageItemId, setWastageItemId] = useState<string>(
    String(workspace.items.find((i) => i.isWeighed)?.id || workspace.items[0]?.id || '')
  );
  const [wastageBatchId, setWastageBatchId] = useState<string>('');
  const [wastageQty, setWastageQty] = useState<string>('1.00');
  const [wastageReason, setWastageReason] = useState<WastageReason>('PRODUCE_SPOILAGE');
  const [wastageDisposal, setWastageDisposal] =
    useState<WastageDisposalMethod>('COMPOST_DISCARD');
  const [wastageNotes, setWastageNotes] = useState<string>('');
  const [wastageFilterReason, setWastageFilterReason] = useState<'ALL' | WastageReason>('ALL');

  const today = '2026-11-26';

  const godowns = useMemo(() => {
    const set = new Set<string>(['All', 'Main Store', 'Backroom Godown', 'Cold Chain Unit']);
    workspace.batches.forEach((b) => set.add(b.godownName));
    return Array.from(set);
  }, [workspace.batches]);

  const enrichedBatches = useMemo(() => {
    return workspace.batches
      .map((b) => {
        const item = workspace.items.find((i) => i.id === b.itemId);
        const exp = classifyExpiryStatus(
          b.expiryDate,
          today,
          workspace.controlRoom.nearExpiryAlertDays
        );
        return {
          ...b,
          itemName: item?.name || 'Unknown SKU',
          sku: item?.sku || '',
          rack: item?.rackLocation || '-',
          uqc: item?.uqc || 'PCS',
          stockValue: b.qtyOnHand * b.costRate,
          ...exp,
        };
      })
      .filter((b) => godownFilter === 'All' || b.godownName === godownFilter);
  }, [workspace.batches, workspace.items, godownFilter, workspace.controlRoom.nearExpiryAlertDays]);

  const alertBatches = useMemo(
    () => enrichedBatches.filter((b) => b.status !== 'HEALTHY' && b.qtyOnHand > 0),
    [enrichedBatches]
  );

  const reorderItems = useMemo(() => {
    return workspace.items
      .map((item) => {
        const onHand = workspace.batches
          .filter((b) => b.itemId === item.id)
          .reduce((s, b) => s + b.qtyOnHand, 0);
        return { ...item, onHand, suggestedPoQty: Math.max(20, item.reorderLevel * 2 - onHand) };
      })
      .filter((i) => i.onHand <= i.reorderLevel);
  }, [workspace.items, workspace.batches]);

  const handleAutoReorderPo = async (item: (typeof reorderItems)[number]) => {
    const sup = workspace.ledgers.find((l) => l.groupType === 'Supplier');
    const subtotal = item.suggestedPoQty * item.purchaseRate;
    const tax = (subtotal * item.taxSlab) / 100;
    await dispatchAction(
      'CREATE_PURCHASE',
      {
        billNo: `PO-AUTO-0${workspace.purchases.length + 320}`,
        docType: 'PURCHASE_ORDER',
        ledgerId: sup?.id || null,
        supplierName: sup?.name || 'Hindustan FMCG Supply Co.',
        supplierGstin: sup?.gstin || '',
        billDate: today,
        subtotal,
        taxAmount: tax,
        grandTotal: subtotal + tax,
        items: [
          {
            itemName: item.name,
            barcode: item.barcode,
            hsnCode: item.hsnCode,
            batchNo: 'NEW-PO',
            expiryDate: '2028-06-30',
            qty: item.suggestedPoQty,
            rate: item.purchaseRate,
            taxSlab: item.taxSlab,
            lineTotal: subtotal + tax,
          },
        ],
        importSource: 'Manual',
        status: 'Draft',
      },
      `Auto-reorder Purchase Order raised for ${item.suggestedPoQty} ${item.uqc} of ${item.name}.`
    );
  };

  const wastageSummary = useMemo(
    () =>
      computeWastageSummary({
        wastageLogs: workspace.wastageLogs,
        invoices: workspace.invoices,
        asOfDate: today,
      }),
    [workspace.wastageLogs, workspace.invoices]
  );

  const selectedWastageItem = useMemo(
    () =>
      workspace.items.find((i) => i.id === Number(wastageItemId)) || workspace.items[0],
    [workspace.items, wastageItemId]
  );

  const wastageItemBatches = useMemo(() => {
    if (!selectedWastageItem) return [];
    return workspace.batches.filter((b) => b.itemId === selectedWastageItem.id);
  }, [workspace.batches, selectedWastageItem]);

  const activeWastageBatch = useMemo(() => {
    if (wastageBatchId) {
      const match = wastageItemBatches.find((b) => b.id === Number(wastageBatchId));
      if (match) return match;
    }
    return wastageItemBatches.find((b) => b.qtyOnHand > 0) || wastageItemBatches[0] || null;
  }, [wastageBatchId, wastageItemBatches]);

  const wastageUnitCost = activeWastageBatch?.costRate ?? selectedWastageItem?.purchaseRate ?? 0;
  const previewWastageLoss = round2(Math.max(0, Number(wastageQty || 0)) * wastageUnitCost);

  const filteredWastageLogs = useMemo(() => {
    if (wastageFilterReason === 'ALL') return workspace.wastageLogs;
    return workspace.wastageLogs.filter((w) => w.reason === wastageFilterReason);
  }, [workspace.wastageLogs, wastageFilterReason]);

  const handleLogWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWastageItem) return;
    const qtyNum = Number(wastageQty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return;

    const ok = await dispatchAction(
      'LOG_WASTAGE',
      {
        wastageDate: today,
        itemId: selectedWastageItem.id,
        itemName: selectedWastageItem.name,
        sku: selectedWastageItem.sku,
        category: selectedWastageItem.category,
        batchId: activeWastageBatch?.id ?? null,
        batchNo: activeWastageBatch?.batchNo || 'FLOOR',
        godownName: activeWastageBatch?.godownName || 'Main Store',
        uqc: selectedWastageItem.uqc,
        qty: qtyNum,
        unitCost: wastageUnitCost,
        reason: wastageReason,
        disposalMethod: wastageDisposal,
        notes: wastageNotes.trim(),
      },
      `Logged ${qtyNum} ${selectedWastageItem.uqc} wastage for ${selectedWastageItem.name} (${formatInr(previewWastageLoss)} loss).`
    );

    if (ok) {
      broadcastOpsEvent({
        eventType: 'WASTAGE_ALERT',
        title: `Wastage Write-Off · ${selectedWastageItem.name}`,
        detail: `${qtyNum} ${selectedWastageItem.uqc} (${wastageReason.replace('_', ' ')}) · Cost Loss ${formatInr(previewWastageLoss)}`,
        severity: previewWastageLoss >= 500 ? 'alert' : 'warning',
      });
      setWastageNotes('');
      setWastageQty('1.00');
    }
  };

  const handlePrefillExpiryWastage = (b: (typeof alertBatches)[number]) => {
    setWastageItemId(String(b.itemId));
    setWastageBatchId(String(b.id));
    setWastageQty(String(b.qtyOnHand));
    setWastageReason(b.status === 'EXPIRED' ? 'DAIRY_EXPIRY' : 'PRODUCE_SPOILAGE');
    setWastageDisposal('COMPOST_DISCARD');
    setWastageNotes(`Batch ${b.batchNo} expiry write-off (Exp ${b.expiryDate})`);
    setSubTab('wastage');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Stock & Inventory Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Multi-Godown Tracking · Batch, Serial & Expiry Control · Dump Alerts · Auto-Reorder · Transfers
          </p>
        </div>
        <Link
          href="/admin/inventory/movements/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap"
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Transfer / Adjust / Dump Stock</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-900 p-1">
          {[
            { id: 'batches', label: `Batch & Serial Register (${enrichedBatches.length})` },
            { id: 'alerts', label: `Expiry & Auto-Reorder (${alertBatches.length + reorderItems.length})` },
            ...(wastageEnabled
              ? [{ id: 'wastage', label: `Wastage & Shrinkage (${workspace.wastageLogs.length})` }]
              : []),
            { id: 'movements', label: `Transfers & Adjustments (${workspace.stockMovements.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                subTab === t.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter by Godown or Branch"
          value={godownFilter}
          onChange={(e) => setGodownFilter(e.target.value)}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300"
        >
          {godowns.map((g) => (
            <option key={g} value={g}>
              {g === 'All' ? 'All Godowns & Branches' : g}
            </option>
          ))}
        </select>
      </div>

      {subTab === 'batches' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Item / Rack</th>
                <th className="py-3 px-3">Godown / Store</th>
                <th className="py-3 px-3">Batch · Serial</th>
                <th className="py-3 px-3">Expiry & Health</th>
                <th className="py-3 px-3 text-right">Qty On Hand</th>
                <th className="py-3 px-4 text-right">Stock Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {enrichedBatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{b.itemName}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {b.sku} · Rack {b.rack}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">{b.godownName}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {b.batchNo}
                    {b.serialNo ? ` · ${b.serialNo}` : ''}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs tabular-nums">
                    <span
                      className={
                        b.status === 'EXPIRED'
                          ? 'text-red-700 font-semibold'
                          : b.status === 'NEAR_EXPIRY'
                            ? 'text-amber-700 font-semibold'
                            : 'text-emerald-700'
                      }
                    >
                      {b.expiryDate} ·{' '}
                      {b.status === 'EXPIRED'
                        ? 'Expired'
                        : b.status === 'NEAR_EXPIRY'
                          ? `${b.daysRemaining}d left`
                          : 'Healthy'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums">
                    {b.qtyOnHand} {b.uqc}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                    {formatInr(b.stockValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {subTab === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
              Expired & Near-Expiry Dump Queue ({alertBatches.length})
            </h2>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {alertBatches.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{b.itemName}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Batch {b.batchNo} · {b.godownName} · Exp {b.expiryDate} · {b.qtyOnHand} {b.uqc}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {wastageEnabled && (
                      <button
                        type="button"
                        onClick={() => handlePrefillExpiryWastage(b)}
                        className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 whitespace-nowrap cursor-pointer"
                      >
                        Log Wastage
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void dispatchAction(
                          'STOCK_MOVEMENT',
                          {
                            movementType: 'DUMP',
                            batchId: b.id,
                            itemName: b.itemName,
                            batchNo: b.batchNo,
                            fromGodown: b.godownName,
                            toGodown: 'Expired Dump',
                            qtyDelta: -b.qtyOnHand,
                            reason: 'Written off via Expiry Dump Alert',
                            movementDate: today,
                          },
                          `Batch ${b.batchNo} moved to expired dump.`
                        )
                      }
                      className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-2.5 py-1.5 text-xs font-medium text-red-800 dark:text-red-200 hover:bg-red-100 whitespace-nowrap cursor-pointer"
                    >
                      Write Off Dump
                    </button>
                  </div>
                </div>
              ))}
              {alertBatches.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  All active stock batches are beyond the {workspace.controlRoom.nearExpiryAlertDays}-day expiry threshold.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
              Auto-Reorder Trigger List ({reorderItems.length})
            </h2>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {reorderItems.map((it) => (
                <div key={it.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{it.name}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      On Hand: {it.onHand} · Reorder Level: {it.reorderLevel} {it.uqc}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAutoReorderPo(it)}
                    className="rounded-md bg-emerald-700 dark:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0"
                  >
                    Raise PO (+{it.suggestedPoQty})
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {subTab === 'wastage' && wastageEnabled && (
        <div className="space-y-5">
          {/* Wastage KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Wastage Loss</div>
              <div className="mt-1 font-mono text-xl font-bold text-red-700 dark:text-red-400 tabular-nums">
                {formatInr(wastageSummary.totalLossAllTime)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {workspace.wastageLogs.length} write-off entries posted
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Today&apos;s Wastage Loss</div>
              <div className="mt-1 font-mono text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {formatInr(wastageSummary.todayLoss)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Date {today}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Wastage % of Sales</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {wastageSummary.wastagePercentOfSales}%
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Target benchmark &lt; 1.5%
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Qty Written Off</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {wastageSummary.totalQtyWrittenOff}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Top cause: {wastageSummary.topReason.replace('_', ' ')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Inline Record Wastage / Shrinkage Write-Off Form */}
            <form
              onSubmit={(e) => void handleLogWastage(e)}
              className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Record Perishable / Store Wastage Write-Off
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Auto-deducts batch inventory, records WASTAGE_OUT movement &amp; posts loss journal entry.
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Est. Cost Loss</div>
                  <div className="text-sm font-bold text-red-700 dark:text-red-400">
                    {formatInr(previewWastageLoss)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Supermarket Item
                  </label>
                  <select
                    value={selectedWastageItem?.id || ''}
                    onChange={(e) => {
                      setWastageItemId(e.target.value);
                      setWastageBatchId('');
                    }}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {workspace.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.uqc} · Cost ₹{it.purchaseRate})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Batch / Lot
                  </label>
                  <select
                    value={activeWastageBatch?.id || ''}
                    onChange={(e) => setWastageBatchId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                  >
                    {wastageItemBatches.length === 0 ? (
                      <option value="">Floor Stock (No batch)</option>
                    ) : (
                      wastageItemBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNo} · {b.qtyOnHand} {selectedWastageItem?.uqc} · Exp {b.expiryDate}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Quantity ({selectedWastageItem?.uqc || 'KG'})
                  </label>
                  <input
                    type="number"
                    step={selectedWastageItem?.isWeighed || selectedWastageItem?.uqc === 'KG' ? '0.05' : '1'}
                    min="0.05"
                    required
                    value={wastageQty}
                    onChange={(e) => setWastageQty(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Wastage Reason
                  </label>
                  <select
                    value={wastageReason}
                    onChange={(e) => setWastageReason(e.target.value as WastageReason)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="PRODUCE_SPOILAGE">Fresh Produce Spoilage</option>
                    <option value="BAKERY_UNSOLD">Bakery Day-End Unsold</option>
                    <option value="DAIRY_EXPIRY">Dairy / Chilled Expiry</option>
                    <option value="HANDLING_BREAKAGE">Floor Handling Breakage</option>
                    <option value="SHRINKAGE_PILFERAGE">Shrinkage / Unexplained Loss</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Disposal Action
                  </label>
                  <select
                    value={wastageDisposal}
                    onChange={(e) => setWastageDisposal(e.target.value as WastageDisposalMethod)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="COMPOST_DISCARD">Compost / Safe Discard</option>
                    <option value="MARKDOWN_CLEARANCE">Markdown Clearance Bin</option>
                    <option value="STAFF_WELFARE">Staff Welfare / Donation</option>
                    <option value="SUPPLIER_CLAIM">Move to Supplier Claim</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Remarks / Shelf Note
                  </label>
                  <input
                    type="text"
                    value={wastageNotes}
                    onChange={(e) => setWastageNotes(e.target.value)}
                    placeholder="e.g. Bruised crates during morning unload"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{syncing ? 'Posting Write-Off...' : 'Post Wastage Write-Off'}</span>
                </button>
              </div>
            </form>

            {/* Loss Breakdown by Reason */}
            <section className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Loss Breakdown by Wastage Reason
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pinpoint highest perishable leakage categories
                </p>
              </div>
              <div className="space-y-3">
                {wastageSummary.byReason.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No wastage entries recorded yet.
                  </p>
                ) : (
                  wastageSummary.byReason.map((row) => {
                    const pct =
                      wastageSummary.totalLossAllTime > 0
                        ? Math.round((row.totalLoss / wastageSummary.totalLossAllTime) * 100)
                        : 0;
                    return (
                      <div key={row.reason} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {row.reason.replace('_', ' ')} ({row.count})
                          </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatInr(row.totalLoss)} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-600 dark:bg-amber-500"
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Filterable Wastage Log Table */}
          <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Wastage &amp; Shrinkage Audit Register ({filteredWastageLogs.length})
              </h2>
              <select
                aria-label="Filter wastage reason"
                value={wastageFilterReason}
                onChange={(e) =>
                  setWastageFilterReason(e.target.value as 'ALL' | WastageReason)
                }
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">All Reasons</option>
                <option value="PRODUCE_SPOILAGE">Fresh Produce Spoilage</option>
                <option value="BAKERY_UNSOLD">Bakery Unsold</option>
                <option value="DAIRY_EXPIRY">Dairy Expiry</option>
                <option value="HANDLING_BREAKAGE">Handling Breakage</option>
                <option value="SHRINKAGE_PILFERAGE">Shrinkage / Pilferage</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-4">Ref · Date</th>
                    <th className="py-3 px-3">Item · Batch</th>
                    <th className="py-3 px-3">Reason &amp; Disposal</th>
                    <th className="py-3 px-3 text-right">Qty</th>
                    <th className="py-3 px-4 text-right">Cost Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredWastageLogs.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {w.wastageNo}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">{w.wastageDate}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {w.itemName}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {w.batchNo} · {w.godownName}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {w.reason.replace('_', ' ')}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {w.disposalMethod.replace('_', ' ')}
                          {w.notes ? ` · ${w.notes}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                        {w.qty} {w.uqc}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-red-700 dark:text-red-400">
                        {formatInr(w.totalLoss)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {subTab === 'movements' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Date · Type</th>
                <th className="py-3 px-3">Item / Batch</th>
                <th className="py-3 px-3">From → To Godown</th>
                <th className="py-3 px-3 text-right">Qty Delta</th>
                <th className="py-3 px-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {workspace.stockMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {m.movementDate} · {m.movementType}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{m.itemName}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">Batch {m.batchNo}</div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">
                    {m.fromGodown} → {m.toGodown}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums">
                    {m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export function AccountingModule() {
  const { workspace, showToast } = useMargBooks();
  const [subTab, setSubTab] = useState<'vouchers' | 'outstanding'>('vouchers');
  const [voucherFilter, setVoucherFilter] = useState<'ALL' | VoucherType>('ALL');

  const filteredVouchers = useMemo(() => {
    if (voucherFilter === 'ALL') return workspace.vouchers;
    return workspace.vouchers.filter((v) => v.voucherType === voucherFilter);
  }, [workspace.vouchers, voucherFilter]);

  const outstandingLedgers = useMemo(
    () =>
      workspace.ledgers.filter(
        (l) =>
          (l.groupType === 'Customer' || l.groupType === 'Supplier') &&
          l.currentBalance > 0
      ),
    [workspace.ledgers]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Accounting Transactions & Outstandings
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Double-Entry Vouchers (Receipt, Payment, Contra, Journal, Debit/Credit Notes) · Bill-by-Bill Reminders
          </p>
        </div>
        <Link
          href="/admin/accounting/vouchers/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Post Double-Entry Voucher</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setSubTab('vouchers')}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              subTab === 'vouchers'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-100'
            }`}
          >
            Voucher Register ({workspace.vouchers.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('outstanding')}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              subTab === 'outstanding'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-100'
            }`}
          >
            Bill-by-Bill Outstanding & Reminders ({outstandingLedgers.length})
          </button>
        </div>

        {subTab === 'vouchers' && (
          <select
            aria-label="Filter voucher type"
            value={voucherFilter}
            onChange={(e) => setVoucherFilter(e.target.value as typeof voucherFilter)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Voucher Types</option>
            <option value="Receipt">Receipt</option>
            <option value="Payment">Payment</option>
            <option value="Contra">Contra</option>
            <option value="Journal">Journal</option>
            <option value="Debit Note">Debit Note</option>
            <option value="Credit Note">Credit Note</option>
          </select>
        )}
      </div>

      {subTab === 'vouchers' ? (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Voucher No · Type</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Debit Ledger (Dr)</th>
                <th className="py-3 px-3">Credit Ledger (Cr)</th>
                <th className="py-3 px-3">Mode / Ref</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVouchers.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {v.voucherNo}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{v.voucherType}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {v.voucherDate}
                  </td>
                  <td className="py-3 px-3 text-xs font-medium text-slate-800 dark:text-slate-200">
                    {v.debitLedgerName}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">
                    {v.creditLedgerName}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400">
                    <div>{v.paymentMode}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                      {v.referenceInvoiceNo ? `Ref ${v.referenceInvoiceNo} · ` : ''}
                      {v.narration}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatInr(v.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Party Account</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3 text-right">Credit Limit</th>
                <th className="py-3 px-3 text-right">Outstanding Balance</th>
                <th className="py-3 px-4 text-right">Payment Reminder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {outstandingLedgers.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/ledgers/${l.id}`}
                      className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      {l.name}
                    </Link>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {l.phone || 'N/A'} {l.email ? `· ${l.email}` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">
                    {l.groupType === 'Customer' ? 'Receivable (Dr)' : 'Payable (Cr)'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                    {formatInr(l.creditLimit)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatInr(l.currentBalance)} {l.balanceType}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        showToast(
                          `Payment reminder sent via WhatsApp & Email to ${l.name} (${formatInr(l.currentBalance)}).`,
                          'info'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-600 dark:border-emerald-500 hover:text-emerald-700 dark:text-emerald-400 whitespace-nowrap"
                    >
                      <BellRing className="h-3.5 w-3.5" />
                      <span>WhatsApp / SMS Remind</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
