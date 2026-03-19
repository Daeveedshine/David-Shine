
import React, { useMemo, useState, useEffect } from 'react';
import { User, UserRole, Property, Payment, MaintenanceTicket, TenantApplication } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { getStore, formatCurrency, UserSettings } from '../store';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Building, Users, AlertCircle, DollarSign, UserCheck, Activity, ArrowRight, ClipboardCheck, Loader2 } from 'lucide-react';

interface AdminDashboardProps {
  user: User;
  settings: UserSettings;
  onNavigate: (view: string) => void;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, settings, onNavigate }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedCollections, setLoadedCollections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const collectionsToLoad = ['properties', 'users', 'payments', 'tickets', 'applications'];
    
    const markAsLoaded = (name: string) => {
      setLoadedCollections(prev => {
        const next = new Set(prev);
        next.add(name);
        if (next.size === collectionsToLoad.length) {
          setIsLoading(false);
        }
        return next;
      });
    };
    
    const unsubscribeProps = onSnapshot(collection(db, 'properties'), (snapshot) => {
      setProperties(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Property)));
      markAsLoaded('properties');
    }, (error) => handleFirestoreError(error, OperationType.GET, 'properties'));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User)));
      markAsLoaded('users');
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const unsubscribePayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment)));
      markAsLoaded('payments');
    }, (error) => handleFirestoreError(error, OperationType.GET, 'payments'));

    const unsubscribeTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MaintenanceTicket)));
      markAsLoaded('tickets');
    }, (error) => handleFirestoreError(error, OperationType.GET, 'tickets'));

    const unsubscribeApps = onSnapshot(collection(db, 'applications'), (snapshot) => {
      setApplications(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TenantApplication)));
      markAsLoaded('applications');
    }, (error) => handleFirestoreError(error, OperationType.GET, 'applications'));

    return () => {
      unsubscribeProps();
      unsubscribeUsers();
      unsubscribePayments();
      unsubscribeTickets();
      unsubscribeApps();
    };
  }, []);

  const metrics = useMemo(() => {
    const totalProperties = properties.length;
    const totalAgents = users.filter(u => u.role === UserRole.AGENT).length;
    const totalTenants = users.filter(u => u.role === UserRole.TENANT).length;
    const totalRevenue = payments.filter(p => p.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const outstandingRent = payments.filter(p => p.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
    const openTickets = tickets.filter(t => t.status !== 'RESOLVED').length;
    const pendingApps = applications.filter(a => a.status === 'PENDING').length;

    return { totalProperties, totalAgents, totalTenants, totalRevenue, outstandingRent, openTickets, pendingApps };
  }, [properties, users, payments, tickets, applications]);

  const propertyStatusData = useMemo(() => {
    const counts: any = {};
    properties.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [properties]);

  const revenueTrendData = useMemo(() => {
    const monthlyData: { [key: string]: number } = {};
    payments.filter(p => p.status === 'paid').forEach(p => {
      const date = new Date(p.date);
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      monthlyData[monthYear] = (monthlyData[monthYear] || 0) + p.amount;
    });
    return Object.keys(monthlyData).map(key => ({ name: key, amount: monthlyData[key] }));
  }, [payments]);

  const topAgentsData = useMemo(() => {
    const agentCounts: { [key: string]: number } = {};
    properties.forEach(p => {
      if (p.agentId) {
        agentCounts[p.agentId] = (agentCounts[p.agentId] || 0) + 1;
      }
    });
    return Object.keys(agentCounts)
      .map(agentId => {
        const agent = users.find(u => u.id === agentId);
        return {
          name: agent?.name || 'Unknown Agent',
          count: agentCounts[agentId],
          tier: agent?.agentTier || 'BRONZE'
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [properties, users]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-bold">Initializing Command Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Command Center</h1>
          <p className="text-slate-500">Global overview of all property operations and financial health.</p>
        </div>
        <button 
          onClick={() => onNavigate('admin_applications')}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black flex items-center shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
        >
          <ClipboardCheck className="mr-2 w-5 h-5" /> View All Applications
        </button>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        <MetricCard label="Properties" value={metrics.totalProperties} icon={Building} color="indigo" />
        <MetricCard label="Agents" value={metrics.totalAgents} icon={UserCheck} color="emerald" />
        <MetricCard label="Tenants" value={metrics.totalTenants} icon={Users} color="blue" />
        <MetricCard label="Tickets" value={metrics.openTickets} icon={AlertCircle} color="amber" />
        <MetricCard label="Applications" value={metrics.pendingApps} icon={ClipboardCheck} color="indigo" />
        <MetricCard label="Revenue" value={formatCurrency(metrics.totalRevenue, settings)} icon={DollarSign} color="emerald" />
        <MetricCard label="Pending" value={formatCurrency(metrics.outstandingRent, settings)} icon={Activity} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Occupancy Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Property Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={propertyStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {propertyStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {propertyStatusData.map((entry, index) => (
              <div key={entry.name} className="flex items-center text-xs">
                <div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                <span className="text-slate-500 capitalize">{entry.name}: <span className="font-bold text-slate-800">{entry.value}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Agents */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Top Performing Agents</h3>
          <div className="space-y-4">
            {topAgentsData.map((agent, index) => (
              <div key={agent.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{agent.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{agent.tier}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-indigo-600">{agent.count}</p>
                  <p className="text-[10px] text-slate-400 uppercase">Properties</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Card */}
        <div className="lg:col-span-2 bg-indigo-600 p-8 rounded-[2rem] text-white flex flex-col justify-between shadow-2xl shadow-indigo-200">
           <div>
              <h3 className="text-2xl font-black mb-2">Tenant Vetting Engine</h3>
              <p className="text-indigo-100 font-medium leading-relaxed">
                Review complete digital applications including AI risk scoring, identity verification, and financial analysis. 
                Approve or reject candidates with a single click.
              </p>
           </div>
           <button 
             onClick={() => onNavigate('admin_applications')}
             className="mt-8 bg-white text-indigo-600 px-6 py-4 rounded-2xl font-black flex items-center justify-center hover:bg-indigo-50 transition-all shadow-xl w-fit"
           >
             Manage Applications <ArrowRight className="ml-2 w-5 h-5" />
           </button>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Critical Maintenance Alerts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="px-6 py-4">Property</th>
                <th className="px-6 py-4">Tenant</th>
                <th className="px-6 py-4">Issue</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.slice(0, 5).map(ticket => {
                const prop = properties.find(p => p.id === ticket.propertyId);
                const tenant = users.find(u => u.id === ticket.tenantId);
                return (
                  <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{prop?.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{tenant?.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{ticket.issue}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ticket.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-slate-500">{ticket.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon, color }: any) => {
  const colors: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
      <div className={`p-2 w-fit rounded-lg mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
};

export default AdminDashboard;
