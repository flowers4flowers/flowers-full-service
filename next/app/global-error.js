"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Something went wrong loading the page
          </h1>
          <p style={{ marginBottom: "1.5rem", color: "#555" }}>
            This is usually temporary. Please try again in a moment.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.6rem 1.5rem",
              fontSize: "1rem",
              cursor: "pointer",
              border: "1px solid #333",
              background: "#fff",
              borderRadius: "4px",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
