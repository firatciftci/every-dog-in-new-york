<script lang="ts">
  import Goldfinch from "./goldfinch.svelte";

  let {
    route,
    body,
    edge,
    class: className,
  }: { route: string; body: string; edge: string; class?: string } = $props();
</script>

{#if route === "MNB"}
  <Goldfinch {body} {edge} class={className} />
{:else if route === "NEC"}
  <svg viewBox="0 0 22 21" class={className} aria-hidden="true">
    <path
      d="M11 1.2 12 5H10Z"
      fill={body}
      stroke={edge}
      stroke-width="1.1"
      stroke-linejoin="round"
    />
    <path
      d="M4.6 14.2a6.4 6.4 0 0 1 12.8 0Z"
      fill={body}
      stroke={edge}
      stroke-width="1.3"
      stroke-linejoin="round"
    />
    <rect
      x="9.2"
      y="4.4"
      width="3.6"
      height="3.4"
      rx="0.5"
      fill={body}
      stroke={edge}
      stroke-width="1.1"
    />
    <rect
      x="2.6"
      y="14.2"
      width="16.8"
      height="2.6"
      rx="0.5"
      fill={body}
      stroke={edge}
      stroke-width="1.2"
    />
    <rect
      x="1.2"
      y="16.8"
      width="19.6"
      height="3"
      rx="0.6"
      fill={body}
      stroke={edge}
      stroke-width="1.2"
    />
  </svg>
{:else}
  <svg viewBox="0 0 22 21" class={className} aria-hidden="true">
    <path
      d="M2.6 6.2v8.6c0 1.5 3.8 2.7 8.4 2.7s8.4-1.2 8.4-2.7V6.2Z"
      fill={body}
      stroke={edge}
      stroke-width="1.3"
      stroke-linejoin="round"
    />
    <path
      d="M6.2 7.4 11 13l4.8-5.6M6.2 13.4 11 8l4.8 5.4"
      fill="none"
      stroke={edge}
      stroke-width="1.2"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    <ellipse
      cx="11"
      cy="6.2"
      rx="8.4"
      ry="2.9"
      fill={body}
      stroke={edge}
      stroke-width="1.3"
    />
  </svg>
{/if}
