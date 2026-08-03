import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { parseJoinLink } from "./utils/joinLink";

// Mounted at /join/:code — the landing spot for a shared join link (scanned
// QR, or pasted directly). Its only job is to decode the code + kind/game
// query params and hand them to the home route as router state, then get
// out of the way with a replace (so "back" from wherever the join actually
// lands doesn't return here). Kept separate from App/useAppNavigation so
// that machine doesn't need to know how join links are encoded in the URL.
export function JoinRedirect() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const link = parseJoinLink(code, searchParams);
  return <Navigate to="/" replace state={{ joinLink: link }} />;
}
