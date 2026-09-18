import { createContext, useContext } from "react";

// Every context under pages/context/ follows this shape: required value, no
// default, and a hook that throws (not silently returns undefined) if used
// outside its Provider — App always provides all of them before <Outlet>
// (see AppMainContent.tsx), so a missing value here is always a real
// Provider-wiring bug, never an intentionally absent one.
export function createRequiredContext<T>(name: string) {
  const Context = createContext<T | undefined>(undefined);

  function useRequiredContext(): T {
    const value = useContext(Context);
    if (value === undefined) throw new Error(`${name} must be used within its Provider`);
    return value;
  }

  return [Context, useRequiredContext] as const;
}
