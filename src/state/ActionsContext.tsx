import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { MovementModal, OrderModal, ProductModal } from "../components/modals";
import { repository } from "../data";
import type { MovementType, Order, Product } from "../types";
import { useStore } from "./StoreContext";

type Actions = {
  openMovement: (productId?: string, type?: MovementType) => void;
  openOrder: (productIds?: string[]) => void;
  editOrder: (order: Order) => void;
  openProduct: (product?: Product) => void;
};

type Dialog =
  | { kind: "movement"; productId?: string; type?: MovementType }
  | { kind: "order"; productIds: string[]; order?: Order }
  | { kind: "product"; product?: Product }
  | null;

const savedMessage: Record<MovementType, string> = {
  out: "Venta registrada.",
  in: "Compra registrada.",
  adjust: "Conteo guardado.",
};

const ActionsContext = createContext<Actions | null>(null);

/** Ventanas compartidas por varias pantallas (registrar movimiento, pedido y producto). */
export function ActionsProvider({ children }: { children: ReactNode }) {
  const { store, data, run } = useStore();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);
  const { pathname } = useLocation();

  // Una ventana abierta no sigue al usuario a otra pantalla.
  useEffect(() => {
    setDialog(null);
  }, [pathname]);
  const categories = [...new Set(data.products.map((product) => product.category))];

  const actions = useMemo<Actions>(
    () => ({
      openMovement: (productId, type) => setDialog({ kind: "movement", productId, type }),
      openOrder: (productIds = []) => setDialog({ kind: "order", productIds }),
      editOrder: (order) => setDialog({ kind: "order", productIds: [], order }),
      openProduct: (product) => setDialog({ kind: "product", product }),
    }),
    [],
  );

  return (
    <ActionsContext.Provider value={actions}>
      {children}
      {store && dialog?.kind === "movement" ? (
        <MovementModal
          products={data.products}
          initialProductId={dialog.productId}
          initialType={dialog.type}
          onClose={close}
          onSubmit={(input) =>
            run(
              () => repository.registerMovement(store.id, input.productId, input.type, input.quantity, input.note),
              savedMessage[input.type],
            )
          }
        />
      ) : null}
      {store && dialog?.kind === "order" ? (
        <OrderModal
          products={data.products}
          suppliers={data.suppliers}
          initial={dialog.order ? { supplierId: dialog.order.supplierId, notes: dialog.order.notes, items: dialog.order.items } : undefined}
          initialProductIds={dialog.productIds}
          onClose={close}
          onSubmit={(input) =>
            dialog.order
              ? run(() => repository.updateOrderDraft(store.id, dialog.order!.id, input), `Pedido ${dialog.order.code} actualizado.`)
              : run(() => repository.createOrder(store.id, input), "Pedido creado como borrador.")
          }
        />
      ) : null}
      {store && dialog?.kind === "product" ? (
        <ProductModal
          product={dialog.product}
          suppliers={data.suppliers}
          categories={categories}
          onClose={close}
          onSubmit={(input) =>
            dialog.product
              ? run(() => repository.updateProduct(store.id, dialog.product!.id, input), "Producto actualizado.")
              : run(() => repository.createProduct(store.id, input), `${input.name} quedó en el inventario.`)
          }
        />
      ) : null}
    </ActionsContext.Provider>
  );
}

export const useActions = () => {
  const context = useContext(ActionsContext);
  if (!context) throw new Error("useActions debe usarse dentro de ActionsProvider");
  return context;
};
