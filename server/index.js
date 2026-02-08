
/**
 * NEUROCOIN BACKEND SERVER (MULTI-DB ARCHITECTURE)
 * 
 * Optimized for high-frequency writes by splitting data into:
 * 1. blockchain.json (Core consensus data)
 * 2. users.json (Player states)
 * 3. games.json (Casino logs & jackpots)
 * 4. stats.json (Price history & Leaderboards)
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

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8505139227:AAEkVN5a7fGkApOUFQpJOx6lP0re_l8t078'; 
const ADMIN_IDS = [7010848744]; 

// DB PATHS
const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

const FILES = {
    CHAIN: path.join(DB_DIR, 'blockchain.json'),
    USERS: path.join(DB_DIR, 'users.json'),
    GAMES: path.join(DB_DIR, 'games.json'),
    STATS: path.join(DB_DIR, 'stats.json')
};

// CONSTANTS
const SAVE_INTERVAL = 5000; // Save to disk every 5s (prevents IO lag)
const MAX_SUPPLY = 13000000;
const INITIAL_DIFFICULTY = 500000000; 
const EPOCH_LENGTH = 1300;
const TARGET_BLOCK_TIME = 360;
const HALVING_INTERVAL = 130000;
const INITIAL_BLOCK_REWARD = 50;

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
    'farm_v6': { costTon: 800, costNrc: 0, basePower: 200000000000, type: 'auto', scaleTon: 0, scaleNrc: 0 },
    'prem_week': { costTon: 5, costNrc: 0, basePower: 0, type: 'auto', category: 'premium', duration: 604800000 },
    'prem_month': { costTon: 15, costNrc: 0, basePower: 0, type: 'auto', category: 'premium', duration: 2592000000 },
    'prem_halfyear': { costTon: 80, costNrc: 0, basePower: 0, type: 'auto', category: 'premium', duration: 15552000000 },
    'limited_quantum': { costTon: 1800, costNrc: 0, basePower: 50000000000, type: 'auto', category: 'limited', globalLimit: 100 }
};

app.use(cors());
app.use(bodyParser.json());

// --- IN-MEMORY DATABASES ---
let chainDB = {
    totalMined: 0,
    activeMiners: 0,
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
    rewardConfig: { poolPercent: 10, closerPercent: 70, contributorPercent: 20 },
    exchangeConfig: { maxDailySell: 100, maxDailyBuy: 1000 },
    baseDailyReward: 5,
    limitedItemsSold: {}
};

let usersDB = new Map(); // Map for O(1) access

let gamesDB = {
    totalGamesPlayed: 0,
    lastJackpotWinner: null,
    recentWins: [] // Keep last 50
};

let statsDB = {
    priceHistory: [],
    leaderboard: [],
    totalUsers: 0,
    currentPrice: 0.000001
};

// --- DATA MANAGEMENT ---

function sanitizeNumber(val, defaultVal = 0) {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return defaultVal;
    return val;
}

function loadAllDB() {
    // 1. Load Chain
    if (fs.existsSync(FILES.CHAIN)) {
        try {
            const data = JSON.parse(fs.readFileSync(FILES.CHAIN, 'utf8'));
            chainDB = { ...chainDB, ...data };
            chainDB.currentDifficulty = sanitizeNumber(chainDB.currentDifficulty, INITIAL_DIFFICULTY);
            chainDB.totalMined = sanitizeNumber(chainDB.totalMined, 0);
        } catch(e) { console.error("Chain DB Load Error", e); }
    }

    // 2. Load Users
    if (fs.existsSync(FILES.USERS)) {
        try {
            const data = JSON.parse(fs.readFileSync(FILES.USERS, 'utf8'));
            if (Array.isArray(data)) {
                data.forEach(u => usersDB.set(String(u.id), u.state));
            }
        } catch(e) { console.error("Users DB Load Error", e); }
    }

    // 3. Load Games
    if (fs.existsSync(FILES.GAMES)) {
        try {
            const data = JSON.parse(fs.readFileSync(FILES.GAMES, 'utf8'));
            gamesDB = { ...gamesDB, ...data };
        } catch(e) { console.error("Games DB Load Error", e); }
    }

    // 4. Load Stats
    if (fs.existsSync(FILES.STATS)) {
        try {
            const data = JSON.parse(fs.readFileSync(FILES.STATS, 'utf8'));
            statsDB = { ...statsDB, ...data };
        } catch(e) { console.error("Stats DB Load Error", e); }
    }
    
    console.log(`[SYSTEM] Databases loaded. Users: ${usersDB.size}. Blocks: ${chainDB.blockHeight}`);
}

function saveAllDB() {
    try {
        fs.writeFileSync(FILES.CHAIN, JSON.stringify(chainDB, null, 2));
        
        // Convert Map to Array for JSON
        const usersArray = Array.from(usersDB.entries()).map(([id, state]) => ({ id, state }));
        fs.writeFileSync(FILES.USERS, JSON.stringify(usersArray, null, 2));
        
        fs.writeFileSync(FILES.GAMES, JSON.stringify(gamesDB, null, 2));
        fs.writeFileSync(FILES.STATS, JSON.stringify(statsDB, null, 2));
    } catch (e) {
        console.error("Save Error:", e);
    }
}

// Initial Load
loadAllDB();

// Interval Saver (Async-like behavior to prevent blocking)
setInterval(saveAllDB, SAVE_INTERVAL);

// --- BACKGROUND WORKERS ---

// 1. Ticker (Price & Leaderboard)
setInterval(() => {
    const now = Date.now();
    
    // Recalculate Price based on Chain Data
    let price = 0.000001;
    if (chainDB.totalMined > 0 && chainDB.liquidityTon > 0) {
        price = chainDB.liquidityTon / chainDB.totalMined;
    }
    const noise = (Math.random() - 0.5) * (price * 0.005);
    price += noise;
    if (price < 0.000001) price = 0.000001;
    
    statsDB.currentPrice = price;
    
    // Update History
    statsDB.priceHistory.push({ time: now, price });
    if (statsDB.priceHistory.length > 2000) statsDB.priceHistory.shift();

    // Update Leaderboard
    const sortedUsers = Array.from(usersDB.entries())
        .map(([id, state]) => ({
            id,
            name: `Miner ${id.slice(0,4)}`, 
            balance: state.balance || 0,
            isUser: false, 
            rank: 0
        }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 50)
        .map((u, i) => ({ ...u, rank: i + 1 }));
    
    statsDB.leaderboard = sortedUsers;
    statsDB.totalUsers = usersDB.size;

}, 5000);

// --- AUTH MIDDLEWARE ---
const verifyAuth = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'];
    if (!initData) {
        // Dev fallback
        if (req.body.userId && (req.hostname === 'localhost' || req.hostname === '127.0.0.1')) {
            req.user = { id: req.body.userId };
            return next();
        }
        return res.status(401).json({ error: 'Auth failed' });
    }
    // ... (Full verification logic omitted for brevity, assuming existing logic from previous block)
    // For this implementation, we trust the logic is identical to before.
    // Re-implementing simplified verification for robustness:
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    urlParams.sort();
    let str = '';
    for (const [k, v] of urlParams.entries()) str += `${k}=${v}\n`;
    str = str.slice(0, -1);
    
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calc = crypto.createHmac('sha256', secret).update(str).digest('hex');
    
    if (calc === hash) {
        req.user = JSON.parse(urlParams.get('user'));
        next();
    } else {
        res.status(403).json({ error: 'Invalid Hash' });
    }
};

// --- HELPER: CONSTRUCT GLOBAL RESPONSE ---
// Combines data from multiple DBs into the format frontend expects
const getGlobalResponse = () => ({
    totalUsers: statsDB.totalUsers,
    totalMined: chainDB.totalMined,
    activeMiners: chainDB.activeMiners,
    blockHeight: chainDB.blockHeight,
    currentDifficulty: chainDB.currentDifficulty,
    currentBlockHash: chainDB.currentBlockHash,
    lastBlockTime: chainDB.lastBlockTime,
    epochStartTime: chainDB.epochStartTime,
    marketCap: chainDB.liquidityTon, // Simplified
    limitedItemsSold: chainDB.limitedItemsSold,
    liquidityTon: chainDB.liquidityTon,
    treasuryTon: chainDB.treasuryTon,
    rewardPoolNrc: chainDB.rewardPoolNrc,
    rewardPoolTon: chainDB.rewardPoolTon,
    rewardPoolStars: chainDB.rewardPoolStars,
    currentPrice: statsDB.currentPrice,
    priceHistory: statsDB.priceHistory,
    leaderboard: statsDB.leaderboard,
    rewardConfig: chainDB.rewardConfig,
    exchangeConfig: chainDB.exchangeConfig,
    baseDailyReward: chainDB.baseDailyReward,
    quests: [] // Dynamic quests can be added to gamesDB or separate
});

// --- ROUTES ---

// 1. INIT
app.post('/api/init', verifyAuth, (req, res) => {
    const userId = String(req.user.id);
    
    if (!usersDB.has(userId)) {
        usersDB.set(userId, {
            balance: 0, tonBalance: 0, starsBalance: 0, walletAddress: null,
            clickPower: 100, autoMineRate: 0, upgrades: {},
            lastSaveTime: Date.now(), lifetimeHashes: 0, premiumUntil: 0,
            electricityDebt: 0, lastDailyRewardClaim: 0, dailyStreak: 0,
            completedQuestIds: [], achievements: {}, referrals: 0,
            referralEarnings: 0, dailySoldNrc: 0, dailyBoughtNrc: 0,
            lastExchangeDate: Date.now()
        });
        chainDB.activeMiners++; // Increment approximate active count
    }
    
    res.json({
        user: usersDB.get(userId),
        global: getGlobalResponse()
    });
});

// 2. MINE (Writes to USERS and CHAIN)
app.post('/api/mine', verifyAuth, (req, res) => {
    const userId = String(req.user.id);
    const { amount } = req.body;
    const user = usersDB.get(userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Safety Cap
    let safeAmount = sanitizeNumber(amount);
    const maxHashes = chainDB.currentDifficulty * 50; 
    if (safeAmount > maxHashes) safeAmount = maxHashes;

    if (chainDB.totalMined >= MAX_SUPPLY) {
        return res.json({ user, global: getGlobalResponse(), reward: 0 });
    }

    let reward = 0;
    const isPremium = user.premiumUntil > Date.now();
    let hashesLeft = safeAmount;
    let blockClosed = false;
    let loops = 0;

    // Mining Loop impacting CHAIN DB
    while (hashesLeft > 0 && loops < 50) {
        loops++;
        const currentHalving = Math.floor(chainDB.blockHeight / HALVING_INTERVAL);
        const blockReward = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
        const contribPot = blockReward * (chainDB.rewardConfig.contributorPercent / 100);

        const needed = chainDB.currentDifficulty - chainDB.currentBlockHash;
        const accepted = Math.min(hashesLeft, needed);

        const share = (accepted / chainDB.currentDifficulty) * contribPot;
        
        // Update User
        user.balance += share;
        user.lifetimeHashes += accepted;
        reward += share;
        if (!isPremium) user.electricityDebt += (share * 0.05);

        // Update Chain
        chainDB.currentBlockHash += accepted;
        hashesLeft -= accepted;

        if (chainDB.currentBlockHash >= chainDB.currentDifficulty) {
            blockClosed = true;
            chainDB.currentBlockHash = 0;
            chainDB.blockHeight++;
            
            const closerReward = blockReward * (chainDB.rewardConfig.closerPercent / 100);
            user.balance += closerReward;
            reward += closerReward;
            if (!isPremium) user.electricityDebt += 1.0;

            chainDB.rewardPoolNrc += blockReward * (chainDB.rewardConfig.poolPercent / 100);
            chainDB.totalMined += blockReward;
            chainDB.lastBlockTime = Date.now();

            // Difficulty Adjustment
            if (chainDB.blockHeight % EPOCH_LENGTH === 0) {
                const now = Date.now();
                const start = chainDB.epochStartTime || (now - (EPOCH_LENGTH * TARGET_BLOCK_TIME * 1000));
                const taken = Math.max(1, (now - start) / 1000);
                const target = EPOCH_LENGTH * TARGET_BLOCK_TIME;
                let ratio = target / taken;
                ratio = Math.min(Math.max(ratio, 0.25), 4.0);
                
                chainDB.currentDifficulty = Math.floor(chainDB.currentDifficulty * ratio);
                if (chainDB.currentDifficulty < INITIAL_DIFFICULTY) chainDB.currentDifficulty = INITIAL_DIFFICULTY;
                
                chainDB.epochStartTime = now;
            }
        }
    }

    if (user.balance > MAX_SUPPLY) user.balance = MAX_SUPPLY;

    res.json({
        user,
        global: getGlobalResponse(),
        reward,
        blockClosed
    });
});

// 3. ACTION (Writes to multiple DBs based on action)
app.post('/api/action', verifyAuth, (req, res) => {
    const userId = String(req.user.id);
    const { action, payload } = req.body;
    const user = usersDB.get(userId);
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    let success = false;
    let message = '';

    // --- PURCHASE ---
    if (action === 'purchase_upgrade') {
        const { upgradeId, currency } = payload;
        const meta = UPGRADES_META[upgradeId];
        
        if (meta) {
            const lvl = user.upgrades[upgradeId] || 0;
            
            // Check Limited in CHAIN DB
            if (meta.category === 'limited') {
                const sold = chainDB.limitedItemsSold[upgradeId] || 0;
                if (sold >= meta.globalLimit) {
                    return res.json({ success: false, message: 'Sold Out', user, global: getGlobalResponse() });
                }
            }

            let cost = 0;
            // Cost Calc
            if (currency === 'TON') {
                cost = meta.costTon * Math.pow(1 + meta.scaleTon, lvl);
                if (user.tonBalance >= cost) {
                    user.tonBalance -= cost;
                    // Distribute to CHAIN pools
                    chainDB.treasuryTon += cost * 0.9;
                    chainDB.liquidityTon += cost * 0.1;
                    success = true;
                } else message = 'Insufficient TON';
            } else {
                cost = meta.costNrc * Math.pow(1 + meta.scaleNrc, lvl);
                if (user.balance >= cost) {
                    user.balance -= cost;
                    chainDB.rewardPoolNrc += cost;
                    success = true;
                } else message = 'Insufficient NRC';
            }

            if (success) {
                if (meta.category === 'premium') {
                    const now = Date.now();
                    const exp = user.premiumUntil > now ? user.premiumUntil : now;
                    user.premiumUntil = exp + meta.duration;
                    user.upgrades[upgradeId] = 1;
                } else {
                    user.upgrades[upgradeId] = lvl + 1;
                    if (meta.type === 'click') user.clickPower += meta.basePower;
                    else user.autoMineRate += meta.basePower;
                    
                    if (meta.category === 'limited') {
                        chainDB.limitedItemsSold[upgradeId] = (chainDB.limitedItemsSold[upgradeId] || 0) + 1;
                    }
                }
                message = 'Purchased';
            }
        }
    }
    // --- PAY ELECTRICITY ---
    else if (action === 'pay_electricity') {
        if (user.electricityDebt > 0 && user.balance >= user.electricityDebt) {
            const debt = user.electricityDebt;
            user.balance -= debt;
            user.electricityDebt = 0;
            chainDB.rewardPoolNrc += debt;
            success = true;
            message = 'Bills Paid';
        }
    }
    // --- DAILY REWARD ---
    else if (action === 'claim_daily') {
        const now = Date.now();
        if (now - user.lastDailyRewardClaim >= 86400000) {
            if (chainDB.rewardPoolNrc >= chainDB.baseDailyReward) {
                user.balance += chainDB.baseDailyReward;
                chainDB.rewardPoolNrc -= chainDB.baseDailyReward;
                user.lastDailyRewardClaim = now;
                user.dailyStreak++;
                success = true;
            } else message = 'Pool Empty';
        } else message = 'Cooldown';
    }
    // --- ADMIN INJECT ---
    else if (action === 'inject_liquidity') {
        if (ADMIN_IDS.includes(parseInt(userId))) {
            const { amount } = payload;
            if (chainDB.treasuryTon >= amount) {
                chainDB.treasuryTon -= amount;
                chainDB.liquidityTon += amount;
                success = true;
            }
        }
    }

    res.json({ success, message, user, global: getGlobalResponse() });
});

app.get('/api/sync', (req, res) => {
    res.json(getGlobalResponse());
});

app.listen(PORT, () => {
    console.log(`NeuroCoin Multi-DB Server running on port ${PORT}`);
});
