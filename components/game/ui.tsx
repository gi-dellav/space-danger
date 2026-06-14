import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function Panel({
  title,
  right,
  children,
  className,
}: {
  title?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-border bg-card",
        className,
      )}
    >
      {title && (
        <header className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function StatBar({
  value,
  max,
  tone = "primary",
  label,
}: {
  value: number
  max: number
  tone?: "primary" | "accent" | "success" | "destructive"
  label?: string
}) {
  const pct = max > 0 ? clampPct((value / max) * 100) : 0
  const toneClass = {
    primary: "bg-primary",
    accent: "bg-accent",
    success: "bg-success",
    destructive: "bg-destructive",
  }[tone]
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums text-foreground">
            {Math.round(value)} / {max}
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all duration-300", toneClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n))
}

export function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: ReactNode
  tone?: "primary" | "accent" | "success" | "destructive"
}) {
  const valueTone = {
    primary: "text-primary",
    accent: "text-accent",
    success: "text-success",
    destructive: "text-destructive",
  }[tone ?? "primary"]
  return (
    <div className="flex flex-col rounded-md border border-border bg-card px-3 py-2">
      <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("font-heading text-lg font-semibold tabular-nums", valueTone)}>
        {value}
      </span>
    </div>
  )
}
