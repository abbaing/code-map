export function bindSubmapNavigation({ elements, operations }, changeView) {
  elements.submapList.addEventListener('click', (event) => {
    const row = event.target.closest('[data-submap-uid]')
    if (row) {
      void operations.previewSubmap(row.dataset.submapUid)
    }
  })
  elements.submapPreviewOpenBtn.addEventListener('click', async () => {
    const uid = elements.submapPreviewOpenBtn.dataset.submapUid
    if (uid && (await operations.openSubmap(uid))) {
      changeView('graph')
    }
  })
  elements.submapPreviewCloseBtn.addEventListener('click', operations.closeSubmapPreview)
  elements.submapPreviewBody.addEventListener('click', (event) => {
    const revision = event.target.closest('[data-submap-revision-uid]')
    if (revision) {
      void operations.previewSubmap(revision.dataset.submapRevisionUid)
    }
  })
}
