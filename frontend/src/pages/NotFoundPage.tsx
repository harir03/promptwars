import { Link } from "react-router-dom";

/**
 * 404 Not Found page — shown for unmatched routes.
 *
 * WCAG 1.3.1: Uses semantic main + heading hierarchy.
 * WCAG 2.4.4: Link has descriptive text.
 */
export function NotFoundPage() {
  return (
    <main className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl" role="img" aria-label="Lost">🔍</span>
        </div>
        <h1 className="text-6xl font-black text-slate-200 mb-2">404</h1>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">
          Page Not Found
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-2.5 bg-teal-500 text-white text-sm font-bold rounded-lg shadow-md hover:bg-teal-600 transition-colors"
          aria-label="Return to home page"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
