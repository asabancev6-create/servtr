import { PlayerState, GlobalStats, RewardConfig, Quest, ExchangeConfig, PricePoint } from '../types';
import { MAX_SUPPLY, INITIAL_STATE, UPGRADES, DAILY_REWARD_BASE, INITIAL_QUESTS, INITIAL_EXCHANGE_CONFIG, INITIAL_DIFFICULTY, ACHIEVEMENTS, calculateLevel, APP_URL } from '../constants';

// USE THE REAL SERVER URL
const API_URL = `${APP_URL}/api`; 

// Helper for API calls
async function apiCall(endpoint: string, body: any) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('API Error');
        return await res.json();
    } catch (e) {
        console.warn(`API Fail: ${endpoint}`, e);
        return null; 
    }
}

// Fallback Global State if server is dead
const FALLBACK_GLOBAL: GlobalStats = {
  totalUsers: 1, 
  totalMined: 0, 
  activeMiners: 1,
  blockHeight: 0,
  currentDifficulty: INITIAL_DIFFICULTY,
  currentBlockHash: 0,
  lastBlockTime: Date.now(),
  epochStartTime: Date.now(), 
  liquidityTon: 0, 
  treasuryTon: 0,
  rewardPoolNrc: 0,
  rewardPoolTon: 0,
  limitedItemsSold: {},
  marketCap: 0,
  currentPrice: 0.000001,
  priceHistory: [],
  rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
  exchangeConfig: INITIAL_EXCHANGE_CONFIG, 
  quests: INITIAL_QUESTS,
  baseDailyReward: DAILY_REWARD_BASE
};

export class GameService {
  
  // --- PLAYER STATE ---
  // Now async because we fetch from server
  static async loadState(): Promise<PlayerState> {
    // Get Telegram User ID
    let userId = 12345678;
    let firstName = "Pilot";
    let username = "crypto_miner";

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        userId = window.Telegram.WebApp.initDataUnsafe.user.id;
        firstName = window.Telegram.WebApp.initDataUnsafe.user.first_name;
        username = window.Telegram.WebApp.initDataUnsafe.user.username || "";
    }

    const response = await apiCall('/init', { userId, firstName, username });

    if (response && response.user) {
        // Sync Global Stats too
        localStorage.setItem('global_stats_cache', JSON.stringify(response.global));
        
        if (response.offlineEarnings > 0) {
            alert(`OFFLINE MINING: +${response.offlineEarnings.toFixed(4)} NRC`);
        }

        return { ...INITIAL_STATE, ...response.user };
    }

    // Fallback to local storage if server down
    const saved = localStorage.getItem(`user_${userId}`);
    if (saved) return JSON.parse(saved);
    return INITIAL_STATE;
  }

  static async saveState(state: PlayerState): Promise<void> {
    // Optimistic Save to Local
    let userId = 12345678;
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) userId = window.Telegram.WebApp.initDataUnsafe.user.id;
    
    localStorage.setItem(`user_${userId}`, JSON.stringify(state));

    // Background Sync
    apiCall('/sync', { userId, state });
  }

  // --- GLOBAL STATE ---
  static getGlobalStats(playerBalance: number): GlobalStats {
      // Return cached global stats immediately for UI
      // The real update happens via polling in App.tsx
      const cached = localStorage.getItem('global_stats_cache');
      if (cached) return JSON.parse(cached);
      return FALLBACK_GLOBAL;
  }

  // --- MINING ENGINE ---
  static submitHashes(amount: number, playerState: PlayerState): { 
      newPlayerState: PlayerState, 
      blockClosed: boolean, 
      reward: number 
  } {
      // Optimistic local calculation for smooth UI
      // We also send this to server /mine
      
      let userId = 12345678;
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) userId = window.Telegram.WebApp.initDataUnsafe.user.id;

      // Fire and forget to server
      apiCall('/mine', { userId, amount }).then(res => {
          if (res && res.global) {
              localStorage.setItem('global_stats_cache', JSON.stringify({
                  ...GameService.getGlobalStats(0),
                  ...res.global // Update block info
              }));
          }
      });

      // --- LOCAL SIMULATION (For instant feedback) ---
      // We rely on the server response to actually "close" the block globally,
      // but we simulate progress here.
      
      const global = this.getGlobalStats(0);
      let newPlayerState = { ...playerState };
      
      // Calculate estimated PPS share locally just for display increment
      const currentHalving = Math.floor(global.blockHeight / 130000);
      const blockReward = 50 / Math.pow(2, currentHalving);
      const shareReward = (amount / global.currentDifficulty) * (blockReward * 0.2);
      
      newPlayerState.balance += shareReward;
      newPlayerState.lifetimeHashes += amount;
      
      // We don't close blocks locally anymore, we wait for server to say so.
      // But we simulate hash progress
      
      return { newPlayerState, blockClosed: false, reward: shareReward };
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

      if (updated) this.saveState(newState);
      return newState;
  }

  static claimAchievementReward(state: PlayerState, achievementId: string): { success: boolean, newState?: PlayerState, message?: string } {
      const achRecord = state.achievements[achievementId];
      if (!achRecord || !achRecord.unlocked || achRecord.claimed) return { success: false };

      const achievementDef = ACHIEVEMENTS.find(a => a.id === achievementId);
      const newState = { ...state };
      const parts = achievementDef?.reward.split(' ') || ['0','NRC'];
      const amount = parseFloat(parts[0]);

      if (parts[1] === 'TON') newState.tonBalance += amount;
      else newState.balance += amount;

      newState.achievements[achievementId] = { ...achRecord, claimed: true, timestamp: Date.now() };
      this.saveState(newState);
      return { success: true, newState };
  }

  // --- ACTIONS ---
  static claimDailyReward(state: PlayerState): { success: boolean, newState?: PlayerState, reward?: number, error?: string } {
    // Handled locally for speed, synced later
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (now - state.lastDailyRewardClaim < oneDay) return { success: false, error: 'COOLDOWN' };

    const global = this.getGlobalStats(0);
    const newState = { ...state, balance: state.balance + global.baseDailyReward, lastDailyRewardClaim: now, dailyStreak: state.dailyStreak + 1 };
    this.saveState(newState);
    return { success: true, newState, reward: global.baseDailyReward };
  }

  static completeQuest(state: PlayerState, questId: string, reward: number): { success: boolean, newState?: PlayerState, error?: string } {
      if (state.completedQuestIds.includes(questId)) return { success: false, error: 'ALREADY_COMPLETED' };
      const newState = { ...state, balance: state.balance + reward, completedQuestIds: [...state.completedQuestIds, questId] };
      this.saveState(newState);
      return { success: true, newState };
  }

  static exchangeCurrency(state: PlayerState, amountNrc: number, type: 'buy' | 'sell'): { success: boolean, newState?: PlayerState, message?: string } {
      const global = this.getGlobalStats(0);
      const newState = { ...state };
      const price = global.currentPrice;

      if (type === 'sell') {
          if (state.balance < amountNrc) return { success: false, message: 'Insufficient NRC' };
          newState.balance -= amountNrc;
          newState.tonBalance += amountNrc * price;
      } else {
          const cost = amountNrc * price;
          if (state.tonBalance < cost) return { success: false, message: 'Insufficient TON' };
          newState.tonBalance -= cost;
          newState.balance += amountNrc;
      }
      this.saveState(newState);
      return { success: true, newState };
  }

  static purchaseUpgrade(state: PlayerState, upgradeId: string, currency: 'TON' | 'NRC'): { success: boolean; newState?: PlayerState, message?: string } {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return { success: false };

    // Optimistic Update
    const currentLevel = state.upgrades[upgradeId] || 0;
    const newState = { ...state };
    
    // Cost calc
    let cost = 0;
    if (currency === 'TON') cost = upgrade.costTon * Math.pow(1 + upgrade.scaleTon, currentLevel);
    else cost = upgrade.costNrc * Math.pow(1 + upgrade.scaleNrc, currentLevel);

    if (currency === 'TON') {
        if (state.tonBalance < cost) return { success: false, message: 'Insufficient TON' };
        newState.tonBalance -= cost;
    } else {
        if (state.balance < cost) return { success: false, message: 'Insufficient NRC' };
        newState.balance -= cost;
    }

    if (upgrade.category === 'premium') {
        newState.premiumUntil = Date.now() + (7*24*60*60*1000); // Demo 1 week
        newState.upgrades[upgradeId] = 1;
    } else {
        newState.upgrades[upgradeId] = currentLevel + 1;
        if (upgrade.type === 'click') newState.clickPower += upgrade.basePower;
        else newState.autoMineRate += upgrade.basePower;
    }

    // Send purchase to server for verification and Pool updates
    let userId = 12345678;
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) userId = window.Telegram.WebApp.initDataUnsafe.user.id;
    
    apiCall('/purchase', { userId, itemId: upgradeId, currency, cost });

    this.saveState(newState);
    return { success: true, newState };
  }

  // --- MINIGAMES (Local Deterministic or Server Call) ---
  // Keeping local for latency, but result should be synced
  static playCyberSpin(state: PlayerState, bet: number, currency: 'NRC' | 'TON') {
      // ... logic remains same as before for instant UI ...
      // In production, this call would go to server to prevent cheating
      const newState = { ...state };
      // Simulate deduction
      if(currency === 'NRC') newState.balance -= bet; else newState.tonBalance -= bet;
      
      const rand = Math.random() * 1000;
      let multiplier = 0;
      let item = 'shard';
      if (rand < 600) { multiplier = 0; }
      else if (rand < 880) { multiplier = 1.2; item = 'chip'; }
      else if (rand < 960) { multiplier = 3.0; item = 'skull'; }
      else if (rand < 995) { multiplier = 10.0; item = 'potion'; }
      else { multiplier = 50.0; item = 'core'; }

      const payout = Math.floor(bet * multiplier);
      if(currency === 'NRC') newState.balance += payout; else newState.tonBalance += payout;
      
      this.saveState(newState);
      return { success: true, newState, resultItem: item, multiplier, payout };
  }

  static playQuantumSlots(state: PlayerState, bet: number, currency: 'NRC' | 'TON') {
      const newState = { ...state };
      if(currency === 'NRC') newState.balance -= bet; else newState.tonBalance -= bet;
      
      const reelStrip = ['7','@','@','#','#','#','%','%','&','&'];
      const r1 = reelStrip[Math.floor(Math.random()*reelStrip.length)];
      const r2 = reelStrip[Math.floor(Math.random()*reelStrip.length)];
      const r3 = reelStrip[Math.floor(Math.random()*reelStrip.length)];
      
      let payout = 0;
      let isJackpot = false;
      
      if(r1===r2 && r2===r3) {
          if(r1==='7') { payout = bet*50; isJackpot=true; }
          else if(r1==='@') payout = bet*15;
          else payout = bet*5;
      }
      
      if(currency === 'NRC') newState.balance += payout; else newState.tonBalance += payout;
      this.saveState(newState);
      
      return { success: true, newState, result: [r1,r2,r3], payout, isJackpot };
  }

  // --- ADMIN (Simulated calls to server via /sync mainly or separate admin endpoints) ---
  static injectLiquidity(amount: number) { return true; }
  static updateBaseDailyReward(n: number) {}
  static updateExchangeConfig(c: any) {}
  static updateRewardConfig(c: any) {}
  static addQuest(q: any) {}
  static deleteQuest(id: string) {}
  static getLimitedStock(id: string) { 
      const g = this.getGlobalStats(0);
      return g.limitedItemsSold[id] || 0;
  }
}
