'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider, testConnection } from '../lib/firebase';
import {
  publishOpsEventToFirestore,
  subscribeOpsEventsFromFirestore,
  type RealtimeOpsEvent,
} from '../lib/firestore-realtime';
import { createInitialWorkspaceData } from '../lib/seed-data';
import {
  calculateShiftVariance,
  computeFinancialStatements,
  type FinancialSummary,
} from '../lib/erp-engine';
import { MODULE_HREF_MAP, resolveModuleFromPathname } from '../lib/routes';
import type { ModuleId, UserAccessRole, WorkspaceData } from '../types/erp';

export interface ToastNotice {
  id: number;
  title: string;
  tone: 'success' | 'info' | 'warning' | 'error';
}

export interface QueuedOfflineBill {
  id: string;
  companyId: number;
  queuedAt: string;
  payload: Record<string, unknown>;
}

interface ActionResult {
  ok: boolean;
  data?: WorkspaceData;
}

interface MargBooksContextValue {
  workspace: WorkspaceData;
  workspaceLoaded: boolean;
  activeModule: ModuleId;
  setActiveModule: (mod: ModuleId) => void;
  financials: FinancialSummary;
  user: User | null;
  authLoading: boolean;
  syncing: boolean;
  signInWithGoogle: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  switchCompany: (companyId: number) => Promise<void>;
  dispatchAction: (
    type: string,
    payload: Record<string, unknown>,
    successMessage?: string
  ) => Promise<boolean>;
  dispatchActionWithResult: (
    type: string,
    payload: Record<string, unknown>,
    successMessage?: string
  ) => Promise<ActionResult>;
  toast: ToastNotice | null;
  showToast: (title: string, tone?: ToastNotice['tone']) => void;
  clearToast: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  posFocusMode: boolean;
  setPosFocusMode: (value: boolean) => void;
  togglePosFocusMode: () => void;
  isOnline: boolean;
  offlineQueue: QueuedOfflineBill[];
  queueOfflineInvoice: (payload: Record<string, unknown>) => void;
  flushOfflineQueue: () => Promise<void>;
  liveOpsEvents: RealtimeOpsEvent[];
  broadcastOpsEvent: (event: {
    eventType: RealtimeOpsEvent['eventType'];
    title: string;
    detail: string;
    severity?: RealtimeOpsEvent['severity'];
  }) => void;
}

const MargBooksContext = createContext<MargBooksContextValue | null>(null);

export function MargBooksProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState<WorkspaceData>(() =>
    createInitialWorkspaceData()
  );
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [posFocusMode, setPosFocusMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<QueuedOfflineBill[]>([]);
  const [liveOpsEvents, setLiveOpsEvents] = useState<RealtimeOpsEvent[]>([]);
  const tokenRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);

  // Hydrate Light / Dark Checkout Mode, online status, offline POS queue, and Firestore connection check
  useEffect(() => {
    void testConnection();
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem('freshmart-theme');
        const initial: 'light' | 'dark' = saved === 'dark' ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', initial === 'dark');
        if (initial === 'dark') {
          setTheme('dark');
        }
        setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
        const rawQueue = window.localStorage.getItem('freshmart-offline-pos-queue');
        if (rawQueue) {
          const parsed = JSON.parse(rawQueue) as QueuedOfflineBill[];
          if (Array.isArray(parsed)) setOfflineQueue(parsed);
        }
      } catch {
        // Ignore storage access errors
      }
    }, 0);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: 'light' | 'dark' = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem('freshmart-theme', next);
      } catch {
        // Ignore storage errors
      }
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  const togglePosFocusMode = useCallback(() => {
    setPosFocusMode((prev) => !prev);
  }, []);

  const activeModule = useMemo(
    () => resolveModuleFromPathname(pathname || '/admin/dashboard'),
    [pathname]
  );

  const setActiveModule = useCallback(
    (mod: ModuleId) => {
      const targetHref = MODULE_HREF_MAP[mod] || '/admin/dashboard';
      router.push(targetHref);
    },
    [router]
  );

  const showToast = useCallback(
    (title: string, tone: ToastNotice['tone'] = 'success') => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ id: Date.now(), title, tone });
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
      }, 3600);
    },
    []
  );

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  const fetchServerWorkspace = useCallback(
    async (firebaseUser: User, companyId?: number) => {
      setSyncing(true);
      try {
        const idToken = await firebaseUser.getIdToken();
        tokenRef.current = idToken;
        const url = companyId
          ? `/api/workspace?companyId=${encodeURIComponent(companyId)}`
          : '/api/workspace';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          throw new Error('Unable to fetch workspace');
        }
        const data = (await res.json()) as WorkspaceData;
        setWorkspace(data);
        setWorkspaceLoaded(true);
      } catch (err) {
        console.error('Failed to sync cloud workspace:', err);
        showToast('Could not load workspace data. Please retry.', 'error');
      } finally {
        setSyncing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchServerWorkspace(firebaseUser);
      } else {
        tokenRef.current = null;
        setWorkspaceLoaded(false);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [fetchServerWorkspace]);

  // Global MargBooks Function-Key Shortcuts (only active inside authenticated /admin routes)
  useEffect(() => {
    if (!user || !pathname?.startsWith('/admin')) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if (e.key === 'F2') {
        e.preventDefault();
        router.push('/admin/pos');
      } else if (e.key === 'F8') {
        e.preventDefault();
        router.push('/admin/sales');
      } else if (e.key === 'F9') {
        e.preventDefault();
        router.push('/admin/purchases');
      } else if (e.key === 'F6' && !inInput) {
        e.preventDefault();
        router.push('/admin/accounting');
      } else if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        router.push('/admin/control-room');
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        router.push('/admin/shifts');
      } else if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        router.push('/admin/barcodes');
      } else if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        router.push('/admin/addons');
      } else if (e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.push('/admin/search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, pathname, router]);

  // Subscribe to real-time Firestore store operational events for active company
  useEffect(() => {
    if (!user || !workspaceLoaded) return;
    const unsub = subscribeOpsEventsFromFirestore(workspace.activeCompanyId, (events) => {
      setLiveOpsEvents(events);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [user, workspaceLoaded, workspace.activeCompanyId]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred.user) {
        showToast(`Signed in as ${cred.user.displayName || cred.user.email}`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Google Sign-In cancelled or failed:', err);
      showToast('Google Sign-In could not be completed. Please allow popups and retry.', 'warning');
      return false;
    }
  }, [showToast]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    tokenRef.current = null;
    setWorkspaceLoaded(false);
    setWorkspace(createInitialWorkspaceData());
    showToast('Signed out cleanly.', 'info');
    router.push('/login');
  }, [showToast, router]);

  const switchCompany = useCallback(
    async (companyId: number) => {
      if (!user) return;
      await fetchServerWorkspace(user, companyId);
      showToast('Switched active company workspace.', 'info');
    },
    [user, fetchServerWorkspace, showToast]
  );

  // Optimistic / fallback reducer used only if ever needed locally
  const applyLocalMutation = useCallback(
    (type: string, payload: Record<string, unknown>, prev: WorkspaceData): WorkspaceData => {
      const companyId = prev.activeCompanyId;
      switch (type) {
        case 'CREATE_COMPANY': {
          const nextId = Math.max(0, ...prev.companies.map((c) => c.id)) + 1;
          const newComp = {
            id: nextId,
            name: String(payload.name || '').trim(),
            gstin: String(payload.gstin || '').trim().toUpperCase(),
            stateCode: String(payload.stateCode || '07'),
            stateName: String(payload.stateName || 'Delhi'),
            address: String(payload.address || ''),
            phone: String(payload.phone || ''),
            currency: String(payload.currency || 'INR'),
            financialYear: String(payload.financialYear || '2026-27'),
            fyLocked: false,
            branchName: String(payload.branchName || 'Main Branch'),
          };
          return {
            ...prev,
            companies: [...prev.companies, newComp],
            activeCompanyId: nextId,
          };
        }
        case 'RECORD_SHIFT_HANDOVER': {
          const counter = prev.posCounters.find((c) => c.id === Number(payload.counterId));
          if (!counter) return prev;
          const countedCash = Number(payload.countedCash ?? 0);
          const v = calculateShiftVariance({
            openingCash: counter.openingCash,
            cashSales: counter.cashSales,
            upiSales: counter.upiSales,
            cardSales: counter.cardSales,
            walletSales: counter.walletSales,
            pdcSales: counter.pdcSales,
            countedCash,
          });
          const nextId = Math.max(0, ...prev.shiftHandovers.map((s) => s.id)) + 1;
          const handedOverAt = String(
            payload.handedOverAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
          );
          return {
            ...prev,
            shiftHandovers: [
              {
                id: nextId,
                companyId,
                counterCode: counter.counterCode,
                counterName: counter.counterName,
                outgoingOperator: String(payload.outgoingOperator || counter.operatorName),
                outgoingRole: String(payload.outgoingRole || counter.operatorRole),
                incomingOperator: String(payload.incomingOperator || 'Store Admin'),
                shiftStatus:
                  payload.shiftStatus === 'CLOSED'
                    ? 'CLOSED'
                    : payload.shiftStatus === 'OPENED'
                      ? 'OPENED'
                      : 'HANDED_OVER',
                openingCash: counter.openingCash,
                cashSales: counter.cashSales,
                upiSales: counter.upiSales,
                cardSales: counter.cardSales,
                walletSales: counter.walletSales,
                pdcSales: counter.pdcSales,
                expectedCash: v.expectedCash,
                countedCash,
                cashVariance: v.cashVariance,
                notes: String(payload.notes || ''),
                handedOverAt,
              },
              ...prev.shiftHandovers,
            ],
          };
        }
        case 'UPDATE_USER_ROLE': {
          return {
            ...prev,
            currentUserRole: (String(payload.role || 'admin') as UserAccessRole) || 'admin',
          };
        }
        default:
          return prev;
      }
    },
    []
  );

  const dispatchActionWithResult = useCallback(
    async (
      type: string,
      payload: Record<string, unknown>,
      successMessage?: string
    ): Promise<ActionResult> => {
      if (!user) {
        showToast('Please sign in with Google to save changes.', 'warning');
        router.push('/login');
        return { ok: false };
      }

      setSyncing(true);
      try {
        const idToken = await user.getIdToken();
        tokenRef.current = idToken;
        const res = await fetch('/api/workspace/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            companyId: workspace.activeCompanyId,
            type,
            payload,
          }),
        });
        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as { error?: string };
          showToast(errJson.error || 'Could not save changes.', 'error');
          return { ok: false };
        }
        const updated = (await res.json()) as WorkspaceData;
        setWorkspace(updated);
        if (successMessage) showToast(successMessage, 'success');
        return { ok: true, data: updated };
      } catch (err) {
        console.error('Action sync failed:', err);
        // Keep compiler happy with applyLocalMutation reference only on catastrophic offline retry if needed
        void applyLocalMutation;
        showToast('Network error while saving changes.', 'error');
        return { ok: false };
      } finally {
        setSyncing(false);
      }
    },
    [user, workspace.activeCompanyId, applyLocalMutation, showToast, router]
  );

  const dispatchAction = useCallback(
    async (
      type: string,
      payload: Record<string, unknown>,
      successMessage?: string
    ): Promise<boolean> => {
      const res = await dispatchActionWithResult(type, payload, successMessage);
      return res.ok;
    },
    [dispatchActionWithResult]
  );

  const persistQueue = useCallback((items: QueuedOfflineBill[]) => {
    setOfflineQueue(items);
    try {
      window.localStorage.setItem('freshmart-offline-pos-queue', JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const queueOfflineInvoice = useCallback(
    (payload: Record<string, unknown>) => {
      const entry: QueuedOfflineBill = {
        id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        companyId: workspace.activeCompanyId,
        queuedAt: new Date().toISOString(),
        payload,
      };
      persistQueue([entry, ...offlineQueue]);
      showToast('Bill saved to offline queue. Will auto-sync when internet returns.', 'warning');
    },
    [offlineQueue, persistQueue, showToast, workspace.activeCompanyId]
  );

  const flushOfflineQueue = useCallback(async () => {
    if (!user || !isOnline || offlineQueue.length === 0 || flushingRef.current) return;
    flushingRef.current = true;
    setSyncing(true);
    try {
      const idToken = await user.getIdToken();
      const remaining: QueuedOfflineBill[] = [];
      let syncedCount = 0;
      let latestWorkspace: WorkspaceData | null = null;

      for (const item of [...offlineQueue].reverse()) {
        try {
          const res = await fetch('/api/workspace/action', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              companyId: item.companyId,
              type: 'CREATE_INVOICE',
              payload: item.payload,
            }),
          });
          if (res.ok) {
            syncedCount += 1;
            latestWorkspace = (await res.json()) as WorkspaceData;
          } else {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }

      persistQueue(remaining.reverse());
      if (latestWorkspace) setWorkspace(latestWorkspace);
      if (syncedCount > 0) {
        showToast(
          `Synced ${syncedCount} offline POS bill${syncedCount === 1 ? '' : 's'} to cloud.`,
          'success'
        );
      }
    } finally {
      flushingRef.current = false;
      setSyncing(false);
    }
  }, [user, isOnline, offlineQueue, persistQueue, showToast]);

  // Auto-flush queued offline bills when connectivity returns
  useEffect(() => {
    if (isOnline && user && workspaceLoaded && offlineQueue.length > 0) {
      void flushOfflineQueue();
    }
  }, [isOnline, user, workspaceLoaded, offlineQueue.length, flushOfflineQueue]);

  const broadcastOpsEvent = useCallback(
    (event: {
      eventType: RealtimeOpsEvent['eventType'];
      title: string;
      detail: string;
      severity?: RealtimeOpsEvent['severity'];
    }) => {
      if (!user) return;
      const activeComp =
        workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
        workspace.companies[0];
      void publishOpsEventToFirestore(
        workspace.activeCompanyId,
        activeComp?.name || 'FreshMart Superstore',
        workspace.controlRoom.enabledAddons,
        event
      );
    },
    [user, workspace.activeCompanyId, workspace.companies, workspace.controlRoom.enabledAddons]
  );

  const financials = useMemo(
    () =>
      computeFinancialStatements({
        ledgers: workspace.ledgers,
        invoices: workspace.invoices,
        purchases: workspace.purchases,
        vouchers: workspace.vouchers,
        batches: workspace.batches,
      }),
    [
      workspace.ledgers,
      workspace.invoices,
      workspace.purchases,
      workspace.vouchers,
      workspace.batches,
    ]
  );

  const value = useMemo(
    () => ({
      workspace,
      workspaceLoaded,
      activeModule,
      setActiveModule,
      financials,
      user,
      authLoading,
      syncing,
      signInWithGoogle,
      signOutUser,
      switchCompany,
      dispatchAction,
      dispatchActionWithResult,
      toast,
      showToast,
      clearToast,
      theme,
      toggleTheme,
      posFocusMode,
      setPosFocusMode,
      togglePosFocusMode,
      isOnline,
      offlineQueue,
      queueOfflineInvoice,
      flushOfflineQueue,
      liveOpsEvents,
      broadcastOpsEvent,
    }),
    [
      workspace,
      workspaceLoaded,
      activeModule,
      setActiveModule,
      financials,
      user,
      authLoading,
      syncing,
      signInWithGoogle,
      signOutUser,
      switchCompany,
      dispatchAction,
      dispatchActionWithResult,
      toast,
      showToast,
      clearToast,
      theme,
      toggleTheme,
      posFocusMode,
      togglePosFocusMode,
      isOnline,
      offlineQueue,
      queueOfflineInvoice,
      flushOfflineQueue,
      liveOpsEvents,
      broadcastOpsEvent,
    ]
  );

  return (
    <MargBooksContext.Provider value={value}>{children}</MargBooksContext.Provider>
  );
}

export function useMargBooks() {
  const ctx = useContext(MargBooksContext);
  if (!ctx) throw new Error('useMargBooks must be used inside MargBooksProvider');
  return ctx;
}
