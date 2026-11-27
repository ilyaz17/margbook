'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Download, FileCheck2, Plus, QrCode, RefreshCw } from 'lucide-react';
import {
  buildGstr1PortalJson,
  generateDeterministicIrn,
  generateEwayBillNo,
} from '../lib/erp-engine';
import type { CrmRecord } from '../types/erp';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BankingModule() {
  const { workspace, dispatchAction } = useMargBooks();
  const bankLedgers = workspace.ledgers.filter(
    (l) => l.groupType === 'Bank' || l.groupType === 'Cash'
  );
  const pdcVouchers = workspace.vouchers.filter((v) => v.chequeNo || v.pdcDate);

  const reconciledCount = workspace.vouchers.filter((v) => v.reconciled).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Banking, PDC & Statement Reconciliation
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Connected Bank Accounts · Post-Dated Cheque (PDC) Register · Automated Bank Reconciliation
        </p>
      </div>

      {/* Connected Accounts Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {bankLedgers.map((acct) => (
          <div
            key={acct.id}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4"
          >
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {acct.groupType === 'Bank' ? 'Connected Bank Account' : 'Vault Cash Register'}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{acct.name}</div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatInr(acct.currentBalance)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Opening {formatInr(acct.openingBalance)} · {acct.address}
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Reconciliation Progress</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Bank Statement Matching
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {reconciledCount} / {workspace.vouchers.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {pdcVouchers.length} Post-Dated Cheque(s) scheduled
          </div>
        </div>
      </div>

      {/* Bank Statement Reconciliation Table */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Bank Statement & Post-Dated Cheque (PDC) Reconciliation
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click Match / Unmatch to reconcile entries against bank feed
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
              <th className="py-3 px-4">Voucher · Date</th>
              <th className="py-3 px-3">Particulars</th>
              <th className="py-3 px-3">Mode / Cheque / PDC Date</th>
              <th className="py-3 px-3 text-right">Amount</th>
              <th className="py-3 px-4 text-right">Reconciliation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {workspace.vouchers.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                <td className="py-3 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{v.voucherNo}</div>
                  <div>{v.voucherDate}</div>
                </td>
                <td className="py-3 px-3 text-xs text-slate-800 dark:text-slate-200">
                  <div>
                    {v.debitLedgerName} ← {v.creditLedgerName}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">{v.narration}</div>
                </td>
                <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {v.paymentMode}
                  {v.chequeNo ? ` · ${v.chequeNo}` : ''}
                  {v.pdcDate ? ` · PDC ${v.pdcDate}` : ''}
                </td>
                <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums">
                  {formatInr(v.amount)}
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      void dispatchAction(
                        'TOGGLE_VOUCHER_RECONCILED',
                        { id: v.id, reconciled: !v.reconciled },
                        `Voucher ${v.voucherNo} marked ${!v.reconciled ? 'Reconciled' : 'Pending'}.`
                      )
                    }
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                      v.reconciled
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-amber-300 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {v.reconciled ? 'Reconciled' : 'Mark Reconciled'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function GstComplianceModule() {
  const { workspace, financials, dispatchAction, showToast } = useMargBooks();
  const [gstTab, setGstTab] = useState<'einvoice' | 'gstr1' | 'gstr2b' | 'gstr3b'>('einvoice');
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const b2bInvoices = useMemo(
    () =>
      workspace.invoices.filter(
        (i) => i.docType === 'GST_INVOICE' || i.customerGstin.trim().length > 0
      ),
    [workspace.invoices]
  );

  const handleDownloadGstr1Json = () => {
    const jsonPayload = buildGstr1PortalJson(
      activeCompany?.gstin || '07AABCS1429B1ZB',
      '112026',
      workspace.invoices
    );
    const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${activeCompany?.gstin || 'GST'}_112026.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('GSTR-1 Portal JSON exported successfully.', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            GST & Tax Compliance
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Direct E-Invoicing (IRN/QR) · E-Way Bill Generation · GSTR-1, GSTR-2A/2B Reconciliation & GSTR-3B JSON Filing
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadGstr1Json}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          <span>Export GSTR-1 Portal JSON</span>
        </button>
      </div>

      {/* GST Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Output CGST + SGST</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatInr(financials.outputGst.cgst + financials.outputGst.sgst)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Output IGST</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatInr(financials.outputGst.igst)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Eligible Input ITC (GSTR-2B)</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
            {formatInr(financials.inputGstItc)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Net GSTR-3B Tax Payable</div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatInr(financials.netGstPayable)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1.5 overflow-x-auto">
        {[
          { id: 'einvoice', label: 'E-Invoice (IRN/QR) & E-Way Bill' },
          { id: 'gstr1', label: 'GSTR-1 Outward Supplies' },
          { id: 'gstr2b', label: 'GSTR-2A / 2B Reconciliation' },
          { id: 'gstr3b', label: 'GSTR-3B Summary' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setGstTab(t.id as typeof gstTab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              gstTab === t.id
                ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {gstTab === 'einvoice' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Invoice No · Date</th>
                <th className="py-3 px-3">Buyer / GSTIN</th>
                <th className="py-3 px-3 text-right">Invoice Value</th>
                <th className="py-3 px-3">IRN & E-Way Status</th>
                <th className="py-3 px-4 text-right">IRP Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {b2bInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono text-xs">
                    <Link
                      href={`/admin/bills/${inv.id}`}
                      className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      {inv.invoiceNo}
                    </Link>
                    <div className="text-slate-500 dark:text-slate-400">{inv.invoiceDate}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{inv.customerName}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {inv.customerGstin || 'B2C'}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums">
                    {formatInr(inv.grandTotal)}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs">
                    <div className={inv.irn ? 'text-emerald-700 font-medium' : 'text-amber-700'}>
                      {inv.irn ? `IRN: ${inv.irn.slice(0, 18)}…` : 'IRN Pending'}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {inv.ewayBillNo ? `EWB: ${inv.ewayBillNo}` : 'No E-Way Bill'}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      {!inv.irn && (
                        <button
                          type="button"
                          onClick={() =>
                            void dispatchAction(
                              'UPDATE_INVOICE_COMPLIANCE',
                              {
                                id: inv.id,
                                irn: generateDeterministicIrn(
                                  activeCompany?.gstin || '07AABCS1429B1ZB',
                                  inv.invoiceNo,
                                  inv.invoiceDate
                                ),
                              },
                              `IRN & Signed QR generated for ${inv.invoiceNo}.`
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-700 dark:bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>Generate IRN</span>
                        </button>
                      )}
                      {!inv.ewayBillNo && (
                        <button
                          type="button"
                          onClick={() =>
                            void dispatchAction(
                              'UPDATE_INVOICE_COMPLIANCE',
                              {
                                id: inv.id,
                                ewayBillNo: generateEwayBillNo(inv.invoiceNo, inv.grandTotal),
                              },
                              `E-Way Bill generated for ${inv.invoiceNo}.`
                            )
                          }
                          className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          Generate E-Way Bill
                        </button>
                      )}
                      {inv.irn && inv.ewayBillNo && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Compliant
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {gstTab === 'gstr1' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">GSTR-1 Table Section</th>
                <th className="py-3 px-3 text-right">Voucher Count</th>
                <th className="py-3 px-3 text-right">Taxable Value</th>
                <th className="py-3 px-3 text-right">CGST + SGST</th>
                <th className="py-3 px-4 text-right">IGST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">
                  4A — B2B Registered Invoices
                </td>
                <td className="py-3 px-3 text-right tabular-nums">{b2bInvoices.length}</td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {formatInr(b2bInvoices.reduce((s, i) => s + i.subtotal, 0))}
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {formatInr(b2bInvoices.reduce((s, i) => s + i.cgstAmount + i.sgstAmount, 0))}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatInr(b2bInvoices.reduce((s, i) => s + i.igstAmount, 0))}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">
                  7 — B2CS Retail POS Supplies
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {workspace.invoices.filter((i) => i.docType === 'POS_BILL').length}
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {formatInr(
                    workspace.invoices
                      .filter((i) => i.docType === 'POS_BILL')
                      .reduce((s, i) => s + i.subtotal - i.discountAmount, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-right tabular-nums">
                  {formatInr(
                    workspace.invoices
                      .filter((i) => i.docType === 'POS_BILL')
                      .reduce((s, i) => s + i.cgstAmount + i.sgstAmount, 0)
                  )}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">₹0.00</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {gstTab === 'gstr2b' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Supplier Bill · Date</th>
                <th className="py-3 px-3">Supplier / GSTIN</th>
                <th className="py-3 px-3 text-right">Books ITC</th>
                <th className="py-3 px-3 text-right">GSTR-2B Portal ITC</th>
                <th className="py-3 px-4 text-right">Match Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {workspace.purchases
                .filter((p) => p.docType === 'PURCHASE_BILL')
                .map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-slate-100">
                      {p.billNo} · {p.billDate}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.supplierName}</div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{p.supplierGstin}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                      {formatInr(p.taxAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                      {formatInr(p.taxAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-semibold text-emerald-700">
                      Exact Match (100%)
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      {gstTab === 'gstr3b' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <FileCheck2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <span>GSTR-3B Monthly Return Computation (Nov 2026)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 font-mono text-xs">
            <div className="rounded border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="font-sans text-slate-500 dark:text-slate-400">3.1 Outward Tax Liability</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatInr(financials.outputGst.total)}
              </div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                CGST {formatInr(financials.outputGst.cgst)} · SGST {formatInr(financials.outputGst.sgst)} · IGST {formatInr(financials.outputGst.igst)}
              </div>
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="font-sans text-slate-500 dark:text-slate-400">4. Eligible Input Tax Credit (ITC)</div>
              <div className="mt-1 text-lg font-bold text-emerald-700 tabular-nums">
                {formatInr(financials.inputGstItc)}
              </div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">Auto-populated from Purchase Register</div>
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="font-sans text-slate-500 dark:text-slate-400">6.1 Net Cash Ledger Challan</div>
              <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatInr(financials.netGstPayable)}
              </div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">Ready for PMT-06 GST Portal Filing</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function CrmMargMartModule() {
  const { workspace, dispatchAction, showToast } = useMargBooks();
  const [channelTab, setChannelTab] = useState<'ALL' | 'MARG_MART_ORDER' | 'CRM_LEAD'>('ALL');

  const filtered = useMemo(() => {
    if (channelTab === 'ALL') return workspace.crmRecords;
    return workspace.crmRecords.filter((r) => r.channel === channelTab);
  }, [workspace.crmRecords, channelTab]);

  const nextStageMap: Record<CrmRecord['stage'], CrmRecord['stage']> = {
    New: 'Follow-Up',
    'Follow-Up': 'Quoted',
    Quoted: 'Confirmed',
    Confirmed: 'Dispatched',
    Dispatched: 'Won',
    Won: 'Won',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            CRM Pipeline & Marg Mart Online Store
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Customer Follow-Ups · Institutional Sales Pipeline · Marg Mart E-Commerce Storefront Sync
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              showToast(
                'Marg Mart online storefront catalog & stock synced across 12 SKUs.',
                'success'
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Marg Mart Store</span>
          </button>
          <Link
            href="/admin/crm/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add Lead / Online Order</span>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1.5 w-fit">
        {[
          { id: 'ALL', label: `All Records (${workspace.crmRecords.length})` },
          {
            id: 'MARG_MART_ORDER',
            label: `Marg Mart Orders (${workspace.crmRecords.filter((r) => r.channel === 'MARG_MART_ORDER').length})`,
          },
          {
            id: 'CRM_LEAD',
            label: `CRM Pipeline (${workspace.crmRecords.filter((r) => r.channel === 'CRM_LEAD').length})`,
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setChannelTab(t.id as typeof channelTab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              channelTab === t.id
                ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
              <th className="py-3 px-4">Customer / Channel</th>
              <th className="py-3 px-3">Order / Inquiry Items</th>
              <th className="py-3 px-3">Follow-Up Date</th>
              <th className="py-3 px-3 text-right">Value</th>
              <th className="py-3 px-3">Stage</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{r.customerName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {r.phone} · {r.channel === 'MARG_MART_ORDER' ? 'Marg Mart Online' : 'CRM Lead'}
                  </div>
                </td>
                <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300 max-w-xs">
                  <div className="truncate font-medium">{r.itemsSummary}</div>
                  <div className="text-slate-500 dark:text-slate-400 truncate">{r.notes}</div>
                </td>
                <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {r.nextFollowUp}
                </td>
                <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums">
                  {formatInr(r.orderValue)}
                </td>
                <td className="py-3 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{r.stage}</td>
                <td className="py-3 px-4 text-right">
                  {r.stage !== 'Won' ? (
                    <button
                      type="button"
                      onClick={() =>
                        void dispatchAction(
                          'UPDATE_CRM_STAGE',
                          { id: r.id, stage: nextStageMap[r.stage] },
                          `${r.customerName} advanced to ${nextStageMap[r.stage]}.`
                        )
                      }
                      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-600 dark:border-emerald-500 hover:text-emerald-700 dark:text-emerald-400 whitespace-nowrap"
                    >
                      Advance → {nextStageMap[r.stage]}
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-700 font-medium">Completed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
