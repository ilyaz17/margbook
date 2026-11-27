import React from 'react';
import { AdminShellLayout } from '../../src/components/AdminShellLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShellLayout>{children}</AdminShellLayout>;
}
