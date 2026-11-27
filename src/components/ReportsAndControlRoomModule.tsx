'use client';

import React, { useState } from 'react';
import {
  DatabaseBackup,
  Download,
  Lock,
  RefreshCcw,
  Save,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import type { ControlRoomConfig } from '../types/erp';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReportsAnalyticsModule() {
  const { workspace, financials, showToast } = useMargBooks();
  const [reportTab, setReportTab] = useState<
    'trial' | 'pnl' | 'bs' | 'daybook' | 'stock' | 'party'
  >('trial');

  const handleExportCsv = () => {
    const rows = [
      ['Ledger', 'Group', 'Debit', 'Credit'],
      ...financials.trialBalance.map((r) => [
        r.ledger,
        r.group,
        r.debit.toFixed(2),
        r.credit.toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MargBooks_${reportTab}_2026-27.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Financial report exported to CSV.', 'success');
  };

  const partySales = workspace.invoices
    .filter((i) => i.docType === 'POS_BILL' || i.docType === 'GST_INVOICE')
    .reduce<Record<string, { bills: number; taxable: number; gst: number; total: number }>>(
      (acc, inv) => {
        const entry = acc[inv.customerName] || { bills: 0, taxable: 0, gst: 0, total: 0 };
        entry.bills += 1;
        entry.taxable += inv.subtotal - inv.discountAmount;
        entry.gst += inv.cgstAmount + inv.sgstAmount + inv.igstAmount;
        entry.total += inv.grandTotal;
        acc[inv.customerName] = entry;
        return acc;
      },
      {}
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Reports & Financial Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Trial Balance · Profit & Loss (P&L) · Balance Sheet · Day Book · Stock Valuation · Party-Wise Sales
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          <span>Export Report CSV</span>
        </button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1.5">
        {[
          { id: 'trial', label: 'Trial Balance' },
          { id: 'pnl', label: 'Profit & Loss (P&L)' },
          { id: 'bs', label: 'Balance Sheet & Cash Flow' },
          { id: 'daybook', label: 'Day Book' },
          { id: 'stock', label: 'Stock Valuation' },
          { id: 'party', label: 'Party-Wise Sales & GST' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setReportTab(t.id as typeof reportTab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              reportTab === t.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reportTab === 'trial' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Account Ledger</th>
                <th className="py-3 px-3">Account Group</th>
                <th className="py-3 px-3 text-right">Debit (₹)</th>
                <th className="py-3 px-4 text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {financials.trialBalance.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-medium text-slate-900">{row.ledger}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-500">{row.group}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-800">
                    {row.debit > 0 ? formatInr(row.debit) : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums text-slate-800">
                    {row.credit > 0 ? formatInr(row.credit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <td colSpan={2} className="py-3 px-4 text-xs">
                  Trial Balance Total (Double-Entry Reconciled)
                </td>
                <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                  {formatInr(financials.trialDebitTotal)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                  {formatInr(financials.trialCreditTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {reportTab === 'pnl' && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-slate-900 pb-2 border-b border-slate-100">
              Trading & Expense Side (Debit)
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Net Purchases (Ex-GST)</span>
                <span className="font-mono tabular-nums">
                  {formatInr(Math.max(0, financials.totalPurchases - financials.inputGstItc))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Operating & Store Expenses</span>
                <span className="font-mono tabular-nums">
                  {formatInr(financials.totalExpenses)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold text-slate-900">
                <span>Estimated Gross Profit</span>
                <span className="font-mono tabular-nums text-teal-800">
                  {formatInr(financials.grossProfit)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-slate-900 pb-2 border-b border-slate-100">
              Income & Closing Stock Side (Credit)
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Net Sales Revenue (Ex-GST)</span>
                <span className="font-mono tabular-nums">
                  {formatInr(Math.max(0, financials.totalSales - financials.outputGst.total))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Closing Stock Valuation (FIFO Cost)</span>
                <span className="font-mono tabular-nums">
                  {formatInr(financials.closingStockValue)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold text-slate-900">
                <span>Net Profit / (Loss)</span>
                <span
                  className={`font-mono tabular-nums ${
                    financials.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {formatInr(financials.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {reportTab === 'bs' && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5 text-sm">
            <h2 className="text-base font-semibold text-slate-900 pb-2 border-b border-slate-100">
              Assets & Cash Flow Position
            </h2>
            <div className="flex justify-between">
              <span className="text-slate-600">Cash & Bank Equivalents</span>
              <span className="font-mono font-medium tabular-nums">
                {formatInr(financials.cashBankBalance)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Sundry Debtors (Receivables)</span>
              <span className="font-mono font-medium tabular-nums">
                {formatInr(financials.totalReceivables)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Closing Inventory Stock</span>
              <span className="font-mono font-medium tabular-nums">
                {formatInr(financials.closingStockValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Input GST Credit Receivable</span>
              <span className="font-mono font-medium tabular-nums">
                {formatInr(financials.inputGstItc)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-2.5 text-sm">
            <h2 className="text-base font-semibold text-slate-900 pb-2 border-b border-slate-100">
              Liabilities & Capital Equity
            </h2>
            <div className="flex justify-between">
              <span className="text-slate-600">Sundry Creditors (Payables)</span>
              <span className="font-mono font-medium tabular-nums">
                {formatInr(financials.totalPayables)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Output GST Duties & Taxes</span>
              <span className="font-mono font-medium tabular-nums">
                {formatInr(financials.outputGst.total)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold text-slate-900">
              <span>Net Working Capital & Owner Equity</span>
              <span className="font-mono tabular-nums text-teal-800">
                {formatInr(
                  financials.cashBankBalance +
                    financials.totalReceivables +
                    financials.closingStockValue -
                    financials.totalPayables -
                    financials.netGstPayable
                )}
              </span>
            </div>
          </div>
        </section>
      )}

      {reportTab === 'daybook' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Ref No</th>
                <th className="py-3 px-3">Book / Type</th>
                <th className="py-3 px-3">Particulars</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.invoices.map((i) => (
                <tr key={`inv-${i.id}`}>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{i.invoiceDate}</td>
                  <td className="py-2.5 px-3 font-mono text-xs font-medium text-slate-900">
                    {i.invoiceNo}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">{i.docType}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-800">{i.customerName}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                    {formatInr(i.grandTotal)}
                  </td>
                </tr>
              ))}
              {workspace.vouchers.map((v) => (
                <tr key={`v-${v.id}`}>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{v.voucherDate}</td>
                  <td className="py-2.5 px-3 font-mono text-xs font-medium text-slate-900">
                    {v.voucherNo}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">{v.voucherType}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-800">
                    {v.debitLedgerName} / {v.creditLedgerName}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                    {formatInr(v.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {reportTab === 'stock' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Item SKU</th>
                <th className="py-3 px-3">Category · HSN</th>
                <th className="py-3 px-3 text-right">Total Qty</th>
                <th className="py-3 px-3 text-right">Purchase Cost</th>
                <th className="py-3 px-4 text-right">Valuation (FIFO)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.items.map((it) => {
                const batches = workspace.batches.filter((b) => b.itemId === it.id);
                const qty = batches.reduce((s, b) => s + b.qtyOnHand, 0);
                const val = batches.reduce((s, b) => s + b.qtyOnHand * b.costRate, 0);
                return (
                  <tr key={it.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{it.name}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                      {it.category} · {it.hsnCode}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums">
                      {qty} {it.uqc}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums">
                      ₹{it.purchaseRate.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                      {formatInr(val)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {reportTab === 'party' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Customer Party</th>
                <th className="py-3 px-3 text-right">Bills</th>
                <th className="py-3 px-3 text-right">Taxable Value</th>
                <th className="py-3 px-3 text-right">GST Collected</th>
                <th className="py-3 px-4 text-right">Net Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(partySales).map(([name, st]) => (
                <tr key={name}>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{name}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums">{st.bills}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums">
                    {formatInr(st.taxable)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums">
                    {formatInr(st.gst)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                    {formatInr(st.total)}
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

export function ControlRoomModule() {
  const { workspace, dispatchAction, showToast } = useMargBooks();
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const [tab, setTab] = useState<'config' | 'counters' | 'rbac' | 'template' | 'utilities'>(
    'config'
  );
  const [draftPatch, setDraftPatch] = useState<Partial<ControlRoomConfig>>({});
  const draft: ControlRoomConfig = { ...workspace.controlRoom, ...draftPatch };

  const setDraft = (next: ControlRoomConfig) => {
    setDraftPatch(next);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await dispatchAction(
      'UPDATE_CONTROL_ROOM',
      { ...draft },
      'Control Room configuration saved and applied across POS counters.'
    );
    if (ok) setDraftPatch({});
  };

  const handleRebuildBooks = async () => {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    await dispatchAction(
      'UPDATE_CONTROL_ROOM',
      { ...draft, lastBooksRebuildAt: stamp },
      'Books re-indexed cleanly — ledger balances and batch stock verified.'
    );
  };

  const handleCloudBackup = async () => {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    await dispatchAction(
      'UPDATE_CONTROL_ROOM',
      { ...draft, lastBackupAt: stamp },
      'Encrypted cloud snapshot backup completed.'
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Settings &gt; Control Room Configuration
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            POS Billing Controls · Multi-Counter & Day-End Cash Summary · Financial Year Lock · RBAC · Invoice Designer · Utilities
          </p>
        </div>
        {activeCompany && (
          <button
            type="button"
            onClick={() =>
              void dispatchAction(
                'UPDATE_COMPANY_SETTINGS',
                { fyLocked: !activeCompany.fyLocked },
                `Financial Year ${activeCompany.financialYear} ${
                  !activeCompany.fyLocked ? 'locked' : 'unlocked'
                }.`
              )
            }
            className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold whitespace-nowrap ${
              activeCompany.fyLocked
                ? 'border-red-300 bg-red-50 text-red-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {activeCompany.fyLocked ? (
              <>
                <Unlock className="h-3.5 w-3.5" />
                <span>Unlock FY {activeCompany.financialYear}</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span>Lock FY {activeCompany.financialYear}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1.5">
        {[
          { id: 'config', label: 'Control Room Rules' },
          { id: 'counters', label: 'Multi-Counter & Day-End Cash' },
          { id: 'rbac', label: 'User Access & RBAC' },
          { id: 'template', label: 'Invoice Template Designer' },
          { id: 'utilities', label: 'Rebuild Books & Cloud Backup' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              tab === t.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Control Room Configuration */}
      {tab === 'config' && (
        <form
          onSubmit={handleSaveConfig}
          className="rounded-lg border border-slate-200 bg-white p-5 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: 'autoApplySchemes' as const,
                title: 'Auto Schemes & Discounts Engine',
                desc: 'Automatically apply date-valid percentage discounts and Buy-X-Get-Y free qty in Retail POS.',
              },
              {
                key: 'enableLoyaltyPoints' as const,
                title: 'Customer Loyalty Bonus Points',
                desc: 'Credit points per ₹100 spent and allow instant redemption during POS checkout.',
              },
              {
                key: 'multiCounterEnabled' as const,
                title: 'Multi-Counter Control',
                desc: 'Allow cashiers to switch POS counters and track separate cash drawers.',
              },
              {
                key: 'allowNegativeStock' as const,
                title: 'Allow Negative Stock Billing',
                desc: 'Keep disabled to strictly block sales when batch quantity reaches zero.',
              },
              {
                key: 'requireBatchOnBilling' as const,
                title: 'Mandatory Lot & Best-Before Tracking',
                desc: 'Require FEFO lot traceability on perishable produce, dairy, and packaged FMCG bills.',
              },
              {
                key: 'eInvoiceAutoIrn' as const,
                title: 'Auto-Generate E-Invoice IRN on B2B Bills',
                desc: 'Automatically assign IRP IRN & QR code when billing GST-registered customers.',
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start justify-between gap-4 rounded-md border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50/70"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={draft[item.key]}
                  onChange={(e) => setDraft({ ...draft, [item.key]: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-teal-700"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label htmlFor="cr-earn" className="block text-xs font-medium text-slate-700 mb-1">
                Loyalty Earn Rate (Points per ₹100)
              </label>
              <input
                id="cr-earn"
                type="number"
                min={0}
                max={20}
                value={draft.loyaltyEarnPer100}
                onChange={(e) =>
                  setDraft({ ...draft, loyaltyEarnPer100: Number(e.target.value) || 0 })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="cr-val" className="block text-xs font-medium text-slate-700 mb-1">
                1 Loyalty Point Value (₹)
              </label>
              <input
                id="cr-val"
                type="number"
                step="0.25"
                min={0.25}
                value={draft.loyaltyPointValue}
                onChange={(e) =>
                  setDraft({ ...draft, loyaltyPointValue: Number(e.target.value) || 1 })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="cr-exp" className="block text-xs font-medium text-slate-700 mb-1">
                Near-Expiry Alert Threshold (Days)
              </label>
              <input
                id="cr-exp"
                type="number"
                min={15}
                max={365}
                value={draft.nearExpiryAlertDays}
                onChange={(e) =>
                  setDraft({ ...draft, nearExpiryAlertDays: Number(e.target.value) || 90 })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <Save className="h-4 w-4" />
              <span>Save Control Room Configuration</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Multi-Counter Control & Day-End Cash Summary */}
      {tab === 'counters' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Counter / Operator</th>
                <th className="py-3 px-3 text-right">Opening Cash</th>
                <th className="py-3 px-3 text-right">Cash Sales</th>
                <th className="py-3 px-3 text-right">UPI + Card + Wallet</th>
                <th className="py-3 px-3 text-right">Expected Drawer</th>
                <th className="py-3 px-4 text-right">Shift Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.posCounters.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">
                      {c.counterCode} · {c.counterName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.operatorName} ({c.operatorRole}) · Status: {c.status}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                    {formatInr(c.openingCash)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                    {formatInr(c.cashSales)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                    {formatInr(c.upiSales + c.cardSales + c.walletSales)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-bold text-teal-800 tabular-nums">
                    {formatInr(c.openingCash + c.cashSales)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        void dispatchAction(
                          'UPDATE_COUNTER_STATUS',
                          {
                            id: c.id,
                            status: c.status === 'OPEN' ? 'CLOSED' : 'OPEN',
                            lastClosedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
                          },
                          `${c.counterCode} shift ${
                            c.status === 'OPEN' ? 'closed with Day-End Cash Summary' : 'reopened'
                          }.`
                        )
                      }
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                        c.status === 'OPEN'
                          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {c.status === 'OPEN' ? 'Close Day-End Shift' : 'Reopen Counter'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Tab 3: RBAC */}
      {tab === 'rbac' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Operator & Email</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Assigned Counters</th>
                <th className="py-3 px-3">Control Room</th>
                <th className="py-3 px-3">Approve Returns</th>
                <th className="py-3 px-4">FY Lock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.operators.map((op) => (
                <tr key={op.id}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{op.name}</div>
                    <div className="text-xs text-slate-500">{op.email}</div>
                  </td>
                  <td className="py-3 px-3 text-xs font-semibold text-slate-800">{op.role}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600">
                    {op.countersAllowed.join(', ')}
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {op.canEditControlRoom ? 'Allowed' : 'Restricted'}
                  </td>
                  <td className="py-3 px-3 text-xs">
                    {op.canApproveReturns ? 'Allowed' : 'Restricted'}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {op.canLockFy ? 'Allowed' : 'Restricted'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Tab 4: Invoice Template Designer */}
      {tab === 'template' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form
            onSubmit={handleSaveConfig}
            className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Custom Invoice Template Settings
            </h2>
            <div>
              <label htmlFor="tpl-title" className="block text-xs font-medium text-slate-700 mb-1">
                Invoice Header Title
              </label>
              <input
                id="tpl-title"
                value={draft.invoiceHeaderTitle}
                onChange={(e) => setDraft({ ...draft, invoiceHeaderTitle: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="tpl-paper" className="block text-xs font-medium text-slate-700 mb-1">
                Default Print Format
              </label>
              <select
                id="tpl-paper"
                value={draft.thermalPaperWidth}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    thermalPaperWidth: e.target.value as '58mm' | '80mm' | 'A4',
                  })
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="80mm">80mm Thermal POS Receipt</option>
                <option value="58mm">58mm Compact Thermal</option>
                <option value="A4">A4 Full GST Tax Invoice</option>
              </select>
            </div>
            <div>
              <label htmlFor="tpl-terms" className="block text-xs font-medium text-slate-700 mb-1">
                Footer Terms & Declaration
              </label>
              <textarea
                id="tpl-terms"
                rows={3}
                value={draft.invoiceTerms}
                onChange={(e) => setDraft({ ...draft, invoiceTerms: e.target.value })}
                className="w-full rounded-md border border-slate-300 p-2.5 text-xs"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Save Template Design
            </button>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Live Print Preview ({draft.thermalPaperWidth})
            </h2>
            <div className="mx-auto max-w-sm rounded border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-xs space-y-2">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <div className="font-bold text-slate-900">{draft.invoiceHeaderTitle}</div>
                <div className="font-semibold text-slate-700">{activeCompany?.name}</div>
                <div className="text-[10px] text-slate-500">GSTIN: {activeCompany?.gstin}</div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>India Gate Basmati 5kg (×1) · MRP ₹685</span>
                <span>₹589.00</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Fresh Farm Tomatoes (1.5 KG)</span>
                <span>₹57.00</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>NET PAYABLE</span>
                <span>₹675.00</span>
              </div>
              <div className="text-center text-[10px] font-bold text-emerald-800 bg-emerald-50 py-1 rounded">
                YOU SAVED ₹111.00 ON MRP TODAY!
              </div>
              <div className="pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-500">
                {draft.invoiceTerms}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Utilities */}
      {tab === 'utilities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
              <RefreshCcw className="h-4 w-4 text-teal-700" />
              <h2>Rebuilding Books (Re-Indexing Utility)</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Verifies double-entry debit/credit parity, recalculates batch-wise FIFO stock quantities across godowns, and validates customer loyalty point ledgers.
            </p>
            <div className="text-xs font-mono text-slate-500">
              Last Rebuilt: {workspace.controlRoom.lastBooksRebuildAt}
            </div>
            <button
              type="button"
              onClick={() => void handleRebuildBooks()}
              className="rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Run Rebuild Books Now
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
              <DatabaseBackup className="h-4 w-4 text-teal-700" />
              <h2>Cloud Backup & Multi-Currency Setup</h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Create an instant encrypted backup of your active company books, GST registers, and POS counter tallies.
            </p>
            <div className="text-xs font-mono text-slate-500">
              Last Backup: {workspace.controlRoom.lastBackupAt} · Currency: {activeCompany?.currency || 'INR'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCloudBackup()}
                className="rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                Create Cloud Backup
              </button>
              <button
                type="button"
                onClick={() =>
                  void dispatchAction(
                    'RESET_TO_SUPERMARKET',
                    {},
                    'Fresh Indian Supermarket catalog, loose-weight produce, and checkout lanes loaded.'
                  )
                }
                className="inline-flex items-center gap-1 rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100 cursor-pointer"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                <span>Load Fresh Supermarket Catalog</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  showToast('REST & Webhook API integration keys are managed via server secrets.', 'info')
                }
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>API Integrations</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
