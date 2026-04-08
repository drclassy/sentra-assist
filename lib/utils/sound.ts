// Sentra Assist — sound utility
export function playSound(filename: string): void {
  try {
    const url = browser.runtime.getURL(`assets/sounds/${filename}`)
    const audio = new Audio(url)
    audio.play().catch(() => {})
  } catch {
    // ignore — non-critical
  }
}
