import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { decodeToken, saveSession } from "../auth";

// ─── Palette & Tokens ────────────────────────────────────────────────────────
// Warm vintage indie-rock palette inspired by Jannabi's analog warmth
// Cream parchment · Burnt amber · Deep mahogany · Dusty rose · Charcoal

const BRAND = "StageMaster";

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function Logo({ size = "md" }) {
  const s = size === "sm" ? "text-xl" : "text-2xl";
  return (
    <div className={`flex items-center gap-2 font-display font-bold ${s}`}>
      <span className="text-amber-600">🎸</span>
      <span className="text-stone-800 tracking-tight">
        Stage<span className="text-amber-600">Master</span>
      </span>
    </div>
  );
}

// ─── Input Components ─────────────────────────────────────────────────────────
function Input({ label, type = "text", placeholder, value, onChange, error, icon, rightElement, hint }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-stone-500 uppercase tracking-widest">{label}</label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{icon}</span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`w-full rounded-lg border bg-amber-50/60 px-3 py-2.5 text-sm text-stone-700
            placeholder:text-stone-400 outline-none transition-all
            focus:ring-2 focus:ring-amber-400/50 focus:border-amber-500
            ${icon ? "pl-9" : "pl-3"}
            ${rightElement ? "pr-10" : ""}
            ${error
              ? "border-rose-400 bg-rose-50 focus:ring-rose-300/50"
              : "border-stone-300 hover:border-amber-400"
            }`}
        />
        {rightElement && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</span>
        )}
      </div>
      {error && <p className="text-xs text-rose-500 flex items-center gap-1"><span>⚠</span>{error}</p>}
      {hint && !error && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

function PasswordInput({ label, placeholder, value, onChange, error, hint }) {
  const [show, setShow] = useState(false);
  return (
    <Input
      label={label}
      type={show ? "text" : "password"}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      error={error}
      hint={hint}
      rightElement={
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="text-stone-400 hover:text-amber-600 transition-colors"
          tabIndex={-1}
        >
          <EyeIcon open={show} />
        </button>
      }
    />
  );
}

function Btn({ children, variant = "primary", onClick, type = "button", className = "", disabled }) {
  const base = "w-full rounded-lg py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50";
  const variants = {
    primary: "bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-amber-300/40 active:scale-[0.98]",
    secondary: "bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300",
    ghost: "text-amber-600 hover:underline underline-offset-2",
    outline: "border border-amber-500 text-amber-700 hover:bg-amber-50",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ─── Concert Poster Side Panel ────────────────────────────────────────────────
function PosterPanel({ title, subtitle }) {
  return (
    <div className="hidden lg:flex flex-col justify-between relative overflow-hidden rounded-r-2xl bg-stone-900 min-h-full p-10">
      {/* Grainy texture overlay */}
      <div className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "150px"
        }} />

      {/* Warm light blobs */}
      <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-amber-600/30 blur-3xl" />
      <div className="absolute bottom-20 left-5 w-48 h-48 rounded-full bg-rose-700/20 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />

      {/* Content */}
      <div className="relative z-10">
        <div className="text-xs font-mono text-amber-500/70 uppercase tracking-[0.3em] mb-2">Live Music · Est. 2025</div>
        <Logo />
      </div>

      <div className="relative z-10">
        {/* Vintage concert ticket decoration */}
        <div className="mb-6 flex gap-1">
          {["🎵", "🎸", "🥁", "🎤", "🎷"].map((e, i) => (
            <span key={i} className="text-lg opacity-60">{e}</span>
          ))}
        </div>
        <h2 className="font-display text-4xl font-bold text-amber-50 leading-tight mb-3">
          {title}
        </h2>
        <p className="text-stone-400 text-sm leading-relaxed max-w-xs">{subtitle}</p>

        {/* Decorative ticket stub line */}
        <div className="mt-8 border-t border-dashed border-stone-600/60 pt-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-stone-500 font-mono tracking-wider">YOUR TICKET TO EVERY CONCERT</span>
        </div>
      </div>

      <div className="relative z-10 text-xs text-stone-600 font-mono">© 2025 {BRAND} · All Rights Reserved</div>
    </div>
  );
}

// ─── Card Shell ───────────────────────────────────────────────────────────────
function AuthCard({ children, poster }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #fdf6ec 0%, #f5e6d0 40%, #ede0cc 100%)",
      }}>
      {/* Decorative background elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 rounded-full bg-rose-200/30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-5"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, #92400e 0px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #92400e 0px, transparent 1px, transparent 40px)"
          }} />
      </div>

      <div className="relative w-full max-w-4xl rounded-2xl shadow-2xl shadow-stone-400/30 overflow-hidden"
        style={{ minHeight: "560px" }}>
        <div className="grid lg:grid-cols-2 h-full bg-amber-50">
          {/* Form side */}
          <div className="flex flex-col justify-center p-8 sm:p-10 bg-amber-50/90 backdrop-blur">
            {/* Mobile logo */}
            <div className="lg:hidden mb-6">
              <Logo />
            </div>
            {children}
          </div>
          {/* Poster side */}
          {poster}
        </div>
      </div>
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "", remember: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    const e = {};
    if (!form.identifier) e.identifier = "Email or username is required";
    if (!form.password) e.password = "Password is required";
    
    if (Object.keys(e).length) { 
      setErrors(e); 
      setShowBanner(true);
      setErrorMessage("Please fill in required fields.");
      return; 
    }

    setErrors({}); 
    setShowBanner(false);
    setLoading(true);

    try {
      const response = await api.login({ identifier: form.identifier, password: form.password });
      const payload = decodeToken(response.access_token);
      saveSession(response);
      navigate(payload?.role === "admin" ? "/admin" : "/concerts", { replace: true });
    } catch (err) {
      setShowBanner(true);
      setErrorMessage(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        .font-display { font-family: 'Playfair Display', serif !important; }
      `}</style>
      
      <AuthCard poster={<PosterPanel title="Welcome back, music lover." subtitle="Access your tickets, upcoming shows, and favourite artists. Your stage is waiting." />}>
        <h1 className="font-display text-2xl font-bold text-stone-800 mb-1">Welcome Back</h1>
        <p className="text-sm text-stone-500 mb-6">Don't have an account? <button onClick={() => alert("Registration not implemented in this demo")} className="text-amber-600 hover:underline font-medium">Sign Up</button></p>

        {showBanner && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700 flex items-center gap-2">
            <span>⚠</span> {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Input label="Email or Username" type="text" placeholder="you@email.com" value={form.identifier} onChange={set("identifier")} error={errors.identifier}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />

          <div>
            <PasswordInput label="Password" placeholder="Your password" value={form.password} onChange={set("password")} error={errors.password} />
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer select-none">
                <input type="checkbox" checked={form.remember} onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))}
                  className="rounded border-stone-300 accent-amber-600" />
                Remember me
              </label>
              <button onClick={() => alert("Forgot password not implemented in this demo")} className="text-xs text-amber-600 hover:underline">Forgot Password?</button>
            </div>
          </div>

          <Btn onClick={handleSubmit} className="mt-1" disabled={loading}>{loading ? "Signing in..." : "Log In"}</Btn>
          <Btn variant="secondary" className="border-stone-300"><GoogleIcon /> Sign In with Google</Btn>
        </div>
      </AuthCard>
    </>
  );
}
