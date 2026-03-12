'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Cpu, DollarSign, Globe, Save, RefreshCw,
  Loader2, CheckCircle, AlertTriangle, Eye, EyeOff,
  Zap, TestTube, Info, ToggleLeft, ToggleRight, Shield
} from 'lucide-react';
import { aiSettingsApi } from '@/lib/adminApi';

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#B76E79]/10 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#7A2F57]/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#B76E79]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#EAE0D5]">{title}</p>
          {description && <p className="text-xs text-[#EAE0D5]/40 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ label, description, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="sm:w-64 flex-shrink-0">
        <p className="text-sm font-medium text-[#EAE0D5]/80">{label}</p>
        {description && <p className="text-xs text-[#EAE0D5]/35 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── Model selector ────────────────────────────────────────────────────────────
const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', cost: '$0.075/1M in · $0.30/1M out', badge: 'Cheapest' },
  { value: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash',      cost: '$0.10/1M in · $0.40/1M out',  badge: 'Recommended' },
  { value: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash',      cost: '$0.075/1M in · $0.30/1M out', badge: '' },
  { value: 'gemini-1.5-pro',        label: 'Gemini 1.5 Pro',        cost: '$1.25/1M in · $5.00/1M out',  badge: 'Expensive' },
];

function ModelSelect({ value, onChange }) {
  return (
    <div className="space-y-2">
      {GEMINI_MODELS.map(m => (
        <label
          key={m.value}
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            value === m.value
              ? 'border-[#B76E79]/50 bg-[#7A2F57]/15'
              : 'border-[#B76E79]/15 hover:border-[#B76E79]/30 bg-[#0B0608]/50'
          }`}
        >
          <input type="radio" className="hidden" checked={value === m.value} onChange={() => onChange(m.value)} />
          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            value === m.value ? 'border-[#B76E79]' : 'border-[#B76E79]/30'
          }`}>
            {value === m.value && <div className="w-2 h-2 rounded-full bg-[#B76E79]" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-[#EAE0D5] font-medium">{m.label}</p>
              {m.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  m.badge === 'Cheapest' ? 'bg-green-500/15 text-green-400' :
                  m.badge === 'Recommended' ? 'bg-blue-500/15 text-blue-400' :
                  m.badge === 'Expensive' ? 'bg-red-500/15 text-red-400' : ''
                }`}>{m.badge}</span>
              )}
            </div>
            <p className="text-xs text-[#EAE0D5]/35 mt-0.5 font-mono">{m.cost}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }) {
  const on = value === 'true' || value === true;
  return (
    <button
      onClick={() => onChange(on ? 'false' : 'true')}
      className="flex items-center gap-2 group"
    >
      {on
        ? <ToggleRight className="w-8 h-8 text-[#B76E79]" />
        : <ToggleLeft className="w-8 h-8 text-[#EAE0D5]/30" />
      }
      {label && <span className="text-sm text-[#EAE0D5]/70 group-hover:text-[#EAE0D5] transition-colors">{label}</span>}
    </button>
  );
}

// ── Number input ──────────────────────────────────────────────────────────────
function NumberInput({ value, onChange, min, max, unit }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        className="w-28 px-3 py-2 bg-[#0B0608] border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 transition-colors"
      />
      {unit && <span className="text-xs text-[#EAE0D5]/40">{unit}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AiSettingsPage() {
  const [allSettings, setAllSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiSettingsApi.getAll();
      const map = {};
      (res.settings || []).forEach(s => { map[s.key] = s; });
      setAllSettings(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getVal = (key, def = '') => allSettings[key]?.value ?? def;
  const setVal = (key, value) => {
    setAllSettings(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), key, value },
    }));
  };

  const SECRET_KEYS = new Set(['GEMINI_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_API_KEY']);

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      // Bulk save non-secret settings
      const settings = {};
      Object.values(allSettings).forEach(s => {
        if (!SECRET_KEYS.has(s.key)) settings[s.key] = s.value;
      });
      await aiSettingsApi.bulkUpdate(settings);

      // Save any non-empty provider API keys individually
      const keyPromises = [];
      for (const k of ['OPENAI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_API_KEY']) {
        const v = getVal(k, '');
        if (v && !v.startsWith('*')) {
          keyPromises.push(aiSettingsApi.update(k, v));
        }
      }
      await Promise.all(keyPromises);

      setSaveResult({ ok: true, msg: 'Settings saved successfully' });
      setTimeout(() => setSaveResult(null), 3000);
    } catch (e) {
      setSaveResult({ ok: false, msg: e.message || 'Failed to save' });
    }
    setSaving(false);
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSaving(true);
    try {
      await aiSettingsApi.update('GEMINI_API_KEY', apiKeyInput.trim());
      setApiKeyInput('');
      setSaveResult({ ok: true, msg: 'API key saved' });
      setTimeout(() => setSaveResult(null), 3000);
    } catch (e) {
      setSaveResult({ ok: false, msg: e.message || 'Failed to save key' });
    }
    setSaving(false);
  };

  const handleTestKey = async () => {
    const key = apiKeyInput.trim() || null;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await aiSettingsApi.testKey(key || '__current__');
      setTestResult(res);
    } catch (e) {
      setTestResult({ valid: false, error: e.message });
    }
    setTestLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-7 h-7 animate-spin text-[#B76E79]" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            AI Configuration
          </h1>
          <p className="text-sm text-[#EAE0D5]/40 mt-0.5">
            API keys, model selection, cost limits, and language settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/40 hover:text-[#EAE0D5] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[#7A2F57] to-[#B76E79] rounded-xl text-sm text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </button>
        </div>
      </div>

      {/* Save result toast */}
      {saveResult && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          saveResult.ok
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {saveResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {saveResult.msg}
        </div>
      )}

      {/* ── API Keys ── */}
      <Section icon={Key} title="API Keys" description="Configure your Gemini API key for AI features">
        <FieldRow
          label="Gemini API Key"
          description="Get your free key at aistudio.google.com. Required for all AI features."
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-[#0B0608] border border-[#B76E79]/20 rounded-xl focus-within:border-[#B76E79]/50 transition-colors">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder={allSettings['GEMINI_API_KEY']?.raw_set ? '••••••••••••••••••••••' : 'AIza...'}
                  className="flex-1 bg-transparent text-sm text-[#EAE0D5] placeholder-[#EAE0D5]/30 focus:outline-none font-mono"
                />
                <button onClick={() => setShowKey(v => !v)} className="text-[#EAE0D5]/30 hover:text-[#EAE0D5]/70 transition-colors">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleTestKey}
                disabled={testLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#B76E79]/25 rounded-xl text-xs text-[#EAE0D5]/60 hover:text-[#EAE0D5] hover:border-[#B76E79]/50 transition-colors disabled:opacity-50"
              >
                {testLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
                Test Key
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim() || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-xs text-[#F2C29A] hover:bg-[#7A2F57]/50 transition-colors disabled:opacity-50"
              >
                <Save className="w-3 h-3" /> Save Key
              </button>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 p-2.5 rounded-xl text-xs ${
                testResult.valid
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {testResult.valid
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Key is valid — API responded: "{testResult.response}"</>
                  : <><AlertTriangle className="w-3.5 h-3.5" /> Invalid key: {testResult.error}</>
                }
              </div>
            )}

            {allSettings['GEMINI_API_KEY']?.raw_set && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <Shield className="w-3 h-3" /> API key is configured
              </div>
            )}
          </div>
        </FieldRow>

        <div className="p-3 bg-[#F2C29A]/5 border border-[#F2C29A]/15 rounded-xl flex items-start gap-2">
          <Info className="w-4 h-4 text-[#F2C29A] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#EAE0D5]/50 leading-relaxed">
            The API key is stored securely in the database and masked in the UI. 
            Gemini 2.0 Flash Lite is free with generous quotas — ideal for the customer-facing AI.
          </p>
        </div>
      </Section>

      {/* ── AI Provider ── */}
      <Section icon={Zap} title="AI Provider" description="Choose the AI provider for the admin assistant (Gemini recommended for tool support)">
        <FieldRow label="Admin AI Provider" description="Gemini supports tool calls (orders, inventory, etc). OpenAI/Anthropic/Groq are text-only — great for analysis.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { val: 'gemini',    label: 'Gemini',    sub: 'Free · Tools', color: 'text-blue-400' },
              { val: 'openai',    label: 'OpenAI',    sub: 'GPT-4o etc',   color: 'text-green-400' },
              { val: 'anthropic', label: 'Anthropic', sub: 'Claude',       color: 'text-purple-400' },
              { val: 'groq',      label: 'Groq',      sub: 'Free · Fast',  color: 'text-orange-400' },
            ].map(p => (
              <button
                key={p.val}
                onClick={() => setVal('AI_PROVIDER', p.val)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  getVal('AI_PROVIDER', 'gemini') === p.val
                    ? 'border-[#B76E79]/50 bg-[#7A2F57]/15'
                    : 'border-[#B76E79]/15 hover:border-[#B76E79]/30 bg-[#0B0608]/50'
                }`}
              >
                <p className={`text-sm font-bold ${p.color}`}>{p.label}</p>
                <p className="text-[10px] text-[#EAE0D5]/35 mt-0.5">{p.sub}</p>
              </button>
            ))}
          </div>
        </FieldRow>

        {getVal('AI_PROVIDER', 'gemini') !== 'gemini' && (
          <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/70">
              Non-Gemini providers do not support tool calls (order management, inventory, etc).
              The admin AI will work in text-only mode — useful for analysis and brainstorming but cannot execute operational tasks.
            </p>
          </div>
        )}

        {getVal('AI_PROVIDER', 'gemini') === 'openai' && (
          <FieldRow label="OpenAI API Key" description="Your OpenAI API key (sk-...). Get it at platform.openai.com.">
            <input
              type="password"
              value={getVal('OPENAI_API_KEY', '')}
              onChange={e => setVal('OPENAI_API_KEY', e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-[#0B0608] border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] font-mono placeholder-[#EAE0D5]/20 focus:outline-none focus:border-[#B76E79]/50 transition-colors"
            />
          </FieldRow>
        )}

        {getVal('AI_PROVIDER', 'gemini') === 'groq' && (
          <FieldRow label="Groq API Key" description="Free API key from console.groq.com — runs Llama 3.3 and Mixtral models at high speed.">
            <input
              type="password"
              value={getVal('GROQ_API_KEY', '')}
              onChange={e => setVal('GROQ_API_KEY', e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 bg-[#0B0608] border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] font-mono placeholder-[#EAE0D5]/20 focus:outline-none focus:border-[#B76E79]/50 transition-colors"
            />
            <p className="text-xs text-[#EAE0D5]/30 mt-1.5">Suggested model: <span className="font-mono text-[#F2C29A]/60">llama-3.3-70b-versatile</span> (free tier)</p>
          </FieldRow>
        )}

        {getVal('AI_PROVIDER', 'gemini') === 'anthropic' && (
          <>
            <FieldRow label="Anthropic API Key" description="Your Anthropic API key from console.anthropic.com.">
              <input
                type="password"
                value={getVal('ANTHROPIC_API_KEY', '')}
                onChange={e => setVal('ANTHROPIC_API_KEY', e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 bg-[#0B0608] border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] font-mono placeholder-[#EAE0D5]/20 focus:outline-none focus:border-[#B76E79]/50 transition-colors"
              />
            </FieldRow>
            <FieldRow label="Anthropic Model" description="Choose Claude model. Haiku is cheapest for admin chat.">
              <div className="space-y-2">
                {[
                  { val: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', cost: '$0.25/1M in · $1.25/1M out', badge: 'Budget' },
                  { val: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', cost: '$3.00/1M in · $15.0/1M out', badge: 'Premium' },
                ].map(m => (
                  <label
                    key={m.val}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      getVal('ADMIN_MODEL', 'claude-3-haiku-20240307') === m.val
                        ? 'border-[#B76E79]/50 bg-[#7A2F57]/15'
                        : 'border-[#B76E79]/15 hover:border-[#B76E79]/30 bg-[#0B0608]/50'
                    }`}
                  >
                    <input type="radio" className="hidden" checked={getVal('ADMIN_MODEL', 'claude-3-haiku-20240307') === m.val} onChange={() => setVal('ADMIN_MODEL', m.val)} />
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      getVal('ADMIN_MODEL', 'claude-3-haiku-20240307') === m.val ? 'border-[#B76E79]' : 'border-[#B76E79]/30'
                    }`}>
                      {getVal('ADMIN_MODEL', 'claude-3-haiku-20240307') === m.val && <div className="w-2 h-2 rounded-full bg-[#B76E79]" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[#EAE0D5] font-medium">{m.label}</p>
                        {m.badge && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-500/15 text-purple-400">{m.badge}</span>}
                      </div>
                      <p className="text-xs text-[#EAE0D5]/35 mt-0.5 font-mono">{m.cost}</p>
                    </div>
                  </label>
                ))}
              </div>
            </FieldRow>
          </>
        )}

        {getVal('AI_PROVIDER', 'gemini') === 'openai' && (
          <>
            <FieldRow label="OpenAI API Key" description="Your OpenAI API key (sk-...). Get it at platform.openai.com.">
              <input
                type="password"
                value={getVal('OPENAI_API_KEY', '')}
                onChange={e => setVal('OPENAI_API_KEY', e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-[#0B0608] border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] font-mono placeholder-[#EAE0D5]/20 focus:outline-none focus:border-[#B76E79]/50 transition-colors"
              />
            </FieldRow>
            <FieldRow label="OpenAI Model" description="Choose GPT model. GPT-4o-mini is cost-effective for admin chat.">
              <div className="space-y-2">
                {[
                  { val: 'gpt-4o-mini', label: 'GPT-4o Mini', cost: '$0.15/1M in · $0.60/1M out', badge: 'Budget' },
                  { val: 'gpt-4o', label: 'GPT-4o', cost: '$2.50/1M in · $10.0/1M out', badge: 'Premium' },
                ].map(m => (
                  <label
                    key={m.val}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      getVal('ADMIN_MODEL', 'gpt-4o-mini') === m.val
                        ? 'border-[#B76E79]/50 bg-[#7A2F57]/15'
                        : 'border-[#B76E79]/15 hover:border-[#B76E79]/30 bg-[#0B0608]/50'
                    }`}
                  >
                    <input type="radio" className="hidden" checked={getVal('ADMIN_MODEL', 'gpt-4o-mini') === m.val} onChange={() => setVal('ADMIN_MODEL', m.val)} />
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      getVal('ADMIN_MODEL', 'gpt-4o-mini') === m.val ? 'border-[#B76E79]' : 'border-[#B76E79]/30'
                    }`}>
                      {getVal('ADMIN_MODEL', 'gpt-4o-mini') === m.val && <div className="w-2 h-2 rounded-full bg-[#B76E79]" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[#EAE0D5] font-medium">{m.label}</p>
                        {m.badge && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-500/15 text-green-400">{m.badge}</span>}
                      </div>
                      <p className="text-xs text-[#EAE0D5]/35 mt-0.5 font-mono">{m.cost}</p>
                    </div>
                  </label>
                ))}
              </div>
            </FieldRow>
          </>
        )}

        {getVal('AI_PROVIDER', 'gemini') === 'groq' && (
          <>
            <FieldRow label="Groq API Key" description="Free API key from console.groq.com — runs Llama 3.3 and Mixtral models at high speed.">
              <input
                type="password"
                value={getVal('GROQ_API_KEY', '')}
                onChange={e => setVal('GROQ_API_KEY', e.target.value)}
                placeholder="gsk_..."
                className="w-full px-3 py-2 bg-[#0B0608] border border-[#B76E79]/20 rounded-xl text-sm text-[#EAE0D5] font-mono placeholder-[#EAE0D5]/20 focus:outline-none focus:border-[#B76E79]/50 transition-colors"
              />
            </FieldRow>
            <FieldRow label="Groq Model" description="Choose model. All Groq models are currently free.">
              <div className="space-y-2">
                {[
                  { val: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', cost: 'FREE', badge: 'Recommended' },
                  { val: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B 32K', cost: 'FREE', badge: '' },
                ].map(m => (
                  <label
                    key={m.val}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      getVal('ADMIN_MODEL', 'llama-3.3-70b-versatile') === m.val
                        ? 'border-[#B76E79]/50 bg-[#7A2F57]/15'
                        : 'border-[#B76E79]/15 hover:border-[#B76E79]/30 bg-[#0B0608]/50'
                    }`}
                  >
                    <input type="radio" className="hidden" checked={getVal('ADMIN_MODEL', 'llama-3.3-70b-versatile') === m.val} onChange={() => setVal('ADMIN_MODEL', m.val)} />
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      getVal('ADMIN_MODEL', 'llama-3.3-70b-versatile') === m.val ? 'border-[#B76E79]' : 'border-[#B76E79]/30'
                    }`}>
                      {getVal('ADMIN_MODEL', 'llama-3.3-70b-versatile') === m.val && <div className="w-2 h-2 rounded-full bg-[#B76E79]" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[#EAE0D5] font-medium">{m.label}</p>
                        {m.badge && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-500/15 text-orange-400">{m.badge}</span>}
                      </div>
                      <p className="text-xs text-[#EAE0D5]/35 mt-0.5 font-mono">{m.cost}</p>
                    </div>
                  </label>
                ))}
              </div>
            </FieldRow>
          </>
        )}
      </Section>

      {/* ── Model Configuration ── */}
      <Section icon={Cpu} title="Model Configuration" description="Choose which Gemini model powers each AI role">
        <FieldRow label="Customer AI Model" description="Used by Aarya (public chat). Prioritize cost-efficiency.">
          <ModelSelect
            value={getVal('CUSTOMER_MODEL', 'gemini-2.0-flash-lite')}
            onChange={v => setVal('CUSTOMER_MODEL', v)}
          />
        </FieldRow>

        <hr className="border-[#B76E79]/10" />

        <FieldRow label="Admin AI Model" description="Used by Aria (admin assistant). Better reasoning for complex queries.">
          <ModelSelect
            value={getVal('ADMIN_MODEL', 'gemini-2.0-flash')}
            onChange={v => setVal('ADMIN_MODEL', v)}
          />
        </FieldRow>

        <hr className="border-[#B76E79]/10" />

        <FieldRow label="Customer Max Tokens" description="Max tokens per AI response for customer chat.">
          <NumberInput
            value={getVal('CUSTOMER_MAX_TOKENS', '512')}
            onChange={v => setVal('CUSTOMER_MAX_TOKENS', v)}
            min={128} max={2048} unit="tokens"
          />
        </FieldRow>

        <FieldRow label="Admin Max Tokens" description="Max tokens per AI response for admin assistant.">
          <NumberInput
            value={getVal('ADMIN_MAX_TOKENS', '2048')}
            onChange={v => setVal('ADMIN_MAX_TOKENS', v)}
            min={256} max={8192} unit="tokens"
          />
        </FieldRow>

        <FieldRow label="Customer History" description="Number of past messages kept as context per session.">
          <NumberInput
            value={getVal('CUSTOMER_HISTORY', '6')}
            onChange={v => setVal('CUSTOMER_HISTORY', v)}
            min={2} max={20} unit="messages"
          />
        </FieldRow>

        <FieldRow label="Admin History" description="Number of past messages kept for admin AI context.">
          <NumberInput
            value={getVal('ADMIN_HISTORY', '10')}
            onChange={v => setVal('ADMIN_HISTORY', v)}
            min={2} max={30} unit="messages"
          />
        </FieldRow>
      </Section>

      {/* ── Cost Limits ── */}
      <Section icon={DollarSign} title="Cost Limits & Alerts" description="Set spending limits to avoid unexpected bills">
        <FieldRow label="Daily Cost Limit" description="Alert threshold for daily API spending (USD). Not a hard block.">
          <NumberInput
            value={getVal('DAILY_COST_LIMIT', '1.00')}
            onChange={v => setVal('DAILY_COST_LIMIT', v)}
            min={0.01} max={100} unit="USD / day"
          />
        </FieldRow>

        <FieldRow label="Monthly Cost Limit" description="Alert threshold for monthly API spending (USD).">
          <NumberInput
            value={getVal('MONTHLY_COST_LIMIT', '10.00')}
            onChange={v => setVal('MONTHLY_COST_LIMIT', v)}
            min={0.1} max={1000} unit="USD / month"
          />
        </FieldRow>

        {/* Cost estimator */}
        <div className="p-4 bg-[#0B0608] border border-[#B76E79]/10 rounded-xl">
          <p className="text-xs font-semibold text-[#EAE0D5]/50 uppercase tracking-wider mb-3">Cost Estimator</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: '100 customer chats', usd: '~$0.002' },
              { label: '1,000 customer chats', usd: '~$0.02' },
              { label: '100 admin queries', usd: '~$0.01' },
              { label: '1,000 admin queries', usd: '~$0.10' },
            ].map(({ label, usd }) => (
              <div key={label} className="p-2 bg-[#180F14] rounded-lg">
                <p className="text-[#EAE0D5]/40">{label}</p>
                <p className="text-[#F2C29A] font-semibold mt-0.5">{usd}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#EAE0D5]/25 mt-3">
            * Estimates based on Gemini 2.0 Flash Lite (customer) and Flash (admin) at average 300 tokens/query.
            Actual costs may vary.
          </p>
        </div>
      </Section>

      {/* ── Language Settings ── */}
      <Section icon={Globe} title="Language & Localisation" description="Configure AI language behavior for Indian customers">
        <FieldRow label="Hindi / Bilingual Support" description="Allow AI to detect and respond in Hindi or Hinglish automatically.">
          <Toggle
            value={getVal('HINDI_SUPPORT', 'true')}
            onChange={v => setVal('HINDI_SUPPORT', v)}
            label={getVal('HINDI_SUPPORT', 'true') === 'true' ? 'Enabled — Hindi + English' : 'Disabled — English only'}
          />
        </FieldRow>

        <FieldRow label="Customer AI Language" description="Override language: auto-detect, force English, or force Hindi.">
          <div className="flex flex-col gap-2">
            {[
              { val: 'auto', label: 'Auto-detect', desc: 'Detects language from customer message' },
              { val: 'en',   label: 'English only', desc: 'Always respond in English' },
              { val: 'hi',   label: 'Hindi only',   desc: 'Always respond in Hindi (Devanagari)' },
            ].map(opt => (
              <label key={opt.val} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                getVal('CUSTOMER_LANGUAGE', 'auto') === opt.val
                  ? 'border-[#B76E79]/50 bg-[#7A2F57]/15'
                  : 'border-[#B76E79]/15 hover:border-[#B76E79]/30'
              }`}>
                <input
                  type="radio"
                  className="hidden"
                  checked={getVal('CUSTOMER_LANGUAGE', 'auto') === opt.val}
                  onChange={() => setVal('CUSTOMER_LANGUAGE', opt.val)}
                />
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  getVal('CUSTOMER_LANGUAGE', 'auto') === opt.val ? 'border-[#B76E79]' : 'border-[#B76E79]/30'
                }`}>
                  {getVal('CUSTOMER_LANGUAGE', 'auto') === opt.val && (
                    <div className="w-2 h-2 rounded-full bg-[#B76E79]" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-[#EAE0D5] font-medium">{opt.label}</p>
                  <p className="text-xs text-[#EAE0D5]/40">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </FieldRow>

        <div className="p-3 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-xl">
          <p className="text-xs text-[#EAE0D5]/50 leading-relaxed">
            <span className="text-[#F2C29A] font-semibold">Hindi example:</span>{' '}
            "नमस्ते! 🌸 मैं Aarya हूँ। आज आप क्या ढूंढ रही हैं? नई साड़ियाँ देखें, या कुर्तियाँ?"
            <br />
            Auto-detect mode works best for mixed Hindi-English (Hinglish) conversations.
          </p>
        </div>
      </Section>

      {/* ── Save button (bottom) ── */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-[#EAE0D5]/30">
          Changes take effect immediately for new conversations.
        </p>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-[#7A2F57] to-[#B76E79] rounded-xl text-sm text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-[#B76E79]/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </button>
      </div>
    </div>
  );
}
