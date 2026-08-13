import { els, state } from '#viewer/viewer-state.js'
import { escapeHtml } from '#viewer/viewer-utils.js'

export function populateSettingsTab() {
  const projectMap = state.graph?.projectMap
  if (!projectMap) {
    return
  }
  renderModuleLabels(projectMap)
  renderTypeColors(projectMap)
  renderRules(projectMap)
  bindColorInputs()
}

export function normalizeHexColor(value) {
  const color = String(value ?? '')
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#64748b'
}

function renderModuleLabels(projectMap) {
  els.settingsModulesBody.innerHTML = Object.entries(projectMap.modules?.labels ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([id, label]) => `
      <tr><td class="px-3 py-2 text-gray-400 font-mono text-xs">${escapeHtml(id)}</td>
        <td class="px-3 py-2"><input data-module="${escapeHtml(id)}" type="text" value="${escapeHtml(label)}"
          class="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400" /></td>
      </tr>`
    )
    .join('')
}

function renderTypeColors(projectMap) {
  const labels = projectMap.types?.labels ?? {}
  els.settingsTypesBody.innerHTML = Object.entries(projectMap.types?.colors ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, color]) => typeColorRow(id, color, labels[id] ?? id))
    .join('')
}

function typeColorRow(id, color, label) {
  const safeColor = normalizeHexColor(color)
  return `
      <tr><td class="px-3 py-2 text-sm">
          <span class="inline-block w-3 h-3 rounded-sm mr-2 align-middle" style="background:${safeColor}"></span>
          ${escapeHtml(label)}</td>
        <td class="px-3 py-2"><div class="flex items-center gap-2">
            <input data-type-color="${escapeHtml(id)}" type="color" value="${safeColor}"
              class="w-8 h-7 rounded cursor-pointer border border-gray-200 p-0.5" />
            <input data-type-hex="${escapeHtml(id)}" type="text" value="${safeColor}"
              class="w-24 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-400" />
          </div></td></tr>`
}

function renderRules(projectMap) {
  const enabled = new Set(projectMap.rules?.enabled ?? [])
  els.settingsRulesBody.innerHTML = collectAllRuleIds(projectMap)
    .map(
      (id) => `
      <label class="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
        <input data-rule="${escapeHtml(id)}" type="checkbox" ${enabled.has(id) ? 'checked' : ''} class="accent-blue-600" />
        <span class="text-sm font-mono text-gray-700">${escapeHtml(id)}</span>
      </label>`
    )
    .join('')
}

function collectAllRuleIds(projectMap) {
  const ids = new Set(projectMap.rules?.enabled ?? [])
  for (const suppression of projectMap.rules?.suppressions ?? []) {
    if (suppression.rule) {
      ids.add(suppression.rule)
    }
  }
  return [...ids].sort()
}

function bindColorInputs() {
  const hexInputs = new Map(
    [...els.settingsTypesBody.querySelectorAll('input[data-type-hex]')].map((input) => [input.dataset.typeHex, input])
  )
  els.settingsTypesBody.querySelectorAll('input[data-type-color]').forEach((picker) => {
    const hex = hexInputs.get(picker.dataset.typeColor)
    picker.addEventListener('input', () => {
      if (hex) {
        hex.value = picker.value
      }
    })
    if (hex) {
      hex.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) {
          picker.value = hex.value
        }
      })
    }
  })
}
