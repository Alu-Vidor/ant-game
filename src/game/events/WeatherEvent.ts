import { Hazard, HazardEffect, HazardType } from "../hazards/Hazard";

export enum WeatherType {
  Rain = "rain",
  Heat = "heat",
}

export interface WeatherEventOptions {
  id: string;
  type: WeatherType;
  duration: number;
}

export class WeatherEvent extends Hazard {
  public readonly weatherType: WeatherType;

  constructor(options: WeatherEventOptions) {
    super({
      id: options.id,
      type: HazardType.Weather,
      areaRadius: Infinity,
      effect: WeatherEvent.createEffect(options.type, options.duration),
    });
    this.weatherType = options.type;
  }

  private static createEffect(type: WeatherType, duration: number): HazardEffect {
    switch (type) {
      case WeatherType.Rain:
        return { duration, speedModifier: 0.7 };
      case WeatherType.Heat:
        return { duration, speedModifier: 1.1, cargoLossChance: 0.1 };
      default:
        return { duration };
    }
  }
}
