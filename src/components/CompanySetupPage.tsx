'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, Plus } from 'lucide-react';
import { useMargBooks } from './MargBooksContext';

const INDIAN_STATES = [
  { code: '07', name: 'Delhi' },
  { code: '27', name: 'Maharashtra' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '29', name: 'Karnataka' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '36', name: 'Telangana' },
  { code: '19', name: 'West Bengal' },
];

export function CompanySetupPage() {
  const router = useRouter();
  const { workspace, switchCompany, dispatchAction, syncing } = useMargBooks();
  const [name, setName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateCode, setStateCode] = useState('33');
  const [financialYear, setFinancialYear] = useState('2026-27');
  const [currency, setCurrency] = useState('INR');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingCash, setOpeningCash] = useState('5000');

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const stateObj = INDIAN_STATES.find((s) => s.code === stateCode) || INDIAN_STATES[0];
    const ok = await dispatchAction(
      'CREATE_COMPANY',
      {
        name: name.trim(),
        branchName: branchName.trim() || 'Main Flagship Store',
        gstin: gstin.trim().toUpperCase(),
        stateCode: stateObj.code,
        stateName: stateObj.name,
        financialYear,
        currency,
        phone: phone.trim(),
        address: address.trim(),
        openingCash: Number(openingCash || 5000),
      },
      `Company "${name.trim()}" onboarded and activated.`
    );
    if (ok) {
      setName('');
      setBranchName('');
      setGstin('');
      setPhone('');
      setAddress('');
      router.push('/admin/dashboard');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Company Onboarding &amp; Multi-Branch Setup
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Switch active companies, inspect GSTIN/FY registrations, or onboard a new retail store or
          distribution branch.
        </p>
      </div>

      {/* Existing Companies / Branches */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workspace.companies.map((comp) => {
          const isActive = comp.id === workspace.activeCompanyId;
          return (
            <div
              key={comp.id}
              className={`rounded-lg border p-5 flex flex-col justify-between gap-4 bg-white ${
                isActive ? 'border-teal-600 ring-1 ring-teal-600/20' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="h-5 w-5 text-teal-700 shrink-0" />
                    <h2 className="font-display text-base font-bold text-slate-900 truncate">
                      {comp.name}
                    </h2>
                  </div>
                  <span className="text-xs font-medium text-teal-800 whitespace-nowrap shrink-0">
                    {isActive ? 'Active Workspace' : comp.currency}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">{comp.branchName}</p>
                <p className="mt-1 text-xs text-slate-500">{comp.address}</p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600">
                  <span>GSTIN: {comp.gstin}</span>
                  <span>·</span>
                  <span>
                    {comp.stateName} ({comp.stateCode})
                  </span>
                  <span>·</span>
                  <span>FY {comp.financialYear}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {comp.fyLocked ? 'Books Locked' : 'Books Open'}
                </span>
                {isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800">
                    <Check className="h-3.5 w-3.5" />
                    <span>Currently Selected</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void switchCompany(comp.id)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Switch to This Branch
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Register New Company / Branch Form */}
      <form
        onSubmit={(e) => void handleCreateCompany(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Onboard New Company or Retail Branch
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Automatically initializes default Control Room configuration, POS-01 counter, and base
            cash/walk-in ledgers for the new branch.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="comp-name" className="block text-xs font-medium text-slate-700 mb-1">
              Company Legal Name
            </label>
            <input
              id="comp-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kaveri Fresh Supermart Pvt. Ltd."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="comp-branch" className="block text-xs font-medium text-slate-700 mb-1">
              Branch / Store Name
            </label>
            <input
              id="comp-branch"
              type="text"
              required
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="e.g. Anna Nagar Express Store"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="comp-gstin" className="block text-xs font-medium text-slate-700 mb-1">
              15-Digit GSTIN
            </label>
            <input
              id="comp-gstin"
              type="text"
              required
              minLength={15}
              maxLength={15}
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="33AABCK4412M1Z9"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm uppercase text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="comp-state" className="block text-xs font-medium text-slate-700 mb-1">
              GST State Jurisdiction
            </label>
            <select
              id="comp-state"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.code} — {st.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="comp-fy" className="block text-xs font-medium text-slate-700 mb-1">
              Financial Year
            </label>
            <select
              id="comp-fy"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              <option value="2026-27">FY 2026-27</option>
              <option value="2025-26">FY 2025-26</option>
            </select>
          </div>

          <div>
            <label htmlFor="comp-currency" className="block text-xs font-medium text-slate-700 mb-1">
              Base Currency
            </label>
            <select
              id="comp-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              <option value="INR">INR (₹)</option>
              <option value="AED">AED (د.إ)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          <div>
            <label htmlFor="comp-phone" className="block text-xs font-medium text-slate-700 mb-1">
              Store Phone
            </label>
            <input
              id="comp-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98400 12345"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="comp-cash" className="block text-xs font-medium text-slate-700 mb-1">
              Initial POS-01 Cash Float (INR)
            </label>
            <input
              id="comp-cash"
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="comp-address" className="block text-xs font-medium text-slate-700 mb-1">
              Registered Store Address
            </label>
            <input
              id="comp-address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Plot 14, 2nd Avenue, Anna Nagar, Chennai - 600040"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{syncing ? 'Provisioning Branch...' : 'Create Company & Switch Workspace'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
