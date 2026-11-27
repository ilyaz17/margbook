'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ScanBarcode,
  Send,
  Wallet,
} from 'lucide-react';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LedgerDetailPage({ ledgerId }: { ledgerId: string }) {
  const { workspace, dispatchAction, showToast } = useMargBooks();
  const numericId = Number(ledgerId);
  const ledger = workspace.ledgers.find((l) => l.id === numericId);

  const [settleAmount, setSettleAmount] = useState('');
  const [settleMode, setSettleMode] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [settleNote, setSettleNote] = useState('');
  const [settling, setSettling] = useState(false);

  if (!ledger) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-10 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Ledger Account Not Found
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This party ledger does not exist in the selected company workspace.
        </p>
        <Link
          href="/admin/masters"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Back to Master Module
        </Link>
      </div>
    );
  }

  const partyInvoices = workspace.invoices.filter(
    (inv) =>
      inv.ledgerId === ledger.id ||
      inv.customerName.toLowerCase() === ledger.name.toLowerCase()
  );

  const partyPurchases = workspace.purchases.filter(
    (pur) =>
      pur.ledgerId === ledger.id ||
      pur.supplierName.toLowerCase() === ledger.name.toLowerCase()
  );

  const partyVouchers = workspace.vouchers.filter(
    (v) =>
      v.debitLedgerName.toLowerCase() === ledger.name.toLowerCase() ||
      v.creditLedgerName.toLowerCase() === ledger.name.toLowerCase()
  );

  const totalBilled = partyInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalPurchased = partyPurchases.reduce((s, p) => s + p.grandTotal, 0);

  const creditUtilizationPct =
    ledger.creditLimit > 0
      ? Math.min(100, Math.round((Math.max(0, ledger.currentBalance) / ledger.creditLimit) * 100))
      : 0;
  const isOverLimit = ledger.creditLimit > 0 && ledger.currentBalance > ledger.creditLimit;

  const handleCopyReminder = () => {
    const msg = `Dear ${ledger.name}, your current FreshMart supermarket Khata balance is ${formatInr(
      ledger.currentBalance
    )} (${ledger.balanceType}). Kindly confirm settlement via Cash or UPI (${
      workspace.controlRoom.upiVpa || 'freshmart@upi'
    }). Thank you!`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(msg);
    }
    showToast(`Payment reminder message copied for ${ledger.name}.`, 'success');
  };

  const handleSettleUdhaar = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(settleAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid settlement amount greater than ₹0.', 'error');
      return;
    }
    setSettling(true);
    try {
      const ok = await dispatchAction(
        'SETTLE_UDHAAR',
        {
          ledgerId: ledger.id,
          amount: amt,
          paymentMode: settleMode,
          narration:
            settleNote.trim() || `Udhaar Khata settlement received via ${settleMode}`,
        },
        `Settled ${formatInr(amt)} on ${ledger.name} Khata via ${settleMode}.`
      );
      if (ok) {
        setSettleAmount('');
        setSettleNote('');
      }
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/masters"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Account Ledgers</span>
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {ledger.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {ledger.groupType} · State Code {ledger.stateCode}
            {ledger.gstin ? ` · GSTIN ${ledger.gstin}` : ' · Unregistered Party'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ledger.groupType === 'Customer' && (
            <Link
              href="/admin/pos"
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0"
            >
              <ScanBarcode className="h-3.5 w-3.5" />
              <span>Bill in Retail POS</span>
            </Link>
          )}
          <Link
            href="/admin/accounting/vouchers/new"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Record Voucher</span>
          </Link>
          {ledger.currentBalance > 0 && (
            <button
              type="button"
              onClick={handleCopyReminder}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Copy Reminder</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Current Ledger Balance</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatInr(ledger.currentBalance)}{' '}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {ledger.balanceType}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Opening: {formatInr(ledger.openingBalance)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Credit Limit (Udhaar Cap)</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {ledger.creditLimit > 0 ? formatInr(ledger.creditLimit) : 'No Limit Set'}
          </div>
          <div
            className={`mt-1 text-xs font-medium ${
              isOverLimit
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {isOverLimit
              ? 'Limit exceeded — settle before next credit bill'
              : ledger.creditLimit > 0
              ? `${creditUtilizationPct}% utilized · ${formatInr(
                  Math.max(0, ledger.creditLimit - ledger.currentBalance)
                )} available`
              : 'Within approved credit'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {ledger.groupType === 'Supplier' ? 'Purchase Volume' : 'Billed Sales Volume'}
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatInr(ledger.groupType === 'Supplier' ? totalPurchased : totalBilled)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {ledger.groupType === 'Supplier'
              ? `${partyPurchases.length} purchase bills`
              : `${partyInvoices.length} invoices / bills`}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Loyalty Points Balance</span>
            <Award className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {ledger.loyaltyPoints} pts
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Redeemable value{' '}
            {formatInr(ledger.loyaltyPoints * workspace.controlRoom.loyaltyPointValue)}
          </div>
        </div>
      </div>

      {/* Customer Udhaar Credit Exposure & 1-Click Settlement Panel */}
      {ledger.groupType === 'Customer' && (
        <section className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-[#111827] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Customer Udhaar / Khata Credit Control &amp; Quick Settlement
              </h2>
            </div>
            {ledger.currentBalance > 0 && (
              <button
                type="button"
                onClick={() => setSettleAmount(String(ledger.currentBalance.toFixed(2)))}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Fill Full Due ({formatInr(ledger.currentBalance)})
              </button>
            )}
          </div>

          {ledger.creditLimit > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Khata Credit Exposure ({creditUtilizationPct}%)
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatInr(Math.max(0, ledger.currentBalance))} / {formatInr(ledger.creditLimit)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isOverLimit
                      ? 'bg-red-600'
                      : creditUtilizationPct >= 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ width: `${creditUtilizationPct}%` }}
                />
              </div>
            </div>
          )}

          <form
            onSubmit={handleSettleUdhaar}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800"
          >
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Received Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder={ledger.currentBalance > 0 ? ledger.currentBalance.toFixed(2) : '500.00'}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Mode
              </label>
              <select
                value={settleMode}
                onChange={(e) => setSettleMode(e.target.value as 'Cash' | 'UPI' | 'Card')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Receipt Reference / Note
              </label>
              <input
                type="text"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                placeholder="UPI UTR or counter receipt ref"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                disabled={settling}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-60 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{settling ? 'Posting...' : 'Settle Udhaar'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Contact Info Row */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex items-start gap-2.5">
          <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Phone</div>
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {ledger.phone || 'Not provided'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Email</div>
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {ledger.email || 'Not provided'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Billing Address</div>
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {ledger.address || 'Not provided'}
            </div>
          </div>
        </div>
      </div>

      {/* Sales / Purchase Bill History */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {ledger.groupType === 'Supplier'
              ? 'Purchase Bill History'
              : 'Invoices & Retail POS History'}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {ledger.groupType === 'Supplier'
              ? `${partyPurchases.length} records`
              : `${partyInvoices.length} records`}
          </span>
        </div>

        {ledger.groupType === 'Supplier' ? (
          partyPurchases.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No purchase bills recorded for this supplier yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Bill No</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type &amp; Source</th>
                    <th className="px-4 py-3 text-right font-medium">GST</th>
                    <th className="px-5 py-3 text-right font-medium">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {partyPurchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {pur.billNo}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {pur.billDate}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {pur.docType.replace('_', ' ')} · {pur.importSource}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatInr(pur.taxAmount)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatInr(pur.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : partyInvoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No retail bills or GST invoices found for this party yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Invoice No</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Mode &amp; Status</th>
                  <th className="px-4 py-3 text-right font-medium">Loyalty</th>
                  <th className="px-4 py-3 text-right font-medium">Grand Total</th>
                  <th className="px-5 py-3 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {partyInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {inv.invoiceNo}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {inv.invoiceDate}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {inv.paymentModeSummary} · {inv.status}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                      +{inv.loyaltyEarned} / -{inv.loyaltyRedeemed}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatInr(inv.grandTotal)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/bills/${inv.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Open Bill</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Accounting Vouchers for this Party */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Accounting Voucher Statement
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {partyVouchers.length} entries
          </span>
        </div>

        {partyVouchers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No receipt, payment, or journal vouchers posted to this ledger yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Voucher No</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type &amp; Narration</th>
                  <th className="px-4 py-3 font-medium">Dr / Cr</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {partyVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {v.voucherNo}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {v.voucherDate}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {v.voucherType}
                      </div>
                      <div>{v.narration || v.paymentMode}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      Dr {v.debitLedgerName} / Cr {v.creditLedgerName}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatInr(v.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
