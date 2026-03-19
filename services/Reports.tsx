
import React, { useState, useMemo } from 'react';
import { User, UserRole, Property, Agreement } from '../types';
import { getStore } from '../store';
import { Download, Search, Phone, Calendar, Building, User as UserIcon, DollarSign, Filter, MoreHorizontal, AlertCircle, Table } from 'lucide-react';

interface ReportsProps {
  user: User;
}

interface ReportRow {
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  rentAmount: number;
  expiryDate: string;
  status: string;
  daysRemaining: number;
}

const Reports: React.FC<ReportsProps> = ({ user }) => {
  const store = getStore();
  const [searchTerm, setSearchTerm] = useState('');

  const reportData = useMemo(() => {
    const tenants = store.users.filter(u => u.role === UserRole.TENANT);
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
        rentAmount: property?.rent || 0,
        expiryDate: agreement?.endDate || 'N/A',
        status: agreement?.status || 'No active lease',
        daysRemaining
      };
    });

    return rows.filter(row => 
      row.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.tenantPhone.includes(searchTerm)
    );
  }, [store, searchTerm]);

  const handleExport = () => {
    // Simple CSV simulation
    const headers = ['Tenant', 'Phone', 'Property', 'Annual Rent (Naira)', 'Expiry Date'];
    const csvRows = reportData.map(r => `${r.tenantName},${r.tenantPhone},${r.propertyName},${r.rentAmount},${r.expiryDate}`);
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PropLifecycle_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tenant Portfolio Sheet</h1>
          <p className="text-slate-500 text-sm">Consolidated view of all occupied properties and lease terms.</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-slate-100 transition-all hover:bg-slate-800 active:scale-95"
        >
          <Download className="w-4 h-4 mr-2" /> Export to CSV
        </button>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Active Leases</p>
          <p className="text-2xl font-black text-indigo-600">{reportData.filter(r => r.status === 'active').length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Annual Rent</p>
          <p className="text-2xl font-black text-emerald-600">₦{reportData.reduce((acc, r) => acc + r.rentAmount, 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expiring Soon (&lt;30d)</p>
          <p className="text-2xl font-black text-rose-500">{reportData.filter(r => r.daysRemaining <= 30 && r.status === 'active').length}</p>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, property, or phone..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-white transition-colors">
            <Filter className="w-4 h-4 mr-2" /> Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4"><div className="flex items-center"><UserIcon className="w-3 h-3 mr-2" /> Tenant Name</div></th>
                <th className="px-6 py-4"><div className="flex items-center"><Phone className="w-3 h-3 mr-2" /> Phone Number</div></th>
                <th className="px-6 py-4"><div className="flex items-center"><Building className="w-3 h-3 mr-2" /> Property</div></th>
                <th className="px-6 py-4"><div className="flex items-center font-black">₦ Annual Rent</div></th>
                <th className="px-6 py-4"><div className="flex items-center"><Calendar className="w-3 h-3 mr-2" /> Expiry Date</div></th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.length > 0 ? reportData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{row.tenantName}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{row.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-600">{row.tenantPhone}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-indigo-600">{row.propertyName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-slate-800">₦{row.rentAmount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${row.daysRemaining <= 30 && row.status === 'active' ? 'text-rose-500' : 'text-slate-600'}`}>
                        {row.expiryDate}
                      </span>
                      {row.daysRemaining <= 30 && row.status === 'active' && (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {row.status}
                      </span>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <Table className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="text-slate-400 font-bold">No tenant data found matching your query.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Total Rows: {reportData.length}</span>
          <span>Generated on {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export default Reports;
