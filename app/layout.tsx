import type { Metadata } from "next";
import "./globals.css";
import { AuthSignOut } from "@/components/auth-signout";
import { getReviewerSession } from "@/lib/reviewer-session";

export const metadata: Metadata = {
  title: "PACT Delphi — Round 2",
  description: "Round 2 of the PACT Delphi: ranking the 17 high-risk cognitive tasks."
};

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getReviewerSession();
  const reviewer = session?.reviewer ?? null;

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <div className="brand-eyebrow">ARISE Group · Stanford Medicine</div>
              <h1>PACT Delphi — Round 2</h1>
            </div>
            <div className="topbar-actions">
              {reviewer?.display_name ? <span className="hint">{reviewer.display_name}</span> : null}
              {reviewer?.institution ? <span className="hint">{reviewer.institution}</span> : null}
              {reviewer?.title ? <span className="hint">{reviewer.title}</span> : null}
              {reviewer ? <AuthSignOut /> : null}
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
