<script lang="ts">
  import { cn } from "#lib/utils.js";

  const ENDPOINT =
    "https://buttondown.com/api/emails/embed-subscribe/firatciftci";

  let { from, eager = false }: { from: string; eager?: boolean } = $props();

  const id = $props.id();
  let phase = $state<"idle" | "sending" | "done" | "failed">("idle");
</script>

<form
  action={ENDPOINT}
  method="post"
  target="_blank"
  onsubmit={async (event) => {
    event.preventDefault();
    if (phase === "sending") {
      return;
    }

    phase = "sending";
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      phase = response.ok ? "done" : "failed";
    } catch {
      phase = "failed";
    }
  }}
>
  <input type="hidden" name="embed" value="1" />
  <input type="hidden" name="tag" value={from} />
  {#if phase !== "done"}
    <div class="flex items-baseline gap-3">
      <label for="{id}-email" class="sr-only">Your email address</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="{id}-email"
        type="email"
        name="email"
        required
        autocomplete="email"
        spellcheck="false"
        placeholder="you@example.com"
        autofocus={eager}
        class="h-9 min-w-0 flex-1 rounded-none border-0 border-b-2 border-cobalt/45 bg-transparent px-0.5 pb-0.5 font-serif text-[0.9375rem] text-foreground transition-colors duration-200 placeholder:text-muted-foreground hover:border-cobalt/70 focus:border-cobalt focus:outline-none"
      />
      <button
        type="submit"
        disabled={phase === "sending"}
        class="stone shrink-0 -rotate-1 bg-cobalt px-4 pt-2 pb-1.5 font-wide text-[0.75rem] font-[760] text-background font-stretch-118% [--flood:var(--color-turquoise)] disabled:opacity-70"
        ><span aria-hidden="true" class="flood"></span>{phase === "sending"
          ? "Signing up…"
          : "Sign up"}</button
      >
    </div>
  {/if}
  <p
    role="status"
    class={cn("text-[0.8125rem] leading-snug text-muted-foreground italic", {
      "mt-2": phase === "failed",
    })}
  >
    {#if phase === "done"}
      Thanks. Check your inbox for a link to confirm your address.
    {:else if phase === "failed"}
      That didn’t go through. Try again in a minute.
    {/if}
  </p>
</form>
