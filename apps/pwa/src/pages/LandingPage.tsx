import { Link } from "react-router-dom";

const downloadUrl = import.meta.env.VITE_WINDOWS_EXE_URL ?? "/downloads/Anyattend-Setup.exe";

export function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <p className="brand-tag">Anyattend</p>
        <h1>Reliable AnyDesk Access for Distributed Teams</h1>
        <p className="muted">
          Install once on the connectee laptop, manage health and controls from your phone, and keep unattended access
          stable without manual walk-ups.
        </p>
        <div className="landing-actions">
          <a
            href={downloadUrl || "#"}
            className={`primary-btn ${downloadUrl ? "" : "disabled-link"}`}
            target="_blank"
            rel="noreferrer"
          >
            Download Windows Installer
          </a>
          <Link className="ghost-btn" to="/app/login">
            Open Admin Web App
          </Link>
        </div>
        <p className="muted tiny-note">
          Override download target with <code>VITE_WINDOWS_EXE_URL</code> in Vercel if you prefer GitHub Releases.
        </p>
      </section>

      <section className="landing-grid">
        <article className="feature-card">
          <h2>One-Click Agent Install</h2>
          <p>Signed EXE installs service, runs pairing, and writes secure local token with DPAPI.</p>
        </article>
        <article className="feature-card">
          <h2>Phone-First Operations</h2>
          <p>Installable PWA shows device status, health events, and remote action controls.</p>
        </article>
        <article className="feature-card">
          <h2>AnyDesk-Compatible</h2>
          <p>Uses unattended access and ACL hardening. No brittle popup-click automation.</p>
        </article>
      </section>
    </div>
  );
}
