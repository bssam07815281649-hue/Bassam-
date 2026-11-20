import type { ModelSlotId } from '../../game/types';
import { assetManager } from '../assets/AssetManager';

/**
 * Compatibility facade preserving SettingsModal's runtime GLB upload API
 * while delegating storage, normalization, and cloning to the unified AssetManager.
 */
export const modelOverrideRegistry = {
  loadFromFile: (slot: ModelSlotId, file: File, _targetHeight?: number): Promise<void> => {
    return assetManager.loadFromFile(slot, file);
  },
  clearOverride: (slot: ModelSlotId): void => {
    assetManager.clearSlot(slot);
  },
  listLoadedSlots: (): Partial<Record<ModelSlotId, string>> => {
    return assetManager.listUiOverrides();
  },
};
