import { ResourceNode } from "../resources/ResourceNode";
import { ResourceType } from "../resources/ResourceType";

export enum TaskType {
  GatherResource = "gather_resource",
  BuildStructure = "build_structure",
  Scout = "scout",
}

export enum TaskPriority {
  Low = 1,
  Medium = 2,
  High = 3,
}

export interface TaskPayload {
  resourceType?: ResourceType;
  targetNode?: ResourceNode;
  buildingPlan?: string;
}

export class Task {
  public readonly id: string;
  public readonly type: TaskType;
  public priority: TaskPriority;
  public payload?: TaskPayload;
  public assigned: boolean = false;

  constructor(id: string, type: TaskType, priority: TaskPriority, payload?: TaskPayload) {
    this.id = id;
    this.type = type;
    this.priority = priority;
    this.payload = payload;
  }
}
