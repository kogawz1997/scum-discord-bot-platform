import React, { useState } from "react";
import { ArrowLeft, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginOwner, resolvePostLoginPath } from "./lib/owner-auth.js";

export function shouldPromptForOwnerOtp(result) {
  return result?.requiresOtp === true;
}

export default function OwnerLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const result = await loginOwner({ username, password, otp });
    setSubmitting(false);
    const nextOtpRequired = shouldPromptForOwnerOtp(result);
    setOtpRequired(nextOtpRequired);

    if (result.ok) {
      setPassword("");
      setOtp("");
      setMessage({ tone: "success", text: `Signed in as ${result.data?.user || username}. Opening dashboard...` });
      window.setTimeout(() => {
        window.location.assign(resolvePostLoginPath(window.location.search));
      }, 450);
      return;
    }

    if (!nextOtpRequired) setOtp("");
    setMessage({ tone: "error", text: result.error || "Owner login failed" });
  }

  return (
    <main className="min-h-screen bg-[#070A10] px-5 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="flex flex-col justify-between rounded-3xl border border-white/5 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div>
              <a
                href="/"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-zinc-200 hover:bg-white/[0.06]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Control Plane
              </a>

              <div className="mt-16 max-w-2xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Separate Owner Auth Surface
                </div>
                <h1 className="text-5xl font-black tracking-tight text-white md:text-6xl">Owner Login</h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">
                  This screen is isolated from the dashboard UI. It only creates the real owner session cookie through the backend, then returns to the live control plane.
                </p>
              </div>
            </div>

            <div className="mt-16 grid gap-3 text-sm text-zinc-400 md:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="font-semibold text-white">Endpoint</div>
                <div className="mt-2 font-mono text-xs text-cyan-200">POST /owner/api/login</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="font-semibold text-white">Session</div>
                <div className="mt-2 text-xs">Uses backend Set-Cookie via the same prototype origin.</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="font-semibold text-white">2FA</div>
                <div className="mt-2 text-xs">OTP field appears only after the backend requires it.</div>
              </div>
            </div>
          </section>

          <section className="self-center rounded-3xl border border-cyan-400/15 bg-[#0B1018] p-6 shadow-[0_24px_80px_rgba(53,216,255,0.08)]">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-bold text-white">Sign in</div>
                <div className="text-sm text-zinc-400">Backend-authenticated owner access</div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="mb-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Username</span>
                <Input
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="owner"
                />
              </label>

              <label className="mb-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Password</span>
                <Input
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                />
              </label>

              {otpRequired ? (
                <label className="mb-4 block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">2FA Code</span>
                  <Input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    placeholder="123456"
                  />
                </label>
              ) : null}

              {message ? (
                <div className={`mb-4 rounded-xl border px-3 py-2 text-xs leading-5 ${message.tone === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-red-500/20 bg-red-500/10 text-red-200"}`}>
                  {message.text}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-xl bg-cyan-400 font-semibold text-black hover:bg-cyan-300"
              >
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {submitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
