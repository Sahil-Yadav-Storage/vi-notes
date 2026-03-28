import { useEffect, useState } from "react";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { AccessTokenResponse } from "@shared/auth";
import { api } from "../api";
import Toast from "../components/Toast";
import { Button } from "../components/ui/button";

interface LoginPageProps {
  onAuth: (accessToken: string) => void;
}

const LoginPage = ({ onAuth }: LoginPageProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (searchParams.get("registered") !== "1") {
      return;
    }

    setToast({
      message: "Registration successful. Please login.",
      type: "success",
    });

    const next = new URLSearchParams(searchParams);
    next.delete("registered");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await api.post<AccessTokenResponse>("/api/auth/login", {
        email,
        password,
      });

      onAuth(res.data.accessToken);
      navigate("/files", { replace: true });
    } catch (err: unknown) {
      let message = "Something went wrong";

      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          message = err.response.data.error;
        } else {
          message =
            "Cannot reach server. Check that backend is running and API URL is correct.";
        }
      }

      setToast({ message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">
          Login to continue writing and tracking your typing sessions.
        </p>

        <label className="field-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="field-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="login-password">
          Password
        </label>
        <div className="password-wrapper">
          <input
            id="login-password"
            className="field-input"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="button"
            className="eye-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Login"}
        </Button>

        <p className="auth-footnote">
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  );
};

export default LoginPage;
