// next/app/(portal)/portal/[token]/page.js

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  getDeckForRender,
  getDeckContent,
} from "../../../../queries/deckQuery";
import {
  DECK_SESSION_COOKIE,
  verifyDeckToken,
} from "../../../../utility/deckSession";
import PasswordGate from "./PasswordGate";
import DeckContent from "../../../../components/DeckContent";

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
  const meta = await getDeckForRender(params.token);

  if (!meta) {
    notFound();
  }

  const expired = meta.expiry && new Date(meta.expiry) < new Date();

  if (expired) {
    return (
      <div className="px-6 max-w-[420px] mx-auto pt-24">
        <p className="font-secondary text-md">This link has expired.</p>
      </div>
    );
  }

  const cookieValue = cookies().get(DECK_SESSION_COOKIE)?.value;
  const payload = cookieValue ? await verifyDeckToken(cookieValue) : null;
  const unlocked = payload?.deckId === params.token;

  if (!unlocked) {
    return <PasswordGate token={params.token} deckTitle={meta.title} />;
  }

  const { intro, blocks } = await getDeckContent(params.token);

  return (
    <DeckContent
      layout={meta.layout || "editorial"}
      blocks={blocks}
      intro={intro}
      title={meta.title}
      client={meta.client}
    />
  );
}
