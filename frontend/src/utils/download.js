// Saves text that the backend sent as a file on the user's computer.
// Nothing is made up here: the file holds exactly the backend's text.

// report_format -> file extension and type
export const REPORT_FILE_TYPES = {
  markdown: { extension: 'md', mimeType: 'text/markdown' },
  html: { extension: 'html', mimeType: 'text/html' },
  json: { extension: 'json', mimeType: 'application/json' },
}

/**
 * @param {string} fileName - e.g. "report-3.md"
 * @param {string} text
 * @param {string} mimeType
 */
export function saveTextFile(fileName, text, mimeType) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
