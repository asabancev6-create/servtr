import { PlayerState, GlobalStats, RewardConfig, Quest, LocalizedText, ExchangeConfig, PricePoint } from '../types';
import { MAX_SUPPLY, INITIAL_STATE, UPGRADES, DAILY_REWARD_BASE, INITIAL_QUESTS, INITIAL_EXCHANGE_CONFIG, INITIAL_BLOCK_REWARD, HALVING_INTERVAL, EPOCH_LENGTH, TARGET_BLOCK_TIME, INITIAL_DIFFICULTY, ACHIEVEMENTS, calculateLevel } from '../constants';

// VERSION 17 - TOTAL WIPE (GENESIS ZERO)
const STORAGE_KEY = 'neurocoin_genesis_v17_player'; 
const GLOBAL_STORAGE_KEY = 'neurocoin_global_v17_ledger';

interface StoredGlobalState extends GlobalStats {}

// GLOBAL LEDGER INITIALIZATION - GENESIS STATE
const INITIAL_GLOBAL: StoredGlobalState = {
  totalUsers: 1, 
  totalMined: 0, 
  activeMiners: 1,
  
  // BLOCKCHAIN TRUTH
  blockHeight: 0,
  currentDifficulty: INITIAL_DIFFICULTY, // 36,000 to start
  currentBlockHash: 0,
  lastBlockTime: Date.now(),
  epochStartTime: Date.now(), 
  
  liquidityTon: 0, 
  treasuryTon: 0,
  
  // POOLS - RESET TO ZERO
  rewardPoolNrc: 0,
  rewardPoolTon: 0,
  rewardPoolStars: 0,
  
  marketPoolNrc: 0, 
  limitedItemsSold: {},
  marketCap: 0,
  currentPrice: 0.000001, // STARTING AT ALMOST ZERO
  priceHistory: [], // Will be filled in loadGlobalState
  
  rewardConfig: {
      poolPercent: 10,       // 10% Protocol Fee
      closerPercent: 70,     // 70% Winner (You)
      contributorPercent: 20 // 20% Contributor (You)
  },
  exchangeConfig: INITIAL_EXCHANGE_CONFIG, 
  quests: INITIAL_QUESTS,
  baseDailyReward: DAILY_REWARD_BASE
};

// Helper to generate backfill history - FLAT LINE FOR GENESIS
const generateBackfillHistory = (): PricePoint[] => {
    const history: PricePoint[] = [];
    const now = Date.now();
    const startPrice = 0.000001;
    
    // Generate data for last 24 hours only, flat line
    const points = 100;
    const interval = (24 * 60 * 60 * 1000) / points;

    for (let i = points; i >= 0; i--) {
        const time = now - (i * interval);
        // Absolute silence, flat line
        history.push({ time, price: startPrice });
    }
    return history;
};

// Simulating a backend service
export class GameService {
  
  // --- PLAYER STATE ---
  static loadState(): PlayerState {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.ensureGlobalState(); 

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Remove old fields logic kept for safety, though v17 is clean
        delete parsed.currentBlockHash;
        delete parsed.blockDifficulty;
        delete parsed.blocksMined;
        delete parsed.epochStartTime;
        delete parsed.lastBlockTime;

        if (parsed.lastSaveTime === undefined) parsed.lastSaveTime = Date.now();
        if (parsed.premiumUntil === undefined) parsed.premiumUntil = 0;
        
        // Ensure achievements object exists
        if (!parsed.achievements) parsed.achievements = {};
        
        // Offline calculation (Simplified)
        const now = Date.now();
        const secondsOffline = (now - parsed.lastSaveTime) / 1000;
        
        if (secondsOffline > 0 && parsed.autoMineRate > 0) {
            const global = this.loadGlobalState();
            // Cap offline mining to avoid massive drifts. Max 1 day offline credit.
            const cappedSeconds = Math.min(secondsOffline, 86400); 
            const hashes = parsed.autoMineRate * cappedSeconds;
            
            // Standard PPS Formula
            const currentHalving = Math.floor(global.blockHeight / HALVING_INTERVAL);
            const rewardPerBlock = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
            
            const offlineReward = (hashes / global.currentDifficulty) * (rewardPerBlock * 0.20);
            
            if (offlineReward > 0) {
                parsed.balance += offlineReward;
                parsed.lifetimeHashes += hashes;
                if (parsed.balance > MAX_SUPPLY) parsed.balance = MAX_SUPPLY;
            }
        }
        
        parsed.lastSaveTime = now;
        return { ...INITIAL_STATE, ...parsed }; 
      } catch (e) {
        console.error("Failed to load save", e);
        return { ...INITIAL_STATE };
      }
    }
    return { ...INITIAL_STATE };
  }

  static saveState(state: PlayerState): void {
    const stateToSave = { ...state, lastSaveTime: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }

  // --- ACHIEVEMENT LOGIC ---
  static checkAchievements(state: PlayerState): PlayerState {
      let updated = false;
      const newState = { ...state };
      const currentLevel = calculateLevel(state.lifetimeHashes);

      ACHIEVEMENTS.forEach(ach => {
          let conditionMet = false;
          if (ach.type === 'level') conditionMet = currentLevel >= ach.threshold;
          else if (ach.type === 'balance') conditionMet = state.balance >= ach.threshold;
          else if (ach.type === 'clickPower') conditionMet = state.clickPower >= ach.threshold;

          // Check if already exists
          const existing = newState.achievements[ach.id];
          
          if (conditionMet) {
              if (!existing || !existing.unlocked) {
                  newState.achievements[ach.id] = {
                      unlocked: true,
                      claimed: existing ? existing.claimed : false,
                      timestamp: Date.now()
                  };
                  updated = true;
              }
          }
      });

      if (updated) {
          this.saveState(newState);
      }
      return newState;
  }

  static claimAchievementReward(state: PlayerState, achievementId: string): { success: boolean, newState?: PlayerState, message?: string } {
      const achRecord = state.achievements[achievementId];
      if (!achRecord || !achRecord.unlocked) return { success: false, message: 'Not unlocked' };
      if (achRecord.claimed) return { success: false, message: 'Already claimed' };

      const achievementDef = ACHIEVEMENTS.find(a => a.id === achievementId);
      if (!achievementDef) return { success: false, message: 'Invalid ID' };

      const newState = { ...state };
      
      // Parse reward
      const parts = achievementDef.reward.split(' ');
      const amount = parseFloat(parts[0]);
      const currency = parts[1];

      if (currency === 'TON') newState.tonBalance += amount;
      else if (currency === 'NRC') newState.balance += amount;
      // Add more currencies if needed

      newState.achievements[achievementId] = {
          ...achRecord,
          claimed: true,
          timestamp: Date.now()
      };

      this.saveState(newState);
      return { success: true, newState };
  }

  // --- GLOBAL STATE ---
  static ensureGlobalState() {
      if (!localStorage.getItem(GLOBAL_STORAGE_KEY)) {
          const initialState = { ...INITIAL_GLOBAL };
          initialState.priceHistory = generateBackfillHistory(); // Pre-fill history
          this.saveGlobalState(initialState);
      }
  }

  static loadGlobalState(): StoredGlobalState {
      const saved = localStorage.getItem(GLOBAL_STORAGE_KEY);
      if (saved) {
          const parsed = JSON.parse(saved);
          if (!parsed.epochStartTime) parsed.epochStartTime = Date.now();
          if (parsed.currentDifficulty < 100) parsed.currentDifficulty = INITIAL_DIFFICULTY; 
          
          // Initialize pools if missing (Migration)
          if (parsed.rewardPoolTon === undefined) parsed.rewardPoolTon = 0;
          if (parsed.rewardPoolStars === undefined) parsed.rewardPoolStars = 0;

          // Migration for old saves that might lack priceHistory
          if (!parsed.priceHistory || parsed.priceHistory.length === 0) {
              parsed.priceHistory = generateBackfillHistory();
          }

          return { ...INITIAL_GLOBAL, ...parsed };
      }
      // Should effectively not happen due to ensureGlobalState, but strictly safe:
      const safeInit = { ...INITIAL_GLOBAL };
      safeInit.priceHistory = generateBackfillHistory();
      return safeInit;
  }

  static saveGlobalState(state: StoredGlobalState) {
      // Limit history size to prevent localStorage overflow (keep last 2000 points)
      if (state.priceHistory.length > 2000) {
          state.priceHistory = state.priceHistory.slice(-2000);
      }
      localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(state));
  }

  static recordPriceHistory(global: StoredGlobalState) {
      const now = Date.now();
      const lastPoint = global.priceHistory[global.priceHistory.length - 1];
      
      // Only record a new point if 5 minutes have passed, or if it's the very first point
      if (!lastPoint || (now - lastPoint.time) >= 5 * 60 * 1000) {
          global.priceHistory.push({
              time: now,
              price: global.currentPrice
          });
      }
  }

  // --- MINING ENGINE (CORE LOGIC WITH LOOP) ---
  
  static submitHashes(amount: number, playerState: PlayerState): { 
      newPlayerState: PlayerState, 
      blockClosed: boolean, 
      reward: number 
  } {
      const global = this.loadGlobalState();
      let newPlayerState = { ...playerState };
      let totalReward = 0;
      let anyBlockClosed = false;
      
      if (newPlayerState.balance >= MAX_SUPPLY) return { newPlayerState, blockClosed: false, reward: 0 };

      let hashesLeft = amount;
      let loops = 0;
      const MAX_LOOPS = 500; // Safety break to prevent infinite loops

      while (hashesLeft > 0 && loops < MAX_LOOPS) {
          loops++;
          
          // 1. Current Network Config (Halving Check)
          const currentHalving = Math.floor(global.blockHeight / HALVING_INTERVAL);
          const blockReward = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
          
          const { poolPercent, closerPercent, contributorPercent } = global.rewardConfig;
          const contributorPot = blockReward * (contributorPercent / 100); 

          // 2. Logic: Fill the current block
          const needed = global.currentDifficulty - global.currentBlockHash;
          const accepted = Math.min(hashesLeft, needed);
          
          // 3. PPS Reward for this chunk of hashes
          // Share = accepted / Difficulty
          const shareReward = (accepted / global.currentDifficulty) * contributorPot;
          
          newPlayerState.balance += shareReward;
          newPlayerState.lifetimeHashes += accepted;
          totalReward += shareReward;
          
          global.currentBlockHash += accepted;
          hashesLeft -= accepted;
          
          // 4. Check Block Close
          if (global.currentBlockHash >= global.currentDifficulty) {
              anyBlockClosed = true;
              global.currentBlockHash = 0;
              global.blockHeight++;
              
              // Closer Reward (70%)
              const closerReward = blockReward * (closerPercent / 100);
              newPlayerState.balance += closerReward;
              totalReward += closerReward;
              
              // Protocol Fee
              global.rewardPoolNrc += blockReward * (poolPercent / 100);
              global.totalMined += blockReward;
              global.lastBlockTime = Date.now();
              
              // 5. DIFFICULTY RETARGET (Epoch Logic)
              if (global.blockHeight % EPOCH_LENGTH === 0) {
                   const now = Date.now();
                   // Time taken for the last 1300 blocks
                   const startTime = global.epochStartTime || (now - (EPOCH_LENGTH * TARGET_BLOCK_TIME * 1000));
                   const timeTakenSec = (now - startTime) / 1000;
                   const safeTimeTaken = Math.max(1, timeTakenSec);
                   
                   const targetTimeSec = EPOCH_LENGTH * TARGET_BLOCK_TIME;
                   
                   let ratio = targetTimeSec / safeTimeTaken;
                   ratio = Math.max(ratio, 0.25); 
                   
                   global.currentDifficulty = Math.floor(global.currentDifficulty * ratio);
                   if (global.currentDifficulty < INITIAL_DIFFICULTY) global.currentDifficulty = INITIAL_DIFFICULTY;
                   
                   global.epochStartTime = now;
              }
              
              // Supply Cap Check
              if (global.totalMined >= MAX_SUPPLY) {
                  hashesLeft = 0;
              }
          }
      }
      
      if (newPlayerState.balance > MAX_SUPPLY) newPlayerState.balance = MAX_SUPPLY;
      
      // Auto-check achievements during mining
      newPlayerState = this.checkAchievements(newPlayerState);

      this.saveGlobalState(global);
      this.saveState(newPlayerState);
      
      return { newPlayerState, blockClosed: anyBlockClosed, reward: totalReward };
  }

  // --- OTHER ACTIONS ---

  static claimDailyReward(state: PlayerState): { success: boolean, newState?: PlayerState, reward?: number, error?: string } {
    const globalState = this.loadGlobalState();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const timeSinceLast = now - state.lastDailyRewardClaim;

    if (timeSinceLast >= oneDay) {
        let streak = state.dailyStreak;
        if (timeSinceLast > oneDay * 2) {
            streak = 0; 
        }
        
        const reward = globalState.baseDailyReward;
        
        if (globalState.rewardPoolNrc < reward) {
            return { success: false, error: 'POOL EMPTY' };
        }

        streak += 1;
        globalState.rewardPoolNrc -= reward;
        
        let newBalance = state.balance + reward;
        if (newBalance > MAX_SUPPLY) newBalance = MAX_SUPPLY;

        const newState = {
            ...state,
            balance: newBalance,
            lastDailyRewardClaim: now,
            dailyStreak: streak
        };
        
        this.saveState(newState);
        this.saveGlobalState(globalState);
        return { success: true, newState, reward };
    }
    return { success: false, error: 'COOLDOWN' };
  }

  static completeQuest(state: PlayerState, questId: string, reward: number): { success: boolean, newState?: PlayerState, error?: string } {
      if (state.completedQuestIds.includes(questId)) {
          return { success: false, error: 'ALREADY_COMPLETED' };
      }
      
      const globalState = this.loadGlobalState();

      if (globalState.rewardPoolNrc < reward) {
          return { success: false, error: 'POOL_EMPTY' }; 
      }
      
      globalState.rewardPoolNrc -= reward;

      let newBalance = state.balance + reward;
      if (newBalance > MAX_SUPPLY) newBalance = MAX_SUPPLY;

      const newState = {
          ...state,
          balance: newBalance,
          completedQuestIds: [...state.completedQuestIds, questId]
      };
      
      this.saveState(newState);
      this.saveGlobalState(globalState);
      return { success: true, newState };
  }

  static playQuantumSlots(state: PlayerState, betAmount: number, currency: 'NRC' | 'TON' | 'STARS' = 'NRC'): { success: boolean, newState?: PlayerState, result?: string[], payout?: number, isJackpot?: boolean, message?: string } {
      
      // CHECK BALANCE
      if (currency === 'NRC' && state.balance < betAmount) return { success: false, message: 'Insufficient NRC' };
      if (currency === 'TON' && state.tonBalance < betAmount) return { success: false, message: 'Insufficient TON' };
      if (currency === 'STARS' && state.starsBalance < betAmount) return { success: false, message: 'Insufficient Stars' };
      
      if (betAmount <= 0) return { success: false, message: 'Invalid Bet' };

      const globalState = this.loadGlobalState();
      
      const newState = { ...state };
      let pool = 0;

      // 1. Deduct Bet & Add to Pool
      if (currency === 'NRC') {
          newState.balance -= betAmount;
          globalState.rewardPoolNrc += betAmount;
          pool = globalState.rewardPoolNrc;
      } else if (currency === 'TON') {
          newState.tonBalance -= betAmount;
          globalState.rewardPoolTon += betAmount;
          pool = globalState.rewardPoolTon;
      } else {
          newState.starsBalance -= betAmount;
          globalState.rewardPoolStars += betAmount;
          pool = globalState.rewardPoolStars;
      }

      // 2. Weighted RNG Logic (Much harder to win)
      const reelStrip = [
          '7', 
          '@', '@', 
          '#', '#', '#', '#', 
          '%', '%', '%', '%', '%', '%', 
          '&', '&', '&', '&', '&', '&', '&'
      ];
      
      const reel1 = reelStrip[Math.floor(Math.random() * reelStrip.length)];
      const reel2 = reelStrip[Math.floor(Math.random() * reelStrip.length)];
      const reel3 = reelStrip[Math.floor(Math.random() * reelStrip.length)];
      
      const result = [reel1, reel2, reel3];
      
      let payout = 0;
      let isJackpot = false;

      // 3. Payout Table
      if (reel1 === reel2 && reel2 === reel3) {
          if (reel1 === '7') {
              isJackpot = true;
              payout = Math.floor(pool * 0.10); // Jackpot 10%
          } else if (reel1 === '@') {
              payout = betAmount * 15;
          } else if (reel1 === '#') {
              payout = betAmount * 10;
          } else if (reel1 === '%') {
              payout = betAmount * 5;
          } else {
              payout = betAmount * 3;
          }
      } else if ((reel1 === reel2 && reel1 === '7') || (reel2 === reel3 && reel2 === '7') || (reel1 === reel3 && reel1 === '7')) {
          payout = betAmount * 2;
      }
      
      if (currency === 'NRC' || currency === 'STARS') payout = Math.floor(payout);

      // 4. Payout Execution
      if (payout > 0) {
          if (currency === 'NRC') {
             if (globalState.rewardPoolNrc < payout) payout = globalState.rewardPoolNrc;
             globalState.rewardPoolNrc -= payout;
             newState.balance += payout;
             if (newState.balance > MAX_SUPPLY) newState.balance = MAX_SUPPLY;
          } else if (currency === 'TON') {
             if (globalState.rewardPoolTon < payout) payout = globalState.rewardPoolTon;
             globalState.rewardPoolTon -= payout;
             newState.tonBalance += payout;
          } else {
             if (globalState.rewardPoolStars < payout) payout = globalState.rewardPoolStars;
             globalState.rewardPoolStars -= payout;
             newState.starsBalance += payout;
          }
      }

      this.saveState(newState);
      this.saveGlobalState(globalState);

      return { success: true, newState, result, payout, isJackpot };
  }

  static playCyberSpin(state: PlayerState, betAmount: number, currency: 'NRC' | 'TON' | 'STARS' = 'NRC'): { success: boolean, newState?: PlayerState, resultItem?: string, multiplier?: number, payout?: number, message?: string } {
      
      // CHECK BALANCE
      if (currency === 'NRC' && state.balance < betAmount) return { success: false, message: 'Insufficient NRC' };
      if (currency === 'TON' && state.tonBalance < betAmount) return { success: false, message: 'Insufficient TON' };
      if (currency === 'STARS' && state.starsBalance < betAmount) return { success: false, message: 'Insufficient Stars' };

      if (betAmount <= 0) return { success: false, message: 'Invalid Bet' };

      const globalState = this.loadGlobalState();
      
      const newState = { ...state };
      
      // 1. Deduct Bet
      if (currency === 'NRC') {
          newState.balance -= betAmount;
          globalState.rewardPoolNrc += betAmount;
      } else if (currency === 'TON') {
          newState.tonBalance -= betAmount;
          globalState.rewardPoolTon += betAmount;
      } else {
          newState.starsBalance -= betAmount;
          globalState.rewardPoolStars += betAmount;
      }

      // 2. Weighted RNG Logic
      const rand = Math.random() * 1000;
      let item = 'shard'; 
      let multiplier = 0;

      if (rand < 600) { // 60% Chance -> LOSS (x0)
          item = 'shard';
          multiplier = 0; 
      } else if (rand < 880) { // 28% Chance -> REFUND/SMALL WIN (x1.2)
          item = 'chip';
          multiplier = 1.2;
      } else if (rand < 960) { // 8% Chance -> WIN (x3)
          item = 'skull';
          multiplier = 3.0;
      } else if (rand < 995) { // 3.5% Chance -> BIG WIN (x10)
          item = 'potion';
          multiplier = 10.0;
      } else { // 0.5% Chance -> JACKPOT (x50)
          item = 'core';
          multiplier = 50.0;
      }
      
      let payout = betAmount * multiplier;
      if (currency === 'NRC' || currency === 'STARS') payout = Math.floor(payout);

      if (payout > 0) {
           if (currency === 'NRC') {
             if (globalState.rewardPoolNrc < payout) payout = globalState.rewardPoolNrc; 
             globalState.rewardPoolNrc -= payout;
             newState.balance += payout;
             if (newState.balance > MAX_SUPPLY) newState.balance = MAX_SUPPLY;
          } else if (currency === 'TON') {
             if (globalState.rewardPoolTon < payout) payout = globalState.rewardPoolTon;
             globalState.rewardPoolTon -= payout;
             newState.tonBalance += payout;
          } else {
             if (globalState.rewardPoolStars < payout) payout = globalState.rewardPoolStars;
             globalState.rewardPoolStars -= payout;
             newState.starsBalance += payout;
          }
      }

      this.saveState(newState);
      this.saveGlobalState(globalState);

      return { success: true, newState, resultItem: item, multiplier, payout };
  }

  static exchangeCurrency(state: PlayerState, amountNrc: number, type: 'buy' | 'sell'): { success: boolean, newState?: PlayerState, message?: string } {
      if (state.premiumUntil <= Date.now()) {
          return { success: false, message: 'Premium Required' };
      }

      const globalState = this.loadGlobalState();
      const { maxDailySell, maxDailyBuy } = globalState.exchangeConfig;
      
      // Calculate Price based on standard AMM formula
      let currentPrice = 0.000001; 
      if (globalState.totalMined > 0 && globalState.liquidityTon > 0) {
          currentPrice = globalState.liquidityTon / globalState.totalMined;
      }
      
      globalState.currentPrice = currentPrice;

      const newState = { ...state };
      const now = Date.now();

      const lastDate = new Date(newState.lastExchangeDate);
      const currentDate = new Date(now);
      
      if (lastDate.getDate() !== currentDate.getDate()) {
          newState.dailySoldNrc = 0;
          newState.dailyBoughtNrc = 0;
          newState.lastExchangeDate = now;
      }

      if (type === 'sell') {
          if (newState.dailySoldNrc + amountNrc > maxDailySell) {
              const remaining = Math.max(0, maxDailySell - newState.dailySoldNrc);
              return { success: false, message: `Limit Exceeded. Remaining: ${remaining} NRC` };
          }
          if (state.balance < amountNrc) return { success: false, message: 'Insufficient NRC' };
          
          const tonToReceive = amountNrc * currentPrice;
          
          if (globalState.liquidityTon < tonToReceive) {
              return { success: false, message: 'DEX Insufficient Liquidity' };
          }

          newState.balance -= amountNrc;
          newState.tonBalance += tonToReceive;
          newState.dailySoldNrc += amountNrc;
          newState.lastExchangeDate = now;

          globalState.liquidityTon -= tonToReceive;
          globalState.rewardPoolNrc += amountNrc;

      } else {
          if (newState.dailyBoughtNrc + amountNrc > maxDailyBuy) {
               const remaining = Math.max(0, maxDailyBuy - newState.dailyBoughtNrc);
               return { success: false, message: `Limit Exceeded. Remaining: ${remaining} NRC` };
          }
          if (globalState.rewardPoolNrc < amountNrc) {
              return { success: false, message: 'Insufficient Reward Pool' };
          }
          const tonCost = amountNrc * currentPrice;
          if (state.tonBalance < tonCost) return { success: false, message: 'Insufficient TON' };

          newState.tonBalance -= tonCost;
          newState.balance += amountNrc;
          newState.dailyBoughtNrc += amountNrc;
          newState.lastExchangeDate = now;

          globalState.liquidityTon += tonCost;
          globalState.rewardPoolNrc -= amountNrc;
      }

      this.recordPriceHistory(globalState);

      this.saveState(newState);
      this.saveGlobalState(globalState);
      return { success: true, newState };
  }

  // --- GLOBAL STATE ---
  
  static addQuest(quest: Quest) {
      const global = this.loadGlobalState();
      global.quests.push(quest);
      this.saveGlobalState(global);
  }

  static deleteQuest(questId: string) {
      const global = this.loadGlobalState();
      global.quests = global.quests.filter(q => q.id !== questId);
      this.saveGlobalState(global);
  }

  static updateBaseDailyReward(amount: number) {
      const global = this.loadGlobalState();
      global.baseDailyReward = amount;
      this.saveGlobalState(global);
  }
  
  static updateExchangeConfig(config: ExchangeConfig) {
      const global = this.loadGlobalState();
      global.exchangeConfig = config;
      this.saveGlobalState(global);
  }

  static getLimitedStock(itemId: string): number {
    const global = this.loadGlobalState();
    return global.limitedItemsSold[itemId] || 0;
  }

  static updateRewardConfig(config: RewardConfig) {
      const global = this.loadGlobalState();
      global.rewardConfig = config;
      this.saveGlobalState(global);
  }

  static purchaseUpgrade(state: PlayerState, upgradeId: string, currency: 'TON' | 'NRC'): { success: boolean; newState?: PlayerState, message?: string } {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return { success: false, message: 'Item not found' };

    const currentLevel = state.upgrades[upgradeId] || 0;

    if (upgrade.category !== 'limited' && currentLevel >= upgrade.maxLevel) {
        return { success: false, message: 'Max Level Reached' };
    }

    const globalState = this.loadGlobalState();
    if (upgrade.category === 'limited' && upgrade.globalLimit) {
        const sold = globalState.limitedItemsSold[upgradeId] || 0;
        if (sold >= upgrade.globalLimit) {
             return { success: false, message: 'Sold Out' };
        }
    }

    let cost = 0;
    if (currency === 'TON') {
        if (upgrade.costTon <= 0) return { success: false, message: 'Not available in TON' };
        cost = upgrade.costTon * Math.pow(1 + upgrade.scaleTon, currentLevel);
    } else {
        if (upgrade.costNrc <= 0) return { success: false, message: 'Not available in NRC' };
        cost = upgrade.costNrc * Math.pow(1 + upgrade.scaleNrc, currentLevel);
    }

    if (currency === 'TON' && state.tonBalance < cost) return { success: false, message: 'Insufficient TON' };
    if (currency === 'NRC' && state.balance < cost) return { success: false, message: 'Insufficient NRC' };

    // --- EXECUTE PURCHASE ---
    const newState = { ...state };
    
    if (currency === 'TON') {
        newState.tonBalance -= cost;
        const toPool = cost * 0.10; // 10% to REWARD POOL TON
        const toTreasury = cost * 0.80; // 80% to Treasury
        const toLiquidity = cost * 0.10; // 10% to Liquidity
        
        globalState.rewardPoolTon += toPool; // Add to TON Reward Pool
        globalState.liquidityTon += toLiquidity;
        globalState.treasuryTon += toTreasury;

    } else {
        newState.balance -= cost;
        globalState.rewardPoolNrc += cost;
    }

    if (upgrade.category === 'premium') {
        const now = Date.now();
        const currentExpiry = newState.premiumUntil > now ? newState.premiumUntil : now;
        let duration = 0;
        if (upgrade.id === 'prem_week') duration = 7 * 24 * 60 * 60 * 1000;
        if (upgrade.id === 'prem_month') duration = 30 * 24 * 60 * 60 * 1000;
        if (upgrade.id === 'prem_halfyear') duration = 180 * 24 * 60 * 60 * 1000;
        
        newState.premiumUntil = currentExpiry + duration;
        newState.upgrades[upgradeId] = 1; 
    } else {
        newState.upgrades[upgradeId] = currentLevel + 1;
        if (upgrade.type === 'click') {
            newState.clickPower += upgrade.basePower;
        } else {
            newState.autoMineRate += upgrade.basePower;
        }

        if (upgrade.category === 'limited') {
            globalState.limitedItemsSold[upgradeId] = (globalState.limitedItemsSold[upgradeId] || 0) + 1;
        }
    }
    
    // Check achievements after purchase
    const finalState = this.checkAchievements(newState);

    this.saveState(finalState);
    this.saveGlobalState(globalState);
    
    return { success: true, newState: finalState };
  }

  static injectLiquidity(amount: number): boolean {
      const global = this.loadGlobalState();
      if (global.treasuryTon >= amount) {
          global.treasuryTon -= amount;
          global.liquidityTon += amount;
          
          // Recalculate price
          if (global.totalMined > 0) {
              global.currentPrice = global.liquidityTon / global.totalMined;
          }
          
          this.recordPriceHistory(global);
          this.saveGlobalState(global);
          return true;
      }
      return false;
  }

  static getGlobalStats(playerBalance: number): GlobalStats {
    const global = this.loadGlobalState();
    
    let price = 0.000001; // Floor price
    if (global.totalMined > 0 && global.liquidityTon > 0) {
        price = global.liquidityTon / global.totalMined;
    }
    
    // Simulate tiny market noise if > 1 min since last update (Live feel)
    const now = Date.now();
    const lastTime = global.priceHistory.length > 0 ? global.priceHistory[global.priceHistory.length - 1].time : 0;
    
    if (now - lastTime > 60000) {
        // Random tiny walk: +/- 0.5%
        const walk = (Math.random() - 0.5) * (price * 0.005);
        price += walk;
        if (price < 0.000001) price = 0.000001;
        
        global.currentPrice = price;
        global.priceHistory.push({ time: now, price });
        
        // Clean up history > 2000 points
        if (global.priceHistory.length > 2000) global.priceHistory.shift();
        
        this.saveGlobalState(global);
    }
    
    return {
      ...global,
      currentPrice: price
    };
  }
}