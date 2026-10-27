import React, { useState } from 'react'
import FormField from './FormField'
import AlertMessage from './AlertMessage'
import { createSource } from '../api/newsApi'
import { validateSourceForm } from '../utils/validateSource'

/**
 * AddSourceForm Component
 *
 * A small form to add a new news source.
 * Steps when the user clicks "Add source":
 *   1. Check the fields (show red messages if something is wrong).
 *   2. Send the new source to the API.
 *   3. Show a green success message, or a red error message.
 *
 * @param {Object} props
 * @param {(source: Object) => void} props.onSourceAdded - Called with the saved source
 */
export function AddSourceForm({ onSourceAdded }) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    // Stop the browser from reloading the page
    event.preventDefault()
    setSuccessMessage('')
    setErrorMessage('')

    // Step 1: check the fields
    const errors = validateSourceForm({ name, baseUrl })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    // Step 2: send to the API
    setIsSaving(true)
    try {
      const savedSource = await createSource({ name: name.trim(), base_url: baseUrl.trim() })
      onSourceAdded(savedSource)

      // Step 3: success, so clear the form
      setSuccessMessage(`"${savedSource.name}" was added.`)
      setName('')
      setBaseUrl('')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="source-form" onSubmit={handleSubmit} noValidate>
      {successMessage && <AlertMessage type="success" message={successMessage} />}
      {errorMessage && (
        <AlertMessage type="error" title="Could not add source." message={errorMessage} />
      )}

      <FormField
        id="source-name"
        label="Source name"
        value={name}
        onChange={setName}
        error={fieldErrors.name}
        placeholder="e.g. Daily Ledger"
        required
      />

      <FormField
        id="source-base-url"
        label="Base URL"
        type="url"
        value={baseUrl}
        onChange={setBaseUrl}
        error={fieldErrors.baseUrl}
        placeholder="https://example.com"
        required
      />

      <button type="submit" className="btn btn-primary" disabled={isSaving}>
        {isSaving ? 'Adding...' : 'Add source'}
      </button>
    </form>
  )
}

export default AddSourceForm
