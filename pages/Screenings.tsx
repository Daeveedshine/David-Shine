
import React, { useState, useMemo } from 'react';
import { User, UserRole, TenantApplication, ApplicationStatus, NotificationType, PropertyStatus, Agreement } from '../types';
import { getStore, saveStore, formatCurrency, UserSettings } from '../store';
// Added AlertCircle and Loader2 to imports
import { 
  ClipboardCheck, CheckCircle, XCircle, 
  Search, ChevronRight, ShieldCheck, Mail, Phone, Calendar, Download,
  User as UserIcon, MapPin, Briefcase, Info, Users, Home, Printer, FileText,
  BadgeCheck, Building, Maximize2, X, RefreshCw, Check, AlertCircle, Loader2
} from 'lucide-react';

interface ScreeningsProps {
  user: User;
  settings: UserSettings;
  onNavigate: (view: string) => void;
}

const Screenings: React.FC<ScreeningsProps> = ({ user, settings, onNavigate }) => {
  const [store, setStore] = useState(getStore());
  const [selectedApp, setSelectedApp] = useState<TenantApplication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routedPropertyId, setRoutedPropertyId] = useState<string | null>(null);

  const relevantApps = useMemo(() => {
    if (user.role === UserRole.ADMIN) return store.applications;
    return store.applications.filter(app => app.agentId === user.id);
  }, [store.applications, user.id, user.role]);

  const availableProperties = useMemo(() => {
    return store.properties.filter(p => 
      p.agentId === user.id && 
      (p.status === PropertyStatus.LISTED || p.status === PropertyStatus.VACANT)
    );
  }, [store.properties, user.id]);

  const handleUpdateStatus = (id: string, status: ApplicationStatus) => {
    const updatedApps = store.applications.map(app => app.id === id ? { ...app, status } : app);
    const app = store.applications.find(a => a.id === id);
    if (!app) return;

    const notification = {
      id: `n_app_${Date.now()}`,
      userId: app.userId,
      title: `Enrollment Update`,
      message: `Your dossier has been marked as ${status.toLowerCase()}.`,
      type: status === ApplicationStatus.APPROVED ? NotificationType.SUCCESS : NotificationType.INFO,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    const newState = { ...store, applications: updatedApps, notifications: [notification, ...store.notifications] };
    saveStore(newState);
    setStore(newState);
    setSelectedApp(updatedApps.find(a => a.id === id) || null);
  };

  const handleRouteProperty = (propertyId: string) => {
    if (!selectedApp) return;
    setIsRouting(true);

    setTimeout(() => {
      const today = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(today.getFullYear() + 1);
      nextYear.setDate(today.getDate() - 1);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextYear.toISOString().split('T')[0];

      // 1. Update Property Status & Tenant Link
      const updatedProperties = store.properties.map(p => 
        p.id === propertyId ? { 
          ...p, 
          tenantId: selectedApp.userId, 
          status: PropertyStatus.OCCUPIED,
          rentStartDate: startDate,
          rentExpiryDate: endDate
        } : p
      );

      // 2. Update User Profile with Assigned Property
      const updatedUsers = store.users.map(u => 
        u.id === selectedApp.userId ? { ...u, assignedPropertyId: propertyId } : u
      );

      // 3. Link this Application record to the routed Property
      const updatedApplications = store.applications.map(app => 
        app.id === selectedApp.id ? { ...app, propertyId: propertyId } : app
      );

      // 4. Create Legal Agreement Entry
      const newAgreement: Agreement = {
        id: `a${Date.now()}`,
        propertyId: propertyId,
        tenantId: selectedApp.userId,
        version: 1,
        startDate,
        endDate,
        status: 'active'
      };

      // 5. Dispatch Activation Notification
      const propertyName = store.properties.find(p => p.id === propertyId)?.name;
      const notification = {
        id: `n_route_${Date.now()}`,
        userId: selectedApp.userId,
        title: 'Tenancy Activated',
        message: `Congratulations! Your lifecycle for ${propertyName} has been officially routed and activated.`,
        type: NotificationType.SUCCESS,
        timestamp: new Date().toISOString(),
        isRead: false,
        linkTo: 'dashboard'
      };

      const updatedStore = { 
        ...store, 
        properties: updatedProperties, 
        users: updatedUsers,
        applications: updatedApplications,
        agreements: [...store.agreements, newAgreement],
        notifications: [notification, ...store.notifications]
      };

      saveStore(updatedStore);
      setStore(updatedStore);
      setSelectedApp(updatedApplications.find(a => a.id === selectedApp.id) || null);
      setIsRouting(false);
      setRoutedPropertyId(null);
    }, 1200);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredApps = relevantApps.filter(app => 
    `${app.firstName} ${app.surname}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusStyle = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.APPROVED: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case ApplicationStatus.REJECTED: return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case ApplicationStatus.PENDING: return 'bg-amber-500/10 text-amber-500 border-amber-600/20';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Vetting Portal</h1>
          <p className="text-zinc-500 text-sm font-medium">Verify tenant dossiers and stability ratings.</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input type="text" placeholder="Search by name..." className="w-full sm:w-64 pl-12 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm outline-none text-white font-bold shadow-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left List - Hidden on print */}
        <div className="lg:col-span-1 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar print:hidden">
          {filteredApps.map(app => (
            <button 
                key={app.id} 
                onClick={() => setSelectedApp(app)} 
                className={`w-full text-left p-6 rounded-[2.5rem] border-2 transition-all flex items-center gap-6 ${selectedApp?.id === app.id ? 'bg-blue-600 text-white border-blue-400 shadow-2xl' : 'bg-zinc-900 text-white border-zinc-800 shadow-sm'}`}
            >
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center font-black shrink-0 border border-zinc-700 shadow-xl">
                {app.passportPhotoUrl ? (
                  <img src={app.passportPhotoUrl} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <UserIcon size={24} className="text-zinc-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-xl truncate">{app.firstName} {app.surname}</h4>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedApp?.id === app.id ? 'text-blue-100' : 'text-zinc-500'}`}>{app.status}</p>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
          {filteredApps.length === 0 && (
            <div className="text-center py-20 bg-zinc-950 rounded-[3rem] border-2 border-dashed border-zinc-900 text-zinc-800">No records found.</div>
          )}
        </div>

        {/* Right Detail View */}
        <div className="lg:col-span-2">
          {selectedApp ? (
            <div id="printable-dossier" className="bg-white rounded-[4rem] shadow-2xl overflow-hidden border border-zinc-200 animate-in slide-in-from-right-8 duration-700 print:shadow-none print:rounded-none print:border-none print:m-0 print:p-0">
               
               {/* Action Bar for Agents - Hidden on print */}
               <div className="px-10 py-6 bg-zinc-50 border-b border-zinc-100 flex justify-between items-center print:hidden">
                 <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                   <FileText size={14} /> Official Application Dossier
                 </div>
                 <button 
                   onClick={handlePrint}
                   className="flex items-center gap-2 bg-blue-600 hover:bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20 active:scale-95 group"
                 >
                   <Printer size={16} className="group-hover:animate-bounce" /> Export / Print to Device
                 </button>
               </div>

               {/* Print Header - Only visible on print */}
               <div className="hidden print:flex items-center justify-between p-12 bg-zinc-950 text-white border-b-[10px] border-blue-600 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-4 rounded-2xl"><Building size={24} /></div>
                    <div>
                      <h1 className="text-3xl font-black tracking-tighter">SPACEYA PORTFOLIO</h1>
                      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-blue-400">Official Tenancy Enrollment Form</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">RECORD AUTHENTICATION</p>
                    <p className="font-mono text-sm font-bold text-white">{selectedApp.id}</p>
                  </div>
               </div>

               <div className="bg-zinc-900 p-12 text-white flex flex-col md:flex-row justify-between items-center gap-8 border-b-8 border-blue-600 print:bg-transparent print:text-black print:border-none print:p-12 print:pt-0">
                  <div className="flex items-center gap-8">
                    <div 
                      onClick={() => selectedApp.passportPhotoUrl && setExpandedImage(selectedApp.passportPhotoUrl)}
                      className="w-24 h-24 bg-white rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl print:border-zinc-200 print:shadow-none cursor-pointer group relative"
                    >
                      {selectedApp.passportPhotoUrl ? (
                        <img src={selectedApp.passportPhotoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Profile" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300 text-3xl font-black">
                          {selectedApp.firstName.charAt(0)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 size={16} />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-4xl font-black tracking-tighter print:text-black">{selectedApp.firstName} {selectedApp.surname}</h2>
                      <div className="flex items-center gap-4 mt-2">
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusStyle(selectedApp.status)}`}>{selectedApp.status}</span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Application Date: {selectedApp.applicationDate}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center bg-white/5 p-8 rounded-[2.5rem] border border-white/10 shadow-inner min-w-[180px] print:bg-zinc-50 print:border-zinc-200">
                     <p className="text-[10px] font-black uppercase text-blue-400 mb-2">Security Stability Index</p>
                     <p className="text-6xl font-black text-emerald-400 print:text-emerald-600">{selectedApp.riskScore}%</p>
                  </div>
               </div>
               
               <div className="p-10 md:p-14 space-y-16 text-black print:p-12 print:pt-4">
                  {/* ROUTING HUB: Integrated Property Assignment */}
                  {selectedApp.status === ApplicationStatus.APPROVED && !store.users.find(u => u.id === selectedApp.userId)?.assignedPropertyId && (
                    <section className="p-8 bg-blue-600/5 border-2 border-blue-600/20 rounded-[3rem] space-y-8 animate-in zoom-in-95 duration-500 print:hidden">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
                                <RefreshCw size={24} />
                             </div>
                             <div>
                                <h4 className="text-xl font-black text-zinc-900 tracking-tight">Lifecycle Asset Routing</h4>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Route an available property to this candidate</p>
                             </div>
                          </div>
                          {selectedApp.propertyId !== 'PENDING' && (
                             <div className="px-4 py-1.5 bg-amber-500/10 text-amber-600 rounded-full text-[9px] font-black uppercase border border-amber-500/20">
                                Target: {store.properties.find(p => p.id === selectedApp.propertyId)?.name}
                             </div>
                          )}
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {availableProperties.map(prop => (
                             <button 
                                key={prop.id}
                                onClick={() => setRoutedPropertyId(prop.id)}
                                className={`p-6 rounded-3xl border-2 transition-all text-left flex items-start gap-4 hover:border-blue-600 ${routedPropertyId === prop.id ? 'border-blue-600 bg-blue-600/10 shadow-xl' : 'bg-white border-zinc-100 shadow-sm'}`}
                             >
                                <div className={`p-3 rounded-2xl ${routedPropertyId === prop.id ? 'bg-blue-600 text-white' : 'bg-zinc-50 text-zinc-400'}`}>
                                   <Building size={20} />
                                </div>
                                <div className="min-w-0">
                                   <p className="font-black text-zinc-900 tracking-tight truncate">{prop.name}</p>
                                   <p className="text-[10px] font-bold text-zinc-500 truncate">{prop.location}</p>
                                   <p className="text-xs font-black text-blue-600 mt-1">{formatCurrency(prop.rent, settings)}/yr</p>
                                </div>
                                {routedPropertyId === prop.id && <Check size={20} className="text-blue-600 ml-auto shrink-0" />}
                             </button>
                          ))}
                          {availableProperties.length === 0 && (
                             <div className="col-span-full py-12 text-center text-zinc-400 opacity-60">
                                <AlertCircle size={32} className="mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No available assets found in your registry</p>
                             </div>
                          )}
                       </div>

                       {routedPropertyId && (
                          <div className="pt-4 animate-in slide-in-from-bottom-4">
                             <button 
                               onClick={() => handleRouteProperty(routedPropertyId)}
                               disabled={isRouting}
                               className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-blue-600/20 flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95"
                             >
                                {isRouting ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                {isRouting ? 'routing lifecycle...' : 'Confirm Routing & Activate Tenancy'}
                             </button>
                          </div>
                       )}
                    </section>
                  )}

                  {/* Section 1: Identity */}
                  <section className="space-y-10">
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em] border-b-2 border-zinc-100 pb-4 flex items-center gap-3">
                       <UserIcon size={16} className="text-blue-600" /> 01: Profile Information
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                      <DetailRow label="Surname" value={selectedApp.surname} />
                      <DetailRow label="First Name" value={selectedApp.firstName} />
                      <DetailRow label="Other Name" value={selectedApp.middleName} />
                      <DetailRow label="Gender" value={selectedApp.gender} />
                      <DetailRow label="Marital Status" value={selectedApp.maritalStatus} />
                      <DetailRow label="Occupation" value={selectedApp.occupation} />
                      <DetailRow label="Contact Phone" value={selectedApp.phoneNumber} />
                      <DetailRow label="Household Size" value={selectedApp.familySize} />
                    </div>
                  </section>

                  {/* Section 2: Residential History */}
                  <section className="space-y-10">
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em] border-b-2 border-zinc-100 pb-4 flex items-center gap-3">
                       <MapPin size={16} className="text-blue-600" /> 02: Residential Analysis
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <DetailRow label="Current Residential Address" value={selectedApp.currentHomeAddress} />
                       <DetailRow label="Primary Reason for Relocation" value={selectedApp.reasonForRelocating} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 print:bg-transparent print:border-zinc-200">
                       <DetailRow label="Current Landlord Name" value={selectedApp.currentLandlordName} />
                       <DetailRow label="Landlord Mobile Number" value={selectedApp.currentLandlordPhone} />
                    </div>
                  </section>

                  {/* Section 3: Verification Evidence */}
                  <section className="space-y-10 page-break-inside-avoid">
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em] border-b-2 border-zinc-100 pb-4 flex items-center gap-3">
                       <ShieldCheck size={16} className="text-blue-600" /> 03: Identity Verification
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                       <div className="space-y-8">
                          <div className="grid grid-cols-2 gap-6">
                            <DetailRow label="Document Category" value={selectedApp.verificationType} />
                            <DetailRow label="Document Reference" value={selectedApp.verificationIdNumber} />
                          </div>
                          <div 
                            onClick={() => selectedApp.verificationUrl && setExpandedImage(selectedApp.verificationUrl)}
                            className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 shadow-sm print:shadow-none print:bg-transparent print:border-zinc-200 cursor-pointer group relative"
                          >
                             <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Official Document Capture</p>
                             {selectedApp.verificationUrl ? (
                               <img src={selectedApp.verificationUrl} className="w-full h-auto rounded-2xl max-h-64 object-contain shadow-xl print:shadow-none print:border print:border-zinc-200 transition-transform group-hover:scale-[1.02]" alt="ID Document" />
                             ) : (
                               <div className="py-20 text-center text-zinc-300 italic text-xs">No scan data attached.</div>
                             )}
                             {selectedApp.verificationUrl && (
                               <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <Maximize2 size={24} className="text-zinc-500" />
                               </div>
                             )}
                          </div>
                       </div>
                       <div className="p-14 bg-zinc-950 rounded-[4rem] flex flex-col items-center justify-center text-center shadow-2xl print:bg-white print:border-4 print:rounded-none print:border-zinc-200">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-8 print:text-zinc-400">Digital Legal Authentication</p>
                          <p className="text-5xl font-serif italic text-white border-b-2 border-zinc-800 pb-6 px-12 print:text-black print:border-zinc-200">
                            {selectedApp.signature}
                          </p>
                          <div className="mt-10 flex items-center gap-4 text-emerald-500">
                             <BadgeCheck size={20} />
                             <span className="text-[9px] font-black uppercase tracking-[0.3em]">Electronically Verified</span>
                          </div>
                       </div>
                    </div>
                  </section>

                  {/* AI Recommendation Briefing */}
                  <section className="p-8 bg-blue-50 border border-blue-100 rounded-[2.5rem] space-y-4 print:bg-zinc-50 print:border-zinc-200 print:rounded-none">
                     <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] flex items-center gap-2">
                       <Info size={14} /> Intelligence Analysis Summary
                     </h4>
                     <p className="text-blue-900 font-bold leading-relaxed italic print:text-black">
                       "{selectedApp.aiRecommendation}"
                     </p>
                  </section>

                  {/* Action Buttons - Hidden on print */}
                  <div className="pt-12 border-t border-zinc-100 flex flex-col sm:flex-row gap-6 print:hidden">
                     {selectedApp.status !== ApplicationStatus.APPROVED && (
                        <button onClick={() => handleUpdateStatus(selectedApp.id, ApplicationStatus.APPROVED)} className="flex-[2] bg-emerald-600 hover:bg-black text-white py-6 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-100 active:scale-95">
                           <CheckCircle size={20} /> Finalize Approval
                        </button>
                     )}
                     <button onClick={() => handleUpdateStatus(selectedApp.id, ApplicationStatus.REJECTED)} className="flex-1 bg-rose-50 border-2 border-rose-100 text-rose-500 py-6 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 transition-all hover:bg-rose-500 hover:text-white active:scale-95">
                        <XCircle size={20} /> Decline Candidate
                     </button>
                  </div>
                  
                  {/* Print Footer - Only visible on print */}
                  <div className="hidden print:block pt-12 border-t border-zinc-100 text-center text-[8px] font-black text-zinc-300 uppercase tracking-[0.5em]">
                    This dossier is an official record produced by SPACEYA. 
                    <br />© {new Date().getFullYear()} SPACEYA Global Operations.
                  </div>
               </div>
            </div>
          ) : (
            <div className="h-[calc(100vh-250px)] flex flex-col items-center justify-center bg-zinc-950 rounded-[4rem] border-2 border-dashed border-zinc-900 print:hidden">
                <ClipboardCheck size={64} className="text-zinc-900 mb-6" />
                <p className="text-zinc-700 font-black uppercase tracking-[0.3em] text-sm">Select Dossier to Review</p>
            </div>
          )}
        </div>
      </div>

      {/* LIGHTBOX / IMAGE EXPANDER */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-300 print:hidden"
          onClick={() => setExpandedImage(null)}
        >
           <button 
             className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
             onClick={(e) => { e.stopPropagation(); setExpandedImage(null); }}
           >
              <X size={32} />
           </button>
           <div className="relative w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <img 
                src={expandedImage} 
                className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(37,99,235,0.2)]" 
                alt="Expanded View"
              />
           </div>
        </div>
      )}

      <style>{`
        @media print {
          /* Force page to use full width and handle colors correctly */
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Hide all UI elements except the dossier */
          aside, nav, header, footer, .print\\:hidden, button, .custom-scrollbar {
            display: none !important;
          }
          
          /* Main container reset */
          main {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          
          .max-w-6xl {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
          }
          
          /* Dossier targeting */
          #printable-dossier {
            display: block !important;
            width: 100% !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }
          
          /* Hide list column, show detail column at full width */
          .grid {
            display: block !important;
          }
          .lg\\:col-span-1 {
            display: none !important;
          }
          .lg\\:col-span-2 {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Ensure images and borders are retained */
          img {
            max-width: 100% !important;
            height: auto !important;
          }

          /* Page break handling */
          section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string, value: any }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 truncate">{label}</p>
    <p className="text-lg font-bold text-black leading-tight break-words">{value || 'N/A'}</p>
  </div>
);

export default Screenings;
