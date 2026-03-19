
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { User, UserRole, Property, PropertyStatus, PropertyCategory, PropertyType, ApplicationStatus, Agreement, NotificationType, MaintenanceTicket, TicketStatus, TicketPriority, Notification, TenantApplication } from '../types';
import { getStore, formatCurrency, formatDate, UserSettings } from '../store';
import { 
  MapPin, Plus, Edit, X, Wrench, Info, ArrowRight, DollarSign, 
  UserPlus, Save, Loader2, Tag, Layout, Briefcase, UserCheck, 
  Maximize2, Users, CalendarDays, Clock, FileText, ChevronDown,
  ArrowUpNarrowWide, ArrowDownWideNarrow, CalendarRange, ListFilter,
  Search, CheckCircle2, ClipboardCheck, Building, Camera, ImageIcon, AlertTriangle,
  Upload, Send, FileWarning, AlertOctagon, AlertCircle, ShieldCheck, ArrowLeft
} from 'lucide-react';
import { analyzeMaintenanceRequest } from '../services/geminiService';
import { analyzePropertyLegality } from '../services/legalEngine';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc,
  serverTimestamp, 
  writeBatch,
  getDocs
} from 'firebase/firestore';

interface PropertiesProps {
  user: User;
  settings: UserSettings;
}

type SortOption = 'none' | 'rent_asc' | 'rent_desc' | 'location' | 'expiry';
type NoticeType = 'RENT_INCREASE' | 'QUIT_NOTICE' | 'EVICTION_NOTICE';

const PROPERTY_TYPES: PropertyType[] = [
  'Single Room', 'Self-contained', 'Mini Flat (1 Bedroom)', 
  '2 Bedroom flat', '3 Bedroom Flat', '4 Bedroom Flat', 
  'Terrace', 'Semi-detached Duplex', 'Fully Detached Duplex', 
  'Penthouse', 'Studio Appartment', 'Serviced Appartment', 
  'Shop', 'Plaza Shop', 'Office Space', 'Co-working Space', 
  'Factory', 'Warehouse', 'land'
];

const Properties: React.FC<PropertiesProps> = ({ user, settings }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showTenantPicker, setShowTenantPicker] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [editFormData, setEditFormData] = useState<Partial<Property>>({});
  
  // Maintenance State
  const [maintenanceIssue, setMaintenanceIssue] = useState('');
  const [maintenanceImage, setMaintenanceImage] = useState<string | null>(null);
  
  // Notice State
  const [noticeType, setNoticeType] = useState<NoticeType>('RENT_INCREASE');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeFile, setNoticeFile] = useState<string | null>(null);
  const [noticeFileName, setNoticeFileName] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('none');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeFileInputRef = useRef<HTMLInputElement>(null);

  // Firestore Listeners
  useEffect(() => {
    setIsLoading(true);
    
    // Properties Listener
    let propertiesQuery;
    if (user.role === UserRole.ADMIN) {
      propertiesQuery = query(collection(db, 'properties'));
    } else if (user.role === UserRole.AGENT) {
      propertiesQuery = query(collection(db, 'properties'), where('agentId', '==', user.id));
    } else {
      propertiesQuery = query(collection(db, 'properties'), where('id', '==', user.assignedPropertyId || 'NONE'));
    }

    const unsubProperties = onSnapshot(propertiesQuery, (snapshot) => {
      const props = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Property));
      setProperties(props);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'properties'));

    // Users Listener (for tenant picker)
    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('role', '==', UserRole.TENANT)), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Applications Listener
    const unsubApps = onSnapshot(collection(db, 'applications'), (snapshot) => {
      setApplications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'applications'));

    // Tickets Listener
    const unsubTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
      setTickets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceTicket)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tickets'));

    // Agreements Listener
    const unsubAgreements = onSnapshot(collection(db, 'agreements'), (snapshot) => {
      setAgreements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Agreement)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'agreements'));

    return () => {
      unsubProperties();
      unsubUsers();
      unsubApps();
      unsubTickets();
      unsubAgreements();
    };
  }, [user.id, user.role, user.assignedPropertyId]);

  // Initial Notice Template Effect
  useEffect(() => {
    if (!selectedProperty) return;
    const today = new Date().toLocaleDateString();
    
    if (noticeType === 'RENT_INCREASE') {
      setNoticeMessage(`NOTICE OF RENT INCREASE\n\nDate: ${today}\n\nDear Tenant,\n\nPlease be advised that effective from the next renewal cycle, the annual rent for ${selectedProperty.name} will be adjusted. The new rental amount will be [ENTER NEW AMOUNT] due to market adjustments.\n\nKindly acknowledge receipt of this notice.`);
    } else if (noticeType === 'QUIT_NOTICE') {
      setNoticeMessage(`NOTICE TO QUIT\n\nDate: ${today}\n\nDear Tenant,\n\nThis serves as a formal notice to quit and deliver up possession of the premises known as ${selectedProperty.name} by [ENTER DATE].\n\nFailure to comply will lead to legal action for recovery of premises.`);
    } else if (noticeType === 'EVICTION_NOTICE') {
      setNoticeMessage(`EVICTION NOTICE\n\nDate: ${today}\n\nDear Tenant,\n\nThis is a formal notice of eviction for the premises at ${selectedProperty.name}. You are required to vacate the premises within [ENTER NUMBER] days from the date of this notice.\n\nReason for Eviction: [ENTER REASON]\n\nPlease ensure all belongings are removed and keys are returned by the specified date.`);
    }
  }, [noticeType, selectedProperty]);

  // Helper for days remaining
  const getDaysRemaining = (expiryDate?: string) => {
    if (!expiryDate || expiryDate === '---') return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const sortedProperties = useMemo(() => {
    let list = [...properties];

    switch (sortBy) {
      case 'rent_asc': list.sort((a, b) => a.rent - b.rent); break;
      case 'rent_desc': list.sort((a, b) => b.rent - a.rent); break;
      case 'location': list.sort((a, b) => a.location.localeCompare(b.location)); break;
      case 'expiry':
        list.sort((a, b) => {
          if (!a.rentExpiryDate) return 1;
          if (!b.rentExpiryDate) return -1;
          return new Date(a.rentExpiryDate).getTime() - new Date(b.rentExpiryDate).getTime();
        });
        break;
      default: break;
    }
    return list;
  }, [properties, sortBy]);

  const approvedTenants = useMemo(() => {
    const approvedAppUserIds = applications
      .filter(app => app.status === ApplicationStatus.APPROVED && (user.role === UserRole.ADMIN || app.agentId === user.id))
      .map(app => app.userId);
    
    return users
      .filter(u => u.role === UserRole.TENANT && approvedAppUserIds.includes(u.id))
      .filter(u => !u.assignedPropertyId)
      .filter(u => 
        u.name.toLowerCase().includes(tenantSearch.toLowerCase()) || 
        u.email.toLowerCase().includes(tenantSearch.toLowerCase())
      );
  }, [applications, users, user.id, user.role, tenantSearch]);

  const handleAssignTenant = async (tenant: User) => {
    if (!selectedProperty) return;
    setIsSaving(true);

    try {
      const today = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(today.getFullYear() + 1);
      nextYear.setDate(today.getDate() - 1);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextYear.toISOString().split('T')[0];

      const batch = writeBatch(db);

      // Update Property
      const propertyRef = doc(db, 'properties', selectedProperty.id);
      batch.update(propertyRef, {
        tenantId: tenant.id,
        status: PropertyStatus.OCCUPIED,
        rentStartDate: startDate,
        rentExpiryDate: endDate
      });

      // Update Tenant User
      const userRef = doc(db, 'users', tenant.id);
      batch.update(userRef, {
        assignedPropertyId: selectedProperty.id
      });

      // Update Application
      const appQuery = query(
        collection(db, 'applications'), 
        where('userId', '==', tenant.id), 
        where('status', '==', ApplicationStatus.APPROVED)
      );
      const appSnapshot = await getDocs(appQuery);
      appSnapshot.docs.forEach(d => {
        batch.update(d.ref, { propertyId: selectedProperty.id });
      });

      // Create Agreement
      const agreementRef = doc(collection(db, 'agreements'));
      batch.set(agreementRef, {
        id: agreementRef.id,
        propertyId: selectedProperty.id,
        tenantId: tenant.id,
        version: 1,
        startDate,
        endDate,
        status: 'active'
      });

      // Create Notification
      const notificationRef = doc(collection(db, 'notifications'));
      batch.set(notificationRef, {
        id: notificationRef.id,
        userId: tenant.id,
        title: 'Lease Activated',
        message: `Your application for ${selectedProperty.name} is complete. Your tenancy cycle starts today.`,
        type: NotificationType.SUCCESS,
        timestamp: new Date().toISOString(),
        isRead: false,
        linkTo: 'dashboard'
      });

      await batch.commit();

      setShowTenantPicker(false);
      setTenantSearch('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'properties/assign');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setMaintenanceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleMaintenanceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMaintenanceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNoticeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNoticeFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setNoticeFile(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitMaintenance = async () => {
    if (!selectedProperty || !maintenanceIssue) return;
    setIsSaving(true);

    try {
      const aiRes = await analyzeMaintenanceRequest(maintenanceIssue);

      const ticketRef = doc(collection(db, 'tickets'));
      const newTicket: MaintenanceTicket = {
        id: ticketRef.id,
        propertyId: selectedProperty.id,
        tenantId: user.id,
        issue: maintenanceIssue,
        status: TicketStatus.OPEN,
        priority: (aiRes.priority as TicketPriority) || TicketPriority.MEDIUM,
        createdAt: new Date().toISOString(),
        imageUrl: maintenanceImage || undefined,
        aiAssessment: aiRes.assessment
      };

      await setDoc(ticketRef, newTicket);

      const notificationRef = doc(collection(db, 'notifications'));
      const notification = {
        id: notificationRef.id,
        userId: selectedProperty.agentId,
        title: 'Maintenance Alert',
        message: `A new repair request has been filed for ${selectedProperty.name}. Check Maintenance tab for details.`,
        type: newTicket.priority === TicketPriority.EMERGENCY ? NotificationType.ERROR : NotificationType.WARNING,
        timestamp: new Date().toISOString(),
        isRead: false,
        linkTo: 'maintenance'
      };

      await setDoc(notificationRef, notification);

      setShowMaintenanceForm(false);
      setMaintenanceIssue('');
      setMaintenanceImage(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tickets');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendNotice = async () => {
    if (!selectedProperty || !selectedProperty.tenantId || !noticeMessage) return;
    setIsSaving(true);

    try {
      let title = '';
      let type = NotificationType.INFO;

      if (noticeType === 'RENT_INCREASE') {
        title = 'Notice: Rent Adjustment';
        type = NotificationType.INFO;
      } else if (noticeType === 'QUIT_NOTICE') {
        title = 'Urgent: Notice to Quit';
        type = NotificationType.WARNING;
      } else if (noticeType === 'EVICTION_NOTICE') {
        title = 'FINAL NOTICE: Eviction';
        type = NotificationType.ERROR;
      }

      const notificationRef = doc(collection(db, 'notifications'));
      const notification = {
        id: notificationRef.id,
        userId: selectedProperty.tenantId!,
        title: title,
        message: noticeMessage,
        type: type,
        timestamp: new Date().toISOString(),
        isRead: false,
        linkTo: 'notifications',
        attachmentUrl: noticeFile || undefined
      };

      await setDoc(notificationRef, notification);

      setShowNoticeForm(false);
      setNoticeFile(null);
      setNoticeFileName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusStyle = (status: PropertyStatus) => {
    switch (status) {
      case PropertyStatus.OCCUPIED: return 'bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-500/20';
      case PropertyStatus.VACANT: return 'bg-blue-600 text-white border-blue-500/50 shadow-blue-600/20';
      case PropertyStatus.LISTED: return 'bg-amber-500 text-white border-amber-400/50 shadow-amber-500/20';
      default: return 'bg-zinc-500 text-white border-zinc-400/50';
    }
  };

  const handleOpenDetail = (property: Property) => {
    setSelectedProperty(property);
    setEditFormData(property);
    setIsEditing(false);
    setShowTenantPicker(false);
    setShowMaintenanceForm(false);
    setShowNoticeForm(false);
  };

  const handleStartEdit = (e: React.MouseEvent, property: Property) => {
    e.stopPropagation();
    setSelectedProperty(property);
    setEditFormData(property);
    setIsEditing(true);
    setShowTenantPicker(false);
    setShowMaintenanceForm(false);
    setShowNoticeForm(false);
  };

  const calculateExpiryDate = (startDate: string) => {
    if (!startDate) return '';
    const date = new Date(startDate);
    date.setFullYear(date.getFullYear() + 1);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const start = e.target.value;
    const expiry = calculateExpiryDate(start);
    setEditFormData({ ...editFormData, rentStartDate: start, rentExpiryDate: expiry });
  };

  const handleSave = async () => {
    if (!selectedProperty) return;
    setIsSaving(true);
    try {
      const propertyRef = doc(db, 'properties', selectedProperty.id);
      await updateDoc(propertyRef, editFormData);
      setSelectedProperty({ ...selectedProperty, ...editFormData } as Property);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `properties/${selectedProperty.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishNew = async () => {
    setIsSaving(true);
    try {
      const propertyRef = doc(collection(db, 'properties'));
      const newProperty: Property = {
        id: propertyRef.id,
        name: 'New Asset ' + (properties.length + 1),
        location: 'Address TBD',
        state: 'Lagos',
        rent: 0,
        status: PropertyStatus.DRAFT,
        agentId: user.id,
        category: PropertyCategory.RESIDENTIAL,
        type: 'Mini Flat (1 Bedroom)',
        description: 'Enter description here...',
        documents: []
      };
      await setDoc(propertyRef, newProperty);
      handleOpenDetail(newProperty);
      setIsEditing(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'properties');
    } finally {
      setIsSaving(false);
    }
  };

  const sortOptions = [
    { id: 'none', label: 'Default Order', icon: ListFilter },
    { id: 'rent_asc', label: 'Rent: Low to High', icon: ArrowUpNarrowWide },
    { id: 'rent_desc', label: 'Rent: High to Low', icon: ArrowDownWideNarrow },
    { id: 'location', label: 'By Location (A-Z)', icon: MapPin },
    { id: 'expiry', label: 'By Expiry Month', icon: CalendarRange },
  ];

  const getLegalColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 50) return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500 pb-20">
      {isLoading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      )}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">Inventory</h1>
          <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2 opacity-60">Asset Registry</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative">
            <button 
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/10 border border-white/20 dark:border-white/5 backdrop-blur-md flex items-center justify-between gap-4 font-bold text-[11px] uppercase tracking-widest text-zinc-600 dark:text-zinc-300 hover:bg-white/20 transition-all active:scale-95 shadow-xl"
            >
              <div className="flex items-center gap-3">
                {React.createElement(sortOptions.find(o => o.id === sortBy)?.icon || ListFilter, { size: 16, className: "text-blue-600" })}
                <span>{sortOptions.find(o => o.id === sortBy)?.label}</span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-300 ${isSortMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSortMenuOpen && (
              <div className="absolute top-full left-0 right-0 sm:right-auto sm:min-w-[240px] mt-2 z-50 glass-card rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-top-2">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setSortBy(opt.id as SortOption); setIsSortMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-black uppercase tracking-widest transition-colors ${sortBy === opt.id ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:bg-white/10 dark:hover:bg-black/40 hover:text-blue-600 dark:hover:text-blue-400'}`}
                  >
                    <opt.icon size={16} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(user.role === UserRole.AGENT || user.role === UserRole.ADMIN) && (
            <button 
              onClick={handlePublishNew}
              className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/20 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-3" /> Publish Asset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {sortedProperties.map(property => {
          const propertyAgent = users.find(u => u.id === property.agentId);
          const activeTickets = tickets.filter(t => t.propertyId === property.id && t.status !== TicketStatus.RESOLVED);
          
          const daysRemaining = getDaysRemaining(property.rentExpiryDate);
          const isExpiringSoon = daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0;
          const isExpired = daysRemaining !== null && daysRemaining <= 0;
          const legalCheck = analyzePropertyLegality(property);

          return (
            <div 
              key={property.id} 
              onClick={() => handleOpenDetail(property)}
              className="glass-card rounded-[3.2rem] overflow-hidden group hover:scale-[1.01] transition-all duration-700 cursor-pointer flex flex-col md:flex-row shadow-2xl border-white/20 dark:border-white/5"
            >
              <div className="w-full md:w-5/12 h-80 md:h-auto bg-offwhite dark:bg-black relative overflow-hidden shrink-0">
                <img 
                  src={`https://picsum.photos/seed/${property.id}/600/800`} 
                  alt={property.name} 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                />
                <div className="absolute top-6 left-6 flex flex-col gap-2">
                  <span className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase shadow-xl border backdrop-blur-md ${getStatusStyle(property.status)}`}>
                    {property.status}
                  </span>
                  <span className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase border backdrop-blur-md shadow-xl flex items-center gap-2 ${getLegalColor(legalCheck.score)}`}>
                    <ShieldCheck size={12} /> Legal: {legalCheck.score}%
                  </span>
                  {activeTickets.length > 0 && (
                    <span className="px-4 py-2 rounded-2xl text-[9px] font-black uppercase border border-rose-500/30 bg-rose-500/20 backdrop-blur-md text-rose-500 shadow-xl flex items-center gap-2 animate-pulse">
                       <AlertTriangle size={12} /> {activeTickets.length} Faults Active
                    </span>
                  )}
                </div>
              </div>

              <div className="p-10 flex-1 flex flex-col justify-between space-y-8">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight tracking-tighter">{property.name}</h3>
                    {(user.role === UserRole.AGENT || user.role === UserRole.ADMIN) && (
                      <button 
                        onClick={(e) => handleStartEdit(e, property)}
                        className="p-3 bg-white/10 dark:bg-white/5 rounded-2xl text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-white/10"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-10">
                    <MapPin className="w-3.5 h-3.5 mr-2 text-blue-600" />
                    <span className="truncate">{property.location}, {property.state}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                      <p className="text-[8px] font-black text-zinc-500 uppercase mb-1">Type</p>
                      <p className="text-xs font-black text-zinc-900 dark:text-white truncate">{property.type}</p>
                    </div>
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                      <p className="text-[8px] font-black text-zinc-500 uppercase mb-1">Term</p>
                      <p className="text-xs font-black text-zinc-900 dark:text-white truncate">Annual</p>
                    </div>
                    <div className={`p-4 rounded-2xl border backdrop-blur-sm ${isExpiringSoon ? 'bg-amber-500/10 border-amber-500/30' : isExpired ? 'bg-rose-500/10 border-rose-500/30' : 'border-white/10 bg-white/5'}`}>
                      <p className={`text-[8px] font-black uppercase mb-1 flex items-center gap-1 ${isExpiringSoon ? 'text-amber-500' : isExpired ? 'text-rose-500' : 'text-zinc-500'}`}>
                        {isExpiringSoon && <AlertTriangle size={10} />}
                        {isExpired && <AlertCircle size={10} />}
                        Expiry
                      </p>
                      <p className={`text-xs font-black ${isExpiringSoon ? 'text-amber-600 dark:text-amber-400' : isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {formatDate(property.rentExpiryDate || '---', settings)}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                      <p className="text-[8px] font-black text-zinc-500 uppercase mb-1">Status</p>
                      <p className="text-xs font-black text-zinc-900 dark:text-white truncate">{property.transactionType || 'LEASE'}</p>
                    </div>
                  </div>

                  <div className={`p-5 rounded-3xl border mb-8 ${legalCheck.status === 'RED' ? 'bg-rose-500/5 border-rose-500/20' : legalCheck.status === 'AMBER' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                      <div className="flex items-center justify-between mb-3">
                          <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${legalCheck.status === 'RED' ? 'text-rose-500' : legalCheck.status === 'AMBER' ? 'text-amber-600' : 'text-emerald-600'}`}>
                              <ShieldCheck size={12} /> Compliance Score
                          </p>
                          <span className={`text-xs font-black ${legalCheck.status === 'RED' ? 'text-rose-600' : legalCheck.status === 'AMBER' ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {legalCheck.score}/100
                          </span>
                      </div>
                      <div className="space-y-2">
                          {legalCheck.flags.length > 0 ? (
                              legalCheck.flags.slice(0, 2).map((flag, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                      <AlertCircle size={12} className={`mt-0.5 shrink-0 ${legalCheck.status === 'RED' ? 'text-rose-500' : 'text-amber-500'}`} />
                                      <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 leading-tight">{flag}</p>
                                  </div>
                              ))
                          ) : (
                              <div className="flex items-center gap-2">
                                  <CheckCircle2 size={12} className="text-emerald-500" />
                                  <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">All statutory requirements met.</p>
                              </div>
                          )}
                          {legalCheck.flags.length > 2 && (
                              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest pl-5">+{legalCheck.flags.length - 2} more flags</p>
                          )}
                      </div>
                  </div>

                  <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 backdrop-blur-sm">
                    <p className="text-[8px] font-black text-zinc-500 uppercase mb-2 flex items-center gap-1 tracking-widest"><FileText size={10}/> Summary</p>
                    <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2 italic">
                      {property.description || "Portfolio brief pending submission."}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                  <div className="flex flex-col">
                    <p className="text-[8px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Agent Registry</p>
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 bg-blue-600/20 rounded-lg flex items-center justify-center text-[10px] font-black text-blue-600 uppercase border border-blue-600/20">
                          {propertyAgent?.name.charAt(0)}
                       </div>
                       <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase truncate">{propertyAgent?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-zinc-500 uppercase mb-1 tracking-widest">Yield</p>
                    <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{formatCurrency(property.rent, settings)}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedProperty && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-6xl md:rounded-[3.5rem] shadow-[0_32px_128px_rgba(0,0,0,0.5)] border-white/20 dark:border-white/5 overflow-hidden flex flex-col md:flex-row h-full md:h-auto md:max-h-[92vh] relative">
             
             <div 
               className="w-full md:w-5/12 h-72 md:h-auto relative group cursor-pointer shrink-0"
               onClick={() => setExpandedImage(`https://picsum.photos/seed/${selectedProperty.id}/1200/1600`)}
             >
                <img src={`https://picsum.photos/seed/${selectedProperty.id}/800/1200`} className="w-full h-full object-cover" alt="Property Preview" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="text-white" size={48} />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-10">
                    <p className="text-white font-black text-3xl tracking-tighter">{selectedProperty.name}</p>
                    <p className="text-white/60 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mt-2">
                      <MapPin size={12} className="text-blue-400" /> {selectedProperty.location}, {selectedProperty.state}
                    </p>
                </div>
                <button onClick={() => setSelectedProperty(null)} className="absolute top-8 left-8 p-3 glass-card rounded-full text-white md:hidden shadow-xl z-10">
                  <X size={20} />
                </button>
             </div>

             <div className="flex-1 p-8 md:p-14 overflow-y-auto custom-scrollbar scroll-smooth">
                {/* Tenant Picker */}
                {showTenantPicker && (
                  <div className="animate-in slide-in-from-right duration-500">
                    <button 
                      onClick={() => setShowTenantPicker(false)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to Details
                    </button>
                    <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-8">Assign New Tenant</h3>
                    <div className="relative mb-8">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input 
                        className="glass-input w-full pl-12 pr-6 py-4 rounded-2xl outline-none text-sm"
                        placeholder="Search approved applications..."
                        value={tenantSearch}
                        onChange={e => setTenantSearch(e.target.value)}
                      />
                    </div>
                    <div className="space-y-4">
                      {applications
                        .filter(app => 
                          app.status === ApplicationStatus.APPROVED && 
                          (app.tenantName.toLowerCase().includes(tenantSearch.toLowerCase()) || 
                           app.tenantEmail.toLowerCase().includes(tenantSearch.toLowerCase()))
                        )
                        .map(app => (
                          <div key={app.id} className="glass-card p-6 rounded-3xl border-white/10 hover:border-blue-500/50 transition-all group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 font-black text-xl">
                                  {app.tenantName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-black text-zinc-900 dark:text-white tracking-tight">{app.tenantName}</p>
                                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{app.tenantEmail}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleAssignTenant(app)}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                              >
                                Assign Now
                              </button>
                            </div>
                          </div>
                        ))}
                      {applications.filter(app => app.status === ApplicationStatus.APPROVED).length === 0 && (
                        <div className="text-center py-12 glass-card rounded-[2.5rem] border-dashed border-white/10">
                          <Users className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">No Approved Applications</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Maintenance Form */}
                {showMaintenanceForm && (
                  <div className="animate-in slide-in-from-right duration-500">
                    <button 
                      onClick={() => setShowMaintenanceForm(false)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to Details
                    </button>
                    <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-8">Submit Repair Request</h3>
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Issue Description</label>
                        <textarea 
                          className="glass-input w-full p-6 rounded-3xl outline-none text-sm min-h-[150px] resize-none"
                          placeholder="Describe the maintenance issue in detail..."
                          value={maintenanceIssue}
                          onChange={e => setMaintenanceIssue(e.target.value)}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Evidence / Photos</label>
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="glass-card border-dashed border-white/20 rounded-3xl p-12 text-center cursor-pointer hover:border-blue-500/50 transition-all group"
                        >
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleMaintenanceFileUpload}
                          />
                          {maintenanceImage ? (
                            <div className="relative inline-block">
                              <img src={maintenanceImage} className="w-32 h-32 object-cover rounded-2xl mx-auto" alt="Preview" />
                              <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="text-white" />
                              </div>
                            </div>
                          ) : (
                            <>
                              <Camera className="w-12 h-12 mx-auto mb-4 text-zinc-300 group-hover:text-blue-500 transition-colors" />
                              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Click to upload photo</p>
                            </>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={handleSubmitMaintenance}
                        disabled={isSaving || !maintenanceIssue}
                        className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-2xl"
                      >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Request'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Notice Form */}
                {showNoticeForm && (
                  <div className="animate-in slide-in-from-right duration-500">
                    <button 
                      onClick={() => setShowNoticeForm(false)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to Details
                    </button>
                    <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-8">Issue Legal Notice</h3>
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button 
                          onClick={() => setNoticeType('RENT_INCREASE')}
                          className={`p-6 rounded-3xl border transition-all text-left ${noticeType === 'RENT_INCREASE' ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/20' : 'glass-card border-white/10 text-zinc-500'}`}
                        >
                          <DollarSign className="mb-3" size={24} />
                          <p className="text-[10px] font-black uppercase tracking-widest">Rent Adjustment</p>
                        </button>
                        <button 
                          onClick={() => setNoticeType('QUIT_NOTICE')}
                          className={`p-6 rounded-3xl border transition-all text-left ${noticeType === 'QUIT_NOTICE' ? 'bg-red-600 border-red-500 text-white shadow-xl shadow-red-600/20' : 'glass-card border-white/10 text-zinc-500'}`}
                        >
                          <FileWarning className="mb-3" size={24} />
                          <p className="text-[10px] font-black uppercase tracking-widest">Notice to Quit</p>
                        </button>
                        <button 
                          onClick={() => setNoticeType('EVICTION_NOTICE')}
                          className={`p-6 rounded-3xl border transition-all text-left ${noticeType === 'EVICTION_NOTICE' ? 'bg-orange-600 border-orange-500 text-white shadow-xl shadow-orange-600/20' : 'glass-card border-white/10 text-zinc-500'}`}
                        >
                          <AlertOctagon className="mb-3" size={24} />
                          <p className="text-[10px] font-black uppercase tracking-widest">Eviction Notice</p>
                        </button>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Official Message</label>
                        <textarea 
                          className="glass-input w-full p-6 rounded-3xl outline-none text-sm min-h-[150px] resize-none"
                          placeholder="Enter the official notice text..."
                          value={noticeMessage}
                          onChange={e => setNoticeMessage(e.target.value)}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Supporting Documents</label>
                        <div 
                          onClick={() => noticeFileInputRef.current?.click()}
                          className="glass-card border-dashed border-white/20 rounded-3xl p-8 flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-all"
                        >
                          <input 
                            type="file" 
                            ref={noticeFileInputRef} 
                            className="hidden" 
                            onChange={handleNoticeFileUpload}
                          />
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                              <FileText className="text-zinc-500" size={20} />
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                {noticeFileName || 'Upload PDF/Doc'}
                              </p>
                              <p className="text-[9px] text-zinc-500 font-bold uppercase">Max 5MB</p>
                            </div>
                          </div>
                          <Upload className="text-zinc-400" size={18} />
                        </div>
                      </div>
                      <button 
                        onClick={handleSendNotice}
                        disabled={isSaving || !noticeMessage}
                        className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-2xl"
                      >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Issue Official Notice'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Default View */}
                {!showTenantPicker && !showMaintenanceForm && !showNoticeForm && (
                  <>
                    <div className="flex justify-between items-start mb-12">
                      <div className="space-y-4 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-lg border backdrop-blur-md ${getStatusStyle(selectedProperty.status)}`}>{selectedProperty.status}</span>
                            <span className="bg-white/10 border border-white/20 text-zinc-700 dark:text-zinc-300 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">{selectedProperty.category}</span>
                        </div>
                        {isEditing ? (
                            <input 
                                className="glass-input text-3xl font-black text-zinc-900 dark:text-white tracking-tighter p-4 rounded-2xl w-full outline-none" 
                                value={editFormData.name} 
                                onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                            />
                        ) : (
                            <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tighter leading-tight">{selectedProperty.name}</h2>
                        )}
                      </div>
                      <div className="flex gap-4 ml-6">
                        {(user.role === UserRole.AGENT || user.role === UserRole.ADMIN) && !isEditing && (
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="p-4 glass-input rounded-full text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                            >
                                <Edit size={20} />
                            </button>
                        )}
                        <button 
                            onClick={() => setSelectedProperty(null)}
                            className="p-4 glass-input rounded-full text-zinc-500 hover:text-red-500 transition-all"
                        >
                            <X size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
                      {selectedProperty.status === PropertyStatus.VACANT ? (
                        <button 
                          onClick={() => setShowTenantPicker(true)}
                          className="flex items-center justify-center gap-3 p-6 bg-blue-600 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
                        >
                          <UserPlus size={18} /> Assign Tenant
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => setShowMaintenanceForm(true)}
                            className="flex items-center justify-center gap-3 p-6 glass-card border-white/10 text-zinc-700 dark:text-zinc-300 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all"
                          >
                            <Wrench size={18} /> Submit Repair
                          </button>
                          <button 
                            onClick={() => setShowNoticeForm(true)}
                            className="flex items-center justify-center gap-3 p-6 glass-card border-white/10 text-zinc-700 dark:text-zinc-300 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all"
                          >
                            <FileWarning size={18} /> Issue Notice
                          </button>
                        </>
                      )}
                      <button className="flex items-center justify-center gap-3 p-6 glass-card border-white/10 text-zinc-700 dark:text-zinc-300 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all">
                        <FileText size={18} /> View History
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-10">
                            <section>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-2">
                                    <Info size={14} className="text-blue-500" /> Core Specifications
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    {isEditing ? (
                                        <>
                                            <InputWrapper label="Location">
                                                <input 
                                                    className="glass-input w-full p-3 rounded-xl outline-none text-sm" 
                                                    value={editFormData.location} 
                                                    onChange={e => setEditFormData({...editFormData, location: e.target.value})}
                                                />
                                            </InputWrapper>
                                            <InputWrapper label="State">
                                                <input 
                                                    className="glass-input w-full p-3 rounded-xl outline-none text-sm" 
                                                    value={editFormData.state} 
                                                    onChange={e => setEditFormData({...editFormData, state: e.target.value})}
                                                />
                                            </InputWrapper>
                                            <InputWrapper label="Monthly Rent">
                                                <input 
                                                    type="number"
                                                    className="glass-input w-full p-3 rounded-xl outline-none text-sm" 
                                                    value={editFormData.rent} 
                                                    onChange={e => setEditFormData({...editFormData, rent: Number(e.target.value)})}
                                                />
                                            </InputWrapper>
                                            <InputWrapper label="Type">
                                                <select 
                                                    className="glass-input w-full p-3 rounded-xl outline-none text-sm appearance-none" 
                                                    value={editFormData.type} 
                                                    onChange={e => setEditFormData({...editFormData, type: e.target.value as PropertyType})}
                                                >
                                                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </InputWrapper>
                                        </>
                                    ) : (
                                        <>
                                            <DetailCard label="Monthly Revenue" value={formatCurrency(selectedProperty.rent, settings)} icon={DollarSign} color="emerald" />
                                            <DetailCard label="Asset Type" value={selectedProperty.type} icon={Building} color="blue" />
                                            <DetailCard label="Total Units" value="1 Unit" icon={Layout} color="purple" />
                                            <DetailCard label="Current Status" value={selectedProperty.status} icon={Tag} color="orange" />
                                        </>
                                    )}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-emerald-500" /> Legal Compliance Audit
                                </h3>
                                <div className="glass-card p-8 rounded-[2.5rem] border-white/10 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all" />
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Compliance Score</p>
                                            <p className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">
                                                {analyzePropertyLegality(selectedProperty).score}%
                                            </p>
                                        </div>
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                            <ClipboardCheck className="text-emerald-500" size={32} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {analyzePropertyLegality(selectedProperty).flags.map((flag, idx) => (
                                            <div key={idx} className="flex items-start gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-white/5">
                                                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${analyzePropertyLegality(selectedProperty).status === 'RED' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-amber-500'}`} />
                                                <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed">{flag}</p>
                                            </div>
                                        ))}
                                        {analyzePropertyLegality(selectedProperty).flags.length === 0 && (
                                            <div className="flex items-center gap-4 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                                                <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                                                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Fully Compliant Asset</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="space-y-10">
                            <section>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-2">
                                    <Users size={14} className="text-purple-500" /> Occupancy Details
                                </h3>
                                <div className="glass-card p-8 rounded-[2.5rem] border-white/10">
                                    {selectedProperty.status === PropertyStatus.OCCUPIED ? (
                                        <div className="space-y-8">
                                            <div className="flex items-center gap-5">
                                                <div className="w-16 h-16 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-2xl font-black text-zinc-400">
                                                    {selectedProperty.tenantName?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">{selectedProperty.tenantName}</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Active Tenant</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-white/5">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Lease Start</p>
                                                    <p className="text-[11px] font-bold text-zinc-900 dark:text-white">{formatDate(selectedProperty.leaseStart!, settings)}</p>
                                                </div>
                                                <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-white/5">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Lease Expiry</p>
                                                    <p className="text-[11px] font-bold text-zinc-900 dark:text-white">{formatDate(selectedProperty.leaseEnd!, settings)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10">
                                            <Users className="w-12 h-12 mx-auto mb-4 text-zinc-200" />
                                            <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No Active Occupancy</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {isEditing && (
                                <div className="flex gap-4 pt-8">
                                    <button 
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex-1 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-2xl flex items-center justify-center gap-3"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save size={18} /> Save Changes</>}
                                    </button>
                                    <button 
                                        onClick={() => setIsEditing(false)}
                                        className="px-8 py-5 glass-card border-white/10 text-zinc-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                  </>
                )}
             </div>
          </div>
        </div>
      )}

      {expandedImage && (
        <div 
          className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-10 animate-in fade-in zoom-in-95 duration-500"
          onClick={() => setExpandedImage(null)}
        >
           <button className="absolute top-10 right-10 p-5 glass-card rounded-full text-white" onClick={() => setExpandedImage(null)}>
              <X size={32} />
           </button>
           <img src={expandedImage} className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.4)]" alt="Full Preview" />
        </div>
      )}
    </div>
  );
};

const InputWrapper = ({ label, children }: { label: string, children?: React.ReactNode }) => (
    <div className="space-y-2">
        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">{label}</p>
        <div className="relative">
          {children}
          {React.isValidElement(children) && children.type === 'select' && (
             <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
          )}
        </div>
    </div>
);

const DetailCard = ({ icon: Icon, label, value }: any) => (
  <div className="p-8 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 group hover:border-blue-600 transition-colors shadow-xl">
    <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{label}</p>
        <Icon className="w-4 h-4 text-blue-600" />
    </div>
    <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter truncate leading-tight">{value}</p>
  </div>
);

export default Properties;
