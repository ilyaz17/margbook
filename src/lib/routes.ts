import type { ModuleId } from '../types/erp';

export interface RouteMeta {
  id: ModuleId;
  href: string;
  label: string;
  section: 'Core' | 'Operations' | 'Finance & Tax' | 'System';
  shortcut?: string;
}

export const MODULE_ROUTES: RouteMeta[] = [
  { id: 'dashboard', href: '/admin/dashboard', label: 'Dashboard', section: 'Core' },
  { id: 'pos', href: '/admin/pos', label: 'Retail POS', shortcut: 'F2', section: 'Core' },
  { id: 'shifts', href: '/admin/shifts', label: 'Shifts & Cash', shortcut: 'Alt+S', section: 'Core' },
  { id: 'masters', href: '/admin/masters', label: 'Master Module', section: 'Operations' },
  { id: 'sales', href: '/admin/sales', label: 'Sale & Billing', shortcut: 'F8', section: 'Operations' },
  { id: 'purchases', href: '/admin/purchases', label: 'Purchase Module', shortcut: 'F9', section: 'Operations' },
  { id: 'inventory', href: '/admin/inventory', label: 'Stock & Inventory', section: 'Operations' },
  { id: 'barcodes', href: '/admin/barcodes', label: 'Barcode Studio', shortcut: 'Alt+B', section: 'Operations' },
  { id: 'accounting', href: '/admin/accounting', label: 'Accounting', shortcut: 'F6', section: 'Finance & Tax' },
  { id: 'banking', href: '/admin/banking', label: 'Banking & PDC', section: 'Finance & Tax' },
  { id: 'gst', href: '/admin/gst', label: 'GST & E-Invoice', section: 'Finance & Tax' },
  { id: 'crm', href: '/admin/crm', label: 'CRM & Marg Mart', section: 'Finance & Tax' },
  { id: 'reports', href: '/admin/reports', label: 'Reports & P&L', section: 'System' },
  { id: 'addons', href: '/admin/addons', label: 'Add-On Modules', shortcut: 'Alt+A', section: 'System' },
  { id: 'company-setup', href: '/admin/company/setup', label: 'Company & Branches', section: 'System' },
  { id: 'control-room', href: '/admin/control-room', label: 'Control Room', shortcut: 'Alt+C', section: 'System' },
  { id: 'search', href: '/admin/search', label: 'Search & Keys', shortcut: 'Alt+K', section: 'System' },
];

export const MODULE_HREF_MAP: Record<ModuleId, string> = MODULE_ROUTES.reduce(
  (acc, item) => {
    acc[item.id] = item.href;
    return acc;
  },
  {} as Record<ModuleId, string>
);

export function resolveModuleFromPathname(pathname: string): ModuleId {
  if (pathname.startsWith('/admin/pos') || pathname.startsWith('/admin/bills')) return 'pos';
  if (pathname.startsWith('/admin/shifts')) return 'shifts';
  if (pathname.startsWith('/admin/barcodes')) return 'barcodes';
  if (pathname.startsWith('/admin/addons')) return 'addons';
  if (pathname.startsWith('/admin/masters') || pathname.startsWith('/admin/ledgers')) return 'masters';
  if (pathname.startsWith('/admin/sales')) return 'sales';
  if (pathname.startsWith('/admin/purchases')) return 'purchases';
  if (pathname.startsWith('/admin/inventory')) return 'inventory';
  if (pathname.startsWith('/admin/accounting')) return 'accounting';
  if (pathname.startsWith('/admin/banking')) return 'banking';
  if (pathname.startsWith('/admin/gst')) return 'gst';
  if (pathname.startsWith('/admin/crm')) return 'crm';
  if (pathname.startsWith('/admin/reports')) return 'reports';
  if (pathname.startsWith('/admin/company')) return 'company-setup';
  if (pathname.startsWith('/admin/control-room')) return 'control-room';
  if (pathname.startsWith('/admin/search')) return 'search';
  return 'dashboard';
}

export function resolveBreadcrumbFromPathname(pathname: string): {
  section: string;
  page: string;
} {
  if (pathname.startsWith('/admin/pos/customer-display')) {
    return { section: 'Core', page: 'Customer Live Display' };
  }
  if (pathname.startsWith('/admin/bills/')) {
    return { section: 'Core', page: 'Digital Bill & Print' };
  }
  if (pathname.startsWith('/admin/ledgers/')) {
    return { section: 'Operations', page: 'Ledger Profile' };
  }
  if (pathname === '/admin/masters/ledgers/new') {
    return { section: 'Master Module', page: 'New Account Ledger' };
  }
  if (pathname === '/admin/masters/items/new') {
    return { section: 'Master Module', page: 'New Inventory Item' };
  }
  if (pathname === '/admin/masters/bom/new') {
    return { section: 'Master Module', page: 'New BOM Formula' };
  }
  if (pathname === '/admin/sales/new') {
    return { section: 'Sale & Billing', page: 'New Sale Document' };
  }
  if (pathname === '/admin/sales/schemes/new') {
    return { section: 'Sale & Billing', page: 'New Promotional Scheme' };
  }
  if (pathname === '/admin/purchases/new') {
    return { section: 'Purchase Module', page: 'New Purchase / Import' };
  }
  if (pathname === '/admin/inventory/movements/new') {
    return { section: 'Stock & Inventory', page: 'Record Stock Movement' };
  }
  if (pathname === '/admin/accounting/vouchers/new') {
    return { section: 'Accounting', page: 'New Accounting Voucher' };
  }
  if (pathname === '/admin/crm/new') {
    return { section: 'CRM & Marg Mart', page: 'New Lead or Order' };
  }

  const modId = resolveModuleFromPathname(pathname);
  const found = MODULE_ROUTES.find((m) => m.id === modId) || MODULE_ROUTES[0];
  return { section: found.section, page: found.label };
}
