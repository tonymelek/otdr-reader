<script lang="ts">
  import PropertyList from './PropertyList.svelte'

  let { value }: { value: unknown } = $props()

  const entries = $derived(
    value !== null && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).filter(([, child]) => {
          if (child !== null && typeof child === 'object') return true
          return String(child ?? '').replaceAll('\u0000', '').trim() !== ''
        })
      : null,
  )
</script>

{#if entries}
  <ul class="props">
    {#each entries as [key, child] (key)}
      <li>
        <span class="key">{key}</span>
        <PropertyList value={child} />
      </li>
    {/each}
  </ul>
{:else}
  <span class="leaf">{String(value).replaceAll('\u0000', '').trim()}</span>
{/if}

<style>
  .props {
    list-style: none;
    margin: 0.25rem 0 0.25rem 0;
    padding-left: 0.9rem;
  }

  .key {
    font-weight: 600;
  }

  .leaf {
    color: var(--muted);
  }
</style>
