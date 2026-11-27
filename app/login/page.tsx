import React, { Suspense } from 'react';
import { LoginPageView } from '../../src/components/LoginPageView';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
          Loading sign-in screen...
        </div>
      }
    >
      <LoginPageView />
    </Suspense>
  );
}
