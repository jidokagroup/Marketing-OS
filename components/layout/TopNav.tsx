"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface TopNavProps {
  onMenuClick: () => void;
  user?: { name: string; email: string };
}

export default function TopNav({ onMenuClick, user }: TopNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { signOut } = useAuth();
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() ?? "D";

  return (
    <header className="h-14 bg-charcoal border-b border-white/5 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="md:hidden text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        aria-label="Toggle menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="hidden md:block" />

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <span className="hidden sm:block text-sm text-white/70">{user?.name ?? "Demo User"}</span>
          <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 mt-2 w-48 bg-surface border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-sm font-medium text-white">{user?.name ?? "Demo User"}</p>
                <p className="text-xs text-white/40 truncate">{user?.email ?? "demo@autom8ig.io"}</p>
              </div>
              <Link href="/settings" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                Settings
              </Link>
              <button
                onClick={() => { setDropdownOpen(false); signOut(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-brand-pink hover:bg-brand-pink/5 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
