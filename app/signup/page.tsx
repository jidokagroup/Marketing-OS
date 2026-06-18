"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

function getStrength(pw: string): { level: number; label: string; color: string } {
  if (pw.length < 8) return { level: 1, label: "Weak", color: "bg-error" };
  if (pw.length < 12 || !/\d/.test(pw)) return { level: 2, label: "Medium", color: "bg-yellow-400" };
  return { level: 3, label: "Strong", color: "bg-neon" };
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tos, setTos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Capture a collaborator referral code (?ref=CODE) so it can be attributed
  // once the new account has a session (handled in the dashboard layout).
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("collab_ref", ref.toUpperCase());
  }, []);

  const strength = getStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirm) { setError("Please fill in all fields."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!tos) { setError("Please accept the terms of service."); return; }
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback",
        data: { full_name: email.split("@")[0] },
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    // Email confirmation disabled: session returned immediately → pick a plan first
    if (data.session) {
      router.push("/billing");
      return;
    }
    // Email confirmation enabled: ask user to check inbox
    setSuccess(true);
  };

  const handleGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback?next=/dashboard" },
    });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-5">✉</div>
          <h2 className="text-xl font-bold mb-2">Check your email</h2>
          <p className="text-white/50 text-sm mb-6">We sent a confirmation link to <strong className="text-white">{email}</strong></p>
          <Link href="/login" className="text-primary hover:underline text-sm">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Link href="https://autom8ig.io" className="inline-block">
            <Image src="/logo.png" alt="Autom8" width={160} height={68} className="object-contain mx-auto" priority />
          </Link>
          <p className="text-white/40 text-sm mt-3 mb-3">Create your free account</p>
        </div>

        <div className="bg-surface border border-white/5 rounded-2xl p-8">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div>
              <Input label="Password" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3].map((l) => (
                      <div key={l} className={`h-1 flex-1 rounded-full transition-all ${l <= strength.level ? strength.color : "bg-white/10"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-white/40">{strength.label} password</p>
                </div>
              )}
            </div>
            <Input label="Confirm Password" type="password" placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={tos}
                onChange={(e) => setTos(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                I agree to the{" "}
                <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </span>
            </label>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Create Account
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-white/30">or</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 border border-white/10 hover:border-white/20 rounded-lg px-4 py-2.5 text-sm text-white/70 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>
        </div>

        <p className="text-center text-sm text-white/40 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
