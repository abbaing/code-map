export function createElement(overrides = {}) {
  return {
    classList: createClassList(),
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    querySelectorAll: () => [],
    ...overrides
  }
}

export function createCriticalViewerElements() {
  const element = createElement
  return {
    overviewScroll: element(),
    moduleDetail: element(),
    search: element(),
    overviewPane: element(),
    findingsPane: element(),
    settingsPane: element(),
    submapsPane: element(),
    canvasWrap: element(),
    tabOverview: element(),
    tabGraph: element(),
    tabDomain: element(),
    tabFindings: element(),
    tabSettings: element(),
    tabSubmaps: element(),
    viewTitle: element(),
    viewSubtitle: element(),
    settingsExportBtn: element(),
    settingsImportBtn: element(),
    settingsImportFile: element(),
    settingsModulesBody: element(),
    settingsTypesBody: element(),
    settingsRulesBody: element(),
    toast: element(),
    graphSearch: element(),
    orphansOnly: element({ checked: false }),
    uncoveredOnly: element({ checked: false }),
    reviewOnly: element({ checked: false }),
    findingsOnly: element({ checked: false }),
    hideAuxiliary: element({ checked: false })
  }
}

function createClassList() {
  return {
    values: new Set(),
    add(name) {
      this.values.add(name)
    },
    remove(name) {
      this.values.delete(name)
    },
    toggle(name, active) {
      active ? this.values.add(name) : this.values.delete(name)
    },
    contains(name) {
      return this.values.has(name)
    }
  }
}
