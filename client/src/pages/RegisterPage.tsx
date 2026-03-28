import { useState } from "react";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import Toast from "../components/Toast";
import { Button } from "../components/ui/button";

const RegisterPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.post("/api/auth/register", {
        email,
        password,
      });

      navigate("/login?registered=1", { replace: true });
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
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">
          Register to access your dashboard and start collecting keystroke data.
        </p>

        <label className="field-label" htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          className="field-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="field-label" htmlFor="register-password">
          Password
        </label>
        <div className="password-wrapper">
          <input
            id="register-password"
            className="field-input"
            type={showPassword ? "text" : "password"}
            placeholder="Choose a secure password"
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
          {isSubmitting ? "Creating account..." : "Register"}
        </Button>

        <p className="auth-footnote">
          Already have an account? <Link to="/login">Login here</Link>
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

export default RegisterPage;
