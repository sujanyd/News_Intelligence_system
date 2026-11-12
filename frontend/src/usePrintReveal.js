import { useEffect } from 'react'

// What gets "printed" when it scrolls into view
const SELECTOR = '.card, .fp-story, .ad-section, .rep-evidence, .cmp-block'

/**
 * Cards, stories and sections are "printed" onto the page as they scroll
 * into view (see .print-armed in refresh.css).
 *
 * Safe by default: nothing is hidden unless the browser has
 * IntersectionObserver and the user has not asked for reduced motion; and
 * anything still waiting after 2.5 seconds is shown anyway.
 *
 * @param {React.RefObject<HTMLElement>} rootRef - the main content area
 */
export function usePrintReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current
    const canAnimate =
      root &&
      typeof window.IntersectionObserver === 'function' &&
      typeof window.MutationObserver === 'function' &&
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!canAnimate) return undefined

    const showAll = () => root.querySelectorAll(SELECTOR).forEach((el) => el.classList.add('is-printed'))
    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-printed')
            intersection.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px' }
    )

    let fallback = 0
    function watchNew() {
      root.querySelectorAll(SELECTOR).forEach((el) => {
        if (!el.dataset.printWatched) {
          el.dataset.printWatched = 'yes'
          intersection.observe(el)
        }
      })
      // Never leave anything hidden for long
      window.clearTimeout(fallback)
      fallback = window.setTimeout(showAll, 2500)
    }

    root.classList.add('print-armed')
    watchNew()
    const mutation = new MutationObserver(watchNew)
    mutation.observe(root, { childList: true, subtree: true })

    return () => {
      mutation.disconnect()
      intersection.disconnect()
      window.clearTimeout(fallback)
      root.classList.remove('print-armed')
    }
  }, [rootRef])
}
