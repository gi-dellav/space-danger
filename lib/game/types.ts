export type EconomyType =
  | "Agricultural"
  | "Extraction"
  | "Refinery"
  | "Industrial"
  | "High-Tech"

export interface Good {
  id: string
  name: string
  basePrice: number
  illegal?: boolean
}

export interface StarSystem {
  id: string
  name: string
  economy: EconomyType
  techLevel: number // 1 - 10
  government: string
  danger: number // 0 (safe) - 4 (anarchy)
  x: number
  y: number
  description: string
}

export interface MarketEntry {
  goodId: string
  price: number
  quantity: number // units available to buy at this station
}

export interface Ship {
  hull: number
  maxHull: number
  shield: number
  maxShield: number
  weaponDamage: number
  cargoCapacity: number
  maxFuel: number
  fuel: number
  missiles: number
}

export interface Enemy {
  name: string
  hull: number
  maxHull: number
  shield: number
  maxShield: number
  damage: number
  bounty: number
}

// The turn cycle: command (MOVE) -> event (EVENT) -> combat (RESOLVE) -> summary (END)
export type Phase = "menu" | "command" | "event" | "combat" | "summary" | "gameover"

export interface GameEvent {
  kind: string
  title: string
  text: string
  options: { id: string; label: string }[]
  // optional payload used when resolving the event
  goodId?: string
  unitPrice?: number
  qty?: number
}

// An in-progress voyage between two systems, traversed one leg per turn.
export interface Voyage {
  destinationId: string
  legsTotal: number
  legsDone: number
}

// Captured at the start of a move so the end-of-turn summary can show deltas.
export interface MoveSnapshot {
  credits: number
  hull: number
  fuel: number
  logId: number
}

// The end-of-turn recap shown during the "summary" phase.
export interface TurnReport {
  turn: number
  headline: string
  entries: LogEntry[]
  creditsDelta: number
  hullDelta: number
  fuelDelta: number
  arrived: boolean
}

export type LogTone = "info" | "good" | "bad" | "combat" | "system"

export interface LogEntry {
  id: number
  text: string
  tone: LogTone
}

export interface GameState {
  phase: Phase
  turn: number
  credits: number
  ship: Ship
  cargo: Record<string, number>
  currentSystemId: string
  market: MarketEntry[]
  voyage: Voyage | null
  event: GameEvent | null
  enemy: Enemy | null
  playerEvading: boolean
  destroyedShips: number
  snapshot: MoveSnapshot | null
  report: TurnReport | null
  log: LogEntry[]
  nextLogId: number
}
