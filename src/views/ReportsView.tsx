import { useMemo, useState } from "react";
import { ChartBar, DownloadSimple, Table } from "@phosphor-icons/react";
import { EmptyState, PageHeader } from "../components/ui";
import { dailyActivity, inventoryValue, lowStock, toCsv, topSellers } from "../domain/inventory";
import { downloadFile, fileDate, formatCurrency, formatDate, formatNumber } from "../lib/format";
import { useStore } from "../state/StoreContext";

const PERIODS = [7, 30] as const;

/** Barras agrupadas de entradas y salidas por día, con tooltip y vista de tabla. */
function ActivityChart({ days }: { days: ReturnType<typeof dailyActivity> }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.flatMap((day) => [day.in, day.out]), 1);
  const dense = days.length > 10;
  const ticks = [max, Math.round(max / 2), 0];

  return (
    <div className="activity-chart">
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="swatch swatch--in" /> Entradas
        </span>
        <span>
          <i className="swatch swatch--out" /> Salidas
        </span>
      </div>
      <div className="chart-plot" role="img" aria-label="Unidades que entraron y salieron por día. La tabla de abajo tiene los mismos datos.">
        <div className="chart-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{formatNumber(tick)}</span>
          ))}
        </div>
        <div className="chart-bars" onMouseLeave={() => setHover(null)}>
          {days.map((day, index) => (
            <div
              key={day.date.toISOString()}
              className={`chart-group ${hover === index ? "chart-group--hover" : ""}`}
              onMouseEnter={() => setHover(index)}
            >
              <div className="chart-pair">
                <span className="chart-bar chart-bar--in" style={{ height: `${(day.in / max) * 100}%` }} />
                <span className="chart-bar chart-bar--out" style={{ height: `${(day.out / max) * 100}%` }} />
              </div>
              <span className="chart-label">{dense ? (index % 5 === 4 || index === days.length - 1 ? day.date.getDate() : "") : day.label}</span>
              {hover === index ? (
                <div className={`chart-tooltip ${index > days.length / 2 ? "chart-tooltip--left" : ""}`}>
                  <strong>{formatDate(day.date.toISOString())}</strong>
                  <span>
                    <i className="swatch swatch--in" /> Entradas <b>{day.in}</b>
                  </span>
                  <span>
                    <i className="swatch swatch--out" /> Salidas <b>{day.out}</b>
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReportsView() {
  const { store, data, notify } = useStore();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(7);
  const [showTable, setShowTable] = useState(false);
  const { products, movements } = data;

  const since = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (period - 1));
    return date;
  }, [period]);
  const inPeriod = movements.filter((movement) => new Date(movement.createdAt) >= since);
  const days = useMemo(() => dailyActivity(movements, period), [movements, period]);
  const sales = inPeriod.filter((movement) => movement.type === "out");
  const priceOf = (id: string) => products.find((product) => product.id === id);
  const revenue = sales.reduce((total, movement) => total - movement.delta * (priceOf(movement.productId)?.price ?? 0), 0);
  const profit = sales.reduce((total, movement) => {
    const product = priceOf(movement.productId);
    return total - movement.delta * ((product?.price ?? 0) - (product?.cost ?? 0));
  }, 0);
  const sellers = topSellers(products, inPeriod);
  const maxSeller = Math.max(...sellers.map((row) => row.units), 1);
  const total = inventoryValue(products);
  const categories = [...new Set(products.filter((product) => product.active).map((product) => product.category))]
    .map((category) => {
      const items = products.filter((product) => product.active && product.category === category);
      return {
        category,
        count: items.length,
        units: items.reduce((sum, product) => sum + product.stock, 0),
        value: inventoryValue(items),
      };
    })
    .sort((a, b) => b.value - a.value);
  const idle = products.filter(
    (product) => product.active && product.stock > 0 && !inPeriod.some((movement) => movement.productId === product.id && movement.type === "out"),
  );

  const exportReport = () => {
    const rows: (string | number)[][] = [
      [`Reporte de ${store?.name ?? "la tienda"}, últimos ${period} días`],
      ["Ventas estimadas", revenue],
      ["Ganancia estimada", profit],
      ["Valor del inventario a costo", total],
      [],
      ["Día", "Entradas", "Salidas"],
      ...days.map((day) => [formatDate(day.date.toISOString()), day.in, day.out]),
      [],
      ["Producto más vendido", "Unidades"],
      ...sellers.map((row) => [row.product.name, row.units]),
      [],
      ["Categoría", "Productos", "Unidades", "Valor"],
      ...categories.map((row) => [row.category, row.count, row.units, row.value]),
    ];
    downloadFile(`reporte-${period}-dias-${fileDate()}.csv`, `\uFEFF${toCsv(rows)}`, "text/csv;charset=utf-8");
    notify("Reporte descargado en CSV.");
  };

  if (!products.length) {
    return (
      <div className="view-stack">
        <PageHeader eyebrow="Para decidir qué comprar" title="Reportes" description="Los reportes aparecen cuando tengas productos y movimientos." />
        <section className="panel">
          <EmptyState icon={ChartBar} title="Aún no hay datos" description="Agrega productos y registra ventas para ver cómo se mueve tu tienda." />
        </section>
      </div>
    );
  }

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="Para decidir qué comprar"
        title="Reportes"
        description="Ventas, ganancia estimada y lo que tienes guardado en la estantería."
        action={
          <button className="button button--secondary" type="button" onClick={exportReport}>
            <DownloadSimple size={17} /> Descargar reporte
          </button>
        }
      />

      <div className="segmented" role="tablist" aria-label="Periodo del reporte">
        {PERIODS.map((value) => (
          <button key={value} role="tab" aria-selected={period === value} className={period === value ? "active" : ""} type="button" onClick={() => setPeriod(value)}>
            Últimos {value} días
          </button>
        ))}
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <small>Ventas estimadas</small>
          <strong>{formatCurrency(revenue)}</strong>
          <span>{sales.reduce((sum, movement) => sum - movement.delta, 0)} unidades vendidas</span>
        </div>
        <div className="stat-tile">
          <small>Ganancia estimada</small>
          <strong>{formatCurrency(profit)}</strong>
          <span>Precio de venta menos costo de compra</span>
        </div>
        <div className="stat-tile">
          <small>Valor del inventario</small>
          <strong>{formatCurrency(total)}</strong>
          <span>{lowStock(products).length} productos por reponer</span>
        </div>
      </div>

      <section className="panel report-chart-panel" aria-labelledby="chart-title">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Ritmo de la tienda</span>
            <h2 id="chart-title">Entradas y salidas por día</h2>
          </div>
          <button className="button button--secondary button--small" type="button" aria-pressed={showTable} onClick={() => setShowTable(!showTable)}>
            {showTable ? <ChartBar size={15} /> : <Table size={15} />} {showTable ? "Ver gráfico" : "Ver tabla"}
          </button>
        </div>
        {showTable ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col">Entradas</th>
                  <th scope="col">Salidas</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date.toISOString()}>
                    <td>{formatDate(day.date.toISOString())}</td>
                    <td>{day.in}</td>
                    <td>{day.out}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ActivityChart days={days} />
        )}
      </section>

      <div className="report-grid">
        <section className="panel" aria-labelledby="sellers-title">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Lo que más rota</span>
              <h2 id="sellers-title">Productos más vendidos</h2>
            </div>
          </div>
          {sellers.length ? (
            <ol className="hbar-list">
              {sellers.map((row) => (
                <li key={row.product.id}>
                  <span className="hbar-name">{row.product.name}</span>
                  <span className="hbar-track">
                    <span className="hbar-fill" style={{ width: `${(row.units / maxSeller) * 100}%` }} />
                  </span>
                  <strong>{row.units}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={ChartBar} title="Sin ventas en el periodo" description="Registra ventas para ver qué productos rotan más." />
          )}
        </section>

        <section className="panel" aria-labelledby="category-title">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Dinero en la estantería</span>
              <h2 id="category-title">Valor por categoría</h2>
            </div>
          </div>
          <ol className="hbar-list">
            {categories.map((row) => (
              <li key={row.category}>
                <span className="hbar-name">
                  {row.category}
                  <small>
                    {row.count} productos, {row.units} unidades
                  </small>
                </span>
                <span className="hbar-track">
                  <span className="hbar-fill hbar-fill--value" style={{ width: `${total ? (row.value / total) * 100 : 0}%` }} />
                </span>
                <strong>{formatCurrency(row.value)}</strong>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {idle.length ? (
        <section className="panel" aria-labelledby="idle-title">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Baja rotación</span>
              <h2 id="idle-title">Sin ventas en {period} días</h2>
            </div>
          </div>
          <p className="muted-text">Antes de volver a comprar estos productos, revisa si conviene pedir menos cantidad.</p>
          <ul className="chip-list">
            {idle.map((product) => (
              <li key={product.id}>
                {product.name} <small>({product.stock})</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
