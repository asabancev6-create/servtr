
import { PlayerState, GlobalStats, Quest, Upgrade, ExchangeConfig } from '../types';
import { INITIAL_STATE, INITIAL_BLOCK_REWARD, HALVING_INTERVAL, MAX_SUPPLY, UPGRADES, INITIAL_DIFFICULTY } from '../constants';

// CONFIG
// Replace this with your actual public server URL when deploying
const API_URL = 'http://localhost:3001/api'; 
const USE_SERVER = true; 

const LOCAL_STORAGE_KEY = 'neurocoin_client_v1';

export class GameService {
  
  private static localState: PlayerState = INITIAL_STATE;
  private static globalStateCache: GlobalStats | null = null;
  private static pendingHashes: number = 0;
  private static userId: string = 'guest';
  private static initData: string = ''; // Store the raw Telegram initData string

  // --- INITIALIZATION ---
  static async init(userId: string = 'guest'): Promise<{ user: PlayerState, global: GlobalStats }> {
      this.userId = userId;
      
      // Get InitData from Telegram WebApp
      if (window.Telegram?.WebApp?.initData) {
          this.initData = window.Telegram.WebApp.initData;
      }

      try {
          if (USE_SERVER) {
              const res = await fetch(`${API_URL}/init`, {
                  method: 'POST',
                  headers: { 
                      'Content-Type': 'application/json',
                      'X-Telegram-Init-Data': this.initData // Send Auth Header
                  },
                  body: JSON.stringify({ userId }) // Fallback for dev mode
              });
              
              if (res.ok) {
                  const data = await res.json();
                  this.localState = data.user;
                  this.globalStateCache = data.global;
                  this.saveLocalBackup();
                  return data;
              }
          }
      } catch (e) {
          console.warn('Server offline, using local backup');
      }

      // Fallback
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
          this.localState = { ...INITIAL_STATE, ...JSON.parse(saved) };
      }
      
      if (!this.globalStateCache) {
          this.globalStateCache = this.getMockGlobal();
      }

      return { user: this.localState, global: this.globalStateCache! };
  }

  // --- CORE MINING LOOP (Hybrid) ---
  static submitHashes(amount: number, currentPlayerState: PlayerState): { newPlayerState: PlayerState, blockClosed: boolean, reward: number } {
      const currentGlobal = this.globalStateCache || this.getMockGlobal();
      const currentHalving = Math.floor(currentGlobal.blockHeight / HALVING_INTERVAL);
      const blockReward = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
      const contributorPot = blockReward * (currentGlobal.rewardConfig.contributorPercent / 100);
      
      // Optimistic Reward
      const shareReward = (amount / currentGlobal.currentDifficulty) * contributorPot;
      
      const optimisticState = { ...currentPlayerState };
      optimisticState.balance += shareReward;
      optimisticState.lifetimeHashes += amount;
      
      if (this.globalStateCache) {
          this.globalStateCache.currentBlockHash += amount;
          if (this.globalStateCache.currentBlockHash >= this.globalStateCache.currentDifficulty) {
              this.globalStateCache.currentBlockHash = 0;
              this.globalStateCache.blockHeight++;
          }
      }

      this.pendingHashes += amount;
      this.localState = optimisticState; 

      return { newPlayerState: optimisticState, blockClosed: false, reward: shareReward };
  }

  // --- SYNC LOOP ---
  static async syncWithServer(): Promise<{ user: PlayerState, global: GlobalStats } | null> {
      if (!USE_SERVER || this.pendingHashes <= 0) return null;

      try {
          const hashesToSend = this.pendingHashes;
          this.pendingHashes = 0; 

          const res = await fetch(`${API_URL}/mine`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'X-Telegram-Init-Data': this.initData 
              },
              body: JSON.stringify({ userId: this.userId, amount: hashesToSend })
          });

          if (res.ok) {
              const data = await res.json();
              this.localState = data.user;
              this.globalStateCache = data.global;
              
              this.injectUserIntoLeaderboard();
              this.saveLocalBackup();
              return data;
          } else {
              this.pendingHashes += hashesToSend; // Restore
          }
      } catch (e) {
          this.pendingHashes += 0; 
      }
      return null;
  }

  static getGlobalStats(playerBalance: number): GlobalStats {
      if (!this.globalStateCache) return this.getMockGlobal();
      this.injectUserIntoLeaderboard();
      return this.globalStateCache;
  }

  static getLimitedStock(itemId: string): number {
      if (!this.globalStateCache) return 0;
      return this.globalStateCache.limitedItemsSold[itemId] || 0;
  }

  private static injectUserIntoLeaderboard() {
      if (!this.globalStateCache) return;
      
      const lb = this.globalStateCache.leaderboard;
      const userEntry = {
          id: this.userId,
          name: 'You',
          balance: this.localState.balance,
          isUser: true,
          rank: 0
      };

      const existingIdx = lb.findIndex(u => u.id.toString() === this.userId.toString());
      if (existingIdx !== -1) {
          lb[existingIdx] = { ...lb[existingIdx], ...userEntry, isUser: true };
      } else {
          // If user is not in top 50, we don't force them into the array to avoid hydration issues,
          // but we ensure components know who they are via local state.
      }
  }

  // --- ACTIONS ---

  static purchaseUpgrade(state: PlayerState, upgradeId: string, currency: 'TON' | 'NRC'): { success: boolean; newState?: PlayerState, message?: string } {
      if (USE_SERVER) {
          fetch(`${API_URL}/action`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'X-Telegram-Init-Data': this.initData 
              },
              body: JSON.stringify({ 
                  userId: this.userId, 
                  action: 'purchase_upgrade', 
                  payload: { upgradeId, currency } 
              })
          }).then(res => res.json()).then(data => {
              if (data.success) {
                  this.localState = data.user;
                  this.globalStateCache = data.global;
              }
          });
      }

      // Optimistic logic
      const upgrade = UPGRADES.find(u => u.id === upgradeId);
      if (!upgrade) return { success: false, message: 'Item not found' };

      const newState = { ...state };
      const currentLevel = newState.upgrades[upgradeId] || 0;
      
      let cost = 0;
      if (currency === 'TON') {
        cost = upgrade.costTon * Math.pow(1 + upgrade.scaleTon, currentLevel);
        if (state.tonBalance < cost) return { success: false, message: 'Insufficient TON' };
        newState.tonBalance -= cost;
      } else {
        cost = upgrade.costNrc * Math.pow(1 + upgrade.scaleNrc, currentLevel);
        if (state.balance < cost) return { success: false, message: 'Insufficient NRC' };
        newState.balance -= cost;
      }

      if (upgrade.category === 'premium') {
          newState.premiumUntil = Date.now() + (7 * 24 * 60 * 60 * 1000); 
          newState.upgrades[upgradeId] = 1;
      } else {
          newState.upgrades[upgradeId] = currentLevel + 1;
          if (upgrade.type === 'click') newState.clickPower += upgrade.basePower;
          else newState.autoMineRate += upgrade.basePower;
      }

      this.localState = newState;
      return { success: true, newState };
  }

  static payElectricity(state: PlayerState): { success: boolean, newState?: PlayerState, message?: string } {
      if (USE_SERVER) {
          fetch(`${API_URL}/action`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'X-Telegram-Init-Data': this.initData 
              },
              body: JSON.stringify({ userId: this.userId, action: 'pay_electricity' })
          });
      }

      if (state.electricityDebt <= 0) return { success: false, message: 'No Debt' };
      if (state.balance < state.electricityDebt) return { success: false, message: 'Insufficient NRC' };
      
      const newState = { ...state };
      newState.balance -= newState.electricityDebt;
      newState.electricityDebt = 0;
      
      this.localState = newState;
      return { success: true, newState };
  }

  static claimDailyReward(state: PlayerState): { success: boolean, newState?: PlayerState, reward?: number, error?: string } {
      if (USE_SERVER) {
          fetch(`${API_URL}/action`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'X-Telegram-Init-Data': this.initData 
              },
              body: JSON.stringify({ userId: this.userId, action: 'claim_daily' })
          }).then(r => r.json()).then(d => {
              if (d.success) {
                  this.localState = d.user;
                  this.globalStateCache = d.global;
              }
          });
      }
      
      // Optimistic
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (now - state.lastDailyRewardClaim >= oneDay) {
          const newState = { ...state };
          const reward = 5; // Base estimate
          newState.balance += reward;
          newState.lastDailyRewardClaim = now;
          this.localState = newState;
          return { success: true, newState, reward };
      }
      return { success: false, error: 'COOLDOWN' };
  }

  // ... (Other methods remain stubs for brevity but follow the same pattern: Optimistic update + Sync/Fire&Forget)
  static loadState(): PlayerState { return this.localState; }
  static saveState(state: PlayerState) { this.localState = state; this.saveLocalBackup(); }
  private static saveLocalBackup() { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.localState)); }

  private static getMockGlobal(): GlobalStats {
      return {
          totalUsers: 1,
          totalMined: 0,
          activeMiners: 1,
          blockHeight: 0,
          currentDifficulty: INITIAL_DIFFICULTY,
          currentBlockHash: 0,
          lastBlockTime: Date.now(),
          epochStartTime: Date.now(),
          marketCap: 0,
          liquidityTon: 1000,
          treasuryTon: 500,
          rewardPoolNrc: 0,
          rewardPoolTon: 0,
          rewardPoolStars: 0,
          marketPoolNrc: 0,
          limitedItemsSold: {},
          currentPrice: 0.000001,
          priceHistory: [],
          leaderboard: [],
          rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
          exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
          quests: [],
          baseDailyReward: 5
      };
  }
  
  static checkAchievements(state: PlayerState) { return state; }
  static claimAchievementReward(state: PlayerState, id: string) { return { success: true, newState: state }; }
  static exchangeCurrency(state: PlayerState, amount: number, type: 'buy'|'sell') { return { success: true, newState: state, message: '' }; }
  static startCrashGame(state: PlayerState, bet: number, curr: string) { return { success: true, newState: state, crashPoint: 2.0, message: '' }; }
  static cashOutCrashGame(state: PlayerState, bet: number, mult: number, curr: string) { return { success: true, newState: state, message: '' }; }
  static playNeonDice(state: PlayerState, bet: number, curr: string, pred: string) { return { success: true, newState: state, dice: [3,4], payout: bet*1.7, message: '' }; }
  static playCyberSpin(state: PlayerState, bet: number, curr: string) { return { success: true, newState: state, resultItem: 'chip', payout: bet*1.1, multiplier: 1.1, message: '' }; }
  static playQuantumSlots(state: PlayerState, bet: number, curr: string) { return { success: true, newState: state, result: ['7','7','7'], payout: bet*10, isJackpot: false, message: '' }; }
  static completeQuest(state: PlayerState, id: string, reward: number) { return { success: true, newState: state, error: '' }; }
  static injectLiquidity(amt: number) { return true; }
  static updateRewardConfig(c: any) {}
  static updateBaseDailyReward(n: number) {}
  static updateExchangeConfig(c: any) {}
  static addQuest(q: any) {}
  static deleteQuest(id: string) {}
}
