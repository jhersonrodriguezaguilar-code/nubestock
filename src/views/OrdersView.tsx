import { useState } from "react";
import { Check, ClipboardText, Copy, PaperPlaneTilt, PencilSimple, Plus, Trash, Truck, WhatsappLogo, XCircle } from "@phosphor-icons/react";
import { EmptyState, OrderStatusBadge, PageHeader } from "../components/ui";
import { repository } from "../data";
import { orderMessage, orderTotal, orderUnits, whatsappPhone } from "../domain/inventory";
import { formatCurrency, formatDate } from "../lib/format";
import { useActions } from "../state/ActionsContext";
import { useStore } from "../state/StoreContext";
import type { Order, OrderStatus } from "../types";

type Filter = "abiertos" | "todos";

export function OrdersView() {
  const { store, data, isOwner, run, notify } = useStore();
  const { openOrder, editOrder } = useActions();
  const [filter, setFilter] = useState<Filter>("abiertos");
  const [expanded, setExpanded] = useState<string | null>(null);
  const supplier = (id: string | null) => data.suppliers.find((candidate) => candidate.id === id);
  const product = (id: string) => data.products.find((candidate) => candidate.id === id);
  const open = data.orders.filter((order) => order.status === "draft" || order.status === "sent");
  const shown = filter === "abiertos" ? open : data.orders;

  const message = (order: Order) => orderMessage(order, store?.name ?? "", data.products, supplier(order.supplierId));

  const copy = async (order: Order) => {
    try {
      await navigator.clipboard.writeText(message(order));
      notify("Pedido copiado. Pégalo en el chat o correo del proveedor.");
    } catch {
      notify("No se pudo copiar. Selecciona el texto del pedido y cópialo manualmente.", "error");
    }
  };

  const whatsappUrl = (order: Order) => {
    const phone = whatsappPhone(supplier(order.supplierId)?.phone ?? "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(message(order))}`;
  };

  const act = (order: Order, next: OrderStatus | "delete") => {
    if (!store) return;
    if (next === "delete") {
      if (!window.confirm(`¿Borrar el borrador ${order.code}?`)) return;
      return run(() => repository.deleteOrderDraft(store.id, order.id), `Borrador ${order.code} borrado.`);
    }
    if (next === "sent") return run(() => repository.sendOrder(store.id, order.id), `${order.code} marcado como enviado.`);
    if (next === "cancelled") {
      if (!window.confirm(`¿Cancelar ${order.code}? No se podrá recibir después.`)) return;
      return run(() => repository.cancelOrder(store.id, order.id), `${order.code} cancelado.`);
    }
    if (next === "received") {
      return run(() => repository.receiveOrder(store.id, order.id), `${order.code} recibido. Las existencias se actualizaron.`);
    }
  };

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="Abastecimiento"
        title="Pedidos"
        description="Arma pedidos para tus proveedores, envíalos por WhatsApp y súmalos al inventario cuando lleguen."
        action={
          isOwner ? (
            <button className="button button--primary" type="button" onClick={() => openOrder()}>
              <Plus size={18} weight="bold" /> Crear pedido
            </button>
          ) : null
        }
      />

      <div className="orders-summary">
        <div className="orders-summary-copy">
          <span className="panel-kicker">Próximo paso</span>
          <h2>
            {open.length
              ? `${open.filter((order) => order.status === "sent").length} por recibir y ${open.filter((order) => order.status === "draft").length} por enviar`
              : "No tienes pedidos pendientes"}
          </h2>
          <p>Al recibir un pedido se suman las unidades al inventario y se actualiza el costo de compra.</p>
        </div>
        <Truck size={52} weight="duotone" aria-hidden="true" />
      </div>

      <div className="segmented" role="tablist" aria-label="Filtrar pedidos">
        <button role="tab" aria-selected={filter === "abiertos"} className={filter === "abiertos" ? "active" : ""} type="button" onClick={() => setFilter("abiertos")}>
          Abiertos ({open.length})
        </button>
        <button role="tab" aria-selected={filter === "todos"} className={filter === "todos" ? "active" : ""} type="button" onClick={() => setFilter("todos")}>
          Todos ({data.orders.length})
        </button>
      </div>

      {shown.length ? (
        <div className="order-cards">
          {shown.map((order) => {
            const orderSupplier = supplier(order.supplierId);
            const isExpanded = expanded === order.id;
            return (
              <article className="panel order-card" key={order.id}>
                <header className="order-card__head">
                  <div>
                    <strong className="order-id">{order.code}</strong>
                    <span className="muted-text">
                      {orderSupplier?.name ?? "Sin proveedor"}, creado el {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </header>
                <div className="order-card__summary">
                  <span>
                    {order.items.length} {order.items.length === 1 ? "producto" : "productos"}, {orderUnits(order)} unidades
                  </span>
                  <strong>{formatCurrency(orderTotal(order))}</strong>
                </div>
                <button className="text-button" type="button" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : order.id)}>
                  {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                </button>
                {isExpanded ? (
                  <ul className="order-card__items">
                    {order.items.map((item) => {
                      const itemProduct = product(item.productId);
                      return (
                        <li key={item.productId}>
                          <span>{itemProduct?.name ?? "Producto"}</span>
                          <span>
                            {item.quantity} {itemProduct?.unit ?? "und."} × {formatCurrency(item.unitCost)}
                          </span>
                        </li>
                      );
                    })}
                    {order.notes ? <li className="order-card__note">Nota: {order.notes}</li> : null}
                  </ul>
                ) : null}
                <div className="order-card__actions">
                  {order.status === "draft" && isOwner ? (
                    <>
                      <button className="button button--primary button--small" type="button" onClick={() => act(order, "sent")}>
                        <PaperPlaneTilt size={15} /> Marcar enviado
                      </button>
                      <button className="button button--secondary button--small" type="button" onClick={() => editOrder(order)}>
                        <PencilSimple size={15} /> Editar
                      </button>
                    </>
                  ) : null}
                  {order.status === "sent" ? (
                    <button className="button button--primary button--small" type="button" onClick={() => act(order, "received")}>
                      <Check size={15} weight="bold" /> Recibir pedido
                    </button>
                  ) : null}
                  {(order.status === "draft" || order.status === "sent") && order.items.length ? (
                    <>
                      {orderSupplier?.phone ? (
                        <a className="button button--soft button--small" href={whatsappUrl(order)} target="_blank" rel="noreferrer">
                          <WhatsappLogo size={15} /> WhatsApp
                        </a>
                      ) : null}
                      <button className="button button--soft button--small" type="button" onClick={() => copy(order)}>
                        <Copy size={15} /> Copiar texto
                      </button>
                    </>
                  ) : null}
                  {order.status === "draft" && isOwner ? (
                    <button className="icon-button icon-button--subtle" type="button" aria-label={`Borrar ${order.code}`} title="Borrar borrador" onClick={() => act(order, "delete")}>
                      <Trash size={17} />
                    </button>
                  ) : null}
                  {order.status === "sent" && isOwner ? (
                    <button className="icon-button icon-button--subtle" type="button" aria-label={`Cancelar ${order.code}`} title="Cancelar pedido" onClick={() => act(order, "cancelled")}>
                      <XCircle size={17} />
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <EmptyState
            icon={ClipboardText}
            title={filter === "abiertos" ? "No hay pedidos abiertos" : "Aún no has creado pedidos"}
            description={isOwner ? "Crea un pedido desde aquí o desde la cola de reposición del resumen." : "El propietario crea los pedidos; tú puedes recibirlos cuando lleguen."}
          />
        </section>
      )}
    </div>
  );
}
