"use client"

import { createInitialState, gameReducer, isDocked, isInTransit } from "@/lib/game/engine"
import { cn } from "@/lib/utils"
import { useReducer, useState } from "react"
import { CombatView } from "./combat-view"
import { EventView } from "./event-view"
import { GameOverScreen } from "./gameover-screen"
import { LogPanel } from "./log-panel"
import { ManifestView } from "./manifest-view"
import { MarketView } from "./market-view"
import { MenuScreen } from "./menu-screen"
import { NavigationView } from "./navigation-view"
import { ShipyardView } from "./shipyard-view"
import { StatusBar } from "./status-bar"
import { TransitView } from "./transit-view"

type Tab = "market" | "navigation" | "shipyard" | "manifest"

const TABS: { id: Tab; label: string }[] = [
  { id: "market", label: "Market" },
  { id: "navigation", label: "Navigation" },
  { id: "shipyard", label: "Shipyard" },
  { id: "manifest", label: "Manifest" },
]

export function GameShell() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const [tab, setTab] = useState<Tab>("market")

  if (state.phase === "menu") {
    return <MenuScreen onStart={() => dispatch({ type: "NEW_GAME" })} />
  }

  if (state.phase === "gameover") {
    return <GameOverScreen state={state} onRestart={() => dispatch({ type: "NEW_GAME" })} />
  }

  const docked = isDocked(state)
  const transit = isInTransit(state)

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <StatusBar state={state} />

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          {state.phase === "combat" && <CombatView state={state} dispatch={dispatch} />}
          {state.phase === "event" && <EventView state={state} dispatch={dispatch} />}
          {transit && <TransitView state={state} dispatch={dispatch} />}

          {docked && (
            <>
              <nav className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex-1 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                      tab === t.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>

              {tab === "market" && <MarketView state={state} dispatch={dispatch} />}
              {tab === "navigation" && <NavigationView state={state} dispatch={dispatch} />}
              {tab === "shipyard" && <ShipyardView state={state} dispatch={dispatch} />}
              {tab === "manifest" && <ManifestView state={state} />}
            </>
          )}
        </div>

        <div className="h-[28rem] lg:h-auto">
          <LogPanel state={state} />
        </div>
      </div>
    </main>
  )
}
