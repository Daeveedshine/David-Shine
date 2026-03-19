
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { getStore, saveStore } from './store';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Properties from './pages/Properties';
import Maintenance from './pages/Maintenance';
import Payments from './pages/Payments';
import Agreements from './pages/Agreements';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Applications from './pages/Applications';
import Screenings from './pages/Screenings';
import AdminApplications from './pages/AdminApplications';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Commissions from './pages/Commissions';
import Network from './pages/Network';
import { 
  Home, Building2, Wrench, CreditCard, LogOut, Menu, X, Shield, 
  FileText, Bell, Table, Building, ClipboardCheck, UserPlus, 
  User as UserIcon, Moon, Sun, ChevronLeft, ChevronRight, Settings as SettingsIcon,
  Wallet, Network as NetworkIcon, AlertCircle
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc, collection, query, where, orderBy } from 'firebase/firestore';

export const Logo: React.FC<{ size?: number, className?: string }> = ({ size = 24, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M50 30V70" 
      stroke="currentColor" 
      strokeWidth="8" 
      strokeLinecap="round"
    />
    <path 
      d="M50 30C50 18.9543 58.9543 10 70 10C81.0457 10 90 18.9543 90 30V50" 
      stroke="currentColor" 
      strokeWidth="8" 
      strokeLinecap="round"
    />
    <path 
      d="M50 70C50 81.0457 41.0457 90 30 90C18.9543 90 10 81.0457 10 70V50" 
      stroke="currentColor" 
      strokeWidth="8" 
      strokeLinecap="round"
    />
    <circle cx="70" cy="30" r="6" fill="currentColor" />
    <circle cx="30" cy="70" r="6" fill="currentColor" />
  </svg>
);

const SplashScreen: React.FC = () => (
  <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center text-white transition-opacity duration-1000 overflow-hidden">
    <video 
      autoPlay muted loop playsInline 
      className="absolute inset-0 w-full h-full object-cover scale-105 opacity-40"
    >
      <source src="https://assets.mixkit.co/videos/preview/mixkit-drone-view-of-a-mansion-with-a-pool-and-garden-4286-large.mp4" type="video/mp4" />
    </video>
    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
    <div className="relative z-10 animate-pulse-gentle flex flex-col items-center text-center px-6">
      <div className="bg-white/10 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/20 shadow-2xl mb-8 transform hover:scale-105 transition-transform duration-500">
        <Logo size={64} className="text-white" />
      </div>
      <h1 className="text-6xl font-semibold tracking-tighter mb-2 drop-shadow-xl text-white">SPACEYA</h1>
      <p className="text-blue-400 font-playfair tracking-widest text-lg italic">Your Space, Handled</p>
    </div>
  </div>
);

const ErrorBoundary: React.FC<{ error: string }> = ({ error }) => {
  let displayMessage = "An unexpected error occurred.";
  try {
    const parsed = JSON.parse(error);
    if (parsed.error.includes("insufficient permissions")) {
      displayMessage = "You don't have permission to perform this action.";
    } else {
      displayMessage = parsed.error;
    }
  } catch (e) {
    displayMessage = error;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[10000] bg-rose-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
      <AlertCircle size={20} />
      <div className="text-xs font-bold uppercase tracking-widest">{displayMessage}</div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [settings, setSettings] = useState(getStore().settings);
  const [appError, setAppError] = useState<string | null>(null);

  // Sync Settings Function
  const syncVisualSettings = () => {
    const store = getStore();
    setSettings(store.settings);
    const { appearance } = store.settings;
    
    document.documentElement.classList.toggle('disable-animations', !appearance.animations);
    document.documentElement.classList.toggle('ui-compact', appearance.density === 'compact');
    document.documentElement.classList.toggle('no-glass', !appearance.glassEffect);
  };

  useEffect(() => {
    const store = getStore();
    const savedTheme = store.theme || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    
    // Check for Referral Link in URL
    const params = new URLSearchParams(window.location.search);
    const refAgentId = params.get('ref');
    if (refAgentId) {
      localStorage.setItem('referral_agent_id', refAgentId);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Initial sync
    syncVisualSettings();

    // Firebase Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid);
      try {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setUser(userData);
            if (userData.role === UserRole.ADMIN) setView('admin_dashboard');
            
            // Listen for notifications
            const q = query(
              collection(db, 'notifications'),
              where('userId', '==', firebaseUser.uid),
              orderBy('timestamp', 'desc')
            );

            const unsubscribeNotifications = onSnapshot(
              q,
              (snapshot) => {
                const unread = snapshot.docs.filter(d => !d.data().isRead).length;
                setUnreadCount(unread);
                
                // Sync with local store for components still using it
                const store = getStore();
                store.notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
                saveStore(store);
              },
              (error) => {
                // Ignore initial permission errors if collection doesn't exist yet or user is unauthorized
                if (!error.message.includes('permission-denied')) {
                  handleFirestoreError(error, OperationType.GET, 'notifications');
                }
              }
            );

            // Note: We can't return cleanup from async callback, so we'd need to manage this listener globally
            // For now, we'll just let it be, but in a real app we'd store it in a ref.
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth listener error:', error);
        setAppError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoading(false);
      }
    });

    // Safety timeout to ensure splash screen disappears
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    return () => {
      unsubscribeAuth();
      clearTimeout(timeout);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    const store = getStore();
    store.theme = newTheme;
    saveStore(store);
  };

  const refreshUnreadCount = () => {
    // This is now handled by the onSnapshot listener in useEffect
  };

  const handleLogin = (loggedUser: User) => {
    setUser(loggedUser);
    const pendingReferralId = localStorage.getItem('referral_agent_id');
    if (pendingReferralId && loggedUser.role === UserRole.TENANT) {
      setView('applications');
    } else {
      setView(loggedUser.role === UserRole.ADMIN ? 'admin_dashboard' : 'dashboard');
    }
    refreshUnreadCount();
    syncVisualSettings();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error));
    }
  };

  const renderView = () => {
    if (!user) return null;
    
    switch (view) {
      case 'admin_dashboard': return <AdminDashboard user={user} settings={settings} onNavigate={setView} />;
      case 'dashboard': return <Dashboard user={user} settings={settings} />;
      case 'properties': return <Properties user={user} settings={settings} />;
      case 'maintenance': return <Maintenance user={user} />;
      case 'payments': return <Payments user={user} />;
      case 'agreements': return <Agreements user={user} />;
      case 'notifications': return <Notifications user={user} onRefreshCount={refreshUnreadCount} onNavigate={setView} />;
      case 'reports': return <Reports user={user} settings={settings} />;
      case 'applications': return <Applications user={user} settings={settings} onNavigate={setView} />;
      case 'screenings': return <Screenings user={user} settings={settings} onNavigate={setView} />;
      case 'admin_applications': return <AdminApplications user={user} settings={settings} onBack={() => setView('admin_dashboard')} />;
      case 'commissions': return <Commissions user={user} settings={settings} />;
      case 'network': return <Network user={user} settings={settings} />;
      case 'profile': return <Profile user={user} onUserUpdate={setUser} />;
      case 'settings': return <Settings user={user} onThemeChange={setTheme} onSettingsUpdate={syncVisualSettings} />;
      default: return <Dashboard user={user} settings={settings} />;
    }
  };

  const navItems = [
    { id: 'admin_dashboard', label: 'Admin Panel', icon: Shield, roles: [UserRole.ADMIN] },
    { id: 'dashboard', label: 'Overview', icon: Home, roles: [UserRole.AGENT, UserRole.TENANT] },
    { id: 'applications', label: 'Apply Now', icon: UserPlus, roles: [UserRole.TENANT] },
    { id: 'properties', label: 'Properties', icon: Building2, roles: [UserRole.AGENT, UserRole.ADMIN, UserRole.TENANT] },
    { id: 'commissions', label: 'Vault & Earnings', icon: Wallet, roles: [UserRole.AGENT] },
    { id: 'network', label: 'Network', icon: NetworkIcon, roles: [UserRole.AGENT] },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, roles: [UserRole.AGENT, UserRole.TENANT, UserRole.ADMIN] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: [UserRole.AGENT, UserRole.TENANT, UserRole.ADMIN], badge: unreadCount },
    { id: 'agreements', label: 'Agreements (Soon)', icon: FileText, roles: [UserRole.AGENT, UserRole.TENANT, UserRole.ADMIN] },
    { id: 'payments', label: 'Rent & Payments', icon: CreditCard, roles: [UserRole.AGENT, UserRole.TENANT, UserRole.ADMIN] },
    { id: 'screenings', label: 'Screenings', icon: ClipboardCheck, roles: [UserRole.AGENT, UserRole.ADMIN] },
    { id: 'reports', label: 'Global Registry', icon: Table, roles: [UserRole.AGENT, UserRole.ADMIN] },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, roles: [UserRole.AGENT, UserRole.TENANT, UserRole.ADMIN] },
    { id: 'profile', label: 'My Profile', icon: UserIcon, roles: [UserRole.AGENT, UserRole.TENANT, UserRole.ADMIN] },
  ];

  if (isLoading) return <SplashScreen />;

  return (
    <div className="flex flex-col md:flex-row h-screen text-zinc-900 dark:text-white transition-colors duration-300 overflow-hidden relative">
      {appError && <ErrorBoundary error={appError} />}
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <>
          {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between glass-card p-4 shadow-sm shrink-0 z-[60] border-b border-white/10">
        <div className="flex items-center gap-2">
           <Logo size={24} className="text-blue-600 dark:text-blue-400" />
           <h1 className="font-bold text-lg tracking-tighter">SPACEYA</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-white/10 dark:bg-black/20 text-zinc-500 dark:text-zinc-400 active:scale-95 transition-transform"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="p-2.5 rounded-xl bg-blue-600 text-white active:scale-95 transition-transform"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        fixed inset-y-0 left-0 z-[100] w-[85%] sm:w-72 md:w-auto glass-card text-zinc-900 dark:text-zinc-100 transition-all duration-300 ease-out 
        md:translate-x-0 md:static md:inset-auto print:hidden flex flex-col shrink-0
        border-r border-white/20 dark:border-white/5 
        bg-white/90 dark:bg-zinc-950/95 md:bg-inherit
        ${!isSidebarCollapsed ? 'md:w-72' : 'md:w-24'}
      `}>
        <div className={`p-6 md:p-8 h-full flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
          <div className={`mb-8 md:mb-10 ${isSidebarCollapsed ? 'text-center' : ''}`}>
            <div className={`inline-block bg-blue-600/10 dark:bg-blue-400/10 p-4 rounded-[1.5rem] border border-blue-600/20 transition-all ${isSidebarCollapsed ? 'p-3' : 'md:p-5'}`}>
               <Logo size={isSidebarCollapsed ? 28 : 36} className="text-blue-600 dark:text-blue-400" />
            </div>
            {!isSidebarCollapsed && (
              <div className="mt-4">
                <h1 className="text-xl md:text-2xl font-bold tracking-tighter text-zinc-900 dark:text-white truncate">SPACEYA</h1>
                <div className="flex items-center gap-2 mt-1">
                   <p className="text-[9px] md:text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.3em] font-black opacity-60">Property Manager</p>
                   <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        user.role === UserRole.AGENT ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                        user.role === UserRole.ADMIN ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {user.role}
                   </span>
                </div>
              </div>
            )}
          </div>

          <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {navItems.filter(item => item.roles.includes(user?.role || UserRole.TENANT)).map(item => (
              <button
                key={item.id}
                title={isSidebarCollapsed ? item.label : ''}
                onClick={() => { setView(item.id); setIsMobileMenuOpen(false); }}
                className={`
                  w-full flex items-center font-bold rounded-2xl transition-all relative group
                  ${isSidebarCollapsed ? 'justify-center p-3.5 md:p-4 mb-2' : 'px-4 py-3.5 md:px-5 md:py-4 text-[13px] md:text-xs'}
                  ${view === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 scale-[1.02]' : 'text-zinc-500 dark:text-zinc-400 hover:bg-white/10 dark:hover:bg-black/30 hover:text-blue-600 dark:hover:text-blue-400'}
                `}
              >
                <item.icon className={`${isSidebarCollapsed ? '' : 'mr-4'} h-5 w-5 shrink-0 ${view === item.id ? 'text-white' : 'text-zinc-400 group-hover:text-blue-600'}`} /> 
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                
                {item.badge && !isSidebarCollapsed ? (
                  <span className="ml-auto bg-blue-600 dark:bg-blue-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black border border-white/20">
                    {item.badge}
                  </span>
                ) : item.badge && isSidebarCollapsed ? (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border border-white dark:border-zinc-900"></span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className={`pt-6 border-t border-zinc-200 dark:border-white/10 mt-6 space-y-2 shrink-0 ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
             <button 
               onClick={toggleTheme}
               title={isSidebarCollapsed ? "Toggle Theme" : ""}
               className={`w-full flex items-center font-bold text-zinc-500 dark:text-zinc-400 hover:bg-white/10 dark:hover:bg-black/30 rounded-2xl transition-all ${isSidebarCollapsed ? 'justify-center p-3.5' : 'px-5 py-3.5 text-xs'}`}
             >
               {theme === 'light' ? <Moon className={`${isSidebarCollapsed ? '' : 'mr-4'} h-5 w-5`} /> : <Sun className={`${isSidebarCollapsed ? '' : 'mr-4'} h-5 w-5`} />}
               {!isSidebarCollapsed && "Toggle Theme"}
             </button>
             
             <button 
               onClick={handleLogout} 
               title={isSidebarCollapsed ? "Sign Out" : ""}
               className={`w-full flex items-center font-bold text-zinc-500 dark:text-zinc-400 hover:text-rose-500 rounded-2xl transition-colors ${isSidebarCollapsed ? 'justify-center p-3.5' : 'px-5 py-3.5 text-xs'}`}
             >
               <LogOut className={`${isSidebarCollapsed ? '' : 'mr-4'} h-5 w-5`} /> 
               {!isSidebarCollapsed && "Sign Out"}
             </button>

             {/* Desktop Collapse Toggle */}
             <button 
               onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
               className="hidden md:flex w-full items-center justify-center p-3.5 text-zinc-400 hover:text-blue-600 hover:bg-white/10 rounded-2xl transition-all"
             >
               {isSidebarCollapsed ? <ChevronRight size={20} /> : <div className="flex items-center gap-2"><ChevronLeft size={20} /><span className="text-[10px] uppercase font-black tracking-widest">Collapse Menu</span></div>}
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-10 print:p-0 transition-all duration-300 relative z-10 bg-offwhite dark:bg-transparent">
        <div className="max-w-7xl mx-auto h-full">{renderView()}</div>
      </main>
        </>
      )}
    </div>
  );
};

export default App;
