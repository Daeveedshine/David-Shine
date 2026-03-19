
import { User, Property, Agreement, Payment, MaintenanceTicket, Notification, UserRole, PropertyStatus, TicketStatus, TicketPriority, NotificationType, TenantApplication, ApplicationStatus, PropertyCategory, AgentTier, TransactionType, Commission, Referral } from './types';

const STORAGE_KEY = 'prop_lifecycle_data';

export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    maintenance: boolean;
    payments: boolean;
  };
  appearance: {
    density: 'comfortable' | 'compact';
    animations: boolean;
    glassEffect: boolean;
  };
  localization: {
    currency: 'NGN' | 'USD' | 'EUR';
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  };
}

interface AppState {
  users: User[];
  properties: Property[];
  agreements: Agreement[];
  payments: Payment[];
  commissions: Commission[];
  referrals: Referral[];
  tickets: MaintenanceTicket[];
  notifications: Notification[];
  applications: TenantApplication[];
  currentUser: User | null;
  theme: 'light' | 'dark';
  settings: UserSettings;
}

const initialSettings: UserSettings = {
  notifications: {
    email: true,
    push: true,
    maintenance: true,
    payments: true
  },
  appearance: {
    density: 'comfortable',
    animations: true,
    glassEffect: true
  },
  localization: {
    currency: 'NGN',
    dateFormat: 'DD/MM/YYYY'
  }
};

const initialData: AppState = {
  users: [
    { 
      id: 'u1', displayUID: 'AGT-X7R2P9', name: 'Chinedu (Elite Agent)', email: 'agent@spaceya.ng', role: UserRole.AGENT, phone: '+234 801 234 5678',
      agentTier: AgentTier.ELITE, reputationScore: 94, isVerified: true, walletBalance: 4500000, referralCode: 'CHI-001'
    },
    { 
      id: 'u2', displayUID: 'TNT-B4M1L8', name: 'Tunde Tenant', email: 'tenant@example.com', role: UserRole.TENANT, assignedPropertyId: 'p1', phone: '+234 802 345 6789',
      isVerified: true
    },
    { id: 'u3', displayUID: 'TNT-K9J3H2', name: 'Bob Applicant', email: 'bob@example.com', role: UserRole.TENANT, phone: '+234 803 456 7890' },
    { id: 'u4', displayUID: 'ADM-ADMIN1', name: 'Sarah Admin', email: 'admin@spaceya.ng', role: UserRole.ADMIN, phone: '+234 804 567 8901' },
    { 
      id: 'u5', displayUID: 'AGT-L2Q5W1', name: 'Ngozi (Junior Agent)', email: 'ngozi@spaceya.ng', role: UserRole.AGENT, phone: '+234 809 888 7777',
      agentTier: AgentTier.BRONZE, reputationScore: 65, isVerified: false, walletBalance: 50000, uplineAgentId: 'u1'
    },
  ],
  properties: [
    { 
      id: 'p1', name: 'Sunset Apartments #402', location: 'Victoria Island, Lagos', state: 'Lagos',
      rent: 2500000, status: PropertyStatus.OCCUPIED, agentId: 'u1', tenantId: 'u2', 
      category: PropertyCategory.RESIDENTIAL, type: '2 Bedroom flat', 
      description: 'Luxury 2 bedroom apartment with breathtaking ocean views.', 
      rentStartDate: '2024-01-01', rentExpiryDate: '2024-12-31',
      transactionType: TransactionType.LEASE,
      legalScore: 90,
      documents: [
        { id: 'd1', type: 'C_OF_O', url: '#', isVerified: true, uploadedBy: 'u1', uploadedAt: '2023-12-01' },
        { id: 'd2', type: 'GOVERNORS_CONSENT', url: '#', isVerified: true, uploadedBy: 'u1', uploadedAt: '2023-12-01' }
      ]
    },
    { 
      id: 'p2', name: 'Downtown Loft', location: 'Maitama, Abuja', state: 'FCT',
      rent: 3200000, status: PropertyStatus.VACANT, agentId: 'u1', 
      category: PropertyCategory.RESIDENTIAL, type: 'Studio Appartment', 
      description: 'Modern studio loft in the heart of the city.',
      transactionType: TransactionType.LEASE,
      legalScore: 40,
      documents: [] // Missing docs
    },
    { 
      id: 'p3', name: 'Oak Ridge Villa', location: 'Lekki Phase 1, Lagos', state: 'Lagos',
      rent: 85000000, status: PropertyStatus.LISTED, agentId: 'u1', 
      category: PropertyCategory.RESIDENTIAL, type: 'Fully Detached Duplex', 
      description: 'Spacious duplex with private garden and security. For Sale.',
      transactionType: TransactionType.SALE,
      legalScore: 85,
      documents: [
        { id: 'd3', type: 'C_OF_O', url: '#', isVerified: true, uploadedBy: 'u1', uploadedAt: '2024-01-15' }
      ]
    },
  ],
  agreements: [
    { id: 'a1', propertyId: 'p1', tenantId: 'u2', version: 1, startDate: '2023-01-01', endDate: '2024-12-31', status: 'active', documentUrl: 'https://example.com/lease_v1.pdf' },
  ],
  payments: [
    { id: 'pay1', propertyId: 'p1', tenantId: 'u2', amount: 2500000, date: '2023-11-01', status: 'paid', type: 'RENT' },
    { id: 'pay2', propertyId: 'p1', tenantId: 'u2', amount: 250000, date: '2023-11-01', status: 'paid', type: 'AGENCY_FEE' },
  ],
  commissions: [
    { id: 'c1', agentId: 'u1', propertyId: 'p1', amount: 250000, type: 'LEASE', status: 'PAID', dateEarned: '2023-11-01', description: 'Agency Fee - Sunset Apt' },
    { id: 'c2', agentId: 'u1', propertyId: 'p3', amount: 4250000, type: 'SALE', status: 'LOCKED', dateEarned: '2024-02-15', description: 'Projected Sale Commission - Oak Ridge' }
  ],
  referrals: [
    { id: 'r1', referrerAgentId: 'u1', referredUserId: 'u5', status: 'CONVERTED', date: '2023-10-10', commissionEarned: 50000 }
  ],
  tickets: [
    { id: 't1', propertyId: 'p1', tenantId: 'u2', issue: 'Leaking faucet in kitchen', status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, createdAt: new Date().toISOString() },
  ],
  notifications: [],
  applications: [
    {
      id: 'app1',
      userId: 'u3',
      propertyId: 'PENDING',
      agentId: 'u1', 
      status: ApplicationStatus.PENDING,
      submissionDate: new Date().toISOString(),
      firstName: 'Bob',
      surname: 'Applicant',
      middleName: 'Olu',
      dob: '1990-05-15',
      maritalStatus: 'Single',
      gender: 'Male',
      currentHomeAddress: '789 Birch St, Ikeja',
      occupation: 'Senior Engineer',
      familySize: 2,
      phoneNumber: '+234 803 456 7890',
      reasonForRelocating: 'Relocation for work',
      currentLandlordName: 'John Smith',
      currentLandlordPhone: '+234 805 111 2222',
      verificationType: 'NIN',
      verificationIdNumber: '23456789012',
      verificationUrl: 'https://images.unsplash.com/photo-1557064820-1c913d98fb73?auto=format&fit=crop&q=80&w=400',
      passportPhotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
      agentIdCode: 'u1',
      signature: 'Bob Applicant',
      applicationDate: new Date().toISOString().split('T')[0],
      riskScore: 85,
      aiRecommendation: 'Stable income and good rental history. Recommend approval.'
    }
  ],
  currentUser: null,
  theme: 'dark',
  settings: initialSettings,
};

export const getStore = (): AppState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return initialData;
  const parsed = JSON.parse(saved);
  if (!parsed.settings) parsed.settings = initialSettings;
  return parsed;
};

export const saveStore = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

const currencyLocales: Record<string, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  EUR: 'de-DE',
};

/**
 * UTILITY: Format currency based on user settings
 */
export const formatCurrency = (amount: number, settings: UserSettings): string => {
  const { currency } = settings.localization;
  const rates = { NGN: 1, USD: 0.00065, EUR: 0.0006 }; // Simulated exchange rates from Base NGN
  const converted = amount * (rates[currency] || 1);
  
  const cacheKey = `${currency}-${currency === 'NGN' ? '0' : '2'}`;
  let formatter = currencyFormatterCache.get(cacheKey);
  
  if (!formatter) {
    const locale = currencyLocales[currency] || 'en-US';
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'NGN' ? 0 : 2
    });
    currencyFormatterCache.set(cacheKey, formatter);
  }
  
  return formatter.format(converted);
};

/**
 * UTILITY: Format date based on user settings
 */
export const formatDate = (dateString: string, settings: UserSettings): string => {
  if (!dateString || dateString === '---') return '---';
  
  // Handle ISO strings or simple date strings
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const { dateFormat } = settings.localization;
  const cacheKey = dateFormat;
  let formatter = dateFormatterCache.get(cacheKey);

  if (!formatter) {
    const locale = dateFormat === 'DD/MM/YYYY' ? 'en-GB' : 'en-US';
    formatter = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    dateFormatterCache.set(cacheKey, formatter);
  }

  return formatter.format(date);
};
