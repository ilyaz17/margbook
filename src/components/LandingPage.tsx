'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check } from 'lucide-react';
import { motion } from 'motion/react';
import heroSupermarketPosImg from '../assets/images/hero_supermarket_pos_1795762057668.jpg';
import showcaseSupermarketAislesImg from '../assets/images/showcase_supermarket_aisles_1795762057313.jpg';
import { useMargBooks } from './MargBooksContext';

type PreviewTab = 'pos' | 'split' | 'bill';

const POS_PREVIEW_TABS: Record<
  PreviewTab,
  {
    label: string;
    heading: string;
    summary: string;
    metrics: Array<{ label: string; value: string }>;
    rows: Array<{ col1: string; col2: string; col3: string }>;
  }
> = {
  pos: {
    label: 'Fast Barcode & Loose KG',
    heading: 'Sub-second barcode scanning, loose produce weighing, and auto offers',
    summary:
      'Scan EAN-13 grocery packs with qty*barcode shortcuts, weigh loose tomatoes or dal in 250g/500g/1kg presets, park carts mid-queue, and apply supermarket combo offers automatically.',
    metrics: [
      { label: 'Average Checkout Time', value: '6.2 sec' },
      { label: 'Loose Weight Precision', value: '0.001 KG' },
      { label: 'Quick Hotkeys', value: 'F2 / F4 / F12' },
    ],
    rows: [
      { col1: 'India Gate Basmati Rice 5kg · MRP ₹685', col2: '1 BAG · 4% Bulk Offer · 5% GST', col3: '₹593.71' },
      { col1: 'Fresh Farm Tomatoes (Loose) · PLU 200101', col2: '1.50 KG × ₹38/kg · 0% GST', col3: '₹57.00' },
      { col1: 'Amul Pasteurised Butter 500g · MRP ₹285', col2: '1 PAC · Save ₹31 · 12% GST', col3: '₹284.48' },
    ],
  },
  split: {
    label: 'Split Multi-Payment',
    heading: 'Collect Cash, UPI, Card, Wallet, and PDC across every billing lane',
    summary:
      'Tap F8 for exact Cash or F9 for exact UPI, split grocery bills across multiple tender modes with instant change-to-return math, and track every checkout lane cash drawer live.',
    metrics: [
      { label: 'Supported Modes', value: '5 Tenders' },
      { label: 'Shopper Loyalty', value: '₹1 / Point' },
      { label: 'Lane Cash Tracking', value: 'Live Shift' },
    ],
    rows: [
      { col1: 'UPI QR Settlement (LANE-01)', col2: 'Ref UPI-6339028191', col3: '₹1,000.00' },
      { col1: 'Cash Drawer (LANE-01)', col2: 'Exact Balance Tendered', col3: '₹253.00' },
      { col1: 'Shopper MRP Savings Today', col2: 'Family Gold · Earned +25 pts', col3: '₹206.56' },
    ],
  },
  bill: {
    label: '80mm Thermal & MRP Savings',
    heading: 'Instant supermarket receipts with MRP savings, HSN breakup & WhatsApp share',
    summary:
      'Every completed checkout opens a dedicated printable receipt page with one-click switching between 80mm thermal slip, 58mm compact slip, and A4 B2B GST tax invoice.',
    metrics: [
      { label: 'Receipt Formats', value: '58mm / 80mm / A4' },
      { label: 'Savings Callout', value: 'MRP vs Rate' },
      { label: 'Print Mode', value: 'Clean CSS' },
    ],
    rows: [
      { col1: 'Store Rate Subtotal (5 items · 5.5 Qty/Kg)', col2: 'Intra-State CGST + SGST', col3: '₹1,219.00' },
      { col1: 'Scheme & Offer Discount + GST', col2: 'Auto Slab Match (0/5/12/18%)', col3: '₹34.28' },
      { col1: 'Net Payable · YOU SAVED ₹206.56!', col2: 'Status: Paid · LANE-01', col3: '₹1,253.00' },
    ],
  },
};

const MODULES_BENTO = [
  {
    index: '01',
    title: 'High-Speed Supermarket POS & Multi-Lane Checkout',
    detail:
      'Auto-focus qty*barcode scanning, inline loose-weight kg/gm presets, parked customer carts (F4), one-tap essentials, live MRP savings, and 80mm thermal/A4 receipts.',
    meta: 'F2 Scan · F4 Hold · F8 Cash · F9 UPI · F12 Print',
    span: 'lg:col-span-2',
  },
  {
    index: '02',
    title: 'Fresh Produce, Loose Stock & Best-Before Control',
    detail:
      'Decimal kg stock tracking across store floor, chillers, and backroom godowns with near-expiry perishable alerts, dump logs, and auto-reorder levels.',
    meta: 'Decimal KG Stock · Chiller & Floor Godowns',
    span: 'lg:col-span-1',
  },
  {
    index: '03',
    title: 'GST Compliance, E-Invoice & E-Way',
    detail:
      'Generate 64-character IRN references, E-Way bill numbers, GSTR-2A/2B purchase matching, GSTR-3B summaries, and portal-ready GSTR-1 JSON.',
    meta: 'GST3.1.6 JSON · CGST/SGST/IGST',
    span: 'lg:col-span-1',
  },
  {
    index: '04',
    title: 'Double-Entry Accounting, Banking & PDC',
    detail:
      'Receipt, Payment, Contra, Journal, Debit/Credit Notes with party-wise ledger profiles, Post-Dated Cheque tracking, and bank reconciliation.',
    meta: 'F6 Vouchers · Trial Balance & P&L',
    span: 'lg:col-span-2',
  },
  {
    index: '05',
    title: 'Purchase Bills & CSV Invoice Import',
    detail:
      'Import supplier bills directly from CSV spreadsheets into live stock batches while comparing historical supplier purchase rates.',
    meta: 'F9 Purchases · Auto Batch Entry',
    span: 'lg:col-span-1',
  },
  {
    index: '06',
    title: 'Control Room, Shift Handovers & Branches',
    detail:
      'Configure billing policies, paper widths, financial year locks, multi-branch company onboarding, and audited cashier shift cash variance logs.',
    meta: 'Alt+C Control Room · RBAC Roles',
    span: 'lg:col-span-2',
  },
];

const PRICING_PLANS = [
  {
    audience: 'For Single Retail Stores',
    name: 'Silver Retail',
    price: '₹999',
    cadence: 'per month · billed annually',
    summary: 'Complete GST billing, barcode POS, batch expiry alerts, and daily cash summary for one store.',
    limits: [
      '1 Company · 1 Branch · 2 POS Counters',
      'Unlimited GST & Thermal Invoices',
      'GSTR-1 JSON & GSTR-3B Reports',
      'Automated Cloud Sync & Daily Backup',
    ],
    featured: false,
  },
  {
    audience: 'For Multi-Lane Supermarkets & Hypermarkets',
    name: 'Gold Multi-Lane',
    price: '₹2,499',
    cadence: 'per month · billed annually',
    summary: 'Full 11-module Supermarket ERP with loose-weight kg POS, auto-offers, loyalty points, CSV purchase import, and lane shift handovers.',
    limits: [
      '3 Companies · 5 Branches · 10 POS Counters',
      'Auto Schemes, Loyalty Points & Marg Mart CRM',
      'Direct E-Invoice IRN, E-Way Bill & Banking PDC',
      'Role-Based Access (Admin, Manager, Cashier, CA)',
    ],
    featured: true,
  },
  {
    audience: 'For Multi-Branch Retail Chains',
    name: 'Enterprise Cloud',
    price: '₹4,999',
    cadence: 'per month · billed annually',
    summary: 'Centralized multi-branch stock transfers, BOM assembly, financial year locking, and custom Control Room rules.',
    limits: [
      'Unlimited Companies, Branches & Counters',
      'Multi-Godown Transfers & BOM Manufacturing',
      'Consolidated P&L, Balance Sheet & Audit Logs',
      'Dedicated Onboarding & Priority Migration Support',
    ],
    featured: false,
  },
];

export function LandingPage() {
  const { user } = useMargBooks();
  const [activeTab, setActiveTab] = useState<PreviewTab>('pos');
  const currentPreview = POS_PREVIEW_TABS[activeTab];
  const primaryHref = user ? '/admin/dashboard' : '/login';

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-6 py-4">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            MargBooks
          </Link>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#modules"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Modules
            </a>
            <a
              href="#retail-pos"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Retail POS
            </a>
            <a
              href="#proof"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Compliance
            </a>
            <a
              href="#pricing"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              <span>{user ? 'Open Dashboard' : 'Sign In'}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section — Balanced 2-Column Split */}
        <section className="border-b border-slate-200 bg-slate-50/70">
          <div className="mx-auto max-w-[1280px] px-6 py-14 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="lg:col-span-6 flex flex-col justify-between py-2"
              >
                <div>
                  <p className="text-xs font-medium text-teal-800">
                    Supermarket POS &amp; Cloud ERP · Loose KG Ready · GST Compliant
                  </p>
                  <h1
                    className="mt-4 font-display font-bold tracking-tight text-slate-950 leading-[1.08]"
                    style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)' }}
                  >
                    Fast supermarket billing, loose-weight inventory, and GST accounting in one desk.
                  </h1>
                  <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-slate-600">
                    Run rush-hour barcode and produce weighing lanes without popups, park carts
                    mid-queue, print MRP-savings thermal receipts, reconcile lane cash shifts, and
                    file portal-ready GSTR-1 returns from any browser.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <Link
                    href={primaryHref}
                    className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{user ? 'Go to Admin Dashboard' : 'Continue with Google Sign-In'}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                  <a
                    href="#retail-pos"
                    className="text-sm font-medium text-slate-700 underline underline-offset-4 decoration-slate-300 hover:text-teal-800 hover:decoration-teal-600 transition-colors whitespace-nowrap"
                  >
                    Inspect POS Checkout Flow
                  </a>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="lg:col-span-6"
              >
                <div className="relative h-[300px] sm:h-[380px] lg:h-full min-h-[340px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
                  <Image
                    src={heroSupermarketPosImg}
                    alt="Modern Indian supermarket checkout lane with cashier scanning packaged grocery staples, fresh tomatoes, and dairy cartons on a touch-screen POS"
                    fill
                    priority
                    referrerPolicy="no-referrer"
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>
              </motion.div>
            </div>

            {/* Full-Width 4-Column Quantified Strip */}
            <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
              <div className="bg-white p-5">
                <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  11 Modules
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  POS, Masters, Inventory, Accounting, Banking & GST
                </div>
              </div>
              <div className="bg-white p-5">
                <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  &lt; 8 sec
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Barcode scan to printed 80mm thermal or A4 GST bill
                </div>
              </div>
              <div className="bg-white p-5">
                <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  100% GST
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Automated CGST/SGST/IGST, IRN, E-Way & GSTR-1 JSON
                </div>
              </div>
              <div className="bg-white p-5">
                <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  Zero Modals
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Dedicated bookmarkable routes for bills, forms & shifts
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Modules — Asymmetric Bento Grid */}
        <section id="modules" className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-teal-800">Complete Operational Suite</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              Every counter, godown, and tax register unified on one ledger.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Each module runs on its own clean URL route so billing operators, store managers, and
              accountants can work across tabs, print invoices directly, and navigate with F-keys.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {MODULES_BENTO.map((mod) => (
              <article
                key={mod.index}
                className={`${mod.span} flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6`}
              >
                <div>
                  <div className="font-mono text-xs font-medium text-teal-700">
                    {mod.index}.
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold text-slate-900">
                    {mod.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{mod.detail}</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  {mod.meta}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Interactive Retail POS Preview — Mechanism-to-Outcome Showcase */}
        <section id="retail-pos" className="border-y border-slate-200 bg-slate-50/70">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-medium text-teal-800">Retail POS Architecture</p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
                  Built for rush-hour counters with zero popup friction.
                </h2>
              </div>

              <div
                role="tablist"
                aria-label="Retail POS capabilities"
                className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/80 p-1"
              >
                {(Object.keys(POS_PREVIEW_TABS) as PreviewTab[]).map((tabKey) => {
                  const active = activeTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tabKey)}
                      className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {POS_PREVIEW_TABS[tabKey].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-xl font-semibold text-slate-900">
                    {currentPreview.heading}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {currentPreview.summary}
                  </p>

                  <div className="mt-6 grid grid-cols-3 gap-4 border-y border-slate-100 py-4">
                    {currentPreview.metrics.map((m) => (
                      <div key={m.label}>
                        <div className="text-xs text-slate-500">{m.label}</div>
                        <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 divide-y divide-slate-100">
                    {currentPreview.rows.map((row) => (
                      <div
                        key={row.col1}
                        className="flex items-center justify-between gap-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{row.col1}</div>
                          <div className="text-xs text-slate-500">{row.col2}</div>
                        </div>
                        <div className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                          {row.col3}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    Sign in to launch live Retail POS and print test bills
                  </span>
                  <Link
                    href={primaryHref}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0"
                  >
                    <span>Launch POS Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-5">
                <div className="relative h-60 lg:flex-1 min-h-[240px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
                  <Image
                    src={showcaseSupermarketAislesImg}
                    alt="Modern Indian supermarket fresh produce crates with weighing scale alongside neatly stocked staples and dairy chillers"
                    fill
                    referrerPolicy="no-referrer"
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 42vw"
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-teal-800">
                    Shift Accountability · RBAC Ready
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    Close every counter shift with live expected-vs-counted cash reconciliation,
                    variance notes, and incoming cashier sign-off saved in your audit trail.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quantified Proof & Customer Outcomes */}
        <section id="proof" className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-teal-800">Measured Supermarket Outcomes</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              Proven across Indian supermarkets, grocery chains, and wholesale marts.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <article className="rounded-lg border border-slate-200 bg-white p-6 flex flex-col justify-between">
              <div>
                <div className="font-mono text-2xl font-bold text-teal-800 tabular-nums">
                  -64% Perishable Spoilage
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Tracking fresh produce by decimal KG alongside 30-day best-before dairy and
                  packaged food alerts cut shelf write-offs sharply across our floor and chillers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <div className="font-semibold text-slate-900">Rajeshwar Sharma</div>
                <div>Managing Partner · FreshMart Superstore, Bengaluru</div>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-6 flex flex-col justify-between">
              <div>
                <div className="font-mono text-2xl font-bold text-teal-800 tabular-nums">
                  4.5 hrs Saved Weekly
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Importing FMCG distributor purchase bills via CSV directly into shelf stock
                  eliminated manual 80-line invoice entry and matched GSTR-2B input credit cleanly.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <div className="font-semibold text-slate-900">Meenakshi Sundaram</div>
                <div>Operations Head · Kaveri Fresh Supermart, Chennai</div>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-6 flex flex-col justify-between">
              <div>
                <div className="font-mono text-2xl font-bold text-teal-800 tabular-nums">
                  ₹0 Unexplained Cash Gap
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Dedicated multi-lane shift handovers separated Cash, UPI, Card, and PDC
                  collections per cashier, cutting evening closing reconciliation from 45 minutes to
                  under 6 minutes.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <div className="font-semibold text-slate-900">Pradeep Deshmukh</div>
                <div>Director · Sahyadri Wholesale Mart, Pune</div>
              </div>
            </article>
          </div>
        </section>

        {/* Transparent INR Pricing */}
        <section id="pricing" className="border-t border-slate-200 bg-slate-50/70">
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-teal-800">Simple Annual Licensing</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
                Transparent plans built for Indian retail margins.
              </h2>
            </div>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {PRICING_PLANS.map((plan) => (
                <article
                  key={plan.name}
                  className={`flex flex-col justify-between rounded-xl border bg-white p-6 ${
                    plan.featured ? 'border-teal-600 ring-1 ring-teal-600/20' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="text-xs font-medium text-teal-800">{plan.audience}</div>
                    <h3 className="mt-1.5 font-display text-xl font-bold text-slate-900">
                      {plan.name}
                    </h3>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-bold text-slate-950 tabular-nums">
                        {plan.price}
                      </span>
                      <span className="text-xs text-slate-500">{plan.cadence}</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{plan.summary}</p>

                    <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-5 text-sm text-slate-700">
                      {plan.limits.map((lim) => (
                        <li key={lim} className="flex items-start gap-2.5">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-7">
                    <Link
                      href={primaryHref}
                      className={`w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                        plan.featured
                          ? 'bg-teal-700 text-white hover:bg-teal-800'
                          : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span>{user ? 'Open Workspace' : 'Start with Google Sign-In'}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold text-slate-900">MargBooks</span>
            <span aria-hidden="true">·</span>
            <span>Cloud ERP, GST Accounting & Retail POS</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#modules" className="hover:text-slate-900">
              Modules
            </a>
            <a href="#retail-pos" className="hover:text-slate-900">
              Retail POS
            </a>
            <a href="#pricing" className="hover:text-slate-900">
              Pricing
            </a>
            <Link href={primaryHref} className="font-medium text-teal-800 hover:text-teal-950">
              {user ? 'Dashboard' : 'Sign In'}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
