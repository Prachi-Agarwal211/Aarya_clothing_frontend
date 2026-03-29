'use client';

/**
 * Super Admin AI Dashboard
 * AI-powered dashboard for natural language platform management
 */

import { useState, useEffect, useRef } from 'react';
import { aiDashboardApi, aiApi } from '@/lib/adminApi';
import logger from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  Mic,
  MicOff,
  Sparkles,
  BarChart3,
  PieChart,
  Activity,
  Clock,
  ChevronRight,
  MessageSquare,
  Lightbulb,
  Zap,
  Target,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import AISystemOverview from '@/components/admin/super/AISystemOverview';

// Suggested queries for quick access
const SUGGESTED_QUERIES = [
  { icon: BarChart3, label: 'Sales today', query: 'Show me sales metrics for today' },
  { icon: AlertTriangle, label: 'Low stock', query: 'What products are low on inventory?' },
  { icon: Users, label: 'New customers', query: 'How many new customers this week?' },
  { icon: ShoppingCart, label: 'Pending orders', query: 'Show pending orders' },
  { icon: TrendingUp, label: 'Revenue trends', query: 'Show revenue trends for last month' },
  { icon: Target, label: 'Top products', query: 'What are the top selling products?' },
];

// AI Action shortcuts
const AI_ACTIONS = [
  { icon: Zap, label: 'Send sale email', action: 'send_sale_email', description: 'Email all customers about sale' },
  { icon: Package, label: 'Restock items', action: 'restock_inventory', description: 'Restock low inventory items' },
  { icon: BarChart3, label: 'Generate report', action: 'generate_sales_report', description: 'Sales report for last month' },
  { icon: Users, label: 'Find inactive', action: 'find_inactive_customers', description: 'Customers who haven\'t ordered in 30 days' },
  { icon: Target, label: 'Apply discount', action: 'apply_discount', description: '20% discount on all kurtis' },
];

// Color palette for charts
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function SuperAdminAIDashboard() {
  // Chat state
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I&apos;m Aria, your AI assistant for the Aarya Clothing admin panel. I can help you manage the platform using natural language. Try asking me things like:\n\n• \"Show me sales metrics for today\"\n• \"What products are low on inventory?\"\n• \"How many new customers this week?\"\n\nI can also help you take actions like sending emails, restocking inventory, or generating reports.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);

  // Dashboard data state
  const [dashboardData, setDashboardData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Voice recognition
  const recognitionRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData();
    setupVoiceRecognition();
  }, []);

  const safeParseResult = (res) => {
    try { return res?.result ? JSON.parse(res.result) : null; } catch { return null; }
  };

  const loadDashboardData = async () => {
    try {
      setIsLoadingData(true);

      const [insightsRes, actionsRes, salesRes, inventoryRes, customersRes, ordersRes, trendsRes] =
        await Promise.allSettled([
          aiDashboardApi.getInsights('all'),
          aiDashboardApi.getPendingActions('pending'),
          aiDashboardApi.executeQuery('get_sales_metrics', { period: 'today', compare_previous: true }),
          aiDashboardApi.executeQuery('get_inventory_status', { alert_threshold: 10 }),
          aiDashboardApi.executeQuery('get_customer_analytics', { period: 'week', limit: 5 }),
          aiDashboardApi.executeQuery('get_order_fulfillment', { status: 'all', limit: 10 }),
          aiDashboardApi.executeQuery('get_revenue_trends', { granularity: 'daily', days: 7 }),
        ]);

      if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value);
      if (actionsRes.status === 'fulfilled') setPendingActions(actionsRes.value?.actions || []);

      const sales = safeParseResult(salesRes.value);
      const inventory = safeParseResult(inventoryRes.value);
      const customers = safeParseResult(customersRes.value);
      const orders = safeParseResult(ordersRes.value);
      const trends = safeParseResult(trendsRes.value);

      if (sales || inventory || customers || orders || trends) {
        setDashboardData({ sales, inventory, customers, orders, trends });
      }
    } catch (error) {
      logger.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const setupVoiceRecognition = () => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const sendMessage = async (messageText) => {
    const message = messageText || input;
    if (!message.trim()) return;

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Use existing AI admin chat
      const response = await aiApi.adminChat(message, sessionId, []);
      
      // Add assistant response
      const assistantMessage = {
        role: 'assistant',
        content: response.response || response.message || 'I processed your request.',
        timestamp: new Date(),
        pendingAction: response.pending_action,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update session ID
      if (response.session_id && !sessionId) {
        setSessionId(response.session_id);
      }

      // Refresh dashboard if action was taken
      if (response.action_taken) {
        loadDashboardData();
      }
    } catch (error) {
      logger.error('Failed to send message:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveAction = async (actionId) => {
    try {
      await aiDashboardApi.approveAction(actionId);
      setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
      loadDashboardData();
    } catch (error) {
      logger.error('Failed to approve action:', error);
    }
  };

  const handleRejectAction = async (actionId) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await aiDashboardApi.rejectAction(actionId, reason);
      setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
    } catch (error) {
      logger.error('Failed to reject action:', error);
    }
  };

  const handleAIAction = async (actionType) => {
    const actionQueries = {
      send_sale_email: 'Send an email to all customers about a 20% off sale',
      restock_inventory: 'Create restock requests for all low inventory items',
      generate_sales_report: 'Generate a comprehensive sales report for last month',
      find_inactive_customers: 'Find all customers who haven&apos;t ordered in the last 30 days',
      apply_discount: 'Apply a 20% discount to all products in the kurtis category',
    };

    sendMessage(actionQueries[actionType] || 'Execute action: ' + actionType);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-IN').format(value);
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Super Admin AI Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your platform with natural language AI assistance
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline" size="icon">
          <RefreshCw className={`h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Pending Actions Alert */}
      {pendingActions.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Pending AI Actions Requiring Approval ({pendingActions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  >
                    <div className="flex-1">
                      <p className="font-medium capitalize">{action.action_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(action.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectAction(action.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveAction(action.id)}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* AI System Overview - NEW Grafana-style */}
      <AISystemOverview
        stats={{
          active_provider: 'Gemini',
          active_model: '2.0 Flash Lite',
          tokens_today: 24582,
          cost_today: 0.42,
          daily_limit: 1.00,
          requests_today: 1247,
          avg_response_time: 1.2,
          success_rate: 99.8,
        }}
      />

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* AI Chat Interface */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Messages */}
              <ScrollArea className="h-80 rounded-lg border p-4">
                <div className="space-y-4">
                  {messages.map((message, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {message.role === 'user' ? 'U' : 'AI'}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`flex-1 rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                        {message.pendingAction && (
                          <div className="mt-2 p-2 bg-background rounded text-xs">
                            <p className="font-medium">Pending Action:</p>
                            <pre className="mt-1 overflow-x-auto">
                              {JSON.stringify(message.pendingAction, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-lg p-3 bg-muted">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Suggested Queries */}
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUERIES.map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => sendMessage(suggestion.query)}
                    className="text-xs"
                  >
                    <suggestion.icon className="h-3 w-3 mr-1" />
                    {suggestion.label}
                  </Button>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask me anything about your business..."
                  className="flex-1 rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isLoading}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleVoiceInput}
                  className={isListening ? 'bg-red-100 text-red-600' : ''}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                <Button onClick={() => sendMessage()} disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Quick AI Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {AI_ACTIONS.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleAIAction(action.action)}
                >
                  <action.icon className="h-5 w-5 mr-3 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Widgets */}
      {dashboardData && (
        <>
          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.sales?.total_revenue || 0)}
                </div>
                {dashboardData.sales?.growth_percentage !== undefined && (
                  <div className="flex items-center text-xs">
                    {dashboardData.sales.growth_percentage >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                    )}
                    <span
                      className={
                        dashboardData.sales.growth_percentage >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {dashboardData.sales.growth_percentage >= 0 ? '+' : ''}
                      {dashboardData.sales.growth_percentage}%
                    </span>
                    <span className="text-muted-foreground ml-1">vs yesterday</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Orders Today</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(dashboardData.sales?.total_orders || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg. value: {formatCurrency(dashboardData.sales?.avg_order_value || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(dashboardData.customers?.total_customers || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{formatNumber(dashboardData.customers?.new_customers || 0)} new this period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {dashboardData.inventory?.low_stock_count || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Low stock</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {dashboardData.inventory?.out_of_stock_count || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Out of stock</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Revenue Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.trends?.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Revenue (₹)"
                    />
                    <Line
                      type="monotone"
                      dataKey="order_count"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Orders"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  AI Insights & Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {insights?.insights?.map((insight, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border-l-4 ${
                          insight.priority === 'critical'
                            ? 'border-red-600 bg-red-50'
                            : insight.priority === 'high'
                            ? 'border-yellow-600 bg-yellow-50'
                            : 'border-green-600 bg-green-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {insight.priority === 'critical' ? (
                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          ) : insight.priority === 'high' ? (
                            <Target className="h-4 w-4 text-yellow-600 mt-0.5" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          )}
                          <div>
                            <Badge
                              variant="outline"
                              className="text-xs mb-1 capitalize"
                            >
                              {insight.category}
                            </Badge>
                            <p className="text-sm">{insight.insight}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Items */}
          {dashboardData.inventory?.low_stock_items?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Low Stock Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Product</th>
                        <th className="text-left py-2 px-3">SKU</th>
                        <th className="text-right py-2 px-3">Quantity</th>
                        <th className="text-right py-2 px-3">Price</th>
                        <th className="text-right py-2 px-3">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.inventory.low_stock_items.slice(0, 10).map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="py-2 px-3">{item.name}</td>
                          <td className="py-2 px-3 font-mono text-xs">{item.sku}</td>
                          <td className="py-2 px-3 text-right text-yellow-600 font-medium">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatCurrency(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Loading State */}
      {isLoadingData && !dashboardData && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      )}
    </div>
  );
}
