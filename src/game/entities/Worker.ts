import { ResourceType } from "../resources/ResourceType";
import { Task, TaskType } from "../tasks/Task";
import { Ant, AntState, AntStats } from "./Ant";

export interface WorkerEfficiencyModifiers {
  gathering: number;
  carrying: number;
  energyConsumption: number;
}

export class Worker extends Ant {
  public readonly efficiency: WorkerEfficiencyModifiers;
  public fatigue: number = 0;

  constructor(id: string, stats: AntStats, efficiency?: Partial<WorkerEfficiencyModifiers>) {
    super(id, stats);
    this.efficiency = {
      gathering: efficiency?.gathering ?? 1,
      carrying: efficiency?.carrying ?? 1,
      energyConsumption: efficiency?.energyConsumption ?? 1,
    };
  }

  public calculateGatheringRate(baseRate: number, modifiers: number[] = []): number {
    const totalModifier = modifiers.reduce((acc, value) => acc * value, 1) * this.efficiency.gathering;
    return baseRate * totalModifier;
  }

  public calculateCarryCapacity(): number {
    return this.stats.capacity * this.efficiency.carrying;
  }

  public consumeEnergy(durationSeconds: number): number {
    const energyUsed = durationSeconds * this.efficiency.energyConsumption;
    this.fatigue += energyUsed;
    return energyUsed;
  }

  public needsRest(maxFatigue: number): boolean {
    return this.fatigue >= maxFatigue;
  }

  public canPerformTask(task: Task): boolean {
    if (task.type === TaskType.BuildStructure && !task.payload?.buildingPlan) {
      return false;
    }
    if (task.type === TaskType.GatherResource) {
      const resourceType: ResourceType | undefined = task.payload?.resourceType;
      return resourceType !== undefined;
    }
    return true;
  }

  public rest(): void {
    this.fatigue = 0;
    this.state = AntState.Idle;
  }
}
