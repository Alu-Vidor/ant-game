import { Colony } from "../entities/Colony";
import { ResourceType } from "../resources/ResourceType";

export interface UpgradeRequirements {
  colonyLevel: number;
  cost: Record<ResourceType, number>;
}

export interface UpgradeEffect {
  workerSpeedMultiplier?: number;
  workerCapacityMultiplier?: number;
  queenProductionMultiplier?: number;
  influenceRadiusBonus?: number;
}

export interface UpgradeOptions {
  id: string;
  name: string;
  level: number;
  growthCoefficient: number;
  baseCost: Record<ResourceType, number>;
  requirements: UpgradeRequirements;
  effect: UpgradeEffect;
}

export class ColonyUpgrade {
  public readonly id: string;
  public readonly name: string;
  public level: number;
  public readonly growthCoefficient: number;
  public readonly baseCost: Record<ResourceType, number>;
  public readonly requirements: UpgradeRequirements;
  public readonly effect: UpgradeEffect;

  constructor(options: UpgradeOptions) {
    this.id = options.id;
    this.name = options.name;
    this.level = options.level;
    this.growthCoefficient = options.growthCoefficient;
    this.baseCost = options.baseCost;
    this.requirements = options.requirements;
    this.effect = options.effect;
  }

  public calculateCost(level: number = this.level): Record<ResourceType, number> {
    const cost: Record<ResourceType, number> = {} as Record<ResourceType, number>;
    Object.entries(this.baseCost).forEach(([type, value]) => {
      cost[type as ResourceType] = Math.round(value * Math.pow(this.growthCoefficient, level));
    });
    return cost;
  }

  public canApply(colony: Colony): boolean {
    if (colony.level < this.requirements.colonyLevel) {
      return false;
    }
    const cost = this.calculateCost();
    return Object.entries(cost).every(([type, amount]) => colony.getResourceAmount(type as ResourceType) >= amount);
  }

  public apply(colony: Colony): void {
    if (!this.canApply(colony)) {
      throw new Error("Upgrade requirements not met");
    }
    Object.entries(this.calculateCost()).forEach(([type, amount]) => {
      const current = colony.getResourceAmount(type as ResourceType);
      colony.resources[type as ResourceType] = current - amount;
    });
    this.level += 1;
    if (this.effect.workerSpeedMultiplier) {
      colony.buildings.forEach((building) => {
        building.effect.workerSpeedModifier = (building.effect.workerSpeedModifier ?? 1) * this.effect.workerSpeedMultiplier!;
      });
    }
    if (this.effect.workerCapacityMultiplier) {
      colony.buildings.forEach((building) => {
        building.effect.carryingCapacityModifier = (building.effect.carryingCapacityModifier ?? 1) * this.effect.workerCapacityMultiplier!;
      });
    }
    if (this.effect.queenProductionMultiplier) {
      colony.queen.baseProductionInterval *= 1 / this.effect.queenProductionMultiplier;
    }
    if (this.effect.influenceRadiusBonus) {
      colony.adjustInfluenceRadius(this.effect.influenceRadiusBonus);
    }
  }
}
