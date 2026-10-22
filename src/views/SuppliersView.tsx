import { useState } from "react";
import { EnvelopeSimple, PencilSimple, Phone, Plus, ShoppingCart, Trash, Truck } from "@phosphor-icons/react";
import { SupplierModal } from "../components/modals";
import { EmptyState, PageHeader } from "../components/ui";
import { repository } from "../data";
import { lowStock } from "../domain/inventory";
import { useActions } from "../state/ActionsContext";
import { useStore } from "../state/StoreContext";
import type { Supplier } from "../types";

export function SuppliersView() {
  const { store, data, isOwner, run } = useStore();
  const { openOrder } = useActions();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const alerts = lowStock(data.products);

  const remove = (supplier: Supplier) => {
    if (!store) return;
    const linked = data.products.filter((product) => product.supplierId === supplier.id).length;
    const warning = linked ? ` ${linked} productos quedarán sin proveedor asignado.` : "";
    if (!window.confirm(`¿Eliminar a ${supplier.name}?${warning}`)) return;
    void run(() => repository.deleteSupplier(store.id, supplier.id), `${supplier.name} eliminado.`);
  };

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="Contactos de compra"
        title="Proveedores"
        description="Quién te surte cada producto y cómo contactarlo."
        action={
          isOwner ? (
            <button className="button button--primary" type="button" onClick={() => setEditing("new")}>
              <Plus size={18} weight="bold" /> Agregar proveedor
            </button>
          ) : null
        }
      />
      {data.suppliers.length ? (
        <div className="supplier-grid">
          {data.suppliers.map((supplier) => {
            const products = data.products.filter((product) => product.supplierId === supplier.id && product.active);
            const toReorder = alerts.filter((product) => product.supplierId === supplier.id);
            return (
              <article className="panel supplier-card" key={supplier.id}>
                <div className="supplier-card__head">
                  <span className="supplier-card__icon" aria-hidden="true">
                    <Truck size={20} />
                  </span>
                  <div>
                    <h2>{supplier.name}</h2>
                    <span className="muted-text">
                      {products.length} {products.length === 1 ? "producto" : "productos"}
                      {toReorder.length ? `, ${toReorder.length} por reponer` : ""}
                    </span>
                  </div>
                </div>
                <div className="supplier-card__contact">
                  {supplier.phone ? (
                    <a href={`tel:${supplier.phone.replace(/\s/g, "")}`}>
                      <Phone size={15} /> {supplier.phone}
                    </a>
                  ) : null}
                  {supplier.email ? (
                    <a href={`mailto:${supplier.email}`}>
                      <EnvelopeSimple size={15} /> {supplier.email}
                    </a>
                  ) : null}
                  {!supplier.phone && !supplier.email ? <span className="muted-text">Sin datos de contacto</span> : null}
                  {supplier.notes ? <p>{supplier.notes}</p> : null}
                </div>
                {isOwner ? (
                  <div className="supplier-card__actions">
                    {toReorder.length ? (
                      <button className="button button--soft button--small" type="button" onClick={() => openOrder(toReorder.map((product) => product.id))}>
                        <ShoppingCart size={15} /> Pedir lo que falta
                      </button>
                    ) : null}
                    <button className="icon-button icon-button--subtle" type="button" aria-label={`Editar ${supplier.name}`} title="Editar" onClick={() => setEditing(supplier)}>
                      <PencilSimple size={17} />
                    </button>
                    <button className="icon-button icon-button--subtle" type="button" aria-label={`Eliminar ${supplier.name}`} title="Eliminar" onClick={() => remove(supplier)}>
                      <Trash size={17} />
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <EmptyState icon={Truck} title="Sin proveedores" description="Agrega a quien te surte para asignarlo a tus productos y enviarle pedidos." />
        </section>
      )}
      {editing && store ? (
        <SupplierModal
          supplier={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            editing === "new"
              ? run(() => repository.createSupplier(store.id, input), `${input.name} agregado.`)
              : run(() => repository.updateSupplier(store.id, editing.id, input), "Proveedor actualizado.")
          }
        />
      ) : null}
    </div>
  );
}
