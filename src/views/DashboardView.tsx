import { useNavigate } from "react-router-dom";
import { Archive, ArrowDown, ArrowUp, ArrowUpRight, CaretRight, CheckCircle, Package, Plus, Scales, ShoppingCart, TrendUp, Truck, Warning } from "@phosphor-icons/react";
import { EmptyState, MetricCard, Monogram, PageHeader, StatusBadge } from "../components/ui";
import { inventoryValue, lowStock, statusFor } from "../domain/inventory";
import { formatCurrency, formatDateTime, formatLongDate, greeting, isToday } from "../lib/format";
import { useActions } from "../state/ActionsContext";
import { useStore } from "../state/StoreContext";

export function DashboardView() {
  const { store, data, isOwner } = useStore();
  const { openMovement, openOrder, openProduct } = useActions();
  const navigate = useNavigate();
  const { products, movements, orders, suppliers } = data;
  const alerts = lowStock(products);
  const today = movements.filter((movement) => isToday(movement.createdAt));
  const soldToday = today.filter((movement) => movement.type === "out").reduce((total, movement) => total - movement.delta, 0);
  const salesToday = today
    .filter((movement) => movement.type === "out")
    .reduce((total, movement) => total - movement.delta * (products.find((product) => product.id === movement.productId)?.price ?? 0), 0);
  const openOrders = orders.filter((order) => order.status === "draft" || order.status === "sent");
  const supplierName = (id: string | null) => suppliers.find((supplier) => supplier.id === id)?.name ?? "Sin proveedor";

  if (!products.length) {
    return (
      <div className="view-stack">
        <PageHeader eyebrow={formatLongDate()} title={`Bienvenido a ${store?.name ?? "tu tienda"}`} description="Empieza por registrar lo que tienes en la estantería." />
        <section className="panel onboarding-panel">
          <EmptyState
            icon={Package}
            title="Tu inventario está vacío"
            description={isOwner ? "Agrega tus productos uno por uno o importa una lista en CSV desde Configuración." : "El propietario de la tienda aún no ha cargado productos."}
            action={
              isOwner ? (
                <div className="empty-actions">
                  <button className="button button--primary" type="button" onClick={() => openProduct()}>
                    <Plus size={18} weight="bold" /> Agregar producto
                  </button>
                  <button className="button button--secondary" type="button" onClick={() => navigate("/configuracion")}>
                    Importar CSV
                  </button>
                </div>
              ) : null
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow={formatLongDate()}
        title={`${greeting()}, ${store?.name}`}
        description={alerts.length ? `Hay ${alerts.length} productos que conviene reponer.` : "Todo el inventario está por encima del mínimo."}
        action={
          <div className="quick-actions">
            <button className="button button--primary" type="button" onClick={() => openMovement(undefined, "out")}>
              <ArrowUp size={18} weight="bold" /> Registrar venta
            </button>
            <button className="button button--secondary" type="button" onClick={() => openMovement(undefined, "in")}>
              <ArrowDown size={18} /> Compra
            </button>
          </div>
        }
      />

      <div className="metric-grid">
        <MetricCard label="Valor del inventario" value={formatCurrency(inventoryValue(products))} detail={`${products.filter((product) => product.active).length} productos activos, a costo`} icon={Archive} tone="green" onClick={() => navigate("/inventario")} />
        <MetricCard label="Por reponer" value={String(alerts.length)} detail={alerts.length ? "Toca para ver cuáles" : "Nada urgente"} icon={Warning} tone="orange" onClick={() => navigate("/inventario?estado=reponer")} />
        <MetricCard label="Vendido hoy" value={formatCurrency(salesToday)} detail={`${soldToday} unidades en ${today.filter((movement) => movement.type === "out").length} ventas`} icon={TrendUp} tone="ink" onClick={() => navigate("/movimientos")} />
        <MetricCard label="Pedidos abiertos" value={String(openOrders.length)} detail={`${openOrders.filter((order) => order.status === "sent").length} esperando entrega`} icon={Truck} tone="sand" onClick={() => navigate("/pedidos")} />
      </div>

      <div className="dashboard-main-grid">
        <section className="panel reorder-panel" aria-labelledby="reorder-title">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Se están acabando</span>
              <h2 id="reorder-title">Cola de reposición</h2>
            </div>
            {alerts.length > 1 && isOwner ? (
              <button className="button button--soft button--small" type="button" onClick={() => navigate("/proveedores")}>
                <ShoppingCart size={15} /> Pedir por proveedor
              </button>
            ) : (
              <button className="text-button" type="button" onClick={() => navigate("/inventario")}>
                Ver inventario <CaretRight size={15} />
              </button>
            )}
          </div>
          {alerts.length ? (
            <div className="reorder-list">
              {alerts.slice(0, 5).map((product) => (
                <div className="reorder-row" key={product.id}>
                  <Monogram name={product.name} />
                  <div className="reorder-product">
                    <strong>{product.name}</strong>
                    <span>{supplierName(product.supplierId)}</span>
                  </div>
                  <div className="reorder-stock">
                    <strong>
                      {product.stock} <small>de {product.minStock} mín.</small>
                    </strong>
                    <StatusBadge status={statusFor(product)} />
                  </div>
                  {isOwner ? (
                    <button className="button button--soft button--small" type="button" onClick={() => openOrder([product.id])}>
                      Pedir <ArrowUpRight size={15} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle} title="Inventario bajo control" description="Ningún producto está por debajo de su mínimo." />
          )}
          {alerts.length > 5 ? (
            <button className="panel-footer-note" type="button" onClick={() => navigate("/inventario?estado=reponer")}>
              Ver los otros {alerts.length - 5} productos por reponer
            </button>
          ) : null}
        </section>

        <section className="panel activity-panel" aria-labelledby="activity-title">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Últimos registros</span>
              <h2 id="activity-title">Actividad reciente</h2>
            </div>
            <button className="icon-button" type="button" aria-label="Ver todos los movimientos" onClick={() => navigate("/movimientos")}>
              <ArrowUpRight size={17} />
            </button>
          </div>
          {movements.length ? (
            <div className="activity-list">
              {movements.slice(0, 6).map((movement) => {
                const product = products.find((item) => item.id === movement.productId);
                return (
                  <div className="activity-row" key={movement.id}>
                    <span className={`activity-icon activity-icon--${movement.type}`} aria-hidden="true">
                      {movement.type === "in" ? <ArrowDown size={17} /> : movement.type === "out" ? <ArrowUp size={17} /> : <Scales size={17} />}
                    </span>
                    <div className="activity-copy">
                      <strong>{product?.name ?? "Producto"}</strong>
                      <span>{movement.note || (movement.type === "out" ? "Venta" : movement.type === "in" ? "Entrada" : "Ajuste")}</span>
                    </div>
                    <div className="activity-meta">
                      <strong className={movement.delta > 0 ? "text-positive" : "text-negative"}>
                        {movement.delta > 0 ? "+" : ""}
                        {movement.delta}
                      </strong>
                      <span>{formatDateTime(movement.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={ArrowUp} title="Sin movimientos aún" description="Registra tu primera venta o compra para ver la actividad aquí." />
          )}
        </section>
      </div>
    </div>
  );
}
