// next/app/(portal)/portal/[token]/page.js

import { notFound } from "next/navigation";
import nextDynamic from "next/dynamic";
import { resolveDeckAccess } from "../../../../utility/deckAccess";
import PasswordGate from "./PasswordGate";
import DeckEmbed from "../../../../components/DeckEmbed";
import DeckSessionWatcher from "../../../../components/DeckSessionWatcher";

const DeckPdfViewer = nextDynamic(
  () => import("../../../../components/DeckPdfViewer"),
  { ssr: false }
);

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return {
    title: "FLOWERS — Client Deck",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function Page({ params }) {
  const { status, meta } = await resolveDeckAccess(params.token);

  if (status === "notfound") {
    notFound();
  }

  if (status === "expired") {
    return (
      <div className="px-6 max-w-[420px] mx-auto pt-24">
        <p className="font-secondary text-md">This link has expired.</p>
      </div>
    );
  }

  if (status === "locked") {
    return <PasswordGate token={params.token} deckTitle={meta.title} />;
  }

  if (meta.contentType === "figma" && meta.figmaUrl) {
    return (
      <DeckSessionWatcher token={params.token}>
        <DeckEmbed figmaUrl={meta.figmaUrl} />
      </DeckSessionWatcher>
    );
  }

  if (meta.contentType === "pdf" && meta.pdfUrl) {
    return (
      <DeckSessionWatcher token={params.token}>
        <DeckPdfViewer pdfUrl={`/portal/${params.token}/pdf-file`} />
      </DeckSessionWatcher>
    );
  }

  return (
    <DeckSessionWatcher token={params.token}>
      <div className="px-6 max-w-[420px] mx-auto pt-24">
        <p className="font-secondary text-md">This deck is not ready yet.</p>
      </div>
    </DeckSessionWatcher>
  );
}
