
import React, { useMemo } from 'react';
import { User, UserRole } from '../types';
import { getStore, formatCurrency, UserSettings } from '../store';
import { Users, Share2, Copy, Trophy, Network as NetworkIcon } from 'lucide-react';

interface NetworkProps {
  user: User;
  settings: UserSettings;
}

const Network: React.FC<NetworkProps> = ({ user, settings }) => {
  const store = getStore();

  if (user.role !== UserRole.AGENT) return null;

  const myReferrals = useMemo(() => {
    return store.referrals.filter(r => r.referrerAgentId === user.id);
  }, [store.referrals, user.id]);

  const networkStats = useMemo(() => {
    return {
        total: myReferrals.length,
        converted: myReferrals.filter(r => r.status === 'CONVERTED').length,
        earnings: myReferrals.reduce((acc, r) => acc + r.commissionEarned, 0)
    };
  }, [myReferrals]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
        <header>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">Network Economy</h1>
          <p className="text-zinc-500 font-medium">Manage downstream agents and client referrals.</p>
        </header>

        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] p-10 md:p-14 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Your Referral Code</p>
                    <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                        <span className="text-3xl font-mono font-black tracking-widest">{user.referralCode || 'GEN-CODE'}</span>
                        <button className="p-2 hover:bg-white/20 rounded-lg transition-colors"><Copy size={20}/></button>
                    </div>
                </div>
                <div className="flex items-center gap-8">
                    <div className="text-center">
                        <p className="text-3xl font-black">{networkStats.total}</p>
                        <p className="text-[10px] uppercase font-bold opacity-60">Invites</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black">{networkStats.converted}</p>
                        <p className="text-[10px] uppercase font-bold opacity-60">Active</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black">{formatCurrency(networkStats.earnings, settings)}</p>
                        <p className="text-[10px] uppercase font-bold opacity-60">Earned</p>
                    </div>
                </div>
            </div>
            <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <NetworkIcon size={20} className="text-indigo-600" />
                    <h3 className="font-black text-lg text-zinc-900 dark:text-white">Direct Downlines</h3>
                </div>
                <div className="space-y-4">
                    {myReferrals.length > 0 ? myReferrals.map(ref => {
                        const refUser = store.users.find(u => u.id === ref.referredUserId);
                        return (
                            <div key={ref.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-black text-xs">
                                        {refUser?.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-zinc-900 dark:text-white">{refUser?.name || 'Unknown User'}</p>
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase">{ref.status}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black text-emerald-500">+{formatCurrency(ref.commissionEarned, settings)}</span>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-10 text-zinc-400 text-xs font-bold">No referrals yet. Share your code!</div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <Trophy size={20} className="text-amber-500" />
                    <h3 className="font-black text-lg text-zinc-900 dark:text-white">Tier Progress</h3>
                </div>
                <div className="space-y-6">
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-zinc-500 uppercase">Current: {user.agentTier || 'BRONZE'}</span>
                        <span className="text-xs font-bold text-amber-600 uppercase">Next: SILVER</span>
                    </div>
                    <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 w-[65%] rounded-full"></div>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                        Complete 3 more deals to unlock Silver Tier status. Benefits include 5% commission bonus multiplier and priority listing visibility.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Network;
