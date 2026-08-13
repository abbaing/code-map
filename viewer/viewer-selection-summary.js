import { scoreColor } from '#viewer/viewer-svg.js'
import { escapeHtml, healthPill } from '#viewer/viewer-utils.js'

function traceSummaryHtml(trace) {
  if (!trace) {
    return ''
  }
  const status = traceStatus(trace)
  const border = trace.complete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
  const heading = trace.complete ? 'text-emerald-900' : 'text-amber-900'
  const text = trace.complete ? 'text-emerald-700' : 'text-amber-700'
  return `
    <div class="mt-3 rounded border ${border} p-2.5 text-[11px]">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="font-semibold ${heading}">Execution trace</div>
          <div class="mt-0.5 ${text}">${escapeHtml(status)}</div>
        </div>
        ${traceToggle(trace)}
      </div>
      <div class="mt-2 border-t ${trace.complete ? 'border-emerald-200' : 'border-amber-200'} pt-2 text-gray-600">
        Solid lines are confirmed. Dashed lines are inferred by static analysis.
      </div>
    </div>
  `
}

function traceStatus(trace) {
  if (!trace.complete) {
    return trace.missingPersistence ? 'Persistence boundary not found' : 'Frontend origin not found'
  }
  const endpoints = `${trace.endpointCount} endpoint${trace.endpointCount === 1 ? '' : 's'}`
  const tables = `${trace.tableCount} table${trace.tableCount === 1 ? '' : 's'}`
  const continued = trace.continuedFromAncestor ? ' · continued through owning component' : ''
  return `${endpoints} · ${tables}${continued}`
}

function traceToggle(trace) {
  if (trace.allNodeIds.size <= trace.primaryNodeIds.length) {
    return ''
  }
  return `<button class="trace-inline-action" data-toggle-trace>${trace.showAll ? 'Primary path' : 'Show all paths'}</button>`
}

function coverageSummaryHtml(testCaseCount) {
  const count = testCaseCount === null ? 'Refresh' : escapeHtml(testCaseCount)
  return `
    <div class="rounded border border-gray-200 bg-white p-2">
      <div class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Coverage</div>
      <div class="flex items-baseline justify-between gap-2">
        <div class="text-gray-500">Test cases</div>
        <div class="text-sm font-semibold text-gray-800">${count}</div>
      </div>
    </div>
  `
}

function qualitySummaryHtml(quality) {
  const health = healthPill(quality.score)
  const inputs = quality.calculation?.inputs
  return `
    <div class="rounded border border-gray-200 bg-white p-2">
      ${qualityHeading(quality, health)}
      <div class="space-y-2">
        ${qualityMetricHtml('Overall', quality.score, quality.summary ?? health.description, 'bg-emerald-300')}
        ${qualityMetricHtml('Cohesion', quality.cohesion.score, quality.cohesion.reason, 'bg-sky-300')}
        ${qualityMetricHtml('Coupling', quality.coupling.score, quality.coupling.reason, 'bg-violet-300')}
      </div>
      ${calculationDetail(inputs)}
    </div>
  `
}

function qualityHeading(quality, health) {
  return `
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="min-w-0"><div class="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Quality</div></div>
      <span class="text-[11px] font-semibold rounded px-2 py-0.5 text-white whitespace-nowrap shrink-0"
        style="background:${scoreColor(quality.score)}" title="${escapeHtml(health.description)}"
        aria-label="${escapeHtml(health.description)}">Q ${escapeHtml(quality.score)}/10</span>
    </div>
  `
}

function calculationDetail(inputs) {
  return `
    <details class="mt-2 border-t border-gray-100 pt-2 text-[10px] text-gray-500">
      <summary class="cursor-pointer font-semibold text-gray-600">How this score is calculated</summary>
      <p class="mt-1 leading-4">Q is an architecture maintainability heuristic, not correctness or test
        coverage. It combines cohesion and coupling, with the lower score weighted twice:
        round((cohesion + coupling + min) / 3).</p>
      <p class="mt-1 leading-4">Cohesion considers relations inside vs. outside the module, feature placement,
        dependency count, and detected usages. Coupling penalizes outgoing dependencies and external modules.</p>
      ${inputs ? calculationInputs(inputs) : ''}
    </details>
  `
}

function calculationInputs(inputs) {
  return `<dl class="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
    <dt>Inside module</dt><dd class="text-right font-semibold text-gray-700">${escapeHtml(inputs.internalRelations)}</dd>
    <dt>Outside module</dt><dd class="text-right font-semibold text-gray-700">${escapeHtml(inputs.externalRelations)}</dd>
    <dt>Outgoing</dt><dd class="text-right font-semibold text-gray-700">${escapeHtml(inputs.outgoingDependencies)}</dd>
    <dt>Incoming</dt><dd class="text-right font-semibold text-gray-700">${escapeHtml(inputs.incomingUsages)}</dd>
    <dt>External modules</dt><dd class="text-right font-semibold text-gray-700">${escapeHtml(inputs.externalModules.length)}</dd>
  </dl>`
}

function qualityMetricHtml(label, score, title, barClassName) {
  const pct = Math.max(0, Math.min(100, Number(score) * 10))
  return `
    <div class="text-gray-700" title="${escapeHtml(title ?? '')}" aria-label="${escapeHtml(title ?? '')}">
      <div class="mb-1 flex items-center justify-between gap-2">
        <div class="font-semibold">${escapeHtml(label)}</div>
        <div class="font-semibold">${escapeHtml(score)}/10</div>
      </div>
      <div class="h-1.5 rounded bg-gray-100">
        <div class="h-1.5 rounded ${barClassName}" style="width:${pct}%"></div>
      </div>
    </div>
  `
}

export { coverageSummaryHtml, qualitySummaryHtml, traceSummaryHtml }
