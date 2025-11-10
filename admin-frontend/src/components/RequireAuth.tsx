import { Navigate, useLocation } from "react-router-dom";
import type { PropsWithChildren } from "react";

import { useAuth } from "@/hooks/useAuth";

const RequireAuth = ({ children }: PropsWithChildren) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const target = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from: target }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
