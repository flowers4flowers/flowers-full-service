// next/utility/driveDownload.js

export function isGoogleDriveUrl(url) {
  try {
    return new URL(url).hostname === "drive.google.com";
  } catch {
    return false;
  }
}

export function driveFileIdFrom(url) {
  const fileMatch = url.match(/\/file\/d\/([\w-]+)\//);

  if (fileMatch) {
    return fileMatch[1];
  }

  const idMatch = url.match(/[?&]id=([\w-]+)/);

  return idMatch ? idMatch[1] : null;
}

export function buildDriveDownloadUrl(id) {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export function parseDriveConfirmForm(html) {
  const inputPattern = /<input\s+type="hidden"\s+name="([^"]+)"\s+value="([^"]*)"/g;
  const params = {};
  let match;

  while ((match = inputPattern.exec(html)) !== null) {
    params[match[1]] = match[2];
  }

  return params.id ? params : null;
}

export function buildDriveUserContentUrl(params) {
  return `https://drive.usercontent.google.com/download?${new URLSearchParams(params).toString()}`;
}
