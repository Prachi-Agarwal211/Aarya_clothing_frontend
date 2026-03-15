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

// ── Main Page Component ───────────────────────────────────────────────────────
export default function SuperAdminAiSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aiSettingsApi.getAll();
      const settingsMap = {};
      data.settings.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      setSettings(settingsMap);
    } catch (err) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key, value) => {
    setSaving(true);
    try {
      await aiSettingsApi.update(key, value);
      setSettings(prev => ({ ...prev, [key]: value }));
      setTestResult(null);
    } catch (err) {
      setError(err.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const testApiKey = async () => {
    setTestResult({ loading: true });
    try {
      const result = await aiSettingsApi.testKey(settings.GEMINI_API_KEY);
      setTestResult(result);
    } catch (err) {
      setTestResult({ valid: false, error: err.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050203]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#B76E79]/30 border-t-[#F2C29A] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#EAE0D5]/70">Loading AI Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A] font-cinzel">
            AI Configuration
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Manage API keys, models, and AI settings for the system.
          </p>
        </div>
      </div>

      {/* API Key Section */}
      <Section icon={Key} title="API Keys" description="Configure API keys for AI providers">
        <FieldRow
          label="Gemini API Key"
          description="Google Gemini API key for AI operations"
        >
          <div className="flex gap-2">
            <input
              type="password"
              value={settings.GEMINI_API_KEY || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, GEMINI_API_KEY: e.target.value }))}
              className="flex-1 bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]"
              placeholder="Enter API key"
            />
            <button
              onClick={() => updateSetting('GEMINI_API_KEY', settings.GEMINI_API_KEY)}
              disabled={saving}
              className="px-4 py-2 bg-[#7A2F57] text-white rounded-lg hover:bg-[#B76E79] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        </FieldRow>

        <FieldRow label="Test API Key" description="Verify the API key is valid">
          <div className="flex gap-2 items-center">
            <button
              onClick={testApiKey}
              className="px-4 py-2 bg-[#B76E79]/20 text-[#F2C29A] rounded-lg hover:bg-[#B76E79]/30 transition-colors flex items-center gap-2"
            >
              <TestTube className="w-4 h-4" />
              Test Key
            </button>
            {testResult && (
              <div className={`flex items-center gap-2 ${testResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.valid ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span className="text-sm">{testResult.valid ? 'Key is valid' : testResult.error}</span>
              </div>
            )}
          </div>
        </FieldRow>
      </Section>

      {/* Model Configuration Section */}
      <Section icon={Cpu} title="Model Configuration" description="Select default AI models">
        <FieldRow label="Default Model" description="Select the primary model for AI operations">
          <ModelSelect
            value={settings.DEFAULT_MODEL || 'gemini-2.0-flash-lite'}
            onChange={(value) => updateSetting('DEFAULT_MODEL', value)}
          />
        </FieldRow>
      </Section>

      {/* Cost Limits Section */}
      <Section icon={DollarSign} title="Cost Limits" description="Set budget limits for AI usage">
        <FieldRow label="Daily Cost Limit" description="Maximum AI cost allowed per day (USD)">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={settings.DAILY_COST_LIMIT || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, DAILY_COST_LIMIT: e.target.value }))}
              className="w-32 bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]"
              placeholder="10.00"
            />
            <button
              onClick={() => updateSetting('DAILY_COST_LIMIT', settings.DAILY_COST_LIMIT)}
              disabled={saving}
              className="px-4 py-2 bg-[#7A2F57] text-white rounded-lg hover:bg-[#B76E79] transition-colors"
            >
              Save
            </button>
          </div>
        </FieldRow>
      </Section>

      {/* Language Settings Section */}
      <Section icon={Globe} title="Language Settings" description="Configure supported languages">
        <FieldRow label="Enable Hindi Support" description="Allow bilingual (English/Hindi) AI responses">
          <Toggle
            value={settings.ENABLE_HINDI || 'false'}
            onChange={(value) => updateSetting('ENABLE_HINDI', value)}
            label="Hindi Support Enabled"
          />
        </FieldRow>
      </Section>
    </div>
  );
}
