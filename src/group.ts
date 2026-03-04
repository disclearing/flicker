/**
 * Group orchestration: multiple controllers with shared clock and phase offsets.
 */

import type { FlickerController } from './types.js';
import type { ImageSequenceController } from './types.js';
import { schedule } from './engine.js';

export type GroupController = FlickerController | ImageSequenceController;

export interface GroupMember {
  controller: GroupController;
  /** Phase offset in ms. Start this controller after this delay from group start. */
  phaseOffsetMs?: number;
}

export interface GroupOptions {
  /** Callback when all members have been started (after phase offsets). */
  onStart?: () => void;
  /** Callback when group is stopped. */
  onStop?: () => void;
}

/**
 * Group controller: starts multiple flicker/sequence controllers with a shared start time
 * and optional phase offsets.
 */
export interface OrchestratedGroup {
  start(): void;
  stop(): void;
  destroy(): void;
  readonly isRunning: boolean;
  readonly members: GroupMember[];
}

/**
 * Create a group that orchestrates multiple controllers with optional phase offsets.
 */
export function createGroup(members: GroupMember[], options: GroupOptions = {}): OrchestratedGroup {
  let running = false;
  const cancelFns: (() => void)[] = [];

  const startAll = () => {
    members.forEach((m) => {
      if (m.phaseOffsetMs != null && m.phaseOffsetMs > 0) {
        const cancel = schedule(() => {
          m.controller.start();
        }, m.phaseOffsetMs);
        cancelFns.push(cancel);
      } else {
        m.controller.start();
      }
    });
    options.onStart?.();
  };

  const controller: OrchestratedGroup = {
    get isRunning() {
      return running;
    },
    get members() {
      return members;
    },
    start() {
      if (running) return;
      running = true;
      cancelFns.length = 0;
      startAll();
    },
    stop() {
      if (!running) return;
      running = false;
      cancelFns.forEach((c) => c());
      cancelFns.length = 0;
      members.forEach((m) => m.controller.stop());
      options.onStop?.();
    },
    destroy() {
      controller.stop();
      members.forEach((m) => m.controller.destroy?.());
    },
  };

  return controller;
}

/**
 * Scene preset: named group configurations (e.g. "intro", "glitch-burst").
 * Use createGroup with the returned members.
 */
export interface ScenePreset {
  members: GroupMember[];
  options?: GroupOptions;
}

const scenePresets = new Map<string, ScenePreset>();

export function registerScenePreset(name: string, preset: ScenePreset): void {
  scenePresets.set(name, preset);
}

export function getScenePreset(name: string): ScenePreset | undefined {
  return scenePresets.get(name);
}

export function createGroupFromPreset(name: string, memberOverrides?: Partial<GroupMember>[]): OrchestratedGroup | null {
  const preset = getScenePreset(name);
  if (!preset) return null;
  const members = memberOverrides
    ? preset.members.map((m, i) => ({ ...m, ...memberOverrides[i] }))
    : preset.members;
  return createGroup(members, preset.options);
}
