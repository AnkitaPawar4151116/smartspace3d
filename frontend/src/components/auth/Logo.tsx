// SmartSpace 3D brand mark: a little cube plus the product name.
export function Logo() {
  return (
    <div className="logo">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l9 5v10l-9 5-9-5V7z" />
          <path d="M12 22V12M3 7l9 5 9-5" />
        </svg>
      </span>
      <span className="logo-text">
        SmartSpace <strong>3D</strong>
      </span>
    </div>
  )
}
