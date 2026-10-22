import { describe, expect, it } from "vitest";
import {
  applyMovement,
  dailyActivity,
  escapeCsv,
  lowStock,
  orderMessage,
  parseCsv,
  productsFromCsv,
  statusFor,
  suggestedQuantity,
  topSellers,
  whatsappPhone,
} from "./inventory";
import type { Movement, Product } from "../types";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "p1",
  name: "Arroz 1 kg",
  sku: "NS-001",
  category: "Abarrotes",
  unit: "und.",
  stock: 10,
  minStock: 8,
  cost: 3800,
  price: 4600,
  supplierId: null,
  active: true,
  updatedAt: "2026-10-01T10:00:00.000Z",
  ...overrides,
});

const movement = (overrides: Partial<Movement> = {}): Movement => ({
  id: "m1",
  productId: "p1",
  type: "out",
  delta: -2,
  stockAfter: 8,
  note: "",
  orderId: null,
  createdByEmail: "",
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("statusFor", () => {
  it("clasifica según el nivel mínimo", () => {
    expect(statusFor({ stock: 20, minStock: 8 })).toBe("healthy");
    expect(statusFor({ stock: 8, minStock: 8 })).toBe("low");
    expect(statusFor({ stock: 4, minStock: 8 })).toBe("critical");
    expect(statusFor({ stock: 0, minStock: 0 })).toBe("critical");
  });
});

describe("applyMovement", () => {
  it("suma entradas y resta salidas", () => {
    expect(applyMovement(product(), "in", 5)).toEqual({ delta: 5, stockAfter: 15 });
    expect(applyMovement(product(), "out", 4)).toEqual({ delta: -4, stockAfter: 6 });
  });

  it("ajusta al conteo físico", () => {
    expect(applyMovement(product(), "adjust", 7)).toEqual({ delta: -3, stockAfter: 7 });
    expect(applyMovement(product(), "adjust", 0)).toEqual({ delta: -10, stockAfter: 0 });
  });

  it("no permite existencias negativas ni cantidades inválidas", () => {
    expect(() => applyMovement(product(), "out", 11)).toThrow(/No hay suficientes/);
    expect(() => applyMovement(product(), "in", 0)).toThrow(/mayor que cero/);
    expect(() => applyMovement(product(), "in", 1.5)).toThrow(/entero/);
    expect(() => applyMovement(product(), "adjust", 10)).toThrow(/coincide/);
  });
});

describe("reposición", () => {
  it("ordena por urgencia e ignora productos archivados", () => {
    const list = lowStock([
      product({ id: "a", stock: 7, minStock: 8 }),
      product({ id: "b", stock: 1, minStock: 8 }),
      product({ id: "c", stock: 1, minStock: 8, active: false }),
      product({ id: "d", stock: 30 }),
    ]);
    expect(list.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("sugiere volver al doble del mínimo", () => {
    expect(suggestedQuantity({ stock: 3, minStock: 8 })).toBe(13);
    expect(suggestedQuantity({ stock: 30, minStock: 8 })).toBe(1);
  });
});

describe("pedidos", () => {
  it("arma el mensaje para el proveedor", () => {
    const text = orderMessage(
      { code: "PED-0001", notes: "Entregar en la mañana", items: [{ productId: "p1", quantity: 12, unitCost: 0 }] },
      "Tienda La Esquina",
      [product()],
      { id: "s1", name: "Distribuciones Norte", phone: "", email: "", notes: "" },
    );
    expect(text).toContain("Hola Distribuciones Norte, le escribe Tienda La Esquina.");
    expect(text).toContain("- 12 und. de Arroz 1 kg");
    expect(text).toContain("Nota: Entregar en la mañana");
  });

  it("normaliza celulares colombianos para WhatsApp", () => {
    expect(whatsappPhone("310 555 1234")).toBe("573105551234");
    expect(whatsappPhone("+57 310 555 1234")).toBe("573105551234");
  });
});

describe("reportes", () => {
  it("agrupa entradas y salidas por día", () => {
    const today = new Date("2026-10-22T15:00:00");
    const days = dailyActivity(
      [
        movement({ delta: -3, createdAt: "2026-10-22T09:00:00" }),
        movement({ type: "in", delta: 10, createdAt: "2026-10-22T10:00:00" }),
        movement({ delta: -1, createdAt: "2026-10-21T10:00:00" }),
      ],
      7,
      today,
    );
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ in: 10, out: 3 });
    expect(days[5]).toMatchObject({ in: 0, out: 1 });
  });

  it("calcula los productos más vendidos", () => {
    const rows = topSellers(
      [product(), product({ id: "p2", name: "Leche" })],
      [movement({ delta: -2 }), movement({ productId: "p2", delta: -5 }), movement({ type: "in", delta: 9 })],
    );
    expect(rows.map((row) => [row.product.id, row.units])).toEqual([
      ["p2", 5],
      ["p1", 2],
    ]);
  });
});

describe("CSV", () => {
  it("escapa comillas y fórmulas", () => {
    expect(escapeCsv('Dice "hola"')).toBe('"Dice ""hola"""');
    expect(escapeCsv("=SUMA(A1)")).toBe(`"'=SUMA(A1)"`);
    expect(escapeCsv(-5)).toBe('"-5"');
  });

  it("lee el formato exportado y separadores con punto y coma", () => {
    const rows = parseCsv('\uFEFFProducto;Categoría;Existencias;Mínimo;Precio\n"Café; molido";Abarrotes;15;8;11200\n');
    expect(rows).toEqual([
      ["Producto", "Categoría", "Existencias", "Mínimo", "Precio"],
      ["Café; molido", "Abarrotes", "15", "8", "11200"],
    ]);
    const { products, errors } = productsFromCsv(rows);
    expect(errors).toEqual([]);
    expect(products[0]).toMatchObject({ name: "Café; molido", stock: 15, minStock: 8, price: 11200, unit: "und." });
  });

  it("reporta filas inválidas sin detener la importación", () => {
    const { products, errors } = productsFromCsv([
      ["Producto", "Existencias"],
      ["Arroz", "4"],
      ["Leche", "-2"],
      ["", "3"],
    ]);
    expect(products).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });
});
