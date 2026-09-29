<script lang="ts">
  let {
    name,
    value,
    min,
    max,
    step,
    format,
    set,
  }: {
    name: string;
    value: number;
    min: number;
    max: number;
    step: number;
    format: (v: number) => string;
    set: (v: number) => void;
  } = $props();

  const PX_PER_STEP = 7;

  let held: { x: number; from: number } | null = null;

  function snap(v: number) {
    const stepped = Math.round(v / step) * step;

    return Math.min(max, Math.max(min, Number(stepped.toFixed(4))));
  }

  function nudge(steps: number) {
    const next = snap(value + steps * step);
    if (next !== value) {
      set(next);
    }
  }
</script>

<span
  role="slider"
  tabindex="0"
  aria-label={name}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  aria-valuetext={format(value)}
  class="mx-0.5 inline-flex cursor-ew-resize touch-none items-baseline gap-px numeric font-bold text-foreground transition-colors duration-200 select-none hover:text-primary focus-visible:text-primary"
  onpointerdown={(event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    held = { x: event.clientX, from: value };
  }}
  onpointermove={(event) => {
    if (held == null) {
      return;
    }

    const next = snap(
      held.from + Math.round((event.clientX - held.x) / PX_PER_STEP) * step,
    );
    if (next !== value) {
      set(next);
    }
  }}
  onpointerup={() => {
    held = null;
  }}
  onpointercancel={() => {
    held = null;
  }}
  onkeydown={(event) => {
    const moves: Record<string, () => void> = {
      ArrowRight: () => nudge(1),
      ArrowUp: () => nudge(1),
      ArrowLeft: () => nudge(-1),
      ArrowDown: () => nudge(-1),
      PageUp: () => nudge(5),
      PageDown: () => nudge(-5),
      Home: () => set(min),
      End: () => set(max),
    };
    const move = moves[event.key];
    if (move != null) {
      event.preventDefault();
      move();
    }
  }}
  ><span aria-hidden="true" class="text-[0.85em] text-primary/60">‹</span><span
    class="underline decoration-primary decoration-dotted underline-offset-[3px]"
    >{format(value)}</span
  ><span aria-hidden="true" class="text-[0.85em] text-primary/60">›</span></span
>
