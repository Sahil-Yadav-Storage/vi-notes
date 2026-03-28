import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

interface NotFoundPageProps {
  isAuthenticated: boolean;
}

const NotFoundPage = ({ isAuthenticated }: NotFoundPageProps) => {
  return (
    <section className="not-found-page">
      <div className="not-found-card">
        <p className="not-found-code">404</p>
        <h1>Page not found</h1>
        <p>
          The page you requested does not exist. Return to your main flow to
          keep working.
        </p>

        <Button asChild>
          <Link to={isAuthenticated ? "/files" : "/login"}>
            Go to {isAuthenticated ? "Files" : "Login"}
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default NotFoundPage;
