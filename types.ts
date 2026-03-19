
export enum UserRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  TENANT = 'TENANT',
  LANDLORD = 'LANDLORD',
  PROPERTY_MANAGER = 'PROPERTY_MANAGER'
}

export enum AgentTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  ELITE = 'ELITE'
}

export enum PropertyStatus {
  DRAFT = 'DRAFT',
  LISTED = 'LISTED',
  OCCUPIED = 'OCCUPIED',
  VACANT = 'VACANT',
  ARCHIVED = 'ARCHIVED',
  LEGAL_REVIEW = 'LEGAL_REVIEW'
}

export enum PropertyCategory {
  RESIDENTIAL = 'Residential',
  COMMERCIAL = 'Commercial',
  LAND = 'Land'
}

export enum TransactionType {
  LEASE = 'LEASE',
  SALE = 'SALE',
  SHORT_LET = 'SHORT_LET'
}

export type PropertyType = 
  | 'Single Room' | 'Self-contained' | 'Mini Flat (1 Bedroom)' 
  | '2 Bedroom flat' | '3 Bedroom Flat' | '4 Bedroom Flat' 
  | 'Terrace' | 'Semi-detached Duplex' | 'Fully Detached Duplex' 
  | 'Penthouse' | 'Studio Appartment' | 'Serviced Appartment' 
  | 'Shop' | 'Plaza Shop' | 'Office Space' | 'Co-working Space' 
  | 'Factory' | 'Warehouse' | 'land';

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED'
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  EMERGENCY = 'EMERGENCY'
}

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export enum ApplicationStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MORE_INFO_REQUIRED = 'MORE_INFO_REQUIRED'
}

export interface User {
  id: string;
  displayUID?: string;
  name: string;
  email: string;
  role: UserRole;
  assignedPropertyId?: string;
  phone?: string;
  // Agent Specifics
  agentTier?: AgentTier;
  reputationScore?: number; // 0-100
  isVerified?: boolean;
  walletBalance?: number;
  referralCode?: string;
  uplineAgentId?: string;
}

export interface PropertyDocument {
  id: string;
  type: 'C_OF_O' | 'GOVERNORS_CONSENT' | 'DEED_OF_ASSIGNMENT' | 'SURVEY_PLAN' | 'TENANCY_AGREEMENT' | 'RECEIPT';
  url: string;
  isVerified: boolean;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Property {
  id: string;
  name: string;
  location: string; // "Lagos", "Abuja", etc.
  state: string; // Nigerian State
  rent: number;
  status: PropertyStatus;
  agentId: string;
  tenantId?: string;
  description?: string;
  category: PropertyCategory;
  type: PropertyType;
  rentStartDate?: string;
  rentExpiryDate?: string;
  transactionType?: TransactionType;
  documents?: PropertyDocument[];
  legalScore?: number; // 0-100
  legalFlags?: string[];
}

export interface TenantApplication {
  id: string;
  userId: string;
  displayUID?: string;
  propertyId: string;
  agentId: string;
  status: ApplicationStatus;
  submissionDate: string;
  
  firstName: string;
  surname: string;
  middleName: string;
  dob: string;
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widow' | 'Widower' | 'Separated';
  gender: 'Male' | 'Female';
  currentHomeAddress: string;
  occupation: string;
  familySize: number;
  phoneNumber: string;
  reasonForRelocating: string;
  currentLandlordName: string;
  currentLandlordPhone: string;
  verificationType: 'NIN' | 'Passport' | "Voter's Card" | "Driver's License";
  verificationIdNumber: string;
  verificationUrl?: string;
  passportPhotoUrl?: string;
  agentIdCode: string;
  signature: string;
  applicationDate: string;
  
  riskScore: number;
  aiRecommendation: string;
}

export interface Agreement {
  id: string;
  propertyId: string;
  tenantId: string;
  version: number;
  startDate: string;
  endDate: string;
  documentUrl?: string;
  status: 'active' | 'expired' | 'terminated';
}

export interface Payment {
  id: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending' | 'late';
  type: 'RENT' | 'SERVICE_CHARGE' | 'AGENCY_FEE' | 'LEGAL_FEE' | 'CAUTION_FEE';
}

export interface Commission {
  id: string;
  agentId: string;
  propertyId: string;
  amount: number;
  type: 'LEASE' | 'SALE' | 'REFERRAL' | 'RENEWAL';
  status: 'LOCKED' | 'AVAILABLE' | 'PAID';
  dateEarned: string;
  description: string;
}

export interface MaintenanceTicket {
  id: string;
  tenantId: string;
  propertyId: string;
  issue: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  aiAssessment?: string;
  imageUrl?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  isRead: boolean;
  linkTo?: string;
  attachmentUrl?: string;
}

export interface Referral {
  id: string;
  referrerAgentId: string;
  referredUserId: string; // Can be tenant or sub-agent
  status: 'PENDING' | 'CONVERTED';
  date: string;
  commissionEarned: number;
}
