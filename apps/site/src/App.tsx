const webAppUrl = import.meta.env.VITE_WEBAPP_URL ?? "https://anyattend-admin.vercel.app";
const downloadUrl = import.meta.env.VITE_WINDOWS_EXE_URL ?? "/downloads/Anyattend-Setup.exe";

export function App() {
  return (
    <div className="page">
      <div className="noise" aria-hidden="true" />
      <header className="top-nav">
        <div className="brand">Anyattend</div>
        <a className="pill-link" href={webAppUrl} target="_blank" rel="noreferrer">
          Open Admin Web App
        </a>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Windows Remote Access Control</p>
          <h1>Keep AnyDesk sessions stable without walking to the laptop.</h1>
          <p className="hero-copy">
            Anyattend installs on your Windows connectee laptop, monitors health, and gives admins phone-first control via a
            dedicated web app.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href={downloadUrl} target="_blank" rel="noreferrer">
              Download for Windows
            </a>
            <a className="btn secondary" href={webAppUrl} target="_blank" rel="noreferrer">
              Launch Admin Web App
            </a>
          </div>
          <div className="meta-strip">
            <span>Available now for Windows 10/11</span>
            <span>AnyDesk-compatible workflow</span>
            <span>PWA control from phone</span>
          </div>
        </section>

        <section className="grid">
          <article className="card">
            <h2>Installer-first workflow</h2>
            <p>
              Download a single EXE, install the service, pair the device, and start monitoring. No manual script execution
              required.
            </p>
          </article>
          <article className="card">
            <h2>Separate admin app</h2>
            <p>
              The admin web app runs independently with login, pairing, status, command actions, and event history for each
              laptop.
            </p>
          </article>
          <article className="card">
            <h2>Operational resilience</h2>
            <p>
              Watchdog + command controls allow restart/lock/unlock flows when remote connectivity degrades.
            </p>
          </article>
        </section>

        <section className="steps">
          <h3>How it works</h3>
          <ol>
            <li>Install Anyattend on the connectee Windows laptop.</li>
            <li>Open the admin web app and generate a pairing session.</li>
            <li>Pair the laptop and enforce AnyDesk unattended access + ACL.</li>
            <li>Control and monitor from your phone or desktop browser.</li>
          </ol>
        </section>
      </main>

      <footer className="foot">
        <span>Anyattend</span>
        <span>Windows-first release</span>
      </footer>
    </div>
  );
}
