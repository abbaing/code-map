const SPINNER_SVG = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="btn-spin"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="20 12" stroke-linecap="round"/></svg>`

function btnBusy(btn) {
  btn.disabled = true
  btn._savedHTML = btn.innerHTML
  btn.innerHTML = SPINNER_SVG
}

function btnIdle(btn) {
  btn.disabled = false
  btn.innerHTML = btn._savedHTML ?? btn.innerHTML
}

async function refreshGraph() {
  btnBusy(els.refreshBtn)
  els.status.textContent = 'Refreshing...'
  try {
    const response = await fetch('/api/scan', { method: 'POST' })
    const result = await response.json()
    if (!result.ok) throw new Error(result.error)
    await loadGraph()
    els.status.textContent = 'Map updated'
    showToast(`Map updated: ${result.stats.nodes.toLocaleString()} nodes`, 'success')
  } catch (error) {
    els.status.textContent = `Error: ${error.message}`
    showToast(`Refresh failed: ${error.message}`, 'error')
  } finally {
    btnIdle(els.refreshBtn)
  }
}

let toastTimer = null

function showToast(message, variant = 'success') {
  window.clearTimeout(toastTimer)
  els.toast.textContent = message
  els.toast.classList.toggle('error', variant === 'error')
  els.toast.classList.add('open')
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove('open')
  }, 4200)
}

function exportGraph() {
  els.exportBtn.disabled = true
  try {
    const blob = new Blob([JSON.stringify(state.graph, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `code-map-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Graph exported')
  } catch (error) {
    showToast(`Export failed: ${error.message}`, 'error')
  } finally {
    window.setTimeout(() => { els.exportBtn.disabled = false }, 250)
  }
}

function exportProjectMap() {
  els.settingsExportBtn.disabled = true
  try {
    if (!state.graph.projectMap) throw new Error('No project map loaded')
    const projectMap = { ...state.graph.projectMap }
    delete projectMap.configPath
    const blob = new Blob([JSON.stringify(projectMap, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `project-map-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Config exported')
  } catch (error) {
    showToast(`Export failed: ${error.message}`, 'error')
  } finally {
    window.setTimeout(() => { els.settingsExportBtn.disabled = false }, 250)
  }
}

function importGraph(file) {
  els.importLabel.classList.add('disabled')
  const reader = new FileReader()
  reader.onload = () => {
    try {
      state.graph = JSON.parse(String(reader.result))
      initializeFilters()
      applyFilters()
      els.status.textContent = 'Graph imported'
      showToast(`Imported: ${state.graph.stats.nodes} nodes, ${state.graph.stats.edges} edges`)
    } catch (error) {
      showToast(`Import failed: ${error.message}`, 'error')
    } finally {
      els.importLabel.classList.remove('disabled')
      els.importFile.value = ''
    }
  }
  reader.onerror = () => {
    showToast('Failed to read file', 'error')
    els.importLabel.classList.remove('disabled')
    els.importFile.value = ''
  }
  reader.readAsText(file)
}

function importProjectMap(file) {
  els.settingsImportBtn.classList.add('disabled')
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const projectMap = JSON.parse(String(reader.result))
      const response = await fetch('/api/project-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectMap)
      })
      const result = await response.json()
      if (!result.ok) throw new Error(result.error)
      await loadGraph()
      populateSettingsTab()
      els.status.textContent = 'Config imported'
      showToast(`Config imported: ${result.stats.nodes} nodes`)
    } catch (error) {
      showToast(`Config import failed: ${error.message}`, 'error')
    } finally {
      els.settingsImportBtn.classList.remove('disabled')
      els.settingsImportFile.value = ''
    }
  }
  reader.onerror = () => {
    showToast('Failed to read config file', 'error')
    els.settingsImportBtn.classList.remove('disabled')
    els.settingsImportFile.value = ''
  }
  reader.readAsText(file)
}

function populateSettingsTab() {
  const pm = state.graph?.projectMap
  if (!pm) return

  // Module Labels
  const labels = pm.modules?.labels ?? {}
  els.settingsModulesBody.innerHTML = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, label]) => `
      <tr>
        <td class="px-3 py-2 text-gray-400 font-mono text-xs">${id}</td>
        <td class="px-3 py-2">
          <input data-module="${id}" type="text" value="${label.replace(/"/g, '&quot;')}"
            class="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400" />
        </td>
      </tr>`).join('')

  // Type Colors
  const typeColors = pm.types?.colors ?? {}
  const typeLabelsMap = pm.types?.labels ?? {}
  els.settingsTypesBody.innerHTML = Object.entries(typeColors)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, color]) => `
      <tr>
        <td class="px-3 py-2 text-sm">
          <span class="inline-block w-3 h-3 rounded-sm mr-2 align-middle" style="background:${color}"></span>
          ${typeLabelsMap[id] ?? id}
        </td>
        <td class="px-3 py-2">
          <div class="flex items-center gap-2">
            <input data-type-color="${id}" type="color" value="${color}"
              class="w-8 h-7 rounded cursor-pointer border border-gray-200 p-0.5" />
            <input data-type-hex="${id}" type="text" value="${color}"
              class="w-24 border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-400" />
          </div>
        </td>
      </tr>`).join('')

  // Rules
  const enabledRules = new Set(pm.rules?.enabled ?? [])
  const allRules = collectAllRuleIds(pm)
  els.settingsRulesBody.innerHTML = allRules
    .map(id => `
      <label class="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
        <input data-rule="${id}" type="checkbox" ${enabledRules.has(id) ? 'checked' : ''} class="accent-blue-600" />
        <span class="text-sm font-mono text-gray-700">${id}</span>
      </label>`).join('')

  // Sync color picker <-> hex text input
  els.settingsTypesBody.querySelectorAll('input[data-type-color]').forEach(picker => {
    const id = picker.dataset.typeColor
    const hex = els.settingsTypesBody.querySelector(`input[data-type-hex="${id}"]`)
    picker.addEventListener('input', () => { if (hex) hex.value = picker.value })
    if (hex) hex.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value
    })
  })
}

function collectAllRuleIds(pm) {
  const ids = new Set(pm.rules?.enabled ?? [])
  // add any known rule ids from suppression list too
  ;(pm.rules?.suppressions ?? []).forEach(s => { if (s.rule) ids.add(s.rule) })
  return [...ids].sort()
}

async function saveConfig() {
  btnBusy(els.settingsSaveBtn)
  try {
    const pm = JSON.parse(JSON.stringify(state.graph.projectMap))
    delete pm.configPath

    // Apply module label edits
    els.settingsModulesBody.querySelectorAll('input[data-module]').forEach(input => {
      if (!pm.modules) pm.modules = {}
      if (!pm.modules.labels) pm.modules.labels = {}
      pm.modules.labels[input.dataset.module] = input.value.trim() || input.dataset.module
    })

    // Apply type color edits (use hex text input as source of truth)
    els.settingsTypesBody.querySelectorAll('input[data-type-hex]').forEach(input => {
      if (/^#[0-9a-fA-F]{6}$/.test(input.value)) {
        if (!pm.types) pm.types = {}
        if (!pm.types.colors) pm.types.colors = {}
        pm.types.colors[input.dataset.typeHex] = input.value
      }
    })

    // Apply rules edits
    const enabledRules = []
    els.settingsRulesBody.querySelectorAll('input[data-rule]').forEach(input => {
      if (input.checked) enabledRules.push(input.dataset.rule)
    })
    if (!pm.rules) pm.rules = {}
    pm.rules.enabled = enabledRules

    const response = await fetch('/api/project-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pm)
    })
    const result = await response.json()
    if (!result.ok) throw new Error(result.error)
    await loadGraph()
    populateSettingsTab()
    els.status.textContent = 'Config saved'
    showToast(`Saved: ${result.stats.nodes} nodes, ${result.stats.findings} findings`)
  } catch (error) {
    showToast(`Save failed: ${error.message}`, 'error')
  } finally {
    btnIdle(els.settingsSaveBtn)
  }
}

function applyPan() {
  const svg = els.graph
  const vw = svg.parentElement.clientWidth || 900
  const vh = svg.parentElement.clientHeight || 700
  const vpW = vw / state.zoom
  const vpH = vh / state.zoom
  svg.setAttribute('viewBox', `${state.panX} ${state.panY} ${vpW} ${vpH}`)
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`
}

function setZoom(nextZoom) {
  state.zoom = Math.min(2.5, Math.max(0.2, Number(nextZoom.toFixed(2))))
  applyPan()
}

function resetZoom() {
  state.zoom = 1
  state.panX = 0
  state.panY = 0
  applyPan()
  showToast('Zoom reset')
}

function zoomAt(nextZoom, clientX, clientY) {
  const svg = els.graph
  const previousZoom = state.zoom
  const boundedZoom = Math.min(2.5, Math.max(0.2, Number(nextZoom.toFixed(2))))
  if (boundedZoom === previousZoom) return

  const rect = svg.getBoundingClientRect()
  const mouseX = clientX - rect.left
  const mouseY = clientY - rect.top
  const svgX = state.panX + mouseX / previousZoom
  const svgY = state.panY + mouseY / previousZoom

  state.zoom = boundedZoom
  state.panX = svgX - mouseX / boundedZoom
  state.panY = svgY - mouseY / boundedZoom
  applyPan()
}
