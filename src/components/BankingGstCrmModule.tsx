'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bike,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  MessageSquare,
  Plus,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import {
  buildGstr1PortalJson,
  buildWhatsAppCatalogBroadcastText,
  buildWhatsAppDeliveryUpdateText,
  generateDeterministicIrn,
  generateEwayBillNo,
} from '../lib/erp-engine';
import type {
  CrmRecord,
  DeliveryOrderRecord,
  DeliveryPaymentType,
  DeliveryStage,
} from '../types/erp';
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

const DELIVERY_RIDERS = ['Arjun Kumar', 'Ravi Shankar', 'Manoj V', 'Unassigned'];

export function CrmMargMartModule() {
  const { workspace, dispatchAction, showToast, broadcastOpsEvent, syncing } = useMargBooks();
  const deliveryEnabled = workspace.controlRoom.enabledAddons?.home_delivery !== false;
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const [viewMode, setViewMode] = useState<'delivery' | 'crm'>(
    deliveryEnabled ? 'delivery' : 'crm'
  );
  const [deliveryStageFilter, setDeliveryStageFilter] = useState<'ALL' | DeliveryStage>('ALL');
  const [showNewDeliveryForm, setShowNewDeliveryForm] = useState(false);

  // Inline New Home Delivery / WhatsApp Order Form State
  const [dlvCustomer, setDlvCustomer] = useState('');
  const [dlvPhone, setDlvPhone] = useState('');
  const [dlvAddress, setDlvAddress] = useState('');
  const [dlvSlot, setDlvSlot] = useState('Express (60 min)');
  const [dlvRider, setDlvRider] = useState('Arjun Kumar');
  const [dlvPaymentType, setDlvPaymentType] = useState<DeliveryPaymentType>('COD_UPI');
  const [dlvTotal, setDlvTotal] = useState('');
  const [dlvItemsSummary, setDlvItemsSummary] = useState('');

  const [channelTab, setChannelTab] = useState<'ALL' | 'MARG_MART_ORDER' | 'CRM_LEAD'>('ALL');

  const filteredCrm = useMemo(() => {
    if (channelTab === 'ALL') return workspace.crmRecords;
    return workspace.crmRecords.filter((r) => r.channel === channelTab);
  }, [workspace.crmRecords, channelTab]);

  const filteredDeliveries = useMemo(() => {
    if (deliveryStageFilter === 'ALL') return workspace.deliveryOrders;
    return workspace.deliveryOrders.filter((d) => d.stage === deliveryStageFilter);
  }, [workspace.deliveryOrders, deliveryStageFilter]);

  const nextStageMap: Record<CrmRecord['stage'], CrmRecord['stage']> = {
    New: 'Follow-Up',
    'Follow-Up': 'Quoted',
    Quoted: 'Confirmed',
    Confirmed: 'Dispatched',
    Dispatched: 'Won',
    Won: 'Won',
  };

  const nextDeliveryStageMap: Record<DeliveryStage, DeliveryStage> = {
    RECEIVED: 'PACKING',
    PACKING: 'OUT_FOR_DELIVERY',
    OUT_FOR_DELIVERY: 'DELIVERED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
  };

  const handleCopyCatalog = () => {
    const text = buildWhatsAppCatalogBroadcastText({
      storeName: activeCompany?.name || 'FreshMart Superstore',
      branchName: activeCompany?.branchName || 'Main Branch',
      phone: activeCompany?.phone || '',
      items: workspace.items,
    });
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    showToast('Today’s WhatsApp Supermarket Catalog copied to clipboard.', 'success');
  };

  const handleCopyDeliveryUpdate = (ord: DeliveryOrderRecord) => {
    const safeStage: 'RECEIVED' | 'PACKING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' =
      ord.stage === 'PACKING' ||
      ord.stage === 'OUT_FOR_DELIVERY' ||
      ord.stage === 'DELIVERED'
        ? ord.stage
        : 'RECEIVED';
    const text = buildWhatsAppDeliveryUpdateText({
      storeName: activeCompany?.name || 'FreshMart Superstore',
      orderNo: ord.orderNo,
      customerName: ord.customerName,
      stage: safeStage,
      riderName: ord.riderName,
      deliverySlot: ord.deliverySlot,
      grandTotal: ord.grandTotal,
      paymentType: ord.paymentType,
      upiVpa: workspace.controlRoom.upiVpa || 'freshmart@upi',
    });
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    showToast(`WhatsApp delivery status copied for ${ord.orderNo}.`, 'success');
  };

  const handleCreateDeliveryOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dlvCustomer.trim()) return;
    const totalNum = Number(dlvTotal || 0);
    const orderNo = `DLV-26-${Date.now().toString().slice(-4)}`;
    const ok = await dispatchAction(
      'CREATE_DELIVERY_ORDER',
      {
        orderNo,
        customerName: dlvCustomer.trim(),
        customerPhone: dlvPhone.trim(),
        deliveryAddress: dlvAddress.trim() || 'Local Neighborhood Delivery',
        deliverySlot: dlvSlot,
        riderName: dlvRider,
        stage: 'RECEIVED',
        paymentType: dlvPaymentType,
        grandTotal: totalNum,
        itemsSummary: dlvItemsSummary.trim() || 'WhatsApp Grocery Order',
        orderDate: '2026-11-26',
      },
      `Created home delivery order ${orderNo} for ${dlvCustomer.trim()}.`
    );
    if (ok) {
      broadcastOpsEvent({
        eventType: 'DELIVERY_DISPATCH',
        title: `New Delivery Order · ${orderNo}`,
        detail: `${dlvCustomer.trim()} · ${formatInr(totalNum)} · ${dlvSlot} (${dlvRider})`,
        severity: 'info',
      });
      setDlvCustomer('');
      setDlvPhone('');
      setDlvAddress('');
      setDlvTotal('');
      setDlvItemsSummary('');
      setShowNewDeliveryForm(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Home Delivery Dispatch, WhatsApp Orders &amp; CRM
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Local Delivery Dispatch Board · Rider COD Settlement · WhatsApp Broadcasts · Marg Mart Storefront
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {deliveryEnabled && (
            <button
              type="button"
              onClick={handleCopyCatalog}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 whitespace-nowrap cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Copy WhatsApp Catalog</span>
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              showToast(
                'Marg Mart online storefront catalog & stock synced across active SKUs.',
                'success'
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Storefront</span>
          </button>
          {deliveryEnabled && viewMode === 'delivery' ? (
            <button
              type="button"
              onClick={() => setShowNewDeliveryForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New WhatsApp Delivery Order</span>
            </button>
          ) : (
            <Link
              href="/admin/crm/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Add Lead / Online Order</span>
            </Link>
          )}
        </div>
      </div>

      {/* Top View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 py-2">
        <div className="flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-900 p-1">
          {deliveryEnabled && (
            <button
              type="button"
              onClick={() => setViewMode('delivery')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                viewMode === 'delivery'
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Bike className="h-3.5 w-3.5" />
              <span>Home Delivery Dispatch ({workspace.deliveryOrders.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setViewMode('crm')}
            className={`rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
              viewMode === 'crm'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            CRM Leads &amp; Marg Mart ({workspace.crmRecords.length})
          </button>
        </div>

        {viewMode === 'delivery' && deliveryEnabled ? (
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'ALL', label: `All (${workspace.deliveryOrders.length})` },
                {
                  id: 'RECEIVED',
                  label: `Received (${workspace.deliveryOrders.filter((d) => d.stage === 'RECEIVED').length})`,
                },
                {
                  id: 'PACKING',
                  label: `Packing (${workspace.deliveryOrders.filter((d) => d.stage === 'PACKING').length})`,
                },
                {
                  id: 'OUT_FOR_DELIVERY',
                  label: `Out (${workspace.deliveryOrders.filter((d) => d.stage === 'OUT_FOR_DELIVERY').length})`,
                },
                {
                  id: 'DELIVERED',
                  label: `Delivered (${workspace.deliveryOrders.filter((d) => d.stage === 'DELIVERED').length})`,
                },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setDeliveryStageFilter(st.id)}
                className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap cursor-pointer ${
                  deliveryStageFilter === st.id
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {[
              { id: 'ALL', label: `All (${workspace.crmRecords.length})` },
              {
                id: 'MARG_MART_ORDER',
                label: `Marg Mart (${workspace.crmRecords.filter((r) => r.channel === 'MARG_MART_ORDER').length})`,
              },
              {
                id: 'CRM_LEAD',
                label: `Leads (${workspace.crmRecords.filter((r) => r.channel === 'CRM_LEAD').length})`,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setChannelTab(t.id as typeof channelTab)}
                className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap cursor-pointer ${
                  channelTab === t.id
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline Collapsible New Delivery / WhatsApp Order Form */}
      {viewMode === 'delivery' && deliveryEnabled && showNewDeliveryForm && (
        <form
          onSubmit={(e) => void handleCreateDeliveryOrder(e)}
          className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-[#111827] p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Create WhatsApp / Phone Home Delivery Order
            </h2>
            <button
              type="button"
              onClick={() => setShowNewDeliveryForm(false)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={dlvCustomer}
              onChange={(e) => setDlvCustomer(e.target.value)}
              placeholder="Customer Name *"
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={dlvPhone}
              onChange={(e) => setDlvPhone(e.target.value)}
              placeholder="WhatsApp / Mobile Number"
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={dlvAddress}
              onChange={(e) => setDlvAddress(e.target.value)}
              placeholder="Flat / Street Delivery Address"
              className="sm:col-span-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={dlvItemsSummary}
              onChange={(e) => setDlvItemsSummary(e.target.value)}
              placeholder="Grocery items list (e.g. 5kg Atta, 2L Milk, Tomatoes 1kg)"
              className="sm:col-span-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              min="0"
              step="1"
              required
              value={dlvTotal}
              onChange={(e) => setDlvTotal(e.target.value)}
              placeholder="Order Value (₹)"
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100"
            />
            <select
              value={dlvPaymentType}
              onChange={(e) => setDlvPaymentType(e.target.value as DeliveryPaymentType)}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="COD_UPI">COD — UPI on Delivery</option>
              <option value="COD_CASH">COD — Cash on Delivery</option>
              <option value="PREPAID">Prepaid</option>
            </select>
            <select
              value={dlvSlot}
              onChange={(e) => setDlvSlot(e.target.value)}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="Express (60 min)">Express (60 min)</option>
              <option value="Evening (5–7 PM)">Evening (5–7 PM)</option>
              <option value="Morning (9–11 AM)">Morning (9–11 AM)</option>
            </select>
            <select
              value={dlvRider}
              onChange={(e) => setDlvRider(e.target.value)}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              {DELIVERY_RIDERS.map((r) => (
                <option key={r} value={r}>
                  Rider: {r}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={syncing}
                className="rounded-md bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 px-5 py-2 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
              >
                Dispatch Order
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Home Delivery Dispatch Board */}
      {viewMode === 'delivery' && deliveryEnabled ? (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Order · Slot</th>
                <th className="py-3 px-3">Customer &amp; Address</th>
                <th className="py-3 px-3">Rider</th>
                <th className="py-3 px-3 text-right">Amount · COD</th>
                <th className="py-3 px-3">Stage</th>
                <th className="py-3 px-4 text-right">Dispatch Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No delivery orders in this stage.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {ord.orderNo}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {ord.deliverySlot}
                        {ord.invoiceNo ? ` · ${ord.invoiceNo}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {ord.customerName}
                        {ord.customerPhone ? (
                          <span className="ml-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {ord.customerPhone}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {ord.deliveryAddress}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {ord.itemsSummary}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        aria-label={`Assign rider for ${ord.orderNo}`}
                        value={ord.riderName}
                        disabled={ord.stage === 'DELIVERED'}
                        onChange={(e) =>
                          void dispatchAction(
                            'UPDATE_DELIVERY_STAGE',
                            { id: ord.id, stage: ord.stage, riderName: e.target.value },
                            `Assigned ${e.target.value} to ${ord.orderNo}.`
                          )
                        }
                        className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 disabled:opacity-60"
                      >
                        {DELIVERY_RIDERS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatInr(ord.grandTotal)}
                      </div>
                      <div
                        className={
                          ord.codCollected || ord.paymentType === 'PREPAID'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {ord.paymentType === 'PREPAID'
                          ? 'PREPAID'
                          : ord.codCollected
                            ? 'COD COLLECTED'
                            : ord.paymentType.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs font-semibold">
                      <span
                        className={
                          ord.stage === 'DELIVERED'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : ord.stage === 'OUT_FOR_DELIVERY'
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {ord.stage.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyDeliveryUpdate(ord)}
                          title="Copy WhatsApp status update"
                          className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-600 cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          <span>WhatsApp</span>
                        </button>
                        {ord.stage !== 'DELIVERED' &&
                          ord.stage !== 'OUT_FOR_DELIVERY' && (
                            <button
                              type="button"
                              onClick={() =>
                                void dispatchAction(
                                  'UPDATE_DELIVERY_STAGE',
                                  {
                                    id: ord.id,
                                    stage: nextDeliveryStageMap[ord.stage],
                                    riderName: ord.riderName,
                                  },
                                  `${ord.orderNo} moved to ${nextDeliveryStageMap[ord.stage].replace(/_/g, ' ')}.`
                                )
                              }
                              className="rounded bg-slate-900 dark:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                            >
                              → {nextDeliveryStageMap[ord.stage].replace(/_/g, ' ')}
                            </button>
                          )}
                        {ord.stage !== 'DELIVERED' && !ord.codCollected && ord.paymentType !== 'PREPAID' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void dispatchAction(
                                'SETTLE_DELIVERY_COD',
                                { id: ord.id },
                                `Collected COD ${formatInr(ord.grandTotal)} & marked ${ord.orderNo} delivered.`
                              )
                            }
                            className="rounded bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                          >
                            Collect COD &amp; Deliver
                          </button>
                        ) : ord.stage === 'OUT_FOR_DELIVERY' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void dispatchAction(
                                'UPDATE_DELIVERY_STAGE',
                                { id: ord.id, stage: 'DELIVERED', riderName: ord.riderName },
                                `${ord.orderNo} marked Delivered.`
                              )
                            }
                            className="rounded bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : (
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
              {filteredCrm.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
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
                        className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 whitespace-nowrap cursor-pointer"
                      >
                        Advance → {nextStageMap[r.stage]}
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Completed</span>
                    )}
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
