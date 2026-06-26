import type { GameState } from "./types"

const SAVE_VERSION = 1
const SAVE_PREFIX = "hypernova-zero-save-"

export interface SaveSlot {
  state: GameState
  savedAt: string
  turn: number
  credits: number
  systemName: string
  rating: string
}

function validateState(obj: unknown): obj is GameState {
  if (!obj || typeof obj !== "object") return false
  const s = obj as Record<string, unknown>
  return (
    typeof s.phase === "string" &&
    typeof s.turn === "number" &&
    typeof s.credits === "number" &&
    typeof s.ship === "object" &&
    s.ship !== null &&
    typeof s.cargo === "object" &&
    s.cargo !== null &&
    typeof s.currentSystemId === "string" &&
    typeof s.log === "object" &&
    Array.isArray(s.log) &&
    typeof s.nextLogId === "number" &&
    typeof s.factionRep === "object" &&
    s.factionRep !== null &&
    typeof s.crew === "object" &&
    Array.isArray(s.crew)
  )
}

export function migrateState(state: GameState): GameState {
  let s = { ...state }
  // Ensure crew members have skill (default 1 for old saves)
  s.crew = s.crew.map((c) => ({
    ...c,
    skill: c.skill ?? 1,
  }))
  // Ensure availableCrew exists
  if (!s.availableCrew) {
    s.availableCrew = []
  }
  // Ensure casino exists
  if (s.casino === undefined) {
    s.casino = null
  }
  // Ensure lastBuyPrice exists
  if (!s.lastBuyPrice) {
    s.lastBuyPrice = {}
  }
  return s
}

export function serializeState(state: GameState): string {
  const data = { version: SAVE_VERSION, state }
  return JSON.stringify(data)
}

export function deserializeState(json: string): GameState | null {
  try {
    const data = JSON.parse(json)
    if (!data || typeof data !== "object" || data.version !== SAVE_VERSION) return null
    if (!validateState(data.state)) return null
    return migrateState(data.state as GameState)
  } catch {
    return null
  }
}

export function saveGame(slot: string, state: GameState, systemName: string, rating: string): void {
  const slotData: SaveSlot = {
    state,
    savedAt: new Date().toISOString(),
    turn: state.turn,
    credits: state.credits,
    systemName,
    rating,
  }
  try {
    localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(slotData))
  } catch {
    // localStorage full or disabled — silently fail
  }
}

export function loadGame(slot: string): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slot)
    if (!raw) return null
    const slotData = JSON.parse(raw)
    if (!slotData || !slotData.state) return null
    if (!validateState(slotData.state)) return null
    return migrateState(slotData.state as GameState)
  } catch {
    return null
  }
}

export function getSaveSlot(slot: string): SaveSlot | null {
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slot)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || !data.state || !validateState(data.state)) return null
    const migrated = migrateState(data.state as GameState)
    return { ...data, state: migrated } as SaveSlot
  } catch {
    return null
  }
}

export function deleteSave(slot: string): void {
  try {
    localStorage.removeItem(SAVE_PREFIX + slot)
  } catch {
    // silently fail
  }
}

export function hasAnySave(): boolean {
  return getSaveSlot("auto") !== null || getSaveSlot("A") !== null || getSaveSlot("B") !== null
}

export function listSaves(): { slot: string; info: SaveSlot | null }[] {
  return ["A", "B", "C"].map((slot) => ({
    slot,
    info: getSaveSlot(slot),
  }))
}
