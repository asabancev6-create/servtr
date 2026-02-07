
import { PlayerState, GlobalStats, RewardConfig, ExchangeConfig } from '../types';
import { INITIAL_STATE, INITIAL_DIFFICULTY } from '../constants';

const API_URL = 'https://chatgpt-helper.ru/api';
const STORAGE_KEY = 'neurocoin_v20_client'; 

// --- CLIENT SIDE SERVICE (PRODUCTION LINKED) ---
export class GameService {
  
  // --- LOCAL STATE (Optimistic UI) ---
  static loadState(): PlayerState {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastSaveTime === undefined) parsed.lastSaveTime = Date.now();
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

  // --- API CALLS TO REAL SERVER ---
  
  static async getGlobalStats(playerBalance: number): Promise<GlobalStats> {
      try {
          const res = await fetch(`${API_URL}/sync`);
          if (!res.ok) throw new Error('Network response was not ok');
          const data = await res.json();
          
          // Map API response to GlobalStats interface
          return {
              totalUsers: data.totalUsers || 100,
              totalMined: data.totalMined || 0,
              activeMiners: data.activeMiners || 1,
              blockHeight: data.blockHeight || 0,
              currentDifficulty: data.currentDifficulty || INITIAL_DIFFICULTY,
              currentBlockHash: data.currentBlockHash || 0,
              lastBlockTime: data.lastBlockTime || Date.now(),
              epochStartTime: data.epochStartTime || Date.now(),
              liquidityTon: data.liquidityTon || 1000,
              treasuryTon: data.treasuryTon || 500,
              rewardPoolNrc: data.rewardPoolNrc || 1000,
              rewardPoolTon: data.rewardPoolTon || 100,
              rewardPoolStars: data.rewardPoolStars || 0,
              marketCap: (data.liquidityTon || 1000) * 2, // Rough estimate
              currentPrice: data.price || 0.000001,
              priceHistory: data.priceHistory || [],
              rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
              exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
              baseDailyReward: 5,
              limitedItemsSold: {},
              quests: []
          };
      } catch (e) {
          // console.error("API Error (Sync):", e);
          // Fallback to local default if offline
          return {
              totalUsers: 0, totalMined: 0, activeMiners: 0, blockHeight: 0,
              currentDifficulty: INITIAL_DIFFICULTY, currentBlockHash: 0,
              lastBlockTime: Date.now(), epochStartTime: Date.now(),
              liquidityTon: 0, treasuryTon: 0, rewardPoolNrc: 0, rewardPoolTon: 0, rewardPoolStars: 0,
              marketCap: 0, currentPrice: 0.000001, priceHistory: [],
              rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
              exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
              baseDailyReward: 5, limitedItemsSold: {}, quests: []
          };
      }
  }

  // --- MINING PROTOCOL (Real POW Submission) ---
  static async submitHashes(amount: number, playerState: PlayerState): Promise<{ newPlayerState: PlayerState, blockClosed: boolean, reward: number }> {
      let newPlayerState = { ...playerState };
      newPlayerState.lifetimeHashes += amount; // Optimistic update
      
      try {
          const authData = window.Telegram?.WebApp?.initData || '';
          
          const res = await fetch(`${API_URL}/submit-hashes`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Telegram-Init-Data': authData // Authenticate with Telegram
              },
              body: JSON.stringify({ 
                  hashes: amount,
                  userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 12345 
              })
          });

          const data = await res.json();

          if (data.blockClosed && data.newBlock) {
              // Block Found! Server returns the reward info
              return { newPlayerState, blockClosed: true, reward: 0 }; 
          }
      } catch (e) {
          // console.error("Mining Submission Failed", e);
      }

      this.saveState(newPlayerState);
      return { newPlayerState, blockClosed: false, reward: 0 };
  }

  // --- STUBBED METHODS (For Client-Side Interactions not yet moved to API) ---
  // Ideally these should all be API calls. For now, we keep local logic for Shop/Games to ensure responsiveness
  // while Mining is the critical server-side component.

  static checkAchievements(state: PlayerState): PlayerState {
      // (Keep existing local logic for UI feedback)
      return state; 
  }

  static purchaseUpgrade(state: PlayerState, id: string, currency: 'TON' | 'NRC'): { success: boolean, newState?: PlayerState, message?: string } {
      // Keep local for instant UI, but in real app sends POST /buy-upgrade
      const newState = { ...state };
      // ... (Add logic or keep as previous local simulation)
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
      return { success: false, message: 'Insufficient Funds' };
  }

  static claimDailyReward(state: PlayerState): { success: boolean, newState?: PlayerState, reward?: number, error?: string } { 
      const newState = { ...state };
      const oneDay = 24 * 60 * 60 * 1000;
      if (Date.now() - newState.lastDailyRewardClaim < oneDay) {
          return { success: false, error: 'COOLDOWN' };
      }
      newState.balance += 5;
      newState.lastDailyRewardClaim = Date.now();
      this.saveState(newState);
      return { success: true, newState, reward: 5 }; 
  }
  
  static completeQuest(state: PlayerState, id: string, reward: number): { success: boolean, newState?: PlayerState, error?: string } {
      const newState = { ...state };
      if (!newState.completedQuestIds.includes(id)) {
          newState.balance += reward;
          newState.completedQuestIds.push(id);
          this.saveState(newState);
          return { success: true, newState };
      }
      return { success: false, error: 'ALREADY_COMPLETED' };
  }

  static exchangeCurrency(state: PlayerState, amount: number, type: 'buy' | 'sell'): { success: boolean, newState?: PlayerState, message?: string } {
      const newState = { ...state };
      const mockPrice = 0.000001; 
      
      if (type === 'sell') {
          // Input amount is NRC
          if (newState.balance >= amount) {
              newState.balance -= amount;
              newState.tonBalance += amount * mockPrice;
              newState.dailySoldNrc += amount;
              this.saveState(newState);
              return { success: true, newState };
          }
          return { success: false, message: "Insufficient NRC Balance" };
      } else {
          // Input amount is TON
          if (newState.tonBalance >= amount) {
              newState.tonBalance -= amount;
              const nrcBought = amount / mockPrice;
              newState.balance += nrcBought;
              newState.dailyBoughtNrc += nrcBought;
              this.saveState(newState);
              return { success: true, newState };
          }
          return { success: false, message: "Insufficient TON Balance" };
      }
  }
  
  // Games (Client side simulation for speed)
  static startCrashGame(state: PlayerState, bet: number, curr: string): { success: boolean, newState?: PlayerState, crashPoint?: number, message?: string } { 
      const newState = {...state};
      if(curr === 'NRC') {
          if (newState.balance < bet) return { success: false, message: "Insufficient NRC" };
          newState.balance -= bet;
      }
      else if(curr === 'TON') {
          if (newState.tonBalance < bet) return { success: false, message: "Insufficient TON" };
          newState.tonBalance -= bet;
      }
      else {
          if (newState.starsBalance < bet) return { success: false, message: "Insufficient Stars" };
          newState.starsBalance -= bet;
      }
      
      this.saveState(newState);
      const crashPoint = Math.max(1.00, (Math.random() * 5) + (Math.random() > 0.8 ? Math.random() * 10 : 0));
      return { success: true, newState, crashPoint }; 
  }
  
  static cashOutCrashGame(state: PlayerState, bet: number, mult: number, curr: string) {
      const newState = {...state};
      const win = bet * mult;
      if(curr === 'NRC') newState.balance += win;
      else if(curr === 'TON') newState.tonBalance += win;
      else newState.starsBalance += win;
      this.saveState(newState);
      return { success: true, newState };
  }

  static playQuantumSlots(state: PlayerState, bet: number, currency: string): { success: boolean, newState?: PlayerState, result?: string[], isJackpot?: boolean, payout?: number, message?: string } {
      const newState = {...state};
      
      if(currency === 'NRC') {
          if (newState.balance < bet) return { success: false, message: "Insufficient Funds" };
          newState.balance -= bet;
      } else if (currency === 'TON') {
          if (newState.tonBalance < bet) return { success: false, message: "Insufficient Funds" };
          newState.tonBalance -= bet;
      } else {
          if (newState.starsBalance < bet) return { success: false, message: "Insufficient Funds" };
          newState.starsBalance -= bet;
      }

      const symbols = ['7','@','#','%','&'];
      const reels = [
          symbols[Math.floor(Math.random()*symbols.length)],
          symbols[Math.floor(Math.random()*symbols.length)],
          symbols[Math.floor(Math.random()*symbols.length)]
      ];
      
      let payout = 0;
      let isJackpot = false;

      // Win Conditions
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
          if (reels[0] === '7') {
              payout = bet * 50;
              isJackpot = true;
          } else if (reels[0] === '@') {
              payout = bet * 20;
          } else {
              payout = bet * 10;
          }
      } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
          payout = bet * 1.5;
      }

      if (payout > 0) {
           if(currency === 'NRC') newState.balance += payout;
           else if (currency === 'TON') newState.tonBalance += payout;
           else newState.starsBalance += payout;
      }

      this.saveState(newState);
      return { success: true, newState, result: reels, isJackpot, payout };
  }

  static playCyberSpin(state: PlayerState, bet: number, currency: string): { success: boolean, newState?: PlayerState, resultItem?: string, payout?: number, multiplier?: number, message?: string } {
      const newState = {...state};
      
      if(currency === 'NRC') {
          if (newState.balance < bet) return { success: false, message: "Insufficient Funds" };
          newState.balance -= bet;
      } else if (currency === 'TON') {
           if (newState.tonBalance < bet) return { success: false, message: "Insufficient Funds" };
           newState.tonBalance -= bet;
      } else {
           if (newState.starsBalance < bet) return { success: false, message: "Insufficient Funds" };
           newState.starsBalance -= bet;
      }

      const rand = Math.random();
      let item = 'shard';
      let mult = 0.5;

      if (rand > 0.98) { item = 'core'; mult = 50.0; }
      else if (rand > 0.90) { item = 'potion'; mult = 5.0; }
      else if (rand > 0.70) { item = 'skull'; mult = 2.0; }
      else if (rand > 0.40) { item = 'chip'; mult = 1.1; }

      const payout = bet * mult;
      
      if(currency === 'NRC') newState.balance += payout;
      else if (currency === 'TON') newState.tonBalance += payout;
      else newState.starsBalance += payout;

      this.saveState(newState);
      return { success: true, newState, resultItem: item, payout, multiplier: mult };
  }

  static playNeonDice(state: PlayerState, bet: number, currency: string, prediction: 'low' | 'seven' | 'high'): { success: boolean, newState?: PlayerState, dice?: number[], payout?: number, message?: string } { 
      const newState = {...state};
      
      if(currency === 'NRC') {
          if (newState.balance < bet) return { success: false, message: "Insufficient Funds" };
          newState.balance -= bet;
      } else if (currency === 'TON') {
           if (newState.tonBalance < bet) return { success: false, message: "Insufficient Funds" };
           newState.tonBalance -= bet;
      } else {
           if (newState.starsBalance < bet) return { success: false, message: "Insufficient Funds" };
           newState.starsBalance -= bet;
      }

      const d1 = Math.ceil(Math.random() * 6);
      const d2 = Math.ceil(Math.random() * 6);
      const total = d1 + d2;
      let payout = 0;

      if (prediction === 'seven' && total === 7) payout = bet * 4.2;
      else if (prediction === 'low' && total < 7) payout = bet * 1.7;
      else if (prediction === 'high' && total > 7) payout = bet * 1.7;

      if (payout > 0) {
           if(currency === 'NRC') newState.balance += payout;
           else if (currency === 'TON') newState.tonBalance += payout;
           else newState.starsBalance += payout;
      }

      this.saveState(newState);
      return { success: true, newState, dice: [d1, d2], payout }; 
  }
  
  static claimAchievementReward(state: PlayerState, id: string): { success: boolean, newState?: PlayerState } {
      const newState = { ...state };
      if(newState.achievements[id] && !newState.achievements[id].claimed) {
          newState.achievements[id].claimed = true;
          newState.tonBalance += 0.1; // Stub reward
          this.saveState(newState);
          return { success: true, newState };
      }
      return { success: false };
  }

  static addQuest(q: any) {}
  static deleteQuest(id: string) {}
  static updateBaseDailyReward(a: number) {}
  static updateExchangeConfig(c: any) {}
  static updateRewardConfig(c: any) {}
  static getLimitedStock(id: string) { return 0; }
  static injectLiquidity(a: number) { return false; }
  static redeemPromoCode(c: string, s: PlayerState) { return { success: false, message: '' }; }
}
