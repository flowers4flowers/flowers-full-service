// next/app/(portal)/layout.js

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalLayout({ children }) {
  return (
    <div
      className="portal-shell portal-shell--dark min-h-screen"
      style={{ backgroundColor: "#000000", color: "#ffffff" }}
    >
      <div className="portal-content">{children}</div>
    </div>
  );
}
