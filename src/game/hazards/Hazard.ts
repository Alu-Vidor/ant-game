import { ResourceNode } from "../resources/ResourceNode";

export enum HazardType {
  Predator = "predator",
  Weather = "weather",
  Puddle = "puddle",
}

export interface HazardEffect {
  blockNode?: boolean;
  cargoLossChance?: number;
  speedModifier?: number;
  duration: number;
}

export interface HazardOptions {
  id: string;
  type: HazardType;
  areaRadius: number;
  effect: HazardEffect;
  activeUntil?: number;
}

export class Hazard {
  public readonly id: string;
  public readonly type: HazardType;
  public readonly areaRadius: number;
  public readonly effect: HazardEffect;
  public activeUntil: number;

  constructor(options: HazardOptions) {
    this.id = options.id;
    this.type = options.type;
    this.areaRadius = options.areaRadius;
    this.effect = options.effect;
    this.activeUntil = options.activeUntil ?? Date.now() / 1000 + options.effect.duration;
  }

  public isActive(currentTime: number): boolean {
    return currentTime <= this.activeUntil;
  }

  public affectsNode(node: ResourceNode): boolean {
    return node.distanceToColony <= this.areaRadius;
  }
}
