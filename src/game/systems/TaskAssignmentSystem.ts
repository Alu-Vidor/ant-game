import { Worker } from "../entities/Worker";
import { Hazard } from "../hazards/Hazard";
import { ResourceNode } from "../resources/ResourceNode";
import { TaskType } from "../tasks/Task";
import { TaskQueue } from "../tasks/TaskQueue";

export class TaskAssignmentSystem {
  constructor(private readonly queue: TaskQueue) {}

  public assignTasks(workers: Worker[], nodes: ResourceNode[], hazards: Hazard[]): void {
    const availableNodes = nodes.filter((node) => !hazards.some((hazard) => hazard.affectsNode(node)));
    workers.forEach((worker) => {
      if (worker.task) {
        return;
      }
      const task = this.queue.getNextTask(worker, hazards);
      if (!task) {
        return;
      }
      if (task.type === TaskType.GatherResource && !task.payload?.targetNode) {
        const node = this.findClosestNode(availableNodes);
        if (node) {
          task.payload = { ...task.payload, targetNode: node };
        }
      }
      worker.assignTask(task);
    });
  }

  private findClosestNode(nodes: ResourceNode[]): ResourceNode | undefined {
    return nodes.sort((a, b) => a.distanceToColony - b.distanceToColony)[0];
  }
}
