function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function pillHtml(className, text, title = '') {
  const titleAttr = title ? ` title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"` : ''
  return `<span class="text-[11px] font-semibold rounded px-2 py-0.5 ${className}"${titleAttr}>${escapeHtml(text)}</span>`
}

function capitalize(value) {
  if (!value) return ''
  return value[0].toUpperCase() + value.slice(1)
}

function fillSelect(select, values, allLabel, format = value => value) {
  select.innerHTML = values
    .map(value => `<option value="${escapeHtml(value)}">${value === 'all' ? allLabel : escapeHtml(format(value))}</option>`)
    .join('')
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function formatType(type) {
  if (!type) return ''
  return typeLabels[type] ?? String(type)
    .split('-')
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

function formatModule(mod) {
  if (!mod) return ''
  return moduleLabels[mod] ?? String(mod)
    .split('-')
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

function formatLayer(layer) {
  if (!layer) return ''
  return layerLabels[layer] ?? String(layer)
    .split('-')
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

const ruleLabels = {
  'frontend.relative-imports':      'Relative imports',
  'frontend.component-max-lines':   'Component too long',
  'frontend.no-any':                'No any type',
  'frontend.component-folder-entry':'Folder entry missing',
  'frontend.main-no-orchestration': 'Main component too complex',
  'frontend.route-file-shape':      'Route file shape',
  'technology.typescript.relative-imports': 'Relative imports',
  'technology.typescript.no-any': 'No any type',
  'framework.react.component-max-lines': 'Component too long',
  'framework.react.route-file-shape': 'Route file shape',
}

function formatRuleId(ruleId) {
  if (!ruleId) return ''
  if (ruleLabels[ruleId]) return ruleLabels[ruleId]
  return ruleId
    .replace(/^[a-z]+\./, '')
    .split(/[-.]/)
    .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function debounce(fn, ms) {
  let timer
  return (...args) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), ms)
  }
}

function scoreToHealthKey(score) {
  if (score >= 9.5) return 'excellent'
  if (score >= 8.5) return 'very-good'
  if (score >= 7.5) return 'good'
  if (score >= 6.5) return 'fair'
  if (score >= 5)   return 'low'
  return 'critical'
}

function healthPill(score) {
  if (!score) return { label: 'N/A', className: 'bg-gray-50 text-gray-600 border border-gray-100', description: healthDescription('n/a') }
  if (score >= 9.5) return { label: 'Excellent', className: 'bg-emerald-50 text-emerald-700 border border-emerald-100', description: healthDescription('excellent') }
  if (score >= 8.5) return { label: 'Very good', className: 'bg-emerald-50 text-emerald-700 border border-emerald-100', description: healthDescription('very-good') }
  if (score >= 7.5) return { label: 'Good', className: 'bg-blue-50 text-blue-700 border border-blue-100', description: healthDescription('good') }
  if (score >= 6.5) return { label: 'Fair', className: 'bg-amber-50 text-amber-700 border border-amber-100', description: healthDescription('fair') }
  if (score >= 5) return { label: 'Low', className: 'bg-orange-50 text-orange-700 border border-orange-100', description: healthDescription('low') }
  return { label: 'Critical', className: 'bg-red-50 text-red-700 border border-red-100', description: healthDescription('critical') }
}

function healthDescription(key) {
  const descriptions = {
    excellent: 'Very strong score. The files are small, focused, and have few outside links.',
    'very-good': 'Strong score. The module looks clear and easy to change.',
    good: 'Good score. There may be small issues, but the module is mostly healthy.',
    fair: 'Medium score. Check this module before making big changes.',
    low: 'Low score. This module likely has too many links or mixed responsibilities.',
    critical: 'Very low score. Review this module carefully before changing it.',
    'n/a': 'No score is available for this module.'
  }
  return descriptions[key] ?? descriptions['n/a']
}
