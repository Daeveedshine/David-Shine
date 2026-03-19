
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { getStore, saveStore } from '../store';
import { User as UserIcon, Mail, Phone, Shield, Fingerprint, Save, CheckCircle2, AlertCircle, Copy, Check, Link as LinkIcon } from 'lucide-react';

interface ProfileProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUserUpdate }) => {
  const [name, setName] = useState(user.name);
  const [userPhone, setUserPhone] = useState(user.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    setTimeout(() => {
      const store = getStore();
      const updatedUser = { ...user, name, phone: userPhone };
      
      const updatedUsers = store.users.map(u => u.id === user.id ? updatedUser : u);
      const newState = { ...store, users: updatedUsers, currentUser: updatedUser };
      
      saveStore(newState);
      onUserUpdate(updatedUser);
      setIsSaving(false);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    }, 1000);
  };

  const handleCopyId = () => {
    const idToCopy = user.displayUID || user.id;
    if (idToCopy) {
        navigator.clipboard.writeText(idToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
      const idToCopy = user.displayUID || user.id;
      if (idToCopy) {
          const url = `${window.location.origin}?ref=${idToCopy}`;
          navigator.clipboard.writeText(url);
          setLinkCopied(true);
          setTimeout(() => setLinkCopied(false), 2000);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-black text-white">My Profile</h1>
        <p className="text-zinc-500 font-medium">Manage your personal identification and suite settings.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          {/* Identity Card */}
          <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 flex flex-col items-center text-center shadow-2xl">
            <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-zinc-300 border border-zinc-200 text-3xl font-black shadow-lg mb-6">
              {user.name.charAt(0)}
            </div>
            <h2 className="text-2xl font-black text-white">{user.name}</h2>
            <div className="mt-2 inline-flex items-center px-4 py-1.5 bg-blue-600/10 text-blue-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
              <Shield size={12} className="mr-2" /> {user.role}
            </div>
            
            <div className="mt-8 w-full pt-8 border-t border-zinc-800 space-y-6">
               <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Unique Suite ID</p>
                  <div className="bg-black p-3 rounded-xl border border-zinc-800 flex items-center justify-between group">
                    <span className="text-sm font-mono font-bold text-blue-400">{user.displayUID || user.id}</span>
                    <button 
                        onClick={handleCopyId}
                        className="p-2 text-zinc-600 hover:text-white transition-colors rounded-lg active:scale-95"
                        title="Copy ID"
                    >
                        {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="mt-2 text-[9px] text-zinc-600 font-medium italic">Use this ID to receive applications or link properties.</p>
               </div>

               {user.role === UserRole.AGENT && (
                 <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Tenant Onboarding Link</p>
                    <div className="bg-blue-900/10 p-3 rounded-xl border border-blue-600/20 flex items-center justify-between group cursor-pointer" onClick={handleCopyLink}>
                      <div className="flex items-center gap-2 overflow-hidden">
                          <LinkIcon size={14} className="text-blue-500 shrink-0" />
                          <span className="text-xs font-medium text-blue-400 truncate">spaceya.app?ref={user.displayUID || user.id}</span>
                      </div>
                      <button 
                          className="p-2 text-blue-400 hover:text-white transition-colors rounded-lg"
                      >
                          {linkCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="mt-2 text-[9px] text-zinc-600 font-medium italic">Share this link. New tenants will be auto-routed to your application inbox.</p>
                 </div>
               )}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          {/* Settings Panel */}
          <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl border border-zinc-200">
             <div className="flex justify-between items-center mb-8">
               <h3 className="text-xl font-black text-black">General Settings</h3>
               {showSaved && (
                 <div className="flex items-center text-emerald-600 text-xs font-black uppercase animate-in fade-in slide-in-from-right-4">
                   <CheckCircle2 size={16} className="mr-2" /> Changes Saved
                 </div>
               )}
             </div>

             <form onSubmit={handleUpdate} className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Full Legal Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        className="w-full pl-11 pr-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold text-black"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Contact Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        className="w-full pl-11 pr-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold text-black"
                        value={userPhone}
                        onChange={e => setUserPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Account Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      className="w-full pl-11 pr-5 py-4 bg-zinc-100 border border-zinc-100 rounded-2xl text-sm font-bold text-zinc-500 cursor-not-allowed"
                      value={user.email}
                      disabled
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-zinc-400 font-medium ml-1">Email changes require admin verification.</p>
                </div>

                <div className="pt-8 border-t border-zinc-100 flex justify-end">
                   <button 
                     type="submit"
                     disabled={isSaving}
                     className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl shadow-blue-900/20 flex items-center disabled:opacity-50"
                   >
                     {isSaving ? 'Processing...' : (
                       <><Save size={16} className="mr-2" /> Commit Changes</>
                     )}
                   </button>
                </div>
             </form>
          </div>

          <div className="mt-8 bg-zinc-950 p-8 rounded-[2.5rem] border border-zinc-900 flex items-start space-x-4">
             <div className="p-3 bg-amber-600/10 text-amber-500 rounded-xl">
                <AlertCircle size={24} />
             </div>
             <div>
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Security Notice</h4>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">Ensure your Unique Suite ID is only shared with trusted tenants. This ID serves as your global routing key for all digital applications in the suite.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
