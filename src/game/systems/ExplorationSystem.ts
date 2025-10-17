import { Scout } from "../entities/Scout";
import { MapGraph } from "../map/MapGraph";
import { ResourceNode } from "../resources/ResourceNode";

export class ExplorationSystem {
  constructor(private readonly map: MapGraph) {}

  public handleScoutExploration(scout: Scout, nodes: ResourceNode[]): { revealedNodes: ResourceNode[]; discoveredRichNode: boolean } {
    const result = scout.explore();
    this.map.reveal(this.map.visibilityRadius + result.radiusRevealed);
    const visibleNodes = this.map.getVisibleNodes();
    const discoveredRichNode = result.discoveredRichNode && nodes.some((node) => node.richness > 100);
    return {
      revealedNodes: visibleNodes,
      discoveredRichNode,
    };
  }
}
