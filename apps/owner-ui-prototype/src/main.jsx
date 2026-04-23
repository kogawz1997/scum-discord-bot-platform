import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import ScumOwnerUnifiedControlPlane from "./ScumOwnerUnifiedControlPlane.jsx";
import OwnerLoginPage from "./OwnerLoginPage.jsx";
import { buildOwnerLoginRedirect, getOwnerSession } from "./lib/owner-auth.js";
import { resolveOwnerPrototypeRoute } from "./lib/owner-routes.js";
import "./styles.css";

const route = resolveOwnerPrototypeRoute(window.location.pathname);

function OwnerGate() {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const result = await getOwnerSession();
        if (!mounted) return;
        if (result.ok) {
          setAuthorized(true);
          return;
        }
      } catch {
        // Fall through to login redirect.
      }

      if (mounted) {
        window.location.replace(buildOwnerLoginRedirect(window.location.pathname, window.location.search));
      }
    }

    checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  if (!authorized) {
    return (
      <main className="owner-shell grid min-h-screen place-items-center px-5 text-white">
        <div className="owner-card max-w-md rounded-2xl border p-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Owner access</div>
          <h1 className="mt-3 text-2xl font-black">Checking session</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">The control plane opens only after a valid owner login session exists.</p>
        </div>
      </main>
    );
  }

  return <ScumOwnerUnifiedControlPlane />;
}

const App = route === "login" ? OwnerLoginPage : OwnerGate;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
