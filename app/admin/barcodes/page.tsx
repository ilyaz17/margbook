import React, { Suspense } from 'react';
import { BarcodeStudioPage } from '../../../src/components/BarcodeStudioPage';

export default function AdminBarcodesRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
      }
    >
      <BarcodeStudioPage />
    </Suspense>
  );
}
