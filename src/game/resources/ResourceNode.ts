import { Worker } from "../entities/Worker";
import { ResourceType } from "./ResourceType";

export interface ResourceNodeOptions {
  id: string;
  type: ResourceType;
  richness: number;
  baseExtractionRate: number;
  depletionRisk: number; // 0..1 chance per extraction cycle
  regenerationDelay: number; // seconds
  regenerationChance: [number, number]; // min/max chance range
  distanceToColony: number;
}

export class ResourceNode {
  public readonly id: string;
  public readonly type: ResourceType;
  public richness: number;
  public readonly baseExtractionRate: number;
  public readonly depletionRisk: number;
  public readonly regenerationDelay: number;
  public readonly regenerationChance: [number, number];
  public readonly distanceToColony: number;
  public depletedUntil: number | null = null;

  constructor(options: ResourceNodeOptions) {
    this.id = options.id;
    this.type = options.type;
    this.richness = options.richness;
    this.baseExtractionRate = options.baseExtractionRate;
    this.depletionRisk = options.depletionRisk;
    this.regenerationDelay = options.regenerationDelay;
    this.regenerationChance = options.regenerationChance;
    this.distanceToColony = options.distanceToColony;
  }

  public isDepleted(currentTime: number): boolean {
    if (this.richness <= 0) {
      return true;
    }
    if (this.depletedUntil === null) {
      return false;
    }
    if (currentTime >= this.depletedUntil) {
      if (this.tryRegenerate()) {
        this.depletedUntil = null;
        return false;
      }
      this.depletedUntil = currentTime + this.regenerationDelay;
    }
    return true;
  }

  public extract(worker: Worker, deltaTime: number, modifiers: number[] = []): number {
    if (this.richness <= 0) {
      return 0;
    }
    const efficiency = worker.calculateGatheringRate(this.baseExtractionRate, modifiers);
    const gathered = Math.min(this.richness, efficiency * deltaTime);
    this.richness -= gathered;
    if (Math.random() < this.depletionRisk) {
      this.depletedUntil = Date.now() / 1000 + this.regenerationDelay;
    }
    return gathered;
  }

  private tryRegenerate(): boolean {
    const [minChance, maxChance] = this.regenerationChance;
    const chance = minChance + Math.random() * (maxChance - minChance);
    if (Math.random() < chance) {
      this.richness = Math.max(this.richness, 1);
      return true;
    }
    return false;
  }
}
