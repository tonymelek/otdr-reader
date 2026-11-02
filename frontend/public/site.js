document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header')
  const toggleBtn = document.getElementById('menu-toggle')
  const mobileMenu = document.getElementById('mobile-menu')
  const hamburgerIcon = document.getElementById('hamburger-icon')
  const closeIcon = document.getElementById('close-icon')

  if (!toggleBtn || !mobileMenu) return

  function isOpen() {
    return toggleBtn.getAttribute('aria-expanded') === 'true'
  }

  function setOpen(open) {
    toggleBtn.setAttribute('aria-expanded', String(open))
    mobileMenu.classList.toggle('is-open', open)
    hamburgerIcon?.classList.toggle('hidden', open)
    closeIcon?.classList.toggle('hidden', !open)
  }

  toggleBtn.addEventListener('click', () => {
    setOpen(!isOpen())
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return
    setOpen(false)
    toggleBtn.focus()
  })

  document.addEventListener('pointerdown', (event) => {
    if (!isOpen()) return
    if (header?.contains(event.target)) return
    setOpen(false)
  })
})
