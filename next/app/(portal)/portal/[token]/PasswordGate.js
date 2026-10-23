// next/app/(portal)/portal/[token]/PasswordGate.js

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDeckAnalytics } from "../../../../utility/useDeckAnalytics";

const ERROR_MESSAGES = {
  missing_company: "Please enter your company name. Any name is fine.",
  incorrect_password: "Incorrect password.",
  missing_company_and_password:
    "Please enter your company name (any name is fine) and check your password.",
  expired: "This link has expired.",
  network: "Something went wrong. Please try again.",
};

export default function PasswordGate({ token, deckTitle, client, type }) {
  const router = useRouter();
  const { trackGateView, trackUnlock } = useDeckAnalytics({
    token,
    title: deckTitle,
    client,
    type,
    role: "unknown",
    company: "unknown",
  });
  const gateViewSentRef = useRef(false);

  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorKind, setErrorKind] = useState(null);

  useEffect(() => {
    if (gateViewSentRef.current) {
      return;
    }

    gateViewSentRef.current = true;
    trackGateView();
  }, [trackGateView]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("submitting");
    setErrorKind(null);

    try {
      const res = await fetch(`/portal/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, password }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        trackUnlock(
          "success",
          data?.role || "unknown",
          data?.company || "unknown"
        );
        router.refresh();
        return;
      }

      if (res.status === 401) {
        const data = await res.json().catch(() => null);
        const kind = data?.error;
        const isKnownKind =
          kind === "missing_company" ||
          kind === "incorrect_password" ||
          kind === "missing_company_and_password";

        trackUnlock(isKnownKind ? kind : "error", data?.role || "unknown");
        setStatus("error");
        setErrorKind(isKnownKind ? kind : "network");
        return;
      }

      if (res.status === 410) {
        trackUnlock("expired");
        setStatus("error");
        setErrorKind("expired");
        return;
      }

      trackUnlock("error");
      setStatus("error");
      setErrorKind("network");
    } catch {
      trackUnlock("error");
      setStatus("error");
      setErrorKind("network");
    }
  };

  return (
    <div className="px-6 max-w-[420px] mx-auto pt-24">
      <Image
        src="/FLOWERS.png"
        alt="FLOWERS"
        width={50}
        height={40}
        className="invert mb-8"
      />

      {deckTitle && (
        <h1 className="font-primary text-xl mb-8">{deckTitle}</h1>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="font-secondary text-md" htmlFor="deck-company">
          What company are you from?
        </label>

        <input
          id="deck-company"
          type="text"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          placeholder="e.g. Acme Studio"
          className="border border-cream bg-transparent px-3 py-2 font-secondary text-md"
          autoComplete="organization"
          autoCapitalize="words"
          spellCheck={false}
        />

        <label className="font-secondary text-md" htmlFor="deck-password">
          Enter password
        </label>

        <input
          id="deck-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border border-cream bg-transparent px-3 py-2 font-secondary text-md"
          autoComplete="current-password"
          autoFocus
        />

        <button
          type="submit"
          disabled={status === "submitting"}
          className="uppercase font-primary font-bold text-md border border-cream px-4 py-2 disabled:opacity-50"
        >
          {status === "submitting" ? "Checking" : "View deck"}
        </button>

        {status === "error" && errorKind && (
          <p className="font-secondary text-md">{ERROR_MESSAGES[errorKind]}</p>
        )}
      </form>
    </div>
  );
}
