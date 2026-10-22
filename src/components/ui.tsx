import { useEffect, useId, useRef, type ElementType, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, CircleNotch, X } from "@phosphor-icons/react";
import { statusLabel } from "../domain/inventory";
import type { OrderStatus, ProductStatus } from "../types";

export type IconComponent = ElementType;

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconComponent;
  tone: "green" | "orange" | "ink" | "sand";
  onClick?: () => void;
}) {
  return (
    <button className={`metric-card metric-card--${tone}`} type="button" onClick={onClick}>
      <span className="metric-icon">
        <Icon size={20} weight="bold" />
      </span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
      <ArrowUpRight className="metric-arrow" size={17} />
    </button>
  );
}

export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span />
      {statusLabel[status]}
    </span>
  );
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  received: "Recibido",
  cancelled: "Cancelado",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`order-status order-status--${status}`}>{orderStatusLabel[status]}</span>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon size={25} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <CircleNotch size={18} className="spin" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function Monogram({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`product-monogram product-monogram--table ${className}`} aria-hidden="true">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Ventana modal accesible: Escape cierra, el foco vuelve al botón que la abrió. */
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>("[autofocus], input, select, textarea, button:not(.modal-close)");
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab" && dialog) {
        const focusable = [...dialog.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href]")].filter(
          (element) => !element.hasAttribute("disabled"),
        );
        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl?.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`modal ${wide ? "modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p>{description}</p>
          </div>
          <button className="icon-button modal-close" type="button" aria-label="Cerrar ventana" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ModalActions({
  onCancel,
  submitLabel,
  submitIcon: Icon,
  busy,
}: {
  onCancel: () => void;
  submitLabel: string;
  submitIcon: IconComponent;
  busy: boolean;
}) {
  return (
    <div className="modal-actions">
      <button className="button button--secondary" type="button" onClick={onCancel}>
        Cancelar
      </button>
      <button className="button button--primary" type="submit" disabled={busy}>
        {busy ? <CircleNotch size={17} className="spin" /> : <Icon size={17} weight="bold" />} {submitLabel}
      </button>
    </div>
  );
}

export type SubmitHandler = (event: FormEvent<HTMLFormElement>) => void;
