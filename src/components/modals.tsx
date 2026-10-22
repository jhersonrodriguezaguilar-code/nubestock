import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ClipboardText, Plus, Scales, Trash } from "@phosphor-icons/react";
import { applyMovement, suggestedQuantity } from "../domain/inventory";
import { formatCurrency } from "../lib/format";
import type { MovementType, OrderInput, OrderItem, Product, ProductInput, Supplier, SupplierInput } from "../types";
import { Modal, ModalActions } from "./ui";

export const DEFAULT_CATEGORIES = ["Abarrotes", "Bebidas", "Lácteos", "Panadería", "Aseo", "Snacks", "Frutas y verduras", "Cárnicos", "General"];

const toInt = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

type Submit<T> = (value: T) => Promise<boolean>;

/* ------------------------------------------------------------------------- */

export function ProductModal({
  product,
  suppliers,
  categories,
  onClose,
  onSubmit,
}: {
  product?: Product;
  suppliers: Supplier[];
  categories: string[];
  onClose: () => void;
  onSubmit: Submit<ProductInput>;
}) {
  const [draft, setDraft] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "Abarrotes",
    unit: product?.unit ?? "und.",
    stock: String(product?.stock ?? 0),
    minStock: String(product?.minStock ?? 5),
    cost: String(product?.cost ?? 0),
    price: String(product?.price ?? 0),
    supplierId: product?.supplierId ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const options = [...new Set([...DEFAULT_CATEGORIES, ...categories])].sort((a, b) => a.localeCompare(b, "es"));
  const margin = Number(draft.price) - Number(draft.cost);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: ProductInput = {
      name: draft.name.trim(),
      category: draft.category,
      unit: draft.unit.trim() || "und.",
      stock: toInt(draft.stock),
      minStock: toInt(draft.minStock),
      cost: toInt(draft.cost),
      price: toInt(draft.price),
      supplierId: draft.supplierId || null,
    };
    if (input.name.length < 2) return setError("Escribe el nombre del producto (mínimo 2 letras).");
    if (!Number.isInteger(input.stock) || !Number.isInteger(input.minStock) || input.stock < 0 || input.minStock < 0) {
      return setError("Las existencias y el nivel mínimo deben ser números enteros desde 0.");
    }
    if (![input.cost, input.price].every((value) => Number.isFinite(value) && value >= 0)) {
      return setError("El costo y el precio deben ser valores desde 0.");
    }
    setError("");
    setBusy(true);
    const ok = await onSubmit(input);
    setBusy(false);
    if (ok) onClose();
  };

  const set = (key: keyof typeof draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [key]: event.target.value });

  return (
    <Modal
      title={product ? "Editar producto" : "Agregar producto"}
      description={product ? `${product.sku}. Las existencias se cambian registrando un movimiento.` : "Registra el producto y define cuándo debe avisarte que se está acabando."}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <label className="form-field form-field--wide">
            <span>Nombre del producto</span>
            <input autoFocus required maxLength={80} value={draft.name} onChange={set("name")} placeholder="Ej. Fríjol rojo 500 g" />
          </label>
          <label className="form-field">
            <span>Categoría</span>
            <select value={draft.category} onChange={set("category")}>
              {options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Unidad de venta</span>
            <input maxLength={15} value={draft.unit} onChange={set("unit")} placeholder="und., kg, paquete" />
          </label>
          {product ? null : (
            <label className="form-field">
              <span>Existencias iniciales</span>
              <input type="number" inputMode="numeric" min="0" step="1" value={draft.stock} onChange={set("stock")} />
            </label>
          )}
          <label className="form-field">
            <span>Avisarme al llegar a</span>
            <input type="number" inputMode="numeric" min="0" step="1" value={draft.minStock} onChange={set("minStock")} />
          </label>
          <label className="form-field">
            <span>Costo de compra</span>
            <input type="number" inputMode="numeric" min="0" step="50" value={draft.cost} onChange={set("cost")} />
          </label>
          <label className="form-field">
            <span>Precio de venta</span>
            <input type="number" inputMode="numeric" min="0" step="50" value={draft.price} onChange={set("price")} />
          </label>
          <label className="form-field form-field--wide">
            <span>Proveedor principal</span>
            <select value={draft.supplierId} onChange={set("supplierId")}>
              <option value="">Sin proveedor asignado</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {Number(draft.price) > 0 ? (
          <p className={`form-hint ${margin < 0 ? "form-hint--warning" : ""}`}>
            {margin < 0 ? "El precio de venta es menor que el costo." : `Ganancia por unidad: ${formatCurrency(margin)}.`}
          </p>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <ModalActions onCancel={onClose} submitLabel={product ? "Guardar cambios" : "Guardar producto"} submitIcon={Check} busy={busy} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------------- */

const movementCopy: Record<MovementType, { label: string; quantity: string; placeholder: string }> = {
  out: { label: "Venta", quantity: "Unidades vendidas", placeholder: "Ej. Venta mostrador" },
  in: { label: "Compra", quantity: "Unidades que llegaron", placeholder: "Ej. Compra en el mayorista" },
  adjust: { label: "Conteo", quantity: "Unidades contadas en la estantería", placeholder: "Ej. Conteo del sábado" },
};

export function MovementModal({
  products,
  initialProductId,
  initialType,
  onClose,
  onSubmit,
}: {
  products: Product[];
  initialProductId?: string;
  initialType?: MovementType;
  onClose: () => void;
  onSubmit: Submit<{ productId: string; type: MovementType; quantity: number; note: string }>;
}) {
  const active = products.filter((product) => product.active);
  const [productId, setProductId] = useState(initialProductId ?? active[0]?.id ?? "");
  const [type, setType] = useState<MovementType>(initialType ?? "out");
  const [quantity, setQuantity] = useState(initialType === "adjust" ? "" : "1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const product = active.find((candidate) => candidate.id === productId);

  let preview: string = "-";
  let previewError = "";
  if (product && quantity !== "") {
    try {
      preview = `${applyMovement(product, type, toInt(quantity)).stockAfter} ${product.unit}`;
    } catch (caught) {
      previewError = (caught as Error).message;
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product) return setError("Selecciona un producto.");
    try {
      applyMovement(product, type, toInt(quantity));
    } catch (caught) {
      return setError((caught as Error).message);
    }
    setError("");
    setBusy(true);
    const ok = await onSubmit({ productId, type, quantity: toInt(quantity), note });
    setBusy(false);
    if (ok) onClose();
  };

  if (!active.length) {
    return (
      <Modal title="Registrar movimiento" description="Primero agrega un producto al inventario." onClose={onClose}>
        <div className="modal-actions">
          <button className="button button--primary" type="button" onClick={onClose}>
            Entendido
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Registrar movimiento" description="Actualiza las existencias por una venta, una compra o un conteo físico." onClose={onClose}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <div className="movement-type-toggle movement-type-toggle--three" role="radiogroup" aria-label="Tipo de movimiento">
          {(["out", "in", "adjust"] as MovementType[]).map((option) => (
            <button
              key={option}
              className={type === option ? "active" : ""}
              type="button"
              role="radio"
              aria-checked={type === option}
              onClick={() => {
                setType(option);
                if (option === "adjust" && product) setQuantity(String(product.stock));
              }}
            >
              {option === "out" ? <ArrowUp size={17} /> : option === "in" ? <ArrowDown size={17} /> : <Scales size={17} />}
              {movementCopy[option].label}
            </button>
          ))}
        </div>
        <label className="form-field">
          <span>Producto</span>
          <select value={productId} onChange={(event) => setProductId(event.target.value)}>
            {active.map((option) => (
              <option value={option.id} key={option.id}>
                {option.name} ({option.stock} disponibles)
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid form-grid--two">
          <label className="form-field">
            <span>{movementCopy[type].quantity}</span>
            <input autoFocus type="number" inputMode="numeric" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <div className={`movement-preview ${previewError ? "movement-preview--error" : ""}`} aria-live="polite">
            <span>Quedarán</span>
            <strong>{previewError ? "No alcanza" : preview}</strong>
          </div>
        </div>
        <label className="form-field">
          <span>
            Nota <small>Opcional</small>
          </span>
          <input maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} placeholder={movementCopy[type].placeholder} />
        </label>
        {error || previewError ? <p className="form-error" role="alert">{error || previewError}</p> : null}
        <ModalActions onCancel={onClose} submitLabel={`Guardar ${movementCopy[type].label.toLowerCase()}`} submitIcon={Check} busy={busy} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------------- */

export function OrderModal({
  products,
  suppliers,
  initial,
  initialProductIds = [],
  onClose,
  onSubmit,
}: {
  products: Product[];
  suppliers: Supplier[];
  initial?: OrderInput;
  initialProductIds?: string[];
  onClose: () => void;
  onSubmit: Submit<OrderInput>;
}) {
  const active = products.filter((product) => product.active);
  const startItems: OrderItem[] =
    initial?.items ??
    initialProductIds
      .map((id) => active.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product))
      .map((product) => ({ productId: product.id, quantity: suggestedQuantity(product), unitCost: product.cost }));
  const firstProduct = active.find((product) => product.id === startItems[0]?.productId);
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? firstProduct?.supplierId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<{ productId: string; quantity: string; unitCost: string }[]>(
    startItems.map((item) => ({ productId: item.productId, quantity: String(item.quantity), unitCost: String(item.unitCost) })),
  );
  const [adding, setAdding] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const available = active
    .filter((product) => !items.some((item) => item.productId === product.id))
    .sort((a, b) => {
      // Primero los productos del proveedor elegido.
      const rank = (product: Product) => (supplierId && product.supplierId === supplierId ? 0 : 1);
      return rank(a) - rank(b) || a.name.localeCompare(b.name, "es");
    });
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);

  const addProduct = (id: string) => {
    const product = active.find((candidate) => candidate.id === id);
    if (!product) return;
    setItems([...items, { productId: id, quantity: String(suggestedQuantity(product)), unitCost: String(product.cost) }]);
    if (!supplierId && product.supplierId) setSupplierId(product.supplierId);
    setAdding("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!items.length) return setError("Agrega al menos un producto al pedido.");
    const parsed = items.map((item) => ({ productId: item.productId, quantity: toInt(item.quantity), unitCost: Number(item.unitCost) || 0 }));
    if (parsed.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100000)) {
      return setError("Cada cantidad debe ser un número entero mayor que cero.");
    }
    if (parsed.some((item) => item.unitCost < 0)) return setError("El costo no puede ser negativo.");
    setError("");
    setBusy(true);
    const ok = await onSubmit({ supplierId: supplierId || null, notes: notes.trim(), items: parsed });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={initial ? "Editar pedido" : "Crear pedido"}
      description="Arma la lista para tu proveedor. Se guarda como borrador hasta que la envíes."
      onClose={onClose}
      wide
    >
      <form className="modal-form" onSubmit={submit} noValidate>
        <label className="form-field">
          <span>Proveedor</span>
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Sin proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <div className="order-lines">
          <div className="order-lines__head" aria-hidden="true">
            <span>Producto</span>
            <span>Cantidad</span>
            <span>Costo unitario</span>
            <span />
          </div>
          {items.map((item, index) => {
            const product = active.find((candidate) => candidate.id === item.productId);
            return (
              <div className="order-line" key={item.productId}>
                <span className="order-line__name">
                  <strong>{product?.name ?? "Producto"}</strong>
                  <small>
                    Hay {product?.stock ?? 0}, aviso en {product?.minStock ?? 0}
                  </small>
                </span>
                <input
                  aria-label={`Cantidad de ${product?.name}`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(event) => setItems(items.map((line, i) => (i === index ? { ...line, quantity: event.target.value } : line)))}
                />
                <input
                  aria-label={`Costo unitario de ${product?.name}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="50"
                  value={item.unitCost}
                  onChange={(event) => setItems(items.map((line, i) => (i === index ? { ...line, unitCost: event.target.value } : line)))}
                />
                <button
                  className="icon-button icon-button--subtle"
                  type="button"
                  aria-label={`Quitar ${product?.name}`}
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                >
                  <Trash size={17} />
                </button>
              </div>
            );
          })}
          <label className="order-line order-line--add">
            <Plus size={17} aria-hidden="true" />
            <select aria-label="Agregar producto al pedido" value={adding} onChange={(event) => addProduct(event.target.value)}>
              <option value="">{available.length ? "Agregar producto…" : "Ya agregaste todos los productos"}</option>
              {available.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.stock} disponibles)
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="order-total">
          <span>Total estimado</span>
          <strong>{formatCurrency(total)}</strong>
        </div>

        <label className="form-field">
          <span>
            Nota para el proveedor <small>Opcional</small>
          </span>
          <input maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. Entregar antes de las 9 a. m." />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <ModalActions onCancel={onClose} submitLabel={initial ? "Guardar borrador" : "Crear borrador"} submitIcon={ClipboardText} busy={busy} />
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------------- */

export function SupplierModal({
  supplier,
  onClose,
  onSubmit,
}: {
  supplier?: Supplier;
  onClose: () => void;
  onSubmit: Submit<SupplierInput>;
}) {
  const [draft, setDraft] = useState<SupplierInput>({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    notes: supplier?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = { ...draft, name: draft.name.trim(), phone: draft.phone.trim(), email: draft.email.trim().toLowerCase(), notes: draft.notes.trim() };
    if (clean.name.length < 2) return setError("Escribe el nombre del proveedor.");
    if (clean.phone && !/^[\d\s+()-]{7,20}$/.test(clean.phone)) return setError("Revisa el teléfono: solo números, espacios o +.");
    if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) return setError("Revisa el correo del proveedor.");
    setError("");
    setBusy(true);
    const ok = await onSubmit(clean);
    setBusy(false);
    if (ok) onClose();
  };

  const set = (key: keyof SupplierInput) => (event: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [key]: event.target.value });

  return (
    <Modal title={supplier ? "Editar proveedor" : "Agregar proveedor"} description="Guarda el contacto para enviarle pedidos por WhatsApp o correo." onClose={onClose}>
      <form className="modal-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <label className="form-field form-field--wide">
            <span>Nombre</span>
            <input autoFocus maxLength={80} value={draft.name} onChange={set("name")} placeholder="Ej. Distribuciones La 14" />
          </label>
          <label className="form-field">
            <span>
              Celular o WhatsApp <small>Opcional</small>
            </span>
            <input type="tel" inputMode="tel" maxLength={20} value={draft.phone} onChange={set("phone")} placeholder="310 555 0101" />
          </label>
          <label className="form-field">
            <span>
              Correo <small>Opcional</small>
            </span>
            <input type="email" maxLength={120} value={draft.email} onChange={set("email")} placeholder="ventas@proveedor.com" />
          </label>
          <label className="form-field form-field--wide">
            <span>
              Notas <small>Opcional</small>
            </span>
            <input maxLength={300} value={draft.notes} onChange={set("notes")} placeholder="Ej. Visita los lunes" />
          </label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <ModalActions onCancel={onClose} submitLabel={supplier ? "Guardar cambios" : "Guardar proveedor"} submitIcon={Check} busy={busy} />
      </form>
    </Modal>
  );
}
