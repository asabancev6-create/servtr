import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, TooltipProps } from 'recharts';
import { MAX_SUPPLY } from '../constants';
import { GlobalStats, PlayerState } from '../types';
import { Globe, TrendingUp, Users } from 'lucide-react';

interface StatsProps {
  playerState: PlayerState;
  globalStats: GlobalStats;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-neuro-primary/50 p-2 rounded shadow-lg">
        <p className="text-neuro-primary font-mono text-xs">{`${label}`}</p>
        <p className="text-white font-bold text-sm">Rate: {payload[0].value} NRC/s</p>
      </div>
    );
  }
  return null;
};

const Stats: React.FC<StatsProps> = ({ playerState, globalStats }) => {
  
  // Data for Pie Chart (Supply)
  const pieData = useMemo(() => {
    const remaining = MAX_SUPPLY - globalStats.totalMined;
    return [
      { name: 'Mined', value: globalStats.totalMined },
      { name: 'Remaining', value: remaining < 0 ? 0 : remaining },
    ];
  }, [globalStats.totalMined]);

  const COLORS = ['#00F2FF', '#1e293b'];

  // Mock Data for Area Chart (Mining Rate History)
  const chartData = [
    { time: '10:00', rate: 4000 },
    { time: '11:00', rate: 3000 },
    { time: '12:00', rate: 2000 },
    { time: '13:00', rate: 2780 },
    { time: '14:00', rate: 1890 },
    { time: '15:00', rate: 2390 },
    { time: '16:00', rate: 3490 },
  ];

  return (
    <div className="flex flex-col gap-8 animate-fadeIn">
      
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-sans font-bold text-white">Global Network</h2>
        <p className="text-slate-400 text-sm">Real-time analysis of the NeuroCoin blockchain.</p>
      </div>

      {/* Supply Chart Card */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-white flex items-center gap-2"><Globe size={16} className="text-neuro-primary"/> Token Emission</h3>
          <span className="text-xs font-mono text-neuro-primary">{((globalStats.totalMined / MAX_SUPPLY) * 100).toFixed(4)}%</span>
        </div>
        
        <div className="h-48 relative">
           <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-slate-500 font-mono">TOTAL</span>
            <span className="text-xl font-bold text-white font-mono">13M</span>
          </div>
        </div>
        
        <div className="flex justify-between mt-4 px-4">
          <div className="text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Mined</div>
            <div className="text-neuro-primary font-mono font-bold text-sm">
              {(globalStats.totalMined / 1_000_000).toFixed(2)}M
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Remaining</div>
            <div className="text-slate-300 font-mono font-bold text-sm">
              {((MAX_SUPPLY - globalStats.totalMined) / 1_000_000).toFixed(2)}M
            </div>
          </div>
        </div>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1"><Users size={12}/> Active Miners</div>
          <div className="text-white font-mono font-bold text-lg">{globalStats.activeMiners.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3">
          <div className="text-slate-400 text-xs mb-1 flex items-center gap-1"><TrendingUp size={12}/> Market Cap</div>
          <div className="text-neuro-primary font-mono font-bold text-lg">${(globalStats.marketCap / 1_000_000).toFixed(2)}M</div>
        </div>
      </div>

      {/* Network Hashrate Chart */}
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
        <h3 className="font-bold text-white mb-4 text-sm">Global Hashrate (MH/s)</h3>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00F2FF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00F2FF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="rate" 
                stroke="#00F2FF" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRate)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

export default Stats;