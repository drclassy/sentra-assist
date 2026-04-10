// Sentra Assist — sound utility
export function playSound(filename: string): void {
  try {
    // WXT's PublicPath only covers HTML entry points; sound assets are valid at runtime
    const url = browser.runtime.getURL(
      `assets/sounds/${filename}` as unknown as Parameters<typeof browser.runtime.getURL>[0]
    )
    const audio = new Audio(url)
    audio.play().catch(() => {})
  } catch {
    // ignore — non-critical
  }
}
