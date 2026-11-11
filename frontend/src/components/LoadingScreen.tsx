// Shown while Firebase checks whether someone is already signed in.
export function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="spinner spinner-lg" aria-hidden="true" />
      <p>Loading SmartSpace 3D…</p>
    </div>
  )
}
