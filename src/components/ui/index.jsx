"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { useStudioStore } from "@/lib/store/studio-store";

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const BUTTON_VARIANTS = {
  primary: "bg-orange-500 text-white hover:bg-orange-400 disabled:bg-orange-500/50",
  secondary: "border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800",
  ghost: "text-slate-300 hover:bg-slate-800 hover:text-white",
  danger: "bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-600/50",
  dangerGhost: "text-rose-300 hover:bg-rose-500/10",
};

const BUTTON_SIZES = {
  xs: "h-7 gap-1 px-2 text-xs",
  sm: "h-8 gap-1.5 px-2.5 text-sm",
  md: "h-9 gap-2 px-3.5 text-sm",
};

export function Button({ variant = "secondary", size = "md", icon: Icon, loading, disabled, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
      disabled={loading || disabled}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

const BADGE_TONES = {
  neutral: "border-slate-700 bg-slate-800/80 text-slate-300",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  red: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  blue: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-300",
};

export function Badge({ tone = "neutral", className, children }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cn("rounded-xl border border-slate-800 bg-slate-900/70", className)} {...props}>
      {children}
    </div>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-slate-400", className)} />;
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 px-6 py-12 text-center", className)}>
      {Icon ? <Icon className="mb-3 h-8 w-8 text-slate-600" /> : null}
      <div className="font-medium text-slate-200">{title}</div>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Base look for inputs/selects without a width, for controls sized by the caller. */
export const controlClass =
  "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-orange-400/70 focus:ring-2 focus:ring-orange-400/20 disabled:opacity-60";

/** Full-width form input. */
export const inputClass = `w-full ${controlClass}`;

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cn("block", className)}>
      {label ? <span className="mb-1.5 block text-sm font-medium text-slate-200">{label}</span> : null}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-300">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Alert({ tone = "info", title, children, className }) {
  const styles = {
    info: ["border-sky-500/30 bg-sky-500/10 text-sky-200", Info],
    warning: ["border-amber-500/30 bg-amber-500/10 text-amber-200", AlertTriangle],
    error: ["border-rose-500/30 bg-rose-500/10 text-rose-200", XCircle],
    success: ["border-emerald-500/30 bg-emerald-500/10 text-emerald-200", CheckCircle2],
  }[tone];
  const Icon = styles[1];
  return (
    <div className={cn("flex gap-3 rounded-lg border p-3 text-sm", styles[0], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title ? <div className="font-medium">{title}</div> : null}
        {children ? <div className={cn("break-words", title && "mt-0.5 opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("flex max-h-[90vh] w-full flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl", width)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-slate-400">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", tone = "danger", busy, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-300">{message}</div>
    </Modal>
  );
}

export function Toaster() {
  const toasts = useStudioStore((state) => state.toasts);
  const dismiss = useStudioStore((state) => state.dismissToast);
  const tones = {
    info: "border-slate-700 bg-slate-900 text-slate-100",
    success: "border-emerald-500/40 bg-emerald-950 text-emerald-100",
    error: "border-rose-500/40 bg-rose-950 text-rose-100",
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={cn("pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm shadow-xl", tones[item.tone] || tones.info)}>
          <div className="min-w-0 flex-1 break-words">{item.message}</div>
          <button type="button" onClick={() => dismiss(item.id)} className="text-current opacity-60 hover:opacity-100" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function formatRelative(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

export const STATUS_TONES = { success: "green", error: "red", timeout: "amber" };
