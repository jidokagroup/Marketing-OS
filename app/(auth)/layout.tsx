import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex flex-col items-center gap-1">
          <span className="text-2xl font-bold tracking-tight">
            Welcome to Convia Pro x Jidoka
          </span>
        </Link>
      </div>
      {children}
    </div>
  );
}
