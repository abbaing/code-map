import { els } from '#viewer/viewer-state.js'

const spinnerSvg = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" class="btn-spin">
  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"
    stroke-dasharray="20 12" stroke-linecap="round"/>
</svg>`
let toastTimer = null

export function buttonBusy(button) {
  button.disabled = true
  button._savedHTML = button.innerHTML
  button.innerHTML = spinnerSvg
}

export function buttonIdle(button) {
  button.disabled = false
  button.innerHTML = button._savedHTML ?? button.innerHTML
}

export function showToast(message, variant = 'success') {
  window.clearTimeout(toastTimer)
  els.toast.textContent = message
  els.toast.classList.toggle('error', variant === 'error')
  els.toast.classList.add('open')
  toastTimer = window.setTimeout(() => els.toast.classList.remove('open'), 4200)
}
