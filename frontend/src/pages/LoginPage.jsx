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
  const [form, setForm] = useState({ identifier: "", password: "", remember: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!form.identifier) e.identifier = true;
    if (!form.password) e.password = true;
    if (Object.keys(e).length) { setErrors(e); setErrorMessage("Please fill in required fields."); return; }
    setErrors({}); setErrorMessage(""); setLoading(true);
    try {
      const response = await api.login({ identifier: form.identifier, password: form.password });
      const payload = decodeToken(response.access_token);
      saveSession(response);
      navigate(payload?.role === "admin" ? "/admin" : "/concerts", { replace: true });
    } catch (err) {
      setErrorMessage(err.message || "Invalid credentials");
    } finally { setLoading(false); }
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

            <h1 style={{color:'#fff',fontSize:28,fontWeight:700,margin:'0 0 4px'}}>Welcome Back 👋</h1>
            <p style={{color:'rgba(255,255,255,.4)',fontSize:14,margin:'0 0 28px'}}>Sign in to your account to continue</p>

            {errorMessage && (
              <div style={{marginBottom:16,padding:'10px 14px',borderRadius:10,background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.2)',color:'#f87171',fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                ⚠ {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:18}}>
              <div>
                <label style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Email or Username</label>
                <div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,.25)',fontSize:16}}>✉</span>
                  <input value={form.identifier} onChange={set("identifier")} placeholder="you@email.com"
                    style={{width:'100%',padding:'12px 14px 12px 38px',borderRadius:10,border:`1px solid ${errors.identifier?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`,background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                </div>
              </div>

              <div>
                <label style={{display:'block',color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Password</label>
                <div style={{position:'relative'}}>
                  <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,.25)',fontSize:16}}>🔒</span>
                  <input type={showPw?'text':'password'} value={form.password} onChange={set("password")} placeholder="Your password"
                    style={{width:'100%',padding:'12px 42px 12px 38px',borderRadius:10,border:`1px solid ${errors.password?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`,background:'rgba(255,255,255,.04)',color:'#fff',fontSize:14,outline:'none'}} />
                  <button type="button" onClick={()=>setShowPw(s=>!s)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer'}}>
                    <EyeIcon open={showPw}/>
                  </button>
                </div>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,.4)',fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={form.remember} onChange={e=>setForm(f=>({...f,remember:e.target.checked}))} style={{accentColor:'#a855f7'}} />
                  Remember me
                </label>
                <button type="button" style={{background:'none',border:'none',color:'#a855f7',fontSize:12,cursor:'pointer'}}>Forgot Password?</button>
              </div>

              <button type="submit" disabled={loading} style={{
                width:'100%',padding:'13px',borderRadius:10,border:'none',
                background:'linear-gradient(135deg,#a855f7,#6366f1)',color:'#fff',
                fontSize:15,fontWeight:600,cursor:'pointer',letterSpacing:.5,
                boxShadow:'0 4px 20px rgba(168,85,247,.3)',
                transition:'transform .15s,box-shadow .15s'
              }}>
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <div style={{display:'flex',alignItems:'center',gap:12,margin:'4px 0'}}>
                <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
                <span style={{color:'rgba(255,255,255,.25)',fontSize:11,fontWeight:600}}>OR</span>
                <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
              </div>

              <button type="button" style={{
                width:'100%',padding:'12px',borderRadius:10,
                border:'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.03)',
                color:'rgba(255,255,255,.6)',fontSize:13,fontWeight:500,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:8
              }}>
                <svg style={{width:16,height:16}} viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign In with Google
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
