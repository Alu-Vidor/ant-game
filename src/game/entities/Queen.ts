import { Building } from "../buildings/Building";

export interface QueenOptions {
  baseProductionInterval: number; // seconds
  workerMaintenanceCost: number; // nectar per minute
}

export class Queen {
  public baseProductionInterval: number;
  public workerMaintenanceCost: number;
  private productionModifiers: number[] = [];

  constructor(options: QueenOptions) {
    this.baseProductionInterval = options.baseProductionInterval;
    this.workerMaintenanceCost = options.workerMaintenanceCost;
  }

  public registerBuildingModifier(building: Building): void {
    const modifier = building.getQueenProductionModifier();
    if (modifier !== 1) {
      this.productionModifiers.push(modifier);
    }
  }

  public calculateProductionInterval(): number {
    const totalModifier = this.productionModifiers.reduce((acc, modifier) => acc * modifier, 1);
    return this.baseProductionInterval * totalModifier;
  }
}
