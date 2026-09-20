import { useParams } from "react-router-dom";
import { ResetPasswordScreen } from "./screens/ResetPasswordScreen";

// Thin route wrapper — mirrors JoinRedirect's role as a sibling-of-App route
// leaf (see routes.tsx). Reads :token off the URL and hands it to the
// React-state-only screen.
export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  return <ResetPasswordScreen token={token ?? ""} />;
}
