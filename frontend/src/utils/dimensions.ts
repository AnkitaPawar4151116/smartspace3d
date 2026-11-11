// Small helpers for showing sizes. All stored sizes are in centimetres.

function metres(cm: number): string {
  return String(Number((cm / 100).toFixed(2)))
}

// "20 × 12 × 4 m", or null when the size is not known.
export function formatRoomSize(
  lengthCm: number | null,
  widthCm: number | null,
  heightCm: number | null,
): string | null {
  if (lengthCm === null || widthCm === null || heightCm === null) return null
  return `${metres(lengthCm)} × ${metres(widthCm)} × ${metres(heightCm)} m`
}

// Room volume in cubic metres, or null when the size is not known.
export function roomVolumeM3(
  lengthCm: number | null,
  widthCm: number | null,
  heightCm: number | null,
): number | null {
  if (lengthCm === null || widthCm === null || heightCm === null) return null
  return (lengthCm * widthCm * heightCm) / 1_000_000
}

export function formatCartonSize(lengthCm: number, widthCm: number, heightCm: number): string {
  return `${lengthCm} × ${widthCm} × ${heightCm} cm`
}
