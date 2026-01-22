
/**
 * NEUROCOIN BACKEND SERVER (PRODUCTION READY)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// --- PRODUCTION CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8505139227:AAEkVN5a7fGkApOUFQpJOx6lP0re_l8t078'; 
const ADMIN_IDS = [7010848744]; // Your Admin ID

app.use(cors());
app.use(bodyParser.json());

// --- CONSTANTS & CONFIG ---
const DB_FILE = path.join(__dirname, 'database.json');
const SAVE_INTERVAL = 10000; 

const MAX_SUPPLY = 13000000;
const INITIAL_DIFFICULTY = 500000000; // 500 MH
const EPOCH_LENGTH = 1300;
const TARGET_BLOCK_TIME = 360;
const HALVING_INTERVAL = 130000;
const INITIAL_BLOCK_REWARD = 50;

// RE-SYNCED UPGRADES with client to validate logic
const UPGRADES_META = {
    'click_v1': { costTon: 0.1, costNrc: 5, basePower: 100, type: 'click', scaleTon: 0.15, scaleNrc: 0.5 },
    'click_v2': { costTon: 0.4, costNrc: 15, basePower: 500, type: 'click', scaleTon: 0.15, scaleNrc: 0.5 },
    'click_v3': { costTon: 0.8, costNrc: 30, basePower: 1000, type: 'click', scaleTon: 0.15, scaleNrc: 0.5 },
    'miner_basic': { costTon: 1, costNrc: 50, basePower: 500, type: 'auto', scaleTon: 0.13, scaleNrc: 0.5 },
    'miner_pro': { costTon: 4.5, costNrc: 225, basePower: 10000, type: 'auto', scaleTon: 0.08, scaleNrc: 0.5 },
    'miner_ultra': { costTon: 9, costNrc: 450, basePower: 1000000, type: 'auto', scaleTon: 0.06, scaleNrc: 0.5 },
    'farm_v1': { costTon: 15, costNrc: 0, basePower: 50000000, type: 'auto', scaleTon: 0.15, scaleNrc: 0 },
    'farm_v2': { costTon: 25, costNrc: 0, basePower: 500000000, type: 'auto', scaleTon: 0.15, scaleNrc: 0 },
    'farm_v3': { costTon: 125, costNrc: 0, basePower: 2000000000, type: 'auto', scaleTon: 0, scaleNrc: 0 },
    'farm_v4': { costTon: 200, costNrc: 0, basePower: 10000000000, type: 'auto', scaleTon: 0, scaleNrc: 0 },
    'farm_v5': { costTon: 500, costNrc: 0, basePower: 100000000000, type: 'auto', scaleTon: 0, scaleNrc: 0 },
    'farm_v6': { costTon: 800, costNrc: 0, basePower: 200000000000, type: 'auto', scaleTon: 0, scaleNrc: 0 }, // 200 GH
    'prem_week': { costTon: 5, costNrc: 0, basePower: 0, type: 'auto', category: 'premium', duration: 604800000 },
    'prem_month': { costTon: 15, costNrc: 0, basePower: 0, type: 'auto', category: 'premium', duration: 2592000000 },
    'prem_halfyear': { costTon: 80, costNrc: 0, basePower: 0, type: 'auto', category: 'premium', duration: 15552000000 },
    'limited_quantum': { costTon: 1800, costNrc: 0, basePower: 50000000000, type: 'auto', category: 'limited', globalLimit: 100 }
};

// --- STATE ---
let globalState = {
    totalUsers: 0,
    totalMined: 0,
    activeMiners: 0,
    blockHeight: 0,
    currentDifficulty: INITIAL_DIFFICULTY,
    currentBlockHash: 0,
    lastBlockTime: Date.now(),
    epochStartTime: Date.now(),
    marketCap: 0, 
    liquidityTon: 1000, 
    treasuryTon: 500,
    rewardPoolNrc: 1000,
    rewardPoolTon: 100,
    rewardPoolStars: 5000,
    currentPrice: 0.000001,
    priceHistory: [],
    leaderboard: [],
    limitedItemsSold: {}, 
    rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
    exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
    quests: [], 
    baseDailyReward: 5
};

let users = new Map();

// --- AUTHENTICATION MIDDLEWARE ---
const verifyTelegramWebAppData = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'];
    
    if (!initData) {
        if (req.body.userId && (req.hostname === 'localhost' || req.hostname === '127.0.0.1')) {
            req.user = { id: req.body.userId };
            return next();
        }
        return res.status(401).json({ error: 'No init data' });
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    urlParams.sort();

    let dataCheckString = '';
    for (const [key, value] of urlParams.entries()) {
        dataCheckString += `${key}=${value}\n`;
    }
    dataCheckString = dataCheckString.slice(0, -1);

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculation = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculation === hash) {
        const userStr = urlParams.get('user');
        if (userStr) {
            req.user = JSON.parse(userStr);
            return next();
        }
    }

    return res.status(403).json({ error: 'Invalid signature' });
};

// --- PERSISTENCE ---
function loadData() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            globalState = { ...globalState, ...data.globalState };
            
            // Ensure objects exist
            if (!globalState.limitedItemsSold) globalState.limitedItemsSold = {};

            if (data.users) {
                data.users.forEach(u => users.set(String(u.id), u.state));
            }
            console.log('Database loaded.');
        } catch (e) {
            console.error('Failed to load database:', e);
        }
    }
}

function saveData() {
    const data = {
        globalState,
        users: Array.from(users.entries()).map(([id, state]) => ({ id, state }))
    };
    fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), (err) => {
        if (err) console.error("Error saving DB:", err);
    });
}

loadData();
setInterval(saveData, SAVE_INTERVAL);

// --- TICKER ---
setInterval(() => {
    const now = Date.now();
    let price = 0.000001;
    if (globalState.totalMined > 0 && globalState.liquidityTon > 0) {
        price = globalState.liquidityTon / globalState.totalMined;
    }
    
    const noise = (Math.random() - 0.5) * (price * 0.002); 
    price += noise;
    if (price < 0.000001) price = 0.000001;

    globalState.currentPrice = price;
    globalState.priceHistory.push({ time: now, price });
    
    if (globalState.priceHistory.length > 2000) {
        globalState.priceHistory.shift();
    }
    
    const sortedUsers = Array.from(users.entries())
        .map(([id, state]) => ({
            id,
            name: `Miner ${id.slice(0,4)}`, 
            balance: state.balance,
            isUser: false, 
            rank: 0
        }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 50)
        .map((u, i) => ({ ...u, rank: i + 1 }));
    
    globalState.leaderboard = sortedUsers;
    globalState.totalUsers = users.size;

}, 5000);

// --- API ROUTES ---

// 1. INIT
app.post('/api/init', verifyTelegramWebAppData, (req, res) => {
    const userId = String(req.user.id);
    
    if (!users.has(userId)) {
        users.set(userId, {
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
            lastExchangeDate: Date.now()
        });
        globalState.totalUsers++;
    }
    
    res.json({
        user: users.get(userId),
        global: globalState
    });
});

// 2. MINE
app.post('/api/mine', verifyTelegramWebAppData, (req, res) => {
    const userId = String(req.user.id);
    const { amount } = req.body;
    const user = users.get(userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // SAFETY CAP: Prevent huge numbers from crashing logic
    // Max 20 blocks per request allowed logic
    let safeAmount = amount;
    const maxHashesPerRequest = globalState.currentDifficulty * 20;
    if (safeAmount > maxHashesPerRequest) {
        safeAmount = maxHashesPerRequest;
    }

    if (globalState.totalMined >= MAX_SUPPLY) return res.json({ user, global: globalState, reward: 0 });

    let reward = 0;
    const isPremium = user.premiumUntil > Date.now();

    let hashesLeft = safeAmount;
    const MAX_LOOPS = 50; // Cap loops on server too
    let loops = 0;
    let blockClosed = false;

    while (hashesLeft > 0 && loops < MAX_LOOPS) {
        loops++;
        
        const currentHalving = Math.floor(globalState.blockHeight / HALVING_INTERVAL);
        const blockReward = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
        const contributorPot = blockReward * (globalState.rewardConfig.contributorPercent / 100);

        const needed = globalState.currentDifficulty - globalState.currentBlockHash;
        const accepted = Math.min(hashesLeft, needed);

        const shareReward = (accepted / globalState.currentDifficulty) * contributorPot;
        
        user.balance += shareReward;
        user.lifetimeHashes += accepted;
        reward += shareReward;

        if (!isPremium) user.electricityDebt += (shareReward * 0.05);

        globalState.currentBlockHash += accepted;
        hashesLeft -= accepted;

        if (globalState.currentBlockHash >= globalState.currentDifficulty) {
            blockClosed = true;
            globalState.currentBlockHash = 0;
            globalState.blockHeight++;
            
            const closerReward = blockReward * (globalState.rewardConfig.closerPercent / 100);
            user.balance += closerReward;
            reward += closerReward;

            if (!isPremium) user.electricityDebt += 1.0;

            globalState.rewardPoolNrc += blockReward * (globalState.rewardConfig.poolPercent / 100);
            globalState.totalMined += blockReward;
            globalState.lastBlockTime = Date.now();

            if (globalState.blockHeight % EPOCH_LENGTH === 0) {
                const now = Date.now();
                const startTime = globalState.epochStartTime || (now - (EPOCH_LENGTH * TARGET_BLOCK_TIME * 1000));
                const timeTakenSec = (now - startTime) / 1000;
                const safeTimeTaken = Math.max(1, timeTakenSec);
                const targetTimeSec = EPOCH_LENGTH * TARGET_BLOCK_TIME;
                let ratio = targetTimeSec / safeTimeTaken;
                ratio = Math.max(ratio, 0.25);
                globalState.currentDifficulty = Math.floor(globalState.currentDifficulty * ratio);
                if (globalState.currentDifficulty < INITIAL_DIFFICULTY) globalState.currentDifficulty = INITIAL_DIFFICULTY;
                globalState.epochStartTime = now;
            }
        }
    }

    if (user.balance > MAX_SUPPLY) user.balance = MAX_SUPPLY;
    
    res.json({
        user,
        global: globalState,
        reward,
        blockClosed
    });
});

// 3. ACTION
app.post('/api/action', verifyTelegramWebAppData, (req, res) => {
    const userId = String(req.user.id);
    const { action, payload } = req.body;
    const user = users.get(userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check ADMIN Actions
    if (['inject_liquidity', 'update_reward_config', 'update_exchange_config', 'update_base_daily', 'add_quest', 'delete_quest'].includes(action)) {
        if (!ADMIN_IDS.includes(parseInt(userId))) {
            return res.status(403).json({ error: 'Admin Access Required' });
        }
    }

    let success = false;
    let message = '';

    if (action === 'pay_electricity') {
        if (user.electricityDebt > 0 && user.balance >= user.electricityDebt) {
            const debt = user.electricityDebt;
            user.balance -= debt;
            user.electricityDebt = 0;
            globalState.rewardPoolNrc += debt;
            success = true;
            message = 'Paid';
        } else {
            message = 'Insufficient funds or no debt';
        }
    } 
    else if (action === 'purchase_upgrade') {
        const { upgradeId, currency } = payload;
        const meta = UPGRADES_META[upgradeId];
        
        if (!meta) {
            message = 'Item not found';
        } else {
            const currentLevel = user.upgrades[upgradeId] || 0;
            
            // Limit Check
            if (meta.category === 'limited') {
                const sold = globalState.limitedItemsSold[upgradeId] || 0;
                if (sold >= meta.globalLimit) {
                    return res.json({ success: false, message: 'Sold Out', user, global: globalState });
                }
            }

            let cost = 0;
            if (currency === 'TON') {
                cost = meta.costTon * Math.pow(1 + (meta.scaleTon || 0), currentLevel);
                if (user.tonBalance < cost) {
                    message = 'Insufficient TON';
                } else {
                    user.tonBalance -= cost;
                    globalState.treasuryTon += cost * 0.9;
                    globalState.liquidityTon += cost * 0.1;
                    success = true;
                }
            } else {
                cost = meta.costNrc * Math.pow(1 + (meta.scaleNrc || 0), currentLevel);
                if (user.balance < cost) {
                    message = 'Insufficient NRC';
                } else {
                    user.balance -= cost;
                    globalState.rewardPoolNrc += cost;
                    success = true;
                }
            }

            if (success) {
                if (meta.category === 'premium') {
                    const now = Date.now();
                    const currentExpiry = user.premiumUntil > now ? user.premiumUntil : now;
                    user.premiumUntil = currentExpiry + meta.duration;
                    user.upgrades[upgradeId] = 1;
                } else {
                    user.upgrades[upgradeId] = currentLevel + 1;
                    if (meta.type === 'click') user.clickPower += meta.basePower;
                    else user.autoMineRate += meta.basePower;
                    
                    if (meta.category === 'limited') {
                        globalState.limitedItemsSold[upgradeId] = (globalState.limitedItemsSold[upgradeId] || 0) + 1;
                    }
                }
                message = 'Purchased';
            }
        }
    }
    // ... rest of actions remain same
    else if (action === 'claim_daily') {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (now - user.lastDailyRewardClaim >= oneDay) {
            if (globalState.rewardPoolNrc >= globalState.baseDailyReward) {
                user.balance += globalState.baseDailyReward;
                globalState.rewardPoolNrc -= globalState.baseDailyReward;
                user.lastDailyRewardClaim = now;
                user.dailyStreak++;
                success = true;
                message = 'Claimed';
            } else {
                message = 'Pool Empty';
            }
        } else {
            message = 'Cooldown';
        }
    }
    else if (action === 'inject_liquidity') {
        const { amount } = payload;
        if (globalState.treasuryTon >= amount) {
            globalState.treasuryTon -= amount;
            globalState.liquidityTon += amount;
            success = true;
        }
    }
    else if (action === 'update_exchange_config') {
        const { maxDailySell, maxDailyBuy } = payload;
        globalState.exchangeConfig = { maxDailySell, maxDailyBuy };
        success = true;
    }
    else if (action === 'update_base_daily') {
        const { amount } = payload;
        globalState.baseDailyReward = amount;
        success = true;
    }

    res.json({ success, message, user, global: globalState });
});

app.get('/api/sync', (req, res) => {
    res.json(globalState);
});

app.listen(PORT, () => {
    console.log(`NeuroCoin Server running on port ${PORT}`);
});
