import type { Map as MapLibreMap } from "maplibre-gl";

export const MAX_ZOOM = 15;

export const EASE = 620;

const isCalm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * bottomFraction stays a fraction: feeding a live pixel height into fitBounds loops with MapLibre resize.
 */
export type Padding = {
  left: number;
  right: number;
  top: number;
  bottomFraction: number;
};

/**
 * Padding wider than the canvas makes fitBounds pick a nonsense camera.
 */
function resolve(instance: MapLibreMap, padding: Padding) {
  const canvas = instance.getCanvas();
  const capX = canvas.clientWidth * 0.4;
  const capY = canvas.clientHeight * 0.4;

  return {
    left: Math.min(padding.left, capX),
    right: Math.min(padding.right, capX),
    top: Math.min(padding.top, capY),
    bottom: Math.min(canvas.clientHeight * padding.bottomFraction + 12, capY),
  };
}

/**
 * The drawable rectangle inside the padding, in canvas pixels.
 */
export function stage(instance: MapLibreMap, padding: Padding) {
  const canvas = instance.getCanvas();
  const pad = resolve(instance, padding);

  return {
    left: pad.left,
    right: canvas.clientWidth - pad.right,
    top: pad.top,
    bottom: canvas.clientHeight - pad.bottom,
  };
}

export type Bounds = [number, number, number, number];

function size(instance: MapLibreMap) {
  const canvas = instance.getCanvas();

  return `${canvas.clientWidth}x${canvas.clientHeight}`;
}

export function roamBounds(bounds: Bounds, slack = 0.9): Bounds {
  return [
    bounds[0] - slack,
    bounds[1] - slack,
    bounds[2] + slack,
    bounds[3] + slack,
  ];
}

/**
fitBounds can re-enter through the resize handler that called it; #busy guards that.
*/
export class Camera {
  #busy = false;
  #framed = "";
  #bounds: Bounds;

  constructor(bounds: Bounds) {
    this.#bounds = bounds;
  }

  #limit(instance: MapLibreMap, padding: Padding) {
    const target = instance.cameraForBounds(this.#bounds, {
      padding: resolve(instance, padding),
    });

    return target?.zoom == null ? null : Math.min(target.zoom, MAX_ZOOM - 0.5);
  }

  retarget(bounds: Bounds) {
    this.#bounds = bounds;
    this.#framed = "";
  }

  /**
  svelte-maplibre re-eases from every moveend, so two camera animations at once never settle.
  */
  floor(instance: MapLibreMap, padding: Padding) {
    const limit = this.#limit(instance, padding);

    if (limit != null && Math.abs(instance.getMinZoom() - limit) > 0.001) {
      instance.setMinZoom(limit);
    }
  }

  /**
  fitBounds fires events that can re-enter here; the signature check stops the loop.
  */
  frame(instance: MapLibreMap, padding: Padding, isAnimated: boolean) {
    const signature = `${size(instance)}|${padding.left},${padding.right},${padding.top},${padding.bottomFraction}`;
    if (this.#busy || signature === this.#framed) {
      return;
    }

    this.#busy = true;
    this.#framed = signature;
    try {
      // setMinZoom above the current zoom jumps the camera at once, so raise it after the fit and lower it before.
      const limit = this.#limit(instance, padding);
      if (limit != null && Math.abs(instance.getMinZoom() - limit) > 0.001) {
        if (limit > instance.getZoom()) {
          // Registered before the fit: an unanimated fitBounds fires moveend synchronously inside the call.
          instance.once("moveend", () => {
            instance.setMinZoom(limit);
          });
        } else {
          instance.setMinZoom(limit);
        }
      }

      instance.fitBounds(this.#bounds, {
        padding: resolve(instance, padding),
        duration: isAnimated && !isCalm() ? EASE : 0,
      });
    } finally {
      this.#busy = false;
    }
  }

  home(instance: MapLibreMap, padding: Padding) {
    this.#framed = "";
    this.frame(instance, padding, true);
  }

  fitTo(
    instance: MapLibreMap,
    bounds: Bounds,
    padding: Padding,
    most = MAX_ZOOM - 2,
  ) {
    instance.fitBounds(bounds, {
      padding: resolve(instance, padding),
      duration: isCalm() ? 0 : EASE,
      maxZoom: most,
    });
  }

  /**
  Offset, not padding: MapLibre keeps easeTo padding on the transform and later fitBounds pads twice.
  */
  focus(
    instance: MapLibreMap,
    center: [number, number],
    padding: Padding,
    least = 0,
  ) {
    const pad = resolve(instance, padding);

    instance.easeTo({
      center,
      zoom: Math.max(instance.getZoom(), least),
      offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2],
      duration: isCalm() ? 0 : 520,
    });
  }

  /**
  MapLibre fires resize on padding changes too; without the size check an ease re-frames the city mid-flight.
  */
  followResize(instance: MapLibreMap, padding: () => Padding) {
    let queued = 0;
    let seen = size(instance);

    const refit = () => {
      const now = size(instance);
      if (now === seen) {
        return;
      }

      seen = now;
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() =>
        this.frame(instance, padding(), false),
      );
    };

    instance.on("resize", refit);

    return () => {
      cancelAnimationFrame(queued);
      instance.off("resize", refit);
    };
  }
}
