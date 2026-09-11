// next/app/(portal)/portal/[token]/pdf/route.js

import { resolveDeckAccess } from "../../../../../utility/deckAccess";
import {
  isGoogleDriveUrl,
  driveFileIdFrom,
  buildDriveDownloadUrl,
  parseDriveConfirmForm,
  buildDriveUserContentUrl,
} from "../../../../../utility/driveDownload";
import {
  sanitiseFilename,
  sanitiseFilenameAscii,
} from "../../../../../utility/filename";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { status, meta } = await resolveDeckAccess(params.token);

  if (status !== "unlocked") {
    return new Response(null, { status: status === "notfound" ? 404 : 401 });
  }

  if (!meta.pdfUrl) {
    return new Response(null, { status: 404 });
  }

  const driveId = isGoogleDriveUrl(meta.pdfUrl)
    ? driveFileIdFrom(meta.pdfUrl)
    : null;
  const target = driveId ? buildDriveDownloadUrl(driveId) : meta.pdfUrl;

  let upstream;

  try {
    upstream = await fetch(target);
  } catch {
    return new Response("Could not reach the file host.", { status: 502 });
  }

  if (
    driveId &&
    upstream.headers.get("content-type")?.startsWith("text/html")
  ) {
    const html = await upstream.text();
    const formParams = parseDriveConfirmForm(html);

    if (!formParams) {
      return new Response(
        "This file could not be downloaded from Google Drive. Try a different host or check the file's sharing settings.",
        { status: 502 }
      );
    }

    upstream = await fetch(buildDriveUserContentUrl(formParams));

    if (upstream.headers.get("content-type")?.startsWith("text/html")) {
      return new Response(
        "This file could not be downloaded from Google Drive. Try a different host or check the file's sharing settings.",
        { status: 502 }
      );
    }
  }

  const asciiName = sanitiseFilenameAscii(meta.title);
  const fullName = sanitiseFilename(meta.title);

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fullName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
