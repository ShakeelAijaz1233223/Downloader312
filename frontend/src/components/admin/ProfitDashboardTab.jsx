import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Server,
  Activity,
  Sparkles,
  Calculator,
  Share2,
} from 'lucide-react';

export function ProfitDashboardTab({ overview, recommendations = [], trafficFunnel }) {
  const [dailyVisitors, setDailyVisitors] = useState(10000);
  const [ecpm, setEcpm] = useState(4.5);
  const [monthlyVpsCost, setMonthlyVpsCost] = useState(24);

  const simulatedStats = useMemo(() => {
    const monthlyImpressions = dailyVisitors * 2.4 * 30;
    const grossAdRevenue = Math.round((monthlyImpressions / 1000) * ecpm);
    const netTakeHome = grossAdRevenue - monthlyVpsCost;
    return { monthlyImpressions, grossAdRevenue, netTakeHome };
  }, [dailyVisitors, ecpm, monthlyVpsCost]);

  const totalRevenue = Number(overview?.totalRevenue || 0);
  const totalExpenses = Number(overview?.totalExpenses || 0);
  const netProfit = Number(overview?.netProfit || 0);
  const totalVisits = Number(overview?.totalVisits || 0);
  const totalAnalyses = Number(overview?.totalAnalyses || 0);
  const totalDownloads = Number(overview?.totalDownloads || 0);

  const timelineData = overview?.timelineSeries || [];
  const waterfallData = overview?.waterfallBreakdown || [];
  const hasAdImpressions = waterfallData.some((z) => z.value > 0);
  const channelData = overview?.channelPerformance || [];

  return (
    <div className="space-y-6">
      {/* TOP 4 REAL SQL KPI STAT CARDS (ZERO FAKE NUMBERS!) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Recorded SQL Revenue</span>
            <DollarSign size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Sum of real INCOME entries in Smart Ledger</p>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Recorded Infra Spend</span>
            <Server size={16} className="text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-amber-300 mt-2">
            ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Sum of real EXPENSE entries in Smart Ledger</p>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Net SQL Profit</span>
            <TrendingUp size={16} className="text-sky-400" />
          </div>
          <p className={`text-2xl font-extrabold mt-2 ${netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
            ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {overview?.roas !== null && overview?.roas !== undefined
              ? `Live ROAS: ${overview.roas}x`
              : 'Record entries in Smart Ledger to calculate ROAS'}
          </p>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Live Engine Telemetry</span>
            <Activity size={16} className="text-violet-400" />
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">
            {totalAnalyses} <span className="text-xs font-semibold text-slate-400">extractions</span>
          </p>
          <p className="text-[11px] text-emerald-400 font-semibold mt-1">
            {totalVisits} visits · {totalDownloads} downloads · {overview?.savedVaultCount || 0} Vault
          </p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <h3 className="text-sm font-extrabold text-white">Real SQL Revenue vs. Infra Cost Timeline</h3>
          <p className="text-xs text-slate-400 mb-4">
            Plotted 100% live from real entries stored in SQL <code className="text-sky-300">finance_ledger</code>
          </p>

          {timelineData.length === 0 ? (
            <div className="h-56 rounded-xl border border-dashed border-slate-700 grid place-items-center p-6 text-center">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-bold text-slate-200">
                  $0.00 Recorded in SQL Ledger Yet (Zero Fake Chart Numbers)
                </p>
                <p className="text-xs text-slate-400 max-w-md">
                  Open the <strong className="text-sky-300">Smart Ledger</strong> tab and add real Income or Expense entries to plot your live Revenue vs. Cost graph automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.42} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      background: '#0D1320',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: 10,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fill="url(#revGrad)"
                    name="Recorded Income ($)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fill="url(#costGrad)"
                    name="Recorded Expense ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 rounded-2xl bg-[#0D1320] border border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white">Live 4-Stage Ad Waterfall</h3>
            <p className="text-xs text-slate-400 mb-3">Real SQL tracked ad events</p>

            {hasAdImpressions ? (
              <div className="h-44 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={waterfallData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={44}
                      outerRadius={68}
                      paddingAngle={4}
                    >
                      {waterfallData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-36 rounded-xl border border-dashed border-slate-700 grid place-items-center p-4 text-center text-xs text-slate-400 mb-3">
                0 ad impressions recorded yet. Enable ad zones in Ad Waterfall to start live tracking.
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            {waterfallData.map((z) => (
              <div key={z.name} className="flex items-center justify-between text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                  {z.name}
                </span>
                <strong className="text-white">{z.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* INTERACTIVE YIELD CALCULATOR */}
      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Calculator size={18} className="text-sky-400" />
          <div>
            <h3 className="text-sm font-extrabold text-white">
              Interactive Traffic & Ad Waterfall Yield Calculator
            </h3>
            <p className="text-xs text-slate-400">
              Projection formula based on your target daily visitors, blended eCPM, and VPS bill
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Daily Visitors</span>
              <strong className="text-sky-400">{dailyVisitors.toLocaleString()}/day</strong>
            </div>
            <input
              type="range"
              min="500"
              max="250000"
              step="500"
              value={dailyVisitors}
              onChange={(e) => setDailyVisitors(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Blended eCPM ($)</span>
              <strong className="text-emerald-400">${ecpm.toFixed(2)}</strong>
            </div>
            <input
              type="range"
              min="1.0"
              max="14.0"
              step="0.25"
              value={ecpm}
              onChange={(e) => setEcpm(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300">Monthly VPS Cost</span>
              <strong className="text-amber-300">${monthlyVpsCost}/mo</strong>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="5"
              value={monthlyVpsCost}
              onChange={(e) => setMonthlyVpsCost(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 p-3.5 text-center">
            <p className="text-[11px] font-bold uppercase text-slate-300">Projected Monthly Net</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">
              ${simulatedStats.netTakeHome.toLocaleString()}/mo
            </p>
            <p className="text-[11px] text-slate-400">
              {(simulatedStats.monthlyImpressions / 1000).toFixed(0)}k monthly impressions
            </p>
          </div>
        </div>
      </div>

      {/* REAL SQL ORGANIC TRAFFIC FUNNEL */}
      {trafficFunnel && (
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Share2 size={17} className="text-emerald-400" />
            <div>
              <h3 className="text-sm font-extrabold text-white">Live SQL Traffic Funnel</h3>
              <p className="text-xs text-slate-400">
                Real recorded sessions across Home, <code>/tools/:slug</code>, and <code>/v/:shortCode</code>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#080C15] border border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-400">Total SQL Visits</p>
              <p className="text-xl font-extrabold text-white mt-1">
                {Number(trafficFunnel.totalFreeVisits || 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-[#080C15] border border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-400">SEO Route Hits (/tools/*)</p>
              <p className="text-xl font-extrabold text-sky-400 mt-1">
                {Number(trafficFunnel.seoOrganic || 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-[#080C15] border border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-400">Shared Watch Views (/v/*)</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-1">
                {Number(trafficFunnel.viralWatchShares || 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-[#080C15] border border-slate-800 p-3.5">
              <p className="text-[11px] text-slate-400">Direct App Sessions</p>
              <p className="text-xl font-extrabold text-amber-300 mt-1">
                {Number(trafficFunnel.directBookmarks || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* REAL SQL CHANNEL BREAKDOWN + SYSTEM DIAGNOSTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <h3 className="text-sm font-extrabold text-white mb-3">
            Live SQL Engine Activity Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Module</th>
                  <th className="py-2 px-3">Events</th>
                  <th className="py-2 px-3">Downloads</th>
                  <th className="py-2 pl-3">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {channelData.map((row) => (
                  <tr key={row.channel}>
                    <td className="py-2.5 pr-3 font-bold text-white">{row.channel}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row.events}</td>
                    <td className="py-2.5 px-3 text-slate-300">{row.downloads}</td>
                    <td className="py-2.5 pl-3">
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                        {row.completed}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-400" />
            <h3 className="text-sm font-extrabold text-white">Live System Diagnostics & Health</h3>
          </div>
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="rounded-xl bg-[#080C15] border border-slate-800 p-3.5 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white">{rec.title}</span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 shrink-0">
                  {rec.gainEstimate}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{rec.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
