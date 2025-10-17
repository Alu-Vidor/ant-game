import { ResourceNode } from "../resources/ResourceNode";

export interface MapEdge {
  from: string;
  to: string;
  distance: number;
}

export class MapGraph {
  public readonly nodes: Map<string, ResourceNode> = new Map();
  public readonly edges: MapEdge[] = [];
  public visibilityRadius: number;

  constructor(visibilityRadius: number) {
    this.visibilityRadius = visibilityRadius;
  }

  public addNode(node: ResourceNode): void {
    this.nodes.set(node.id, node);
  }

  public addEdge(edge: MapEdge): void {
    this.edges.push(edge);
  }

  public getNeighbors(nodeId: string): MapEdge[] {
    return this.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId);
  }

  public reveal(radius: number): void {
    this.visibilityRadius = Math.max(this.visibilityRadius, radius);
  }

  public getVisibleNodes(): ResourceNode[] {
    return Array.from(this.nodes.values()).filter((node) => node.distanceToColony <= this.visibilityRadius);
  }
}
