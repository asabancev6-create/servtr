import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, TooltipProps, CartesianGrid, ComposedChart, Line, ReferenceLine } from 'recharts';
import { PlayerState, GlobalStats, TelegramUser } from '../types';
import { MAX_SUPPLY, formatHashrate, INITIAL_BLOCK_REWARD, HALVING_INTERVAL, formatHashValue, EPOCH_LENGTH, ACHIEVEMENTS } from '../constants';
import { Globe, Trophy, UserCircle2, ShieldCheck, Activity, TrendingUp, BarChart2, Zap, Layers, Box, Cpu, Timer, Hourglass, ArrowUpRight, ArrowDownRight, Pickaxe, Crown, Award, Star, Gem } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface InvestmentsProps {
  playerState: PlayerState;
  globalStats: GlobalStats;
  onPurchase: (id: string, currency: 'TON' | 'NRC') => void;
}

type TimeRange = '1H' | '24H' | '7D';
type ChartMode = 'ACTIVITY' | 'MARKET';

// Small header map
const headerIconMap: Record<string, React.ReactNode> = {
  'Pickaxe': <Pickaxe size={12} className="text-neuro-cyan" />,
  'Zap': <Zap size={12} className="text-neuro-pink" />,
  'Crown': <Crown size={12} className="text-neuro-gold" />,
  'Award': <Award size={12} className="text-orange-400" />,
  'Star': <Star size={12} className="text-neuro-cyan" />,
  'Trophy': <Trophy size={12} className="text-neuro-gold" />,
  'Gem': <Gem size={12} className="text-neuro-pink" />,
};

// Custom Tooltip to match the futuristic neon look
const CustomTooltip = ({ active, payload, label, mode }: TooltipProps<number, string> & { mode: ChartMode }) => {
    if (active && payload && payload.length) {
      if (mode === 'ACTIVITY') {
        return (
            <div className="bg-[#050505]/90 border border-neuro-cyan/50 p-3 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.2)] backdrop-blur-md">
            <p className="text-slate-400 font-mono text-[10px] mb-1">{label}</p>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neuro-cyan shadow-[0_0_5px_#00F0FF]"></div>
                <p className="text-white font-bold font-mono text-sm">{formatHashrate(payload[0].value as number)}</p>
            </div>
            </div>
        );
      } else {
        return (
            <div className="bg-[#050505]/90 border border-white/20 p-3 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] backdrop-blur-md">
            <p className="text-slate-400 font-mono text-[10px] mb-1">{label}</p>
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="text-white font-bold font-mono text-sm">{(payload[0].value as number).toFixed(8)} TON</span>
                </div>
            </div>
            </div>
        );
      }
    }
    return null;
  };

// Pulsing Dot for the last data point
const PulsingDot = (props: any) => {
    const { cx, cy, stroke, payload, data, index } = props;
    
    // Only render for the last point
    if (index === data.length - 1) {
        return (
            <svg x={cx - 10} y={cy - 10} width={20} height={20} viewBox="0 0 20 20" style={{ overflow: 'visible' }}>
                <circle cx="10" cy="10" r="4" fill={stroke} className="animate-ping origin-center" opacity="0.5" />
                <circle cx="10" cy="10" r="4" fill={stroke} stroke="#000" strokeWidth="1" />
            </svg>
        );
    }
    return null;
};

const Investments: React.FC<InvestmentsProps> = ({ playerState, globalStats }) => {
  const { t } = useLanguage();
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const [chartMode, setChartMode] = useState<ChartMode>('MARKET'); // Default to Market for Price View
  
  const [activityData, setActivityData] = useState<any[]>([]);
  const [priceData, setPriceData] = useState<any[]>([]);
  const [trend, setTrend] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        setUser(window.Telegram.WebApp.initDataUnsafe.user);
    } else {
        setUser({ id: 12345678, first_name: "Pilot", username: "crypto_miner" });
    }
  }, []);

  // --- BADGE LOGIC ---
  const highestClaimedIndex = ACHIEVEMENTS.reduce((maxIndex, ach, idx) => {
      const record = playerState.achievements[ach.id];
      if (record && record.claimed) {
          return idx > maxIndex ? idx : maxIndex;
      }
      return maxIndex;
  }, -1);
  const highestBadge = highestClaimedIndex > -1 ? ACHIEVEMENTS[highestClaimedIndex] : null;

  // --- CALCULATE BLOCKCHAIN STATS ---
  const currentBlockHeight = globalStats.blockHeight;
  
  // Halving Logic
  const currentHalving = Math.floor(currentBlockHeight / HALVING_INTERVAL);
  const currentBlockReward = INITIAL_BLOCK_REWARD / Math.pow(2, currentHalving);
  const blocksToHalving = HALVING_INTERVAL - (currentBlockHeight % HALVING_INTERVAL);
  
  // --- DATA GENERATOR (REAL HISTORY) ---
  useEffect(() => {
      const now = new Date().getTime();
      
      // 1. Generate Activity Data (Simulated Hashrate for visual)
      // Keeping random for activity since hashrate fluctuates constantly in real time
      const actData = [];
      const points = 30;
      const currentRate = playerState.autoMineRate;
      let intervalMin = timeRange === '1H' ? 2 : timeRange === '24H' ? 30 : 60*6;

      for (let i = points; i >= 0; i--) {
          const time = new Date(now - i * intervalMin * 60000);
          let rate = 0;
          if (currentRate > 0) {
            const noise = 1 + (Math.random() * 0.1 - 0.05);
            rate = currentRate * noise;
          }
          
          let timeLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (timeRange === '7D') timeLabel = time.toLocaleDateString([], { day: 'numeric', month: 'short' });

          actData.push({ time: timeLabel, rate: Math.floor(rate) });
      }
      setActivityData(actData);

      // 2. USE REAL PRICE HISTORY
      const rawHistory = globalStats.priceHistory || [];
      let cutoffTime = 0;
      
      if (timeRange === '1H') cutoffTime = now - (60 * 60 * 1000);
      else if (timeRange === '24H') cutoffTime = now - (24 * 60 * 60 * 1000);
      else if (timeRange === '7D') cutoffTime = now - (7 * 24 * 60 * 60 * 1000);

      // Filter Data
      const filtered = rawHistory.filter(p => p.time >= cutoffTime);
      
      // If no data (shouldn't happen with backfill), show at least current
      if (filtered.length === 0 && rawHistory.length > 0) {
          filtered.push(rawHistory[rawHistory.length - 1]);
      }

      // Map to Chart Format
      const pData = filtered.map(p => {
          const d = new Date(p.time);
          let timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (timeRange === '7D') timeLabel = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
          return {
              time: timeLabel,
              price: p.price
          };
      });

      setPriceData(pData);
      
      // Determine trend based on Start vs End of visible range
      if (pData.length > 0) {
          const start = pData[0].price;
          const end = pData[pData.length - 1].price;
          setTrend(end >= start ? 'up' : 'down');
      }

  }, [timeRange, playerState.autoMineRate, globalStats.priceHistory]); // Dependency on priceHistory ensures updates

  const emissionPercent = Math.min((globalStats.totalMined / MAX_SUPPLY) * 100, 100);
  
  // Colors for Chart
  const chartColor = trend === 'up' ? '#00ff41' : '#ff3b30'; // Neon Green : Neon Red
  const gradientId = trend === 'up' ? 'colorUp' : 'colorDown';

  return (
    <div className="flex flex-col gap-6 animate-fadeIn p-4 pb-32">
      
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-sans font-bold text-white flex items-center gap-2">
            <Globe className="text-neuro-cyan" /> 
            <span className="gradient-text">{t('invest.title')}</span>
        </h2>
      </div>

      {/* --- SECTION 1: EMISSION BAR --- */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-[0_0_20px_rgba(141,115,255,0.1)]">
           <div className="flex justify-between items-end mb-2">
                <div>
                    <h3 className="text-sm font-bold text-white tracking-widest uppercase mb-1">{t('invest.emissionTitle')}</h3>
                    <p className="text-[10px] text-slate-400 font-sans">{t('invest.emissionDesc')}</p>
                </div>
                <div className="text-right">
                     <span className="text-2xl font-mono font-bold text-neuro-cyan drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
                         {emissionPercent.toFixed(4)}%
                     </span>
                </div>
           </div>
           <div className="h-4 w-full bg-black rounded-full overflow-hidden border border-white/10 shadow-inner relative mb-3">
                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                <div 
                    className="h-full bg-gradient-to-r from-neuro-violet via-neuro-pink to-neuro-cyan relative transition-all duration-1000 ease-out"
                    style={{ width: `${emissionPercent}%` }}
                >
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_white]"></div>
                </div>
           </div>
           <div className="flex justify-between text-[10px] font-mono font-bold uppercase text-slate-500">
               <div>
                   <span className="text-neuro-violet block mb-0.5">{t('invest.mined')}</span>
                   <span className="text-white text-xs">{(globalStats.totalMined / 1000000).toFixed(2)}M NRC</span>
               </div>
               <div className="text-right">
                   <span className="text-slate-500 block mb-0.5">{t('invest.supply')}</span>
                   <span className="text-white text-xs">{(MAX_SUPPLY / 1000000).toFixed(2)}M NRC</span>
               </div>
           </div>
      </div>

      {/* --- SECTION 2: DYNAMIC CHART --- */}
      <div className="glass-card rounded-2xl p-0 overflow-hidden relative border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] bg-[#080808]">
           
           {/* Chart Header & Controls */}
           <div className="flex flex-col gap-4 p-4 pb-2 relative z-10">
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${chartMode === 'ACTIVITY' ? 'bg-neuro-violet/10 border-neuro-violet/30 text-neuro-cyan' : (trend === 'up' ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500')}`}>
                            {chartMode === 'ACTIVITY' 
                                ? <Activity size={20} /> 
                                : (trend === 'up' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>)
                            }
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-0.5">
                                {chartMode === 'ACTIVITY' ? t('invest.networkActivity') : t('invest.marketPrice')}
                            </div>
                            <div className={`text-lg font-mono font-bold leading-none ${chartMode === 'MARKET' ? (trend === 'up' ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
                                {chartMode === 'ACTIVITY' 
                                    ? formatHashrate(playerState.autoMineRate) 
                                    : `${(globalStats.currentPrice || 0).toFixed(8)} TON`
                                }
                            </div>
                        </div>
                   </div>

                   <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setChartMode('ACTIVITY')}
                            className={`p-1.5 rounded-md transition-all ${chartMode === 'ACTIVITY' ? 'bg-neuro-violet text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Activity size={16} />
                        </button>
                        <button
                            onClick={() => setChartMode('MARKET')}
                            className={`p-1.5 rounded-md transition-all ${chartMode === 'MARKET' ? (trend === 'up' ? 'bg-green-500 text-black shadow-lg' : 'bg-red-500 text-white shadow-lg') : 'text-slate-500 hover:text-white'}`}
                        >
                            <BarChart2 size={16} />
                        </button>
                   </div>
               </div>

               <div className="flex items-center justify-between border-t border-white/5 pt-3">
                   <span className="text-[10px] text-slate-500 font-bold uppercase">{t('invest.timeframe')}</span>
                   <div className="flex gap-2">
                        {(['1H', '24H', '7D'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`
                                    px-3 py-1 text-[10px] font-bold rounded-md transition-all border
                                    ${timeRange === range 
                                        ? (chartMode === 'ACTIVITY' ? 'bg-neuro-cyan/20 border-neuro-cyan text-neuro-cyan' : (trend === 'up' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-red-500/20 border-red-500 text-red-400'))
                                        : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400'}
                                `}
                            >
                                {range}
                            </button>
                        ))}
                   </div>
               </div>
           </div>
           
           {/* Main Chart Area */}
           <div className="h-64 w-full -ml-2 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    {chartMode === 'ACTIVITY' ? (
                        <AreaChart data={activityData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="neonGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.4}/>
                                    <stop offset="50%" stopColor="#8D73FF" stopOpacity={0.1}/>
                                    <stop offset="100%" stopColor="#8D73FF" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                            <XAxis 
                                dataKey="time" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'Rajdhani' }} 
                                interval="preserveStartEnd"
                                padding={{ left: 20, right: 20 }}
                            />
                            <YAxis hide domain={[0, 'auto']} />
                            <Tooltip content={<CustomTooltip mode="ACTIVITY" />} cursor={{ stroke: '#00F0FF', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Area 
                                type="monotone" 
                                dataKey="rate" 
                                stroke="#00F0FF" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#neonGradient)" 
                                animationDuration={1000}
                            />
                        </AreaChart>
                    ) : (
                        <ComposedChart data={priceData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00ff41" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#00ff41" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ff3b30" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#ff3b30" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                            <XAxis 
                                dataKey="time" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'Rajdhani' }} 
                                interval="preserveStartEnd"
                                padding={{ left: 20, right: 20 }}
                            />
                            {/* YAxis domain adjusted to zoom in on price action */}
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip mode="MARKET" />} cursor={{ stroke: '#ffffff', strokeWidth: 1 }} />
                            
                            {/* Current Price Line */}
                            <ReferenceLine 
                                y={priceData[priceData.length - 1]?.price} 
                                stroke={chartColor} 
                                strokeDasharray="3 3" 
                                strokeOpacity={0.5} 
                            />

                            <Area 
                                type="monotone" 
                                dataKey="price" 
                                stroke={chartColor} 
                                strokeWidth={2} 
                                fillOpacity={1} 
                                fill={`url(#${gradientId})`}
                                animationDuration={1000}
                                dot={<PulsingDot stroke={chartColor} data={priceData} />}
                            />
                        </ComposedChart>
                    )}
                </ResponsiveContainer>
           </div>
      </div>

      {/* --- SECTION 2.5: BLOCKCHAIN STATS GRID --- */}
      <div className="grid grid-cols-2 gap-3">
          {/* Card 1: Block Reward */}
          <div className="glass-card rounded-xl p-3 flex flex-col justify-between border border-neuro-gold/30 bg-neuro-gold/5 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-neuro-gold mb-1 relative z-10">
                  <Zap size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('invest.rewardPerBlock')}</span>
              </div>
              <div className="text-xl font-mono font-bold text-white relative z-10 flex flex-col">
                  <span>{currentBlockReward} <span className="text-sm font-sans">NRC</span></span>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap size={48} />
              </div>
          </div>

          {/* Card 2: HALVING STATUS (Simple Count) */}
          <div className="glass-card rounded-xl p-3 flex flex-col justify-between border border-neuro-pink/30 bg-neuro-pink/5 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-neuro-pink mb-1 relative z-10">
                  <Hourglass size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('invest.blocksLeft')}</span>
              </div>
              <div className="text-xl font-mono font-bold text-white relative z-10 flex items-center gap-2">
                  {blocksToHalving.toLocaleString()} <span className="text-sm font-sans font-bold text-neuro-pink/80">{t('invest.blocks')}</span>
              </div>
              
              <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Hourglass size={48} />
              </div>
          </div>

          {/* Card 3: Network Height */}
          <div className="glass-card rounded-xl p-3 flex flex-col justify-between border border-neuro-violet/30 bg-neuro-violet/5 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-neuro-violet mb-1 relative z-10">
                  <Box size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('invest.stat_height')}</span>
              </div>
              <div className="text-xl font-mono font-bold text-white relative z-10">#{currentBlockHeight.toLocaleString()}</div>
              <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Box size={48} />
              </div>
          </div>

          {/* Card 4: Block Difficulty */}
          <div className="glass-card rounded-xl p-3 flex flex-col justify-between border border-white/20 bg-white/5 relative overflow-hidden group">
              <div className="flex items-center gap-2 text-slate-300 mb-1 relative z-10">
                  <Cpu size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('invest.stat_diff')}</span>
              </div>
              <div className="text-lg font-mono font-bold text-white relative z-10 truncate">{formatHashValue(globalStats.currentDifficulty)}</div>
              <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Cpu size={48} />
              </div>
          </div>
      </div>

      {/* --- SECTION 3: TOP MINERS (SOLO) --- */}
      <div>
         <div className="flex items-center gap-2 mb-3 px-1">
            <Trophy className="text-neuro-gold" size={18} />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('invest.topMiners')}</h3>
         </div>
         
         {/* The Player Row (Rank 1) */}
         <div className="glass-card rounded-xl border border-neuro-gold/50 bg-neuro-gold/5 relative overflow-hidden">
             <div className="absolute left-0 top-0 bottom-0 w-1 bg-neuro-gold shadow-[0_0_10px_#FFB800]"></div>
             
             <div className="grid grid-cols-12 gap-2 p-4 items-center">
                 <div className="col-span-2">
                     <div className="w-6 h-6 rounded-full bg-neuro-gold flex items-center justify-center text-black font-bold font-mono text-xs shadow-[0_0_10px_#FFB800]">
                         1
                     </div>
                 </div>
                 <div className="col-span-6 flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-black border border-neuro-gold/30 overflow-hidden shrink-0">
                         {user?.photo_url ? (
                             <img src={user.photo_url} alt="User" className="w-full h-full object-cover" />
                         ) : (
                             <div className="w-full h-full flex items-center justify-center bg-neuro-gold/20">
                                 <UserCircle2 size={16} className="text-neuro-gold" />
                             </div>
                         )}
                     </div>
                     <div className="flex flex-col">
                         <span className="text-xs font-bold text-white leading-none mb-0.5 truncate max-w-[100px] flex items-center gap-1">
                             {user?.first_name || 'Pilot'} {t('invest.you')}
                             {highestBadge && (
                                <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 border border-white/20">
                                    {headerIconMap[highestBadge.icon]}
                                </div>
                             )}
                         </span>
                         <span className="text-[9px] text-neuro-gold flex items-center gap-1">
                             <ShieldCheck size={10} /> {t('invest.nodeActive')}
                         </span>
                     </div>
                 </div>
                 <div className="col-span-4 text-right">
                     <div className="text-sm font-mono font-bold text-white leading-none">
                         {Math.floor(playerState.balance).toLocaleString()}
                     </div>
                     <div className="text-[9px] text-slate-400 font-bold mt-0.5">NRC</div>
                 </div>
             </div>
         </div>
      </div>

    </div>
  );
};

export default Investments;