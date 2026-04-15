"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const FORM_ID = "redi-login-form";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="you@redi.org"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="????????"
            required
            autoComplete="current-password"
          />
        </div>
      </form>

      <nav className="mt-4 space-y-4" aria-label="Password recovery">
        <Link
          href="/forgot-password"
          className="flex w-full items-center justify-center rounded-lg border-2 border-blue-600 bg-white py-2.5 px-4 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50"
        >
          Forgot password?
        </Link>
        <button
          type="submit"
          form={FORM_ID}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </nav>

      <p className="text-center text-sm text-gray-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-blue-600 hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </>
  );
}
