<script lang="ts">
  import { HELP } from "$lib/help";
  import { explorer } from "$lib/state.svelte";
  import Dialog from "./dialog.svelte";
</script>

<Dialog
  size="lg"
  label={HELP.title}
  onclose={() => {
    explorer.help = false;
  }}
>
  <h2
    class="-ml-0.5 font-display text-[27px] leading-[1.02] font-bold tracking-tight text-pretty text-foreground"
  >
    {HELP.title}
  </h2>
  <p class="mt-1 text-[13px] leading-relaxed text-muted-foreground">
    {HELP.dek}
  </p>
  <div class="mt-2 h-1.25 rounded-[50%] bg-primary/80"></div>

  {#each HELP.sections as section (section.heading)}
    <section class="mt-5 border-t rule pt-4">
      <h3 class="slab text-[15px] text-foreground">{section.heading}</h3>
      {#if section.line.length > 0}
        <p class="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {section.line}
        </p>
      {/if}

      <table class="mt-1.5 w-full table-fixed border-collapse text-left">
        <colgroup>
          <col style:width="52%" />
          <col style:width="48%" />
        </colgroup>
        <thead class="sr-only">
          <tr>
            <th scope="col">Type this</th>
            <th scope="col">What happens</th>
          </tr>
        </thead>
        <tbody>
          {#each section.rows as row (row.try)}
            <tr class="border-t rule align-baseline">
              <td class="py-1.5 pr-3">
                <button
                  type="button"
                  class="text-left text-[12.5px] leading-snug font-medium text-pretty text-foreground underline decoration-primary/45 decoration-dotted underline-offset-[3px] transition-colors duration-200 hover:decoration-primary"
                  onclick={() => {
                    explorer.tryInSearch(row.try);
                  }}
                >
                  {row.try}
                </button>
              </td>
              <td class="py-1.5 text-[12px] leading-snug text-muted-foreground">
                {row.does}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/each}

  <p
    class="mt-5 border-t rule pt-3 text-[12px] leading-relaxed text-muted-foreground"
  >
    {HELP.keys}
  </p>
</Dialog>
