import { Link } from "react-router-dom";

// Catch-all for a path that doesn't match any real route (routes.tsx's "*")
// — genuinely broken/mistyped links, not internal routes like /room/:code
// (those all match their own route regardless of whether the code is real;
// an invalid room/group code is handled inside that room/group's own screen,
// not here).
export function NotFoundScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0f0c1d] p-6 text-center">
      <p className="m-0 text-[15px] font-bold text-white">No encontramos esta página</p>
      <p className="m-0 max-w-[280px] text-[13px] text-[#a49dc9]">El link puede estar mal escrito o ya no existir.</p>
      <Link to="/" className="mt-2 rounded-xl bg-[#7F77DD] px-4 py-2 text-sm font-bold text-white no-underline hover:bg-[#8f87ea]">
        Ir al inicio
      </Link>
    </div>
  );
}
