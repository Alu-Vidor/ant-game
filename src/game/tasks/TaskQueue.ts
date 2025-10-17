import { Worker } from "../entities/Worker";
import { Hazard } from "../hazards/Hazard";
import { ResourceNode } from "../resources/ResourceNode";
import { Task, TaskPriority, TaskType } from "./Task";

export class TaskQueue {
  private readonly tasks: Task[] = [];
  private readonly priorities: Map<TaskType, TaskPriority> = new Map();

  public setPriority(taskType: TaskType, priority: TaskPriority): void {
    this.priorities.set(taskType, priority);
  }

  public enqueue(task: Task): void {
    this.tasks.push(task);
    this.sort();
  }

  public getNextTask(worker: Worker, hazards: Hazard[] = []): Task | undefined {
    for (const task of this.tasks) {
      if (task.assigned) {
        continue;
      }
      if (!worker.canPerformTask(task)) {
        continue;
      }
      if (task.payload?.targetNode && this.isNodeBlocked(task.payload.targetNode, hazards)) {
        continue;
      }
      task.assigned = true;
      return task;
    }
    return undefined;
  }

  public completeTask(taskId: string): void {
    const index = this.tasks.findIndex((task) => task.id === taskId);
    if (index >= 0) {
      this.tasks.splice(index, 1);
    }
  }

  private sort(): void {
    this.tasks.sort((a, b) => {
      const priorityA = this.priorities.get(a.type) ?? a.priority;
      const priorityB = this.priorities.get(b.type) ?? b.priority;
      if (priorityA === priorityB) {
        return 0;
      }
      return priorityB - priorityA;
    });
  }

  private isNodeBlocked(node: ResourceNode, hazards: Hazard[]): boolean {
    return hazards.some((hazard) => hazard.affectsNode(node) && hazard.effect.blockNode);
  }
}
