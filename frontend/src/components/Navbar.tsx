"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-base tracking-tight text-gray-900">
          UNMADE
        </Link>
        <div className="flex items-center gap-1">
          {[
            { href: "/agents/new", label: "Deploy Agent" },
            { href: "/earn", label: "Earn" },
            { href: "/payouts", label: "Payouts" },
            { href: "/admin", label: "Admin" },
          ].map((link) => {
            const active =
              pathname === link.href ||
              (link.href === "/agents/new" && pathname.startsWith("/agents")) ||
              (link.href !== "/agents/new" && pathname.startsWith(link.href + "/"));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
