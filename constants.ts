
import { Upgrade, CollectionItem, Achievement, Quest, PlayerState, ExchangeConfig } from './types';

export const MAX_SUPPLY = 13_000_000;
export const GLOBAL_REFRESH_RATE = 2000; 

// Blockchain Parameters (NeuroCoin Spec)
export const TARGET_BLOCK_TIME = 360; // 6 Minutes (360 seconds)
export const EPOCH_LENGTH = 1300; // Difficulty recalculation every 1300 blocks
export const HALVING_INTERVAL = 130000; // Halving every 130,000 blocks
export const INITIAL_BLOCK_REWARD = 50; 

// FIX 1: INCREASED DIFFICULTY (from 36k/100m to 500m)
export const INITIAL_DIFFICULTY = 500_000_000; 

export const DAILY_REWARD_BASE = 5; 

export const INITIAL_EXCHANGE_CONFIG: ExchangeConfig = {
    maxDailySell: 100,
    maxDailyBuy: 1000 
};

export const INITIAL_STATE: PlayerState = {
  balance: 0,
  tonBalance: 0,
  starsBalance: 0,
  walletAddress: null,
  clickPower: 100, 
  autoMineRate: 0,
  upgrades: {},
  lastSaveTime: Date.now(),
  lifetimeHashes: 0, 
  premiumUntil: 0,
  electricityDebt: 0, 
  lastDailyRewardClaim: 0,
  dailyStreak: 0,
  completedQuestIds: [],
  achievements: {}, 
  referrals: 0,
  referralEarnings: 0,
  dailySoldNrc: 0,
  dailyBoughtNrc: 0,
  lastExchangeDate: 0 
};

// --- UTILITIES ---
export const calculateLevel = (lifetimeHashes: number): number => {
    const safeHashes = Math.max(0, lifetimeHashes);
    return Math.max(1, Math.floor(Math.log2(safeHashes / 1000 + 1))); // Slowed down leveling slightly
};

export const formatHashrate = (hashes: number): string => {
  if (hashes >= 1_000_000_000_000_000) return `${(hashes / 1_000_000_000_000_000).toFixed(2)} PH/s`;
  if (hashes >= 1_000_000_000_000) return `${(hashes / 1_000_000_000_000).toFixed(2)} TH/s`;
  if (hashes >= 1_000_000_000) return `${(hashes / 1_000_000_000).toFixed(2)} GH/s`;
  if (hashes >= 1_000_000) return `${(hashes / 1_000_000).toFixed(2)} MH/s`;
  if (hashes >= 1_000) return `${(hashes / 1_000).toFixed(2)} kH/s`;
  return `${Math.floor(hashes)} H/s`;
};

export const formatHashValue = (hashes: number): string => {
  if (hashes >= 1_000_000_000_000_000) return `${(hashes / 1_000_000_000_000_000).toFixed(2)} PH`;
  if (hashes >= 1_000_000_000_000) return `${(hashes / 1_000_000_000_000).toFixed(2)} TH`;
  if (hashes >= 1_000_000_000) return `${(hashes / 1_000_000_000).toFixed(2)} GH`;
  if (hashes >= 1_000_000) return `${(hashes / 1_000_000).toFixed(2)} MH`;
  if (hashes >= 1_000) return `${(hashes / 1_000).toFixed(2)} kH`;
  return `${Math.floor(hashes)} H`;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'lvl_100',
    name: { en: 'Level 100', ru: 'Уровень 100' },
    description: { en: 'Reach Player Level 100.', ru: 'Достигните 100-го уровня игрока.' },
    icon: 'Award',
    threshold: 100,
    type: 'level',
    reward: '0.1 TON'
  },
  {
    id: 'neural_link',
    name: { en: 'Neural Overload', ru: 'Нейро Перегрузка' },
    description: { en: 'Reach 500 Click Power via upgrades.', ru: 'Достичь силы клика 500 через улучшения.' },
    icon: 'Zap',
    threshold: 500,
    type: 'clickPower',
    reward: '0.5 TON'
  },
  {
    id: 'lvl_500',
    name: { en: 'Level 500', ru: 'Уровень 500' },
    description: { en: 'Reach Player Level 500.', ru: 'Достигните 500-го уровня игрока.' },
    icon: 'Star',
    threshold: 500,
    type: 'level',
    reward: '0.8 TON'
  },
  {
    id: 'cyber_miner',
    name: { en: 'Cyber Miner', ru: 'Кибер Майнер' },
    description: { en: 'Mine 5,000 NeuroCoins manually.', ru: 'Добыть 5,000 NeuroCoins вручную.' },
    icon: 'Pickaxe',
    threshold: 5000,
    type: 'balance',
    reward: '1.0 TON'
  },
  {
    id: 'lvl_1000',
    name: { en: 'Level 1000', ru: 'Уровень 1000' },
    description: { en: 'Reach Player Level 1000.', ru: 'Достигните 1000-го уровня игрока.' },
    icon: 'Trophy',
    threshold: 1000,
    type: 'level',
    reward: '1.5 TON'
  },
  {
    id: 'quantum_whale',
    name: { en: 'Quantum Whale', ru: 'Квантовый Кит' },
    description: { en: 'Accumulate 100,000 NeuroCoins balance.', ru: 'Накопить баланс 100,000 NeuroCoins.' },
    icon: 'Gem', 
    threshold: 100000,
    type: 'balance',
    reward: '5.0 TON'
  }
];

export const INITIAL_QUESTS: Quest[] = [
    {
        id: 'subscribe_channel',
        title: { en: 'Subscribe to Neuro Channel', ru: 'Подписка на Neuro Канал' },
        reward: 5,
        type: 'social',
        link: 'https://t.me/telegram' 
    },
    {
        id: 'connect_wallet',
        title: { en: 'Connect TON Wallet', ru: 'Подключить TON Кошелек' },
        reward: 10,
        type: 'check',
        condition: (state) => !!state.walletAddress
    },
    {
        id: 'mine_10_coins',
        title: { en: 'Mine 10 Coins', ru: 'Добыть 10 Монет' },
        reward: 15,
        type: 'game',
        condition: (state) => state.balance >= 10
    },
    {
        id: 'upgrade_rig',
        title: { en: 'Upgrade any device to Lvl 5', ru: 'Улучшить устройство до 5 ур.' },
        reward: 25,
        type: 'game',
        condition: (state) => Object.values(state.upgrades).some(lvl => lvl >= 5)
    }
];

const KH = 1000;
const MH = 1000000;
const GH = 1000000000;
const TH = 1000000000000;

export const UPGRADES: Upgrade[] = [
  // ... (Devices and Miners same as before, simplified for brevity here, assumed unchanged unless specified)
  { id: 'click_v1', name: { en: 'Tactile Sensor v1', ru: 'Тактильный Сенсор v1' }, description: { en: 'Basic synaptic feedback.', ru: 'Базовая синаптическая петля.' }, costTon: 0.1, costNrc: 5, scaleTon: 0.15, scaleNrc: 0.50, basePower: 100, type: 'click', category: 'click_device', maxLevel: 10, level: 0, icon: 'MousePointer2', unit: 'H/s' },
  { id: 'click_v2', name: { en: 'Haptic Glove v2', ru: 'Хаптик Перчатка v2' }, description: { en: 'Enhanced precision.', ru: 'Улучшенная точность.' }, costTon: 0.4, costNrc: 15, scaleTon: 0.15, scaleNrc: 0.50, basePower: 500, type: 'click', category: 'click_device', maxLevel: 10, level: 0, icon: 'Hand', unit: 'H/s' },
  { id: 'click_v3', name: { en: 'Neural Interface v3', ru: 'Нейроинтерфейс v3' }, description: { en: 'Direct brain connection.', ru: 'Прямое подключение мозга.' }, costTon: 0.8, costNrc: 30, scaleTon: 0.15, scaleNrc: 0.50, basePower: 1 * KH, type: 'click', category: 'click_device', maxLevel: 10, level: 0, icon: 'Brain', unit: 'H/s' },

  { id: 'miner_basic', name: { en: 'Node Pi', ru: 'Node Pi' }, description: { en: 'Single-board computer.', ru: 'Одноплатный компьютер.' }, costTon: 1, costNrc: 50, scaleTon: 0.13, scaleNrc: 0.50, basePower: 500, type: 'auto', category: 'miner_device', maxLevel: 13, level: 0, icon: 'Cpu', unit: 'H/s' },
  { id: 'miner_pro', name: { en: 'GPU Rig', ru: 'GPU Риг' }, description: { en: 'Graphics processing.', ru: 'Графическая обработка.' }, costTon: 4.5, costNrc: 225, scaleTon: 0.08, scaleNrc: 0.50, basePower: 10 * KH, type: 'auto', category: 'miner_device', maxLevel: 15, level: 0, icon: 'Server', unit: 'H/s' },
  { id: 'miner_ultra', name: { en: 'ASIC Miner', ru: 'ASIC Майнер' }, description: { en: 'Specialized hardware.', ru: 'Спец. оборудование.' }, costTon: 9, costNrc: 450, scaleTon: 0.06, scaleNrc: 0.50, basePower: 1 * MH, type: 'auto', category: 'miner_device', maxLevel: 21, level: 0, icon: 'Zap', unit: 'MH/s' },

  { id: 'farm_v1', name: { en: 'Home Farm', ru: 'Домашняя Ферма' }, description: { en: 'Servers in basement.', ru: 'Серверы в подвале.' }, costTon: 15, costNrc: 0, scaleTon: 0.15, scaleNrc: 0, basePower: 50 * MH, type: 'auto', category: 'farm', maxLevel: 30, level: 0, icon: 'Warehouse', unit: 'MH/s' },
  { id: 'farm_v2', name: { en: 'Industrial Hangar', ru: 'Пром. Ангар' }, description: { en: 'Dedicated facility.', ru: 'Отдельное помещение.' }, costTon: 25, costNrc: 0, scaleTon: 0.15, scaleNrc: 0, basePower: 500 * MH, type: 'auto', category: 'farm', maxLevel: 25, level: 0, icon: 'Factory', unit: 'MH/s' },
  { id: 'farm_v3', name: { en: 'Hydro Plant', ru: 'Гидро Станция' }, description: { en: 'Renewable energy.', ru: 'Возобновляемая энергия.' }, costTon: 125, costNrc: 0, scaleTon: 0, scaleNrc: 0, basePower: 2 * GH, type: 'auto', category: 'farm', maxLevel: 20, level: 0, icon: 'Dam', unit: 'GH/s' },
  { id: 'farm_v4', name: { en: 'Geothermal Core', ru: 'Геотермальное Ядро' }, description: { en: 'Deep earth energy.', ru: 'Энергия из недр.' }, costTon: 200, costNrc: 0, scaleTon: 0, scaleNrc: 0, basePower: 10 * GH, type: 'auto', category: 'farm', maxLevel: 15, level: 0, icon: 'Flame', unit: 'GH/s' },
  { id: 'farm_v5', name: { en: 'Orbital Array', ru: 'Орбитальный Массив' }, description: { en: 'Solar satellites.', ru: 'Спутники.' }, costTon: 500, costNrc: 0, scaleTon: 0, scaleNrc: 0, basePower: 50 * GH, type: 'auto', category: 'farm', maxLevel: 10, level: 0, icon: 'Satellite', unit: 'GH/s' },
  
  // FIX 2: NERF HIGH END ITEMS
  { 
    id: 'farm_v6', 
    name: { en: 'Dyson Swarm', ru: 'Рой Дайсона' }, 
    description: { en: 'Star power.', ru: 'Энергия звезды.' }, 
    costTon: 800, costNrc: 0, scaleTon: 0, scaleNrc: 0, 
    basePower: 200 * GH, // REDUCED FROM 1 TH to 200 GH
    type: 'auto', category: 'farm', maxLevel: 5, level: 0, icon: 'Orbit', unit: 'TH/s' 
  },

  // PREMIUM
  { id: 'prem_week', name: { en: 'Premium (1 Week)', ru: 'Премиум (Неделя)' }, description: { en: 'Badge, 0% fees.', ru: 'Значок, 0% комиссий.' }, costTon: 5, costNrc: 0, scaleTon: 0, scaleNrc: 0, basePower: 0, type: 'auto', category: 'premium', maxLevel: 1, level: 0, icon: 'Star', unit: 'H/s' },
  { id: 'prem_month', name: { en: 'Premium (1 Month)', ru: 'Премиум (Месяц)' }, description: { en: 'Badge, 0% fees.', ru: 'Значок, 0% комиссий.' }, costTon: 15, costNrc: 0, scaleTon: 0, scaleNrc: 0, basePower: 0, type: 'auto', category: 'premium', maxLevel: 1, level: 0, icon: 'Star', unit: 'H/s' },
  { id: 'prem_halfyear', name: { en: 'Premium (6 Months)', ru: 'Премиум (6 Мес.)' }, description: { en: 'Badge, 0% fees.', ru: 'Значок, 0% комиссий.' }, costTon: 80, costNrc: 0, scaleTon: 0, scaleNrc: 0, basePower: 0, type: 'auto', category: 'premium', maxLevel: 1, level: 0, icon: 'Star', unit: 'H/s' },
  
  // FIX 3: NERF QUANTUM PC (Limited Item)
  {
    id: 'limited_quantum',
    name: { en: 'Dark Matter PC', ru: 'ПК Темной Материи' },
    description: { en: 'Global Limited Edition. Only 100 exist.', ru: 'Глобальный лимит. Всего 100 штук.' },
    costTon: 1800,
    costNrc: 0,
    scaleTon: 0,
    scaleNrc: 0,
    // DRASTIC REDUCTION: 10 TH -> 50 GH. 
    // Old: 10,000,000 MH / 100 MH Diff = 100,000 blocks/sec (CRASH)
    // New: 50,000 MH / 500 MH Diff = 100 blocks/sec (Manageable)
    basePower: 50 * GH, 
    type: 'auto',
    category: 'limited',
    maxLevel: 100, 
    level: 0,
    icon: 'Atom',
    unit: 'GH/s',
    globalLimit: 100
  }
];

export const COLLECTIONS: CollectionItem[] = [
  { id: 'genesis_block', name: { en: 'Genesis Shard', ru: 'Осколок Генезиса' }, rarity: 'Legendary', description: { en: 'A fragment of the very first block.', ru: 'Фрагмент самого первого блока.' }, icon: 'Box', unlocked: true },
  { id: 'quantum_chip', name: { en: 'Quantum Chip', ru: 'Квантовый Чип' }, rarity: 'Rare', description: { en: 'Burnt silicon.', ru: 'Огоревший кремний.' }, icon: 'Cpu', unlocked: true },
  { id: 'lost_key', name: { en: 'Lost Private Key', ru: 'Утерянный Ключ' }, rarity: 'Common', description: { en: 'Someone lost access.', ru: 'Кто-то потерял доступ.' }, icon: 'Key', unlocked: false },
  { id: 'neuro_cortex', name: { en: 'Synthetic Cortex', ru: 'Синтетический Кортекс' }, rarity: 'Quantum', description: { en: 'The brain of the machine.', ru: 'Мозг машины.' }, icon: 'Brain', unlocked: false },
  { id: 'quantum_vortex', name: { en: 'Quantum Vortex', ru: 'Квантовый Вихрь' }, rarity: 'Quantum', description: { en: 'Pure energy.', ru: 'Вихрь чистой энергии.' }, icon: 'Atom', unlocked: false },
];
