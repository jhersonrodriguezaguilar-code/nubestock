import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { WarningCircle } from "@phosphor-icons/react";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { ActionsProvider } from "./state/ActionsContext";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { StoreProvider, useStore } from "./state/StoreContext";
import { AuthView } from "./views/AuthView";
import { CloudView } from "./views/CloudView";
import { DashboardView } from "./views/DashboardView";
import { InventoryView } from "./views/InventoryView";
import { MovementsView } from "./views/MovementsView";
import { NewStoreView } from "./views/NewStoreView";
import { OrdersView } from "./views/OrdersView";
import { ReportsView } from "./views/ReportsView";
import { SettingsView } from "./views/SettingsView";
import { SuppliersView } from "./views/SuppliersView";
import { TeamView } from "./views/TeamView";

function Gate() {
  const { user, loading, recovering } = useAuth();
  const { stores, storesLoading, store, isOwner, dataLoading, data, loadError, refresh } = useStore();

  if (loading) {
    return (
      <div className="center-page">
        <Spinner label="Abriendo NubeStock" />
      </div>
    );
  }
  if (!user || recovering) return <AuthView />;
  if (storesLoading && !stores.length) {
    return (
      <div className="center-page">
        <Spinner label="Buscando tus tiendas" />
      </div>
    );
  }
  if (!stores.length) {
    return loadError ? (
      <div className="center-page">
        <p className="form-error" role="alert">
          <WarningCircle size={18} /> {loadError}
        </p>
      </div>
    ) : (
      <NewStoreView first />
    );
  }

  const firstLoad = dataLoading && !data.products.length && !data.movements.length;

  return (
    <ActionsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              loadError && !data.products.length ? (
                <div className="load-error" role="alert">
                  <WarningCircle size={20} /> {loadError}
                  <button className="button button--secondary button--small" type="button" onClick={() => void refresh()}>
                    Reintentar
                  </button>
                </div>
              ) : firstLoad || !store ? (
                <Spinner label="Cargando inventario" />
              ) : (
                <DashboardView />
              )
            }
          />
          <Route path="inventario" element={<InventoryView />} />
          <Route path="movimientos" element={<MovementsView />} />
          <Route path="pedidos" element={<OrdersView />} />
          <Route path="proveedores" element={<SuppliersView />} />
          <Route path="reportes" element={isOwner ? <ReportsView /> : <Navigate to="/" replace />} />
          <Route path="equipo" element={<TeamView />} />
          <Route path="configuracion" element={<SettingsView key={store?.id} />} />
          <Route path="nube" element={<CloudView />} />
          <Route path="tiendas/nueva" element={<NewStoreView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ActionsProvider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <StoreProvider>
          <Gate />
        </StoreProvider>
      </AuthProvider>
    </HashRouter>
  );
}
