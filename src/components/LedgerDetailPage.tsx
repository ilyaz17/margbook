'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ScanBarcode,
  Send,
} from 'lucide-react';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LedgerDetailPage({ ledgerId }: { ledgerId: string }) {
  const { workspace, showToast } = useMargBooks();
  const numericId = Number(ledgerId);
  const ledger = workspace.ledgers.find((l) => l.id === numericId);

  if (!ledger) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Ledger Account Not Found</h1>
        <p className="text-sm text-slate-600">
          This party ledger does not exist in the selected company workspace.
        </p>
        <Link
          href="/admin/masters"
          className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
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

  const handleCopyReminder = () => {
    const msg = `Dear ${ledger.name}, your current MargBooks statement balance is ${formatInr(
      ledger.currentBalance
    )} (${ledger.balanceType}). Kindly confirm settlement at your earliest convenience.`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(msg);
    }
    showToast(`Payment reminder message copied for ${ledger.name}.`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/masters"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Account Ledgers</span>
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {ledger.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ledger.groupType} · State Code {ledger.stateCode}
            {ledger.gstin ? ` · GSTIN ${ledger.gstin}` : ' · Unregistered Party'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ledger.groupType === 'Customer' && (
            <Link
              href="/admin/pos"
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <ScanBarcode className="h-3.5 w-3.5" />
              <span>Bill in Retail POS</span>
            </Link>
          )}
          <Link
            href="/admin/accounting/vouchers/new"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Record Voucher</span>
          </Link>
          {ledger.currentBalance > 0 && (
            <button
              type="button"
              onClick={handleCopyReminder}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Copy Reminder</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Current Ledger Balance</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatInr(ledger.currentBalance)}{' '}
            <span className="text-xs font-medium text-slate-500">{ledger.balanceType}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Opening: {formatInr(ledger.openingBalance)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Credit Limit</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {ledger.creditLimit > 0 ? formatInr(ledger.creditLimit) : 'No Limit Set'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {ledger.creditLimit > 0 && ledger.currentBalance > ledger.creditLimit
              ? 'Limit exceeded'
              : 'Within approved credit'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {ledger.groupType === 'Supplier' ? 'Purchase Volume' : 'Billed Sales Volume'}
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatInr(ledger.groupType === 'Supplier' ? totalPurchased : totalBilled)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {ledger.groupType === 'Supplier'
              ? `${partyPurchases.length} purchase bills`
              : `${partyInvoices.length} invoices / bills`}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Loyalty Points Balance</span>
            <Award className="h-4 w-4 text-teal-700" />
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-teal-800 tabular-nums">
            {ledger.loyaltyPoints} pts
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Redeemable value {formatInr(ledger.loyaltyPoints * workspace.controlRoom.loyaltyPointValue)}
          </div>
        </div>
      </div>

      {/* Contact Info Row */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="flex items-start gap-2.5">
          <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-slate-500">Phone</div>
            <div className="font-medium text-slate-900">{ledger.phone || 'Not provided'}</div>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-slate-500">Email</div>
            <div className="font-medium text-slate-900">{ledger.email || 'Not provided'}</div>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-slate-500">Billing Address</div>
            <div className="font-medium text-slate-900">{ledger.address || 'Not provided'}</div>
          </div>
        </div>
      </div>

      {/* Sales / Purchase Bill History */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            {ledger.groupType === 'Supplier'
              ? 'Purchase Bill History'
              : 'Invoices & Retail POS History'}
          </h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {ledger.groupType === 'Supplier'
              ? `${partyPurchases.length} records`
              : `${partyInvoices.length} records`}
          </span>
        </div>

        {ledger.groupType === 'Supplier' ? (
          partyPurchases.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No purchase bills recorded for this supplier yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Bill No</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type &amp; Source</th>
                    <th className="px-4 py-3 text-right font-medium">GST</th>
                    <th className="px-5 py-3 text-right font-medium">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partyPurchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono font-medium text-slate-900">
                        {pur.billNo}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {pur.billDate}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {pur.docType.replace('_', ' ')} · {pur.importSource}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                        {formatInr(pur.taxAmount)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatInr(pur.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : partyInvoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No retail bills or GST invoices found for this party yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Invoice No</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Mode &amp; Status</th>
                  <th className="px-4 py-3 text-right font-medium">Loyalty</th>
                  <th className="px-4 py-3 text-right font-medium">Grand Total</th>
                  <th className="px-5 py-3 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partyInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono font-medium text-slate-900">
                      {inv.invoiceNo}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {inv.invoiceDate}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {inv.paymentModeSummary} · {inv.status}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-teal-800 tabular-nums">
                      +{inv.loyaltyEarned} / -{inv.loyaltyRedeemed}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatInr(inv.grandTotal)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/bills/${inv.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap"
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
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Accounting Voucher Statement
          </h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {partyVouchers.length} entries
          </span>
        </div>

        {partyVouchers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No receipt, payment, or journal vouchers posted to this ledger yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Voucher No</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type &amp; Narration</th>
                  <th className="px-4 py-3 font-medium">Dr / Cr</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partyVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono font-medium text-slate-900">
                      {v.voucherNo}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {v.voucherDate}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">{v.voucherType}</div>
                      <div>{v.narration || v.paymentMode}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      Dr {v.debitLedgerName} / Cr {v.creditLedgerName}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
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
