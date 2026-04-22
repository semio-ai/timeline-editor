import { LayerBand } from "../../../types";
import { Z } from "../../../constants";

const LAYER_TO_Z: Record<LayerBand, Z> = {
  [LayerBand.Background]: Z.BackgroundData,
  [LayerBand.ForegroundLocked]: Z.ForegroundDataLocked,
  [LayerBand.ForegroundUnselected]: Z.ForegroundDataUnselected,
  [LayerBand.ForegroundSelected]: Z.ForegroundDataSelected,
};

export function getLayerZ(layer: LayerBand): Z {
  return LAYER_TO_Z[layer];
}
