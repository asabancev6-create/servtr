
export enum Tab {
  MINER = 'MINER',
  INVEST = 'INVEST',
  SHOP = 'SHOP',
  GAMES = 'GAMES',
  COLLECTIONS = 'COLLECTIONS',
  PROFILE = 'PROFILE',
  ADMIN = 'ADMIN', 
}

export type Language = 'en' | 'ru';

export interface LocalizedText {
  en: string;
  ru: string;
}

export interface Upgrade {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  
  // Costs
  costTon: number;
  costNrc: number; // 0 if not purchasable with NRC
  
  // Scaling factors (0.15 = 15%)
  scaleTon: number;
  scaleNrc: number;

  basePower: number; // H/s value
  type: 'click' | 'auto'; // Active or Passive
  category: 'click_device' | 'miner_device' | 'farm' | 'premium' | 'limited';
  
  maxLevel: number; // Max purchases allowed
  level: number; // Current level (in player state, this serves as default)
  
  icon: string;
  unit: 'H/s' | 'MH/s' | 'GH/s' | 'TH/s' | 'QH/s';
  
  // For Limited Items
  globalLimit?: number; 
  globalSold?: number;
}

export interface CollectionItem {
  id: string;
  name: LocalizedText;
  rarity: 'Common' | 'Rare' | 'Legendary' | 'Quantum';
  description: LocalizedText;
  icon: string;
  unlocked: boolean;
}

export interface Achievement {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  threshold: number; // Value needed to unlock
  type: 'balance' | 'clickPower' | 'level'; // Added 'level' type
  reward: string; // e.g. "3 TON"
}

export interface Quest {
    id: string;
    title: LocalizedText;
    reward: number; // NRC Amount
    type: 'social' | 'game' | 'check';
    link?: string; // For social tasks
    condition?: (state: PlayerState) => boolean;
}

export interface AchievementProgress {
    unlocked: boolean;
    claimed: boolean;
    timestamp: number;
}

export interface PlayerState {
  balance: number; // NRC
  tonBalance: number; // New TON Balance
  starsBalance: number; // New Stars Balance
  walletAddress: string | null; // Connected Wallet Address
  clickPower: number;
  autoMineRate: number; // Coins per second
  upgrades: Record<string, number>; // UpgradeID -> Level
  lastSaveTime: number;
  
  lifetimeHashes: number; // Track total effort for leveling
  
  // Premium Status
  premiumUntil: number; // Timestamp, 0 if no premium

  // Economy & Bills
  electricityDebt: number; // Accumulated electricity cost

  // Quest & Social
  lastDailyRewardClaim: number; // Timestamp
  dailyStreak: number; 
  completedQuestIds: string[];
  
  // New Achievement Tracking
  achievements: Record<string, AchievementProgress>;

  referrals: number;
  referralEarnings: number;
  
  // Exchange Limits
  dailySoldNrc: number;
  dailyBoughtNrc: number; // NEW: Track buys
  lastExchangeDate: number;
}

export interface RewardConfig {
  poolPercent: number;      // e.g. 10
  closerPercent: number;    // e.g. 70
  contributorPercent: number; // e.g. 20
}

export interface ExchangeConfig {
  maxDailySell: number;
  maxDailyBuy: number;
}

export interface PricePoint {
  time: number;
  price: number;
}

export interface LeaderboardEntry {
  id: number | string;
  name: string;
  balance: number;
  isUser: boolean;
  avatar?: string;
  rank?: number;
}

export interface GlobalStats {
  totalUsers: number;
  totalMined: number;
  activeMiners: number;
  
  // BLOCKCHAIN CORE (Shared across all users)
  blockHeight: number;
  currentDifficulty: number;
  currentBlockHash: number; // Current progress in the block
  lastBlockTime: number; // Timestamp of last block close
  epochStartTime: number; // NEW: Timestamp of when the current 1300-block epoch started
  
  marketCap: number; // Calculated USD or TON value
  limitedItemsSold: Record<string, number>; 
  
  // DeFi Economics
  liquidityTon: number; // The amount of TON backing the price
  treasuryTon: number; // Admin funds available for injection
  
  // REWARD POOLS
  rewardPoolNrc: number;   // 10% of mined blocks + Sold Tokens
  rewardPoolTon: number;   // 10% of Shop Purchases + 90% of Game Losses
  rewardPoolStars: number; // 90% of Game Losses (Stars are virtual here mostly)
  
  marketPoolNrc: number; // DEPRECATED
  currentPrice: number; // Calculated Price
  priceHistory: PricePoint[]; // NEW: Historical data for chart
  
  leaderboard: LeaderboardEntry[]; // GLOBAL LEADERBOARD

  // Admin Config
  rewardConfig: RewardConfig;
  exchangeConfig: ExchangeConfig; // NEW: Admin controlled limits
  quests: Quest[]; // Dynamic Quests list controlled by Admin
  baseDailyReward: number; // Admin adjustable base reward
}

// Telegram Web App Types
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: any;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
    setParams: (params: any) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void; 
}

declare global {
  interface Window {
    Telegram: {
      WebApp: TelegramWebApp;
    };
  }
}
