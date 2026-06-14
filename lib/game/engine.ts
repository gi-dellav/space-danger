import {
  ECONOMY_PROFILE,
  GOODS,
  GOODS_BY_ID,
  STARTING_CREDITS,
  STARTING_SHIP,
  STARTING_SYSTEM_ID,
  SYSTEMS_BY_ID,
  UPGRADES,
} from "./data"
import type {
  Enemy,
  GameEvent,
  GameState,
  LogEntry,
  LogTone,
  MarketEntry,
  StarSystem,
} from "./types"

/* ---------------------------------- utils --------------------------------- */

const rand = (min: number, max: number) => Math.random() * (max - min) + min
const randInt = (min: number, max: number) =>
  Math.floor(rand(min, max + 1))
const chance = (p: number) => Math.random() < p
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

export function distanceBetween(a: StarSystem, b: StarSystem): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) / 10
}

export function fuelCost(a: StarSystem, b: StarSystem): number {
  return Math.max(1, Math.ceil(distanceBetween(a, b)))
}

export function cargoUsed(cargo: Record<string, number>): number {
  return Object.values(cargo).reduce((sum, n) => sum + n, 0)
}

export function combatRating(kills: number): string {
  if (kills >= 200) return "ELITE"
  if (kills >= 100) return "Deadly"
  if (kills >= 50) return "Dangerous"
  if (kills >= 24) return "Competent"
  if (kills >= 12) return "Average"
  if (kills >= 4) return "Poor"
  if (kills >= 1) return "Mostly Harmless"
  return "Harmless"
}

/* --------------------------------- market --------------------------------- */

export function generateMarket(system: StarSystem): MarketEntry[] {
  const profile = ECONOMY_PROFILE[system.economy]
  return GOODS.map((good) => {
    let mult = 1
    let qty = randInt(8, 22)

    if (profile.produces.includes(good.id)) {
      mult = rand(0.55, 0.78)
      qty = randInt(22, 48)
    } else if (profile.demands.includes(good.id)) {
      mult = rand(1.35, 1.75)
      qty = randInt(2, 10)
    } else {
      mult = rand(0.9, 1.18)
    }

    // High-tech worlds make tech goods cheaper, primitive worlds make them dear.
    if (["computers", "medicine", "luxuries"].includes(good.id)) {
      mult *= 1.25 - system.techLevel * 0.04
    }

    if (good.illegal) {
      // Contraband only shows up in lawless or low-tech ports.
      const available =
        system.danger >= 3 ? chance(0.8) : system.techLevel <= 4 ? chance(0.45) : chance(0.12)
      qty = available ? randInt(3, 14) : 0
      // High-tech, high-law worlds pay a premium for what little arrives.
      mult = system.danger >= 3 ? rand(0.7, 1.0) : rand(1.4, 2.1)
    }

    const price = Math.max(1, Math.round(good.basePrice * mult * rand(0.92, 1.08)))
    return { goodId: good.id, price, quantity: qty }
  })
}

/* ---------------------------------- log ----------------------------------- */

function log(state: GameState, text: string, tone: LogTone = "info"): GameState {
  const entry: LogEntry = { id: state.nextLogId, text, tone }
  const next = [...state.log, entry]
  // keep the most recent 60 entries
  const trimmed = next.length > 60 ? next.slice(next.length - 60) : next
  return { ...state, log: trimmed, nextLogId: state.nextLogId + 1 }
}

/* ------------------------------- initial state ----------------------------- */

export function createInitialState(): GameState {
  const start = SYSTEMS_BY_ID[STARTING_SYSTEM_ID]
  const base: GameState = {
    phase: "menu",
    credits: STARTING_CREDITS,
    day: 1,
    ship: { ...STARTING_SHIP },
    cargo: {},
    currentSystemId: STARTING_SYSTEM_ID,
    market: generateMarket(start),
    event: null,
    enemy: null,
    playerEvading: false,
    destroyedShips: 0,
    log: [],
    nextLogId: 1,
  }
  return base
}

export function startNewGame(): GameState {
  let s = createInitialState()
  s = { ...s, phase: "docked" }
  s = log(
    s,
    `Commander, you are docked at ${SYSTEMS_BY_ID[s.currentSystemId].name} with ${STARTING_CREDITS} credits. Good hunting.`,
    "system",
  )
  return s
}

/* --------------------------------- enemies -------------------------------- */

const PIRATE_NAMES = [
  "Cobra Mk III 'Vulture'",
  "Sidewinder Raider",
  "Mamba Interceptor",
  "Krait Pirate",
  "Asp Marauder",
  "Gecko Corsair",
]

function createPirate(danger: number): Enemy {
  const tier = danger + randInt(0, 1)
  const maxHull = randInt(28, 46) + tier * 8
  const maxShield = randInt(0, 14) + tier * 6
  return {
    name: PIRATE_NAMES[randInt(0, PIRATE_NAMES.length - 1)],
    hull: maxHull,
    maxHull,
    shield: maxShield,
    maxShield,
    damage: randInt(6, 10) + tier * 2,
    bounty: (maxHull + maxShield) * randInt(3, 6),
  }
}

function createPolice(): Enemy {
  const maxHull = randInt(55, 75)
  const maxShield = randInt(30, 45)
  return {
    name: "System Police Viper",
    hull: maxHull,
    maxHull,
    shield: maxShield,
    maxShield,
    damage: randInt(10, 14),
    bounty: 0,
  }
}

/* ------------------------------ event creation ----------------------------- */

function pickArrivalEvent(state: GameState, system: StarSystem): "combat" | GameEvent | null {
  const r = Math.random()
  const pirateChance = 0.1 + system.danger * 0.12
  const carryingContraband = GOODS.some(
    (g) => g.illegal && (state.cargo[g.id] ?? 0) > 0,
  )

  if (r < pirateChance) return "combat"

  // Police interdiction — more likely if you're dirty.
  const policeChance = carryingContraband ? 0.28 : 0.08
  if (r < pirateChance + policeChance) {
    return {
      kind: "police",
      title: "Police Interdiction",
      text: carryingContraband
        ? `A ${system.name} police Viper signals you to halt for a cargo scan. Your manifest includes contraband...`
        : `A ${system.name} police Viper hails you for a routine cargo scan.`,
      options: [
        { id: "submit", label: "Submit to scan" },
        { id: "run", label: "Run for it" },
      ],
    }
  }

  // Non-combat encounters
  const r2 = Math.random()
  if (r2 < 0.25) {
    return {
      kind: "derelict",
      title: "Derelict Hulk",
      text: "Your scanner pings a powered-down hulk drifting in the dark. It might hold salvage — or a nasty surprise.",
      options: [
        { id: "salvage", label: "Board and salvage" },
        { id: "ignore", label: "Leave it alone" },
      ],
    }
  }
  if (r2 < 0.5) {
    return {
      kind: "distress",
      title: "Distress Beacon",
      text: "A faint distress call crackles over the comm. A stranded pilot begs for assistance nearby.",
      options: [
        { id: "help", label: "Investigate the signal" },
        { id: "ignore", label: "Ignore and proceed" },
      ],
    }
  }
  if (r2 < 0.72) {
    return {
      kind: "asteroid",
      title: "Asteroid Field",
      text: "Your route passes through a dense asteroid field rich with ore — and hull-cracking rocks.",
      options: [
        { id: "mine", label: "Mine the asteroids" },
        { id: "avoid", label: "Plot a safe course" },
      ],
    }
  }
  if (r2 < 0.95) {
    // Free trader offering a deal
    const tradable = GOODS.filter((g) => !g.illegal)
    const good = tradable[randInt(0, tradable.length - 1)]
    const unitPrice = Math.round(good.basePrice * rand(0.5, 0.75))
    const qty = randInt(3, 8)
    return {
      kind: "trader",
      title: "Free Trader Rendezvous",
      text: `A friendly free trader offers ${qty}t of ${good.name} at ${unitPrice} cr each — well below market.`,
      options: [
        { id: "buy", label: `Buy ${qty}t for ${unitPrice * qty} cr` },
        { id: "decline", label: "Decline the offer" },
      ],
      goodId: good.id,
      unitPrice,
      qty,
    }
  }

  return null // clear jump
}

/* -------------------------------- arrival --------------------------------- */

function arriveDocked(state: GameState, note?: string): GameState {
  const system = SYSTEMS_BY_ID[state.currentSystemId]
  let s: GameState = {
    ...state,
    phase: "docked",
    enemy: null,
    event: null,
    playerEvading: false,
    market: generateMarket(system),
  }
  if (note) s = log(s, note, "good")
  s = log(s, `Docked at ${system.name} Station. (${system.economy}, Tech ${system.techLevel})`, "system")
  return s
}

/* ---------------------------------- actions -------------------------------- */

export type Action =
  | { type: "NEW_GAME" }
  | { type: "BUY"; goodId: string; qty: number }
  | { type: "SELL"; goodId: string; qty: number }
  | { type: "JUMP"; systemId: string }
  | { type: "EVENT_CHOICE"; optionId: string }
  | { type: "COMBAT_ACTION"; action: "fire" | "missile" | "evade" | "flee" }
  | { type: "BUY_UPGRADE"; upgradeId: string }
  | { type: "REFUEL" }
  | { type: "REPAIR" }

/* --------------------------------- combat ---------------------------------- */

function damageEnemy(enemy: Enemy, dmg: number): Enemy {
  let remaining = dmg
  let shield = enemy.shield
  if (shield > 0) {
    const absorbed = Math.min(shield, remaining)
    shield -= absorbed
    remaining -= absorbed
  }
  const hull = enemy.hull - remaining
  return { ...enemy, shield, hull }
}

function applyDamageToShip(state: GameState, dmg: number): GameState {
  let remaining = dmg
  let { shield, hull } = state.ship
  if (shield > 0) {
    const absorbed = Math.min(shield, remaining)
    shield -= absorbed
    remaining -= absorbed
  }
  hull -= remaining
  return { ...state, ship: { ...state.ship, shield, hull } }
}

function enemyTurn(state: GameState): GameState {
  if (!state.enemy) return state
  let s = state
  // Regenerate a sliver of player shield each round.
  if (!s.playerEvading) {
    s = {
      ...s,
      ship: {
        ...s.ship,
        shield: clamp(s.ship.shield + 4, 0, s.ship.maxShield),
      },
    }
  }

  if (s.playerEvading && chance(0.55)) {
    s = log(s, `You juke hard — the ${s.enemy.name}'s shots go wide.`, "combat")
    s = { ...s, playerEvading: false }
    return s
  }

  const dmg = Math.round(s.enemy.damage * rand(0.8, 1.2))
  s = applyDamageToShip(s, dmg)
  s = log(s, `The ${s.enemy.name} hits you for ${dmg} damage.`, "bad")
  s = { ...s, playerEvading: false }

  if (s.ship.hull <= 0) {
    s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
    s = log(s, "Your hull is breached! Your ship is lost to the void...", "bad")
  }
  return s
}

function handleEnemyDestroyed(state: GameState): GameState {
  let s = state
  const enemy = s.enemy!
  const bounty = enemy.bounty
  s = {
    ...s,
    enemy: null,
    destroyedShips: s.destroyedShips + 1,
    credits: s.credits + bounty,
  }
  if (bounty > 0) {
    s = log(s, `${enemy.name} destroyed! Bounty collected: ${bounty} cr.`, "good")
  } else {
    s = log(s, `${enemy.name} destroyed.`, "good")
  }

  // Chance to scoop loose cargo from the wreck.
  if (chance(0.5)) {
    const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
    if (free > 0) {
      const good = GOODS[randInt(0, GOODS.length - 1)]
      const amount = Math.min(free, randInt(1, 4))
      s = {
        ...s,
        cargo: { ...s.cargo, [good.id]: (s.cargo[good.id] ?? 0) + amount },
      }
      s = log(s, `Scooped ${amount}t of ${good.name} from the wreckage.`, "good")
    }
  }

  return arriveDocked(s, "Threat eliminated. Continuing to dock.")
}

/* --------------------------------- reducer --------------------------------- */

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "NEW_GAME":
      return startNewGame()

    case "BUY": {
      if (state.phase !== "docked") return state
      const entry = state.market.find((m) => m.goodId === action.goodId)
      if (!entry) return state
      const free = state.ship.cargoCapacity - cargoUsed(state.cargo)
      const maxAffordable = Math.floor(state.credits / entry.price)
      const qty = clamp(action.qty, 0, Math.min(entry.quantity, free, maxAffordable))
      if (qty <= 0) return state
      const cost = qty * entry.price
      let s: GameState = {
        ...state,
        credits: state.credits - cost,
        cargo: { ...state.cargo, [action.goodId]: (state.cargo[action.goodId] ?? 0) + qty },
        market: state.market.map((m) =>
          m.goodId === action.goodId ? { ...m, quantity: m.quantity - qty } : m,
        ),
      }
      s = log(s, `Bought ${qty}t ${GOODS_BY_ID[action.goodId].name} for ${cost} cr.`, "info")
      return s
    }

    case "SELL": {
      if (state.phase !== "docked") return state
      const entry = state.market.find((m) => m.goodId === action.goodId)
      if (!entry) return state
      const held = state.cargo[action.goodId] ?? 0
      const qty = clamp(action.qty, 0, held)
      if (qty <= 0) return state
      const revenue = qty * entry.price
      const newHeld = held - qty
      const cargo = { ...state.cargo }
      if (newHeld <= 0) delete cargo[action.goodId]
      else cargo[action.goodId] = newHeld
      let s: GameState = {
        ...state,
        credits: state.credits + revenue,
        cargo,
        market: state.market.map((m) =>
          m.goodId === action.goodId ? { ...m, quantity: m.quantity + qty } : m,
        ),
      }
      s = log(s, `Sold ${qty}t ${GOODS_BY_ID[action.goodId].name} for ${revenue} cr.`, "good")
      return s
    }

    case "REFUEL": {
      if (state.phase !== "docked") return state
      const missing = state.ship.maxFuel - state.ship.fuel
      if (missing <= 0) return state
      const pricePer = 20
      const affordable = Math.min(missing, Math.floor(state.credits / pricePer))
      if (affordable <= 0) return log(state, "Not enough credits to refuel.", "bad")
      let s: GameState = {
        ...state,
        credits: state.credits - affordable * pricePer,
        ship: { ...state.ship, fuel: state.ship.fuel + affordable },
      }
      s = log(s, `Refueled ${affordable} ly for ${affordable * pricePer} cr.`, "info")
      return s
    }

    case "REPAIR": {
      if (state.phase !== "docked") return state
      const missing = state.ship.maxHull - state.ship.hull
      if (missing <= 0) return state
      const pricePer = 12
      const affordable = Math.min(missing, Math.floor(state.credits / pricePer))
      if (affordable <= 0) return log(state, "Not enough credits to repair the hull.", "bad")
      let s: GameState = {
        ...state,
        credits: state.credits - affordable * pricePer,
        ship: { ...state.ship, hull: state.ship.hull + affordable },
      }
      s = log(s, `Repaired ${affordable} hull for ${affordable * pricePer} cr.`, "good")
      return s
    }

    case "BUY_UPGRADE": {
      if (state.phase !== "docked") return state
      const upgrade = UPGRADES.find((u) => u.id === action.upgradeId)
      if (!upgrade) return state
      const system = SYSTEMS_BY_ID[state.currentSystemId]
      if (system.techLevel < upgrade.minTechLevel)
        return log(state, `${upgrade.name} requires Tech Level ${upgrade.minTechLevel}.`, "bad")
      if (state.credits < upgrade.cost)
        return log(state, `Not enough credits for ${upgrade.name}.`, "bad")

      const ship = { ...state.ship }
      switch (upgrade.id) {
        case "cargo":
          ship.cargoCapacity += 10
          break
        case "shield":
          ship.maxShield += 30
          ship.shield += 30
          break
        case "laser":
          ship.weaponDamage += 8
          break
        case "hull":
          ship.maxHull += 40
          ship.hull += 40
          break
        case "fuel":
          ship.maxFuel += 5
          ship.fuel = ship.maxFuel
          break
        case "missile":
          ship.missiles += 2
          break
      }
      let s: GameState = { ...state, ship, credits: state.credits - upgrade.cost }
      s = log(s, `Installed ${upgrade.name} for ${upgrade.cost} cr.`, "good")
      return s
    }

    case "JUMP": {
      if (state.phase !== "docked") return state
      const from = SYSTEMS_BY_ID[state.currentSystemId]
      const to = SYSTEMS_BY_ID[action.systemId]
      if (!to || to.id === from.id) return state
      const cost = fuelCost(from, to)
      if (cost > state.ship.fuel) return log(state, "Insufficient fuel for that jump.", "bad")

      let s: GameState = {
        ...state,
        ship: { ...state.ship, fuel: state.ship.fuel - cost },
        day: state.day + 1,
        currentSystemId: to.id,
      }
      s = log(s, `Hyperspace jump to ${to.name} (${cost} ly).`, "system")

      const outcome = pickArrivalEvent(s, to)
      if (outcome === "combat") {
        const enemy = createPirate(to.danger)
        s = { ...s, phase: "combat", enemy, playerEvading: false }
        s = log(s, `Mass-lock! A ${enemy.name} drops out of warp and opens fire!`, "combat")
        return s
      }
      if (outcome && typeof outcome === "object") {
        s = { ...s, phase: "event", event: outcome }
        s = log(s, `${outcome.title}.`, "info")
        return s
      }
      // Clear jump
      return arriveDocked(s, "Clear jump — no incidents.")
    }

    case "EVENT_CHOICE": {
      if (state.phase !== "event" || !state.event) return state
      const ev = state.event
      let s = state

      if (ev.kind === "police") {
        if (action.optionId === "submit") {
          // Confiscate contraband, fine for it.
          let fine = 0
          const cargo = { ...s.cargo }
          for (const g of GOODS) {
            if (g.illegal && (cargo[g.id] ?? 0) > 0) {
              fine += cargo[g.id] * 40
              delete cargo[g.id]
            }
          }
          if (fine > 0) {
            const paid = Math.min(fine, s.credits)
            s = { ...s, cargo, credits: s.credits - paid }
            s = log(s, `Contraband confiscated and fined ${paid} cr. Cleared to dock.`, "bad")
          } else {
            s = log(s, "Scan complete. Manifest clean — cleared to dock.", "good")
          }
          return arriveDocked(s)
        }
        // Run -> fight the police
        const enemy = createPolice()
        s = { ...s, phase: "combat", enemy, event: null, playerEvading: false }
        s = log(s, "You gun the throttle! Police Viper gives chase and opens fire!", "combat")
        return s
      }

      if (ev.kind === "derelict") {
        if (action.optionId === "ignore") {
          s = log(s, "You leave the hulk drifting in the dark.", "info")
          return arriveDocked(s)
        }
        if (chance(0.3)) {
          const enemy = createPirate(SYSTEMS_BY_ID[s.currentSystemId].danger + 1)
          s = { ...s, phase: "combat", enemy, event: null, playerEvading: false }
          s = log(s, "It was a trap! Raiders were hiding in the hulk!", "combat")
          return s
        }
        if (chance(0.5)) {
          const credits = randInt(150, 600)
          s = { ...s, credits: s.credits + credits }
          s = log(s, `Salvage successful — recovered ${credits} cr of valuables.`, "good")
        } else {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const good = GOODS.filter((g) => !g.illegal)[randInt(0, 7)]
          const amount = Math.min(free, randInt(2, 6))
          if (amount > 0) {
            s = { ...s, cargo: { ...s.cargo, [good.id]: (s.cargo[good.id] ?? 0) + amount } }
            s = log(s, `Recovered ${amount}t of ${good.name} from the wreck.`, "good")
          } else {
            s = log(s, "The wreck held cargo, but your hold is full.", "info")
          }
        }
        return arriveDocked(s)
      }

      if (ev.kind === "distress") {
        if (action.optionId === "ignore") {
          s = log(s, "You ignore the signal and press on.", "info")
          return arriveDocked(s)
        }
        if (chance(0.35)) {
          const enemy = createPirate(SYSTEMS_BY_ID[s.currentSystemId].danger + 1)
          s = { ...s, phase: "combat", enemy, event: null, playerEvading: false }
          s = log(s, "The 'distress call' was bait — pirates spring an ambush!", "combat")
          return s
        }
        const reward = randInt(200, 700)
        s = { ...s, credits: s.credits + reward }
        s = log(s, `You rescue the stranded pilot. Grateful, they reward you ${reward} cr.`, "good")
        return arriveDocked(s)
      }

      if (ev.kind === "asteroid") {
        if (action.optionId === "avoid") {
          s = log(s, "You plot a careful course around the field.", "info")
          return arriveDocked(s)
        }
        if (chance(0.4)) {
          const dmg = randInt(8, 22)
          s = applyDamageToShip(s, dmg)
          s = log(s, `A rock slams your hull for ${dmg} damage!`, "bad")
          if (s.ship.hull <= 0) {
            s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
            s = log(s, "The asteroid field tears your ship apart...", "bad")
            return s
          }
        } else {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const amount = Math.min(free, randInt(2, 7))
          if (amount > 0) {
            s = { ...s, cargo: { ...s.cargo, minerals: (s.cargo.minerals ?? 0) + amount } }
            s = log(s, `Mined ${amount}t of Minerals from the field.`, "good")
          } else {
            s = log(s, "Rich ore here, but your hold is full.", "info")
          }
        }
        return arriveDocked(s)
      }

      if (ev.kind === "trader") {
        if (action.optionId === "decline") {
          s = log(s, "You wave the trader off and continue.", "info")
          return arriveDocked(s)
        }
        const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
        const qty = Math.min(ev.qty ?? 0, free)
        const cost = qty * (ev.unitPrice ?? 0)
        if (qty <= 0) {
          s = log(s, "Your hold is full — no room for the trader's goods.", "bad")
        } else if (cost > s.credits) {
          s = log(s, "You can't afford the trader's offer.", "bad")
        } else {
          s = {
            ...s,
            credits: s.credits - cost,
            cargo: { ...s.cargo, [ev.goodId!]: (s.cargo[ev.goodId!] ?? 0) + qty },
          }
          s = log(s, `Bought ${qty}t of ${GOODS_BY_ID[ev.goodId!].name} for ${cost} cr.`, "good")
        }
        return arriveDocked(s)
      }

      return arriveDocked(s)
    }

    case "COMBAT_ACTION": {
      if (state.phase !== "combat" || !state.enemy) return state
      let s = state

      if (action.action === "fire") {
        const dmg = Math.round(s.ship.weaponDamage * rand(0.8, 1.2))
        s = { ...s, enemy: damageEnemy(s.enemy, dmg) }
        s = log(s, `You fire lasers for ${dmg} damage.`, "combat")
        if (s.enemy.hull <= 0) return handleEnemyDestroyed(s)
        return enemyTurn(s)
      }

      if (action.action === "missile") {
        if (s.ship.missiles <= 0) return log(s, "No missiles remaining!", "bad")
        const dmg = randInt(45, 70)
        // Missiles punch through shields directly to hull.
        const enemy = { ...s.enemy, shield: Math.max(0, s.enemy.shield - 10), hull: s.enemy.hull - dmg }
        s = { ...s, enemy, ship: { ...s.ship, missiles: s.ship.missiles - 1 } }
        s = log(s, `Missile away! ${dmg} damage to the ${s.enemy.name}.`, "combat")
        if (s.enemy.hull <= 0) return handleEnemyDestroyed(s)
        return enemyTurn(s)
      }

      if (action.action === "evade") {
        s = { ...s, playerEvading: true }
        const regen = Math.min(10, s.ship.maxShield - s.ship.shield)
        if (regen > 0) s = { ...s, ship: { ...s.ship, shield: s.ship.shield + regen } }
        s = log(s, "You throw the ship into evasive maneuvers and divert power to shields.", "combat")
        return enemyTurn(s)
      }

      if (action.action === "flee") {
        if (chance(0.55)) {
          s = log(s, "You break away and escape into hyperspace!", "good")
          return arriveDocked(s, "You limp to the nearest dock.")
        }
        s = log(s, "Escape failed — the enemy stays on your tail!", "bad")
        return enemyTurn(s)
      }

      return s
    }

    default:
      return state
  }
}
