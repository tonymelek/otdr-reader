<script lang="ts">
  import PropertyList from './lib/PropertyList.svelte'
  import {
    EVENT_COLUMNS,
    blockOf,
    facts,
    formatWhen,
    km,
    rangeOf,
    textOf,
    wavelengthOf,
    withUnit,
  } from './lib/present'
  import TraceChart from './lib/TraceChart.svelte'
  import { SorReader } from './lib/sor/sor'
  import { onMount } from 'svelte'

  type TraceEvent = Record<string, unknown>
  type SorResult = {
    params: Record<string, unknown>
    points?: { points?: number[][] }
    events?: TraceEvent | TraceEvent[]
    summary?: TraceEvent | TraceEvent[]
  }

  let files = $state<File[]>([])
  let activeName = $state('')
  let result = $state<SorResult | null>(null)
  let error = $state('')
  let selectedEvent = $state('')
  let reading = $state(false)
  let dragging = $state(false)

  onMount(() => {
    const keepOnPage = (event: DragEvent) => event.preventDefault()
    window.addEventListener('dragover', keepOnPage)
    window.addEventListener('drop', keepOnPage)
    return () => {
      window.removeEventListener('dragover', keepOnPage)
      window.removeEventListener('drop', keepOnPage)
    }
  })

  const siteRoot = window.location.href.replace(/\/app.*$/, '')
  const points = $derived(result?.points?.points ?? [])
  const events = $derived(asList(result?.events))
  const summary = $derived(asList(result?.summary))
  const fixed = $derived(blockOf(result?.params, 'FxdParams'))
  const general = $derived(blockOf(result?.params, 'GenParams'))
  const supplier = $derived(blockOf(result?.params, 'SupParams'))
  const summaryRow = $derived(summary[0] ?? {})
  const wavelength = $derived(result ? wavelengthOf(activeName, fixed) : '')
  const when = $derived(formatWhen(fixed['date/time']))
  const caption = $derived(
    [textOf(general['fiber type']), textOf(general.operator), when].filter(Boolean).join(' · '),
  )
  const metrics = $derived(
    facts([
      ['Wavelength', wavelength],
      ['Trace', km(points.at(-1)?.[0])],
      ['Range', rangeOf(fixed.range)],
      ['Pulse', fixed['pulse width']],
      ['Loss', withUnit(summaryRow['total loss'], 'dB')],
      ['Events', events.length ? String(events.length) : ''],
    ]),
  )
  const linkFacts = $derived(
    facts([
      ['Fiber', general['fiber type']],
      ['Fiber ID', general['fiber ID']],
      ['Cable ID', general['cable ID']],
      ['From', general['location A']],
      ['To', general['location B']],
      ['Operator', general.operator],
      ['Comments', general.comments],
      ['Index', fixed.index],
      ['Averages', fixed['num average']],
      ['Average time', fixed['averaging time']],
      ['Points', blockOf(result?.params, 'DataPts')['number of Points']],
      ['Trace type', fixed['trace type']],
    ]),
  )
  const instrumentFacts = $derived(
    facts([
      ['Supplier', supplier.supplier],
      ['OTDR', supplier.OTDR],
      ['Serial', supplier['OTDR S/N']],
      ['Module', supplier.module],
      ['Module serial', supplier['module S/N']],
      ['Software', supplier.software],
    ]),
  )

  function selectEvent(id: string, scroll = false) {
    selectedEvent = id
    if (!scroll || !id) return
    document.getElementById(`event-${id}`)?.scrollIntoView({ block: 'nearest' })
  }

  function onEventKey(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    selectEvent(id)
  }

  function asList(value: TraceEvent | TraceEvent[] | undefined): TraceEvent[] {
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') return [value]
    return []
  }

  function addFiles(list: FileList | File[] | null) {
    const incoming = Array.from(list ?? [])
    if (incoming.length === 0) return
    const accepted = incoming.filter((file) => file.name.toLowerCase().endsWith('.sor'))
    if (accepted.length === 0) {
      error = 'Drop a .sor file.'
      return
    }
    const next = new Map(files.map((file) => [file.name.toLowerCase(), file]))
    for (const file of accepted) next.set(file.name.toLowerCase(), file)
    files = [...next.values()]
    openFile(accepted[0])
  }

  function onBrowse(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    addFiles(input.files)
    input.value = ''
  }

  function onDragEnter(event: DragEvent) {
    event.preventDefault()
    dragging = true
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave(event: DragEvent) {
    const next = event.relatedTarget
    const zone = event.currentTarget
    if (next instanceof Node && zone instanceof Node && zone.contains(next)) return
    dragging = false
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    dragging = false
    addFiles(event.dataTransfer?.files ?? null)
  }

  async function openFile(file: File) {
    activeName = file.name
    selectedEvent = ''
    error = ''
    reading = true
    try {
      const buffer = await file.arrayBuffer()
      const reader = new SorReader(undefined, { browserMode: true }, buffer)
      const parsed = (await reader.parse()) as SorResult | undefined
      if (!parsed?.points?.points) {
        result = null
        error = 'This file could not be read. Version 2 SOR files are supported.'
        return
      }
      result = parsed
    } catch (err) {
      result = null
      error = err instanceof Error ? err.message : 'This file could not be read.'
    } finally {
      reading = false
    }
  }
</script>

<div class="shell">
  <header class="bar">
    <a class="brand" href={siteRoot || '/'}>
      <img src="{siteRoot}/favicon.svg" alt="" width="28" height="28" />
      OTDR Reader
    </a>
    <nav>
      <a href="{siteRoot}/about.html">Format</a>
    </nav>
  </header>

  <main>
    <section class="picker">
      {#if files.length === 0}
        <h1>Viewer</h1>
        <p>Drag version 2 SOR files here, or browse. They are read in this browser.</p>
      {/if}
      <div
        class="drop"
        class:slim={files.length > 0}
        class:dragging
        role="region"
        aria-label="Add SOR files"
        ondragenter={onDragEnter}
        ondragover={onDragOver}
        ondragleave={onDragLeave}
        ondrop={onDrop}
      >
        {#if files.length === 0}
          <svg class="drop-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 16V5m0 0 4 4m-4-4-4 4M5 19h14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <p class="drop-title">{dragging ? 'Release to add' : 'Drop SOR files'}</p>
          <p class="drop-hint">or</p>
        {:else}
          <p class="drop-title">{dragging ? 'Release to add' : 'Drop another SOR'}</p>
        {/if}
        <label class="browse" class:quiet={files.length > 0}>
          Browse
          <input
            class="file-input"
            type="file"
            accept=".sor,application/octet-stream"
            multiple
            onchange={onBrowse}
          />
        </label>
      </div>
      {#if files.length > 0}
        <div class="traces" role="tablist" aria-label="Traces">
          {#each files as file (`${file.name}-${file.size}`)}
            <button
              type="button"
              role="tab"
              class:selected={file.name === activeName}
              aria-selected={file.name === activeName}
              onclick={() => openFile(file)}
            >
              <span class="wl">{wavelengthOf(file.name, file.name === activeName ? fixed : undefined)}</span>
              <span class="fn">{file.name}</span>
            </button>
          {/each}
        </div>
      {/if}
      {#if reading}
        <p class="status">Reading {activeName}…</p>
      {/if}
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
    </section>

    {#if result}
      <section class="metrics" aria-label="Trace summary">
        {#each metrics as metric (metric.label)}
          <div>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        {/each}
      </section>

      <section class="panel chart-panel">
        <header class="panel-head">
          <h2>{wavelength || 'Trace'}</h2>
          {#if caption}
            <p>{caption}</p>
          {/if}
        </header>
        <TraceChart
          {points}
          {events}
          selected={selectedEvent}
          onselect={(id) => selectEvent(id, true)}
        />
      </section>

      <section class="split">
        <div class="panel">
          <h2>Events</h2>
          {#if events.length === 0}
            <p class="status">No key events in this file.</p>
          {:else}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    {#each EVENT_COLUMNS as column (column[0])}
                      <th scope="col">{column[1]}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each events as row (`${row.number ?? ''}-${row.distance ?? ''}`)}
                    <tr
                      id="event-{row.number}"
                      class:selected={String(row.number ?? '') === selectedEvent}
                      aria-selected={String(row.number ?? '') === selectedEvent}
                      tabindex="0"
                      onclick={() => selectEvent(String(row.number ?? ''))}
                      onkeydown={(event) => onEventKey(event, String(row.number ?? ''))}
                    >
                      {#each EVENT_COLUMNS as column (column[0])}
                        <td data-label={column[1]}>{column[2](row[column[0]])}</td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
        <div class="panel">
          <h2>Link</h2>
          {#if linkFacts.length === 0}
            <p class="status">No link fields in this file.</p>
          {:else}
            <dl class="facts">
              {#each linkFacts as fact (fact.label)}
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              {/each}
            </dl>
          {/if}
          {#if instrumentFacts.length > 0}
            <h2>Instrument</h2>
            <dl class="facts">
              {#each instrumentFacts as fact (fact.label)}
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              {/each}
            </dl>
          {/if}
        </div>
      </section>

      <details class="raw">
        <summary>All fields</summary>
        <PropertyList value={result.params} />
      </details>
    {/if}
  </main>
</div>

<style>
  .shell {
    min-height: 100vh;
    min-width: 0;
    background: var(--mist);
    color: var(--ink);
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    height: 4rem;
    padding: 0 1.25rem;
    background: #fff;
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--ink);
    font-weight: 700;
    text-decoration: none;
    font-family: Sora, system-ui, sans-serif;
  }

  .brand img { border-radius: 0.4rem; }

  nav a {
    color: var(--muted);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 600;
  }

  main {
    width: 100%;
    max-width: 72rem;
    min-width: 0;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
    display: grid;
    gap: 1rem;
  }

  h1, h2 {
    font-family: Sora, system-ui, sans-serif;
    margin: 0 0 0.4rem;
  }

  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.05rem; margin-top: 0.25rem; }

  .picker p, .status { color: var(--muted); margin: 0.35rem 0 0; }

  .panel {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 1rem;
    padding: 1rem 1.1rem 1.2rem;
    min-width: 0;
  }

  .drop {
    margin-top: 1rem;
    padding: 1.75rem 1.25rem;
    border: 1.5px dashed #b7c5d4;
    border-radius: 1rem;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.2rem;
  }

  .drop.slim {
    margin-top: 0;
    padding: 0.7rem 0.9rem;
    flex-direction: row;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .drop.dragging {
    border-color: var(--sea);
    background: #e7f4f5;
  }

  .drop-icon {
    width: 1.75rem;
    height: 1.75rem;
    color: var(--sea);
    margin-bottom: 0.35rem;
  }

  .drop-title {
    margin: 0;
    color: var(--ink);
    font-weight: 600;
    font-family: Sora, system-ui, sans-serif;
  }

  .drop-hint {
    margin: 0.15rem 0 0.45rem;
    color: var(--muted);
    font-size: 0.8125rem;
  }

  .browse {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--ink);
    color: #fff;
    font-weight: 600;
    font-size: 0.875rem;
    border-radius: 0.75rem;
    padding: 0.6rem 1rem;
    cursor: pointer;
  }

  .browse:focus-within {
    outline: 2px solid var(--sea);
    outline-offset: 2px;
  }

  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .browse.quiet {
    background: transparent;
    color: var(--ink);
    border: 1px solid var(--line);
  }

  .traces {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.6rem;
    margin-top: 0.75rem;
  }

  .traces button {
    text-align: left;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 0.85rem;
    padding: 0.75rem 0.9rem;
    cursor: pointer;
    min-width: 0;
  }

  .traces button:hover { border-color: #b7d4d7; }

  .traces button.selected {
    border-color: var(--sea);
    background: #f3fbfb;
  }

  .traces button:focus-visible {
    outline: 2px solid var(--sea);
    outline-offset: 2px;
  }

  .wl {
    display: block;
    font-family: Sora, system-ui, sans-serif;
    font-weight: 700;
    font-size: 1.15rem;
  }

  .fn {
    display: block;
    margin-top: 0.15rem;
    color: var(--muted);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.6rem;
  }

  .metrics div {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 0.85rem;
    padding: 0.7rem 0.8rem;
    min-width: 0;
  }

  .metrics span {
    display: block;
    color: var(--muted);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .metrics strong {
    display: block;
    margin-top: 0.25rem;
    font-family: Sora, system-ui, sans-serif;
    font-size: 1.02rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .panel-head h2 { margin-bottom: 0.15rem; }
  .panel-head p { margin: 0 0 0.6rem; color: var(--muted); font-size: 0.875rem; }

  .facts {
    display: grid;
    grid-template-columns: minmax(6.5rem, 0.4fr) minmax(0, 1fr);
    gap: 0.45rem 0.85rem;
    margin: 0 0 1.1rem;
  }

  .facts dt { color: var(--muted); font-size: 0.8rem; }
  .facts dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .raw {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 1rem;
    padding: 0.4rem 1rem 0.8rem;
  }

  .raw summary {
    cursor: pointer;
    font-weight: 600;
    padding: 0.55rem 0;
  }

  .error {
    color: #9f1239;
    background: #fff1f2;
    border-radius: 0.6rem;
    padding: 0.6rem 0.75rem;
  }

  .split {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(16rem, 0.75fr);
    gap: 1rem;
    align-items: start;
    min-width: 0;
  }

  .table-wrap {
    container-type: inline-size;
    max-width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  th, td {
    text-align: left;
    padding: 0.55rem 0.65rem;
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }

  th {
    color: var(--muted);
    font-size: 0.68rem;
    letter-spacing: 0.02em;
    font-weight: 600;
  }

  tbody tr { cursor: pointer; }
  tbody tr:hover td { background: #f8fafc; }
  tbody tr:focus-visible {
    outline: 2px solid var(--coral);
    outline-offset: -2px;
  }
  tr.selected td { background: #fff4f0; }
  tr.selected td:first-child { box-shadow: inset 3px 0 0 var(--coral); }
  tr.selected:hover td { background: #fff4f0; }

  @container (min-width: 36rem) {
    table { min-width: 34rem; }
  }

  @container (max-width: 36rem) {
    table { min-width: 0; }
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    table, tbody, tr, td { display: block; width: auto; }
    tbody tr {
      border: 1px solid var(--line);
      border-radius: 0.8rem;
      margin-bottom: 0.55rem;
      padding: 0.2rem 0;
    }
    td {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      border: 0;
      white-space: normal;
      text-align: right;
      padding: 0.32rem 0.75rem;
    }
    td::before {
      content: attr(data-label);
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 600;
      text-align: left;
    }
    tr.selected { background: #fff4f0; box-shadow: inset 3px 0 0 var(--coral); }
    tr.selected td,
    tr.selected td:first-child { background: transparent; box-shadow: none; }
  }

  @media (max-width: 64rem) {
    .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .split { grid-template-columns: 1fr; }
  }

  @media (max-width: 40rem) {
    .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .facts { grid-template-columns: 1fr; gap: 0.15rem; }
    .facts dd { margin-bottom: 0.55rem; }
  }
</style>
