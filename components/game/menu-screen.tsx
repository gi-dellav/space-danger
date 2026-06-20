"use client"

import { Button } from "@/components/ui/button"

export function MenuScreen({ onStart, hasSave, onContinue }: { onStart: () => void; hasSave?: boolean; onContinue?: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="crt-scanlines w-full max-w-xl rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-accent">Galactic Trader</p>
        <h1 className="mt-3 font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          SPACE <span className="text-primary">DANGER</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">
          A lone trader, a battered ship, and a thousand credits. Buy low, sell high, jump between
          star systems, and survive pirate ambushes and police scans on the lawless frontier.
        </p>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-2 text-left text-xs">
          <Feature title="Trade" desc="Work the markets" />
          <Feature title="Travel" desc="Jump the galaxy" />
          <Feature title="Fight" desc="Survive combat" />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button size="lg" className="w-full sm:w-auto" onClick={onStart}>
            Launch Career
          </Button>
          {hasSave && onContinue && (
            <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={onContinue}>
              Continue Career
            </Button>
          )}
        </div>
        <p className="mt-4 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          Goal: build your fortune and earn the rank of ELITE
        </p>
      </div>
    </div>
  )
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-secondary/40 p-2 text-center">
      <p className="font-heading font-semibold text-primary">{title}</p>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  )
}
