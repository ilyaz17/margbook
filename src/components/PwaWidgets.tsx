'use client';

import React, { useState } from 'react';
import { Download, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { canInstall, isInstalled, isIOS, installApp } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isInstalled) return null;

  if (isIOS && !canInstall) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIosGuide((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
          title="Install POS App on iOS"
        >
          <Share className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Install App</span>
        </button>
        {showIosGuide && (
          <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-lg z-40 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Add FreshMart POS to Home Screen
              </span>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Tap the <span className="font-semibold">Share</span> icon in Safari, then choose{' '}
              <span className="font-semibold">Add to Home Screen</span> for full-screen POS billing.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => void installApp()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
      title="Install FreshMart Supermarket POS App"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden md:inline">Install App</span>
    </button>
  );
}

interface OfflineIndicatorProps {
  isOnline: boolean;
  queuedCount: number;
  isSyncing: boolean;
  onSyncNow: () => void;
}

export function OfflineIndicator({
  isOnline,
  queuedCount,
  isSyncing,
  onSyncNow,
}: OfflineIndicatorProps) {
  if (isOnline && queuedCount === 0) return null;

  return (
    <div
      className={`border-b px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${
        !isOnline
          ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100'
          : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100'
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {!isOnline ? (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0" />
            <span>
              Offline Billing Mode Active — bills are safely queued locally and will auto-sync when
              internet returns.
            </span>
          </>
        ) : (
          <>
            <RefreshCw
              className={`h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 shrink-0 ${
                isSyncing ? 'animate-spin' : ''
              }`}
            />
            <span className="tabular-nums">
              {queuedCount} queued offline bill{queuedCount === 1 ? '' : 's'} ready to sync.
            </span>
          </>
        )}
      </div>

      {queuedCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold tabular-nums">
            Queued: {queuedCount}
          </span>
          {isOnline && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={onSyncNow}
              className="rounded-md bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
