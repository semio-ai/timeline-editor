import { AnimatableValue } from "@semio/utils";

export interface Source {
  trackId: string;
  type: AnimatableValue["type"];
  attribute?: string;
}
