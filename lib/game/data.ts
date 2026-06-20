import type { EconomyType, Good, Ship, StarSystem } from "./types"

export const GOODS: Good[] = [
  { id: "food", name: "Food Rations", basePrice: 30 },
  { id: "textiles", name: "Textiles", basePrice: 60 },
  { id: "minerals", name: "Minerals", basePrice: 95 },
  { id: "alloys", name: "Alloys", basePrice: 140 },
  { id: "machinery", name: "Machinery", basePrice: 240 },
  { id: "medicine", name: "Medical Supplies", basePrice: 330 },
  { id: "computers", name: "Computers", basePrice: 520 },
  { id: "luxuries", name: "Luxuries", basePrice: 780 },
  { id: "firearms", name: "Firearms", basePrice: 620, illegal: true },
  { id: "narcotics", name: "Narcotics", basePrice: 1150, illegal: true },
]

export const GOODS_BY_ID: Record<string, Good> = Object.fromEntries(
  GOODS.map((g) => [g.id, g]),
)

// Which goods an economy produces (cheap & plentiful) vs demands (expensive & scarce).
export const ECONOMY_PROFILE: Record<
  EconomyType,
  { produces: string[]; demands: string[] }
> = {
  Agricultural: {
    produces: ["food", "textiles"],
    demands: ["machinery", "computers", "firearms"],
  },
  Extraction: {
    produces: ["minerals", "alloys"],
    demands: ["food", "machinery", "medicine"],
  },
  Refinery: {
    produces: ["alloys", "machinery"],
    demands: ["minerals", "food", "luxuries"],
  },
  Industrial: {
    produces: ["machinery", "computers", "firearms"],
    demands: ["food", "textiles", "minerals"],
  },
  "High-Tech": {
    produces: ["computers", "medicine", "luxuries"],
    demands: ["alloys", "textiles", "food", "narcotics"],
  },
}

export const SYSTEMS: StarSystem[] = [
  {
    id: "lave",
    name: "Lave",
    economy: "Agricultural",
    techLevel: 4,
    government: "Confederacy",
    danger: 0,
    x: 20,
    y: 70,
    description:
      "A peaceful agricultural world famous for its tree-grubs and orbital gardens.",
  },
  {
    id: "leesti",
    name: "Leesti",
    economy: "Industrial",
    techLevel: 7,
    government: "Corporate State",
    danger: 1,
    x: 38,
    y: 58,
    description:
      "A busy corporate hub. Factories never sleep and the docks are always crowded.",
  },
  {
    id: "diso",
    name: "Diso",
    economy: "Refinery",
    techLevel: 5,
    government: "Democracy",
    danger: 1,
    x: 30,
    y: 40,
    description:
      "Refineries belch smoke into orange skies, turning raw ore into finished alloys.",
  },
  {
    id: "zaonce",
    name: "Zaonce",
    economy: "High-Tech",
    techLevel: 10,
    government: "Corporate State",
    danger: 0,
    x: 52,
    y: 30,
    description:
      "A gleaming high-tech jewel. Home of the galaxy's finest laboratories.",
  },
  {
    id: "orerve",
    name: "Orerve",
    economy: "Extraction",
    techLevel: 3,
    government: "Dictatorship",
    danger: 2,
    x: 64,
    y: 52,
    description:
      "A grim mining colony clinging to a cratered moon. Watch your back at the bar.",
  },
  {
    id: "reorte",
    name: "Reorte",
    economy: "Agricultural",
    techLevel: 6,
    government: "Democracy",
    danger: 1,
    x: 46,
    y: 78,
    description:
      "Rolling hydroponic farms feed half the sector from this temperate world.",
  },
  {
    id: "tionisla",
    name: "Tionisla",
    economy: "Industrial",
    techLevel: 8,
    government: "Confederacy",
    danger: 2,
    x: 74,
    y: 34,
    description:
      "An industrial sprawl orbiting a famous starship graveyard.",
  },
  {
    id: "riedquat",
    name: "Riedquat",
    economy: "Extraction",
    techLevel: 2,
    government: "Anarchy",
    danger: 4,
    x: 82,
    y: 64,
    description:
      "Lawless and dangerous. Pirates rule the spacelanes and the law is a rumor.",
  },
  {
    id: "ensoreus",
    name: "Ensoreus",
    economy: "High-Tech",
    techLevel: 9,
    government: "Democracy",
    danger: 1,
    x: 88,
    y: 20,
    description:
      "A frontier high-tech outpost trading exotic computers and rare medicines.",
  },
]

export const SYSTEMS_BY_ID: Record<string, StarSystem> = Object.fromEntries(
  SYSTEMS.map((s) => [s.id, s]),
)

export const STARTING_SYSTEM_ID = "lave"

export const STARTING_SHIP: Ship = {
  hull: 100,
  maxHull: 100,
  shield: 60,
  maxShield: 60,
  weaponDamage: 14,
  cargoCapacity: 20,
  maxFuel: 7,
  fuel: 7,
  missiles: 2,
}

export const STARTING_CREDITS = 1000

export interface Upgrade {
  id: string
  name: string
  description: string
  cost: number
  minTechLevel: number
}

export const UPGRADES: Upgrade[] = [
  {
    id: "cargo",
    name: "Cargo Bay Expansion (+10t)",
    description: "Bolt on extra cargo racks to haul more goods per run.",
    cost: 900,
    minTechLevel: 3,
  },
  {
    id: "shield",
    name: "Shield Booster (+30)",
    description: "Reinforce your deflector grid for tougher firefights.",
    cost: 1400,
    minTechLevel: 6,
  },
  {
    id: "laser",
    name: "Pulse Laser Upgrade (+8 dmg)",
    description: "Higher yield laser banks. Burns through hostiles faster.",
    cost: 1800,
    minTechLevel: 7,
  },
  {
    id: "hull",
    name: "Hull Plating (+40 max)",
    description: "Military-grade plating raises your maximum hull integrity.",
    cost: 1200,
    minTechLevel: 5,
  },
  {
    id: "fuel",
    name: "Fuel Tank Expansion (+5 ly)",
    description: "Extend your jump range with auxiliary fuel tanks.",
    cost: 700,
    minTechLevel: 4,
  },
  {
    id: "missile",
    name: "Missile Pylon (+2 missiles)",
    description: "Restock homing missiles for emergencies.",
    cost: 500,
    minTechLevel: 2,
  },
  {
    id: "scanner",
    name: "Advanced Scanner Array",
    description: "Improves salvage yields from derelicts, asteroids, and wrecks. Stackable.",
    cost: 1000,
    minTechLevel: 4,
  },
]
