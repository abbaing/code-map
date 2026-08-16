export function bindSubmapNavigation({ elements, operations }, changeView) {
  elements.submapList.addEventListener('click', async (event) => {
    const row = event.target.closest('[data-submap-uid]')
    if (row && (await operations.openSubmap(row.dataset.submapUid))) {
      changeView('graph')
    }
  })
}
