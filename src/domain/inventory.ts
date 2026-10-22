import type { Movement, MovementType, Order, Product, ProductStatus, Supplier } from "../types";

export const MAX_QUANTITY = 100000;

export const statusFor = (product: Pick<Product, "stock" | "minStock">): ProductStatus => {
  if (product.stock <= 0 || product.stock <= product.minStock / 2) return "critical";
  if (product.stock <= product.minStock) return "low";
  return "healthy";
};

export const statusLabel: Record<ProductStatus, string> = {
  healthy: "En stock",
  low: "Por reponer",
  critical: "Agotándose",
};

export const movementLabel: Record<MovementType, string> = {
  in: "Compra",
  out: "Venta",
  adjust: "Ajuste por conteo",
};

/** Productos que necesitan reposición, del más urgente al menos urgente. */
export const lowStock = (products: Product[]) =>
  products
    .filter((product) => product.active && statusFor(product) !== "healthy")
    .sort((a, b) => a.stock / Math.max(a.minStock, 1) - b.stock / Math.max(b.minStock, 1));

/** Cantidad sugerida para volver al doble del nivel mínimo. */
export const suggestedQuantity = (product: Pick<Product, "stock" | "minStock">) =>
  Math.max(product.minStock * 2 - product.stock, 1);

/**
 * Calcula el cambio de existencias de un movimiento. Para "adjust" la cantidad es el
 * conteo físico real. Lanza un error con un mensaje para el usuario si no es válido.
 */
export const applyMovement = (
  product: Pick<Product, "name" | "stock">,
  type: MovementType,
  quantity: number,
) => {
  if (!Number.isInteger(quantity) || quantity < 0 || (type !== "adjust" && quantity === 0)) {
    throw new Error("La cantidad debe ser un número entero mayor que cero.");
  }
  if (quantity > MAX_QUANTITY) throw new Error("La cantidad es demasiado grande.");
  const delta = type === "in" ? quantity : type === "out" ? -quantity : quantity - product.stock;
  const stockAfter = product.stock + delta;
  if (stockAfter < 0) {
    throw new Error(`No hay suficientes unidades de ${product.name} (disponibles: ${product.stock}).`);
  }
  if (delta === 0) throw new Error("El conteo coincide con las existencias; no hay nada que ajustar.");
  return { delta, stockAfter };
};

export const orderUnits = (order: Pick<Order, "items">) =>
  order.items.reduce((total, item) => total + item.quantity, 0);

export const orderTotal = (order: Pick<Order, "items">) =>
  order.items.reduce((total, item) => total + item.quantity * item.unitCost, 0);

export const inventoryValue = (products: Product[]) =>
  products.reduce((total, product) => total + product.stock * (product.cost || product.price), 0);

/** Texto del pedido listo para enviar por WhatsApp o correo. */
export const orderMessage = (
  order: Pick<Order, "code" | "notes" | "items">,
  storeName: string,
  products: Product[],
  supplier?: Supplier,
) => {
  const lines = order.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return `- ${item.quantity} ${product?.unit ?? "und."} de ${product?.name ?? "producto"}`;
  });
  return [
    `Hola${supplier ? ` ${supplier.name}` : ""}, le escribe ${storeName}.`,
    `Pedido ${order.code}:`,
    ...lines,
    order.notes ? `Nota: ${order.notes}` : "",
    "Gracias.",
  ]
    .filter(Boolean)
    .join("\n");
};

/** Teléfono colombiano para wa.me (agrega 57 a celulares de 10 dígitos). */
export const whatsappPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
};

export type DailyActivity = { date: Date; label: string; in: number; out: number };

export const dailyActivity = (movements: Movement[], days = 7, today = new Date()): DailyActivity[] =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    const key = date.toDateString();
    const dayMovements = movements.filter((movement) => new Date(movement.createdAt).toDateString() === key);
    return {
      date,
      label: new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(date).replace(".", ""),
      in: dayMovements.filter((movement) => movement.delta > 0).reduce((total, movement) => total + movement.delta, 0),
      out: dayMovements.filter((movement) => movement.delta < 0).reduce((total, movement) => total - movement.delta, 0),
    };
  });

/** Productos con más salidas en el periodo. */
export const topSellers = (products: Product[], movements: Movement[], limit = 5) => {
  const totals = new Map<string, number>();
  for (const movement of movements) {
    if (movement.type !== "out") continue;
    totals.set(movement.productId, (totals.get(movement.productId) ?? 0) - movement.delta);
  }
  return [...totals.entries()]
    .map(([productId, units]) => ({ product: products.find((product) => product.id === productId), units }))
    .filter((row): row is { product: Product; units: number } => Boolean(row.product))
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
};

export const escapeCsv = (value: string | number) => {
  const text = String(value);
  // Evita que Excel interprete el contenido como fórmula.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const toCsv = (rows: (string | number)[][]) => rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

/** Lee un CSV simple (comas o punto y coma, comillas dobles). */
export const parseCsv = (text: string): string[][] => {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const separator = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim() !== ""));
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export type CsvProduct = {
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  supplier: string;
};

/** Convierte filas de CSV en productos. Acepta los encabezados que exporta la app. */
export const productsFromCsv = (rows: string[][]): { products: CsvProduct[]; errors: string[] } => {
  const [header, ...body] = rows;
  if (!header) return { products: [], errors: ["El archivo está vacío."] };
  const columns = header.map(normalize);
  const find = (...names: string[]) => columns.findIndex((column) => names.includes(column));
  const index = {
    name: find("producto", "nombre"),
    category: find("categoria"),
    unit: find("unidad"),
    stock: find("existencias", "stock", "cantidad"),
    minStock: find("minimo", "nivel minimo", "stock minimo"),
    cost: find("costo"),
    price: find("precio", "precio venta"),
    supplier: find("proveedor"),
  };
  if (index.name < 0) return { products: [], errors: ["Falta la columna Producto."] };
  const errors: string[] = [];
  const products: CsvProduct[] = [];
  const toNumber = (value: string | undefined) => {
    if (!value?.trim()) return 0;
    return Number(value.replace(/[$\s.]/g, "").replace(",", "."));
  };
  body.forEach((row, rowIndex) => {
    const name = row[index.name]?.trim() ?? "";
    if (name.length < 2) {
      errors.push(`Fila ${rowIndex + 2}: falta el nombre.`);
      return;
    }
    const product: CsvProduct = {
      name: name.slice(0, 80),
      category: (index.category >= 0 ? row[index.category]?.trim() : "") || "General",
      unit: (index.unit >= 0 ? row[index.unit]?.trim() : "") || "und.",
      stock: toNumber(index.stock >= 0 ? row[index.stock] : ""),
      minStock: toNumber(index.minStock >= 0 ? row[index.minStock] : ""),
      cost: toNumber(index.cost >= 0 ? row[index.cost] : ""),
      price: toNumber(index.price >= 0 ? row[index.price] : ""),
      supplier: index.supplier >= 0 ? (row[index.supplier]?.trim() ?? "") : "",
    };
    const invalid = (["stock", "minStock", "cost", "price"] as const).filter(
      (key) => !Number.isFinite(product[key]) || product[key] < 0,
    );
    if (invalid.length || !Number.isInteger(product.stock) || !Number.isInteger(product.minStock)) {
      errors.push(`Fila ${rowIndex + 2}: revisa las cantidades y precios de ${name}.`);
      return;
    }
    products.push(product);
  });
  return { products, errors };
};
