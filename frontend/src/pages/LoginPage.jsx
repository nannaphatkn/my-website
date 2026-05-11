import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { decodeToken, saveSession } from "../auth";

const BRAND = "NodNod Tickets";

function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{width:18,height:18}}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{width:18,height:18}}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ identifier: "", password: "", remember: false });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    full_name: "",
    date_of_birth: "",
    address: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setRegister = k => e => setRegisterForm(f => ({ ...f, [k]: e.target.value }));

  const finishLogin = (response) => {
    const payload = decodeToken(response.access_token);
    saveSession(response);
    navigate(payload?.role === "admin" ? "/admin" : "/concerts", { replace: true });
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!form.identifier) e.identifier = true;
    if (!form.password) e.password = true;
    if (Object.keys(e).length) { setErrors(e); setErrorMessage("Please fill in required fields."); return; }
    setErrors({}); setErrorMessage(""); setLoading(true);
    try {
      const response = await api.login({ identifier: form.identifier, password: form.password });
      finishLogin(response);
    } catch (err) {
      setErrorMessage(err.message || "Invalid credentials");
    } finally { setLoading(false); }
  };

  const handleRegister = async (ev) => {
    ev.preventDefault();
    const e = {};
    ["username", "full_name", "email", "password"].forEach((field) => {
      if (!registerForm[field]) e[field] = true;
    });
    if (registerForm.password && registerForm.password.length < 8) {
      setErrors({ ...e, password: true });
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setErrors({ ...e, confirmPassword: true });
      setErrorMessage("Password confirmation does not match.");
      return;
    }
    if (Object.keys(e).length) {
      setErrors(e);
      setErrorMessage("Please fill in required fields.");
      return;
    }

    setErrors({});
    setErrorMessage("");
    setLoading(true);
    try {
      const payload = {
        username: registerForm.username,
        full_name: registerForm.full_name,
        date_of_birth: registerForm.date_of_birth || null,
        address: registerForm.address || null,
        email: registerForm.email,
        phone: registerForm.phone || null,
        password: registerForm.password,
      };
      await api.register(payload);
      const response = await api.login({ identifier: registerForm.username, password: registerForm.password });
      finishLogin(response);
    } catch (err) {
      setErrorMessage(err.message || "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        .loginRoot *{font-family:'Inter',sans-serif;box-sizing:border-box}
      `}</style>

      <div className="loginRoot" style={{
        minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
        background:'linear-gradient(135deg,#0a0a1a 0%,#111128 40%,#0d0d22 100%)',
        padding:20,position:'relative',overflow:'hidden'
      }}>
        {/* Ambient blobs */}
        <div style={{position:'absolute',top:'-15%',right:'-10%',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle,rgba(168,85,247,.12),transparent 70%)',filter:'blur(60px)'}}/>
        <div style={{position:'absolute',bottom:'-15%',left:'-10%',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(99,102,241,.1),transparent 70%)',filter:'blur(60px)'}}/>

        <div style={{
          position:'relative',width:'100%',maxWidth:960,display:'grid',
          gridTemplateColumns:'1fr 1fr',borderRadius:24,overflow:'hidden',
          background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',
          backdropFilter:'blur(20px)',boxShadow:'0 25px 60px rgba(0,0,0,.5)',
          minHeight:560
        }}>

          {/* ─── Left: Form ─── */}
          <div style={{padding:'48px 44px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32}}>
              <div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#a855f7,#6366f1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🎵</div>
              <div><strong style={{color:'#fff',fontSize:16,letterSpacing:1}}>{BRAND}</strong><br/><span style={{color:'rgba(255,255,255,.35)',fontSize:11}}>Concert Ticket Platform</span></div>
            </div>

            <h1 style={{color:'#fff',fontSize:28,fontWeight:700,margin:'0 0 4px'}}>
              {mode === "login" ? "Welcome Back 👋" : "Create Account"}
            </h1>
            <p style={{color:'rgba(255,255,255,.4)',fontSize:14,margin:'0 0 28px'}}>
              {mode === "login" ? "Sign in to your account to continue" : "Register your customer profile before booking"}
            </p>

            {errorMessage && (
              <div style={{marginBottom:16,padding:'10px 14px',borderRadius:10,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',color:'#f87171',fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                ⚠ {errorMessage}
              </div>
            )}

            <form onSubmit={mode === "login" ? handleSubmit : handleRegister} style={{display:'flex',flexDirection:'column',gap:18}}>
              {mode === "register" && (
                <>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <label>
                      <span style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Username *</span>
                      <input value={registerForm.username} onChange={setRegister("username")} placeholder="nodnodfan"
                        style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1px solid ${errors.username?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`,background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                    </label>
                    <label>
                      <span style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Full Name *</span>
                      <input value={registerForm.full_name} onChange={setRegister("full_name")} placeholder="Your name"
                        style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1px solid ${errors.full_name?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`,background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                    </label>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <label>
                      <span style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Date of Birth</span>
                      <input type="date" value={registerForm.date_of_birth} onChange={setRegister("date_of_birth")}
                        style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                    </label>
                    <label>
                      <span style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Phone</span>
                      <input value={registerForm.phone} onChange={setRegister("phone")} placeholder="08x-xxx-xxxx"
                        style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                    </label>
                  </div>
                  <label>
                    <span style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Address</span>
                    <input value={registerForm.address} onChange={setRegister("address")} placeholder="Address"
                      style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                  </label>
                </>
              )}

              <div>
                <label style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>
                  {mode === "login" ? "Email or Username" : "Email *"}
                </label>
                <div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,.25)',fontSize:16}}>✉</span>
                  <input
                    value={mode === "login" ? form.identifier : registerForm.email}
                    onChange={mode === "login" ? set("identifier") : setRegister("email")}
                    placeholder="you@email.com"
                    style={{width:'100%',padding:'12px 14px 12px 38px',borderRadius:10,border:`1px solid ${(errors.identifier || errors.email)?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`,background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}}
                  />
                </div>
              </div>

              <div>
                <label style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Password</label>
                <div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,.25)',fontSize:16}}>🔒</span>
                  <input type={showPw?'text':'password'} value={mode === "login" ? form.password : registerForm.password} onChange={mode === "login" ? set("password") : setRegister("password")} placeholder="Your password"
                    style={{width:'100%',padding:'12px 42px 12px 38px',borderRadius:10,border:`1px solid ${errors.password?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`,background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                  <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer'}}>
                    <EyeIcon open={showPw}/>
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Confirm Password *</label>
                  <input type={showPw?'text':'password'} value={registerForm.confirmPassword} onChange={setRegister("confirmPassword")} placeholder="Repeat password"
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1px solid ${errors.confirmPassword?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`,background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                </div>
              )}

              {mode === "login" && <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,.4)',fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={form.remember} onChange={e=>setForm(f=>({...f,remember:e.target.checked}))} style={{accentColor:'#a855f7'}} />
                  Remember me
                </label>
                <button type="button" style={{background:'none',border:'none',color:'#a855f7',fontSize:12,cursor:'pointer'}}>Forgot Password?</button>
              </div>}

              <button type="submit" disabled={loading} style={{
                width:'100%',padding:'13px',borderRadius:10,border:'none',
                background:'linear-gradient(135deg,#a855f7,#6366f1)',color:'#fff',
                fontSize:15,fontWeight:600,cursor:'pointer',letterSpacing:.5,
                boxShadow:'0 4px 20px rgba(168,85,247,.3)',
                transition:'transform .15s,box-shadow .15s'
              }}>
                {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : (mode === "login" ? "Sign In" : "Create Customer Account")}
              </button>

              <div style={{display:'flex',alignItems:'center',gap:12,margin:'4px 0'}}>
                <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
                <span style={{color:'rgba(255,255,255,.25)',fontSize:11,fontWeight:600}}>OR</span>
                <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
              </div>

              <button type="button" onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setErrors({});
                setErrorMessage("");
              }} style={{
                width:'100%',padding:'12px',borderRadius:10,
                border:'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.03)',
                color:'rgba(255,255,255,.6)',fontSize:13,fontWeight:500,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:8
              }}>
                {mode === "login" ? "Create a new customer account" : "Already have an account? Sign in"}
              </button>
            </form>
          </div>

          {/* ─── Right: Concert Visual ─── */}
          <div style={{
            position:'relative',overflow:'hidden',
            background:'linear-gradient(135deg,#1a1035 0%,#0f0a2a 100%)',
            display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'48px 40px'
          }}>
            {/* Gradient orbs */}
            <div style={{position:'absolute',top:'-20%',right:'-20%',width:300,height:300,borderRadius:'50%',background:'radial-gradient(circle,rgba(168,85,247,.25),transparent)',filter:'blur(50px)'}}/>
            <div style={{position:'absolute',bottom:'10%',left:'-10%',width:250,height:250,borderRadius:'50%',background:'radial-gradient(circle,rgba(99,102,241,.2),transparent)',filter:'blur(50px)'}}/>
            <div style={{position:'absolute',top:'40%',right:'20%',width:200,height:200,borderRadius:'50%',background:'radial-gradient(circle,rgba(236,72,153,.1),transparent)',filter:'blur(40px)'}}/>

            {/* Top */}
            <div style={{position:'relative',zIndex:1}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:3,color:'rgba(168,85,247,.6)',textTransform:'uppercase',marginBottom:8}}>Concert Ticket Platform · 2026</div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:22}}>🎵</span>
                <span style={{color:'#fff',fontSize:20,fontWeight:700,letterSpacing:1}}>{BRAND}</span>
              </div>
            </div>

            {/* Center visual */}
            <div style={{position:'relative',zIndex:1,textAlign:'center',padding:'20px 0'}}>
              <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:24}}>
                {["🎤","🎸","🥁","🎹","🎷"].map((e,i)=>(
                  <span key={i} style={{fontSize:28,opacity:.5+i*.1}}>{e}</span>
                ))}
              </div>
              <h2 style={{color:'#fff',fontSize:32,fontWeight:700,lineHeight:1.3,margin:'0 0 12px'}}>
                Your stage<br/>is waiting.
              </h2>
              <p style={{color:'rgba(255,255,255,.4)',fontSize:13,lineHeight:1.7,maxWidth:280,margin:'0 auto'}}>
                Book tickets, choose your zone, and experience live concerts like never before.
              </p>
            </div>

            {/* Bottom */}
            <div style={{position:'relative',zIndex:1}}>
              <div style={{borderTop:'1px dashed rgba(255,255,255,.1)',paddingTop:16,display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:'#a855f7'}}/>
                <span style={{fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:2,fontWeight:600,textTransform:'uppercase'}}>Your ticket to every concert</span>
              </div>
              <div style={{marginTop:14,fontSize:10,color:'rgba(255,255,255,.2)'}}>© 2026 {BRAND} · All Rights Reserved</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
