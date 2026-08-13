import { loadGraph, requireGraphGateway } from '#viewer/viewer-data.js'
import { buttonBusy, buttonIdle, showToast } from '#viewer/viewer-feedback.js'
import { populateSettingsTab } from '#viewer/viewer-settings-renderer.js'
import { els, state } from '#viewer/viewer-state.js'

export function exportProjectMap() {
  els.settingsExportBtn.disabled = true
  try {
    if (!state.graph.projectMap) {
      throw new Error('No project map loaded')
    }
    const projectMap = { ...state.graph.projectMap }
    delete projectMap.configPath
    downloadProjectMap(projectMap)
    showToast('Config exported')
  } catch (error) {
    showToast(`Export failed: ${error.message}`, 'error')
  } finally {
    window.setTimeout(() => {
      els.settingsExportBtn.disabled = false
    }, 250)
  }
}

export function importProjectMap(file) {
  els.settingsImportBtn.classList.add('disabled')
  const reader = new FileReader()
  reader.onload = async () => importProjectMapText(reader.result)
  reader.onerror = () => resetImport('Failed to read config file')
  reader.readAsText(file)
}

export async function saveConfig() {
  buttonBusy(els.settingsSaveBtn)
  try {
    const projectMap = collectProjectMap()
    const result = await requireGraphGateway().updateProjectMap(projectMap)
    if (!result.ok) {
      throw new Error(result.error)
    }
    await loadGraph()
    populateSettingsTab()
    els.status.textContent = 'Config saved'
    showToast(`Saved: ${result.stats.nodes} nodes, ${result.stats.findings} findings`)
  } catch (error) {
    showToast(`Save failed: ${error.message}`, 'error')
  } finally {
    buttonIdle(els.settingsSaveBtn)
  }
}

async function importProjectMapText(text) {
  try {
    const result = await requireGraphGateway().updateProjectMap(JSON.parse(String(text)))
    if (!result.ok) {
      throw new Error(result.error)
    }
    await loadGraph()
    populateSettingsTab()
    els.status.textContent = 'Config imported'
    showToast(`Config imported: ${result.stats.nodes} nodes`)
  } catch (error) {
    showToast(`Config import failed: ${error.message}`, 'error')
  } finally {
    resetImport()
  }
}

function collectProjectMap() {
  const projectMap = structuredClone(state.graph.projectMap)
  delete projectMap.configPath
  projectMap.modules ??= {}
  projectMap.modules.labels ??= {}
  for (const input of els.settingsModulesBody.querySelectorAll('input[data-module]')) {
    projectMap.modules.labels[input.dataset.module] = input.value.trim() || input.dataset.module
  }
  projectMap.types ??= {}
  projectMap.types.colors ??= {}
  for (const input of els.settingsTypesBody.querySelectorAll('input[data-type-hex]')) {
    if (/^#[0-9a-fA-F]{6}$/.test(input.value)) {
      projectMap.types.colors[input.dataset.typeHex] = input.value
    }
  }
  projectMap.rules ??= {}
  projectMap.rules.enabled = [...els.settingsRulesBody.querySelectorAll('input[data-rule]')]
    .filter((input) => input.checked)
    .map((input) => input.dataset.rule)
  return projectMap
}

function resetImport(error) {
  if (error) {
    showToast(error, 'error')
  }
  els.settingsImportBtn.classList.remove('disabled')
  els.settingsImportFile.value = ''
}

function downloadProjectMap(projectMap) {
  const blob = new Blob([JSON.stringify(projectMap, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `project-map-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
