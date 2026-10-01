import {
  ArrowUpRight,
  Shield,
  Sparkles,
  Shrub,
  Split,
  RotateCcw,
  Droplets,
  Infinity as InfinityIcon,
  Feather,
  Rabbit,
  Crosshair,
  Crown,
  Bone,
  Sprout,
  Egg,
  ArrowDownToLine,
  MoveHorizontal,
  Hourglass,
  Package,
  Shell,
  Swords,
  Bug,
  Skull,
  Scissors,
  EyeOff,
  Utensils,
  ScanEye,
  Webhook,
  Bird,
  EggOff,
  Shovel,
  Waves,
  ArrowRightLeft,
  UserRoundPlus,
  Angry,
  Flame,
  Baby,
  Wind,
  Footprints,
  HeartCrack,
  HeartPulse,
  Flower2,
  Wheat,
  Users,
  Repeat2,
  Search,
  Undo2,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Sigil } from "../../domain/game";
import "../creatures/creatureVisuals.css";

const icons: Record<Sigil, LucideIcon> = {
  ember: Flame,
  legacy: Baby,
  rush: Wind,
  follow: Footprints,
  fury: HeartCrack,
  blood: HeartPulse,
  catalyst: Flower2,
  seed: Wheat,
  colony: Users,
  relay: Repeat2,
  kin: Search,
  recall: Undo2,
  search: BookOpen,
  ranged: ArrowUpRight,
  armor: Shield,
  support: Sparkles,
  thorns: Shrub,
  split: Split,
  trisplit: Swords,
  rebirth: RotateCcw,
  triple: Droplets,
  undying: InfinityIcon,
  flying: Feather,
  breed: Rabbit,
  hunt: Crosshair,
  leader: Crown,
  scavenge: Bone,
  growth: Sprout,
  nest: Egg,
  dive: ArrowDownToLine,
  migrate: MoveHorizontal,
  shortlived: Hourglass,
  porter: Package,
  metamorph: Shell,
  swarm: Bug,
  poison: Skull,
  tail: Scissors,
  stealth: EyeOff,
  devour: Utensils,
  ambush: ScanEye,
  web: Webhook,
  birdcatcher: Bird,
  brood: EggOff,
  burrow: Shovel,
  submerge: Waves,
  shove: ArrowRightLeft,
  reinforce: UserRoundPlus,
  intimidate: Angry,
};

export function SigilIcon({ sigil }: { sigil: Sigil }) {
  const Icon = icons[sigil];
  if (sigil === "web")
    return (
      <svg
        className="sigil-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5M12 4l6 2 2 6-2 6-6 2-6-2-2-6 2-6ZM12 8l3 1 1 3-1 3-3 1-3-1-1-3 1-3Z" />
      </svg>
    );
  return <Icon className="sigil-icon" size={20} strokeWidth={1.8} aria-hidden="true" />;
}
