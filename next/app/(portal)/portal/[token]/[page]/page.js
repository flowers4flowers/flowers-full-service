// next/app/(portal)/portal/[token]/[page]/page.js

import { notFound, redirect } from "next/navigation";
import { getDeckPages } from "../../../../../queries/deckQuery";
import { resolveDeckAccess } from "../../../../../utility/deckAccess";
import DeckNav from "../../../../../components/DeckNav";
import DeckPage from "../../../../../components/DeckPage";

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
  const n = Number(params.page);

  if (!Number.isInteger(n) || n < 1) {
    notFound();
  }

  const { status } = await resolveDeckAccess(params.token);

  if (status === "notfound") {
    notFound();
  }

  if (status !== "unlocked") {
    redirect(`/portal/${params.token}`);
  }

  const pages = await getDeckPages(params.token);

  if (n > pages.length) {
    notFound();
  }

  const page = pages[n - 1];

  const prevHref =
    n === 1
      ? `/portal/${params.token}`
      : `/portal/${params.token}/${n - 1}`;
  const nextHref =
    n < pages.length ? `/portal/${params.token}/${n + 1}` : null;
  const counter = `${n} / ${pages.length}`;

  return (
    <DeckNav prevHref={prevHref} nextHref={nextHref} counter={counter}>
      <DeckPage layout={page.layout} media={page.media} blocks={page.blocks} />
    </DeckNav>
  );
}
