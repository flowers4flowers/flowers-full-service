// next/app/(portal)/layout.js

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalLayout({ children }) {
  return (
    <div className="portal-shell min-h-screen">
      <div className="portal-content">{children}</div>
    </div>
  );
}
