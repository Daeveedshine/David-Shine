
import React, { useState, useMemo } from 'react';
import { User, UserRole, Property, Agreement } from '../types';
import { getStore, formatCurrency, formatDate, UserSettings } from '../store';
import { Download, Search, Phone, Calendar, Building, User as UserIcon, DollarSign, Filter, MoreHorizontal, AlertCircle, Table, MapPin, Tag } from 'lucide-react';

interface ReportsProps {
  user: User;
  settings: UserSettings;
}

interface ReportRow {
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  propertyType: string;
  propertyAddress: string;
  rentAmount: number;
  expiryDate: string;
  status: string;
  daysRemaining: number;
}

const Reports: React.FC<ReportsProps> = ({ user, settings }) => {
  const store = getStore();
  const [searchTerm, setSearchTerm] = useState('');

  const reportData = useMemo(() => {
    // 1. Get base tenants
    let tenants = store.users.filter(u => u.role === UserRole.TENANT);
    
    // 2. Filter tenants based on Agent's own properties
    if (user.role === UserRole.AGENT) {
      const myPropertyIds = store.properties
        .filter(p => p.agentId === user.id)
        .map(p => p.id);
      
      tenants = tenants.filter(t => t.assignedPropertyId && myPropertyIds.includes(t.assignedPropertyId));
    }

    // 3. Map to report rows
    const rows: ReportRow[] = tenants.map(tenant => {
      const property = store.properties.find(p => p.id === tenant.assignedPropertyId);
      const agreement = store.agreements.find(a => a.tenantId === tenant.id && a.status === 'active');
      
      let daysRemaining = 999;
      if (agreement?.endDate) {
        const expiry = new Date(agreement.endDate);
        const today = new Date();
        daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        tenantName: tenant.name,
        tenantPhone: tenant.phone || 'No phone provided',
        propertyName: property?.name || 'Unassigned',
        propertyType: property?.type || 'N/A',
        propertyAddress: property?.location || 'N/A',
        rentAmount: property?.rent || 0,
        expiryDate: agreement?.endDate || 'N/A',
        status: agreement?.status || 'No active lease',
        daysRemaining
      };
    });

    // 4. Apply search term
    return rows.filter(row => 
      row.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.tenantPhone.includes(searchTerm)
    );
  }, [store, searchTerm, user]);

  const handleExport = () => {
    const headers = ['Tenant', 'Phone', 'Property Name', 'Rent Type', 'Address', 'Annual Rent (Naira)', 'Expiry Date'];
    const csvRows = reportData.map(r => `"${r.tenantName}","${r.tenantPhone}","${r.propertyName}","${r.propertyType}","${r.propertyAddress}","${r.rentAmount}","${r.expiryDate}"`);
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPACEYA_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenant Portfolio Sheet</h1>
          <p className="text-zinc-500 text-sm">Consolidated view of {user.role === UserRole.AGENT ? 'your' : 'all'} occupied properties and lease terms.</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-700 active:scale-95"
        >
          <Download className="w-4 h-4 mr-2" /> Export to CSV
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Leases</p>
          <p className="text-2xl font-black text-blue-500">{reportData.filter(r => r.status === 'active').length}</p>
        </div>
        <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Gross Annual Rent</p>
          <p className="text-2xl font-black text-emerald-500">{formatCurrency(reportData.reduce((acc, r) => acc + r.rentAmount, 0), settings)}</p>
        </div>
        <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Expiring Soon (&lt;30d)</p>
          <p className="text-2xl font-black text-rose-500">{reportData.filter(r => r.daysRemaining <= 30 && r.status === 'active').length}</p>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search by name, address, or phone..."
              className="w-full pl-10 pr-4 py-2 bg-black border border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-600 transition-all text-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center px-4 py-2 text-sm font-bold text-zinc-400 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors">
            <Filter className="w-4 h-4 mr-2" /> Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <th className="px-6 py-4"><div className="flex items-center"><UserIcon className="w-3 h-3 mr-2" /> Tenant Name</div></th>
                <th className="px-6 py-4"><div className="flex items-center"><Building className="w-3 h-3 mr-2" /> Property & Type</div></th>
                <th className="px-6 py-4"><div className="flex items-center"><MapPin className="w-3 h-3 mr-2" /> Address</div></th>
                <th className="px-6 py-4"><div className="flex items-center"><Phone className="w-3 h-3 mr-2" /> Contact</div></th>
                <th className="px-6 py-4"><div className="flex items-center font-black">Annual Rent</div></th>
                <th className="px-6 py-4"><div className="flex items-center"><Calendar className="w-3 h-3 mr-2" /> Expiry</div></th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {reportData.length > 0 ? reportData.map((row, idx) => (
                <tr key={idx} className="hover:bg-black/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{row.tenantName}</span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-[150px] uppercase">ID: {idx + 100}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-blue-400">{row.propertyName}</span>
                      <div className="flex items-center gap-1 mt-1 text-zinc-500">
                        <Tag className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">{row.propertyType}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-xs font-medium text-zinc-400 truncate max-w-[150px] block" title={row.propertyAddress}>
                        {row.propertyAddress}
                     </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-zinc-400">{row.tenantPhone}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-white">{formatCurrency(row.rentAmount, settings)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${row.daysRemaining <= 30 && row.status === 'active' ? 'text-rose-500' : 'text-zinc-400'}`}>
                        {formatDate(row.expiryDate, settings)}
                      </span>
                      {row.daysRemaining <= 30 && row.status === 'active' && (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        row.status === 'active' ? 'bg-emerald-600/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {row.status}
                      </span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <Table className="w-12 h-12 text-zinc-800 mb-4" />
                      <p className="text-zinc-600 font-bold">No tenant data found matching your query.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-black border-t border-zinc-800 flex justify-between items-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          <span>Total Rows: {reportData.length}</span>
          <span>Generated on {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export default Reports;
