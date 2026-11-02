<script lang="ts">
  import { onMount } from 'svelte'
  import * as echarts from 'echarts'
  import { sampleTrace, sectionBetween } from './present'

  const CORAL = '#FF6B4A'
  const SEA = '#0E7C86'
  const MARKER = '#4338CA'

  let {
    points = [],
    events = [],
    selected = '',
    onselect,
  }: {
    points: number[][]
    events: Record<string, unknown>[]
    selected?: string
    onselect?: (id: string) => void
  } = $props()

  let el: HTMLDivElement | undefined = $state()
  let chart: echarts.ECharts | undefined
  let ready = $state(false)
  let markerA = $state<number | null>(null)
  let markerB = $state<number | null>(null)
  let armed = $state<'A' | 'B'>('A')
  let placedFor: number[][] | null = null
  let builtFor: number[][] | null = null

  const levelA = $derived(markerA == null ? null : sampleTrace(points, markerA))
  const levelB = $derived(markerB == null ? null : sampleTrace(points, markerB))
  const section = $derived(sectionBetween(points, markerA, markerB))

  const live = {
    points: [] as number[][],
    armed: 'A' as 'A' | 'B',
    a: null as number | null,
    b: null as number | null,
    onselect: undefined as ((id: string) => void) | undefined,
  }

  function reading(value: number | null, unit: string): string {
    if (value == null || !Number.isFinite(value)) return '—'
    return `${value.toFixed(3)} ${unit}`
  }

  function clampKm(kmValue: number): number {
    const source = live.points
    if (source.length === 0 || !Number.isFinite(kmValue)) return kmValue
    return Math.min(source[source.length - 1][0], Math.max(source[0][0], kmValue))
  }

  function place(which: 'A' | 'B', kmValue: number) {
    const next = clampKm(kmValue)
    if (!Number.isFinite(next)) return
    if (which === 'A') markerA = next
    else markerB = next
    armed = which
  }

  function eventLines(rows: Record<string, unknown>[], current: string) {
    const lines = rows.flatMap((event) => {
      const distance = Number.parseFloat(String(event.distance ?? ''))
      if (!Number.isFinite(distance)) return []
      const name = String(event.number ?? '')
      const active = name !== '' && name === current
      const color = active ? CORAL : 'rgba(14, 124, 134, 0.55)'
      const width = active ? 2.4 : 1
      return [
        {
          name,
          xAxis: distance,
          lineStyle: { color, width, type: active ? 'solid' : 'dashed' },
          label: { show: false },
          emphasis: { lineStyle: { color, width: active ? 2.4 : 1.6 } },
        },
      ]
    })
    const activeLine = lines.filter((line) => line.lineStyle.color === CORAL)
    const rest = lines.filter((line) => line.lineStyle.color !== CORAL)
    return [...rest, ...activeLine]
  }

  function cursorLine(name: 'A' | 'B', kmValue: number | null, active: boolean) {
    if (kmValue == null) return []
    return [
      {
        name,
        xAxis: kmValue,
        lineStyle: { color: MARKER, width: active ? 2.4 : 1.7, type: 'solid' },
        label: {
          show: true,
          formatter: name,
          position: 'end',
          distance: 8,
          color: '#fff',
          backgroundColor: MARKER,
          borderRadius: 4,
          padding: [2, 6],
          fontSize: 11,
          fontWeight: 700,
        },
        emphasis: { lineStyle: { color: MARKER, width: 2.6 } },
      },
    ]
  }

  function seriesOption(
    lines: ReturnType<typeof eventLines>,
    dots: ReturnType<typeof cursorDots>,
  ) {
    return {
      id: 'trace',
      type: 'line' as const,
      symbol: 'none' as const,
      lineStyle: { width: 1.6, color: SEA },
      itemStyle: { color: SEA },
      areaStyle: { color: 'rgba(14, 124, 134, 0.08)' },
      clip: false,
      encode: { x: 0, y: 1 },
      markLine: {
        silent: false,
        symbol: 'none' as const,
        animation: false,
        data: lines,
      },
      markPoint: {
        silent: true,
        symbol: 'circle' as const,
        symbolSize: 9,
        label: { show: false },
        data: dots,
      },
    }
  }

  function cursorDots() {
    return [markerA, markerB].flatMap((kmValue, index) => {
      if (kmValue == null) return []
      const level = sampleTrace(points, kmValue)
      if (level == null) return []
      return [
        {
          name: index === 0 ? 'A' : 'B',
          coord: [kmValue, level],
          itemStyle: { color: '#fff', borderColor: MARKER, borderWidth: 2 },
        },
      ]
    })
  }

  function kmFromEvent(offsetX: number, offsetY: number): number | null {
    if (!chart) return null
    const value = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [offsetX, offsetY])
    const kmValue = Array.isArray(value) ? Number(value[0]) : Number.NaN
    return Number.isFinite(kmValue) ? kmValue : null
  }

  function pixelX(kmValue: number): number | null {
    if (!chart) return null
    const value = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [kmValue, 0])
    const x = Array.isArray(value) ? Number(value[0]) : Number.NaN
    return Number.isFinite(x) ? x : null
  }

  onMount(() => {
    if (!el) return
    chart = echarts.init(el)
    const zr = chart.getZr()
    let hitMark = false
    let drag: 'A' | 'B' | null = null
    let dragged = false

    chart.on('click', (params) => {
      const mark = params as { componentType?: string; name?: string }
      if (mark.componentType !== 'markLine' || mark.name == null) return
      hitMark = true
      if (mark.name === 'A' || mark.name === 'B') {
        armed = mark.name
        return
      }
      live.onselect?.(String(mark.name))
    })

    zr.on('mousedown', (event) => {
      const point = event as { offsetX: number; offsetY: number; stop?: () => void }
      const near = (kmValue: number | null) => {
        if (kmValue == null) return false
        const x = pixelX(kmValue)
        return x != null && Math.abs(x - point.offsetX) <= 8
      }
      dragged = false
      if (near(live.a)) drag = 'A'
      else if (near(live.b)) drag = 'B'
      else drag = null
      if (drag) point.stop?.()
    })

    zr.on('mousemove', (event) => {
      const point = event as { offsetX: number; offsetY: number }
      if (!el) return
      if (!drag) {
        const nearA = pixelX(live.a ?? Number.NaN)
        const nearB = pixelX(live.b ?? Number.NaN)
        const close =
          (nearA != null && Math.abs(nearA - point.offsetX) <= 8) ||
          (nearB != null && Math.abs(nearB - point.offsetX) <= 8)
        el.style.cursor = close ? 'ew-resize' : 'crosshair'
        return
      }
      const kmValue = kmFromEvent(point.offsetX, point.offsetY)
      if (kmValue == null) return
      dragged = true
      el.style.cursor = 'ew-resize'
      place(drag, kmValue)
    })

    zr.on('mouseup', () => {
      drag = null
    })
    zr.on('globalout', () => {
      drag = null
    })

    zr.on('click', (event) => {
      const point = event as { offsetX: number; offsetY: number }
      if (dragged) {
        dragged = false
        return
      }
      if (hitMark) {
        hitMark = false
        return
      }
      if (!chart?.containPixel({ gridIndex: 0 }, [point.offsetX, point.offsetY])) return
      const kmValue = kmFromEvent(point.offsetX, point.offsetY)
      if (kmValue == null) return
      place(live.armed, kmValue)
    })

    const observer = new ResizeObserver(() => chart?.resize())
    observer.observe(el)
    ready = true
    return () => {
      observer.disconnect()
      chart?.dispose()
      chart = undefined
    }
  })

  $effect(() => {
    const source = points
    if (placedFor === source) return
    placedFor = source
    if (source.length < 2) {
      markerA = null
      markerB = null
      return
    }
    const start = source[0][0]
    const end = source[source.length - 1][0]
    const span = end - start
    markerA = start + span * 0.2
    markerB = start + span * 0.8
    armed = 'A'
  })

  $effect(() => {
    live.points = points
    live.a = markerA
    live.b = markerB
    live.armed = armed
    live.onselect = onselect
  })

  $effect(() => {
    if (!ready || !chart) return
    const source = points
    const lines = [
      ...eventLines(events, selected),
      ...cursorLine('A', markerA, armed === 'A'),
      ...cursorLine('B', markerB, armed === 'B'),
    ]
    const series = seriesOption(lines, cursorDots())
    if (builtFor !== source) {
      builtFor = source
      chart.setOption(
        {
          animation: false,
          grid: { left: 8, right: 18, top: 46, bottom: 52, containLabel: true },
          tooltip: {
            trigger: 'axis',
            backgroundColor: '#0A2540',
            borderWidth: 0,
            textStyle: { color: '#fff', fontSize: 12 },
            formatter(params: unknown) {
              const row = Array.isArray(params) ? params[0] : params
              const data = (row as { data?: number[] } | undefined)?.data
              if (!data) return ''
              return `${Number(data[0]).toFixed(3)} km<br/>${Number(data[1]).toFixed(3)} dB`
            },
          },
          xAxis: {
            name: 'km',
            nameTextStyle: { color: '#475569' },
            axisLine: { lineStyle: { color: '#E8EEF4' } },
            axisLabel: { color: '#475569' },
            splitLine: { show: false },
          },
          yAxis: {
            name: 'dB',
            nameTextStyle: { color: '#475569' },
            axisLabel: { color: '#475569' },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: '#E8EEF4' } },
            max: (value: { max: number }) => Math.ceil(value.max + 2),
          },
          dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            {
              type: 'slider',
              height: 16,
              bottom: 8,
              borderColor: 'transparent',
              backgroundColor: '#F5F7FA',
              fillerColor: 'rgba(14, 124, 134, 0.18)',
              handleSize: 12,
              moveHandleSize: 4,
              textStyle: { color: '#475569', fontSize: 10 },
            },
          ],
          dataset: { source },
          series: [series],
        },
        true,
      )
      return
    }
    chart.setOption(
      {
        grid: { left: 8, right: 18, top: 46, bottom: 52, containLabel: true },
        series: [series],
      },
      { replaceMerge: ['series'] },
    )
  })
</script>

<div class="chart" bind:this={el} role="application" aria-label="Trace chart. Click to move marker {armed}."></div>

<div class="cursors">
  <button type="button" class:armed={armed === 'A'} aria-pressed={armed === 'A'} onclick={() => (armed = 'A')}>
    <span class="tag">A</span>
    <span>{reading(markerA, 'km')}</span>
    <span>{reading(levelA, 'dB')}</span>
  </button>
  <button type="button" class:armed={armed === 'B'} aria-pressed={armed === 'B'} onclick={() => (armed = 'B')}>
    <span class="tag">B</span>
    <span>{reading(markerB, 'km')}</span>
    <span>{reading(levelB, 'dB')}</span>
  </button>
  <div class="delta">
    <span class="delta-label">Difference</span>
    <span><small>Distance</small>{reading(section?.distanceKm ?? null, 'km')}</span>
    <span><small>Loss</small>{reading(section?.lossDb ?? null, 'dB')}</span>
    <span><small>Slope</small>{reading(section?.slopeDbPerKm ?? null, 'dB/km')}</span>
  </div>
</div>
<p class="hint">Click the trace to move the highlighted marker. Drag either line to adjust it.</p>

<style>
  .chart {
    height: 420px;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .cursors {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 0.6rem;
    margin-top: 0.85rem;
    min-width: 0;
  }

  .cursors button,
  .delta {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    text-align: left;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    padding: 0.55rem 0.7rem;
    font-variant-numeric: tabular-nums;
    font-family: Sora, system-ui, sans-serif;
    font-size: 0.82rem;
    color: var(--ink);
  }

  .cursors button { cursor: pointer; }
  .cursors button.armed {
    border-color: var(--marker);
    background: #eef0ff;
  }
  .cursors button:focus-visible {
    outline: 2px solid var(--marker);
    outline-offset: 2px;
  }

  .tag {
    background: var(--marker);
    color: #fff;
    border-radius: 0.35rem;
    padding: 0.08rem 0.38rem;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .delta {
    display: grid;
    grid-template-columns: auto repeat(3, minmax(0, 1fr));
    border-left: 3px solid var(--marker);
  }

  .delta-label {
    color: var(--muted);
    font-family: Inter, system-ui, sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
  }

  .delta span {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .delta small {
    color: var(--muted);
    font-family: Inter, system-ui, sans-serif;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .hint {
    margin: 0.45rem 0 0;
    color: var(--muted);
    font-size: 0.78rem;
  }

  @media (max-width: 64rem) {
    .cursors { grid-template-columns: 1fr; }
    .delta { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .delta-label { grid-column: 1 / -1; }
  }
</style>
