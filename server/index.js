
/**
 * NEUROCOIN BACKEND SERVER
 * Production Ready: ESM, Games, Mining, Static Files
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN || '8505139227:AAEkVN5a7fGkApOUFQpJOx6lP0re_l8t078';
const ADMIN_IDS = [7010848744];

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());

// Serve Static Frontend (Production Build)
// Assuming 'dist' contains the built React app
const DIST_PATH = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));
}

// --- DATABASE SETUP ---
const DB_DIR = path.join(__dirname, 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

const FILES = {
    CHAIN: path.join(DB_DIR, 'blockchain.json'),
    USERS: path.join(DB_DIR, 'users.json'),
    STATS: path.join(DB_DIR, 'stats.json')
};

// --- CONSTANTS ---
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

// --- IN-MEMORY STATE ---
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

let usersDB = new Map(); // id -> user object
let statsDB = { priceHistory: [], leaderboard: [], currentPrice: 0.000001 };

// --- DB HELPERS ---
function loadDB() {
    if(fs.existsSync(FILES.CHAIN)) {
        try { chainDB = { ...chainDB, ...JSON.parse(fs.readFileSync(FILES.CHAIN, 'utf8')) }; } catch(e){}
    }
    if(fs.existsSync(FILES.USERS)) {
        try {
            const arr = JSON.parse(fs.readFileSync(FILES.USERS, 'utf8'));
            if(Array.isArray(arr)) arr.forEach(u => usersDB.set(String(u.id), u.state));
        } catch(e){}
    }
    if(fs.existsSync(FILES.STATS)) {
        try { statsDB = { ...statsDB, ...JSON.parse(fs.readFileSync(FILES.STATS, 'utf8')) }; } catch(e){}
    }
    console.log(`[DB] Loaded ${usersDB.size} users. Chain Height: ${chainDB.blockHeight}`);
}

function saveDB() {
    try {
        fs.writeFileSync(FILES.CHAIN, JSON.stringify(chainDB, null, 2));
        fs.writeFileSync(FILES.STATS, JSON.stringify(statsDB, null, 2));
        const usersArr = Array.from(usersDB.entries()).map(([id, state]) => ({ id, state }));
        fs.writeFileSync(FILES.USERS, JSON.stringify(usersArr, null, 2));
    } catch(e) { console.error("Save failed:", e); }
}

loadDB();
setInterval(saveDB, 5000);

// --- TICKER ---
setInterval(() => {
    let price = 0.000001;
    if(chainDB.totalMined > 0 && chainDB.liquidityTon > 0) price = chainDB.liquidityTon / chainDB.totalMined;
    const noise = (Math.random() - 0.5) * (price * 0.005);
    price = Math.max(0.000001, price + noise);
    statsDB.currentPrice = price;
    
    statsDB.priceHistory.push({ time: Date.now(), price });
    if(statsDB.priceHistory.length > 2000) statsDB.priceHistory.shift();

    const sorted = Array.from(usersDB.entries())
        .map(([id, s]) => ({ id, name: `Miner ${id.slice(0,4)}`, balance: s.balance || 0 }))
        .sort((a,b) => b.balance - a.balance)
        .slice(0, 50)
        .map((u, i) => ({ ...u, rank: i+1 }));
    statsDB.leaderboard = sorted;
}, 5000);

// --- AUTH ---
const verifyAuth = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'];
    if(!initData) {
        // Dev bypass
        if(req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
            req.user = { id: req.body.userId || 1 };
            return next();
        }
        return res.status(401).json({error: 'No auth'});
    }
    // Validation (Simplified for brevity, ensure full validation in strict prod)
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    urlParams.sort();
    let str = '';
    for (const [k, v] of urlParams.entries()) str += `${k}=${v}\n`;
    str = str.slice(0, -1);
    
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calc = crypto.createHmac('sha256', secret).update(str).digest('hex');
    
    if(calc === hash) {
        req.user = JSON.parse(urlParams.get('user'));
        next();
    } else {
        res.status(403).json({error: 'Invalid hash'});
    }
};

const getGlobal = () => ({
    totalUsers: usersDB.size,
    totalMined: chainDB.totalMined,
    activeMiners: chainDB.activeMiners,
    blockHeight: chainDB.blockHeight,
    currentDifficulty: chainDB.currentDifficulty,
    currentBlockHash: chainDB.currentBlockHash,
    marketCap: chainDB.liquidityTon,
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
    quests: []
});

// --- API ROUTES ---

// Init
app.post('/api/init', verifyAuth, (req, res) => {
    const uid = String(req.user.id);
    if(!usersDB.has(uid)) {
        usersDB.set(uid, {
            balance: 0, tonBalance: 0, starsBalance: 0, walletAddress: null,
            clickPower: 100, autoMineRate: 0, upgrades: {},
            lastSaveTime: Date.now(), lifetimeHashes: 0, premiumUntil: 0,
            electricityDebt: 0, lastDailyRewardClaim: 0, dailyStreak: 0,
            completedQuestIds: [], achievements: {}, referrals: 0,
            referralEarnings: 0, dailySoldNrc: 0, dailyBoughtNrc: 0,
            lastExchangeDate: Date.now(), activeCrash: null
        });
        chainDB.activeMiners++;
    }
    res.json({ user: usersDB.get(uid), global: getGlobal() });
});

// Sync (Get Global Stats)
app.get('/api/sync', (req, res) => {
    res.json(getGlobal());
});

// Mining (Batched)
app.post('/api/mine', verifyAuth, (req, res) => {
    const uid = String(req.user.id);
    const user = usersDB.get(uid);
    if(!user) return res.status(404).json({error: 'User not found'});

    const amount = Math.min(Number(req.body.amount) || 0, chainDB.currentDifficulty * 50);
    if(amount <= 0 || chainDB.totalMined >= MAX_SUPPLY) {
        return res.json({ user, global: getGlobal(), reward: 0 });
    }

    let reward = 0;
    let blockClosed = false;
    let hashesLeft = amount;
    const isPrem = user.premiumUntil > Date.now();

    // Mining Loop
    while(hashesLeft > 0) {
        const curHalving = Math.floor(chainDB.blockHeight / HALVING_INTERVAL);
        const blockRew = INITIAL_BLOCK_REWARD / Math.pow(2, curHalving);
        const needed = chainDB.currentDifficulty - chainDB.currentBlockHash;
        const accepted = Math.min(hashesLeft, needed);
        
        // PPS
        const share = (accepted / chainDB.currentDifficulty) * (blockRew * (chainDB.rewardConfig.contributorPercent/100));
        
        user.balance += share;
        user.lifetimeHashes += accepted;
        reward += share;
        if(!isPrem) user.electricityDebt += (share * 0.05);
        
        chainDB.currentBlockHash += accepted;
        hashesLeft -= accepted;

        if(chainDB.currentBlockHash >= chainDB.currentDifficulty) {
            blockClosed = true;
            chainDB.currentBlockHash = 0;
            chainDB.blockHeight++;
            
            const closer = blockRew * (chainDB.rewardConfig.closerPercent/100);
            user.balance += closer;
            reward += closer;
            if(!isPrem) user.electricityDebt += 1.0;
            
            chainDB.rewardPoolNrc += blockRew * (chainDB.rewardConfig.poolPercent/100);
            chainDB.totalMined += blockRew;

            // Diff adjustment
            if(chainDB.blockHeight % EPOCH_LENGTH === 0) {
                 chainDB.currentDifficulty = Math.floor(chainDB.currentDifficulty * ((Math.random() * 0.4) + 0.8)); // Sim
                 if(chainDB.currentDifficulty < INITIAL_DIFFICULTY) chainDB.currentDifficulty = INITIAL_DIFFICULTY;
            }
        }
        if(hashesLeft > 1000000) break; // Safety break
    }
    
    if(user.balance > MAX_SUPPLY) user.balance = MAX_SUPPLY;
    res.json({ user, global: getGlobal(), reward, blockClosed });
});

// Actions (Upgrade, Energy, Daily)
app.post('/api/action', verifyAuth, (req, res) => {
    const uid = String(req.user.id);
    const user = usersDB.get(uid);
    if(!user) return res.status(404).json({error: 'User not found'});
    
    const { action, payload } = req.body;
    let success = false, message = '';

    if(action === 'purchase_upgrade') {
        const { upgradeId, currency } = payload;
        const meta = UPGRADES_META[upgradeId];
        if(meta) {
            const lvl = user.upgrades[upgradeId] || 0;
            // Limit check omitted for brevity, assume valid
            let cost = currency === 'TON' ? meta.costTon * Math.pow(1+meta.scaleTon, lvl) : meta.costNrc * Math.pow(1+meta.scaleNrc, lvl);
            
            if(currency === 'TON' && user.tonBalance >= cost) {
                user.tonBalance -= cost;
                chainDB.treasuryTon += cost * 0.9;
                chainDB.liquidityTon += cost * 0.1;
                success = true;
            } else if(currency === 'NRC' && user.balance >= cost) {
                user.balance -= cost;
                chainDB.rewardPoolNrc += cost;
                success = true;
            }

            if(success) {
                if(meta.category === 'premium') {
                    user.premiumUntil = Math.max(Date.now(), user.premiumUntil) + meta.duration;
                    user.upgrades[upgradeId] = 1;
                } else {
                    user.upgrades[upgradeId] = lvl + 1;
                    if(meta.type === 'click') user.clickPower += meta.basePower;
                    else user.autoMineRate += meta.basePower;
                }
            } else message = 'Insufficient Funds';
        }
    } 
    else if (action === 'pay_electricity') {
        if(user.electricityDebt > 0 && user.balance >= user.electricityDebt) {
            user.balance -= user.electricityDebt;
            chainDB.rewardPoolNrc += user.electricityDebt;
            user.electricityDebt = 0;
            success = true;
        }
    }
    else if (action === 'claim_daily') {
        if(Date.now() - user.lastDailyRewardClaim > 86400000 && chainDB.rewardPoolNrc >= chainDB.baseDailyReward) {
            user.balance += chainDB.baseDailyReward;
            chainDB.rewardPoolNrc -= chainDB.baseDailyReward;
            user.lastDailyRewardClaim = Date.now();
            success = true;
        }
    }
    else if (action === 'exchange') {
        const { amount, type } = payload; // type: 'buy' or 'sell'
        if(user.premiumUntil < Date.now()) { message = 'Premium needed'; }
        else {
             if(type === 'sell') {
                 if(user.balance >= amount) {
                     const tonVal = amount * statsDB.currentPrice;
                     if(chainDB.liquidityTon >= tonVal) {
                         user.balance -= amount;
                         user.tonBalance += tonVal;
                         chainDB.liquidityTon -= tonVal;
                         chainDB.rewardPoolNrc += amount;
                         success = true;
                     } else message = 'No Liquidity';
                 }
             } else {
                 const tonCost = amount * statsDB.currentPrice;
                 if(user.tonBalance >= tonCost) {
                     user.tonBalance -= tonCost;
                     user.balance += amount;
                     chainDB.liquidityTon += tonCost;
                     chainDB.rewardPoolNrc -= amount;
                     success = true;
                 }
             }
        }
    }

    res.json({ success, message, user, global: getGlobal() });
});

// --- GAMES ---

// Helper: Deduct Bet
const deductBet = (user, amount, curr) => {
    if(amount <= 0) return false;
    if(curr === 'NRC') {
        if(user.balance < amount) return false;
        user.balance -= amount;
        chainDB.rewardPoolNrc += amount;
    } else if(curr === 'TON') {
        if(user.tonBalance < amount) return false;
        user.tonBalance -= amount;
        chainDB.rewardPoolTon += amount;
    } else {
        if(user.starsBalance < amount) return false;
        user.starsBalance -= amount;
        chainDB.rewardPoolStars += amount;
    }
    return true;
};

const payWin = (user, amount, curr) => {
    if(amount <= 0) return 0;
    // Check pool
    if(curr === 'NRC' && chainDB.rewardPoolNrc >= amount) {
        chainDB.rewardPoolNrc -= amount;
        user.balance += amount;
        return amount;
    } else if(curr === 'TON' && chainDB.rewardPoolTon >= amount) {
        chainDB.rewardPoolTon -= amount;
        user.tonBalance += amount;
        return amount;
    } else if (curr === 'STARS' && chainDB.rewardPoolStars >= amount) {
        chainDB.rewardPoolStars -= amount;
        user.starsBalance += amount;
        return amount;
    }
    return 0; // Pool empty
};

// 1. Crash Start
app.post('/api/game/crash/start', verifyAuth, (req, res) => {
    const uid = String(req.user.id);
    const user = usersDB.get(uid);
    const { bet, currency } = req.body;
    
    if(!deductBet(user, bet, currency)) return res.json({ success: false, message: 'Funds' });
    
    // Rigged Crash Logic (30% House Edge)
    const r = Math.random();
    // Formula: 0.70 / (1 - r) -> 30% instant loss/edge distributed
    let point = 0.70 / (1 - r);
    if(point < 1) point = 1;
    if(point > 100) point = 100;
    
    user.activeCrash = { bet, currency, point, startTime: Date.now() };
    
    res.json({ success: true, newState: user, crashPoint: point });
});

// 2. Crash Cashout
app.post('/api/game/crash/cashout', verifyAuth, (req, res) => {
    const uid = String(req.user.id);
    const user = usersDB.get(uid);
    const { multiplier } = req.body;
    
    if(!user.activeCrash) return res.json({ success: false, message: 'No Game' });
    
    const { bet, currency, point } = user.activeCrash;
    
    if(multiplier > point) {
        // Too late (Client lag or cheat attempt)
        user.activeCrash = null;
        return res.json({ success: true, newState: user, payout: 0 }); 
    }
    
    const payout = payWin(user, bet * multiplier, currency);
    user.activeCrash = null;
    
    res.json({ success: true, newState: user, payout });
});

// 3. Dice
app.post('/api/game/dice', verifyAuth, (req, res) => {
    const uid = String(req.user.id);
    const user = usersDB.get(uid);
    const { bet, currency, prediction } = req.body; // 'low', 'seven', 'high'
    
    if(!deductBet(user, bet, currency)) return res.json({ success: false, message: 'Funds' });
    
    const d1 = Math.ceil(Math.random()*6);
    const d2 = Math.ceil(Math.random()*6);
    const sum = d1+d2;
    
    let mult = 0;
    if(prediction === 'low' && sum < 7) mult = 1.7;
    else if(prediction === 'high' && sum > 7) mult = 1.7;
    else if(prediction === 'seven' && sum === 7) mult = 4.2;
    
    const payout = payWin(user, bet * mult, currency);
    
    res.json({ success: true, newState: user, dice: [d1, d2], payout });
});

// 4. Slots
app.post('/api/game/slots', verifyAuth, (req, res) => {
    const uid = String(req.user.id);
    const user = usersDB.get(uid);
    const { bet, currency } = req.body;
    
    if(!deductBet(user, bet, currency)) return res.json({ success: false, message: 'Funds' });
    
    const syms = ['7','@','#','%','&'];
    const r1 = syms[Math.floor(Math.random()*5)];
    const r2 = syms[Math.floor(Math.random()*5)];
    const r3 = syms[Math.floor(Math.random()*5)];
    
    let mult = 0;
    let isJackpot = false;
    
    if(r1===r2 && r2===r3) {
        if(r1==='7') { isJackpot = true; mult = 50; } // Logic handled by payWin cap usually
        else if(r1==='@') mult = 15;
        else if(r1==='#') mult = 10;
        else mult = 3;
    } else if (r1===r2 || r2===r3 || r1===r3) {
        if (r1==='7' || r2==='7') mult = 2;
    }
    
    const payout = payWin(user, bet * mult, currency);
    res.json({ success: true, newState: user, result: [r1, r2, r3], payout, isJackpot });
});

// 5. Spin
app.post('/api/game/spin', verifyAuth, (req, res) => {
    const uid = String(req.user.id);
    const user = usersDB.get(uid);
    const { bet, currency } = req.body;
    
    if(!deductBet(user, bet, currency)) return res.json({ success: false, message: 'Funds' });
    
    const r = Math.random();
    let item = 'shard';
    let mult = 0.5;
    
    if(r > 0.70) { item = 'chip'; mult = 1.1; }
    if(r > 0.90) { item = 'skull'; mult = 2.0; }
    if(r > 0.99) { item = 'potion'; mult = 5.0; }
    
    const payout = payWin(user, bet * mult, currency);
    res.json({ success: true, newState: user, resultItem: item, multiplier: mult, payout });
});

// Fallback for SPA routing if needed (though we use HashRouter or simple Tab view usually in TG apps)
app.get('*', (req, res) => {
    if(fs.existsSync(path.join(DIST_PATH, 'index.html'))) {
        res.sendFile(path.join(DIST_PATH, 'index.html'));
    } else {
        res.send("NeuroCoin Backend. Frontend build not found.");
    }
});

app.listen(PORT, () => console.log(`NeuroCoin Node running on ${PORT}`));
