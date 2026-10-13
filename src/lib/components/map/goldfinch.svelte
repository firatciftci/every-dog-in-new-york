<script lang="ts">
  let {
    body,
    edge,
    class: className,
  }: { body: string; edge: string; class?: string } = $props();
</script>

<svg viewBox="0 0 22 21" class={className} aria-hidden="true">
  <path
    d="M8.6 13.5 1.4 19.2l3.2-7.6Z"
    fill={body}
    stroke={edge}
    stroke-width="1.3"
    stroke-linejoin="round"
  />
  <path
    d="M13.2 2.6c2.5 0 4.2 1.9 4.2 4.2 0 .8-.2 1.5-.6 2.1 1.3 1.4 2 3.2 2 5.1 0 3-2.4 5.4-5.4 5.4S8 17 8 14c0-2.6 1.2-4.5 3-5.6-.2-.6-.3-1.1-.3-1.6 0-2.3 1.9-4.2 4.2-4.2Z"
    fill={body}
    stroke={edge}
    stroke-width="1.3"
    stroke-linejoin="round"
  />
  <path d="M17.1 5.4 20.4 6.6 17.1 7.9Z" fill={edge} />
  <circle cx="15.1" cy="5.6" r="0.85" fill={edge} />
</svg>
