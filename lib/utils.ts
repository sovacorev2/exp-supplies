// Utility functions (not server actions)

export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') +
    '-' +
    Math.random().toString(36).slice(2, 7)
  )
}
