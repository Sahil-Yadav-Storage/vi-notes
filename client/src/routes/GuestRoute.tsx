import { Navigate } from "react-router-dom";

interface GuestRouteProps {
  isAuthenticated: boolean;
  children: React.ReactElement;
}

const GuestRoute = ({ isAuthenticated, children }: GuestRouteProps) => {
  if (isAuthenticated) {
    return <Navigate to="/files" replace />;
  }

  return children;
};

export default GuestRoute;
