// next/app/(portal)/portal/[token]/page.js

import { notFound } from "next/navigation";
import { getDeckPages } from "../../../../queries/deckQuery";
import { resolveDeckAccess } from "../../../../utility/deckAccess";
import PasswordGate from "./PasswordGate";
import DeckNav from "../../../../components/DeckNav";
import DeckCover from "../../../../components/DeckCover";

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

  const pages = await getDeckPages(params.token);
  const nextHref = pages.length > 0 ? `/portal/${params.token}/1` : null;

  return (
    <DeckNav prevHref={null} nextHref={nextHref} counter={null}>
      <DeckCover title={meta.title} client={meta.client} intro={meta.intro} />
    </DeckNav>
  );
}
