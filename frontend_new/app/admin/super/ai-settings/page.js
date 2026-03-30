'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Cpu, DollarSign, Globe, Save, RefreshCw,
  Loader2, CheckCircle, AlertTriangle, Eye, EyeOff,
  Zap, TestTube, Info, ToggleLeft, ToggleRight, Shield,
  Plus, Trash2, RotateCcw, Database, Cloud, Server
} from 'lucide-react';
import { aiSettingsApi } from '@/lib/adminApi';

// ── Provider configurations ───────────────────────────────────────────────────
const AI_PROVIDERS = {
  groq: {
    name: 'Groq (PRIMARY)',
    icon: Zap,
    color: '#F55036',
    bgColor: 'rgba(245, 80, 54, 0.1)',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', cost: 'FREE', badge: 'Best for Chat', free: true },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', cost: 'FREE', badge: 'Fast', free: true },
      { value: 'gemma2-9b-it', label: 'Gemma2 9B', cost: 'FREE', badge: '', free: true },
      { value: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90B Vision', cost: 'FREE', badge: 'Multimodal', free: true },
    ]
  },
  openrouter: {
    name: 'OpenRouter',
    icon: Cloud,
    color: '#5438DC',
    bgColor: 'rgba(84, 56, 220, 0.1)',
    models: [
      { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B Instruct', cost: 'FREE', badge: 'Best Free', free: true },
      { value: 'nousresearch/hermes-3-405b:free', label: 'Hermes 3 405B', cost: 'FREE', badge: 'Best IQ', free: true },
      { value: 'mistralai/mistral-small-3.1:free', label: 'Mistral Small 3.1', cost: 'FREE', badge: 'Balanced', free: true },
      { value: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air', cost: 'FREE', badge: 'Multilingual', free: true },
    ]
  },
  glm: {
    name: 'GLM / Zhipu',
    icon: Globe,
    color: '#3B5998',
    bgColor: 'rgba(59, 89, 152, 0.1)',
    models: [
      { value: 'glm-4-flash', label: 'GLM 4 Flash', cost: 'FREE', badge: 'Fastest', free: true },
      { value: 'glm-4-air', label: 'GLM 4 Air', cost: 'FREE', badge: '', free: true },
      { value: 'glm-4.7', label: 'GLM 4.7', cost: 'FREE', badge: 'Latest', free: true },
    ]
  },
  nvidia: {
    name: 'NVIDIA',
    icon: Cpu,
    color: '#76B900',
    bgColor: 'rgba(118, 185, 0, 0.1)',
    models: [
      { value: 'meta/llama3-70b-instruct', label: 'Llama 3 70B Instruct', cost: 'FREE', badge: 'Best Chat', free: true },
      { value: 'mistralai/mistral-7b-instruct-v0.3', label: 'Mistral 7B Instruct', cost: 'FREE', badge: 'Fastest', free: true },
      { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', cost: 'FREE', badge: 'Multilingual', free: true },
      { value: 'google/gemma-2b-it', label: 'Gemma 2B', cost: 'FREE', badge: 'Lightweight', free: true },
    ]
  }
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, description, children, className = '' }) {
  return (
    <div className={`bg-[#180F14] border border-[#B76E79]/15 rounded-2xl overflow-hidden ${className}`}>
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
function FieldRow({ label, description, children, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start gap-3 ${className}`}>
      <div className="sm:w-64 flex-shrink-0">
        <p className="text-sm font-medium text-[#EAE0D5]/80">{label}</p>
        {description && <p className="text-xs text-[#EAE0D5]/35 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── API Key Input with multiple keys support ─────────────────────────────────
function ApiKeyInput({ provider, apiKey, onUpdate, onTest, testResult }) {
  const [showKey, setShowKey] = useState(false);
  const providerConfig = AI_PROVIDERS[provider];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey || ''}
            onChange={(e) => onUpdate(e.target.value)}
            className="w-full bg-[#0B0608] border border-[#B76E79]/20 rounded-lg pl-4 pr-12 py-2.5 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] font-mono text-sm"
            placeholder={`Enter ${providerConfig.name} API key`}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B76E79]/50 hover:text-[#B76E79]"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={() => onUpdate(apiKey)}
          className="px-4 py-2 bg-[#7A2F57] text-white rounded-lg hover:bg-[#B76E79] transition-colors"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={onTest}
          className="px-4 py-2 bg-[#B76E79]/20 text-[#F2C29A] rounded-lg hover:bg-[#B76E79]/30 transition-colors flex items-center gap-2 text-sm"
        >
          <TestTube className="w-4 h-4" />
          Test Key
        </button>
        {testResult && (
          <div className={`flex items-center gap-2 text-sm ${testResult.valid ? 'text-green-400' : 'text-red-400'}`}>
            {testResult.valid ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{testResult.valid ? 'Valid key' : testResult.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Model selector ────────────────────────────────────────────────────────────
function ModelSelect({ provider, value, onChange }) {
  const providerConfig = AI_PROVIDERS[provider];

  return (
    <div className="space-y-2">
      {providerConfig.models.map(m => (
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
                  m.badge === 'Cheapest' || m.badge === 'Free!' ? 'bg-green-500/15 text-green-400' :
                  m.badge === 'Recommended' || m.badge === 'Balanced' ? 'bg-blue-500/15 text-blue-400' :
                  m.badge === 'Fastest' ? 'bg-purple-500/15 text-purple-400' :
                  m.badge === 'Most Powerful' || m.badge === 'Premium' ? 'bg-red-500/15 text-red-400' :
                  'bg-gray-500/15 text-gray-400'
                }`}>{m.badge}</span>
              )}
              {m.free && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-500/15 text-green-400">
                  FREE
                </span>
              )}
            </div>
            <p className="text-xs text-[#EAE0D5]/35 mt-0.5 font-mono">{m.cost}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

// ── Provider Card ─────────────────────────────────────────────────────────────
function ProviderCard({ providerKey, config, isActive, onActivate, apiKey, onUpdateApiKey, onTestKey, testResult, selectedModel }) {
  const Icon = config.icon;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      isActive 
        ? 'border-[#B76E79] bg-[#7A2F57]/10 shadow-lg shadow-[#B76E79]/20' 
        : 'border-[#B76E79]/20 bg-[#0B0608]/50 hover:border-[#B76E79]/40'
    }`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#B76E79]/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.bgColor }}>
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#EAE0D5]">{config.name}</h3>
            <p className="text-xs text-[#EAE0D5]/40">
              {config.models.filter(m => m.free).length} free models available
            </p>
          </div>
        </div>
        <button
          onClick={onActivate}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isActive
              ? 'bg-[#B76E79] text-white'
              : 'bg-[#B76E79]/20 text-[#F2C29A] hover:bg-[#B76E79]/30'
          }`}
        >
          {isActive ? '✓ Active' : 'Activate'}
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* API Key */}
        <div>
          <p className="text-xs font-medium text-[#EAE0D5]/60 mb-2 uppercase tracking-wider">API Key</p>
          <ApiKeyInput
            provider={providerKey}
            apiKey={apiKey}
            onUpdate={onUpdateApiKey}
            onTest={onTestKey}
            testResult={testResult}
          />
        </div>

        {/* Model Selection (only if active) */}
        {isActive && selectedModel && (
          <div>
            <p className="text-xs font-medium text-[#EAE0D5]/60 mb-2 uppercase tracking-wider">Current Model</p>
            <p className="text-sm text-[#F2C29A] font-mono bg-[#0B0608]/60 px-3 py-2 rounded-lg border border-[#B76E79]/10">
              {selectedModel}
            </p>
            <p className="text-xs text-[#EAE0D5]/30 mt-1">Change models in the Model Configuration section below</p>
          </div>
        )}
      </div>
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
  const [testResults, setTestResults] = useState({});
  const [error, setError] = useState(null);
  const [activeProvider, setActiveProvider] = useState('groq');

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aiSettingsApi.getAll();
      const settingsMap = {};
      data.settings.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      setSettings(settingsMap);
      setActiveProvider(settingsMap.AI_PROVIDER || 'groq');
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
      setTestResults(prev => ({ ...prev, [key]: null }));
    } catch (err) {
      setError(err.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const testApiKey = async (provider, apiKey) => {
    setTestResults(prev => ({ ...prev, [`${provider}_test`]: { loading: true } }));
    try {
      const result = await aiSettingsApi.testKey(apiKey, provider);
      setTestResults(prev => ({ ...prev, [`${provider}_test`]: result }));
    } catch (err) {
      setTestResults(prev => ({ ...prev, [`${provider}_test`]: { valid: false, error: err.message } }));
    }
  };

  const handleProviderChange = (provider) => {
    setActiveProvider(provider);
    updateSetting('AI_PROVIDER', provider);
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A] font-cinzel">
            AI Provider Management
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1">
            Configure multiple AI providers, manage API keys, and select models.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#EAE0D5]/40">
          <Info className="w-4 h-4" />
          <span>Supports 4 AI providers with automatic failover</span>
        </div>
      </div>

      {/* Provider Selection Grid */}
      <Section icon={Cloud} title="AI Providers" description="Configure and manage multiple AI providers">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(AI_PROVIDERS).map(([key, config]) => (
            <ProviderCard
              key={key}
              providerKey={key}
              config={config}
              isActive={activeProvider === key}
              onActivate={() => handleProviderChange(key)}
              apiKey={settings[`${key.toUpperCase()}_API_KEY`]}
              onUpdateApiKey={(value) => updateSetting(`${key.toUpperCase()}_API_KEY`, value)}
              onTestKey={() => testApiKey(key, settings[`${key.toUpperCase()}_API_KEY`])}
              testResult={testResults[`${key}_test`]}
              selectedModel={activeProvider === key ? (settings.CUSTOMER_MODEL || settings.ADMIN_MODEL) : ''}
            />
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <p className="font-semibold mb-1">Multi-Provider Support</p>
              <p>You can configure multiple AI providers. The system will use the active provider for all AI operations. Free providers (Groq) are recommended for development and testing.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Model Configuration */}
      <Section icon={Cpu} title="Model Configuration" description="Select default AI models for customer and admin interfaces">
        <FieldRow label="Customer-Facing Model" description="Model used for customer chat and assistance">
          <select
            value={settings.CUSTOMER_MODEL || AI_PROVIDERS[activeProvider]?.models[0]?.value || ''}
            onChange={(e) => updateSetting('CUSTOMER_MODEL', e.target.value)}
            className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2.5 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] w-full max-w-md"
          >
            {AI_PROVIDERS[activeProvider]?.models.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Admin Model" description="Model used for admin AI assistant and analytics">
          <select
            value={settings.ADMIN_MODEL || AI_PROVIDERS[activeProvider]?.models[1]?.value || ''}
            onChange={(e) => updateSetting('ADMIN_MODEL', e.target.value)}
            className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2.5 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] w-full max-w-md"
          >
            {AI_PROVIDERS[activeProvider]?.models.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Max Tokens (Customer)" description="Maximum tokens for customer AI responses">
          <input
            type="number"
            value={settings.CUSTOMER_MAX_TOKENS || 512}
            onChange={(e) => updateSetting('CUSTOMER_MAX_TOKENS', e.target.value)}
            className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] w-32"
          />
        </FieldRow>

        <FieldRow label="Max Tokens (Admin)" description="Maximum tokens for admin AI responses">
          <input
            type="number"
            value={settings.ADMIN_MAX_TOKENS || 2048}
            onChange={(e) => updateSetting('ADMIN_MAX_TOKENS', e.target.value)}
            className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] w-32"
          />
        </FieldRow>
      </Section>

      {/* Cost Limits */}
      <Section icon={DollarSign} title="Cost Limits & Budget" description="Set budget limits to control AI spending">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="Daily Cost Limit (USD)" description="Maximum AI cost per day">
            <input
              type="number"
              value={settings.DAILY_COST_LIMIT || 1.00}
              onChange={(e) => updateSetting('DAILY_COST_LIMIT', e.target.value)}
              className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] w-full"
              placeholder="1.00"
              step="0.01"
            />
          </FieldRow>

          <FieldRow label="Monthly Cost Limit (USD)" description="Maximum AI cost per month">
            <input
              type="number"
              value={settings.MONTHLY_COST_LIMIT || 10.00}
              onChange={(e) => updateSetting('MONTHLY_COST_LIMIT', e.target.value)}
              className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] w-full"
              placeholder="10.00"
              step="0.01"
            />
          </FieldRow>
        </div>
      </Section>

      {/* Language Settings */}
      <Section icon={Globe} title="Language & Localization" description="Configure language support for AI responses">
        <FieldRow label="Hindi Support" description="Enable bilingual (English/Hindi) AI responses">
          <Toggle
            value={settings.ENABLE_HINDI || 'false'}
            onChange={(value) => updateSetting('ENABLE_HINDI', value)}
            label="Hindi Support Enabled"
          />
        </FieldRow>

        <FieldRow label="Default Language" description="Default language for AI responses">
          <select
            value={settings.CUSTOMER_LANGUAGE || 'auto'}
            onChange={(e) => updateSetting('CUSTOMER_LANGUAGE', e.target.value)}
            className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-4 py-2 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]"
          >
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </FieldRow>
      </Section>

      {/* Advanced Settings */}
      <Section icon={Database} title="Advanced Configuration" description="Fine-tune AI behavior and performance">
        <FieldRow label="Conversation History" description="Number of previous messages to keep in context">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-[#EAE0D5]/40 mb-1">Customer</p>
              <input
                type="number"
                value={settings.CUSTOMER_HISTORY || 6}
                onChange={(e) => updateSetting('CUSTOMER_HISTORY', e.target.value)}
                className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-3 py-1.5 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] w-20"
                min="1"
                max="20"
              />
            </div>
            <div>
              <p className="text-xs text-[#EAE0D5]/40 mb-1">Admin</p>
              <input
                type="number"
                value={settings.ADMIN_HISTORY || 10}
                onChange={(e) => updateSetting('ADMIN_HISTORY', e.target.value)}
                className="bg-[#0B0608] border border-[#B76E79]/20 rounded-lg px-3 py-1.5 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] w-20"
                min="1"
                max="50"
              />
            </div>
          </div>
        </FieldRow>
      </Section>
    </div>
  );
}
