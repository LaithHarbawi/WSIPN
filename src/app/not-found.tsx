import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        <p className="text-6xl font-black text-text-muted/30">404</p>
        <h2 className="text-xl font-bold">Page not found</h2>
        <p className="text-sm text-text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-accent text-white text-sm font-semibold shadow-lg hover:brightness-110 transition-all"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
