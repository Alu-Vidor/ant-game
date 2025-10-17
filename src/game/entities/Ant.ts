import { Task } from "../tasks/Task";

export enum AntState {
  Idle = "idle",
  Traveling = "traveling",
  Gathering = "gathering",
  Carrying = "carrying",
  Returning = "returning",
}

export interface AntStats {
  speed: number;
  capacity: number;
  energy: number;
}

export abstract class Ant {
  public readonly id: string;
  public state: AntState = AntState.Idle;
  public task: Task | null = null;
  public readonly stats: AntStats;

  constructor(id: string, stats: AntStats) {
    this.id = id;
    this.stats = stats;
  }

  public assignTask(task: Task): void {
    this.task = task;
    this.state = AntState.Traveling;
  }

  public clearTask(): void {
    this.task = null;
    this.state = AntState.Idle;
  }
}
