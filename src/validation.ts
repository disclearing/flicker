/**
 * Centralized runtime validation and warnings for flicker options.
 */

const PREFIX = '[flicker]';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Validate FlickerOptions. Returns errors and warnings; does not throw.
 */
export function validateFlickerOptions(options: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (options.interval != null) {
    const v = Number(options.interval);
    if (!Number.isFinite(v) || v < 0) errors.push('interval must be a non-negative number');
    else if (v < 10) warnings.push('interval < 10ms may cause performance issues');
  }
  if (options.minInterval != null) {
    const v = Number(options.minInterval);
    if (!Number.isFinite(v) || v < 0) errors.push('minInterval must be a non-negative number');
  }
  if (options.maxInterval != null) {
    const v = Number(options.maxInterval);
    if (!Number.isFinite(v) || v < 0) errors.push('maxInterval must be a non-negative number');
  }
  if (options.minInterval != null && options.maxInterval != null) {
    const min = Number(options.minInterval);
    const max = Number(options.maxInterval);
    if (min > max) errors.push('minInterval must be <= maxInterval');
  }
  if (options.offOpacity != null) {
    const v = Number(options.offOpacity);
    if (!Number.isFinite(v) || v < 0 || v > 1) errors.push('offOpacity must be between 0 and 1');
  }
  if (options.duration != null) {
    const v = Number(options.duration);
    if (!Number.isFinite(v) || v < 0) errors.push('duration must be a non-negative number');
  }
  if (options.mode != null && !['opacity', 'visibility', 'both'].includes(String(options.mode))) {
    errors.push('mode must be one of: opacity, visibility, both');
  }
  if (options.engine != null && !['timeout', 'raf'].includes(String(options.engine))) {
    errors.push('engine must be one of: timeout, raf');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate ImageSequenceOptions. Returns errors and warnings; does not throw.
 */
export function validateImageSequenceOptions(options: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const flickerResult = validateFlickerOptions(options);
  errors.push(...flickerResult.errors);
  warnings.push(...flickerResult.warnings);

  const images = options.images;
  if (images == null) errors.push('images is required');
  else if (!Array.isArray(images)) errors.push('images must be an array');
  else if (images.length === 0) errors.push('images must contain at least one URL');
  else {
    for (let i = 0; i < images.length; i++) {
      if (typeof images[i] !== 'string' || (images[i] as string).trim() === '') {
        errors.push(`images[${i}] must be a non-empty string URL`);
      }
    }
  }

  if (options.interval != null) {
    const v = Number(options.interval);
    if (!Number.isFinite(v) || v < 0) errors.push('interval must be a non-negative number');
  }
  if (options.transitionDuration != null) {
    const v = Number(options.transitionDuration);
    if (!Number.isFinite(v) || v < 0) errors.push('transitionDuration must be a non-negative number');
  }
  if (options.startIndex != null) {
    const v = Number(options.startIndex);
    if (!Number.isInteger(v) || v < 0) errors.push('startIndex must be a non-negative integer');
    if (Array.isArray(images) && v >= images.length) errors.push('startIndex must be < images.length');
  }
  if (options.direction != null && options.direction !== 1 && options.direction !== -1) {
    errors.push('direction must be 1 or -1');
  }
  if (options.preloadAhead != null) {
    const v = Number(options.preloadAhead);
    if (!Number.isInteger(v) || v < 0) errors.push('preloadAhead must be a non-negative integer');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and optionally throw. Logs warnings to console.
 */
export function validateOrThrow(
  options: Record<string, unknown>,
  validator: (opts: Record<string, unknown>) => ValidationResult,
  context?: string
): void {
  const result = validator(options);
  const label = context ? `${PREFIX} ${context}:` : PREFIX;
  for (const w of result.warnings) {
    console.warn(`${label} ${w}`);
  }
  if (!result.valid) {
    throw new Error(`${label} ${result.errors.join('; ')}`);
  }
}

/**
 * Normalize numeric option into a safe range (for internal use after validation).
 */
export function normalizeInterval(value: unknown, defaultVal: number, min = 0, max = 60_000): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultVal;
  return clamp(n, min, max);
}

export function normalizeOpacity(value: unknown, defaultVal: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultVal;
  return clamp(n, 0, 1);
}
