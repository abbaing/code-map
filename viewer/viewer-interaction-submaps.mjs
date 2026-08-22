export function bindSubmapNavigation({ elements, operations, document }, changeView) {
  elements.submapList.addEventListener('click', async (event) => {
    const options = event.target.closest('.submap-options')
    closeOtherMenus(elements.submapList, options)
    const deleteButton = event.target.closest('[data-delete-submap-uid]')
    if (deleteButton) {
      deleteButton.disabled = true
      try {
        await operations.deleteSubmap(deleteButton.dataset.deleteSubmapUid)
      } finally {
        deleteButton.disabled = false
        options?.removeAttribute('open')
      }
      return
    }
    const versionButton = event.target.closest('[data-open-submap-uid]')
    if (versionButton) {
      if (await operations.openSubmap(versionButton.dataset.openSubmapUid)) {
        changeView('graph')
      }
      return
    }
    const row = event.target.closest('[data-submap-uid]')
    if (row && (await operations.openSubmap(row.dataset.submapUid))) {
      changeView('graph')
    }
  })
  document?.addEventListener('click', (event) => {
    if (!event.target.closest('.submap-options')) {
      closeOtherMenus(elements.submapList)
    }
  })
}

function closeOtherMenus(list, exception) {
  for (const menu of list.querySelectorAll?.('.submap-options[open]') ?? []) {
    if (menu !== exception) {
      menu.removeAttribute('open')
    }
  }
}
