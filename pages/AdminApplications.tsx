import React, { useState, useEffect } from 'react';
import { User, TenantApplication, ApplicationStatus, Property } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { getStore, formatCurrency, formatDate, UserSettings } from '../store';
import { 
  ArrowLeft, Search, Download, FileText, User as UserIcon, Building, 
  TrendingUp, Smartphone, Calendar, MapPin, 
  ShieldCheck, Briefcase, Phone, Users, Info, CreditCard,
  FileSearch, AlertCircle, PenTool, CheckCircle, Hash,
  Home, ClipboardCheck, Loader2
} from 'lucide-react';

interface AdminApplicationsProps {
  user: User;
  settings: UserSettings;
  onBack: () => void;
}

const AdminApplications: React.FC<AdminApplicationsProps> = ({ user, settings, onBack }) => {
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<TenantApplication | null>(null);

  useEffect(() => {
    setIsLoading(true);
    
    // Listen to all applications for admin
    const qApps = query(collection(db, 'applications'));
    const unsubscribeApps = onSnapshot(qApps, (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TenantApplication));
      setApplications(appsData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'applications');
      setIsLoading(false);
    });

    // Listen to all properties
    const qProps = query(collection(db, 'properties'));
    const unsubscribeProps = onSnapshot(qProps, (snapshot) => {
      const propsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Property));
      setProperties(propsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'properties');
    });

    return () => {
      unsubscribeApps();
      unsubscribeProps();
    };
  }, []);

  const filteredApps = applications.filter(app => 
    `${app.firstName} ${app.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.id.includes(searchTerm)
  );

  const handleExportPDF = () => {
    window.print();
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getStatusStyle = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.APPROVED: return 'bg-emerald-100 text-emerald-700';
      case ApplicationStatus.REJECTED: return 'bg-rose-100 text-rose-700';
      case ApplicationStatus.PENDING: return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Accessing Global Registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden px-1">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Global Registry</h1>
            <p className="text-zinc-500 text-sm font-medium">Monitoring {applications.length} historical and active profiles.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <div className="relative flex-1 sm:min-w-[300px]">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
             <input 
               type="text" 
               placeholder="Search registry..."
               className="w-full pl-12 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-600 font-bold text-white shadow-xl"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
        </div>
      </header>

      <div className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-2xl overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em] border-b border-zinc-800">
                <th className="px-8 py-6">Applicant Dossier</th>
                <th className="px-8 py-6">Target Property</th>
                <th className="px-8 py-6 text-center">Stability Index</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredApps.map(app => {
                const prop = properties.find(p => p.id === app.propertyId);
                return (
                  <tr key={app.id} className="hover:bg-black/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-800 overflow-hidden border border-zinc-700 flex items-center justify-center text-zinc-500 font-black shadow-lg">
                           {app.passportPhotoUrl ? (
                             <img src={app.passportPhotoUrl} className="w-full h-full object-cover" alt="Profile" />
                           ) : (
                             app.firstName.charAt(0)
                           )}
                        </div>
                        <div>
                          <p className="text-lg font-black text-white">{app.firstName} {app.surname}</p>
                          <div className="flex items-center gap-2">
                             <span className={`px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase ${getStatusStyle(app.status)}`}>{app.status}</span>
                             <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{formatDate(app.applicationDate, settings)}</span>
                             {app.displayUID && <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest ml-2">{app.displayUID}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {prop ? (
                        <p className="text-xs font-bold text-blue-400 group-hover:text-blue-300 transition-colors">{prop.name}</p>
                      ) : (
                        <p className="text-xs font-black uppercase tracking-widest italic opacity-40 text-zinc-600">Unallocated</p>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-3">
                        <TrendingUp size={16} className={getRiskColor(app.riskScore)} />
                        <span className={`text-sm font-black ${getRiskColor(app.riskScore)}`}>{app.riskScore}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => setSelectedApp(app)}
                        className="text-blue-500 hover:text-white font-black text-[10px] inline-flex items-center gap-2 uppercase tracking-widest bg-blue-500/10 px-6 py-3 rounded-2xl transition-all hover:bg-blue-600 shadow-xl"
                      >
                         Open Dossier <FileSearch size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredApps.length === 0 && (
            <div className="py-24 text-center">
               <ClipboardCheck size={48} className="mx-auto text-zinc-800 mb-4" />
               <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">No records matching search.</p>
            </div>
          )}
        </div>
      </div>

      {selectedApp && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md print:bg-white print:p-0 print:static print:block animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl my-8 rounded-[4rem] shadow-2xl print:shadow-none print:rounded-none animate-in zoom-in-95 duration-500 overflow-hidden">
             <div className="p-10 md:p-14 border-b-8 border-blue-600 bg-zinc-950 text-white print:p-0 print:bg-white print:text-black">
               <div className="flex justify-between items-start mb-12 print:hidden">
                 <button 
                  onClick={() => setSelectedApp(null)}
                  className="bg-white/10 p-4 rounded-full text-zinc-400 hover:text-white transition-all shadow-xl"
                 >
                   <ArrowLeft size={24} />
                 </button>
                 <button 
                   onClick={handleExportPDF}
                   className="bg-blue-600 text-white px-10 py-5 rounded-[1.5rem] font-black flex items-center shadow-2xl shadow-blue-900/40 hover:bg-black transition-all active:scale-95 text-xs uppercase tracking-[0.2em]"
                 >
                   <Download size={20} className="mr-2" /> Download Dossier
                 </button>
               </div>

               <div className="flex flex-col md:flex-row justify-between items-center gap-12">
                 <div className="flex items-center gap-10">
                    <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center overflow-hidden shadow-2xl print:border-4">
                      {selectedApp.passportPhotoUrl ? (
                        <img src={selectedApp.passportPhotoUrl} className="w-full h-full object-cover" alt="Profile" />
                      ) : (
                        <div className="text-zinc-300 text-5xl font-black">{selectedApp.firstName.charAt(0)}</div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusStyle(selectedApp.status)}`}>{selectedApp.status}</span>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">ID: {selectedApp.id.substring(3)}</span>
                        {selectedApp.displayUID && <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] ml-2">UID: {selectedApp.displayUID}</span>}
                      </div>
                      <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">{selectedApp.firstName} {selectedApp.surname}</h2>
                      <div className="flex flex-wrap items-center gap-8 text-zinc-400 font-bold text-sm">
                        <span className="flex items-center gap-3"><Smartphone size={18} className="text-blue-500" /> {selectedApp.phoneNumber}</span>
                        <span className="flex items-center gap-3 uppercase tracking-widest text-[10px]"><Calendar size={18} className="text-blue-500" /> Submitted: {formatDate(selectedApp.applicationDate, settings)}</span>
                      </div>
                    </div>
                 </div>
                 <div className="bg-white/5 p-10 rounded-[3rem] text-center min-w-[200px] shadow-inner print:bg-zinc-50 print:border-2">
                   <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-3">Stability Rating</p>
                   <p className={`text-7xl font-black ${getRiskColor(selectedApp.riskScore)}`}>{selectedApp.riskScore}%</p>
                 </div>
               </div>
             </div>

             <div className="p-10 md:p-16 space-y-20 print:p-0 print:mt-12 text-black">
               {/* 01: Profile */}
               <section className="space-y-10">
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.4em] border-b-2 border-slate-50 pb-4">01: Registry Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
                     <DataPoint label="Surname" value={selectedApp.surname} />
                     <DataPoint label="First Name" value={selectedApp.firstName} />
                     <DataPoint label="Other Name" value={selectedApp.middleName} />
                     <DataPoint label="Gender" value={selectedApp.gender} />
                     <DataPoint label="Marital Status" value={selectedApp.maritalStatus} />
                     <DataPoint label="Occupation" value={selectedApp.occupation} />
                     <DataPoint label="Phone Number" value={selectedApp.phoneNumber} />
                     <DataPoint label="Family Size" value={selectedApp.familySize} />
                  </div>
               </section>

               {/* 02: Background */}
               <section className="space-y-10">
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.4em] border-b-2 border-slate-50 pb-4">02: Residential Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                     <DataPoint label="Current Home Address" value={selectedApp.currentHomeAddress} />
                     <DataPoint label="Reason for Relocation" value={selectedApp.reasonForRelocating} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 p-10 bg-slate-50 rounded-[3rem] border border-slate-100">
                     <DataPoint label="Previous Landlord" value={selectedApp.currentLandlordName} />
                     <DataPoint label="Landlord Phone" value={selectedApp.currentLandlordPhone} />
                  </div>
               </section>

               {/* 03: Identity */}
               <section className="space-y-10">
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.4em] border-b-2 border-slate-50 pb-4">03: Verification Dossier</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                     <div className="space-y-10">
                        <DataPoint label="ID Verification Method" value={selectedApp.verificationType} />
                        <DataPoint label="Official ID Number" value={selectedApp.verificationIdNumber} />
                        <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col shadow-sm">
                           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-6">Identity Scan Evidence</p>
                           {selectedApp.verificationUrl ? (
                             <img src={selectedApp.verificationUrl} className="w-full h-auto rounded-2xl max-h-72 object-contain shadow-2xl" alt="ID Document" />
                           ) : (
                             <div className="py-24 text-center text-slate-300 italic text-xs">No scan available.</div>
                           )}
                        </div>
                     </div>
                     <div className="p-14 bg-slate-900 rounded-[4rem] flex flex-col items-center justify-center text-center shadow-2xl print:bg-white print:border-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-8">Dossier Authentication</p>
                        <p className="text-6xl font-serif italic text-white border-b-2 border-slate-800 pb-6 px-12 print:text-black print:border-slate-100">
                          {selectedApp.signature}
                        </p>
                        <div className="mt-10 flex items-center gap-4 text-emerald-500">
                           <ShieldCheck size={24} />
                           <span className="text-[10px] font-black uppercase tracking-[0.4em]">Official Timestamp Verified</span>
                        </div>
                     </div>
                  </div>
               </section>
             </div>
             
             {/* Footer */}
             <div className="p-10 bg-zinc-50 text-center text-slate-300 print:block">
                <p className="text-[9px] font-black uppercase tracking-[0.5em]">This dossier is a private legal record of the Property Management Suite</p>
             </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          html, body, #root, main, .flex, .flex-1, .max-w-6xl, .h-screen, .overflow-auto { height: auto !important; overflow: visible !important; position: static !important; background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .bg-zinc-900, .bg-zinc-950, .bg-black { background-color: white !important; color: black !important; }
          .text-white { color: black !important; }
          @page { margin: 1.5cm; size: A4; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

const DataPoint = ({ label, value }: { label: string, value: any }) => (
  <div className="space-y-1">
    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] leading-none mb-2 truncate">{label}</p>
    <p className="text-lg font-bold text-slate-900 leading-tight break-words">{value || 'N/A'}</p>
  </div>
);

export default AdminApplications;
