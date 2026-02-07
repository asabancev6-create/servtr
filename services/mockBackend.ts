
import { PlayerState, GlobalStats, RewardConfig, ExchangeConfig, PricePoint } from '../types';
import { INITIAL_STATE, INITIAL_BLOCK_REWARD, HALVING_INTERVAL, EPOCH_LENGTH, TARGET_BLOCK_TIME, INITIAL_DIFFICULTY, ACHIEVEMENTS, calculateLevel, MAX_SUPPLY, UPGRADES } from '../constants';

// --- CLIENT SIDE SERVICE ---
// This now acts as the "Miner Client" that connects to the Node.
// Since we don't have the real Node URL in this demo, it runs the "Node Logic" locally 
// but structured exactly how the API calls would work.

const STORAGE_KEY = 'neurocoin_v20_client'; 
const GLOBAL_KEY = 'neurocoin_v20_node_state';

// HASH BATCHING CONFIG
const BATCH_INTERVAL = 3000; // Send hashes every 3 seconds
let hashAccumulator = 0;

export class GameService {
  
  // --- STATE MANAGEMENT ---
  static loadState(): PlayerState {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastSaveTime === undefined) parsed.lastSaveTime = Date.now();
        // Ensure critical fields
        if (!parsed.upgrades) parsed.upgrades = {};
        if (!parsed.achievements) parsed.achievements = {};
        return { ...INITIAL_STATE, ...parsed }; 
      } catch (e) { return { ...INITIAL_STATE }; }
    }
    return { ...INITIAL_STATE };
  }

  static saveState(state: PlayerState): void {
    const stateToSave = { ...state, lastSaveTime: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }

  // --- NODE INTERFACE (Simulated Network) ---
  
  static getGlobalStats(playerBalance: number): GlobalStats {
      // In a real app, this is: await fetch('/api/sync');
      const saved = localStorage.getItem(GLOBAL_KEY);
      const defaultGlobal: GlobalStats = {
          totalUsers: 100,
          totalMined: 0,
          activeMiners: 42,
          blockHeight: 0,
          currentDifficulty: INITIAL_DIFFICULTY,
          currentBlockHash: 0,
          lastBlockTime: Date.now(),
          epochStartTime: Date.now(),
          liquidityTon: 1000,
          treasuryTon: 500,
          rewardPoolNrc: 1000,
          rewardPoolTon: 100,
          rewardPoolStars: 5000,
          marketCap: 1000,
          currentPrice: 0.000001,
          priceHistory: [],
          rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
          exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
          baseDailyReward: 5,
          limitedItemsSold: {},
          quests: []
      };
      
      if (saved) return { ...defaultGlobal, ...JSON.parse(saved) };
      return defaultGlobal;
  }

  static saveGlobalState(stats: GlobalStats) {
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(stats));
  }

  // --- MINING PROTOCOL ---
  
  // Instead of mining directly to balance, we submit hashes to the "pool"
  static submitHashes(amount: number, playerState: PlayerState): { newPlayerState: PlayerState, blockClosed: boolean, reward: number } {
      // 1. Accumulate locally (Logic moved to App.tsx usually, but here for atomic updates)
      // This method is called by the UI loop.
      
      const global = this.getGlobalStats(0);
      let newPlayerState = { ...playerState };
      let blockClosed = false;
      let reward = 0;

      // Simulate Server-Side Processing
      global.currentBlockHash += amount;
      
      // Track user lifetime effort
      newPlayerState.lifetimeHashes += amount;

      // Check for Block Found (PoW Check)
      if (global.currentBlockHash >= global.currentDifficulty) {
          if (global.totalMined < MAX_SUPPLY) {
              blockClosed = true;
              
              // Halving Logic
              const halving = Math.floor(global.blockHeight / HALVING_INTERVAL);
              const blockReward = INITIAL_BLOCK_REWARD / Math.pow(2, halving);
              
              // Simplification for Solo-Mining Demo: User gets 90%
              const payout = blockReward * 0.9;
              reward = payout;
              newPlayerState.balance += payout;
              
              // Electricity
              if (newPlayerState.premiumUntil < Date.now()) {
                  newPlayerState.electricityDebt += (payout * 0.05);
              }

              // Update Global Ledger
              global.totalMined += blockReward;
              global.blockHeight++;
              global.currentBlockHash = 0;
              global.lastBlockTime = Date.now();
              global.rewardPoolNrc += (blockReward * 0.1);

              // Difficulty Adjustment
              if (global.blockHeight % EPOCH_LENGTH === 0) {
                  const now = Date.now();
                  const actualTime = (now - global.epochStartTime) / 1000;
                  const targetTime = EPOCH_LENGTH * TARGET_BLOCK_TIME;
                  let ratio = targetTime / Math.max(1, actualTime);
                  ratio = Math.min(Math.max(ratio, 0.25), 4.0);
                  
                  global.currentDifficulty = Math.floor(global.currentDifficulty * ratio);
                  if (global.currentDifficulty < INITIAL_DIFFICULTY) global.currentDifficulty = INITIAL_DIFFICULTY;
                  
                  global.epochStartTime = now;
              }
          }
      }

      this.saveGlobalState(global);
      this.saveState(newPlayerState);

      return { newPlayerState, blockClosed, reward };
  }

  // --- OTHER METHODS (Stubbed or Simplified) ---
  
  static checkAchievements(state: PlayerState): PlayerState {
      let updated = false;
      const newState = { ...state };
      const lvl = calculateLevel(state.lifetimeHashes);
      
      ACHIEVEMENTS.forEach(ach => {
          let met = false;
          if (ach.type === 'level') met = lvl >= ach.threshold;
          else if (ach.type === 'balance') met = state.balance >= ach.threshold;
          else if (ach.type === 'clickPower') met = state.clickPower >= ach.threshold;
          
          if (met && (!newState.achievements[ach.id] || !newState.achievements[ach.id].unlocked)) {
              newState.achievements[ach.id] = { unlocked: true, claimed: false, timestamp: Date.now() };
              updated = true;
          }
      });
      
      if (updated) this.saveState(newState);
      return newState;
  }

  static purchaseUpgrade(state: PlayerState, id: string, currency: 'TON' | 'NRC'): { success: boolean, newState?: PlayerState, message?: string } {
      const upgrade = UPGRADES.find(u => u.id === id);
      if (!upgrade) return { success: false, message: 'Upgrade not found' };

      const newState = { ...state };
      const currentLevel = newState.upgrades[id] || 0;
      if (currentLevel >= upgrade.maxLevel) return { success: false, message: 'Max level reached' };

      // Calculate cost
      const costTon = upgrade.costTon * Math.pow(1 + upgrade.scaleTon, currentLevel);
      const costNrc = upgrade.costNrc * Math.pow(1 + upgrade.scaleNrc, currentLevel);

      if (currency === 'TON') {
          if (upgrade.costTon <= 0) return { success: false, message: 'Not purchasable with TON' };
          if (newState.tonBalance < costTon) return { success: false, message: 'Insufficient TON' };
          newState.tonBalance -= costTon;
      } else {
          if (upgrade.costNrc <= 0) return { success: false, message: 'Not purchasable with NRC' };
          if (newState.balance < costNrc) return { success: false, message: 'Insufficient NRC' };
          newState.balance -= costNrc;
      }

      // Apply Upgrade
      newState.upgrades[id] = currentLevel + 1;
      
      if (upgrade.category === 'click_device') {
          newState.clickPower += upgrade.basePower;
      } else if (upgrade.category === 'miner_device' || upgrade.category === 'farm') {
          newState.autoMineRate += upgrade.basePower;
      } else if (upgrade.category === 'premium') {
          // Add duration
          const now = Date.now();
          const start = Math.max(now, newState.premiumUntil);
          let duration = 30 * 24 * 60 * 60 * 1000;
          if (id === 'prem_week') duration = 7 * 24 * 60 * 60 * 1000;
          if (id === 'prem_halfyear') duration = 180 * 24 * 60 * 60 * 1000;
          
          newState.premiumUntil = start + duration;
      }

      if (upgrade.category === 'limited') {
          const global = this.getGlobalStats(0);
          if (!global.limitedItemsSold) global.limitedItemsSold = {};
          const sold = global.limitedItemsSold[id] || 0;
          if (upgrade.globalLimit && sold >= upgrade.globalLimit) return { success: false, message: 'Sold Out' };
          
          global.limitedItemsSold[id] = sold + 1;
          this.saveGlobalState(global);
      }

      this.saveState(newState);
      return { success: true, newState };
  }
  
  static payElectricity(state: PlayerState): { success: boolean, newState?: PlayerState, message?: string } {
      const newState = { ...state };
      if (state.electricityDebt > 0 && state.balance >= state.electricityDebt) {
          state.balance -= state.electricityDebt;
          state.electricityDebt = 0;
          this.saveState(newState);
          return { success: true, newState };
      }
      return { success: false, message: 'Insufficient Balance or No Debt' };
  }

  static claimDailyReward(state: PlayerState): { success: boolean, newState?: PlayerState, reward?: number, error?: string } {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (now - state.lastDailyRewardClaim < oneDay) {
          return { success: false, error: 'COOLDOWN' };
      }
      
      const global = this.getGlobalStats(0);
      const reward = global.baseDailyReward || 5;
      
      if (global.rewardPoolNrc < reward) return { success: false, error: 'POOL EMPTY' };
      
      const newState = { ...state };
      newState.balance += reward;
      newState.lastDailyRewardClaim = now;
      newState.dailyStreak += 1;
      
      global.rewardPoolNrc -= reward;
      
      this.saveGlobalState(global);
      this.saveState(newState);
      
      return { success: true, newState, reward };
  }

  static completeQuest(state: PlayerState, id: string, reward: number): { success: boolean, newState?: PlayerState, error?: string } {
      if (state.completedQuestIds.includes(id)) {
          return { success: false, error: 'ALREADY_COMPLETED' };
      }
      
      const newState = { ...state };
      newState.balance += reward;
      newState.completedQuestIds = [...newState.completedQuestIds, id];
      
      this.saveState(newState);
      return { success: true, newState };
  }

  static exchangeCurrency(state: PlayerState, amount: number, type: 'buy' | 'sell'): { success: boolean, newState?: PlayerState, message?: string } {
      const global = this.getGlobalStats(0);
      const newState = { ...state };
      const price = global.currentPrice;

      if (type === 'sell') {
          if (state.balance < amount) return { success: false, message: 'Insufficient NRC' };
          if (state.dailySoldNrc + amount > global.exchangeConfig.maxDailySell) return { success: false, message: 'Daily Sell Limit Exceeded' };
          
          const tonValue = amount * price;
          // Assume infinite liquidity for sell (admin buys) or pool limit check
          if (global.liquidityTon < tonValue) return { success: false, message: 'Insufficient Market Liquidity' };

          newState.balance -= amount;
          newState.tonBalance += tonValue;
          newState.dailySoldNrc += amount;
          
          global.liquidityTon -= tonValue;
          global.rewardPoolNrc += amount * 0.9; 
      } else {
          // BUY: amount is TON input
          if (state.tonBalance < amount) return { success: false, message: 'Insufficient TON' };
          
          const nrcBought = amount / price;
          if (state.dailyBoughtNrc + nrcBought > global.exchangeConfig.maxDailyBuy) return { success: false, message: 'Daily Buy Limit Exceeded' };
          
          if (global.rewardPoolNrc < nrcBought) return { success: false, message: 'Insufficient Market Pool' };

          newState.tonBalance -= amount;
          newState.balance += nrcBought;
          newState.dailyBoughtNrc += nrcBought;
          
          global.liquidityTon += amount;
          global.rewardPoolNrc -= nrcBought;
      }
      
      newState.lastExchangeDate = Date.now();
      
      this.saveGlobalState(global);
      this.saveState(newState);
      return { success: true, newState };
  }

  static startCrashGame(state: PlayerState, bet: number, currency: string): { success: boolean, newState?: PlayerState, crashPoint?: number, message?: string } {
      const newState = { ...state };
      
      if (currency === 'NRC') {
          if (newState.balance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.balance -= bet;
      } else if (currency === 'TON') {
           if (newState.tonBalance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.tonBalance -= bet;
      } else {
           if (newState.starsBalance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.starsBalance -= bet;
      }

      // Generate Crash Point
      const isInstantCrash = Math.random() < 0.05; // 5% house edge on instant crash
      let crashPoint = 1.00;
      if (!isInstantCrash) {
          const r = Math.random();
          crashPoint = Math.floor((0.99 / (1 - r)) * 100) / 100;
          if (crashPoint < 1.01) crashPoint = 1.00;
      }
      if (crashPoint > 100) crashPoint = 100;

      this.saveState(newState);
      return { success: true, newState, crashPoint };
  }

  static cashOutCrashGame(state: PlayerState, bet: number, multiplier: number, currency: string): { success: boolean, newState?: PlayerState } {
      const newState = { ...state };
      const win = bet * multiplier;
      
      if (currency === 'NRC') newState.balance += win;
      else if (currency === 'TON') newState.tonBalance += win;
      else newState.starsBalance += win;
      
      this.saveState(newState);
      return { success: true, newState };
  }

  static playQuantumSlots(state: PlayerState, bet: number, currency: string): { success: boolean, newState?: PlayerState, result?: string[], isJackpot?: boolean, payout?: number, message?: string } {
      const newState = { ...state };
      if (currency === 'NRC') {
          if (newState.balance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.balance -= bet;
      } else if (currency === 'TON') {
           if (newState.tonBalance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.tonBalance -= bet;
      } else {
           if (newState.starsBalance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.starsBalance -= bet;
      }
      
      const symbols = ['7','@','#','%','&'];
      const r1 = symbols[Math.floor(Math.random() * symbols.length)];
      const r2 = symbols[Math.floor(Math.random() * symbols.length)];
      const r3 = symbols[Math.floor(Math.random() * symbols.length)];
      const result = [r1, r2, r3];
      
      let payout = 0;
      let isJackpot = false;
      
      if (r1 === r2 && r2 === r3) {
          if (r1 === '7') { payout = bet * 50; isJackpot = true; }
          else if (r1 === '@') payout = bet * 20;
          else if (r1 === '#') payout = bet * 10;
          else payout = bet * 5;
      } else if (r1 === r2 || r2 === r3 || r1 === r3) {
          payout = bet * 1.5;
      }
      
      if (payout > 0) {
          if (currency === 'NRC') newState.balance += payout;
          else if (currency === 'TON') newState.tonBalance += payout;
          else newState.starsBalance += payout;
      }
      
      this.saveState(newState);
      return { success: true, newState, result, isJackpot, payout };
  }

  static playCyberSpin(state: PlayerState, bet: number, currency: string): { success: boolean, newState?: PlayerState, resultItem?: string, payout?: number, multiplier?: number, message?: string } {
      const newState = { ...state };
      if (currency === 'NRC') {
          if (newState.balance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.balance -= bet;
      } else if (currency === 'TON') {
           if (newState.tonBalance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.tonBalance -= bet;
      } else {
           if (newState.starsBalance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.starsBalance -= bet;
      }
      
      const r = Math.random();
      let itemId = 'shard';
      let mult = 0.5;
      
      if (r < 0.01) { itemId = 'core'; mult = 50.0; }
      else if (r < 0.05) { itemId = 'potion'; mult = 5.0; }
      else if (r < 0.15) { itemId = 'skull'; mult = 2.0; }
      else if (r < 0.45) { itemId = 'chip'; mult = 1.1; }
      else { itemId = 'shard'; mult = 0.5; }
      
      const payout = bet * mult;
      if (currency === 'NRC') newState.balance += payout;
      else if (currency === 'TON') newState.tonBalance += payout;
      else newState.starsBalance += payout;
      
      this.saveState(newState);
      return { success: true, newState, resultItem: itemId, payout, multiplier: mult };
  }

  static playNeonDice(state: PlayerState, bet: number, currency: string, prediction: 'low' | 'seven' | 'high'): { success: boolean, newState?: PlayerState, dice?: number[], payout?: number, message?: string } {
      const newState = { ...state };
      if (currency === 'NRC') {
          if (newState.balance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.balance -= bet;
      } else if (currency === 'TON') {
           if (newState.tonBalance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.tonBalance -= bet;
      } else {
           if (newState.starsBalance < bet) return { success: false, message: 'Insufficient Funds' };
          newState.starsBalance -= bet;
      }
      
      const d1 = Math.ceil(Math.random() * 6);
      const d2 = Math.ceil(Math.random() * 6);
      const sum = d1 + d2;
      const dice = [d1, d2];
      
      let win = false;
      let multiplier = 0;
      
      if (prediction === 'low' && sum < 7) { win = true; multiplier = 1.7; }
      else if (prediction === 'high' && sum > 7) { win = true; multiplier = 1.7; }
      else if (prediction === 'seven' && sum === 7) { win = true; multiplier = 4.2; }
      
      let payout = 0;
      if (win) {
          payout = bet * multiplier;
          if (currency === 'NRC') newState.balance += payout;
          else if (currency === 'TON') newState.tonBalance += payout;
          else newState.starsBalance += payout;
      }
      
      this.saveState(newState);
      return { success: true, newState, dice, payout };
  }

  static claimAchievementReward(state: PlayerState, id: string): { success: boolean, newState?: PlayerState } {
      const newState = { ...state };
      if (!newState.achievements[id] || !newState.achievements[id].unlocked || newState.achievements[id].claimed) {
          return { success: false };
      }
      
      const achievement = ACHIEVEMENTS.find(a => a.id === id);
      if (!achievement) return { success: false };
      
      const parts = achievement.reward.split(' ');
      const val = parseFloat(parts[0]);
      const curr = parts[1];
      
      if (curr === 'TON') newState.tonBalance += val;
      else newState.balance += val;
      
      newState.achievements[id].claimed = true;
      this.saveState(newState);
      return { success: true, newState };
  }

  static addQuest(quest: any) {
      const global = this.getGlobalStats(0);
      global.quests.push(quest);
      this.saveGlobalState(global);
  }
  
  static deleteQuest(id: string) {
      const global = this.getGlobalStats(0);
      global.quests = global.quests.filter(q => q.id !== id);
      this.saveGlobalState(global);
  }
  
  static updateBaseDailyReward(amount: number) {
      const global = this.getGlobalStats(0);
      global.baseDailyReward = amount;
      this.saveGlobalState(global);
  }
  
  static updateExchangeConfig(config: ExchangeConfig) {
      const global = this.getGlobalStats(0);
      global.exchangeConfig = config;
      this.saveGlobalState(global);
  }
  
  static updateRewardConfig(config: RewardConfig) {
      const global = this.getGlobalStats(0);
      global.rewardConfig = config;
      this.saveGlobalState(global);
  }
  
  static getLimitedStock(id: string) { 
      const global = this.getGlobalStats(0);
      return global.limitedItemsSold?.[id] || 0; 
  }
  
  static injectLiquidity(amount: number) { 
      const global = this.getGlobalStats(0);
      if (global.treasuryTon >= amount) {
          global.treasuryTon -= amount;
          global.liquidityTon += amount;
          this.saveGlobalState(global);
          return true;
      }
      return false; 
  }
  
  static redeemPromoCode(code: string, state: PlayerState) { 
      return { success: false, message: 'Invalid Code' }; 
  }
}
