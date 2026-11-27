'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, BellRing, Plus } from 'lucide-react';
import { classifyExpiryStatus } from '../lib/erp-engine';
import type { VoucherType } from '../types/erp';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function StockInventoryModule() {
  const { workspace, dispatchAction } = useMargBooks();
  const [subTab, setSubTab] = useState<'batches' | 'alerts' | 'movements'>('batches');
  const [godownFilter, setGodownFilter] = useState('All');

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Stock & Inventory Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Multi-Godown Tracking · Batch, Serial & Expiry Control · Dump Alerts · Auto-Reorder · Transfers
          </p>
        </div>
        <Link
          href="/admin/inventory/movements/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Transfer / Adjust / Dump Stock</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
          {[
            { id: 'batches', label: `Batch & Serial Register (${enrichedBatches.length})` },
            { id: 'alerts', label: `Expiry & Auto-Reorder (${alertBatches.length + reorderItems.length})` },
            { id: 'movements', label: `Transfers & Adjustments (${workspace.stockMovements.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                subTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
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
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
        >
          {godowns.map((g) => (
            <option key={g} value={g}>
              {g === 'All' ? 'All Godowns & Branches' : g}
            </option>
          ))}
        </select>
      </div>

      {subTab === 'batches' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Item / Rack</th>
                <th className="py-3 px-3">Godown / Store</th>
                <th className="py-3 px-3">Batch · Serial</th>
                <th className="py-3 px-3">Expiry & Health</th>
                <th className="py-3 px-3 text-right">Qty On Hand</th>
                <th className="py-3 px-4 text-right">Stock Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrichedBatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{b.itemName}</div>
                    <div className="text-xs font-mono text-slate-500">
                      {b.sku} · Rack {b.rack}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700">{b.godownName}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-700">
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
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-800">
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
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Expired & Near-Expiry Dump Queue ({alertBatches.length})
            </h2>
            <div className="mt-3 divide-y divide-slate-100">
              {alertBatches.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{b.itemName}</div>
                    <div className="text-xs font-mono text-slate-500">
                      Batch {b.batchNo} · {b.godownName} · Exp {b.expiryDate} · {b.qtyOnHand} {b.uqc}
                    </div>
                  </div>
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
                    className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 whitespace-nowrap shrink-0"
                  >
                    Write Off Dump
                  </button>
                </div>
              ))}
              {alertBatches.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">
                  All active stock batches are beyond the {workspace.controlRoom.nearExpiryAlertDays}-day expiry threshold.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Auto-Reorder Trigger List ({reorderItems.length})
            </h2>
            <div className="mt-3 divide-y divide-slate-100">
              {reorderItems.map((it) => (
                <div key={it.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{it.name}</div>
                    <div className="text-xs font-mono text-slate-500">
                      On Hand: {it.onHand} · Reorder Level: {it.reorderLevel} {it.uqc}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleAutoReorderPo(it)}
                    className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                  >
                    Raise PO (+{it.suggestedPoQty})
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {subTab === 'movements' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Date · Type</th>
                <th className="py-3 px-3">Item / Batch</th>
                <th className="py-3 px-3">From → To Godown</th>
                <th className="py-3 px-3 text-right">Qty Delta</th>
                <th className="py-3 px-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.stockMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-xs text-slate-700">
                    {m.movementDate} · {m.movementType}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-900">{m.itemName}</div>
                    <div className="text-xs font-mono text-slate-500">Batch {m.batchNo}</div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700">
                    {m.fromGodown} → {m.toGodown}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums">
                    {m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">{m.reason}</td>
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Accounting Transactions & Outstandings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Double-Entry Vouchers (Receipt, Payment, Contra, Journal, Debit/Credit Notes) · Bill-by-Bill Reminders
          </p>
        </div>
        <Link
          href="/admin/accounting/vouchers/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Post Double-Entry Voucher</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('vouchers')}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              subTab === 'vouchers'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Voucher Register ({workspace.vouchers.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('outstanding')}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              subTab === 'outstanding'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
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
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
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
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Voucher No · Type</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Debit Ledger (Dr)</th>
                <th className="py-3 px-3">Credit Ledger (Cr)</th>
                <th className="py-3 px-3">Mode / Ref</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVouchers.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="font-mono text-xs font-semibold text-slate-900">
                      {v.voucherNo}
                    </div>
                    <div className="text-xs text-slate-500">{v.voucherType}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600">
                    {v.voucherDate}
                  </td>
                  <td className="py-3 px-3 text-xs font-medium text-slate-800">
                    {v.debitLedgerName}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700">
                    {v.creditLedgerName}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    <div>{v.paymentMode}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                      {v.referenceInvoiceNo ? `Ref ${v.referenceInvoiceNo} · ` : ''}
                      {v.narration}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                    {formatInr(v.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Party Account</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3 text-right">Credit Limit</th>
                <th className="py-3 px-3 text-right">Outstanding Balance</th>
                <th className="py-3 px-4 text-right">Payment Reminder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {outstandingLedgers.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/ledgers/${l.id}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {l.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {l.phone || 'N/A'} {l.email ? `· ${l.email}` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700">
                    {l.groupType === 'Customer' ? 'Receivable (Dr)' : 'Payable (Cr)'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-600">
                    {formatInr(l.creditLimit)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
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
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-600 hover:text-teal-800 whitespace-nowrap"
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
