import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowsLeftRight,
  Bell,
  CaretRight,
  ChartBar,
  CheckCircle,
  ClipboardText,
  Cloud,
  CloudSlash,
  Gear,
  House,
  List,
  Package,
  SignOut,
  Storefront,
  Truck,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { isDemo, repository } from "../data";
import { lowStock } from "../domain/inventory";
import { initials } from "../lib/format";
import { useAuth } from "../state/AuthContext";
import { useStore } from "../state/StoreContext";
import type { IconComponent } from "./ui";

type NavItem = { to: string; label: string; icon: IconComponent; ownerOnly?: boolean };

const operationItems: NavItem[] = [
  { to: "/", label: "Resumen", icon: House },
  { to: "/inventario", label: "Inventario", icon: Package },
  { to: "/movimientos", label: "Movimientos", icon: ArrowsLeftRight },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardText },
  { to: "/proveedores", label: "Proveedores", icon: Truck },
  { to: "/reportes", label: "Reportes", icon: ChartBar, ownerOnly: true },
];

const settingsItems: NavItem[] = [
  { to: "/equipo", label: "Equipo", icon: UsersThree },
  { to: "/configuracion", label: "Configuración", icon: Gear },
  { to: "/nube", label: "Cómo funciona en la nube", icon: Cloud },
];

export const allNavItems = [...operationItems, ...settingsItems];

const useOnline = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
};

export function Layout() {
  const { user } = useAuth();
  const { stores, store, isOwner, data, selectStore, toast, dismissToast, notify } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const online = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const alerts = lowStock(data.products).length;
  const current = allNavItems.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to),
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const signOut = async () => {
    try {
      await repository.signOut();
    } catch {
      notify("No se pudo cerrar la sesión. Inténtalo de nuevo.", "error");
    }
  };

  const renderItem = (item: NavItem) =>
    item.ownerOnly && !isOwner ? null : (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === "/"}
        className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}
      >
        {({ isActive }) => (
          <>
            <item.icon size={19} weight={isActive ? "fill" : "regular"} />
            <span>{item.label}</span>
            {item.to === "/inventario" && alerts > 0 ? (
              <span className="nav-count" aria-label={`${alerts} alertas`}>
                {alerts}
              </span>
            ) : null}
          </>
        )}
      </NavLink>
    );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`} aria-label="Menú">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Storefront size={21} weight="fill" />
          </div>
          <div>
            <div className="brand-name">
              Nube<span>Stock</span>
            </div>
            <div className="brand-caption">Inventario de tu tienda</div>
          </div>
          <button className="icon-button sidebar-close" type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <label className="store-switcher">
          <span className="store-switcher__icon">
            <Storefront size={17} />
          </span>
          <span className="store-switcher__copy">
            <small>Tienda</small>
            <select
              aria-label="Cambiar de tienda"
              value={store?.id ?? ""}
              onChange={(event) => {
                if (event.target.value === "__new") navigate("/tiendas/nueva");
                else selectStore(event.target.value);
              }}
            >
              {stores.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              <option value="__new">+ Crear otra tienda</option>
            </select>
          </span>
        </label>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <span className="nav-label">Operación</span>
          {operationItems.map(renderItem)}
          <span className="nav-label nav-label--secondary">Tienda y cuenta</span>
          {settingsItems.map(renderItem)}
        </nav>

        <div className="sidebar-bottom">
          <div className={`sync-status ${online ? "" : "sync-status--offline"}`}>
            {online ? <span className="sync-dot" /> : <CloudSlash size={16} />}
            <span>
              <strong>{isDemo ? "Modo demostración" : online ? "Conectado a la nube" : "Sin conexión"}</strong>
              <small>{isDemo ? "Datos guardados en este navegador" : online ? "Los cambios se guardan al instante" : "Los cambios no se guardarán"}</small>
            </span>
          </div>
          <div className="profile-switcher">
            <span className="avatar avatar--dark" aria-hidden="true">
              {initials(user?.email ?? "")}
            </span>
            <span className="profile-copy">
              <strong title={user?.email}>{user?.email}</strong>
              <small>{isOwner ? "Propietario" : "Empleado"}</small>
            </span>
            <button className="icon-button icon-button--subtle" type="button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={signOut}>
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen ? <button className="mobile-scrim" type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} /> : null}

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" type="button" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>
              <List size={20} />
            </button>
            <div className="breadcrumbs">
              <span>{store?.name}</span>
              <CaretRight size={13} aria-hidden="true" />
              <strong>{current?.label ?? "NubeStock"}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button notification-button"
              type="button"
              aria-label={alerts ? `${alerts} productos por reponer` : "Sin alertas de reposición"}
              title={alerts ? `${alerts} productos por reponer` : "Sin alertas de reposición"}
              onClick={() => navigate("/inventario?estado=reponer")}
            >
              <Bell size={19} />
              {alerts ? <span className="notification-dot" /> : null}
            </button>
          </div>
        </header>

        {!online ? (
          <div className="offline-banner" role="alert">
            <CloudSlash size={18} /> Estás sin conexión. Puedes consultar lo que ya cargó, pero los cambios no se guardarán hasta que vuelva internet.
          </div>
        ) : null}

        <div className="page-container" id="contenido" tabIndex={-1}>
          <Outlet />
        </div>
      </main>

      {toast ? (
        <div className={`toast toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.id}>
          {toast.tone === "error" ? <WarningCircle size={19} weight="fill" /> : <CheckCircle size={19} weight="fill" />}
          <span>{toast.message}</span>
          <button type="button" aria-label="Cerrar mensaje" onClick={dismissToast}>
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
