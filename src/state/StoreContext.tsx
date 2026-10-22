import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { errorMessage, repository } from "../data";
import type { Store, StoreData } from "../types";
import { useAuth } from "./AuthContext";

const CURRENT_STORE_KEY = "nubestock.currentStore";
const emptyData: StoreData = { products: [], movements: [], orders: [], suppliers: [] };

type Toast = { id: number; message: string; tone: "success" | "error" };

type StoreState = {
  stores: Store[];
  storesLoading: boolean;
  store: Store | null;
  isOwner: boolean;
  data: StoreData;
  dataLoading: boolean;
  loadError: string | null;
  selectStore: (storeId: string) => void;
  reloadStores: (selectId?: string) => Promise<void>;
  refresh: () => Promise<void>;
  /** Ejecuta una acción, muestra el resultado y recarga los datos de la tienda. */
  run: (action: () => Promise<unknown>, success: string, options?: { reload?: boolean }) => Promise<boolean>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  toast: Toast | null;
  dismissToast: () => void;
};

const StoreContext = createContext<StoreState | null>(null);

const readCurrent = () => {
  try {
    return window.localStorage.getItem(CURRENT_STORE_KEY);
  } catch {
    return null;
  }
};

const saveCurrent = (storeId: string) => {
  try {
    window.localStorage.setItem(CURRENT_STORE_KEY, storeId);
  } catch {
    // Preferencia opcional.
  }
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(readCurrent);
  const [data, setData] = useState<StoreData>(emptyData);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const requestId = useRef(0);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), tone === "error" ? 6000 : 3500);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const reloadStores = useCallback(
    async (selectId?: string) => {
      if (!user) {
        setStores([]);
        setStoresLoading(false);
        return;
      }
      setStoresLoading(true);
      try {
        const list = await repository.listStores();
        setStores(list);
        setStoreId((current) => {
          const preferred = selectId ?? current;
          const next = list.find((store) => store.id === preferred)?.id ?? list[0]?.id ?? null;
          if (next) saveCurrent(next);
          return next;
        });
      } catch (error) {
        setLoadError(errorMessage(error));
      } finally {
        setStoresLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void reloadStores();
  }, [reloadStores]);

  const store = stores.find((candidate) => candidate.id === storeId) ?? null;

  const refresh = useCallback(async () => {
    if (!store) {
      setData(emptyData);
      return;
    }
    const current = ++requestId.current;
    setDataLoading(true);
    try {
      const next = await repository.loadStore(store.id);
      if (current === requestId.current) {
        setData(next);
        setLoadError(null);
      }
    } catch (error) {
      if (current === requestId.current) setLoadError(errorMessage(error));
    } finally {
      if (current === requestId.current) setDataLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback<StoreState["run"]>(
    async (action, success, options) => {
      try {
        await action();
        if (options?.reload !== false) await refresh();
        notify(success);
        return true;
      } catch (error) {
        notify(errorMessage(error), "error");
        return false;
      }
    },
    [notify, refresh],
  );

  const value = useMemo<StoreState>(
    () => ({
      stores,
      storesLoading,
      store,
      isOwner: store?.role === "owner",
      data,
      dataLoading,
      loadError,
      selectStore: (id) => {
        saveCurrent(id);
        setData(emptyData);
        setStoreId(id);
      },
      reloadStores,
      refresh,
      run,
      notify,
      toast,
      dismissToast: () => setToast(null),
    }),
    [stores, storesLoading, store, data, dataLoading, loadError, reloadStores, refresh, run, notify, toast],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore debe usarse dentro de StoreProvider");
  return context;
};
