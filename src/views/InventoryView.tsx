import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ArrowCounterClockwise, ArrowsLeftRight, CaretDown, DownloadSimple, Funnel, MagnifyingGlass, PencilSimple, Plus, ShoppingCart } from "@phosphor-icons/react";
import { EmptyState, Monogram, PageHeader, StatusBadge } from "../components/ui";
import { repository } from "../data";
import { statusFor, toCsv } from "../domain/inventory";
import { downloadFile, fileDate, formatCurrency } from "../lib/format";
import { useActions } from "../state/ActionsContext";
import { useStore } from "../state/StoreContext";
import type { Product, Supplier } from "../types";

type StatusFilter = "todos" | "reponer" | "archivados";

export const exportInventoryCsv = (products: Product[], suppliers: Supplier[], storeName: string) => {
  const header = ["Producto", "SKU", "Categoría", "Unidad", "Existencias", "Mínimo", "Costo", "Precio", "Proveedor", "Activo"];
  const rows = products.map((product) => [
    product.name,
    product.sku,
    product.category,
    product.unit,
    product.stock,
    product.minStock,
    product.cost,
    product.price,
    suppliers.find((supplier) => supplier.id === product.supplierId)?.name ?? "",
    product.active ? "Sí" : "No",
  ]);
  const slug = storeName.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadFile(`inventario-${slug || "tienda"}-${fileDate()}.csv`, `\uFEFF${toCsv([header, ...rows])}`, "text/csv;charset=utf-8");
};

export function InventoryView() {
  const { store, data, isOwner, run, notify } = useStore();
  const { openMovement, openOrder, openProduct } = useActions();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const status = (params.get("estado") as StatusFilter) || "todos";
  const supplierName = (id: string | null) => data.suppliers.find((supplier) => supplier.id === id)?.name ?? "";

  const categories = useMemo(() => [...new Set(data.products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, "es")), [data.products]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.products.filter((product) => {
      if (status === "archivados" ? product.active : !product.active) return false;
      if (status === "reponer" && statusFor(product) === "healthy") return false;
      if (category !== "all" && product.category !== category) return false;
      if (!text) return true;
      const supplier = data.suppliers.find((candidate) => candidate.id === product.supplierId)?.name ?? "";
      return [product.name, product.sku, product.category, supplier].join(" ").toLowerCase().includes(text);
    });
  }, [data.products, data.suppliers, query, category, status]);

  const setStatus = (next: StatusFilter) => {
    if (next === "todos") params.delete("estado");
    else params.set("estado", next);
    setParams(params, { replace: true });
  };

  const toggleActive = (product: Product) =>
    run(
      () => repository.updateProduct(store!.id, product.id, { ...product, active: !product.active }),
      product.active ? `${product.name} se archivó. Puedes restaurarlo en Archivados.` : `${product.name} volvió al inventario.`,
    );

  const activeCount = data.products.filter((product) => product.active).length;

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="Catálogo y existencias"
        title="Inventario"
        description={`${activeCount} productos activos. Las existencias cambian solo con ventas, compras o conteos, así queda el historial.`}
        action={
          isOwner ? (
            <button className="button button--primary" type="button" onClick={() => openProduct()}>
              <Plus size={18} weight="bold" /> Agregar producto
            </button>
          ) : null
        }
      />

      <div className="segmented" role="tablist" aria-label="Filtrar por estado">
        {(
          [
            ["todos", "Activos"],
            ["reponer", "Por reponer"],
            ["archivados", "Archivados"],
          ] as [StatusFilter, string][]
        ).map(([value, label]) => (
          <button key={value} role="tab" aria-selected={status === value} className={status === value ? "active" : ""} type="button" onClick={() => setStatus(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className="inventory-toolbar">
        <label className="search-field">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input type="search" aria-label="Buscar producto" placeholder="Buscar producto, SKU o proveedor" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="select-field">
          <Funnel size={16} aria-hidden="true" />
          <select aria-label="Filtrar por categoría" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Todas las categorías</option>
            {categories.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
          <CaretDown size={15} aria-hidden="true" />
        </label>
        <button
          className="button button--secondary toolbar-export"
          type="button"
          onClick={() => {
            exportInventoryCsv(data.products, data.suppliers, store?.name ?? "");
            notify("Inventario descargado en CSV.");
          }}
        >
          <DownloadSimple size={17} /> Exportar CSV
        </button>
      </div>

      <section className="panel inventory-panel">
        <div className="inventory-panel-head">
          <span className="table-result-count" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
          </span>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table className="data-table inventory-table responsive-table">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Existencias</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Proveedor</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const productStatus = statusFor(product);
                  const percent = Math.min(100, Math.round((product.stock / Math.max(product.minStock * 2, 1)) * 100));
                  return (
                    <tr key={product.id}>
                      <td data-label="Producto">
                        <div className="table-product">
                          <Monogram name={product.name} />
                          <span>
                            <strong>{product.name}</strong>
                            <small>{product.sku}</small>
                          </span>
                        </div>
                      </td>
                      <td data-label="Categoría">
                        <span className="muted-text">{product.category}</span>
                      </td>
                      <td data-label="Existencias">
                        <div className="stock-cell">
                          <strong>
                            {product.stock} <small>{product.unit}</small>
                          </strong>
                          <span className="stock-track" aria-hidden="true">
                            <span style={{ width: `${percent}%` }} className={`stock-fill stock-fill--${productStatus}`} />
                          </span>
                          <small className="stock-min">mín. {product.minStock}</small>
                        </div>
                      </td>
                      <td data-label="Precio">
                        <strong className="currency-cell">{formatCurrency(product.price)}</strong>
                      </td>
                      <td data-label="Proveedor">
                        <span className="supplier-cell">{supplierName(product.supplierId) || "Sin asignar"}</span>
                      </td>
                      <td data-label="Estado">
                        <StatusBadge status={productStatus} />
                      </td>
                      <td>
                        <div className="table-actions">
                          {product.active ? (
                            <button className="mini-action" type="button" aria-label={`Registrar movimiento de ${product.name}`} title="Registrar movimiento" onClick={() => openMovement(product.id)}>
                              <ArrowsLeftRight size={15} />
                            </button>
                          ) : null}
                          {isOwner && product.active ? (
                            <button className={`mini-action ${productStatus !== "healthy" ? "mini-action--accent" : ""}`} type="button" aria-label={`Crear pedido de ${product.name}`} title="Crear pedido" onClick={() => openOrder([product.id])}>
                              <ShoppingCart size={15} />
                            </button>
                          ) : null}
                          {isOwner ? (
                            <>
                              <button className="mini-action" type="button" aria-label={`Editar ${product.name}`} title="Editar" onClick={() => openProduct(product)}>
                                <PencilSimple size={15} />
                              </button>
                              <button className="mini-action" type="button" aria-label={product.active ? `Archivar ${product.name}` : `Restaurar ${product.name}`} title={product.active ? "Archivar" : "Restaurar"} onClick={() => toggleActive(product)}>
                                {product.active ? <Archive size={15} /> : <ArrowCounterClockwise size={15} />}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={MagnifyingGlass}
            title={status === "archivados" ? "No hay productos archivados" : status === "reponer" ? "Nada por reponer" : "No encontramos productos"}
            description={status === "todos" ? "Prueba con otro término o cambia la categoría." : "Cambia el filtro para ver otros productos."}
          />
        )}
      </section>
    </div>
  );
}
