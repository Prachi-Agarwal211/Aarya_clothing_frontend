'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Send, Sparkles, Loader2, RefreshCw, Paperclip,
  X, TrendingUp, Package, Users, ShoppingCart,
  BarChart2, AlertTriangle, ChevronRight, Copy, Check,
  Image as ImageIcon, DollarSign, LayoutDashboard, ShieldAlert, CheckCircle2,
  XCircle, Zap, Brain, Gauge, Clock, CreditCard, Settings, Activity
} from 'lucide-react';
import { aiApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

// ── Quick action prompts for admin ───────────────────────────────────────────
const QUICK_PROMPTS = [
  { Icon: TrendingUp,      label: 'Revenue today',     prompt: 'Show me revenue and order summary for today' },
  { Icon: Package,         label: 'Orders to ship',    prompt: 'How many confirmed orders are awaiting shipment?' },
  { Icon: AlertTriangle,   label: 'Low stock',         prompt: 'Show me all low stock and out-of-stock items' },
  { Icon: Users,           label: 'Customer stats',    prompt: 'Give me customer statistics for this month' },
  { Icon: ShieldAlert,     label: 'Ship order',        prompt: 'I want to ship order #' },
  { Icon: DollarSign,      label: 'Update price',      prompt: 'Update the price of product #' },
  { Icon: ShoppingCart,    label: 'Adjust stock',      prompt: 'Adjust stock for SKU ' },
  { Icon: BarChart2,       label: 'Top products',      prompt: 'What are the top selling products this month?' },
  { Icon: DollarSign,      label: 'AI costs',          prompt: 'Show me AI usage and cost summary for this month' },
];

// ── Markdown renderer for admin responses ───────────────────────────────────
function AdminMarkdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return (
          <p key={i} className="font-bold text-[#F2C29A] text-base mt-2">{line.slice(3)}</p>
        );
        if (line.startsWith('# ')) return (
          <p key={i} className="font-bold text-[#F2C29A] text-lg mt-2">{line.slice(2)}</p>
        );
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[#B76E79] mt-1 flex-shrink-0">·</span>
            <span className="text-[#EAE0D5]/90">{renderInline(line.slice(2))}</span>
          </div>
        );
        if (/^\d+\./.test(line)) return (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[#B76E79] font-semibold flex-shrink-0 min-w-[16px]">{line.match(/^\d+/)[0]}.</span>
            <span className="text-[#EAE0D5]/90">{renderInline(line.replace(/^\d+\.\s*/, ''))}</span>
          </div>
        );
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-[#EAE0D5]/90">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|₹[\d,]+)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={i} className="text-[#F2C29A] font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`'))
      return <code key={i} className="bg-[#0B0608] px-1.5 py-0.5 rounded text-xs font-mono text-[#B76E79]">{p.slice(1, -1)}</code>;
    if (p.startsWith('₹'))
      return <span key={i} className="text-green-400 font-semibold">{p}</span>;
    return p;
  });
}

// ── Tool call badges with better visualization ─────────────────────────────────
function ToolBadges({ toolCalls }) {
  if (!toolCalls?.length) return null;
  const labels = {
    get_orders: 'Orders', get_order_details: 'Order Detail',
    get_revenue_summary: 'Revenue', get_inventory_alerts: 'Inventory',
    get_customer_stats: 'Customers', search_orders: 'Search',
    get_ai_cost_summary: 'AI Costs', get_products: 'Products',
    update_order_status: 'Update Order', create_shipment: 'Ship Order',
    adjust_inventory: 'Adjust Stock', update_price: 'Update Price',
  };
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {toolCalls.map((t, i) => (
        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-[#7A2F57]/20 border border-[#B76E79]/20 rounded-full text-xs text-[#B76E79]">
          <Zap className="w-2.5 h-2.5" />
          {labels[t] || t}
        </span>
      ))}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="p-1 text-[#EAE0D5]/30 hover:text-[#EAE0D5]/70 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Pending Action Confirmation Modal ─────────────────────────────────────────
const ACTION_LABELS = {
  ship_order: 'Ship Order',
  update_product_price: 'Update Price',
  bulk_update_category_prices: 'Bulk Price Update',
  adjust_stock: 'Adjust Stock',
  create_product_draft: 'Create Product Draft',
};

function ConfirmActionModal({ actions, onConfirm, onDismiss, confirming }) {
  if (!actions?.length) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-[#0B0608] border border-[#B76E79]/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#B76E79]/15 bg-amber-500/5">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-300">Confirm Pending Actions</p>
            <p className="text-xs text-[#EAE0D5]/40 mt-0.5">Review carefully before approving. These changes cannot be easily undone.</p>
          </div>
        </div>

        {/* Actions list */}
        <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
          {actions.map((action, i) => (
            <div key={i} className="p-3 bg-[#180F14] border border-[#B76E79]/20 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#F2C29A] uppercase tracking-wider">
                  {ACTION_LABELS[action.type] || action.type}
                </span>
                <span className="text-[10px] text-[#EAE0D5]/30 font-mono">{i + 1} of {actions.length}</span>
              </div>
              <p className="text-sm text-[#EAE0D5]/80">{action.description}</p>
              {action.warning && (
                <div className="flex items-start gap-1.5 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400">{action.warning}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-[#B76E79]/10">
          <button
            onClick={onDismiss}
            disabled={confirming}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#180F14] border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5]/60 hover:text-[#EAE0D5] hover:border-[#B76E79]/40 transition-all disabled:opacity-40"
          >
            <XCircle className="w-4 h-4" /> Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-br from-amber-600 to-amber-500 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-amber-500/20"
          >
            {confirming
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Executing...</>
              : <><CheckCircle2 className="w-4 h-4" /> Confirm & Execute</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Enhanced Analytics Panel ─────────────────────────────────────────────────
function AiAnalyticsPanel({ onClose, isSuperAdmin = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const result = await aiApi.getAnalytics(parseInt(timeRange));
      setData(result);
    } catch (err) {
      logger.error('AI analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate tool usage percentage
  const getToolUsagePercent = (role) => {
    const roleData = data?.by_role?.find(r => r.role === role);
    if (!roleData) return 0;
    const totalOps = (roleData.tool_calls || 0) + (roleData.tokens_in || 0);
    if (totalOps === 0) return 0;
    return Math.round((roleData.tool_calls || 0) / totalOps * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-2xl my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            AI Usage & Cost Analytics
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-[#EAE0D5]/50 hover:text-[#EAE0D5]" /></button>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          {['7', '30', '90'].map(days => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                timeRange === days 
                  ? 'bg-[#B76E79] text-white' 
                  : 'bg-[#180F14] text-[#EAE0D5]/60 hover:text-[#EAE0D5]'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#B76E79]" /></div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-[#F2C29A]/5 border border-[#F2C29A]/20 rounded-xl text-center">
                <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-widest">Total Cost</p>
                <p className="text-xl font-bold text-[#F2C29A]">${(data.total_cost_usd || 0).toFixed(4)}</p>
              </div>
              <div className="p-3 bg-[#7A2F57]/20 border border-[#B76E79]/20 rounded-xl text-center">
                <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-widest">Sessions</p>
                <p className="text-xl font-bold text-[#EAE0D5]">{data.total_sessions || 0}</p>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-widest">Messages</p>
                <p className="text-xl font-bold text-blue-400">{data.total_messages || 0}</p>
              </div>
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                <p className="text-xs text-[#EAE0D5]/50 uppercase tracking-widest">Tool Calls</p>
                <p className="text-xl font-bold text-green-400">{data.total_tool_calls || 0}</p>
              </div>
            </div>

            {/* Role-based breakdown */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[#EAE0D5] flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#B76E79]" />
                Usage by Role
              </h4>
              
              {data.by_role?.map((r, i) => (
                <div key={i} className="p-4 bg-[#180F14] border border-[#B76E79]/15 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#EAE0D5] capitalize">{r.role} AI</span>
                      {r.role === 'customer' && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded-full">
                          Rate Limited
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[#EAE0D5]/50">
                        <Gauge className="w-3 h-3 inline mr-1" />
                        {getToolUsagePercent(r.role)}% tools
                      </span>
                      <span className="text-green-400 font-medium">${(r.cost_usd || 0).toFixed(4)}</span>
                    </div>
                  </div>
                  
                  {/* Tool vs Token Usage Bar */}
                  <div className="mb-3">
                    <div className="flex h-2 rounded-full overflow-hidden bg-[#0B0608]">
                      <div 
                        className="bg-green-500" 
                        style={{ width: `${getToolUsagePercent(r.role)}%` }}
                        title="Tool calls (low cost)"
                      />
                      <div 
                        className="bg-[#B76E79]" 
                        style={{ width: `${100 - getToolUsagePercent(r.role)}%` }}
                        title="Token usage (higher cost)"
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-[#EAE0D5]/40">
                      <span className="flex items-center gap-1">
                        <Zap className="w-2 h-2" /> Tools: {r.tool_calls || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Brain className="w-2 h-2" /> Tokens: {(r.tokens_in || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-[#EAE0D5]/60">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-[#EAE0D5]/40" />
                      <span>{r.sessions} sessions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3 text-[#EAE0D5]/40" />
                      <span>{r.messages} msgs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-[#EAE0D5]/40" />
                      <span>{(r.tokens_in || 0).toLocaleString()} in</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-[#EAE0D5]/40" />
                      <span>{(r.tokens_out || 0).toLocaleString()} out</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Provider Info */}
            <div className="p-4 bg-[#180F14] border border-[#B76E79]/15 rounded-xl">
              <h4 className="text-sm font-semibold text-[#EAE0D5] mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#B76E79]" />
                Active AI Providers
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2 bg-[#0B0608] rounded-lg">
                  <span className="text-xs text-[#EAE0D5]">Gemini Flash</span>
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="flex items-center justify-between p-2 bg-[#0B0608] rounded-lg">
                  <span className="text-xs text-[#EAE0D5]">OpenRouter</span>
                  <span className="w-2 h-2 rounded-full bg-[#EAE0D5]/30" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#EAE0D5]/50 text-center py-6">No data available yet.</p>
        )}
      </div>
    </div>
  );
}

// Simple MessageCircle icon fallback
function MessageCircle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const WELCOME = {
  id: 'welcome', role: 'assistant',
  text: "Hello! I'm **Aria**, your Aarya Clothing AI assistant.\n\nI can help you with **orders**, **inventory**, **analytics**, **customer insights**, and more. Just ask me anything — or use a quick action below.\n\n💡 **Tip:** I use tools to get real data, which keeps costs low!",
  toolCalls: [], timestamp: new Date(),
};

export default function AdminAiAssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [images, setImages] = useState([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [error, setError] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearSession = () => {
    setMessages([WELCOME]);
    setSessionId(null);
    setImages([]);
    setError(null);
  };

  const handleImageAttach = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1];
        setImages(prev => [...prev.slice(-2), {
          preview: ev.target.result,
          mime_type: file.type,
          data: base64,
          name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setError(null);
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }

    const userMsg = {
      id: Date.now(), role: 'user', text: msg,
      imagesPreviews: images.map(i => i.preview),
      timestamp: new Date(),
    };
    const sentImages = [...images];
    setImages([]);
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const imagePayload = sentImages.length
        ? sentImages.map(i => ({ mime_type: i.mime_type, data: i.data }))
        : undefined;

      const res = await aiApi.adminChat(msg, sessionId, imagePayload);

      if (res.session_id) setSessionId(res.session_id);

      if (res.pending_actions?.length) {
        setPendingActions(res.pending_actions);
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        text: res.reply || '(no response)',
        toolCalls: res.tool_calls || [],
        pendingActions: res.pending_actions || [],
        tokenCost: res.cost_usd,
        provider: res.provider,
        timestamp: new Date(),
      }]);
    } catch (err) {
      logger.error('Admin AI error:', err);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        text: 'Something went wrong. Please try again in a moment.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sessionId, loading, images]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleConfirmActions = async () => {
    if (!pendingActions.length) return;
    setConfirming(true);
    setActionResult(null);
    const results = [];
    for (const action of pendingActions) {
      try {
        const res = await aiApi.executeAction(action.type, action.params);
        results.push({ success: true, message: res.message });
      } catch (e) {
        results.push({ success: false, message: e.detail || e.message || 'Action failed' });
      }
    }
    setPendingActions([]);
    setConfirming(false);
    const allOk = results.every(r => r.success);
    setActionResult({ success: allOk, message: results.map(r => r.message).join(' | ') });
    setMessages(prev => [...prev, {
      id: Date.now(), role: 'assistant',
      text: results.map(r => (r.success ? `✓ ${r.message}` : `✗ ${r.message}`)).join('\n'),
      toolCalls: [], pendingActions: [], timestamp: new Date(),
    }]);
    setTimeout(() => setActionResult(null), 5000);
    setShowConfirmModal(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#B76E79]/15 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center shadow-lg shadow-[#B76E79]/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Aria AI Assistant</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs text-[#EAE0D5]/40">Agentic · Tool-powered · Gemini Flash</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/dashboard')}
            title="Switch to Dashboard"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#EAE0D5]/50 border border-[#B76E79]/20 rounded-xl hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]/80 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </button>
          <button
            onClick={() => setShowAnalytics(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#EAE0D5]/60 border border-[#B76E79]/20 rounded-xl hover:bg-[#B76E79]/10 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Analytics</span>
          </button>
          <button
            onClick={clearSession}
            className="p-2 text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70 border border-[#B76E79]/20 rounded-xl hover:bg-[#B76E79]/10 transition-colors"
            title="New conversation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick prompts bar */}
      <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 py-3 border-b border-[#B76E79]/10 flex-shrink-0 no-scrollbar">
        {QUICK_PROMPTS.map(({ Icon, label, prompt: qpPrompt }) => (
          <button
            key={label}
            onClick={() => sendMessage(qpPrompt)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#180F14] border border-[#B76E79]/20 rounded-full text-xs text-[#EAE0D5]/60 hover:text-[#F2C29A] hover:border-[#B76E79]/40 whitespace-nowrap transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Action result toast */}
      {actionResult && (
        <div className={`mx-4 sm:mx-6 mt-3 flex items-center gap-2 p-3 rounded-xl border ${
          actionResult.success
            ? 'bg-green-500/10 border-green-500/20'
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          {actionResult.success
            ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          <p className={`text-xs flex-1 ${actionResult.success ? 'text-green-400' : 'text-red-400'}`}>
            {actionResult.message}
          </p>
          <button onClick={() => setActionResult(null)}>
            <X className={`w-4 h-4 ${actionResult.success ? 'text-green-400' : 'text-red-400'}`} />
          </button>
        </div>
      )}

      {/* Pending actions banner */}
      {pendingActions.length > 0 && !confirming && (
        <div className="mx-4 sm:mx-6 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-bold text-amber-300">{pendingActions.length} action{pendingActions.length > 1 ? 's' : ''} awaiting your approval</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingActions([])}
                className="text-xs text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70 transition-colors px-2"
              >Dismiss</button>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1 rounded-lg transition-colors"
              >Review & Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}

            <div className={`flex flex-col min-w-0 ${msg.role === 'user' ? 'items-end max-w-[75%] sm:max-w-[65%]' : 'items-start max-w-[85%] sm:max-w-[80%]'}`}>
              {/* Attached images */}
              {msg.imagesPreviews?.length > 0 && (
                <div className="flex gap-2 mb-2 justify-end">
                  {msg.imagesPreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 flex-shrink-0">
                      <Image
                        src={src}
                        alt={`Attached image ${i + 1}`}
                        fill
                        className="rounded-xl object-cover border border-[#B76E79]/20"
                        sizes="80px"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className={`rounded-2xl w-full ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-[#7A2F57] to-[#B76E79] text-white px-4 py-3 rounded-tr-sm shadow-md'
                  : 'bg-[#0B0608]/60 border border-[#B76E79]/15 px-4 py-3 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[10px] text-[#EAE0D5]/30">Aria</span>
                    <CopyButton text={msg.text} />
                  </div>
                )}
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <AdminMarkdown text={msg.text} />
                )}
                
                {/* Tool calls */}
                <ToolBadges toolCalls={msg.toolCalls} />
                
                {/* Cost indicator */}
                {msg.tokenCost !== undefined && (
                  <div className="mt-2 pt-2 border-t border-[#B76E79]/10 flex items-center justify-between">
                    <span className="text-[10px] text-[#EAE0D5]/30">
                      {msg.provider || 'Gemini Flash'}
                    </span>
                    <span className="text-[10px] text-green-400/70">
                      ${msg.tokenCost.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
              
              <span className="text-[10px] text-[#EAE0D5]/20 mt-1">
                {msg.timestamp?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-[#0B0608]/60 border border-[#B76E79]/15 px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-[#B76E79] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#B76E79] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#B76E79] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 sm:px-6 py-4 border-t border-[#B76E79]/15 bg-[#0B0608]/40">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your store..."
              rows={1}
              className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 resize-none pr-12"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageAttach}
            />
          </div>
          
          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70 transition-colors"
            title="Attach image"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-3 bg-gradient-to-br from-[#7A2F57] to-[#B76E79] rounded-xl text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        
        {/* Attached images preview */}
        {images.length > 0 && (
          <div className="flex gap-2 mt-3">
            {images.map((img, i) => (
              <div key={i} className="relative w-16 h-16">
                <Image
                  src={img.preview}
                  alt={img.name}
                  fill
                  className="rounded-lg object-cover"
                  sizes="64px"
                />
                <button
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfirmActionModal
        actions={pendingActions}
        onConfirm={handleConfirmActions}
        onDismiss={() => setShowConfirmModal(false)}
        confirming={confirming}
      />
      <AiAnalyticsPanel onClose={() => setShowAnalytics(false)} />
    </div>
  );
}
