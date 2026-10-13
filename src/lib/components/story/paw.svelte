<script lang="ts">
  let { step = 0, class: className }: { step?: number; class?: string } =
    $props();

  const stride = $derived(Math.floor(step * 60) % 2 === 0);
</script>

<svg
  viewBox="0 0 30 30"
  class={className}
  style:rotate="{stride ? 84 : 96}deg"
  style:translate="0 {stride ? -1.5 : 1.5}px"
  aria-hidden="true"
>
  <g class="fill-current">
    <circle cx="7.4" cy="10.6" r="3.4" />
    <circle cx="13.1" cy="7.6" r="3.7" />
    <circle cx="19.2" cy="8.4" r="3.6" />
    <circle cx="24.1" cy="13.4" r="3.1" />
    <ellipse cx="14.6" cy="20.6" rx="7.1" ry="6.2" />
  </g>
</svg>
