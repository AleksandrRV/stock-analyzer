const ROTATING_CLASS = 'is-rotating';
const ROTATION_SETTLE_MS = 350;

let settleTimerId = 0;

const markRotating = (): void => {
  const root = document.documentElement;
  root.classList.add(ROTATING_CLASS);
  window.clearTimeout(settleTimerId);
  settleTimerId = window.setTimeout(() => root.classList.remove(ROTATING_CLASS), ROTATION_SETTLE_MS);
};

export const initRotationSmoother = (): void => {
  const api = (window.screen as any).orientation;
  if (api && typeof api.addEventListener === 'function') {
    api.addEventListener('change', markRotating);
    return;
  }
  window.addEventListener('orientationchange', markRotating);
};
