'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, TrendingUp, Zap, DollarSign, Users, MessageSquare,
  Download, RefreshCw, ChevronDown, ChevronRight, X,
  Loader2, AlertTriangle, Eye, Calendar, Filter
} from 'lucide-react';
import { aiApi } from '@/lib/adminApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v) => `$${(v || 0).toFixed(4)}`;
const fmtK = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v || 0);
const fmtDate = (s) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = '#B76E79' }) {
  return (
    <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#EAE0D5]">{value}</p>
      <p className="text-xs text-[#EAE0D5]/50 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-[#EAE0D5]/30 mt-1">{sub}</p>}
    </div>
  );
}

// ── CSS Bar chart (no external deps) ─────────────────────────────────────────
function BarChart({ data, valueKey = 'cost_usd', labelKey = 'date', color = '#B76E79', title }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-32 text-xs text-[#EAE0D5]/30">No data yet</div>
  );

  // Aggregate by date (multiple models per day → sum)
  const byDate = {};
  data.forEach(d => {
    const key = d[labelKey];
    byDate[key] = (byDate[key] || 0) + (d[valueKey] || 0);
  });
  const entries = Object.entries(byDate);
  const max = Math.max(...entries.map(([, v]) => v), 0.000001);

  return (
    <div>
      {title && <p className="text-xs text-[#EAE0D5]/50 mb-3">{title}</p>}
      <div className="flex items-end gap-1 h-28 overflow-x-auto no-scrollbar">
        {entries.map(([date, val]) => {
          const pct = Math.max((val / max) * 100, 2);
          return (
            <div key={date} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: '28px', flex: 1 }}>
              <div
                className="w-full rounded-t-sm transition-all duration-300 relative group cursor-default"
                style={{ height: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0B0608] border border-[#B76E79]/30 rounded px-2 py-1 text-[10px] text-[#EAE0D5] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  {valueKey === 'cost_usd' ? fmt$(val) : fmtK(Math.round(val))}
                </div>
              </div>
              <p className="text-[9px] text-[#EAE0D5]/25 rotate-45 origin-left whitespace-nowrap">
                {fmtDate(date)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Model pill ────────────────────────────────────────────────────────────────
const MODEL_COLORS = {
  'gemini-2.0-flash-lite': '#22c55e',
  'gemini-2.0-flash': '#3b82f6',
  'gemini-1.5-flash': '#f59e0b',
};

function ModelBadge({ model }) {
  const color = MODEL_COLORS[model] || '#9ca3af';
  const label = model?.replace('gemini-', 'G-') || 'unknown';
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono border"
      style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
      {label}
    </span>
  );
}

// ── Session drawer ────────────────────────────────────────────────────────────
function SessionDrawer({ session, onClose }) {
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi.getSessionMessages(session.session_id)
      .then(r => { setMessages(r.messages); setLoading(false); })
      .catch(() => setLoading(false));
  }, [session.session_id]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full sm:w-[520px] bg-[#0B0608] border-l border-[#B76E79]/20 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#B76E79]/15">
          <div>
            <p className="text-sm font-semibold text-[#F2C29A]">Session Details</p>
            <p className="text-xs text-[#EAE0D5]/40 font-mono mt-0.5">{session.session_id.slice(0, 16)}…</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#EAE0D5]/40 hover:text-[#EAE0D5] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meta */}
        <div className="px-5 py-3 border-b border-[#B76E79]/10 grid grid-cols-3 gap-3">
          {[
            ['Role', session.role],
            ['User', session.email || session.username || 'Guest'],
            ['Messages', session.message_count],
            ['Tokens In', fmtK(session.tokens_in)],
            ['Tokens Out', fmtK(session.tokens_out)],
            ['Cost', fmt$(session.cost_usd)],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] text-[#EAE0D5]/30 uppercase tracking-wider">{k}</p>
              <p className="text-xs text-[#EAE0D5] font-medium capitalize">{v}</p>
            </div>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#B76E79]" />
            </div>
          ) : messages?.length ? messages.map(m => (
            <div key={m.id} className={`rounded-xl p-3 text-xs ${
              m.role === 'user'
                ? 'bg-[#7A2F57]/20 border border-[#B76E79]/20 ml-4'
                : 'bg-[#180F14] border border-[#B76E79]/10'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold capitalize text-[#B76E79]">{m.role}</span>
                <div className="flex items-center gap-2">
                  {m.model && <ModelBadge model={m.model} />}
                  {m.cost_usd > 0 && (
                    <span className="text-[#EAE0D5]/30">{fmt$(m.cost_usd)}</span>
                  )}
                </div>
              </div>
              <p className="text-[#EAE0D5]/70 leading-relaxed line-clamp-4">{m.content || '(empty)'}</p>
              {m.tool_calls && Object.keys(m.tool_calls).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.keys(m.tool_calls).map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 bg-[#B76E79]/10 text-[#B76E79] rounded">
                      🔧 {t}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[#EAE0D5]/20 mt-1.5">
                {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )) : (
            <p className="text-xs text-[#EAE0D5]/30 text-center py-6">No messages found</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AiMonitoringPage() {
  const [data, setData] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setSessionsLoading(true);
    const role = roleFilter === 'all' ? null : roleFilter;
    try {
      const [mon, sess] = await Promise.all([
        aiApi.getMonitoring(days, role),
        aiApi.getSessions(role, days),
      ]);
      setData(mon);
      setSessions(sess?.sessions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setSessionsLoading(false);
    }
  }, [days, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const role = roleFilter === 'all' ? null : roleFilter;
      const res = await aiApi.exportCsv(days, role);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ai_sessions_${days}d.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setExportLoading(false);
  };

  const statColor = { sessions: '#B76E79', messages: '#3b82f6', tokens: '#22c55e', cost: '#f59e0b' };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            AI Monitoring
          </h1>
          <p className="text-sm text-[#EAE0D5]/40 mt-0.5">
            LLM usage, cost tracking, and session analytics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Role filter */}
          <div className="flex bg-[#180F14] border border-[#B76E79]/15 rounded-xl overflow-hidden">
            {['all', 'customer', 'admin'].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  roleFilter === r
                    ? 'bg-[#7A2F57]/50 text-[#F2C29A]'
                    : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Days selector */}
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="px-3 py-1.5 text-xs bg-[#180F14] border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 focus:outline-none cursor-pointer"
          >
            {[7, 14, 30, 60, 90].map(d => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>

          <button
            onClick={load}
            disabled={loading}
            className="p-2 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/50 hover:text-[#EAE0D5] hover:bg-[#B76E79]/10 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-xs text-[#F2C29A] hover:bg-[#7A2F57]/50 transition-colors disabled:opacity-50"
          >
            {exportLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#B76E79]" />
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={MessageSquare} label="Total Sessions" value={data.totals.sessions} sub={`Last ${days} days`} color={statColor.sessions} />
            <StatCard icon={Zap} label="Total Messages" value={fmtK(data.totals.messages)} sub="AI responses" color={statColor.messages} />
            <StatCard icon={TrendingUp} label="Tokens In" value={fmtK(data.totals.tokens_in)} sub="Input tokens" color={statColor.tokens} />
            <StatCard icon={BarChart2} label="Tokens Out" value={fmtK(data.totals.tokens_out)} sub="Output tokens" color="#a855f7" />
            <StatCard icon={DollarSign} label="Total Cost" value={fmt$(data.totals.cost_usd)} sub={`Today: ${fmt$(data.today_cost_usd)}`} color={statColor.cost} />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#B76E79]/15">
            {[
              { id: 'overview', label: 'Charts & Overview' },
              { id: 'models', label: 'By Model' },
              { id: 'users', label: 'Top Users' },
              { id: 'sessions', label: `Sessions (${sessions?.length || 0})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-[#B76E79] text-[#F2C29A]'
                    : 'border-transparent text-[#EAE0D5]/50 hover:text-[#EAE0D5]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Daily cost chart */}
              <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl p-5">
                <p className="text-sm font-semibold text-[#EAE0D5] mb-4">Daily API Cost (USD)</p>
                <BarChart data={data.daily} valueKey="cost_usd" labelKey="date" color="#F2C29A" />
              </div>

              {/* Daily messages chart */}
              <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl p-5">
                <p className="text-sm font-semibold text-[#EAE0D5] mb-4">Daily AI Responses</p>
                <BarChart data={data.daily} valueKey="messages" labelKey="date" color="#B76E79" />
              </div>

              {/* Daily tokens chart */}
              <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl p-5 lg:col-span-2">
                <p className="text-sm font-semibold text-[#EAE0D5] mb-4">Daily Token Usage</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <BarChart data={data.daily} valueKey="tokens_in" labelKey="date" color="#22c55e" title="Input Tokens" />
                  <BarChart data={data.daily} valueKey="tokens_out" labelKey="date" color="#3b82f6" title="Output Tokens" />
                </div>
              </div>
            </div>
          )}

          {tab === 'models' && (
            <div className="space-y-3">
              {data.by_model?.length ? data.by_model.map((m, i) => (
                <div key={i} className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <ModelBadge model={m.model} />
                      <p className="text-xs text-[#EAE0D5]/40 mt-1">{m.sessions} sessions · {m.responses} responses</p>
                    </div>
                    <p className="text-lg font-bold text-[#F2C29A]">{fmt$(m.cost_usd)}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Sessions', val: m.sessions },
                      { label: 'Responses', val: m.responses },
                      { label: 'Tokens In', val: fmtK(m.tokens_in) },
                      { label: 'Tokens Out', val: fmtK(m.tokens_out) },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-[10px] text-[#EAE0D5]/30 uppercase tracking-wider">{label}</p>
                        <p className="text-sm font-semibold text-[#EAE0D5]">{val}</p>
                      </div>
                    ))}
                  </div>
                  {/* Cost bar */}
                  <div className="mt-4">
                    <div className="h-1.5 bg-[#B76E79]/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7A2F57] to-[#B76E79]"
                        style={{ width: `${Math.min((m.cost_usd / (data.totals.cost_usd || 0.001)) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#EAE0D5]/30 mt-1">
                      {((m.cost_usd / (data.totals.cost_usd || 0.001)) * 100).toFixed(1)}% of total cost
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 text-sm text-[#EAE0D5]/30">No model data in this period</div>
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#B76E79]/10">
                    {['#', 'User', 'Role', 'Sessions', 'Cost (USD)'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#EAE0D5]/40 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.top_users?.length ? data.top_users.map((u, i) => (
                    <tr key={i} className="border-b border-[#B76E79]/8 hover:bg-[#B76E79]/5 transition-colors">
                      <td className="px-4 py-3 text-[#EAE0D5]/30 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[#EAE0D5]">{u.email || 'Guest'}</p>
                        <p className="text-[10px] text-[#EAE0D5]/30">{u.username || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          u.role === 'admin' ? 'bg-[#B76E79]/20 text-[#B76E79]' : 'bg-green-500/10 text-green-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#EAE0D5]/70">{u.sessions}</td>
                      <td className="px-4 py-3 text-xs font-mono text-[#F2C29A]">{fmt$(u.cost_usd)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-xs text-[#EAE0D5]/30">
                        No user data in this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'sessions' && (
            <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl overflow-hidden">
              {sessionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[#B76E79]" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-[#B76E79]/10">
                        {['Session ID', 'Role', 'User', 'Msgs', 'Tokens', 'Cost', 'Last Active', ''].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#EAE0D5]/40 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessions?.length ? sessions.map((s, i) => (
                        <tr key={i} className="border-b border-[#B76E79]/8 hover:bg-[#B76E79]/5 transition-colors">
                          <td className="px-4 py-3 font-mono text-[10px] text-[#EAE0D5]/40">
                            {s.session_id.slice(0, 12)}…
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              s.role === 'admin' ? 'bg-[#B76E79]/20 text-[#B76E79]' : 'bg-green-500/10 text-green-400'
                            }`}>
                              {s.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#EAE0D5]/60">{s.email || 'Guest'}</td>
                          <td className="px-4 py-3 text-xs text-[#EAE0D5]/70">{s.messages}</td>
                          <td className="px-4 py-3 text-xs text-[#EAE0D5]/50">
                            {fmtK(s.tokens_in)}↑ {fmtK(s.tokens_out)}↓
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-[#F2C29A]">
                            {fmt$(s.cost_usd)}
                          </td>
                          <td className="px-4 py-3 text-[10px] text-[#EAE0D5]/30">
                            {new Date(s.last_activity).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedSession(s)}
                              className="p-1.5 text-[#EAE0D5]/30 hover:text-[#B76E79] transition-colors"
                              title="View messages"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={8} className="text-center py-10 text-xs text-[#EAE0D5]/30">
                            No sessions in this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertTriangle className="w-8 h-8 text-[#B76E79]/40" />
          <p className="text-sm text-[#EAE0D5]/40">Failed to load monitoring data</p>
          <button onClick={load} className="text-xs text-[#B76E79] hover:underline">Retry</button>
        </div>
      )}

      {/* Session detail drawer */}
      {selectedSession && (
        <SessionDrawer session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </div>
  );
}
