export type AccountType = 'checking' | 'savings' | 'business_checking' | 'business_savings' | 'credit_card' | 'other';

export type BonusStatus = 'not_started' | 'in_progress' | 'met' | 'earned' | 'failed' | 'cancelled' | 'closed';

export type RequirementType = 'direct_deposit' | 'debit_transactions' | 'minimum_balance' | 'bill_pay' | 'account_funding' | 'time_hold' | 'spend_threshold' | 'recurring_activity' | 'other';

export interface Requirement {
  id: string;
  type: RequirementType;
  description: string;
  targetValue: number; // e.g. 1000 for $1000 direct deposit, 10 for 10 transactions
  currentValue: number; // e.g. 500, 3
  daysToComplete: number; // e.g. 90 days from opening
  deadlineDate: string; // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'met' | 'failed';
  notes?: string;
}

export interface ProgressLog {
  id: string;
  requirementId: string;
  date: string;
  amount: number; // amount of deposit, number of transactions added, or current balance
  description: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountType: AccountType;
  openingDate: string; // YYYY-MM-DD
  bonusAmount: number;
  requirements: Requirement[];
  progressLogs: ProgressLog[];
  status: BonusStatus;
  offerLink?: string;
  promoCode?: string;
  notes?: string;
  expectedPayoutDate?: string;
  payoutReceivedDate?: string;
  missedReason?: string;
  plaidLinked?: boolean;
  plaidInstitutionName?: string;
  plaidLastSyncDate?: string;

  // New Personal Tracker Enhancements
  annualFee?: number;
  annualFeeDecisionDate?: string; // YYYY-MM-DD
  clawbackMonths?: number;
  clawbackDate?: string; // YYYY-MM-DD
  bonusPostingDeadlineDate?: string; // YYYY-MM-DD
  excludeFromClosure?: boolean;
}

export interface BankReEligibilityRule {
  id: string;
  bankName: string;
  coolingOffPeriodMonths: number;
  clockStartsFrom: 'open_date' | 'close_date' | 'bonus_received_date';
  scope: 'account_type_specific' | 'entire_relationship';
  notes?: string;
}

export const DEFAULT_RE_ELIGIBILITY_RULES: BankReEligibilityRule[] = [];

export const KNOWN_BANK_RULE_PRESETS: Record<string, Partial<BankReEligibilityRule>> = {
  'chase': {
    coolingOffPeriodMonths: 24,
    clockStartsFrom: 'bonus_received_date',
    scope: 'account_type_specific',
    notes: '24-month rule applies to receiving another checking/savings bonus of the same family.'
  },
  'citi': {
    coolingOffPeriodMonths: 24,
    clockStartsFrom: 'close_date',
    scope: 'account_type_specific',
    notes: 'Must not have closed a checking/savings account of the same type within 24 months.'
  },
  'capital one': {
    coolingOffPeriodMonths: 36,
    clockStartsFrom: 'open_date',
    scope: 'entire_relationship',
    notes: 'Typically limited to one checking/savings bonus per lifetime or once every 3 years.'
  },
  'wells fargo': {
    coolingOffPeriodMonths: 12,
    clockStartsFrom: 'open_date',
    scope: 'entire_relationship',
    notes: 'Limit one bonus per Wells Fargo relationship per 12 months.'
  },
  'e*trade': {
    coolingOffPeriodMonths: 1,
    clockStartsFrom: 'close_date',
    scope: 'account_type_specific',
    notes: 'Excludes existing holders and anyone who closed an E*TRADE Premium Savings account within 30 days.'
  }
};

export interface RuleTemplate {
  id: string;
  type: RequirementType;
  name: string;
  defaultDescription: string;
  defaultTargetValue: number;
  defaultDaysToComplete: number;
  unitLabel: string;
  placeholderText: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'dd',
    type: 'direct_deposit',
    name: 'Direct Deposit',
    defaultDescription: 'Receive qualifying direct deposits totaling $3,000 within 90 days of opening.',
    defaultTargetValue: 3000,
    defaultDaysToComplete: 90,
    unitLabel: 'Total Deposited ($)',
    placeholderText: 'e.g. 3000 for a total deposit amount'
  },
  {
    id: 'debit',
    type: 'debit_transactions',
    name: 'Debit Card Transactions',
    defaultDescription: 'Make 15 qualifying debit card purchases within 60 days of opening.',
    defaultTargetValue: 15,
    defaultDaysToComplete: 60,
    unitLabel: 'Number of Transactions',
    placeholderText: 'e.g. 15 transactions'
  },
  {
    id: 'balance',
    type: 'minimum_balance',
    name: 'Minimum Balance',
    defaultDescription: 'Maintain a daily balance of $10,000 or more for 90 days of opening.',
    defaultTargetValue: 10000,
    defaultDaysToComplete: 90,
    unitLabel: 'Minimum Balance ($)',
    placeholderText: 'e.g. 10000'
  },
  {
    id: 'billpay',
    type: 'bill_pay',
    name: 'Online Bill Pay',
    defaultDescription: 'Complete 3 online bill payments of $25 or more within 60 days.',
    defaultTargetValue: 3,
    defaultDaysToComplete: 60,
    unitLabel: 'Number of Payments',
    placeholderText: 'e.g. 3 bill payments font'
  },
  {
    id: 'funding',
    type: 'account_funding',
    name: 'Account Funding',
    defaultDescription: 'Fund the account with at least $1,500 from an external source within 30 days.',
    defaultTargetValue: 1500,
    defaultDaysToComplete: 30,
    unitLabel: 'Deposit Amount ($)',
    placeholderText: 'e.g. 1500'
  },
  {
    id: 'time_hold',
    type: 'time_hold',
    name: 'Time-Based Hold',
    defaultDescription: 'Keep account active with no activity requirement for 180 days to avoid fee/clawback.',
    defaultTargetValue: 180,
    defaultDaysToComplete: 180,
    unitLabel: 'Days to Hold',
    placeholderText: 'e.g. 180'
  },
  {
    id: 'spend_threshold',
    type: 'spend_threshold',
    name: 'Spend Threshold (Tiered)',
    defaultDescription: 'Spend $4,000 or more on purchases within 90 days of account opening.',
    defaultTargetValue: 4000,
    defaultDaysToComplete: 90,
    unitLabel: 'Spend Amount ($)',
    placeholderText: 'e.g. 4000'
  },
  {
    id: 'recurring_activity',
    type: 'recurring_activity',
    name: 'Recurring Monthly Activity',
    defaultDescription: 'Make 5 qualifying transactions per month for 3 consecutive months.',
    defaultTargetValue: 15,
    defaultDaysToComplete: 90,
    unitLabel: 'Total Purchases Needed',
    placeholderText: 'e.g. 15'
  },
  {
    id: 'other',
    type: 'other',
    name: 'Custom Activity',
    defaultDescription: 'Enroll in e-statements and log in to the mobile app within 30 days.',
    defaultTargetValue: 1,
    defaultDaysToComplete: 30,
    unitLabel: 'Target Value (1 for completion)',
    placeholderText: 'e.g. 1'
  }
];

export const INITIAL_ACCOUNTS: BankAccount[] = [];

// --- MaxMyVacay Travel Ecosystem Types & Presets ---

export type VacationCategory = 'beach' | 'city' | 'nature' | 'adventure' | 'europe' | 'asia' | 'other';
export type VacationStatus = 'planning' | 'booked' | 'completed';

export interface PointAllocation {
  programId: string;
  programName: string;
  points: number;
}

export interface VacationGoal {
  id: string;
  destination: string;
  category: VacationCategory;
  targetDate: string; // YYYY-MM
  estimatedCashCost: number;
  estimatedPointsCost: number;
  currentPointsSaved: number;
  currentCashSaved: number;
  status: VacationStatus;
  notes?: string;
  flightsBooked: boolean;
  hotelsBooked: boolean;
  allocatedPoints?: PointAllocation[];
  days?: number; // duration of trip
}

export type ProgramType = 'flexible' | 'airline' | 'hotel';

export interface LoyaltyProgramBalance {
  id: string;
  programName: string;
  programType: ProgramType;
  balance: number;
  estimatedValuePerPoint: number; // in cents, e.g. 2.0 for 2.0 cpp
}

export const INITIAL_VACATION_GOALS: VacationGoal[] = [
  {
    id: 'vacay-1',
    destination: 'Paris & French Riviera',
    category: 'europe',
    targetDate: '2026-10',
    estimatedCashCost: 2800,
    estimatedPointsCost: 120000,
    currentPointsSaved: 85000,
    currentCashSaved: 600,
    status: 'planning',
    notes: 'Aiming for business class flights via Flying Blue (Chase transfer) and Hyatt Centric Paris hotel booking.',
    flightsBooked: false,
    hotelsBooked: false
  },
  {
    id: 'vacay-2',
    destination: 'Tokyo & Kyoto Cherry Blossom',
    category: 'asia',
    targetDate: '2027-04',
    estimatedCashCost: 4500,
    estimatedPointsCost: 180000,
    currentPointsSaved: 65000,
    currentCashSaved: 1000,
    status: 'planning',
    notes: 'Planning ANA Room Business Class via Virgin Atlantic or Amex transfer, and Hyatt Regency Kyoto.',
    flightsBooked: false,
    hotelsBooked: false
  },
  {
    id: 'vacay-3',
    destination: 'Maui Beach Escape',
    category: 'beach',
    targetDate: '2026-08',
    estimatedCashCost: 1800,
    estimatedPointsCost: 70000,
    currentPointsSaved: 70000,
    currentCashSaved: 400,
    status: 'booked',
    notes: 'Flights booked via Southwest (Chase points transfer). Hyatt Regency Maui booked using World of Hyatt points.',
    flightsBooked: true,
    hotelsBooked: true
  }
];

export interface LoyaltyProgramPreset {
  programName: string;
  programType: ProgramType;
  estimatedValuePerPoint: number;
  source: string;
}

export const LOYALTY_PROGRAM_PRESETS: LoyaltyProgramPreset[] = [
  { programName: 'Chase Ultimate Rewards', programType: 'flexible', estimatedValuePerPoint: 2.0, source: 'Frequent Miler' },
  { programName: 'Amex Membership Rewards', programType: 'flexible', estimatedValuePerPoint: 1.8, source: 'Frequent Miler' },
  { programName: 'Capital One Venture', programType: 'flexible', estimatedValuePerPoint: 1.8, source: 'Frequent Miler' },
  { programName: 'Citi ThankYou Rewards', programType: 'flexible', estimatedValuePerPoint: 1.8, source: 'Frequent Miler' },
  { programName: 'Bilt Rewards', programType: 'flexible', estimatedValuePerPoint: 1.8, source: 'Frequent Miler' },
  { programName: 'World of Hyatt', programType: 'hotel', estimatedValuePerPoint: 2.3, source: 'Frequent Miler' },
  { programName: 'Marriott Bonvoy', programType: 'hotel', estimatedValuePerPoint: 0.8, source: 'Frequent Miler' },
  { programName: 'Hilton Honors', programType: 'hotel', estimatedValuePerPoint: 0.5, source: 'Frequent Miler' },
  { programName: 'IHG One Rewards', programType: 'hotel', estimatedValuePerPoint: 0.6, source: 'Frequent Miler' },
  { programName: 'Wyndham Rewards', programType: 'hotel', estimatedValuePerPoint: 0.9, source: 'Frequent Miler' },
  { programName: 'Choice Privileges', programType: 'hotel', estimatedValuePerPoint: 0.6, source: 'Frequent Miler' },
  { programName: 'Air France/KLM Flying Blue', programType: 'airline', estimatedValuePerPoint: 1.4, source: 'Frequent Miler' },
  { programName: 'United MileagePlus', programType: 'airline', estimatedValuePerPoint: 1.3, source: 'Frequent Miler' },
  { programName: 'Delta SkyMiles', programType: 'airline', estimatedValuePerPoint: 1.2, source: 'Frequent Miler' },
  { programName: 'Southwest Airlines Rapid Rewards', programType: 'airline', estimatedValuePerPoint: 1.3, source: 'Frequent Miler' },
  { programName: 'JetBlue TrueBlue', programType: 'airline', estimatedValuePerPoint: 1.3, source: 'Frequent Miler' },
  { programName: 'American Airlines AAdvantage', programType: 'airline', estimatedValuePerPoint: 1.5, source: 'Frequent Miler' },
  { programName: 'British Airways Executive Club', programType: 'airline', estimatedValuePerPoint: 1.5, source: 'Frequent Miler' },
  { programName: 'Air Canada Aeroplan', programType: 'airline', estimatedValuePerPoint: 1.5, source: 'Frequent Miler' },
  { programName: 'Singapore Airlines KrisFlyer', programType: 'airline', estimatedValuePerPoint: 1.4, source: 'Frequent Miler' },
  { programName: 'Alaska Airlines Mileage Plan', programType: 'airline', estimatedValuePerPoint: 1.8, source: 'Frequent Miler' },
  { programName: 'Virgin Atlantic Flying Club', programType: 'airline', estimatedValuePerPoint: 1.4, source: 'Frequent Miler' },
  { programName: 'Emirates Skywards', programType: 'airline', estimatedValuePerPoint: 1.2, source: 'Frequent Miler' },
  { programName: 'Avianca LifeMiles', programType: 'airline', estimatedValuePerPoint: 1.5, source: 'Frequent Miler' }
];

export const INITIAL_LOYALTY_BALANCES: LoyaltyProgramBalance[] = [
  {
    id: 'prog-chase',
    programName: 'Chase Ultimate Rewards',
    programType: 'flexible',
    balance: 95000,
    estimatedValuePerPoint: 2.0 // 2.0 cpp average transfer value
  },
  {
    id: 'prog-amex',
    programName: 'Amex Membership Rewards',
    programType: 'flexible',
    balance: 70000,
    estimatedValuePerPoint: 1.8
  },
  {
    id: 'prog-hyatt',
    programName: 'World of Hyatt',
    programType: 'hotel',
    balance: 28000,
    estimatedValuePerPoint: 2.3
  },
  {
    id: 'prog-flyingblue',
    programName: 'Air France/KLM Flying Blue',
    programType: 'airline',
    balance: 15000,
    estimatedValuePerPoint: 1.4
  }
];

export interface TransferPartner {
  name: string;
  ratio: string;
  speed: string;
  alliance: 'Star Alliance' | 'oneworld' | 'SkyTeam' | 'None';
  bestSweetSpots: string;
}

export const TRANSFER_PARTNER_PRESETS: Record<string, TransferPartner[]> = {
  'Chase Ultimate Rewards': [
    { name: 'World of Hyatt', ratio: '1:1', speed: 'Instant', alliance: 'None', bestSweetSpots: 'Luxury Hyatt hotels at 25k-40k pts/night (excellent value, often 2.5-3.0 cpp)' },
    { name: 'Air France/KLM Flying Blue', ratio: '1:1', speed: 'Instant', alliance: 'SkyTeam', bestSweetSpots: 'Promo Rewards to Europe starting at 15k miles in Eco, 50k in Biz' },
    { name: 'British Airways Executive Club', ratio: '1:1', speed: 'Instant', alliance: 'oneworld', bestSweetSpots: 'Short-haul AA/Alaska flights within North America starting at 8.2k avios' },
    { name: 'United MileagePlus', ratio: '1:1', speed: 'Instant', alliance: 'Star Alliance', bestSweetSpots: 'Domestic and international Star Alliance flight redemptions with low surcharges' },
    { name: 'Virgin Atlantic Flying Club', ratio: '1:1', speed: 'Instant', alliance: 'SkyTeam', bestSweetSpots: 'ANA Business/First Class bookings or Delta One suites to Europe' }
  ],
  'Amex Membership Rewards': [
    { name: 'Air France/KLM Flying Blue', ratio: '1:1', speed: 'Instant', alliance: 'SkyTeam', bestSweetSpots: 'Monthly promo awards to Europe in Business class from 50,000 miles' },
    { name: 'British Airways Executive Club', ratio: '1:1', speed: 'Instant', alliance: 'oneworld', bestSweetSpots: 'AA/Alaska direct flights or BA luxury short-haul European flights' },
    { name: 'Delta Air Lines SkyMiles', ratio: '1:1', speed: 'Instant', alliance: 'SkyTeam', bestSweetSpots: 'Flash sales on domestic and select European main cabin redemptions' },
    { name: 'Virgin Atlantic Flying Club', ratio: '1:1', speed: 'Instant', alliance: 'SkyTeam', bestSweetSpots: 'ANA premium cabins or Delta trans-oceanic business class flights' },
    { name: 'Air Canada Aeroplan', ratio: '1:1', speed: 'Instant', alliance: 'Star Alliance', bestSweetSpots: 'Flexible routing rules, lap infant awards, and partner awards to Europe/Asia' },
    { name: 'Singapore Airlines KrisFlyer', ratio: '1:1', speed: 'Within 24 hours', alliance: 'Star Alliance', bestSweetSpots: 'Singapore Suites and premium cabins on flagship routes' }
  ]
};

export interface TravelCompanions {
  adults: number;
  infantsOnLap: number;
  infantsWithSeat: number;
  children: number;
  youths: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  zipCode?: string;
  city?: string;
  state?: string;
  travelers?: TravelCompanions;
  rankedVacationGoals?: string[]; // ordered destination names
  lastUpdated?: string;
}

export interface DestinationPreset {
  id: string;
  name: string;
  country: string;
  category: VacationCategory;
  description: string;
}

export const POPULAR_DESTINATIONS: DestinationPreset[] = [
  { id: 'dest-paris', name: 'Paris', country: 'France', category: 'europe', description: 'Romantic city famous for art, fashion, gastronomy, and the Eiffel Tower.' },
  { id: 'dest-tokyo', name: 'Tokyo', country: 'Japan', category: 'asia', description: 'Bustling capital blending ultra-modern skyscrapers with historic temples.' },
  { id: 'dest-kyoto', name: 'Kyoto', country: 'Japan', category: 'asia', description: 'Traditional heart of Japan known for classical Buddhist temples, gardens, and imperial palaces.' },
  { id: 'dest-maui', name: 'Maui', country: 'USA (Hawaii)', category: 'beach', description: 'Stunning Hawaiian island with world-famous beaches, hiking, and scenic drives.' },
  { id: 'dest-oahu', name: 'Honolulu (Oahu)', country: 'USA (Hawaii)', category: 'beach', description: 'Gateway to Hawaii, boasting Waikiki Beach and historical Pearl Harbor sights.' },
  { id: 'dest-rome', name: 'Rome', country: 'Italy', category: 'europe', description: 'Ancient city filled with iconic ruins like the Colosseum and Vatican treasures.' },
  { id: 'dest-london', name: 'London', country: 'United Kingdom', category: 'europe', description: 'Vibrant city with rich royal history, West End theatre, and world-class museums.' },
  { id: 'dest-nyc', name: 'New York City', country: 'USA', category: 'city', description: 'The Big Apple, featuring Broadway, Central Park, Times Square, and iconic skyline.' },
  { id: 'dest-barcelona', name: 'Barcelona', country: 'Spain', category: 'europe', description: 'Catalonian capital famous for Gaudí architecture, beaches, and tapas.' },
  { id: 'dest-sydney', name: 'Sydney', country: 'Australia', category: 'adventure', description: 'Sunny coastal metropolis defined by its landmark Opera House and Harbour Bridge.' },
  { id: 'dest-bali', name: 'Bali', country: 'Indonesia', category: 'nature', description: 'Tropical paradise renowned for forested volcanic mountains, beaches, and coral reefs.' },
  { id: 'dest-bangkok', name: 'Bangkok', country: 'Thailand', category: 'asia', description: 'Energetic city renowned for ornate shrines, vibrant street life, and shopping.' },
  { id: 'dest-cancun', name: 'Cancun', country: 'Mexico', category: 'beach', description: 'Mexican Caribbean resort city famous for pristine turquoise waters and Mayan history.' },
  { id: 'dest-capetown', name: 'Cape Town', country: 'South Africa', category: 'adventure', description: 'Spectacular port city overlooked by Table Mountain, with stunning beaches.' },
  { id: 'dest-maldives', name: 'Maldives', country: 'Maldives', category: 'beach', description: 'Luxurious tropical nation of overwater bungalows, sandy beaches, and reefs.' },
  { id: 'dest-swissalps', name: 'Swiss Alps', country: 'Switzerland', category: 'nature', description: 'Breathtaking mountains offering skiing, hiking, and scenic train routes.' },
  { id: 'dest-santorini', name: 'Santorini', country: 'Greece', category: 'europe', description: 'Volcanic island famous for dramatic views, white-washed buildings, and blue domes.' },
  { id: 'dest-reykjavik', name: 'Reykjavik', country: 'Iceland', category: 'nature', description: 'Northernmost capital, gateway to natural hot springs, geysers, and auroras.' },
  { id: 'dest-cairo', name: 'Cairo', country: 'Egypt', category: 'other', description: 'Ancient capital housing the great Pyramids of Giza and Sphinx monuments.' },
  { id: 'dest-riodejaneiro', name: 'Rio de Janeiro', country: 'Brazil', category: 'beach', description: 'Stunning seaside city with Copacabana beach and Christ the Redeemer.' },
  { id: 'dest-vancouver', name: 'Vancouver', country: 'Canada', category: 'nature', description: 'Pacific Northwest gem blending urban design with majestic mountain backdrops.' },
  { id: 'dest-borabora', name: 'Bora Bora', country: 'French Polynesia', category: 'beach', description: 'Ultimate romantic escape with dramatic peaks rising out of a turquoise lagoon.' },
  { id: 'dest-costarica', name: 'Costa Rica', country: 'Costa Rica', category: 'nature', description: 'Pioneering ecotourism destination with rainforests, volcanoes, and active wildlife.' },
  { id: 'dest-grandcanyon', name: 'Grand Canyon', country: 'USA', category: 'nature', description: 'Enormous geological marvel with layers of red rock showing millions of years of history.' },
  { id: 'dest-lasvegas', name: 'Las Vegas', country: 'USA', category: 'city', description: 'Entertainment capital of the world, boasting non-stop casinos and luxury resorts.' },
  { id: 'dest-sf', name: 'San Francisco', country: 'USA', category: 'city', description: 'Charming city by the bay, known for the Golden Gate Bridge, cable cars, and steep hills.' },
  { id: 'dest-la', name: 'Los Angeles', country: 'USA', category: 'city', description: 'Sprawling film and media hub with Hollywood, Beverly Hills, and Santa Monica beach.' },
  { id: 'dest-miami', name: 'Miami', country: 'USA', category: 'beach', description: 'Glamorous Florida destination with vibrant Art Deco design and Cuban influence.' },
  { id: 'dest-singapore', name: 'Singapore', country: 'Singapore', category: 'city', description: 'Garden-city island state famous for futuristic structures and epic hawker food.' },
  { id: 'dest-seoul', name: 'Seoul', country: 'South Korea', category: 'asia', description: 'High-tech metropolis where modern subways meet ancient royal palaces.' },
  { id: 'dest-phuket', name: 'Phuket', country: 'Thailand', category: 'beach', description: 'Thailands largest island, hosting lively resorts, beach clubs, and snorkeling.' },
  { id: 'dest-amalfi', name: 'Amalfi Coast', country: 'Italy', category: 'europe', description: 'Dramatic cliffside coastline dotted with pastel villages and vineyards.' },
  { id: 'dest-ibiza', name: 'Ibiza', country: 'Spain', category: 'beach', description: 'Balearic island known for world-class nightlife alongside quiet historic towns.' },
  { id: 'dest-banff', name: 'Banff & Lake Louise', country: 'Canada', category: 'nature', description: 'Stunning glacial lakes and jagged peak backdrops in Alberta.' }
];

