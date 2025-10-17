import { Colony } from "../entities/Colony";
import { ResourceType } from "../resources/ResourceType";

export interface BuildingEffectModifiers {
  queenProductionModifier?: number;
  workerSpeedModifier?: number;
  carryingCapacityModifier?: number;
  storageIncrease?: number;
  maintenanceModifier?: number;
}

export interface BuildingOptions {
  id: string;
  name: string;
  level: number;
  cost: number;
  resourceTypeForCapacity?: ResourceType;
  effect: BuildingEffectModifiers;
}

export class Building {
  public readonly id: string;
  public readonly name: string;
  public level: number;
  public cost: number;
  public readonly effect: BuildingEffectModifiers;
  private readonly resourceTypeForCapacity?: ResourceType;

  constructor(options: BuildingOptions) {
    this.id = options.id;
    this.name = options.name;
    this.level = options.level;
    this.cost = options.cost;
    this.effect = options.effect;
    this.resourceTypeForCapacity = options.resourceTypeForCapacity;
  }

  public getQueenProductionModifier(): number {
    return this.effect.queenProductionModifier ?? 1;
  }

  public getWorkerSpeedModifier(): number {
    return this.effect.workerSpeedModifier ?? 1;
  }

  public getCarryingCapacityModifier(): number {
    return this.effect.carryingCapacityModifier ?? 1;
  }

  public getMaintenanceModifier(): number {
    return this.effect.maintenanceModifier ?? 1;
  }

  public applyToColony(colony: Colony): void {
    if (this.effect.storageIncrease && this.resourceTypeForCapacity) {
      colony.addStorageCapacity(this.resourceTypeForCapacity, this.effect.storageIncrease);
    }
    colony.queen.registerBuildingModifier(this);
  }
}
