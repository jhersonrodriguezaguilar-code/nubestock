import { useRef, useState } from "react";
import { ArrowCounterClockwise, Check, DownloadSimple, FileArrowUp, Key, Moon, Storefront } from "@phosphor-icons/react";
import { PageHeader } from "../components/ui";
import { errorMessage, isDemo, repository } from "../data";
import { LocalRepository } from "../data/localRepository";
import { parseCsv, productsFromCsv, toCsv } from "../domain/inventory";
import { downloadFile, fileDate } from "../lib/format";
import { applyTheme, readTheme, type ThemePreference } from "../lib/theme";
import { useStore } from "../state/StoreContext";

const TEMPLATE = toCsv([
  ["Producto", "Categoría", "Unidad", "Existencias", "Mínimo", "Costo", "Precio", "Proveedor"],
  ["Arroz 1 kg", "Abarrotes", "und.", 20, 10, 3900, 4600, "Distribuciones La 14"],
]);

export function SettingsView() {
  const { store, data, isOwner, run, notify, reloadStores, refresh } = useStore();
  const [name, setName] = useState(store?.name ?? "");
  const [theme, setTheme] = useState<ThemePreference>(readTheme);
  const [password, setPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const rename = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) return notify("Escribe el nombre de la tienda.", "error");
    const ok = await run(() => repository.renameStore(store!.id, name.trim()), "Nombre de la tienda actualizado.", { reload: false });
    if (ok) await reloadStores(store!.id);
  };

  const backup = () => {
    const payload = { app: "NubeStock", version: 1, exportedAt: new Date().toISOString(), store: { name: store?.name }, ...data };
    downloadFile(`respaldo-nubestock-${fileDate()}.json`, JSON.stringify(payload, null, 2), "application/json");
    notify("Respaldo descargado. Guárdalo en un lugar seguro.");
  };

  const importCsv = async (file: File) => {
    if (!store) return;
    if (file.size > 1_000_000) return notify("El archivo es muy grande. Usa un CSV de menos de 1 MB.", "error");
    setImporting(true);
    setImportReport([]);
    const report: string[] = [];
    try {
      const { products, errors } = productsFromCsv(parseCsv(await file.text()));
      report.push(...errors);
      const existing = new Set(data.products.map((product) => product.name.toLowerCase()));
      const suppliers = new Map(data.suppliers.map((supplier) => [supplier.name.toLowerCase(), supplier.id]));
      let created = 0;
      for (const product of products.slice(0, 500)) {
        if (existing.has(product.name.toLowerCase())) {
          report.push(`${product.name}: ya existe, no se importó.`);
          continue;
        }
        let supplierId: string | null = null;
        if (product.supplier) {
          supplierId = suppliers.get(product.supplier.toLowerCase()) ?? null;
          if (!supplierId) {
            const supplier = await repository.createSupplier(store.id, { name: product.supplier.slice(0, 80), phone: "", email: "", notes: "" });
            supplierId = supplier.id;
            suppliers.set(product.supplier.toLowerCase(), supplier.id);
          }
        }
        await repository.createProduct(store.id, {
          name: product.name,
          category: product.category.slice(0, 40),
          unit: product.unit.slice(0, 15),
          stock: product.stock,
          minStock: product.minStock,
          cost: product.cost,
          price: product.price,
          supplierId,
        });
        existing.add(product.name.toLowerCase());
        created += 1;
      }
      if (products.length > 500) report.push("Solo se importan 500 productos por archivo.");
      notify(created ? `${created} productos importados.` : "No se importó ningún producto.", created ? "success" : "error");
    } catch (error) {
      report.push(errorMessage(error));
      notify("La importación se detuvo por un error.", "error");
    } finally {
      setImportReport(report);
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) return notify("La contraseña debe tener al menos 8 caracteres.", "error");
    const ok = await run(() => repository.updatePassword(password), "Contraseña actualizada.", { reload: false });
    if (ok) setPassword("");
  };

  return (
    <div className="view-stack">
      <PageHeader eyebrow="Ajustes" title="Configuración" description="Datos de la tienda, apariencia, importación y respaldo." />

      <div className="settings-grid">
        <section className="panel settings-card" aria-labelledby="store-title">
          <h2 id="store-title">
            <Storefront size={19} /> Tienda
          </h2>
          <form className="inline-form" onSubmit={rename}>
            <label className="form-field">
              <span>Nombre</span>
              <input value={name} maxLength={80} disabled={!isOwner} onChange={(event) => setName(event.target.value)} />
            </label>
            {isOwner ? (
              <button className="button button--primary" type="submit">
                <Check size={17} /> Guardar
              </button>
            ) : null}
          </form>
        </section>

        <section className="panel settings-card" aria-labelledby="theme-title">
          <h2 id="theme-title">
            <Moon size={19} /> Apariencia
          </h2>
          <div className="segmented" role="radiogroup" aria-label="Tema">
            {(
              [
                ["system", "Como el equipo"],
                ["light", "Claro"],
                ["dark", "Oscuro"],
              ] as [ThemePreference, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                className={theme === value ? "active" : ""}
                onClick={() => {
                  setTheme(value);
                  applyTheme(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {isOwner ? (
          <section className="panel settings-card" aria-labelledby="import-title">
            <h2 id="import-title">
              <FileArrowUp size={19} /> Importar productos
            </h2>
            <p className="muted-text">
              Sube un CSV con las columnas Producto, Categoría, Unidad, Existencias, Mínimo, Costo, Precio y Proveedor. Los proveedores que no existan se crean.
            </p>
            <div className="button-row">
              <label className={`button button--primary ${importing ? "button--busy" : ""}`}>
                <FileArrowUp size={17} /> {importing ? "Importando…" : "Elegir archivo CSV"}
                <input
                  ref={fileRef}
                  className="sr-only"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={importing}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importCsv(file);
                  }}
                />
              </label>
              <button className="button button--secondary" type="button" onClick={() => downloadFile("plantilla-nubestock.csv", `\uFEFF${TEMPLATE}`, "text/csv;charset=utf-8")}>
                Descargar plantilla
              </button>
            </div>
            {importReport.length ? (
              <ul className="import-report" aria-live="polite">
                {importReport.slice(0, 20).map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {importReport.length > 20 ? <li>Y {importReport.length - 20} avisos más.</li> : null}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="panel settings-card" aria-labelledby="backup-title">
          <h2 id="backup-title">
            <DownloadSimple size={19} /> Respaldo
          </h2>
          <p className="muted-text">
            {isDemo
              ? "En la demostración los datos viven solo en este navegador. Descarga un respaldo antes de borrar el historial del navegador."
              : "Tus datos están en la nube. Además puedes descargar una copia completa (productos, movimientos, pedidos y proveedores)."}
          </p>
          <div className="button-row">
            <button className="button button--secondary" type="button" onClick={backup}>
              <DownloadSimple size={17} /> Descargar respaldo JSON
            </button>
            {isDemo ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={async () => {
                  if (!window.confirm("¿Restaurar los datos de demostración? Se perderán los cambios hechos en este navegador.")) return;
                  (repository as LocalRepository).resetDemo();
                  await reloadStores("demo-store");
                  await refresh();
                  notify("Datos de demostración restaurados.");
                }}
              >
                <ArrowCounterClockwise size={17} /> Restaurar demostración
              </button>
            ) : null}
          </div>
        </section>

        {!isDemo ? (
          <section className="panel settings-card" aria-labelledby="password-title">
            <h2 id="password-title">
              <Key size={19} /> Contraseña
            </h2>
            <form className="inline-form" onSubmit={changePassword}>
              <label className="form-field">
                <span>Nueva contraseña</span>
                <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <button className="button button--primary" type="submit">
                <Check size={17} /> Cambiar
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}
