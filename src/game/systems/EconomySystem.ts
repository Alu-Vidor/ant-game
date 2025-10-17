import { Colony } from "../entities/Colony";
import { Worker } from "../entities/Worker";
import { ResourceNode } from "../resources/ResourceNode";
import { ResourceType } from "../resources/ResourceType";

export interface EconomyTickContext {
  colony: Colony;
  workers: Worker[];
  resourceNode: ResourceNode;
  deltaTime: number;
}

export class EconomySystem {
  public calculateProductionInterval(colony: Colony): number {
    return colony.queen.calculateProductionInterval();
  }

  public calculateResourceExtraction(context: EconomyTickContext): number {
    const effectiveModifiers = this.collectModifiers(context.colony, context.resourceNode.type);
    const perWorker = context.workers.map((worker) =>
      worker.calculateGatheringRate(context.resourceNode.baseExtractionRate, effectiveModifiers)
    );
    const totalRate = perWorker.reduce((acc, value) => acc + value, 0);
    return totalRate * context.deltaTime;
  }

  public processResourceDelivery(colony: Colony, type: ResourceType, amount: number): { stored: number; overflow: number } {
    if (colony.canStore(type, amount)) {
      const stored = colony.depositResource(type, amount);
      return { stored, overflow: amount - stored };
    }
    const overflow = colony.loseOverflow(type, amount);
    return { stored: amount - overflow, overflow };
  }

  public calculateUpgradeCost(baseCost: number, growthCoefficient: number, level: number): number {
    return Math.round(baseCost * Math.pow(growthCoefficient, level));
  }

  public applyMaintenance(colony: Colony, workerCount: number, deltaMinutes: number): number {
    const nectarNeededPerMinute = colony.calculateWorkerMaintenance(workerCount);
    const totalCost = nectarNeededPerMinute * deltaMinutes;
    const available = colony.getResourceAmount(ResourceType.Nectar);
    if (available >= totalCost) {
      colony.resources[ResourceType.Nectar] = available - totalCost;
      return 1;
    }
    const shortageRatio = available / totalCost;
    colony.resources[ResourceType.Nectar] = 0;
    return shortageRatio;
  }

  private collectModifiers(colony: Colony, resourceType: ResourceType): number[] {
    const modifiers: number[] = [];
    colony.buildings.forEach((building) => {
      if (building.effect.workerSpeedModifier) {
        modifiers.push(building.effect.workerSpeedModifier);
      }
      if (building.effect.carryingCapacityModifier && resourceType === ResourceType.Leaves) {
        modifiers.push(building.effect.carryingCapacityModifier);
      }
    });
    return modifiers;
  }
}
