
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { getStore, saveStore } from '../store';
import { Apple, Mail, Phone, ArrowRight, Home, Users, UserCheck, Smartphone, Lock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '../App';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.TENANT);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [tempFirebaseUser, setTempFirebaseUser] = useState<any>(null);

  const generateDisplayUID = (role: UserRole) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const prefix = role === UserRole.AGENT ? 'AGT' : role === UserRole.TENANT ? 'TNT' : 'USR';
    return `${prefix}-${randomPart}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        onLogin(userDoc.data() as User);
      } else {
        setError('Profile not found. Please complete registration.');
        setTempFirebaseUser(userCredential.user);
        setNeedsProfileCompletion(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser: User = { 
        id: userCredential.user.uid, 
        displayUID: generateDisplayUID(role),
        name, 
        email, 
        role, 
        phone,
        isVerified: false,
        walletBalance: 0
      };
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      onLogin(newUser);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (userDoc.exists()) {
        onLogin(userDoc.data() as User);
      } else {
        // New user from Google, need to set role
        setTempFirebaseUser(result.user);
        setNeedsProfileCompletion(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async () => {
    if (!tempFirebaseUser) return;
    setLoading(true);
    try {
      const newUser: User = {
        id: tempFirebaseUser.uid,
        displayUID: generateDisplayUID(role),
        name: tempFirebaseUser.displayName || name || 'New User',
        email: tempFirebaseUser.email || email,
        role: role,
        phone: phone || '',
        isVerified: false,
        walletBalance: 0
      };
      await setDoc(doc(db, 'users', tempFirebaseUser.uid), newUser);
      onLogin(newUser);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (needsProfileCompletion) {
    return (
      <div className="h-[100dvh] w-full relative overflow-y-auto bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card rounded-[3rem] p-8 md:p-14 space-y-8 animate-in fade-in slide-in-from-bottom-12 duration-700">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h2>
            <p className="text-zinc-400 text-sm">Select your role to continue</p>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setRole(UserRole.TENANT)} className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${role === UserRole.TENANT ? 'border-blue-600 bg-blue-600/20 text-white' : 'border-white/5 bg-white/5 text-zinc-500 opacity-60'}`}>
                <Users size={24} className="mb-2" />
                <span className="text-[10px] font-black uppercase">Tenant</span>
              </button>
              <button onClick={() => setRole(UserRole.AGENT)} className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${role === UserRole.AGENT ? 'border-blue-600 bg-blue-600/20 text-white' : 'border-white/5 bg-white/5 text-zinc-500 opacity-60'}`}>
                <UserCheck size={24} className="mb-2" />
                <span className="text-[10px] font-black uppercase">Agent</span>
              </button>
            </div>
            
            <button onClick={completeProfile} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-3xl flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" /> : 'Get Started'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full relative overflow-y-auto bg-black custom-scrollbar">
      {/* Fixed Background Elements */}
      <video autoPlay muted loop playsInline className="fixed inset-0 w-full h-full object-cover z-0 opacity-40 grayscale blur-[2px]">
        <source src="https://assets.mixkit.co/videos/preview/mixkit-drone-shot-of-a-small-modern-house-in-the-forest-4309-large.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-1"></div>

      {/* Scrollable Content Wrapper */}
      <div className="relative z-10 min-h-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 pb-24 md:pb-32">
        <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="glass-card rounded-[3rem] md:rounded-[4.5rem] shadow-[0_32px_128px_rgba(0,0,0,0.5)] overflow-hidden border-white/20 dark:border-white/5">
            <div className="bg-black/40 backdrop-blur-3xl p-8 md:p-14 text-center border-b border-white/10">
              <div className="flex justify-center mb-6 md:mb-10">
                <div className="bg-white/10 p-5 md:p-6 rounded-[1.8rem] md:rounded-[2.5rem] backdrop-blur-3xl border border-white/20 shadow-2xl animate-pulse-gentle">
                  <Logo size={44} className="text-white" />
                </div>
              </div>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tighter text-white">SPACEYA</h2>
              <p className="mt-2 text-blue-400 font-playfair italic text-base md:text-lg tracking-widest opacity-80">Your Space, Handled</p>
            </div>
            
            <div className="flex bg-black/20 backdrop-blur-md">
              <button 
                onClick={() => { setIsRegistering(false); setError(''); }} 
                className={`flex-1 py-5 md:py-7 text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all border-b-2 ${!isRegistering ? 'text-white bg-white/10 border-blue-600' : 'text-zinc-500 border-transparent hover:text-white'}`}
              >
                Sign In
              </button>
              <button 
                onClick={() => { setIsRegistering(true); setError(''); }} 
                className={`flex-1 py-5 md:py-7 text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all border-b-2 ${isRegistering ? 'text-white bg-white/10 border-blue-600' : 'text-zinc-500 border-transparent hover:text-white'}`}
              >
                Register
              </button>
            </div>

            <div className="p-8 md:p-14 bg-transparent space-y-8">
              {error && (
                <div className="bg-rose-500/20 text-rose-200 p-5 rounded-2xl text-[10px] font-black uppercase border border-rose-500/30 flex items-center gap-3 backdrop-blur-md animate-in shake duration-500">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              
              <form className="space-y-6" onSubmit={isRegistering ? handleRegister : handleLogin}>
                {isRegistering && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="space-y-4">
                      <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2 ml-1 opacity-60">Identity Tier</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setRole(UserRole.TENANT)} className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${role === UserRole.TENANT ? 'border-blue-600 bg-blue-600/20 text-white' : 'border-white/5 bg-white/5 text-zinc-500 opacity-60 hover:opacity-100'}`}>
                          <Users size={24} className="mb-2" />
                          <span className="text-[10px] font-black uppercase">Tenant</span>
                        </button>
                        <button type="button" onClick={() => setRole(UserRole.AGENT)} className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all ${role === UserRole.AGENT ? 'border-blue-600 bg-blue-600/20 text-white' : 'border-white/5 bg-white/5 text-zinc-500 opacity-60 hover:opacity-100'}`}>
                          <UserCheck size={24} className="mb-2" />
                          <span className="text-[10px] font-black uppercase">Agent</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1 opacity-60">Legal Name</label>
                      <input required className="glass-input w-full p-5 rounded-2xl text-white text-sm font-bold outline-none" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1 opacity-60">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input type="tel" className="glass-input w-full pl-14 pr-5 py-5 rounded-2xl text-white text-sm font-bold outline-none" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1 opacity-60">Email Protocol</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input required type="email" className="glass-input w-full pl-14 pr-5 py-5 rounded-2xl text-white text-sm font-bold outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1 opacity-60">Security Key</label>
                    <div className="relative">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input required type="password" title="Password" className="glass-input w-full pl-14 pr-5 py-5 rounded-2xl text-white text-sm font-bold outline-none" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                  </div>

                  {isRegistering && (
                    <div className="animate-in fade-in duration-500">
                      <label className="block text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1 opacity-60">Confirm Key</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input required type="password" title="Confirm Password" className="glass-input w-full pl-14 pr-5 py-5 rounded-2xl text-white text-sm font-bold outline-none" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-6 rounded-3xl shadow-2xl shadow-blue-600/30 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] mt-4 disabled:opacity-50">
                  {loading ? <Loader2 className="animate-spin" /> : (isRegistering ? 'Register Lifecycle' : 'Access Vault')} <ArrowRight className="ml-3 w-5 h-5" />
                </button>
              </form>

              <div className="flex items-center gap-4 py-4">
                <div className="flex-1 h-px bg-white/10"></div>
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">or bridge via</span>
                <div className="flex-1 h-px bg-white/10"></div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={handleGoogleAuth} disabled={loading} className="flex-1 py-5 glass-input text-white rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50">
                  {loading ? <Loader2 className="animate-spin" /> : <><GoogleIcon /> Google</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;