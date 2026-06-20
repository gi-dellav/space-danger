"use client"

import { createInitialState, gameReducer, isDocked, isInTransit, combatRating } from "@/lib/game/engine"
import { SYSTEMS_BY_ID } from "@/lib/game/data"
import { hasAnySave, loadGame as loadGameFromSlot, saveGame } from "@/lib/game/save"
import type { GameState, CrewRole } from "@/lib/game/types"
import { cn } from "@/lib/utils"
import { useReducer, useState } from "react"
import { CombatView } from "./combat-view"
import { EventView } from "./event-view"
import { GameOverScreen } from "./gameover-screen"
import { LogPanel } from "./log-panel"
import { ManifestView } from "./manifest-view"
import { MarketView } from "./market-view"
import { MenuScreen } from "./menu-screen"
import { MissionsView } from "./missions-view"
import { NavigationView } from "./navigation-view"
import { ShipyardView } from "./shipyard-view"
import { StatusBar } from "./status-bar"
import { TransitView } from "./transit-view"
import FactionsView from "./factions-view"
import CrewView from "./crew-view"
import SaveDialog from "./save-dialog"
import { useAutoSave } from "./use-autosave"
import { Button } from "@/components/ui/button"

type Tab = "market" | "navigation" | "shipyard" | "manifest" | "missions" | "factions" | "crew"

const TABS: { id: Tab; label: string }[] = [
  { id: "market", label: "Market" },
  { id: "navigation", label: "Navigation" },
  { id: "shipyard", label: "Shipyard" },
  { id: "manifest", label: "Manifest" },
  { id: "missions", label: "Missions" },
  { id: "factions", label: "Factions" },
  { id: "crew", label: "Crew" },
]

export function GameShell() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    // On mount, try to load saved game
    if (typeof window !== "undefined") {
      const pendingSlot = sessionStorage.getItem("pending-load")
      if (pendingSlot) {
        sessionStorage.removeItem("pending-load")
        const loaded = loadGameFromSlot(pendingSlot)
        if (loaded) return loaded
      }
      const pendingState = sessionStorage.getItem("pending-load-state")
      if (pendingState) {
        sessionStorage.removeItem("pending-load-state")
        try {
          const parsed = JSON.parse(pendingState) as GameState
          if (parsed && typeof parsed.turn === "number") return parsed
        } catch { /* ignore */ }
      }
    }
    return createInitialState()
  })
  const [tab, setTab] = useState<Tab>("market")
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  useAutoSave(state)

  const saveExists = typeof window !== "undefined" && hasAnySave()

  if (state.phase === "menu") {
    return (
      <MenuScreen
        onStart={() => dispatch({ type: "NEW_GAME" })}
        hasSave={saveExists}
        onContinue={() => {
          const loaded = loadGameFromSlot("auto")
          if (loaded) {
            sessionStorage.setItem("pending-load", "auto")
            window.location.reload()
          }
        }}
      />
    )
  }

  if (state.phase === "gameover") {
    return (
      <GameOverScreen
        state={state}
        onRestart={() => dispatch({ type: "NEW_GAME" })}
        hasSave={saveExists}
        onLoad={() => {
          const loaded = loadGameFromSlot("auto")
          if (loaded) {
            sessionStorage.setItem("pending-load", "auto")
            window.location.reload()
          }
        }}
      />
    )
  }

  const docked = isDocked(state)
  const transit = isInTransit(state)
  const systemName = SYSTEMS_BY_ID[state.currentSystemId]?.name ?? "Deep Space"
  const rating = combatRating(state.destroyedShips)

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <StatusBar state={state} />
        </div>
        <Button size="icon-xs" variant="ghost" onClick={() => setShowSaveDialog(true)} title="Save/Load">
          💾
        </Button>
      </div>

      {showSaveDialog && (
        <SaveDialog
          state={state}
          systemName={systemName}
          rating={rating}
          onLoad={(loaded: GameState) => {
            sessionStorage.setItem("pending-load-state", JSON.stringify(loaded))
            window.location.reload()
          }}
          onClose={() => setShowSaveDialog(false)}
        />
      )}

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
              {tab === "missions" && <MissionsView state={state} dispatch={dispatch} />}
              {tab === "factions" && <FactionsView state={state} />}
              {tab === "crew" && (
                <CrewView
                  state={state}
                  onHire={(role: CrewRole) => dispatch({ type: "HIRE_CREW", role })}
                  onFire={(crewId: number) => dispatch({ type: "FIRE_CREW", crewId })}
                />
              )}
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
