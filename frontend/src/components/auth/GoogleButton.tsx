interface GoogleButtonProps {
  onClick: () => void
  loading: boolean
  disabled: boolean
  label?: string
}

// "Continue with Google" button. The click handler calls Firebase (see authService).
export function GoogleButton({ onClick, loading, disabled, label = 'Continue with Google' }: GoogleButtonProps) {
  return (
    <button type="button" className="btn btn-google" onClick={onClick} disabled={disabled}>
      {loading ? (
        <>
          <span className="spinner spinner-dark" aria-hidden="true" />
          Opening Google…
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}
