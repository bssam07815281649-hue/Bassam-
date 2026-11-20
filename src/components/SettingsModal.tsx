import React, { useState } from 'react';
import { Box, Compass, RotateCcw, Trash2, Upload, Volume2, X } from 'lucide-react';
import { MODEL_SLOT_LABELS } from '../game/data';
import type { ModelSlotId } from '../game/types';
import { modelOverrideRegistry } from '../three/models/glbSupport';

interface SettingsModalProps {
  volume: number;
  muted: boolean;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
  onResetCamera: () => void;
  onRestartGame: () => void;
  onModelsChanged: () => void;
  onClose: () => void;
}

const SLOTS = Object.keys(MODEL_SLOT_LABELS) as ModelSlotId[];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  volume,
  muted,
  onChangeVolume,
  onToggleMute,
  onResetCamera,
  onRestartGame,
  onModelsChanged,
  onClose,
}) => {
  const [loadedSlots, setLoadedSlots] = useState<Partial<Record<ModelSlotId, string>>>(() =>
    modelOverrideRegistry.listLoadedSlots(),
  );
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileUpload = async (slot: ModelSlotId, file: File | undefined) => {
    if (!file) return;
    try {
      setUploadStatus(`Loading ${file.name}...`);
      const targetHeight = slot === 'house' ? 3.8 : slot.startsWith('tower_') ? 2.4 : 1.45;
      await modelOverrideRegistry.loadFromFile(slot, file, targetHeight);
      setLoadedSlots(modelOverrideRegistry.listLoadedSlots());
      onModelsChanged();
      setUploadStatus(`Loaded custom GLB for ${MODEL_SLOT_LABELS[slot]}.`);
    } catch {
      setUploadStatus(`Could not parse ${file.name}. Ensure it is a valid .glb or .gltf file.`);
    }
  };

  const handleClearSlot = (slot: ModelSlotId) => {
    modelOverrideRegistry.clearOverride(slot);
    setLoadedSlots(modelOverrideRegistry.listLoadedSlots());
    onModelsChanged();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-[#181c15] border border-amber-500/50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-700/70 px-5 py-3.5">
          <h2 className="font-display text-lg font-bold text-amber-200">Settings & 3D Assets</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scroll flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Audio & Controls */}
          <section className="rounded-xl bg-[#21271d] border border-stone-700/70 p-4 space-y-3">
            <h3 className="font-display text-sm font-bold text-stone-100">Audio & Battlefield</h3>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-stone-300">
                <Volume2 className="h-4 w-4 text-amber-400" />
                <span>Master Volume</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : Math.round(volume * 100)}
                  onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                  className="w-32 accent-amber-400 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="rounded-lg bg-stone-800 hover:bg-stone-700 px-3 py-1.5 text-xs font-semibold text-stone-200 cursor-pointer"
                >
                  {muted ? 'Unmute' : 'Mute'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-stone-700/60">
              <button
                type="button"
                onClick={() => {
                  onResetCamera();
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 px-3.5 py-2 text-xs font-semibold text-stone-100 cursor-pointer"
              >
                <Compass className="h-4 w-4 text-amber-400" />
                <span>Reset Isometric Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onRestartGame();
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 border border-rose-500/40 px-3.5 py-2 text-xs font-semibold text-rose-100 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Restart Battle</span>
              </button>
            </div>
          </section>

          {/* Optional Custom GLB/GLTF Support */}
          <section className="rounded-xl bg-[#21271d] border border-stone-700/70 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Box className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-sm font-bold text-stone-100">
                  Custom GLB / GLTF Model Overrides (Optional)
                </h3>
                <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                  All towers, enemies, and the fortified house use detailed procedural 3D meshes by default.
                  You can optionally import dedicated <code className="text-amber-300">.glb</code> /{' '}
                  <code className="text-amber-300">.gltf</code> models for any slot below.
                </p>
              </div>
            </div>

            {uploadStatus && (
              <div className="rounded-lg bg-[#161a14] border border-sky-500/40 px-3 py-2 text-xs text-sky-200">
                {uploadStatus}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SLOTS.map((slot) => {
                const fileName = loadedSlots[slot];
                return (
                  <div
                    key={slot}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[#171b14] border border-stone-700/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-200 truncate">
                        {MODEL_SLOT_LABELS[slot]}
                      </div>
                      <div className="text-[11px] text-stone-400 truncate">
                        {fileName ? fileName : 'Procedural 3D Mesh'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <label className="flex items-center gap-1 rounded-md bg-stone-800 hover:bg-stone-700 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 cursor-pointer">
                        <Upload className="h-3 w-3" />
                        <span>GLB</span>
                        <input
                          type="file"
                          accept=".glb,.gltf"
                          className="hidden"
                          onChange={(e) => handleFileUpload(slot, e.target.files?.[0])}
                        />
                      </label>
                      {fileName && (
                        <button
                          type="button"
                          onClick={() => handleClearSlot(slot)}
                          aria-label={`Remove custom model for ${MODEL_SLOT_LABELS[slot]}`}
                          className="rounded-md bg-rose-950 hover:bg-rose-900 p-1.5 text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
