export enum ResourceType {
  Nectar = "nectar",
  Leaves = "leaves",
  Sand = "sand",
  Food = "food",
}

export type ResourcePool = Record<ResourceType, number>;

export function createEmptyResourcePool(): ResourcePool {
  return {
    [ResourceType.Nectar]: 0,
    [ResourceType.Leaves]: 0,
    [ResourceType.Sand]: 0,
    [ResourceType.Food]: 0,
  };
}
