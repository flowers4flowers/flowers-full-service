// next/app/(portal)/portal/[token]/PasswordGate.js

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERROR_MESSAGES = {
  incorrect: "Incorrect password.",
  expired: "This link has expired.",
  network: "Something went wrong. Please try again.",
};

export default function PasswordGate({ token, deckTitle }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorKind, setErrorKind] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("submitting");
    setErrorKind(null);

    try {
      const res = await fetch(`/portal/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.refresh();
        return;
      }

      if (res.status === 401) {
        setStatus("error");
        setErrorKind("incorrect");
        return;
      }

      if (res.status === 410) {
        setStatus("error");
        setErrorKind("expired");
        return;
      }

      setStatus("error");
      setErrorKind("network");
    } catch {
      setStatus("error");
      setErrorKind("network");
    }
  };

  return (
    <div className="px-6 max-w-[420px] mx-auto pt-24">
      {deckTitle && (
        <h1 className="font-primary text-xl mb-8">{deckTitle}</h1>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="font-secondary text-md" htmlFor="deck-password">
          Enter password
        </label>

        <input
          id="deck-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border border-black dark:border-cream bg-transparent px-3 py-2 font-secondary text-md"
          autoComplete="current-password"
          autoFocus
        />

        <button
          type="submit"
          disabled={status === "submitting"}
          className="uppercase font-primary font-bold text-md border border-black dark:border-cream px-4 py-2 disabled:opacity-50"
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
