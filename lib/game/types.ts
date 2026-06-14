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

export type Phase = "menu" | "docked" | "event" | "combat" | "gameover"

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

export type LogTone = "info" | "good" | "bad" | "combat" | "system"

export interface LogEntry {
  id: number
  text: string
  tone: LogTone
}

export interface GameState {
  phase: Phase
  credits: number
  day: number
  ship: Ship
  cargo: Record<string, number>
  currentSystemId: string
  market: MarketEntry[]
  event: GameEvent | null
  enemy: Enemy | null
  playerEvading: boolean
  destroyedShips: number
  log: LogEntry[]
  nextLogId: number
}
