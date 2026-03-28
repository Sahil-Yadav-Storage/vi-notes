import {
  Files,
  LogOut,
  Mail,
  Moon,
  NotebookPen,
  Sun,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";

interface NavbarProps {
  isAuthenticated: boolean;
  isLightMode: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
}

const Navbar = ({
  isAuthenticated,
  isLightMode,
  onToggleTheme,
  onLogout,
}: NavbarProps) => {
  const location = useLocation();

  return (
    <header className="navbar-wrap">
      <nav className="navbar">
        <Link className="brand" to={isAuthenticated ? "/files" : "/login"}>
          <span className="brand-mark">
            <NotebookPen size={18} />
          </span>
          <span className="brand-name">ViNotes</span>
        </Link>

        <div className="navbar-actions">
          <Button
            asChild
            variant={location.pathname === "/files" ? "default" : "ghost"}
            size="sm"
          >
            <Link to="/files">
              <Files size={16} />
              Files
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleTheme}
            aria-label="Toggle light and dark mode"
            title="Toggle light and dark mode"
          >
            {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
            {isLightMode ? "Dark" : "Light"}
          </Button>

          <Button asChild variant="ghost" size="sm">
            <a href="mailto:contact@vinotes.app">
              <Mail size={16} />
              Contact
            </a>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            disabled={!isAuthenticated}
          >
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
