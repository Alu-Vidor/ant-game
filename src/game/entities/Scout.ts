import { Ant, AntStats } from "./Ant";

export interface DiscoveryResult {
  discoveredRichNode: boolean;
  radiusRevealed: number;
}

export class Scout extends Ant {
  public detectionRadius: number;
  public richNodeChance: number;

  constructor(id: string, stats: AntStats, detectionRadius: number, richNodeChance: number) {
    super(id, stats);
    this.detectionRadius = detectionRadius;
    this.richNodeChance = richNodeChance;
  }

  public explore(): DiscoveryResult {
    const discoveredRichNode = Math.random() < this.richNodeChance;
    return {
      discoveredRichNode,
      radiusRevealed: this.detectionRadius,
    };
  }
}
