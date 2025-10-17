export interface TrailBuffState {
  routeId: string;
  transfers: number;
  speedBonus: number;
  maxBonus: number;
}

export class TrailBuff {
  public readonly state: TrailBuffState;

  constructor(routeId: string, maxBonus: number) {
    this.state = {
      routeId,
      transfers: 0,
      speedBonus: 1,
      maxBonus,
    };
  }

  public recordTransfer(): void {
    this.state.transfers += 1;
    const bonusStep = (this.state.maxBonus - 1) / 10;
    this.state.speedBonus = Math.min(this.state.maxBonus, 1 + bonusStep * this.state.transfers);
  }

  public getSpeedModifier(): number {
    return this.state.speedBonus;
  }
}
