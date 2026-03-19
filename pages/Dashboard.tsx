
import React, { useMemo, useEffect, useState } from 'react';
import { User, UserRole, PropertyStatus, TicketStatus, ApplicationStatus, Property, MaintenanceTicket, Payment, Commission, Agreement, Notification, TenantApplication } from '../types';
import { getStore, formatCurrency, formatDate, UserSettings } from '../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building, Wallet, Star, UserPlus, Clock, Wrench, FileText, Bell, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

interface DashboardProps {
  user: User;
  settings: UserSettings;
}

const Dashboard: React.FC<DashboardProps> = ({ user, settings }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const store = getStore();
  const isDark = store.theme === 'dark';

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    // Properties
    const qProps = user.role === UserRole.AGENT 
      ? query(collection(db, 'properties'), where('agentId', '==', user.id))
      : query(collection(db, 'properties'), where('tenantId', '==', user.id));
    
    unsubscribes.push(onSnapshot(qProps, (s) => setProperties(s.docs.map(d => ({ id: d.id, ...d.data() } as Property))), 
      (e) => !e.message.includes('permission-denied') && handleFirestoreError(e, OperationType.GET, 'properties')));

    // Tickets
    const qTickets = user.role === UserRole.AGENT
      ? query(collection(db, 'tickets')) // Agents see all tickets for their properties (simplified)
      : query(collection(db, 'tickets'), where('tenantId', '==', user.id));
    
    unsubscribes.push(onSnapshot(qTickets, (s) => setTickets(s.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceTicket))),
      (e) => !e.message.includes('permission-denied') && handleFirestoreError(e, OperationType.GET, 'tickets')));

    // Commissions (Agent only)
    if (user.role === UserRole.AGENT) {
      const qComm = query(collection(db, 'commissions'), where('agentId', '==', user.id));
      unsubscribes.push(onSnapshot(qComm, (s) => setCommissions(s.docs.map(d => ({ id: d.id, ...d.data() } as Commission))),
        (e) => !e.message.includes('permission-denied') && handleFirestoreError(e, OperationType.GET, 'commissions')));
      
      const qApps = query(collection(db, 'applications'), where('agentId', '==', user.id));
      unsubscribes.push(onSnapshot(qApps, (s) => setApplications(s.docs.map(d => ({ id: d.id, ...d.data() } as any))),
        (e) => !e.message.includes('permission-denied') && handleFirestoreError(e, OperationType.GET, 'applications')));
    }

    // Payments & Agreements (Tenant only)
    if (user.role === UserRole.TENANT) {
      const qPay = query(collection(db, 'payments'), where('tenantId', '==', user.id));
      unsubscribes.push(onSnapshot(qPay, (s) => setPayments(s.docs.map(d => ({ id: d.id, ...d.data() } as Payment))),
        (e) => !e.message.includes('permission-denied') && handleFirestoreError(e, OperationType.GET, 'payments')));

      const qAgree = query(collection(db, 'agreements'), where('tenantId', '==', user.id));
      unsubscribes.push(onSnapshot(qAgree, (s) => setAgreements(s.docs.map(d => ({ id: d.id, ...d.data() } as Agreement))),
        (e) => !e.message.includes('permission-denied') && handleFirestoreError(e, OperationType.GET, 'agreements')));
    }

    // Notifications
    const qNotify = query(collection(db, 'notifications'), where('userId', '==', user.id), orderBy('timestamp', 'desc'), limit(5));
    unsubscribes.push(onSnapshot(qNotify, (s) => {
      setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    }, (e) => !e.message.includes('permission-denied') && handleFirestoreError(e, OperationType.GET, 'notifications')));

    return () => unsubscribes.forEach(u => u());
  }, [user.id, user.role]);

  const stats = useMemo(() => {
    if (user.role === UserRole.AGENT) {
      const revenue = commissions
        .filter(c => c.status === 'PAID')
        .reduce((acc, curr) => acc + curr.amount, 0);
        
      return {
        totalProperties: properties.length,
        walletBalance: formatCurrency(user.walletBalance || 0, settings),
        pendingTickets: tickets.filter(t => t.status === TicketStatus.OPEN).length, 
        monthlyRevenue: formatCurrency(revenue, settings),
        pendingApps: applications.filter(a => a.status === ApplicationStatus.PENDING).length,
        reputation: user.reputationScore || 0
      };
    } else {
      const myProperty = properties.find(p => p.id === user.assignedPropertyId);
      const myTickets = tickets;
      const myPayments = payments;
      const leaseEndDate = agreements[0]?.endDate;
      
      return {
        propertyName: myProperty?.name || 'N/A',
        rentStatus: myPayments.find(p => p.status === 'pending') ? 'Pending' : 'Paid',
        activeTickets: myTickets.filter(t => t.status !== TicketStatus.RESOLVED).length,
        leaseExpiry: leaseEndDate ? formatDate(leaseEndDate, settings) : 'N/A'
      };
    }
  }, [user, properties, tickets, payments, commissions, applications, agreements, settings]);

  const recentNotifications = useMemo(() => {
    return notifications.slice(0, 3);
  }, [notifications]);

  const paymentData = useMemo(() => {
    // Scaling graph data based on currency setting
    const scale = settings.localization.currency === 'NGN' ? 1 : (settings.localization.currency === 'USD' ? 0.00065 : 0.0006);
    return [
      { name: 'Jan', amount: 4000000 * scale },
      { name: 'Feb', amount: 3000000 * scale },
      { name: 'Mar', amount: 2000000 * scale },
      { name: 'Apr', amount: 2780000 * scale },
      { name: 'May', amount: 1890000 * scale },
      { name: 'Jun', amount: 2390000 * scale },
    ];
  }, [settings.localization.currency]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-12">
      <header>
        <h1 className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">Overview</h1>
        <p className="text-zinc-500 font-medium tracking-tight mt-1">Lifecycle monitoring for {user.name}.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {user.role === UserRole.AGENT ? (
          <>
            <StatCard label="Portfolio Assets" value={stats.totalProperties} icon={Building} color="blue" />
            <StatCard label="Wallet Balance" value={stats.walletBalance} icon={Wallet} color="emerald" />
            <StatCard label="Reputation" value={`${stats.reputation}/100`} icon={Star} color="orange" />
            <StatCard label="Active Pipeline" value={stats.pendingApps} icon={UserPlus} color="purple" />
          </>
        ) : (
          <>
            <StatCard label="Property" value={stats.propertyName} icon={Building} color="blue" />
            <StatCard label="Rent Status" value={stats.rentStatus} icon={Clock} color="purple" />
            <StatCard label="Maintenance" value={stats.activeTickets} icon={Wrench} color="orange" />
            <StatCard label="Expiry" value={stats.leaseExpiry} icon={FileText} color="emerald" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8 rounded-[3rem] shadow-2xl">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">Revenue Lifecycle</h3>
            <div className="bg-blue-600/10 dark:bg-blue-400/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 border border-blue-600/20">Monthly Yield ({settings.localization.currency})</div>
          </div>
          {loading ? (
            <div className="h-72 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Syncing Yield...</p>
            </div>
          ) : (
            <div className="h-72 w-full min-w-0" style={{ minHeight: '320px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: isDark ? '#666' : '#9CA3AF', fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: isDark ? '#666' : '#9CA3AF', fontSize: 10, fontWeight: 'bold'}} />
                  <Tooltip 
                    cursor={{fill: 'rgba(37, 99, 235, 0.1)'}}
                    contentStyle={{backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}}
                    itemStyle={{color: '#2563EB', fontWeight: 'bold'}}
                  />
                  <Bar dataKey="amount" fill="#2563EB" radius={[12, 12, 12, 12]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-card p-8 rounded-[3rem] shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">Alert Registry</h3>
            <Bell className={`w-5 h-5 text-blue-600 ${loading ? 'animate-spin' : 'animate-pulse'}`} />
          </div>
          <div className="space-y-4 flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-16 opacity-40">
                <Loader2 className="w-8 h-8 mb-4 text-zinc-300 animate-spin" />
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Syncing Hub</p>
              </div>
            ) : recentNotifications.length > 0 ? recentNotifications.map(notification => (
                <AlertItem 
                    key={notification.id}
                    title={notification.title} 
                    desc={notification.message} 
                    time={new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                />
            )) : (
                <div className="flex flex-col items-center justify-center h-full py-16 opacity-40">
                    <Bell className="w-12 h-12 mb-4 text-zinc-300" />
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Quiet Hub</p>
                </div>
            )}
          </div>
          <button className="w-full mt-8 py-4 glass-input rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 hover:scale-[1.02] transition-all">
              Access Full Archive
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-600/10 border-blue-600/20',
    purple: 'text-purple-600 bg-purple-600/10 border-purple-600/20',
    orange: 'text-orange-600 bg-orange-600/10 border-orange-600/20',
    emerald: 'text-emerald-600 bg-emerald-600/10 border-emerald-600/20',
  };

  return (
    <div className="glass-card p-8 rounded-[2.8rem] border-white/20 hover:scale-105 transition-all duration-500 cursor-default group">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[9px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{label}</p>
        <div className={`p-3 rounded-2xl border ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-black text-zinc-900 dark:text-white truncate tracking-tighter leading-none">{value}</p>
    </div>
  );
};

const AlertItem = ({ title, desc, time }: any) => {
  return (
    <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-[10px] font-black uppercase text-zinc-900 dark:text-white tracking-tight">{title}</h4>
        <span className="text-[9px] text-zinc-500 font-bold">{time}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500 line-clamp-2 font-medium">{desc}</p>
    </div>
  );
};

export default Dashboard;
