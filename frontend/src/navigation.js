import { createContext } from 'react'

/**
 * Lets any component open another page, for example an article's event:
 *
 *   const navigate = useContext(NavigationContext)
 *   navigate('stories', { name: 'event', eventId: 12 })
 *
 * App.jsx provides it. It is null when a component is rendered on its own
 * (for example in a test); components then hide their "open" buttons.
 *
 * @type {React.Context<null | ((tab: string, params?: Object | null) => void)>}
 */
export const NavigationContext = createContext(null)
