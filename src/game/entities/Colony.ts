import { Building } from "../buildings/Building";
import { ColonyUpgrade } from "../upgrades/ColonyUpgrade";
import { ResourceNode } from "../resources/ResourceNode";
import { ResourcePool, ResourceType, createEmptyResourcePool } from "../resources/ResourceType";
import { Queen } from "./Queen";

export interface StorageLimit {
  type: ResourceType;
  capacity: number;
}

export class Colony {
  public readonly queen: Queen;
  public level: number;
  public readonly resources: ResourcePool;
  public readonly storageLimits: Map<ResourceType, number>;
  public readonly buildings: Building[];
  public readonly upgrades: ColonyUpgrade[];
  public influenceRadius: number;

  constructor(options: {
    queen: Queen;
    level?: number;
    storageLimits?: StorageLimit[];
    influenceRadius?: number;
  }) {
    this.queen = options.queen;
    this.level = options.level ?? 1;
    this.resources = createEmptyResourcePool();
    this.storageLimits = new Map<ResourceType, number>();
    options.storageLimits?.forEach((limit) => {
      this.storageLimits.set(limit.type, limit.capacity);
    });
    this.buildings = [];
    this.upgrades = [];
    this.influenceRadius = options.influenceRadius ?? 10;
  }

  public getResourceAmount(type: ResourceType): number {
    return this.resources[type] ?? 0;
  }

  public getStorageLimit(type: ResourceType): number {
    return this.storageLimits.get(type) ?? 0;
  }

  public addStorageCapacity(type: ResourceType, amount: number): void {
    const current = this.getStorageLimit(type);
    this.storageLimits.set(type, current + amount);
  }

  public canStore(type: ResourceType, amount: number): boolean {
    const limit = this.getStorageLimit(type);
    return limit <= 0 || this.getResourceAmount(type) + amount <= limit;
  }

  public depositResource(type: ResourceType, amount: number): number {
    const limit = this.getStorageLimit(type);
    if (limit <= 0) {
      this.resources[type] = this.getResourceAmount(type) + amount;
      return amount;
    }
    const availableSpace = Math.max(0, limit - this.getResourceAmount(type));
    const stored = Math.min(availableSpace, amount);
    this.resources[type] = this.getResourceAmount(type) + stored;
    return stored;
  }

  public loseOverflow(type: ResourceType, amount: number): number {
    const limit = this.getStorageLimit(type);
    const total = this.getResourceAmount(type) + amount;
    if (limit > 0 && total > limit) {
      this.resources[type] = limit;
      return total - limit;
    }
    this.resources[type] = total;
    return 0;
  }

  public registerBuilding(building: Building): void {
    this.buildings.push(building);
    building.applyToColony(this);
  }

  public applyUpgrade(upgrade: ColonyUpgrade): void {
    this.upgrades.push(upgrade);
    upgrade.apply(this);
  }

  public calculateWorkerMaintenance(workerCount: number): number {
    const nectarPerMinute = workerCount * this.queen.workerMaintenanceCost;
    const modifier = this.buildings.reduce((acc, building) => acc * building.getMaintenanceModifier(), 1);
    return nectarPerMinute * modifier;
  }

  public adjustInfluenceRadius(delta: number): void {
    this.influenceRadius = Math.max(1, this.influenceRadius + delta);
  }

  public getAccessibleNodes(nodes: ResourceNode[]): ResourceNode[] {
    return nodes.filter((node) => node.distanceToColony <= this.influenceRadius);
  }
}
