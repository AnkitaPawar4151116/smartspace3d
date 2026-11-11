import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string
  label: string
  error?: string
}

// A labelled input. When there is an error, it is announced to screen readers
// and linked to the input with aria-describedby.
export function TextField({ id, label, error, ...inputProps }: TextFieldProps) {
  const errorId = `${id}-error`

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={error ? 'input input-invalid' : 'input'}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
