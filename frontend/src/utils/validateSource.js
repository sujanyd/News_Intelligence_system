/**
 * Checks the "Add source" form before it is sent.
 *
 * @param {{ name: string, baseUrl: string }} form - What the user typed
 * @returns {{ name?: string, baseUrl?: string }} error messages.
 *   An empty object {} means everything is fine.
 */
export function validateSourceForm({ name, baseUrl }) {
  const errors = {}

  if (name.trim() === '') {
    errors.name = 'Source name is required.'
  } else if (name.trim().length > 255) {
    errors.name = 'Source name must be 255 characters or fewer.'
  }

  const url = baseUrl.trim()
  if (url === '') {
    errors.baseUrl = 'Base URL is required.'
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    errors.baseUrl = 'Base URL must start with http:// or https://'
  } else if (url.length > 512) {
    errors.baseUrl = 'Base URL must be 512 characters or fewer.'
  }

  return errors
}
