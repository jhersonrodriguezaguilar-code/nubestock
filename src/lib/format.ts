const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-CO");
const shortDate = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" });
const dateTime = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });

export const formatCurrency = (value: number) => currency.format(value);
export const formatNumber = (value: number) => number.format(value);
export const formatDate = (value: string) => shortDate.format(new Date(value));
export const formatDateTime = (value: string) => dateTime.format(new Date(value));
export const formatLongDate = (value = new Date()) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(value);

export const isToday = (value: string) => new Date(value).toDateString() === new Date().toDateString();

export const initials = (text: string) =>
  text
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "NS";

export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
};

/** Descarga un archivo generado en el navegador. */
export const downloadFile = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const fileDate = () => new Date().toISOString().slice(0, 10);
