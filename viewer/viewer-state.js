const NODE_RENDER_LIMIT = 400
const DOMAIN_RENDER_LIMIT = 1200

const state = {
  graph: null,
  filteredNodes: [],
  selectedId: null,
  selectedTypes: new Set(),
  selectedHealth: new Set(['excellent', 'very-good', 'good', 'fair', 'low', 'critical']),
  zoom: 1,
  panX: 0,
  panY: 0,
  dragMoved: false,
  suppressOutsideReset: false,
  view: 'overview',
  activeModule: null
}

const moduleLabels = {}
const layerOrder = []
const layerLabels = {}
const typeLabels = {}
const colors = {}

const els = {
  meta: document.getElementById('meta'),
  metaPill: document.getElementById('metaPill'),
  statsPopover: document.getElementById('statsPopover'),
  // overview
  overviewPane: document.getElementById('overviewPane'),
  overviewScroll: document.getElementById('overviewScroll'),
  search: document.getElementById('search'),
healthChecks: document.getElementById('healthChecks'),
  filterBtn: document.getElementById('filterBtn'),
  filterPanel: document.getElementById('filterPanel'),
  // findings
  findingsPane: document.getElementById('findingsPane'),
  findingsSearch: document.getElementById('findingsSearch'),
  findingsSeverity: document.getElementById('findingsSeverity'),
  findingsRule: document.getElementById('findingsRule'),
  findingsModule: document.getElementById('findingsModule'),
  findingsTable: document.getElementById('findingsTable'),
  // graph/domain
  canvasWrap: document.getElementById('canvasWrap'),
  graphFilterBtn: document.getElementById('graphFilterBtn'),
  graphFilterPanel: document.getElementById('graphFilterPanel'),
typeChecks: document.getElementById('typeChecks'),
  orphanCount: document.getElementById('orphanCount'),
  orphansOnly: document.getElementById('orphansOnly'),
  uncoveredOnly: document.getElementById('uncoveredOnly'),
  uncoveredCount: document.getElementById('uncoveredCount'),
  reviewOnly: document.getElementById('reviewOnly'),
  reviewCount: document.getElementById('reviewCount'),
  findingsOnly: document.getElementById('findingsOnly'),
  findingsCount: document.getElementById('findingsCount'),
  hideAuxiliary: document.getElementById('hideAuxiliary'),
  moduleDetail: document.getElementById('moduleDetail'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  zoomValue: document.getElementById('zoomValue'),
  // shared
  graph: document.getElementById('graph'),
  popover: document.getElementById('popover'),
  status: document.getElementById('status'),
  nodeLimitBanner: document.getElementById('nodeLimitBanner'),
  detail: document.getElementById('detail'),
  toast: document.getElementById('toast'),
  refreshBtn: document.getElementById('refreshBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importLabel: document.getElementById('importLabel'),
  importFile: document.getElementById('importFile'),
  actionsBtn: document.getElementById('actionsBtn'),
  actionsMenu: document.getElementById('actionsMenu'),
  tabOverview: document.getElementById('tabOverview'),
  tabGraph: document.getElementById('tabGraph'),
  tabDomain: document.getElementById('tabDomain'),
  tabFindings: document.getElementById('tabFindings'),
  tabSettings: document.getElementById('tabSettings'),
  // settings pane
  settingsPane: document.getElementById('settingsPane'),
  settingsModulesBody: document.getElementById('settingsModulesBody'),
  settingsTypesBody: document.getElementById('settingsTypesBody'),
  settingsRulesBody: document.getElementById('settingsRulesBody'),
  settingsSaveBtn: document.getElementById('settingsSaveBtn'),
  settingsImportBtn: document.getElementById('settingsImportBtn'),
  settingsExportBtn: document.getElementById('settingsExportBtn'),
  settingsImportFile: document.getElementById('settingsImportFile'),
}
