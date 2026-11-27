'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, LogIn, ShieldCheck } from 'lucide-react';
import loginVisualImg from '../assets/images/login_workspace_visual_1795758704637.jpg';
import { sanitizeNextPath } from '../lib/erp-engine';
import { useMargBooks } from './MargBooksContext';

export function LoginPageView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authLoading, signInWithGoogle } = useMargBooks();
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const safeNext = sanitizeNextPath(searchParams.get('next'));

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(safeNext);
    }
  }, [authLoading, user, safeNext, router]);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSigningIn(true);
    try {
      const ok = await signInWithGoogle();
      if (ok) {
        router.replace(safeNext);
      } else {
        setErrorMessage(
          'Google Sign-In was cancelled or blocked by the browser popup blocker. Please try again.'
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Editorial Panel */}
      <div className="relative hidden lg:flex lg:col-span-6 flex-col justify-between overflow-hidden bg-[#0C2D35] p-10 text-white">
        <Image
          src={loginVisualImg}
          alt="Calm enterprise workspace desk"
          fill
          referrerPolicy="no-referrer"
          className="object-cover opacity-35"
          sizes="50vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#081F25]/95 via-[#0C2D35]/70 to-[#0C2D35]/50"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap"
          >
            MargBooks
          </Link>
          <span className="text-xs text-teal-200/90">Cloud ERP · Retail POS</span>
        </div>

        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="font-display text-3xl font-bold leading-tight text-white">
            Your company books, counters, and GST registers—protected by verified Google identity.
          </h2>
          <p className="text-sm leading-relaxed text-slate-200">
            Every invoice, purchase batch, accounting voucher, and cashier shift handover is
            scoped strictly to your authenticated company workspace.
          </p>
          <div className="pt-4 border-t border-white/15 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-teal-100/90">
            <span className="whitespace-nowrap">Multi-Branch Ready</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">A4 &amp; Thermal Bills</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">Shift Audit Trail</span>
          </div>
        </div>
      </div>

      {/* Right Strict Google Sign-In Panel */}
      <div className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-white">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to MargBooks Home</span>
          </Link>
          <span className="lg:hidden font-display text-sm font-bold text-slate-900">
            MargBooks
          </span>
        </div>

        <div className="mx-auto w-full max-w-md py-12">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-700 text-white font-display font-bold text-lg">
            M
          </div>
          <h1 className="mt-5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Sign in to Admin Dashboard
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Authenticate with your Google account to open your MargBooks ERP workspace, Retail POS
            counters, and GST compliance registers.
          </p>

          {safeNext !== '/admin/dashboard' && (
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
              Sign in required to open{' '}
              <span className="font-mono font-medium text-slate-900">{safeNext}</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <div className="mt-7">
            <button
              type="button"
              disabled={authLoading || signingIn}
              onClick={() => void handleGoogleSignIn()}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <LogIn className="h-4 w-4 shrink-0" />
              <span>
                {authLoading
                  ? 'Checking session...'
                  : signingIn
                    ? 'Connecting to Google...'
                    : 'Continue with Google'}
              </span>
            </button>
          </div>

          <div className="mt-8 space-y-3 border-t border-slate-200 pt-6 text-xs text-slate-500">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700 mt-0.5" />
              <span>
                Strict route protection is enabled across all admin, billing, inventory, and
                financial pages.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 shrink-0 text-teal-700 mt-0.5" />
              <span>
                New Google accounts automatically initialize a starter Indian retail company, and
                you can onboard additional branches anytime in Company Setup.
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          MargBooks Cloud ERP · Strict Authenticated Access
        </div>
      </div>
    </div>
  );
}
