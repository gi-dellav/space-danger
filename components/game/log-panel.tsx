"use client"

import { cn } from "@/lib/utils"
import type { GameState, LogTone } from "@/lib/game/types"
import { useEffect, useRef } from "react"

const TONE_CLASS: Record<LogTone, string> = {
  info: "text-muted-foreground",
  good: "text-success",
  bad: "text-destructive",
  combat: "text-primary",
  system: "text-accent",
}

export function LogPanel({ state }: { state: GameState }) {
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (topRef.current?.parentElement) {
      topRef.current.parentElement.scrollTop = 0
    }
  }, [state.log.length])

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-card">
      <header className="border-b border-border px-4 py-2">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Ship&apos;s Log
        </h2>
      </header>
      <div className="crt-scanlines flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed">
        <div ref={topRef} />
        <ul className="flex flex-col gap-1.5">
          {[...state.log].reverse().map((entry) => (
            <li key={entry.id} className={cn("flex gap-2", TONE_CLASS[entry.tone])}>
              <span aria-hidden className="select-none text-border">&gt;</span>
              <span className="text-pretty">{entry.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
