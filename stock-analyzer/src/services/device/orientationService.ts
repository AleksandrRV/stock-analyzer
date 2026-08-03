import { ScreenOrientation } from '../../types/domain';

export type OrientationFailure = 'unsupported' | 'not-installed' | 'rejected';

const ROTATING_CLASS = 'is-rotating';
const ROTATION_SETTLE_MS = 350;
const REASSERT_DELAY_MS = 150;

const PORTRAIT_TARGETS = ['portrait-primary', 'portrait'];
const LANDSCAPE_TARGETS = ['landscape-primary', 'landscape'];

let desiredMode: ScreenOrientation = 'auto';
let isInitialized = false;
let rotatingTimerId = 0;
let reassertTimerId = 0;

const getOrientationApi = (): any => {
  if (typeof window === 'undefined' || !window.screen) return null;
  return (window.screen as any).orientation || null;
};

const getTargets = (mode: ScreenOrientation): string[] => {
  return mode === 'portrait' ? PORTRAIT_TARGETS : LANDSCAPE_TARGETS;
};

export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
};

export const isInstalledApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (navigator as any).standalone === true
  );
};

export const isOrientationLockAvailable = (): boolean => {
  const api = getOrientationApi();
  return !!api && typeof api.lock === 'function';
};

export const getCurrentOrientationType = (): string => {
  const api = getOrientationApi();
  if (api && api.type) return String(api.type);
  if (typeof window === 'undefined') return 'unknown';
  return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
};

const isSatisfied = (mode: ScreenOrientation): boolean => {
  if (mode === 'auto') return true;
  const api = getOrientationApi();
  if (!api || !api.type) return true;
  return mode === 'portrait' ? api.type === 'portrait-primary' : api.type === 'landscape-primary';
};

const classifyError = (error: unknown): OrientationFailure => {
  const name = error && typeof error === 'object' ? String((error as any).name) : '';
  return name === 'NotSupportedError' || name === 'SecurityError' ? 'not-installed' : 'rejected';
};

const markRotating = (): void => {
  const root = document.documentElement;
  root.classList.add(ROTATING_CLASS);
  window.clearTimeout(rotatingTimerId);
  rotatingTimerId = window.setTimeout(() => root.classList.remove(ROTATING_CLASS), ROTATION_SETTLE_MS);
};

const lockSequentially = (
  targets: string[],
  index: number,
  onFailure?: (reason: OrientationFailure) => void
): void => {
  const api = getOrientationApi();
  if (!api || index >= targets.length) return;

  const request = api.lock(targets[index]);
  if (!request || typeof request.catch !== 'function') return;

  request.catch((error: unknown) => {
    if (index + 1 < targets.length) {
      lockSequentially(targets, index + 1, onFailure);
      return;
    }
    if (onFailure) onFailure(classifyError(error));
  });
};

export const applyOrientationMode = (
  mode: ScreenOrientation,
  onFailure?: (reason: OrientationFailure) => void
): void => {
  desiredMode = mode;
  window.clearTimeout(reassertTimerId);

  const api = getOrientationApi();
  if (!api) {
    if (onFailure) onFailure('unsupported');
    return;
  }

  if (mode === 'auto') {
    if (typeof api.unlock !== 'function') {
      if (onFailure) onFailure('unsupported');
      return;
    }
    try {
      api.unlock();
    } catch (error) {
      if (onFailure) onFailure(classifyError(error));
    }
    return;
  }

  if (typeof api.lock !== 'function') {
    if (onFailure) onFailure('unsupported');
    return;
  }

  if (!isSatisfied(mode)) markRotating();
  lockSequentially(getTargets(mode), 0, onFailure);
};

const scheduleReassert = (): void => {
  window.clearTimeout(reassertTimerId);
  reassertTimerId = window.setTimeout(() => {
    if (desiredMode === 'auto' || isSatisfied(desiredMode)) return;
    lockSequentially(getTargets(desiredMode), 0);
  }, REASSERT_DELAY_MS);
};

const handleOrientationChange = (): void => {
  markRotating();
  scheduleReassert();
};

const handleVisibilityChange = (): void => {
  if (document.visibilityState !== 'visible') return;
  if (desiredMode === 'auto' || isSatisfied(desiredMode)) return;
  lockSequentially(getTargets(desiredMode), 0);
};

export const subscribeOrientationType = (listener: (type: string) => void): (() => void) => {
  const notify = () => listener(getCurrentOrientationType());
  const api = getOrientationApi();

  if (api && typeof api.addEventListener === 'function') {
    api.addEventListener('change', notify);
    return () => api.removeEventListener('change', notify);
  }

  window.addEventListener('orientationchange', notify);
  return () => window.removeEventListener('orientationchange', notify);
};

export const initOrientationControl = (mode: ScreenOrientation): void => {
  if (isInitialized) return;
  isInitialized = true;

  const api = getOrientationApi();
  if (api && typeof api.addEventListener === 'function') {
    api.addEventListener('change', handleOrientationChange);
  } else {
    window.addEventListener('orientationchange', handleOrientationChange);
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  applyOrientationMode(mode);
};