"use client"

import { useEffect, useRef } from "react"
import type { GameState } from "@/lib/game/types"
import { saveGame } from "@/lib/game/save"
import { SYSTEMS_BY_ID } from "@/lib/game/data"
import { combatRating } from "@/lib/game/engine"

export function useAutoSave(state: GameState) {
  const lastSavedTurn = useRef<number | null>(null)

  useEffect(() => {
    if (state.phase === "menu") return

    const shouldSave =
      state.turn !== lastSavedTurn.current &&
      state.turn > 1 &&
      (state.turn % 3 === 0 || state.phase === "gameover")

    if (shouldSave) {
      const systemName = SYSTEMS_BY_ID[state.currentSystemId]?.name ?? "Deep Space"
      const rating = combatRating(state.destroyedShips)
      saveGame("auto", state, systemName, rating)
      lastSavedTurn.current = state.turn
    }
  }, [state])
}
