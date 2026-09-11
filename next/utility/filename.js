// next/utility/filename.js

export function sanitiseFilename(title) {
  const cleaned = (title || "").trim().replace(/[\\/:*?"<>|]/g, "-");

  return `${cleaned || "Deck"}.pdf`;
}

export function sanitiseFilenameAscii(title) {
  const cleaned = (title || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");

  return `${cleaned || "Deck"}.pdf`;
}
