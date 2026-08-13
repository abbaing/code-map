import { layerLabels, moduleLabels, typeLabels } from '#viewer/viewer-state.js'
import { healthDescription, healthPill, scoreToHealthKey } from '#viewer/viewer-health.js'

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function pillHtml(className, text, title = '') {
  const titleAttr = title ? ` title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"` : ''
  return `<span class="text-[11px] font-semibold rounded px-2 py-0.5 ${className}"${titleAttr}>${escapeHtml(text)}</span>`
}

function capitalize(value) {
  if (!value) {
    return ''
  }
  return value[0].toUpperCase() + value.slice(1)
}

function fillSelect(select, values, allLabel, format = (value) => value) {
  select.innerHTML = values
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}">${value === 'all' ? allLabel : escapeHtml(format(value))}</option>`
    )
    .join('')
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function formatType(type) {
  if (!type) {
    return ''
  }
  return (
    typeLabels[type] ??
    String(type)
      .split('-')
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
      .join(' ')
  )
}

function formatModule(mod) {
  if (!mod) {
    return ''
  }
  return (
    moduleLabels[mod] ??
    String(mod)
      .split('-')
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
      .join(' ')
  )
}

function formatLayer(layer) {
  if (!layer) {
    return ''
  }
  return (
    layerLabels[layer] ??
    String(layer)
      .split('-')
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
      .join(' ')
  )
}

const ruleLabels = {
  'frontend.relative-imports': 'Relative imports',
  'frontend.component-max-lines': 'Component too long',
  'frontend.no-any': 'No any type',
  'frontend.component-folder-entry': 'Folder entry missing',
  'frontend.main-no-orchestration': 'Main component too complex',
  'frontend.route-file-shape': 'Route file shape',
  'technology.typescript.relative-imports': 'Relative imports',
  'technology.typescript.no-any': 'No any type',
  'framework.react.component-max-lines': 'Component too long',
  'framework.react.route-file-shape': 'Route file shape'
}

function formatRuleId(ruleId) {
  if (!ruleId) {
    return ''
  }
  if (ruleLabels[ruleId]) {
    return ruleLabels[ruleId]
  }
  return ruleId
    .replace(/^[a-z]+\./, '')
    .split(/[-.]/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function debounce(fn, ms) {
  let timer
  return (...args) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), ms)
  }
}

export {
  capitalize,
  debounce,
  escapeHtml,
  fillSelect,
  formatLayer,
  formatModule,
  formatRuleId,
  formatType,
  healthDescription,
  healthPill,
  pillHtml,
  ruleLabels,
  scoreToHealthKey,
  truncate,
  unique
}
