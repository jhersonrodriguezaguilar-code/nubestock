import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CaretDown, Clock, DownloadSimple, Funnel, Plus, Scales } from "@phosphor-icons/react";
import { EmptyState, PageHeader } from "../components/ui";
import { movementLabel, toCsv } from "../domain/inventory";
import { downloadFile, fileDate, formatDateTime } from "../lib/format";
import { useActions } from "../state/ActionsContext";
import { useStore } from "../state/StoreContext";
import type { MovementType } from "../types";

const PAGE = 50;

export function MovementsView() {
  const { data, notify } = useStore();
  const { openMovement } = useActions();
  const [type, setType] = useState<"all" | MovementType>("all");
  const [productId, setProductId] = useState("all");
  const [visible, setVisible] = useState(PAGE);
  const productName = (id: string) => data.products.find((product) => product.id === id);

  const filtered = useMemo(
    () =>
      data.movements.filter(
        (movement) => (type === "all" || movement.type === type) && (productId === "all" || movement.productId === productId),
      ),
    [data.movements, type, productId],
  );

  const last30 = data.movements.filter((movement) => Date.now() - new Date(movement.createdAt).getTime() < 30 * 86400000);
  const entries = last30.filter((movement) => movement.delta > 0).reduce((total, movement) => total + movement.delta, 0);
  const exits = last30.filter((movement) => movement.delta < 0).reduce((total, movement) => total - movement.delta, 0);

  const exportCsv = () => {
    const rows = filtered.map((movement) => {
      const product = productName(movement.productId);
      return [
        formatDateTime(movement.createdAt),
        product?.name ?? "",
        product?.sku ?? "",
        movementLabel[movement.type],
        movement.delta,
        movement.stockAfter,
        movement.note,
        movement.createdByEmail,
      ];
    });
    downloadFile(
      `movimientos-${fileDate()}.csv`,
      `\uFEFF${toCsv([["Fecha", "Producto", "SKU", "Tipo", "Cambio", "Quedaron", "Nota", "Registró"], ...rows])}`,
      "text/csv;charset=utf-8",
    );
    notify("Movimientos descargados en CSV.");
  };

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="Historial del inventario"
        title="Movimientos"
        description="Cada venta, compra y conteo queda registrado con quién lo hizo. El historial no se puede editar."
        action={
          <button className="button button--primary" type="button" onClick={() => openMovement()}>
            <Plus size={18} weight="bold" /> Nuevo movimiento
          </button>
        }
      />
      <div className="mini-metric-grid">
        <div className="mini-metric">
          <span className="mini-metric-icon mini-metric-icon--green">
            <ArrowDown size={18} />
          </span>
          <span>
            <small>Entradas, últimos 30 días</small>
            <strong>{entries} unidades</strong>
          </span>
        </div>
        <div className="mini-metric">
          <span className="mini-metric-icon mini-metric-icon--orange">
            <ArrowUp size={18} />
          </span>
          <span>
            <small>Salidas, últimos 30 días</small>
            <strong>{exits} unidades</strong>
          </span>
        </div>
        <div className="mini-metric">
          <span className="mini-metric-icon mini-metric-icon--ink">
            <Clock size={18} />
          </span>
          <span>
            <small>Registros cargados</small>
            <strong>{data.movements.length}</strong>
          </span>
        </div>
      </div>

      <div className="inventory-toolbar">
        <label className="select-field">
          <Funnel size={16} aria-hidden="true" />
          <select aria-label="Filtrar por tipo" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
            <option value="all">Todos los tipos</option>
            <option value="out">Ventas y salidas</option>
            <option value="in">Compras y entradas</option>
            <option value="adjust">Ajustes por conteo</option>
          </select>
          <CaretDown size={15} aria-hidden="true" />
        </label>
        <label className="select-field select-field--grow">
          <select aria-label="Filtrar por producto" value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="all">Todos los productos</option>
            {data.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <CaretDown size={15} aria-hidden="true" />
        </label>
        <button className="button button--secondary toolbar-export" type="button" onClick={exportCsv} disabled={!filtered.length}>
          <DownloadSimple size={17} /> Exportar CSV
        </button>
      </div>

      <section className="panel history-panel" aria-label="Historial">
        {filtered.length ? (
          <>
            <ul className="movement-history">
              {filtered.slice(0, visible).map((movement) => {
                const product = productName(movement.productId);
                return (
                  <li className="movement-row" key={movement.id}>
                    <span className={`movement-type movement-type--${movement.type}`} aria-hidden="true">
                      {movement.type === "in" ? <ArrowDown size={17} /> : movement.type === "out" ? <ArrowUp size={17} /> : <Scales size={17} />}
                    </span>
                    <div className="movement-product">
                      <strong>{product?.name ?? "Producto eliminado"}</strong>
                      <span>
                        {movementLabel[movement.type]}
                        {movement.note ? `: ${movement.note}` : ""}
                        {movement.createdByEmail ? `. Registró ${movement.createdByEmail}` : ""}
                      </span>
                    </div>
                    <span className={`movement-quantity movement-quantity--${movement.delta > 0 ? "in" : "out"}`}>
                      {movement.delta > 0 ? "+" : ""}
                      {movement.delta} {product?.unit ?? "und."}
                      <small>quedaron {movement.stockAfter}</small>
                    </span>
                    <span className="movement-date">{formatDateTime(movement.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
            {filtered.length > visible ? (
              <button className="panel-footer-note" type="button" onClick={() => setVisible(visible + PAGE)}>
                Mostrar {Math.min(PAGE, filtered.length - visible)} más
              </button>
            ) : null}
          </>
        ) : (
          <EmptyState icon={Clock} title="Sin movimientos" description="Cuando registres una venta, compra o conteo aparecerá aquí." />
        )}
      </section>
    </div>
  );
}
