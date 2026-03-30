'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, ShoppingBag, Star,
  Loader2, ArrowRight, Package, Home, ShoppingCart, Check,
  LayoutGrid, LogIn, UserPlus, Wand2
} from 'lucide-react';
import { aiApi } from '@/lib/adminApi';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import logger from '@/lib/logger';

// ── Colour palette for swatches ──────────────────────────────────────────────
const COLOR_HEX = {
  red: '#ef4444', rose: '#f43f5e', pink: '#ec4899', fuchsia: '#d946ef',
  purple: '#a855f7', violet: '#8b5cf6', indigo: '#6366f1', blue: '#3b82f6',
  cyan: '#06b6d4', teal: '#14b8a6', green: '#22c55e', lime: '#84cc16',
  yellow: '#eab308', amber: '#f59e0b', orange: '#f97316', brown: '#92400e',
  white: '#f5f5f5', black: '#1a1a1a', grey: '#9ca3af', gray: '#9ca3af',
  navy: '#1e3a5f', maroon: '#800000', ivory: '#fffff0', cream: '#fffdd0',
  gold: '#ffd700', silver: '#c0c0c0', beige: '#f5f5dc', mustard: '#e3a849',
};

const SUGGESTIONS = [
  { label: '✨ New Arrivals', prompt: 'Show me your new arrivals' },
  { label: '👗 Collections', prompt: 'What collections do you have?' },
  { label: '🥻 Sarees', prompt: 'Show me sarees' },
  { label: '👘 Kurtis', prompt: 'Show me kurtis' },
  { label: '🎁 Gifting', prompt: 'What can I gift someone?' },
];

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: "Namaste! 🌸 I'm **Aarya**, your personal fashion guide.\n\nWhat would you love to explore today? I can help you discover new arrivals, find the perfect outfit, or check out our latest collections.",
  toolResults: null,
  timestamp: new Date(),
};

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function MessageText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-semibold text-[#F2C29A]">{p.slice(2, -2)}</strong>
          : p.split('\n').map((line, j) => (
              <React.Fragment key={`${i}-${j}`}>
                {j > 0 && <br />}
                {line}
              </React.Fragment>
            ))
      )}
    </span>
  );
}

// ── Parse all tool_results into structured data ───────────────────────────────
function parseToolResults(toolResults) {
  if (!toolResults) return { products: [], collections: [] };
  let products = [], collections = [];
  try {
    for (const [key, val] of Object.entries(toolResults)) {
      const data = typeof val === 'string' ? JSON.parse(val) : val;
      if (data?.products?.length) products = data.products;
      if (data?.collections?.length) collections = data.collections;
    }
  } catch (err) {
    logger.debug('Could not parse tool results for search:', err?.message);
  }
  return { products, collections };
}

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({ rating }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`w-2.5 h-2.5 ${n <= Math.round(rating) ? 'text-[#F2C29A] fill-[#F2C29A]' : 'text-[#EAE0D5]/20'}`} />
      ))}
      <span className="text-xs text-[#EAE0D5]/40 ml-0.5">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── Color swatch row ──────────────────────────────────────────────────────────
function ColorSwatches({ colors }) {
  if (!colors?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {colors.slice(0, 5).map((c, i) => {
        const hex = COLOR_HEX[c?.toLowerCase()] || '#9ca3af';
        return (
          <span
            key={i}
            title={c}
            className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
            style={{ backgroundColor: hex }}
          />
        );
      })}
      {colors.length > 5 && (
        <span className="text-xs text-[#EAE0D5]/30">+{colors.length - 5}</span>
      )}
    </div>
  );
}

// ── Size chips ────────────────────────────────────────────────────────────────
function SizeChips({ sizes }) {
  if (!sizes?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {sizes.slice(0, 5).map((s, i) => (
        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#B76E79]/10 border border-[#B76E79]/25 rounded text-[#EAE0D5]/60 font-medium">
          {s}
        </span>
      ))}
      {sizes.length > 5 && (
        <span className="text-[10px] text-[#EAE0D5]/30">+{sizes.length - 5}</span>
      )}
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ product: p, isAdminUser }) {
  const { addItem } = useCart();
  const [adding, setAdding] = React.useState(false);
  const [added, setAdded] = React.useState(false);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (adding || added) return;
    setAdding(true);
    try {
      await addItem(p.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (err) {
      logger.error('Add to cart failed:', err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group flex flex-col bg-[#0F0810] border border-[#B76E79]/15 rounded-2xl overflow-hidden hover:border-[#B76E79]/50 hover:shadow-lg hover:shadow-[#B76E79]/10 transition-all duration-300">
      {/* Image — clickable to product page */}
      <Link href={`/products/${p.id}`} className="block relative aspect-[3/4] bg-[#180F14] overflow-hidden">
        {p.image ? (
          <Image
            src={p.image}
            alt={p.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 160px, 200px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-[#B76E79]/20" />
          </div>
        )}
        {p.category && (
          <div className="absolute top-2 left-2">
            <span className="text-[10px] px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-full text-[#EAE0D5]/70">
              {p.category}
            </span>
          </div>
        )}
        {/* Stock badge - Admin Only */}
        {isAdminUser && p.in_stock === false && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-xs text-red-400 font-medium">Out of Stock</span>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <Link href={`/products/${p.id}`}>
          <p className="text-xs font-semibold text-[#EAE0D5] hover:text-[#F2C29A] transition-colors line-clamp-2 leading-snug">
            {p.name}
          </p>
        </Link>

        {p.rating > 0 && <StarRating rating={p.rating} />}
        <ColorSwatches colors={p.colors} />
        <SizeChips sizes={p.sizes} />

        <div className="flex items-center justify-between mt-auto pt-1.5">
          {p.price > 0 ? (
            <p className="text-sm font-bold text-[#B76E79]">
              ₹{p.price.toLocaleString('en-IN')}
            </p>
          ) : (
            <span className="text-xs text-[#EAE0D5]/40">View price</span>
          )}
        </div>

        {/* Add to Cart button */}
        <button
          onClick={handleAddToCart}
          disabled={adding || p.in_stock === false}
          className={`mt-1 w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
            added
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-[#7A2F57]/40 hover:bg-[#7A2F57]/70 text-[#F2C29A] border border-[#B76E79]/30 disabled:opacity-40'
          }`}
        >
          {adding ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : added ? (
            <><Check className="w-3 h-3" /> Added!</>
          ) : (
            <><ShoppingCart className="w-3 h-3" /> Add to Cart</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Products grid ─────────────────────────────────────────────────────────────
function ProductGrid({ products, isAdminUser }) {
  if (!products?.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs text-[#EAE0D5]/40 mb-2 px-1">
        {products.length} item{products.length !== 1 ? 's' : ''} found — tap to view
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {products.slice(0, 6).map(p => (
          <ProductCard key={p.id} product={p} isAdminUser={isAdminUser} />
        ))}
      </div>
      {products.length > 6 && (
        <Link
          href="/products"
          className="mt-3 flex items-center justify-center gap-2 py-2.5 border border-[#B76E79]/25 rounded-xl text-xs text-[#B76E79] hover:bg-[#B76E79]/10 transition-colors"
        >
          View all {products.length}+ results <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ── Collection chips ──────────────────────────────────────────────────────────
function CollectionChips({ collections }) {
  if (!collections?.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs text-[#EAE0D5]/40 mb-2 px-1">Browse collections</p>
      <div className="flex flex-wrap gap-2">
        {collections.slice(0, 8).map(c => (
          <Link
            key={c.id}
            href={c.slug ? `/collections/${c.slug}` : '/products'}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#7A2F57]/15 border border-[#B76E79]/25 rounded-xl text-xs text-[#F2C29A] hover:bg-[#7A2F57]/30 transition-colors"
          >
            <Package className="w-3 h-3" /> {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Login gate splash ─────────────────────────────────────────────────────────
function AiLoginGate() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#0B0608] flex flex-col items-center justify-center px-4 py-12"
         style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#B76E79]/5 rounded-full blur-[100px]" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7A2F57]/20 border border-[#B76E79]/30 rounded-full mb-5">
            <Wand2 className="w-4 h-4 text-[#B76E79]" />
            <span className="text-xs text-[#B76E79] font-medium tracking-wider uppercase">AI Shopping</span>
          </div>
          <h1 className="text-3xl font-bold text-[#F2C29A] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
            Shop with Aarya
          </h1>
          <p className="text-sm text-[#EAE0D5]/50 leading-relaxed">
            Your personal AI fashion guide — discover outfits you&apos;ll love through natural conversation.
          </p>
        </div>
        <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl p-5 mb-5 space-y-3">
          {[
            'Personalised outfit recommendations',
            'Instant product search by style or occasion',
            'Real-time availability & size checks',
            'Hindi • English bilingual support',
            'One-tap add to cart from chat',
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-[#B76E79]/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-[#B76E79]" />
              </span>
              <p className="text-sm text-[#EAE0D5]/70">{f}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <button onClick={() => router.push('/auth/login?redirect_url=/ai')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-br from-[#7A2F57] to-[#B76E79] rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-[#B76E79]/20">
            <LogIn className="w-4 h-4" /> Sign In to Start Shopping
          </button>
          <button onClick={() => router.push('/auth/register?redirect_url=/ai')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#180F14] border border-[#B76E79]/30 rounded-xl text-[#EAE0D5]/70 font-medium text-sm hover:text-[#EAE0D5] hover:border-[#B76E79]/60 transition-all">
            <UserPlus className="w-4 h-4" /> Create Free Account
          </button>
          <button onClick={() => router.push('/products')}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-[#EAE0D5]/30 hover:text-[#EAE0D5]/50 transition-colors">
            <LayoutGrid className="w-3.5 h-3.5" /> Browse without AI →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AiShopPage() {
  const { user, loading: authLoading, isStaff } = useAuth();
  const isAdminUser = isStaff();
  const router = useRouter();
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [language, setLanguage] = useState('auto');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const { cart } = useCart();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMsgId = Date.now();
    const assistantMsgId = userMsgId + 1;
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: msg, timestamp: new Date() }]);
    setLoading(true);

    // Build cart context for injection
    const cartContext = cart?.items?.length > 0 ? {
      items: cart.items.map(i => ({ name: i.product_name || i.name, quantity: i.quantity, price: i.price || i.unit_price })),
      total: cart.total || 0,
      item_count: cart.items.length,
    } : null;

    // Add a placeholder streaming message
    setMessages(prev => [...prev, {
      id: assistantMsgId, role: 'assistant', text: '', streaming: true, toolResults: null, timestamp: new Date(),
    }]);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const resp = await fetch(`${apiBase}/api/v1/ai/customer/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg, session_id: sessionId, language, cart_context: cartContext }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.chunk) {
              accText += evt.chunk;
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, text: accText } : m
              ));
            }
            if (evt.done) {
              if (evt.session_id) setSessionId(evt.session_id);
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, text: accText || "I'm here to help! What would you like to see?", streaming: false, toolResults: evt.tool_results || null }
                  : m
              ));
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, text: "I'm having a little trouble right now. Please try again in a moment! 🌸", streaming: false }
          : m
      ));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, sessionId, loading, language, cart]);

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Auth gate — after hooks
  if (authLoading) return (
    <div className="min-h-screen bg-[#0B0608] flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-[#B76E79]" />
    </div>
  );
  if (!user) return <AiLoginGate />;

  return (
    <div className="flex flex-col bg-[#0A0608]" style={{ minHeight: '100svh', fontFamily: "'Inter', sans-serif" }}>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-[#0A0608]/90 backdrop-blur-xl border-b border-[#B76E79]/15 flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center shadow-lg shadow-[#B76E79]/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Aarya AI</p>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <p className="text-xs text-[#EAE0D5]/40">Your fashion guide</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex bg-[#180F14] border border-[#B76E79]/20 rounded-full overflow-hidden">
              {[
                { val: 'auto', label: 'Auto' },
                { val: 'en',   label: 'A' },
                { val: 'hi',   label: 'अ' },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setLanguage(opt.val)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    language === opt.val
                      ? 'bg-[#7A2F57]/60 text-[#F2C29A]'
                      : 'text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70'
                  }`}
                  title={opt.val === 'auto' ? 'Auto-detect' : opt.val === 'en' ? 'English' : 'Hindi'}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push('/products')}
              title="Switch to traditional shopping"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[#B76E79]/25 rounded-full text-[#EAE0D5]/50 hover:text-[#EAE0D5]/80 hover:border-[#B76E79]/50 transition-all"
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden sm:inline">Browse</span>
            </button>
            <Link href="/" className="p-1.5 text-[#EAE0D5]/40 hover:text-[#EAE0D5]/70 transition-colors">
              <Home className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Chat messages (scrollable) ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-5 pb-6">
          {messages.map(msg => {
            const { products, collections } = parseToolResults(msg.toolResults);
            const hasRichContent = products.length || collections.length;

            return (
              <div key={msg.id} className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {/* Avatar */}
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-[#B76E79]/20">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end max-w-[78%]' : 'items-start max-w-[88%] sm:max-w-[85%]'}`}>
                  {/* Bubble */}
                  <div className={`px-4 py-3 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-[#7A2F57] to-[#B76E79] text-white rounded-tr-sm shadow-md'
                      : 'bg-[#180F14] border border-[#B76E79]/15 text-[#EAE0D5] rounded-tl-sm'
                  }`}>
                    {msg.streaming && !msg.text ? (
                      <div className="flex items-center gap-1.5 py-0.5">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-2 h-2 rounded-full bg-[#B76E79] animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                    ) : (
                      <>
                        <MessageText text={msg.text} />
                        {msg.streaming && (
                          <span className="inline-block w-0.5 h-4 bg-[#B76E79] ml-0.5 animate-pulse align-middle" />
                        )}
                      </>
                    )}
                  </div>

                  {/* Rich content cards */}
                  {msg.role === 'assistant' && hasRichContent > 0 && (
                    <div className="w-full mt-1">
                      <ProductGrid products={products} isAdminUser={isAdminUser} />
                      <CollectionChips collections={collections} />
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-[10px] text-[#EAE0D5]/20 mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Typing indicator — only show when NOT streaming (streaming shows cursor in bubble) */}
          {loading && !messages.some(m => m.streaming) && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-[#180F14] border border-[#B76E79]/15 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5 py-0.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full bg-[#B76E79] animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Fixed bottom: suggestions + input ── */}
      <div className="flex-shrink-0 bg-[#0A0608]/98 backdrop-blur-xl border-t border-[#B76E79]/15">
        <div className="max-w-2xl mx-auto px-4 pt-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          {/* Quick suggestions — always visible, scrollable */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {SUGGESTIONS.map(s => (
              <button
                key={s.label}
                onClick={() => sendMessage(s.prompt)}
                disabled={loading}
                className="flex-shrink-0 px-3 py-1.5 bg-[#180F14] border border-[#B76E79]/20 rounded-full text-xs text-[#EAE0D5]/60 hover:text-[#F2C29A] hover:border-[#B76E79]/45 whitespace-nowrap transition-colors disabled:opacity-40"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div className="flex items-end gap-2 mt-1">
            <div className="flex-1 bg-[#180F14] border border-[#B76E79]/20 rounded-2xl px-4 py-3 focus-within:border-[#B76E79]/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a colour, style, occasion..."
                rows={1}
                disabled={loading}
                className="w-full bg-transparent text-sm text-[#EAE0D5] placeholder-[#EAE0D5]/30 resize-none focus:outline-none disabled:opacity-60"
                style={{ lineHeight: '1.5', maxHeight: '120px', overflow: 'auto' }}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7A2F57] to-[#B76E79] flex items-center justify-center shadow-lg shadow-[#B76E79]/30 hover:opacity-90 transition-opacity disabled:opacity-35 flex-shrink-0"
            >
              {loading
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <Send className="w-4 h-4 text-white" />
              }
            </button>
          </div>

          <p className="text-center text-[10px] text-[#EAE0D5]/15 mt-2">
            Aarya AI · Your personal fashion guide
          </p>
        </div>
      </div>
    </div>
  );
}
