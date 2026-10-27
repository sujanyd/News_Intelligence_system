import React from 'react'

/**
 * Reusable FormField Component
 *
 * A label, a text box and (if needed) a red error message under it.
 *
 * @param {Object} props
 * @param {string} props.id - Unique id, links the label to the input
 * @param {string} props.label - Text shown above the input
 * @param {string} props.value - Current text in the input
 * @param {(newValue: string) => void} props.onChange - Called with the new text
 * @param {string} [props.error] - Error message; when set the field turns red
 * @param {string} [props.placeholder]
 * @param {string} [props.type='text'] - Input type, e.g. 'text' or 'url'
 * @param {boolean} [props.required=false] - Shows a * after the label
 */
export function FormField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
  required = false,
}) {
  const errorId = `${id}-error`

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span className="required-mark"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`form-input ${error ? 'has-error' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
