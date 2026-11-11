
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import "./Auth.css";

type Props = {
  onSwitch: () => void;
};

export default function Signup({ onSwitch }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(result.user, {
        displayName: name.trim(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create account.";
      setError(message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");
    setLoading(true);

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed.";
      setError(message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          <div className="auth-logo">S3</div>
          <div>
            <strong>SmartSpace <span>3D</span></strong>
            <small>SPACE OPTIMIZATION</small>
          </div>
        </div>

        <div className="auth-visual-content">
          <div className="visual-tag">YOUR SPACE, YOUR WAY</div>
          <h1>A smarter space begins with you.</h1>
          <p>
            Create your workspace to start planning rooms,
            organizing items, and exploring storage layouts.
          </p>
          <div className="room-illustration">
            <div className="room-wall">
              <div className="storage-box box-one" />
              <div className="storage-box box-two" />
              <div className="storage-box box-three" />
              <div className="room-floor" />
            </div>
          </div>
        </div>

        <small className="auth-footer">
          Plan better. Store smarter.
        </small>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="mobile-brand">
            <div className="auth-logo">S3</div>
            <strong>SmartSpace <span>3D</span></strong>
          </div>

          <div className="auth-heading">
            <span className="eyebrow">GET STARTED</span>
            <h2>Create your account</h2>
            <p>Set up your workspace in just a few steps.</p>
          </div>

          <button
            className="google-button"
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading}
          >
            <span className="google-g">G</span>
            Continue with Google
          </button>

          <div className="auth-divider">
            <span>or sign up with email</span>
          </div>

          <form onSubmit={handleSignup} className="auth-form">
            <label htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />

            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />

            {error && <p className="auth-error">{error}</p>}

            <button className="primary-auth-button" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
              {!loading && <span>→</span>}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <button type="button" onClick={onSwitch}>
              Sign in
            </button>
          </p>

          <p className="auth-terms">
            By creating an account, you agree to use SmartSpace responsibly.
          </p>
        </div>
      </section>
    </main>
  );
}