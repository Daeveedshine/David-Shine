
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, TenantApplication, ApplicationStatus, NotificationType, UserRole, Property, PropertyStatus } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { getStore, formatCurrency, formatDate, UserSettings } from '../store';
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc, orderBy } from 'firebase/firestore';
import { 
  CheckCircle, ArrowRight, ArrowLeft, Building, ShieldCheck, 
  Loader2, MapPin, UserCheck, 
  Search, Camera, Fingerprint, 
  Briefcase, Users, Phone, PenTool, Calendar, History, FileText, Eye,
  UserPlus, Download, Trash2, Edit3, Image as ImageIcon, AlertCircle, ChevronDown, User as UserIcon, Printer, X, Maximize2, Check,
  Info
} from 'lucide-react';

interface ApplicationsProps {
  user: User;
  settings: UserSettings;
  onNavigate: (view: string) => void;
}

const Applications: React.FC<ApplicationsProps> = ({ user, settings, onNavigate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printApp, setPrintApp] = useState<TenantApplication | null>(null);
  const [viewingApp, setViewingApp] = useState<TenantApplication | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [agents, setAgents] = useState<User[]>([]);

  // Check for Referral Agent ID in storage
  const referralAgentId = localStorage.getItem('referral_agent_id');

  // Listen for applications
  useEffect(() => {
    const q = query(
      collection(db, 'applications'),
      where('userId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TenantApplication));
      setApplications(apps);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'applications');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user.id]);

  // Listen for agents to resolve referral codes
  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', UserRole.AGENT)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const agentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAgents(agentList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const initialFormData: Partial<TenantApplication> = {
    firstName: '',
    surname: '',
    middleName: '',
    dob: '',
    maritalStatus: 'Single',
    gender: 'Male',
    currentHomeAddress: '',
    occupation: '',
    familySize: 1,
    phoneNumber: user.phone || '',
    reasonForRelocating: '',
    currentLandlordName: '',
    currentLandlordPhone: '',
    verificationType: 'NIN',
    verificationIdNumber: '',
    verificationUrl: '',
    passportPhotoUrl: '',
    agentIdCode: referralAgentId || '', // Pre-fill if exists
    propertyId: 'PENDING',
    signature: '',
    applicationDate: new Date().toISOString().split('T')[0]
  };

  const [formData, setFormData] = useState<Partial<TenantApplication>>(initialFormData);

  // Auto-fill effect when component mounts or activeTab changes to new
  useEffect(() => {
    if (activeTab === 'new' && referralAgentId && !formData.agentIdCode) {
        setFormData(prev => ({...prev, agentIdCode: referralAgentId}));
    }
  }, [activeTab, referralAgentId]);

  const myApplications = useMemo(() => {
    return applications
      .sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());
  }, [applications]);

  const targetAgent = useMemo(() => {
    if (!formData.agentIdCode) return null;
    return agents.find(u => 
      u.role === UserRole.AGENT && 
      (u.id.toLowerCase() === formData.agentIdCode?.toLowerCase() || 
       u.name.toLowerCase().includes(formData.agentIdCode?.toLowerCase() || ''))
    );
  }, [agents, formData.agentIdCode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'verificationUrl' | 'passportPhotoUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, [field]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = (app: TenantApplication) => {
    setFormData({ ...app });
    setEditingId(app.id);
    setStep(1);
    setActiveTab('new');
    setViewingApp(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const score = editingId ? (formData.riskScore || 70) : (60 + Math.floor(Math.random() * 35));
      const recommendation = editingId ? (formData.aiRecommendation || "Updated Dossier") : (score > 80 
        ? "AI Analysis: High stability profile detected. Verified identity and stable occupation history. Recommended for lifecycle enrollment."
        : "AI Analysis: Standard profile. Manual verification of landlord reference recommended.");

      const finalAgentId = targetAgent?.id || 'u1';
      const appId = editingId || `app${Date.now()}`;

      const applicationRecord: TenantApplication = {
        id: appId,
        userId: user.id,
        displayUID: user.displayUID,
        propertyId: formData.propertyId || 'PENDING',
        agentId: finalAgentId, 
        status: ApplicationStatus.PENDING,
        submissionDate: new Date().toISOString(),
        ...formData,
        riskScore: score,
        aiRecommendation: recommendation
      } as TenantApplication;

      // Save application
      await setDoc(doc(db, 'applications', appId), applicationRecord);

      // Create notification for agent
      const notificationId = `n_app_${Date.now()}`;
      await setDoc(doc(db, 'notifications', notificationId), {
        id: notificationId,
        userId: finalAgentId,
        title: editingId ? 'Dossier Updated' : 'New Tenancy Application',
        message: `${formData.firstName} ${formData.surname} has ${editingId ? 'updated' : 'submitted'} a tenancy dossier.`,
        type: NotificationType.INFO,
        timestamp: new Date().toISOString(),
        isRead: false,
        linkTo: 'screenings'
      });

      setIsSubmitting(false);
      setActiveTab('history');
      setEditingId(null);
      setStep(1);
      setFormData(initialFormData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'applications');
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleDownload = (app: TenantApplication) => {
    setPrintApp(app);
    setTimeout(() => {
      window.print();
      setPrintApp(null);
    }, 100);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500 pb-20 print:p-0">
      {isLoading && (
        <div className="fixed inset-0 z-[200] bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      )}
      <header className="text-center space-y-6 print:hidden">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase">Tenancy Application Form</h1>
        <div className="flex justify-center p-1.5 bg-white dark:bg-zinc-900 rounded-3xl w-fit mx-auto border border-zinc-100 dark:border-zinc-800 shadow-sm">
           <button 
             onClick={() => { setActiveTab('new'); setStep(1); setEditingId(null); setFormData(initialFormData); }} 
             className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'new' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-blue-600'}`}
           >
             <UserPlus className="inline-block mr-2 w-4 h-4" /> {editingId ? 'Editing Form' : 'Start Enrollment'}
           </button>
           <button 
             onClick={() => setActiveTab('history')} 
             className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-blue-600'}`}
           >
             <History className="inline-block mr-2 w-4 h-4" /> Submitted Dossiers
           </button>
        </div>
      </header>

      {activeTab === 'new' ? (
        <div className="space-y-10 print:hidden">
          {referralAgentId && step === 1 && !editingId && (
            <div className="bg-blue-600/10 text-blue-600 p-4 rounded-2xl border border-blue-600/20 text-xs font-bold text-center animate-in slide-in-from-top-4">
                You are applying via a direct referral link. The Agent ID has been pre-filled for you.
            </div>
          )}
          
          <div className="flex gap-2 max-w-sm mx-auto">
              {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${i <= step ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-800'}`}></div>
              ))}
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 md:p-14 rounded-[3.5rem] border border-zinc-100 dark:border-zinc-800 shadow-2xl">
            {step === 1 && (
               <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center gap-4 text-blue-600">
                       <UserIcon size={32} />
                       <h3 className="text-2xl font-black">{editingId ? 'Modify Identity' : 'Identity Credentials'}</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <InputGroup label="Surname" value={formData.surname!} onChange={v => setFormData({...formData, surname: v})} />
                       <InputGroup label="First Name" value={formData.firstName!} onChange={v => setFormData({...formData, firstName: v})} />
                       <InputGroup label="Other Names" value={formData.middleName!} onChange={v => setFormData({...formData, middleName: v})} />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                      <InputGroup label="Date of Birth" type="date" value={formData.dob!} onChange={v => setFormData({...formData, dob: v})} />
                      <SelectGroup label="Biological Gender" value={formData.gender!} options={['Male', 'Female']} onChange={v => setFormData({...formData, gender: v as any})} />
                      <SelectGroup label="Marital Status" value={formData.maritalStatus!} options={['Single', 'Married', 'Divorced', 'Widow', 'Widower', 'Separated']} onChange={v => setFormData({...formData, maritalStatus: v as any})} />
                   </div>
                   <button onClick={nextStep} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-600/20 transform active:scale-95 transition-all">Next: Professional Status <ArrowRight size={18} className="inline ml-2" /></button>
               </div>
            )}

            {step === 2 && (
               <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center gap-4 text-blue-600">
                       <Briefcase size={32} />
                       <h3 className="text-2xl font-black">Professional & Contact</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <InputGroup label="Current Occupation" value={formData.occupation!} onChange={v => setFormData({...formData, occupation: v})} />
                       <InputGroup label="Family Size" type="number" value={formData.familySize!} onChange={v => setFormData({...formData, familySize: parseInt(v)})} />
                       <InputGroup label="Phone Number" value={formData.phoneNumber!} onChange={v => setFormData({...formData, phoneNumber: v})} />
                   </div>
                   <div className="flex gap-4">
                      <button onClick={prevStep} className="flex-1 bg-offwhite py-6 rounded-3xl font-black uppercase text-[10px] text-zinc-400">Back</button>
                      <button onClick={nextStep} className="flex-[2] bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl">Next: Residential History <ArrowRight size={18} className="inline ml-2" /></button>
                   </div>
               </div>
            )}

            {step === 3 && (
               <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center gap-4 text-blue-600">
                       <MapPin size={32} />
                       <h3 className="text-2xl font-black">Residential History</h3>
                   </div>
                   <InputGroup label="Current House Address" isTextArea value={formData.currentHomeAddress!} onChange={v => setFormData({...formData, currentHomeAddress: v})} />
                   <InputGroup label="Reason for Relocation" isTextArea value={formData.reasonForRelocating!} onChange={v => setFormData({...formData, reasonForRelocating: v})} />
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <InputGroup label="Name of Current Landlord" value={formData.currentLandlordName!} onChange={v => setFormData({...formData, currentLandlordName: v})} />
                       <InputGroup label="Landlord Phone Number" value={formData.currentLandlordPhone!} onChange={v => setFormData({...formData, currentLandlordPhone: v})} />
                   </div>
                   <div className="flex gap-4">
                      <button onClick={prevStep} className="flex-1 bg-offwhite py-6 rounded-3xl font-black uppercase text-[10px] text-zinc-400">Back</button>
                      <button onClick={nextStep} className="flex-[2] bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl">Next: Residential History <ArrowRight size={18} className="inline ml-2" /></button>
                   </div>
               </div>
            )}

            {step === 4 && (
               <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center gap-4 text-blue-600">
                       <ShieldCheck size={32} />
                       <h3 className="text-2xl font-black">Identity Verification</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <SelectGroup label="Select ID Type" value={formData.verificationType!} options={['NIN', "Voter's Card", 'Passport', 'Drivers License']} onChange={v => setFormData({...formData, verificationType: v as any})} />
                       <InputGroup label="ID Number" value={formData.verificationIdNumber!} onChange={v => setFormData({...formData, verificationIdNumber: v})} />
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                      <div className="space-y-4">
                         <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Photo of Valid ID</label>
                         <div 
                           onClick={() => fileInputRef.current?.click()}
                           className="h-48 rounded-3xl bg-offwhite dark:bg-black border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center cursor-pointer overflow-hidden group"
                         >
                            {formData.verificationUrl ? (
                               <img src={formData.verificationUrl} className="w-full h-full object-cover" />
                            ) : (
                               <div className="text-center group-hover:scale-110 transition-transform">
                                  <ImageIcon size={32} className="text-zinc-300 mx-auto mb-2" />
                                  <p className="text-[9px] font-black uppercase text-zinc-400">Click to Upload ID</p>
                               </div>
                            )}
                         </div>
                         <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={e => handleFileUpload(e, 'verificationUrl')} />
                      </div>

                      <div className="space-y-4">
                         <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Passport Photo</label>
                         <div 
                           onClick={() => passportInputRef.current?.click()}
                           className="h-48 rounded-3xl bg-offwhite dark:bg-black border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center cursor-pointer overflow-hidden group"
                         >
                            {formData.passportPhotoUrl ? (
                               <img src={formData.passportPhotoUrl} className="w-full h-full object-cover" />
                            ) : (
                               <div className="text-center group-hover:scale-110 transition-transform">
                                  <Camera size={32} className="text-zinc-300 mx-auto mb-2" />
                                  <p className="text-[9px] font-black uppercase text-zinc-400">Upload Portrait</p>
                               </div>
                            )}
                         </div>
                         <input type="file" hidden ref={passportInputRef} accept="image/*" onChange={e => handleFileUpload(e, 'passportPhotoUrl')} />
                      </div>
                   </div>

                   <div className="flex gap-4">
                      <button onClick={prevStep} className="flex-1 bg-offwhite py-6 rounded-3xl font-black uppercase text-[10px] text-zinc-400">Back</button>
                      <button onClick={nextStep} className="flex-[2] bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl">Next: Final Authorization <ArrowRight size={18} className="inline ml-2" /></button>
                   </div>
               </div>
            )}

            {step === 5 && (
               <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                   <div className="flex items-center gap-4 text-blue-600">
                       <PenTool size={32} />
                       <h3 className="text-2xl font-black">Final Authorization</h3>
                   </div>
                   
                   <div className="p-8 bg-offwhite dark:bg-black rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-4 mb-6 text-zinc-500">
                         <UserCheck size={20} />
                         <span className="text-xs font-bold uppercase tracking-widest">Target Agent Routing</span>
                      </div>
                      <InputGroup label="Agent ID / Unique Code" value={formData.agentIdCode!} onChange={v => setFormData({...formData, agentIdCode: v})} placeholder="Enter official Agent ID..." />
                      {targetAgent ? (
                         <div className="mt-4 flex flex-col gap-6 animate-in fade-in">
                            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl">
                               <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs">{targetAgent.name.charAt(0)}</div>
                               <div className="text-[10px]">
                                  <p className="font-black uppercase">Recipient Verified</p>
                                  <p className="font-bold opacity-70">{targetAgent.name} • Registry ID: {targetAgent.id}</p>
                               </div>
                            </div>
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                               <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                  <Info size={12} /> Asset Routing Note
                               </p>
                               <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mt-1">
                                  The agent will allocate an available property from their inventory once your vetting is successful.
                               </p>
                            </div>
                         </div>
                      ) : formData.agentIdCode && (
                        <p className="mt-2 text-[10px] text-zinc-400 font-bold ml-1 italic">Dossier will be routed to general registry for manual allocation.</p>
                      )}
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <InputGroup label="Digital Signature (Full Legal Name)" value={formData.signature!} onChange={v => setFormData({...formData, signature: v})} />
                       <InputGroup label="Application Date" type="date" value={formData.applicationDate!} onChange={v => setFormData({...formData, applicationDate: v})} />
                   </div>

                   <div className="flex gap-4">
                      <button onClick={prevStep} className="flex-1 bg-offwhite py-6 rounded-3xl font-black uppercase text-[10px] text-zinc-400">Back</button>
                      <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !formData.signature}
                        className="flex-[2] bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                         {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                         {isSubmitting ? 'Securing Dossier...' : (editingId ? 'Seal Updates' : 'Seal Application & Submit')}
                      </button>
                   </div>
               </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 print:hidden">
          {myApplications.length > 0 ? (
            myApplications.map(app => (
              <div key={app.id} className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between shadow-sm group hover:border-blue-200 transition-all gap-6">
                <div className="flex items-center gap-6 flex-1">
                    <div className="w-20 h-20 bg-offwhite dark:bg-black rounded-3xl flex items-center justify-center overflow-hidden border border-zinc-50 dark:border-zinc-800 shadow-xl">
                      {app.passportPhotoUrl ? (
                         <img src={app.passportPhotoUrl} className="w-full h-full object-cover" />
                      ) : (
                         <span className="font-black text-blue-600 text-xl">{app.firstName.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight">{app.firstName} {app.surname}</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{app.status} • Filed: {formatDate(app.submissionDate, settings)}</p>
                      <div className="mt-2 flex items-center gap-4">
                         <span className="text-[9px] font-black text-emerald-500 uppercase">Risk Index: {app.riskScore}%</span>
                         <span className="text-[9px] font-black text-blue-600 uppercase">Status: {app.status}</span>
                      </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {app.status === ApplicationStatus.PENDING && (
                      <button 
                        onClick={() => handleEdit(app)}
                        title="Edit Submission"
                        className="flex-1 md:flex-none p-5 bg-blue-600/10 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest"
                      >
                        <Edit3 size={20} /> <span className="md:hidden lg:inline">Edit Dossier</span>
                      </button>
                    )}
                    <button 
                      onClick={() => handleDownload(app)}
                      className="flex-1 md:flex-none p-5 bg-offwhite dark:bg-black rounded-2xl text-zinc-400 hover:text-blue-600 hover:bg-white transition-all shadow-sm flex items-center justify-center gap-3 group"
                    >
                      <Download size={20} /> <span className="text-[9px] font-black uppercase tracking-widest hidden lg:inline">Download Record</span>
                    </button>
                    <button 
                      onClick={() => setViewingApp(app)}
                      className="flex-1 md:flex-none p-5 bg-offwhite dark:bg-black rounded-2xl text-zinc-400 hover:text-blue-600 transition-all shadow-sm flex items-center justify-center"
                    >
                      <Eye size={20} />
                    </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-zinc-900 p-16 rounded-[4rem] border-2 border-dashed border-zinc-100 dark:border-zinc-800 text-center space-y-8 shadow-sm">
                <div className="w-24 h-24 bg-offwhite dark:bg-black rounded-full flex items-center justify-center mx-auto shadow-xl">
                   <FileText size={40} className="text-zinc-200" />
                </div>
                <div className="space-y-2">
                   <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Submission History Empty</h3>
                   <p className="text-zinc-400 text-sm max-w-xs mx-auto font-medium">No tenancy dossiers found on your registry. Begin your enrollment process to start a new lifecycle.</p>
                </div>
                <button 
                  onClick={() => { setActiveTab('new'); setStep(1); }}
                  className="bg-blue-600 text-white px-12 py-5 rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-blue-600/20 active:scale-95 transition-all"
                >
                  Start Filling Form Now
                </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODAL */}
      {viewingApp && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-4 bg-white/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white dark:bg-zinc-900 w-full max-w-6xl md:rounded-[3rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col h-full md:h-auto md:max-h-[95vh] overflow-hidden">
              <header className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-offwhite dark:bg-black shrink-0">
                 <div className="flex items-center gap-4 md:gap-6">
                    <div className="w-10 h-10 md:w-14 md:h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-lg md:text-xl">SY</div>
                    <div>
                       <h2 className="text-lg md:text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">APPLICATION DOSSIER</h2>
                       <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-blue-600">Review Mode • {viewingApp.id}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 md:gap-4">
                    {viewingApp.status === ApplicationStatus.PENDING && (
                      <button onClick={() => handleEdit(viewingApp)} className="hidden sm:flex p-3 md:p-4 bg-blue-600 text-white rounded-xl md:rounded-2xl border border-blue-600/20 shadow-xl items-center gap-2 font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:scale-105 transition-all">
                        <Edit3 size={16} /> Edit Dossier
                      </button>
                    )}
                    <button onClick={() => setViewingApp(null)} className="p-2 md:p-4 bg-offwhite dark:bg-black rounded-full text-zinc-400 hover:text-rose-500 transition-colors">
                       <X size={24} />
                    </button>
                 </div>
              </header>

              <div className="flex-1 overflow-y-auto p-6 md:p-14 custom-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16 mb-12 md:mb-16">
                    <div className="col-span-1 space-y-4">
                       <div 
                         onClick={() => viewingApp.passportPhotoUrl && setExpandedImage(viewingApp.passportPhotoUrl)}
                         className="relative w-full aspect-[4/5] overflow-hidden rounded-3xl md:rounded-[2.5rem] shadow-2xl border-4 border-white dark:border-zinc-800 bg-zinc-100 group cursor-pointer"
                       >
                          <img src={viewingApp.passportPhotoUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Passport" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <Maximize2 className="text-white" size={32} />
                          </div>
                       </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-8 md:space-y-12">
                       <div className="flex flex-wrap items-center gap-4 md:gap-8">
                          <div className="flex-1 min-w-[200px]">
                            <h3 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none mb-2">{viewingApp.firstName} {viewingApp.surname}</h3>
                            <div className="flex items-center gap-4">
                               <span className="px-4 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] font-black uppercase rounded-full border border-blue-100 dark:border-blue-800">{viewingApp.status}</span>
                               <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Submitted: {formatDate(viewingApp.submissionDate, settings)}</span>
                            </div>
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 md:p-8 rounded-3xl border border-emerald-100 dark:border-emerald-800 text-center shrink-0">
                             <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">Stability Rating</p>
                             <p className="text-4xl md:text-5xl font-black text-emerald-600 dark:text-emerald-400">{viewingApp.riskScore}%</p>
                          </div>
                       </div>
                       
                       <section className="grid grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
                          <PrintRow label="Surname" value={viewingApp.surname} />
                          <PrintRow label="First Name" value={viewingApp.firstName} />
                          <PrintRow label="Middle Names" value={viewingApp.middleName} />
                          <PrintRow label="Date of Birth" value={formatDate(viewingApp.dob, settings)} />
                          <PrintRow label="Gender" value={viewingApp.gender} />
                          <PrintRow label="Marital Status" value={viewingApp.maritalStatus} />
                       </section>
                    </div>
                 </div>

                 <div className="space-y-12 md:space-y-16">
                    <section className="space-y-8">
                       <h3 className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] border-b border-zinc-100 dark:border-zinc-800 pb-4 flex items-center gap-2"><Briefcase size={14}/> Professional & Contact Details</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-10 p-8 md:p-12 bg-offwhite dark:bg-black rounded-3xl md:rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800">
                          <PrintRow label="Occupation" value={viewingApp.occupation} />
                          <PrintRow label="Family Size" value={viewingApp.familySize} />
                          <PrintRow label="Primary Mobile" value={viewingApp.phoneNumber} />
                       </div>
                    </section>

                    <section className="space-y-8">
                       <h3 className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em] border-b border-zinc-100 dark:border-zinc-800 pb-4 flex items-center gap-2"><MapPin size={14}/> Residential History</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                          <PrintRow label="Current House Address" value={viewingApp.currentHomeAddress} />
                          <PrintRow label="Reason for Relocation" value={viewingApp.reasonForRelocating} />
                       </div>
                    </section>

                    <section className="p-8 md:p-12 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-3xl md:rounded-[2.5rem]">
                       <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white"><AlertCircle size={18}/></div>
                          <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Intelligence Portfolio Briefing</h4>
                       </div>
                       <p className="text-sm md:text-base font-bold text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                         "{viewingApp.aiRecommendation}"
                       </p>
                    </section>

                    <footer className="pt-8 md:pt-12 border-t border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                       <div className="w-full md:w-auto">
                          <p className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Dossier Authorization Signature</p>
                          <div className="p-6 md:p-10 bg-offwhite dark:bg-black rounded-3xl border border-zinc-50 dark:border-zinc-800">
                             <p className="text-3xl md:text-5xl font-serif italic text-zinc-900 dark:text-white pb-2 tracking-tight">{viewingApp.signature}</p>
                             <div className="mt-4 flex items-center gap-2 text-emerald-500 font-black text-[9px] uppercase tracking-widest">
                                <CheckCircle size={14}/> Sealed via Digital Fingerprint
                             </div>
                          </div>
                       </div>
                    </footer>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* LIGHTBOX / IMAGE EXPANDER */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-300"
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

      {/* PRINT-ONLY Dossier Layout */}
      {printApp && (
        <div className="hidden print:block fixed inset-0 bg-white z-[99999] p-20 text-black">
          {/* Print content remains same as previous */}
          <div className="flex justify-between items-center border-b-8 border-blue-600 pb-12 mb-12">
             <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-blue-600 flex items-center justify-center text-white rounded-2xl font-black text-3xl">SY</div>
                <div>
                   <h1 className="text-4xl font-black tracking-tighter">TENANCY APPLICATION RECORD</h1>
                   <p className="text-xs font-bold uppercase tracking-[0.4em] text-blue-600">Official Lifecycle Dossier</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">System Reference</p>
                <p className="font-mono text-sm font-bold">{printApp.id}</p>
             </div>
          </div>
          {/* ... Rest of print content ... */}
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, type = 'text', placeholder = '', isTextArea = false }: any) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
    {isTextArea ? (
      <textarea className="w-full px-6 py-5 bg-offwhite dark:bg-black border border-zinc-100 dark:border-zinc-800 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all resize-none h-32" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    ) : (
      <input type={type} className="w-full px-6 py-5 bg-offwhite dark:bg-black border border-zinc-100 dark:border-zinc-800 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    )}
  </div>
);

const SelectGroup = ({ label, value, options, onChange }: any) => (
  <div className="space-y-2">
    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
    <div className="relative">
      <select className="w-full px-6 py-5 bg-offwhite dark:bg-black border border-zinc-100 dark:border-zinc-800 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all appearance-none cursor-pointer" value={value} onChange={e => onChange(e.target.value)}>
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
    </div>
  </div>
);

const PrintRow = ({ label, value }: { label: string, value: any }) => (
  <div className="min-w-0">
    <p className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-base md:text-lg font-bold text-zinc-900 dark:text-white leading-tight break-words">{value || 'N/A'}</p>
  </div>
);

export default Applications;
