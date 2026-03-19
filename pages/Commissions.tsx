
import React, { useMemo } from 'react';
import { User, UserRole } from '../types';
import { getStore, formatCurrency, formatDate, UserSettings } from '../store';
import { Wallet, TrendingUp, Lock, ArrowUpRight, History, ShieldCheck } from 'lucide-react';

interface CommissionsProps {
  user: User;
  settings: UserSettings;
}

const Commissions: React.FC<CommissionsProps> = ({ user, settings }) => {
  const store = getStore();

  // Only Agents should see this page properly
  if (user.role !== UserRole.AGENT) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-12">
            <ShieldCheck size={64} className="text-zinc-300 mb-6" />
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white">Restricted Access</h2>
            <p className="text-zinc-500 text-sm mt-2">Commission tracking is reserved for verified agents.</p>
        </div>
    );
  }

  const myCommissions = useMemo(() => {
    return store.commissions.filter(c => c.agentId === user.id);
  }, [store.commissions, user.id]);

  const stats = useMemo(() => {
    const available = myCommissions.filter(c => c.status === 'PAID').reduce((acc, c) => acc + c.amount, 0);
    const locked = myCommissions.filter(c => c.status === 'LOCKED').reduce((acc, c) => acc + c.amount, 0);
    const total = available + locked;
    return { available, locked, total };
  }, [myCommissions]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">Earnings Vault</h1>
          <p className="text-zinc-500 font-medium">Track splits, locked commissions, and payouts.</p>
        </div>
        <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Agent Tier</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-200 to-amber-400 rounded-xl text-amber-900 font-black uppercase text-xs shadow-lg mt-1">
                {user.agentTier || 'STANDARD'}
            </div>
        </div>
      </header>

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 rounded-[2.5rem] bg-blue-600 text-white shadow-2xl shadow-blue-600/20 relative overflow-hidden">
            <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-4 flex items-center gap-2">
                    <Wallet size={14} /> Available Balance
                </p>
                <p className="text-4xl font-black tracking-tighter">{formatCurrency(user.walletBalance || 0, settings)}</p>
                <button className="mt-8 bg-white text-blue-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-colors">
                    Request Payout
                </button>
            </div>
            <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-zinc-900 text-white shadow-xl relative overflow-hidden border border-zinc-800">
            <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                    <Lock size={14} /> Locked Commissions
                </p>
                <p className="text-4xl font-black tracking-tighter text-zinc-200">{formatCurrency(stats.locked, settings)}</p>
                <p className="mt-8 text-[10px] text-zinc-500 font-bold">Unlocks upon transaction completion.</p>
            </div>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-white dark:bg-zinc-800 shadow-xl border border-zinc-100 dark:border-zinc-700">
             <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-500" /> Lifetime Earnings
            </p>
            <p className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">{formatCurrency(stats.total, settings)}</p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-bold text-emerald-500">
                <ArrowUpRight size={14} /> +12% vs last month
            </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 p-8 md:p-12 shadow-sm">
         <div className="flex items-center gap-4 mb-8">
            <History size={20} className="text-blue-600" />
            <h3 className="text-xl font-black text-zinc-900 dark:text-white">Transaction History</h3>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800">
                        <th className="pb-4 pl-4">Description</th>
                        <th className="pb-4">Date</th>
                        <th className="pb-4">Type</th>
                        <th className="pb-4 text-right pr-4">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {myCommissions.map(comm => (
                        <tr key={comm.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <td className="py-6 pl-4">
                                <p className="text-sm font-bold text-zinc-900 dark:text-white">{comm.description}</p>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{comm.status}</p>
                            </td>
                            <td className="py-6 text-xs font-medium text-zinc-500">{formatDate(comm.dateEarned, settings)}</td>
                            <td className="py-6">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                                    comm.type === 'LEASE' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                    comm.type === 'SALE' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    'bg-amber-50 text-amber-600 border-amber-100'
                                }`}>
                                    {comm.type}
                                </span>
                            </td>
                            <td className="py-6 text-right pr-4">
                                <span className={`text-sm font-black ${comm.status === 'LOCKED' ? 'text-zinc-400' : 'text-emerald-600'}`}>
                                    {comm.status === 'LOCKED' ? 'Locked' : '+'}{formatCurrency(comm.amount, settings)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {myCommissions.length === 0 && (
                <div className="text-center py-20 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                    No transactions recorded yet.
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Commissions;
