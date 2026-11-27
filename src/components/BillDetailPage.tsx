'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Printer,
  QrCode,
  ScanBarcode,
  Share2,
  Sparkles,
  User,
} from 'lucide-react';
import { round2 } from '../lib/erp-engine';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BillDetailPage({ invoiceId }: { invoiceId: string }) {
  const { workspace, showToast } = useMargBooks();
  const numericId = Number(invoiceId);
  const invoice = workspace.invoices.find(
    (inv) => inv.id === numericId || inv.invoiceNo === invoiceId
  );
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const [format, setFormat] = useState<'80mm' | '58mm' | 'A4'>(
    workspace.controlRoom.thermalPaperWidth === '58mm'
      ? '58mm'
      : workspace.controlRoom.thermalPaperWidth === 'A4'
        ? 'A4'
        : '80mm'
  );

  const billMetrics = useMemo(() => {
    if (!invoice) {
      return { totalMrpSavings: 0, totalQtyCount: 0 };
    }
    const lineSavings = invoice.items.reduce((sum, ln) => {
      const computed =
        ln.mrpSavings !== undefined
          ? ln.mrpSavings
          : round2(Math.max(0, (ln.mrp - ln.rate) * ln.qty) + ln.discountAmount);
      return round2(sum + computed);
    }, 0);
    const loyaltySaving = round2(
      invoice.loyaltyRedeemed * workspace.controlRoom.loyaltyPointValue
    );
    const totalQtyCount = round2(
      invoice.items.reduce((sum, ln) => sum + ln.qty + ln.freeQty, 0)
    );
    return {
      totalMrpSavings: round2(lineSavings + loyaltySaving),
      totalQtyCount,
    };
  }, [invoice, workspace.controlRoom.loyaltyPointValue]);

  if (!invoice) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Invoice Not Found</h1>
        <p className="text-sm text-slate-600">
          The bill record you requested does not exist in the active store workspace.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/admin/sales"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Sale Register
          </Link>
          <Link
            href="/admin/pos"
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Back to Supermarket POS
          </Link>
        </div>
      </div>
    );
  }

  const handleCopyShare = () => {
    const shareText = [
      `${activeCompany?.name || 'FreshMart Superstore'}`,
      `Bill No: ${invoice.invoiceNo} · Date: ${invoice.invoiceDate}`,
      `Shopper: ${invoice.customerName}`,
      `Items: ${invoice.items.length} · Net Total: ${formatInr(invoice.grandTotal)} (${invoice.paymentModeSummary})`,
      billMetrics.totalMrpSavings > 0
        ? `Total Savings on MRP: ${formatInr(billMetrics.totalMrpSavings)}`
        : '',
      invoice.loyaltyEarned > 0 ? `Loyalty Points Earned: +${invoice.loyaltyEarned} pts` : '',
      invoice.irn ? `IRN: ${invoice.irn.slice(0, 24)}...` : '',
      'Thank you for shopping at our supermarket!',
    ]
      .filter(Boolean)
      .join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(shareText);
    }
    showToast(`Supermarket bill summary for ${invoice.invoiceNo} copied for WhatsApp/SMS.`, 'success');
  };

  const containerWidthClass =
    format === '58mm'
      ? 'max-w-[300px]'
      : format === '80mm'
        ? 'max-w-[410px]'
        : 'max-w-[940px]';

  return (
    <div className="space-y-5">
      {/* Screen-Only Control Bar */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sales"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Sale Register</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span className="font-mono">{invoice.invoiceNo}</span>
            </h1>
            <p className="text-xs text-slate-500">
              {invoice.docType.replace('_', ' ')} · {invoice.invoiceDate} · Lane{' '}
              {invoice.counterCode} · {invoice.status}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Receipt print format"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-200/80 p-1"
          >
            {(['80mm', '58mm', 'A4'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={format === opt}
                onClick={() => setFormat(opt)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  format === opt
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt === 'A4' ? 'A4 GST Invoice' : `${opt} Thermal`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyShare}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share Summary</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Bill</span>
          </button>

          <Link
            href="/admin/pos"
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-700 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 whitespace-nowrap shrink-0"
          >
            <ScanBarcode className="h-3.5 w-3.5" />
            <span>Next Shopper</span>
          </Link>
        </div>
      </div>

      {/* Printable Supermarket Document Sheet */}
      <div
        className={`print-sheet mx-auto w-full rounded-xl border border-slate-200 bg-white p-6 sm:p-8 transition-all ${containerWidthClass}`}
      >
        {/* Header */}
        <div
          className={`border-b border-slate-200 pb-4 ${
            format === 'A4'
              ? 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'
              : 'text-center space-y-1'
          }`}
        >
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-teal-800 uppercase">
              {workspace.controlRoom.invoiceHeaderTitle}
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-950">
              {activeCompany?.name}
            </h2>
            <p className="text-xs text-slate-600">{activeCompany?.address}</p>
            <p className="text-xs font-mono text-slate-600">
              GSTIN: {activeCompany?.gstin} · Ph: {activeCompany?.phone}
            </p>
          </div>

          <div
            className={
              format === 'A4' ? 'text-left sm:text-right text-xs space-y-1' : 'pt-2 text-xs'
            }
          >
            <div className="font-mono font-semibold text-slate-900">
              Bill No: {invoice.invoiceNo}
            </div>
            <div className="text-slate-600">
              Date: {invoice.invoiceDate} · Lane: {invoice.counterCode}
            </div>
            <div className="text-slate-600">
              Mode: {invoice.paymentModeSummary} · Status: {invoice.status}
            </div>
          </div>
        </div>

        {/* Party Details */}
        <div className="py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <div className="text-slate-500">Customer / Member</div>
            <div className="mt-0.5 font-semibold text-slate-900">{invoice.customerName}</div>
            <div className="text-slate-600">
              {invoice.customerPhone || 'Walk-in Shopper'}
              {invoice.customerGstin ? ` · GSTIN ${invoice.customerGstin}` : ''}
            </div>
          </div>
          {invoice.ledgerId && (
            <Link
              href={`/admin/ledgers/${invoice.ledgerId}`}
              className="no-print inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-900"
            >
              <User className="h-3.5 w-3.5" />
              <span>View Party Ledger</span>
            </Link>
          )}
        </div>

        {/* Supermarket Line Items Table */}
        <div className="py-4 overflow-x-auto">
          {format === 'A4' ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Item Description</th>
                  <th className="py-2 pr-3 font-medium">HSN</th>
                  <th className="py-2 px-2 text-right font-medium">Qty / Wt</th>
                  <th className="py-2 px-2 text-right font-medium">MRP</th>
                  <th className="py-2 px-2 text-right font-medium">Our Rate</th>
                  <th className="py-2 px-2 text-right font-medium">GST%</th>
                  <th className="py-2 pl-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((ln, idx) => (
                  <tr key={`${ln.itemId}-${ln.batchNo}-${idx}`}>
                    <td className="py-2.5 pr-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-900">{ln.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Lot {ln.batchNo} · Best Before {ln.expiryDate}
                        {ln.appliedSchemeName ? ` · ${ln.appliedSchemeName}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-slate-600">{ln.hsnCode}</td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                      {ln.qty}
                      {ln.freeQty > 0 ? `+${ln.freeQty}F` : ''} {ln.uqc}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-500">
                      ₹{ln.mrp.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-900">
                      ₹{ln.rate.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                      {ln.taxSlab}%
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {formatInr(ln.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-dashed border-slate-300 pb-1.5 font-medium text-slate-500">
                <span>Item · Qty / Rate</span>
                <span>Amount</span>
              </div>
              {invoice.items.map((ln, idx) => (
                <div
                  key={`${ln.itemId}-${ln.batchNo}-${idx}`}
                  className="border-b border-dashed border-slate-200 pb-2"
                >
                  <div className="flex justify-between gap-2 font-medium text-slate-900">
                    <span className="truncate">{ln.name}</span>
                    <span className="font-mono tabular-nums shrink-0">
                      {formatInr(ln.lineTotal)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>
                      {ln.qty}
                      {ln.freeQty > 0 ? `+${ln.freeQty}F` : ''} {ln.uqc} × ₹{ln.rate.toFixed(2)}
                    </span>
                    <span>
                      MRP ₹{ln.mrp.toFixed(0)} · {ln.taxSlab}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Item & Quantity Summary Line */}
        <div className="flex justify-between border-t border-dashed border-slate-300 py-2 text-[11px] font-mono text-slate-600">
          <span>Total Items: {invoice.items.length}</span>
          <span>Total Qty / Wt: {billMetrics.totalQtyCount}</span>
        </div>

        {/* Totals & GST Breakup */}
        <div className="border-t border-slate-200 pt-3.5 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Store Rate Subtotal</span>
            <span className="font-mono tabular-nums">{formatInr(invoice.subtotal)}</span>
          </div>
          {invoice.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Scheme &amp; Offer Discount</span>
              <span className="font-mono tabular-nums">
                -{formatInr(invoice.discountAmount)}
              </span>
            </div>
          )}
          {invoice.cgstAmount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>CGST + SGST</span>
              <span className="font-mono tabular-nums">
                {formatInr(invoice.cgstAmount)} + {formatInr(invoice.sgstAmount)}
              </span>
            </div>
          )}
          {invoice.igstAmount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>IGST (Inter-State)</span>
              <span className="font-mono tabular-nums">{formatInr(invoice.igstAmount)}</span>
            </div>
          )}
          {invoice.loyaltyRedeemed > 0 && (
            <div className="flex justify-between text-teal-800">
              <span>Loyalty Redeemed ({invoice.loyaltyRedeemed} pts)</span>
              <span className="font-mono tabular-nums">
                -{formatInr(invoice.loyaltyRedeemed * workspace.controlRoom.loyaltyPointValue)}
              </span>
            </div>
          )}
          {Math.abs(invoice.roundOff) > 0.001 && (
            <div className="flex justify-between text-slate-500">
              <span>Round Off</span>
              <span className="font-mono tabular-nums">
                {invoice.roundOff > 0 ? '+' : ''}
                {invoice.roundOff.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-300 pt-2.5 text-sm font-bold text-slate-950">
            <span>Net Payable</span>
            <span className="font-mono tabular-nums">{formatInr(invoice.grandTotal)}</span>
          </div>
        </div>

        {/* Supermarket MRP Savings Highlight Box */}
        {billMetrics.totalMrpSavings > 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-emerald-400 bg-emerald-50 px-4 py-2.5 text-center">
            <div className="inline-flex items-center justify-center gap-1.5 text-xs font-bold tracking-wide text-emerald-900 uppercase">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
              <span>
                You Saved {formatInr(billMetrics.totalMrpSavings)} on MRP Today!
              </span>
            </div>
          </div>
        )}

        {/* Payments & Loyalty Summary */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5">
          <div className="font-semibold text-slate-800">Payment Tender Breakdown</div>
          {invoice.payments.length > 0 ? (
            invoice.payments.map((p, idx) => (
              <div key={`${p.mode}-${idx}`} className="flex justify-between text-slate-600">
                <span>
                  {p.mode}
                  {p.reference ? ` · Ref ${p.reference}` : ''}
                </span>
                <span className="font-mono font-medium tabular-nums text-slate-900">
                  {formatInr(p.amount)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-slate-600">{invoice.paymentModeSummary}</div>
          )}
          {invoice.loyaltyEarned > 0 && (
            <div className="pt-1.5 border-t border-slate-200 text-teal-800 font-medium">
              Loyalty Bonus Credited: +{invoice.loyaltyEarned} points
            </div>
          )}
        </div>

        {/* E-Invoice IRN / QR & Terms */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[11px] text-slate-500">
          <div className="space-y-1 min-w-0">
            {invoice.irn && (
              <div className="font-mono break-all text-slate-700">IRN: {invoice.irn}</div>
            )}
            {invoice.ewayBillNo && (
              <div className="font-mono text-slate-700">E-Way Bill: {invoice.ewayBillNo}</div>
            )}
            <p className="leading-relaxed">{workspace.controlRoom.invoiceTerms}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-slate-700">
            <QrCode className="h-10 w-10 text-slate-800 shrink-0" />
            <div className="text-[10px] leading-tight">
              <div className="font-semibold">Digital GST QR</div>
              <div className="font-mono text-slate-500">{invoice.invoiceNo}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
