// Each function returns an error message, or null when the value is fine.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value: string): string | null {
  const email = value.trim()
  if (!email) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.'
  return null
}

export function validateFullName(value: string): string | null {
  if (!value.trim()) return 'Enter your full name.'
  return null
}

export function validateNewPassword(value: string): string | null {
  if (!value) return 'Create a password.'
  if (value.length < 8) return 'Password must be at least 8 characters.'
  return null
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Confirm your password.'
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

// For number fields typed as text (sizes, weights, counts).
export function validateNumberInRange(
  value: string,
  label: string,
  min: number,
  max: number,
  wholeNumber = false,
): string | null {
  if (!value.trim()) return `Enter the ${label}.`
  const number = Number(value)
  if (!Number.isFinite(number)) return `The ${label} must be a number.`
  if (wholeNumber && !Number.isInteger(number)) return `The ${label} must be a whole number.`
  if (number < min || number > max) return `The ${label} must be between ${min} and ${max}.`
  return null
}
