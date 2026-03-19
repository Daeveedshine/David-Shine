
import { Property, PropertyDocument } from '../types';

interface LegalCheckResult {
  score: number;
  flags: string[];
  status: 'GREEN' | 'AMBER' | 'RED';
  requiredDocs: string[];
}

/**
 * Deterministic Rules Engine for Nigerian Real Estate Compliance
 * Analyzes property metadata against Land Use Act and State Laws.
 */
export const analyzePropertyLegality = (property: Property): LegalCheckResult => {
  const flags: string[] = [];
  let score = 100;
  const requiredDocs: string[] = [];

  // 1. Governor's Consent / C of O Check (Land Use Act 1978)
  const hasTitleDoc = property.documents?.some(d => 
    d.type === 'C_OF_O' || d.type === 'GOVERNORS_CONSENT' || d.type === 'DEED_OF_ASSIGNMENT'
  );

  if (!hasTitleDoc) {
    score -= 40;
    flags.push('CRITICAL: No Statutory Title Document (C of O/Gov. Consent) found.');
    requiredDocs.push('Certificate of Occupancy', 'Governor\'s Consent', 'Deed of Assignment');
  } else {
    // Check verification status
    const verifiedTitle = property.documents?.find(d => 
      (d.type === 'C_OF_O' || d.type === 'GOVERNORS_CONSENT') && d.isVerified
    );
    if (!verifiedTitle) {
      score -= 10;
      flags.push('WARNING: Title document uploaded but not verified at Lands Registry.');
    }
  }

  // 2. State Specific Logic
  if (property.state === 'Lagos') {
    // Lagos Tenancy Law 2011 Checks
    if (property.transactionType === 'LEASE' && property.rent > 0) {
        // Logic: Cannot demand rent in excess of 1 year for new tenant (Agent Guidance)
        // This is a guidance note, not a strict score penalty unless we know the payment terms
        flags.push('NOTE: Ensure rent advance does not exceed 1 year (Lagos Tenancy Law 2011).');
    }
  } else if (property.state === 'FCT' || property.state === 'Abuja') {
    // FCT logic
    if (!property.documents?.some(d => d.type === 'SURVEY_PLAN')) {
       score -= 15;
       flags.push('WARNING: Missing AGIS Survey Plan/Recertification.');
       requiredDocs.push('Survey Plan');
    }
  }

  // 3. Transaction Specifics
  if (property.transactionType === 'SALE') {
    if (!property.documents?.some(d => d.type === 'SURVEY_PLAN')) {
      score -= 20;
      flags.push('HIGH RISK: Survey Plan required for Land Sale.');
      requiredDocs.push('Survey Plan');
    }
  }

  // Determine Status
  let status: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
  if (score < 50) status = 'RED';
  else if (score < 80) status = 'AMBER';

  return { score, flags, status, requiredDocs };
};

/**
 * Calculates Agent Commission Entitlements based on Tier and Transaction
 */
export const calculateCommission = (rentOrPrice: number, type: 'LEASE' | 'SALE', tier: string) => {
  let percentage = 0;
  
  if (type === 'LEASE') {
    // Standard 10% Agency Fee in Nigeria
    percentage = 0.10;
  } else if (type === 'SALE') {
    // Standard 5% Sale Commission
    percentage = 0.05;
  }

  // Tier Multipliers (Incentive Design)
  const multipliers: any = {
    'BRONZE': 1.0,
    'SILVER': 1.05, // 5% bonus on base commission share
    'GOLD': 1.10,
    'ELITE': 1.15
  };

  const multiplier = multipliers[tier] || 1.0;
  const totalCommission = rentOrPrice * percentage;
  
  // Platform Split (e.g., Platform takes 10% of commission, Agent keeps 90%)
  const platformShare = totalCommission * 0.10; 
  const agentShare = (totalCommission - platformShare) * multiplier;

  return {
    total: totalCommission,
    agentShare: Math.floor(agentShare),
    platformShare: Math.floor(platformShare)
  };
};
