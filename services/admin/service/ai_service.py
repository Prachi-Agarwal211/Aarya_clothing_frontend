"""
AI Service — Aarya Clothing
Handles both Customer AI Salesman and Admin AI Assistant.

Architecture:
  - Single provider: Google Gemini Flash (cheapest, free tier, multimodal)
  - Customer: minimal system prompt, 6-message history, product tools only
  - Admin: full tool suite, 10-message history, agentic API calls, image support
  - Cost tracking: every call logs tokens + cost to ai_messages/ai_sessions tables

Pricing (Gemini 2.0 Flash Lite as of 2026):
  - Input:  $0.075 / 1M tokens
  - Output: $0.30  / 1M tokens
"""
import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import google.generativeai as genai
from sqlalchemy.orm import Session
from sqlalchemy import text

# Optional AI providers — fail gracefully if not installed
try:
    from openai import OpenAI as _OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    _OpenAI = None
    OPENAI_AVAILABLE = False

try:
    import anthropic as _anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    _anthropic = None
    ANTHROPIC_AVAILABLE = False

logger = logging.getLogger(__name__)

# ── Pricing constants (USD per token) ───────────────────────────────────────
GEMINI_FLASH_LITE = "gemini-2.0-flash-lite"
GEMINI_FLASH     = "gemini-2.0-flash"

PRICE_PER_TOKEN = {
    # Gemini
    GEMINI_FLASH_LITE: {"input": 0.075 / 1_000_000, "output": 0.30 / 1_000_000},
    GEMINI_FLASH:      {"input": 0.10  / 1_000_000, "output": 0.40 / 1_000_000},
    # OpenAI (GPT-4o-mini as budget option)
    "gpt-4o-mini":      {"input": 0.15 / 1_000_000, "output": 0.60 / 1_000_000},
    "gpt-4o":           {"input": 2.50 / 1_000_000, "output": 10.0 / 1_000_000},
    # Groq (free tier models)
    "llama-3.3-70b-versatile": {"input": 0.00 / 1_000_000, "output": 0.00 / 1_000_000},
    "mixtral-8x7b-32768":    {"input": 0.00 / 1_000_000, "output": 0.00 / 1_000_000},
    # Anthropic (Claude)
    "claude-3-haiku-20240307": {"input": 0.25 / 1_000_000, "output": 1.25 / 1_000_000},
    "claude-3-5-sonnet-20241022": {"input": 3.00 / 1_000_000, "output": 15.0 / 1_000_000},
}

# ── System prompts ────────────────────────────────────────────────────────────
CUSTOMER_SYSTEM_PROMPT_EN = """You are Aarya, an expert personal shopping assistant and fashion stylist for Aarya Clothing — a premium Indian fashion brand.

YOUR ROLE:
You are a warm, knowledgeable sales consultant — like having a personal stylist who knows the customer. Your goal is to help customers find exactly what they're looking for AND discover things they'll love.

SALES BEHAVIORS (follow these naturally, not mechanically):
- When showing products, always mention 1-2 key selling points (fabric, occasion, style)
- After showing products, offer to help narrow down by size, color, or budget
- If a customer viewed something, suggest complementary items ("This kurta pairs beautifully with...")
- For repeat customers, acknowledge their taste: "Based on your previous orders, you seem to love..." 
- When a product is low stock, mention it naturally ("This one is selling fast!")
- Suggest size guidance proactively when customer shows purchase intent
- If budget is mentioned, always filter and stay within it — never suggest higher-priced items without asking
- End each response with a clear next step or question to keep the conversation moving

CAPABILITIES:
- Help customers find products using natural language
- Provide personalized recommendations based on preferences and purchase history
- Check order status and tracking information
- Show cart contents and help manage cart
- Answer questions about shipping, returns, payments, and policies
- Suggest sizes with our size guide
- Check real-time stock availability

GROUNDING RULES:
- Only state product, stock, order, price, or policy details after verifying them with tools
- Do not invent product availability, delivery promises, or order status
- When unsure, ask a focused follow-up question instead of guessing

PERSONALITY:
- Warm, enthusiastic about fashion, knowledgeable
- Responses: 2-4 sentences + product cards (let the cards do the heavy lifting)
- Professional yet friendly — like a trusted friend who knows fashion
- Celebrate good choices: "Great taste!", "That's a wonderful choice for a wedding."
- Bilingual (English and Hindi)

CONSTRAINTS:
- Only recommend products from our catalog (use tools)
- Never make up order information — always verify with tools
- Always verify stock before recommending products
- Respect customer preferences and budget constraints
- For complex issues, suggest contacting human support

TOOLS YOU HAVE:
- Product search (keyword and semantic)
- New arrivals browsing
- Collections/categories browsing
- Active promotions lookup
- Order status lookup (requires order ID)
- Order history (for authenticated users)
- Cart management (view, add items)
- Coupon validation and application
- Size guide recommendations
- Shipping time estimates
- FAQ answers for common questions
"""

CUSTOMER_SYSTEM_PROMPT_HI = """आप AaryaBot हैं — Aarya Clothing के लिए एक बुद्धिमान AI शॉपिंग सहायक, जो एक प्रीमियम भारतीय फैशन ब्रांड है।

क्षमताएं:
- ग्राहकों को प्राकृतिक भाषा में उत्पाद खोजने में मदद करें
- वरीयताओं के आधार पर व्यक्तिगत सिफारिशें प्रदान करें
- ऑर्डर स्थिति और ट्रैकिंग जानकारी जांचें
- कार्ट प्रबंधन में सहायता (आइटम जोड़ें, कार्ट दिखाएं, कूपन लागू करें)
- शिपिंग, रिटर्न, भुगतान और नीतियों के बारे में प्रश्नों के उत्तर दें
- आकार सुझाव दें और स्टाइलिंग सलाह प्रदान करें
- कूपन कोड लागू करें और छूट की गणना करें
- रियल-टाइम में स्टॉक उपलब्धता जांचें

ग्राउंडिंग नियम:
- केवल टूल से सत्यापित उत्पाद, स्टॉक, ऑर्डर, कीमत, कूपन या नीति की जानकारी ही बताएं।
- यदि किसी बात की पुष्टि नहीं हो सकती, तो स्पष्ट कहें कि अभी पुष्टि नहीं कर सकते।
- उपलब्धता, डिलीवरी, या ऑर्डर स्थिति के बारे में अनुमान न लगाएं।
- संदेह होने पर अनुमान लगाने के बजाय एक स्पष्ट follow-up प्रश्न पूछें।

व्यक्तित्व:
- मित्रवत, सहायक, और फैशन के बारे में जानकार
- संक्षिप्त लेकिन पूर्ण जवाब (अधिकतम 2-4 वाक्य)
- प्रासंगिक उत्पादों और सौदों का सुझाव देने में सक्रिय
- पेशेवर लेकिन गर्मजोशी भरा लहजा
- बहुभाषी (अंग्रेजी और हिंदी)

नियम:
- केवल हमारे कैटलॉग से उत्पादों की सिफारिश करें (टूल का उपयोग करें)
- कभी भी ऑर्डर जानकारी न बनाएं — हमेशा टूल से सत्यापित करें
- उत्पादों की सिफारिश करने से पहले हमेशा स्टॉक सत्यापित करें
- ग्राहक वरीयताओं और बजट का सम्मान करें
- स्पैम न करें — सहायक बनें लेकिन धक्का देने वाला नहीं
- जटिल मुद्दों के लिए, मानव संपर्क का सुझाव दें
"""

CUSTOMER_SYSTEM_PROMPT_AUTO = """You are Aarya, an expert personal shopping assistant and fashion stylist for Aarya Clothing — a premium Indian fashion brand.

YOUR ROLE:
You are a warm, knowledgeable sales consultant — like having a personal stylist who knows the customer. Your goal is to help customers find exactly what they're looking for AND discover things they'll love.

SALES BEHAVIORS (follow these naturally, not mechanically):
- When showing products, always mention 1-2 key selling points (fabric, occasion, style)
- After showing products, offer to help narrow down by size, color, or budget
- For repeat customers, acknowledge their taste: "Based on your previous orders, you seem to love..."
- When a product is low stock, mention it naturally ("This one is selling fast!")
- Suggest size guidance proactively when customer shows purchase intent
- If budget is mentioned, always filter and stay within it
- End each response with a clear next step or question to keep the conversation moving

CAPABILITIES:
- Help customers find products using natural language
- Provide personalized recommendations based on preferences and purchase history
- Check order status and tracking information
- Show cart contents and help manage cart
- Answer questions about shipping, returns, payments, and policies
- Suggest sizes with our size guide
- Check real-time stock availability

GROUNDING RULES:
- Only state product, stock, order, price, or policy details after verifying them with tools
- Do not invent product availability, delivery promises, or order status
- When unsure, ask a focused follow-up question instead of guessing

PERSONALITY:
- Warm, enthusiastic about fashion, knowledgeable
- Responses: 2-4 sentences + product cards (let the cards do the heavy lifting)
- Professional yet friendly — like a trusted friend who knows fashion
- Bilingual (English and Hindi)

LANGUAGE RULES (very important):
- Detect the customer's language from their message.
- If they write in Hindi/Hinglish → respond in Hindi (Devanagari script preferred, Hinglish acceptable).
- If they write in English → respond in English.

CONSTRAINTS:
- Only recommend products from our catalog (use tools)
- Never make up order information — always verify with tools
- Always verify stock before recommending products
- Respect customer preferences and budget constraints
- For complex issues, suggest contacting human support

EXAMPLE (Hindi): "बिल्कुल! 🌸 यहाँ हमारे नए कुर्तियाँ हैं जो आपको पसंद आएंगी."
"""

# Default (auto-detect)
CUSTOMER_SYSTEM_PROMPT = CUSTOMER_SYSTEM_PROMPT_AUTO

ADMIN_SYSTEM_PROMPT = """You are Aria, an intelligent AI assistant for the Aarya Clothing admin panel.

Your role: Help admins and staff manage the store efficiently through natural conversation.

GROUNDING RULES:
- Use tools for all operational claims, counts, and status updates.
- Do not infer missing data or fill gaps with assumptions.
- If a request depends on missing context, ask for the exact record, ID, or scope required.
- Never claim a write action has been completed unless the underlying tool result confirms it.

Capabilities (use tools for all data operations):
- View orders, revenue, inventory, customers (read tools)
- Ship orders, update prices, adjust stock, create products (write tools — ALWAYS requires confirmation)
- Generate business insights from data

CRITICAL RULES — You MUST follow these without exception:
1. NEVER delete anything. You have no delete capability — do not suggest or attempt deletion.
2. For ALL write operations (shipping, price changes, stock adjustments, product creation):
   - Use the appropriate write tool to create a PENDING ACTION for admin approval.
   - NEVER execute a write operation without admin confirmation.
   - Tell the admin what action you've prepared and ask them to confirm.
3. Be concise and business-focused. Use ₹ for currency, commas for thousands.
4. Always use tools for real data — never guess or fabricate numbers.
5. Proactively suggest related actions after providing data.
"""

# Friendly error messages for users (never expose raw exceptions)
ERROR_MESSAGES = {
    "api_key": "AI service is not configured. Please set your API key in AI Configuration.",
    "quota": "AI service is rate-limited. Please wait a moment and try again.",
    "network": "Network error reaching AI service. Please check your connection.",
    "default": "Something went wrong. Please try again in a moment.",
}

def _friendly_error(e: Exception) -> str:
    msg = str(e).lower()
    if "api key" in msg or "authentication" in msg or "invalid_api" in msg:
        return ERROR_MESSAGES["api_key"]
    if "quota" in msg or "rate" in msg or "429" in msg:
        return ERROR_MESSAGES["quota"]
    if "connection" in msg or "network" in msg or "timeout" in msg:
        return ERROR_MESSAGES["network"]
    return ERROR_MESSAGES["default"]


# Write tool names — these create pending actions, NEVER auto-execute
WRITE_TOOLS = frozenset({
    "ship_order", "update_product_price", "bulk_update_category_prices",
    "adjust_stock", "create_product_draft",
})


# ── API key rotation ─────────────────────────────────────────────────────────
_KEY_ROTATION_INDEX = 0  # module-level round-robin counter


def _get_api_keys() -> List[str]:
    """Collect all configured Gemini API keys from environment (supports rotation)."""
    keys = []
    primary = os.environ.get("GEMINI_API_KEY", "")
    if primary and primary not in ("", "your_gemini_api_key_here"):
        keys.append(primary)
    for i in range(1, 6):
        k = os.environ.get(f"GEMINI_API_KEY_{i}", "")
        if k and k not in ("", "your_gemini_api_key_here"):
            keys.append(k)
    return keys


def _get_api_key() -> str:
    """Get available API key using rotation service with multi-provider support."""
    from core.ai_key_rotation import get_available_provider
    from database.database import get_db_context
    
    try:
        with next(get_db_context()) as db:
            provider = get_available_provider(db)
            if provider:
                logger.info(f"Using AI provider: {provider.name.value} (model: {provider.model})")
                return provider.api_key
    except Exception as e:
        logger.error(f"Key rotation service failed: {e}, falling back to env")
    
    # Fallback to old Gemini-only method
    keys = _get_api_keys()
    if not keys:
        raise ValueError("No AI API keys configured. Set GROQ_API_KEY or GEMINI_API_KEY in .env file.")
    
    global _KEY_ROTATION_INDEX
    key = keys[_KEY_ROTATION_INDEX % len(keys)]
    _KEY_ROTATION_INDEX = (_KEY_ROTATION_INDEX + 1) % len(keys)
    logger.info(f"Using fallback Gemini key (index {_KEY_ROTATION_INDEX})")
    return key


# ── pgvector embedding helpers ────────────────────────────────────────────────

def _product_embed_text(name: str, description: str = "", category: str = "", tags: str = "") -> str:
    """Build rich text for embedding — name + category + description + tags."""
    parts = [f"Product: {name}"]
    if category:
        parts.append(f"Category: {category}")
    if description:
        parts.append(f"Description: {description[:400]}")
    if tags:
        parts.append(f"Tags: {tags}")
    return " | ".join(parts)


def _generate_embedding(text_input: str, api_key: str) -> Optional[List[float]]:
    """Generate embedding using Gemini gemini-embedding-001 (768-dim)."""
    try:
        genai.configure(api_key=api_key)
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=text_input,
            task_type="retrieval_document",
        )
        return result["embedding"]
    except Exception as e:
        logger.error(f"Embedding generation error: {e}")
        return None


def _vec_str(embedding: List[float]) -> str:
    """Convert float list to Postgres vector literal string."""
    return "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"


def _calc_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    prices = PRICE_PER_TOKEN.get(model, PRICE_PER_TOKEN[GEMINI_FLASH_LITE])
    return (tokens_in * prices["input"]) + (tokens_out * prices["output"])


# ── Session management ────────────────────────────────────────────────────────

def get_or_create_session(db: Session, session_id: str, user_id: Optional[int], role: str) -> str:
    """Return existing session_id or create new one."""
    if session_id:
        row = db.execute(
            text("SELECT session_id FROM ai_sessions WHERE session_id = :sid"),
            {"sid": session_id}
        ).fetchone()
        if row:
            db.execute(
                text("UPDATE ai_sessions SET last_activity = :now WHERE session_id = :sid"),
                {"now": datetime.now(timezone.utc), "sid": session_id}
            )
            db.commit()
            return session_id

    new_sid = str(uuid.uuid4())
    db.execute(
        text("""
            INSERT INTO ai_sessions (session_id, user_id, role, created_at, last_activity)
            VALUES (:sid, :uid, :role, :now, :now)
        """),
        {"sid": new_sid, "uid": user_id, "role": role, "now": datetime.now(timezone.utc)}
    )
    db.commit()
    return new_sid


def get_session_history(db: Session, session_id: str, max_messages: int = 8) -> List[Dict]:
    """Fetch last N messages from DB for context."""
    rows = db.execute(
        text("""
            SELECT role, content, tool_calls, tool_results
            FROM ai_messages
            WHERE session_id = :sid
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"sid": session_id, "limit": max_messages}
    ).fetchall()
    # Reverse to chronological order
    messages = []
    for row in reversed(rows):
        if row[0] in ("user", "assistant"):
            messages.append({"role": row[0], "parts": [row[1] or ""]})
    return messages


def save_message(db: Session, session_id: str, role: str, content: str,
                 tokens_in: int, tokens_out: int, model: str,
                 tool_calls=None, tool_results=None, image_urls=None):
    cost = _calc_cost(model, tokens_in, tokens_out)
    db.execute(
        text("""
            INSERT INTO ai_messages
                (session_id, role, content, tokens_in, tokens_out, cost, model_used,
                 tool_calls, tool_results, image_urls, created_at)
            VALUES
                (:sid, :role, :content, :ti, :to_, :cost, :model,
                 :tc, :tr, :iu, :now)
        """),
        {
            "sid": session_id, "role": role, "content": content,
            "ti": tokens_in, "to_": tokens_out, "cost": cost, "model": model,
            "tc": json.dumps(tool_calls) if tool_calls else None,
            "tr": json.dumps(tool_results) if tool_results else None,
            "iu": json.dumps(image_urls) if image_urls else None,
            "now": datetime.now(timezone.utc),
        }
    )
    db.execute(
        text("""
            UPDATE ai_sessions SET
                total_tokens_in  = total_tokens_in  + :ti,
                total_tokens_out = total_tokens_out + :to_,
                total_cost       = total_cost       + :cost,
                message_count    = message_count    + 1,
                last_activity    = :now
            WHERE session_id = :sid
        """),
        {"ti": tokens_in, "to_": tokens_out, "cost": cost,
         "now": datetime.now(timezone.utc), "sid": session_id}
    )
    db.commit()


# ── Customer tools ────────────────────────────────────────────────────────────

def _customer_tools(db: Session) -> List[Dict]:
    """Enhanced customer tools for comprehensive e-commerce assistance."""
    return [
        {
            "name": "get_new_arrivals",
            "description": "Get the latest new arrival products. Use when customer wants to see new items.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of products (default 6, max 12)"}
                }
            }
        },
        {
            "name": "search_products",
            "description": "Search for products by name, category, color, style, or price range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "category": {"type": "string", "description": "Optional category filter"},
                    "max_price": {"type": "number", "description": "Maximum price filter"},
                    "limit": {"type": "integer", "description": "Number of results (default 6)"}
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_collections",
            "description": "Get all product collections/categories available in the store.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "get_active_promotions",
            "description": "Get current active promotions and discount codes.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "semantic_search_products",
            "description": "AI-powered semantic product search. Use for vague or intent-based queries like 'something for a wedding', 'casual summer outfit', 'gift for mom'. Better than keyword search for natural language.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language search query"},
                    "limit": {"type": "integer", "description": "Number of results (default 6, max 12)"}
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_order_status",
            "description": "Get order status and tracking information. Requires order_id. Use when customer asks 'where is my order' or provides order number.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer", "description": "Order ID to check status for"}
                },
                "required": ["order_id"]
            }
        },
        {
            "name": "get_order_history",
            "description": "Get customer's order history. Use when authenticated user asks about their past orders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of orders (default 5, max 20)"}
                }
            }
        },
        {
            "name": "get_cart",
            "description": "Get current user's shopping cart contents. Use when customer asks 'what's in my cart' or 'show my cart'.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "add_to_cart",
            "description": "Add a product to the user's cart. Requires product_id and quantity. Use when customer says 'add this to cart' or 'I want to buy this'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer", "description": "Product ID to add"},
                    "quantity": {"type": "integer", "description": "Quantity (default 1)"},
                    "size": {"type": "string", "description": "Size variant (optional)"},
                    "color": {"type": "string", "description": "Color variant (optional)"}
                },
                "required": ["product_id"]
            }
        },
        {
            "name": "get_customer_purchase_history",
            "description": "Get a summary of the customer's past purchases, favourite categories, and style preferences. Use when giving personalized recommendations or when the customer mentions past orders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Number of past orders to include (default 5)"}
                }
            }
        },
        {
            "name": "get_size_guide",
            "description": "Get size guide recommendations for a product. Use when customer asks about sizing or 'what size should I get'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer", "description": "Product ID to get size guide for"},
                    "measurements": {"type": "string", "description": "Customer's body measurements (optional, e.g., 'bust: 36, waist: 28')"}
                },
                "required": ["product_id"]
            }
        },
        {
            "name": "get_shipping_estimate",
            "description": "Get estimated delivery time for a pincode. Use when customer asks about delivery time or shipping.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pincode": {"type": "string", "description": "Delivery pincode"}
                },
                "required": ["pincode"]
            }
        },
        {
            "name": "get_faq_answer",
            "description": "Get answer to frequently asked questions about shipping, returns, payments, policies. Use for common customer service questions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "Customer's question"}
                },
                "required": ["question"]
            }
        },
        {
            "name": "get_product_recommendations",
            "description": "Get personalized product recommendations based on browsing history or preferences. Use for 'what do you recommend' or 'suggest something'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "style": {"type": "string", "description": "Style preference (optional, e.g., 'casual', 'formal', 'traditional')"},
                    "occasion": {"type": "string", "description": "Occasion (optional, e.g., 'wedding', 'party', 'office')"},
                    "budget": {"type": "number", "description": "Budget range (optional)"},
                    "limit": {"type": "integer", "description": "Number of recommendations (default 6)"}
                }
            }
        }
    ]


def _execute_customer_tool(db: Session, tool_name: str, args: Dict) -> str:
    try:
        if tool_name == "get_new_arrivals":
            limit = min(int(args.get("limit", 6)), 12)
            rows = db.execute(text("""
                SELECT p.id, p.name, p.description, p.base_price,
                       (
                           SELECT pi.image_url
                           FROM product_images pi
                           WHERE pi.product_id = p.id
                           ORDER BY pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                           LIMIT 1
                       ) as primary_image,
                       c.name as category,
                       COALESCE(p.average_rating, 0) as rating,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.color) FILTER (WHERE inv.color IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as colors,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.size) FILTER (WHERE inv.size IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as sizes
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.is_active = true AND p.is_new_arrival = true
                ORDER BY p.created_at DESC LIMIT :lim
            """), {"lim": limit}).fetchall()
            products = [
                {"id": r[0], "name": r[1], "description": (r[2] or "")[:120],
                 "price": float(r[3] or 0), "image": r[4], "category": r[5],
                 "rating": float(r[6] or 0),
                 "colors": list(r[7]) if r[7] else [],
                 "sizes": list(r[8]) if r[8] else []}
                for r in rows
            ]
            return json.dumps({"products": products, "count": len(products)})

        elif tool_name == "search_products":
            query = args.get("query", "")
            category = args.get("category", "")
            limit = min(int(args.get("limit", 6)), 12)
            cat_clause = "AND c.name ILIKE :cat" if category else ""
            qparams: Dict[str, Any] = {"q": f"%{query}%", "lim": limit}
            if category:
                qparams["cat"] = f"%{category}%"
            rows = db.execute(text(f"""
                SELECT p.id, p.name, p.description, p.base_price,
                       (
                           SELECT pi.image_url
                           FROM product_images pi
                           WHERE pi.product_id = p.id
                           ORDER BY pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                           LIMIT 1
                       ) as primary_image,
                       c.name as category,
                       COALESCE(p.average_rating, 0) as rating,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.color) FILTER (WHERE inv.color IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as colors,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.size) FILTER (WHERE inv.size IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as sizes
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.is_active = true
                  AND (p.name ILIKE :q OR p.description ILIKE :q OR c.name ILIKE :q)
                  {cat_clause}
                ORDER BY p.updated_at DESC LIMIT :lim
            """), qparams).fetchall()
            products = [
                {"id": r[0], "name": r[1], "description": (r[2] or "")[:120],
                 "price": float(r[3] or 0), "image": r[4], "category": r[5],
                 "rating": float(r[6] or 0),
                 "colors": list(r[7]) if r[7] else [],
                 "sizes": list(r[8]) if r[8] else []}
                for r in rows
            ]
            return json.dumps({"products": products, "count": len(products), "query": query})

        elif tool_name == "get_collections":
            rows = db.execute(text("""
                SELECT id, name, description, image_url, slug
                FROM collections WHERE is_active = true
                ORDER BY display_order ASC NULLS LAST, name ASC
            """)).fetchall()
            return json.dumps({
                "collections": [{"id": r[0], "name": r[1], "description": r[2],
                                  "image": r[3], "slug": r[4]} for r in rows]
            })

        elif tool_name == "get_active_promotions":
            rows = db.execute(text("""
                SELECT code, description, discount_type, discount_value, minimum_order
                FROM promotions
                WHERE is_active = true
                  AND (valid_until IS NULL OR valid_until > NOW())
                ORDER BY discount_value DESC LIMIT 5
            """)).fetchall()
            return json.dumps({
                "promotions": [
                    {"code": r[0], "description": r[1], "type": str(r[2]),
                     "value": float(r[3] or 0), "min_order": float(r[4] or 0)}
                    for r in rows
                ]
            })
        elif tool_name == "semantic_search_products":
            query = args.get("query", "")
            limit = min(int(args.get("limit", 6)), 12)
            try:
                api_key = _get_api_key()
                query_vec = _generate_embedding(query, api_key)
            except Exception:
                query_vec = None
            if query_vec is None:
                # Graceful fallback to keyword search
                return _execute_customer_tool(db, "search_products", {"query": query, "limit": limit})
            vec_literal = _vec_str(query_vec)
            rows = db.execute(text(f"""
                SELECT p.id, p.name, p.description, p.base_price,
                       (
                           SELECT pi.image_url
                           FROM product_images pi
                           WHERE pi.product_id = p.id
                           ORDER BY pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                           LIMIT 1
                       ) as primary_image,
                       c.name as category,
                       COALESCE(p.average_rating, 0) as rating,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.color)
                           FILTER (WHERE inv.color IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as colors,
                       (
                           SELECT ARRAY_AGG(DISTINCT inv.size)
                           FILTER (WHERE inv.size IS NOT NULL AND inv.quantity > 0)
                           FROM inventory inv WHERE inv.product_id = p.id
                       ) as sizes,
                       1 - (p.embedding <=> '{vec_literal}'::vector) as similarity
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.is_active = true AND p.embedding IS NOT NULL
                ORDER BY p.embedding <=> '{vec_literal}'::vector
                LIMIT :lim
            """), {"lim": limit}).fetchall()
            if not rows:
                return _execute_customer_tool(db, "search_products", {"query": query, "limit": limit})
            products = [
                {"id": r[0], "name": r[1], "description": (r[2] or "")[:120],
                 "price": float(r[3] or 0), "image": r[4], "category": r[5],
                 "rating": float(r[6] or 0),
                 "colors": list(r[7]) if r[7] else [],
                 "sizes": list(r[8]) if r[8] else [],
                 "similarity": round(float(r[9] or 0), 3)}
                for r in rows
            ]
            return json.dumps({"products": products, "count": len(products),
                               "query": query, "search_type": "semantic"})

        elif tool_name == "get_order_status":
            # Get order status for a specific order ID
            order_id = int(args.get("order_id", 0))
            user_id = args.get("user_id")  # Optional: for authorization
            row = db.execute(text("""
                SELECT o.id, o.status, o.total_amount, o.tracking_number, 
                       o.created_at, o.shipped_at, o.delivered_at,
                       o.shipping_address, o.payment_method,
                       STRING_AGG(oi.product_name || ' (x' || oi.quantity || ')', ', ') as items
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                WHERE o.id = :oid
                GROUP BY o.id
            """), {"oid": order_id}).fetchone()
            if not row:
                return json.dumps({"error": f"Order #{order_id} not found", "order_id": order_id})
            
            # Check authorization if user_id provided
            if user_id:
                owner = db.execute(text(
                    "SELECT user_id FROM orders WHERE id = :oid"
                ), {"oid": order_id}).fetchone()
                if owner and owner[0] != user_id:
                    # Check if user is admin
                    user_role = db.execute(text(
                        "SELECT role FROM users WHERE id = :uid"
                    ), {"uid": user_id}).fetchone()
                    if not user_role or user_role[0] != 'admin':
                        return json.dumps({"error": "Unauthorized: This order belongs to another customer"})
            
            return json.dumps({
                "order": {
                    "id": row[0],
                    "status": str(row[1]),
                    "total": float(row[2] or 0),
                    "tracking": row[3],
                    "created_at": str(row[4]),
                    "shipped_at": str(row[5]),
                    "delivered_at": str(row[6]),
                    "address": row[7],
                    "payment": row[8],
                    "items": row[9]
                }
            })

        elif tool_name == "get_order_history":
            # Get customer's order history
            limit = min(int(args.get("limit", 5)), 20)
            user_id = args.get("user_id")
            if not user_id:
                return json.dumps({"error": "Authentication required", "orders": [], "count": 0})
            
            rows = db.execute(text("""
                SELECT o.id, o.status, o.total_amount, o.created_at, 
                       o.tracking_number,
                       STRING_AGG(oi.product_name, ', ') as items
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                WHERE o.user_id = :uid
                GROUP BY o.id
                ORDER BY o.created_at DESC LIMIT :lim
            """), {"uid": user_id, "lim": limit}).fetchall()
            
            orders = [
                {
                    "id": r[0],
                    "status": str(r[1]),
                    "total": float(r[2] or 0),
                    "date": str(r[3]),
                    "tracking": r[4],
                    "items": r[5]
                }
                for r in rows
            ]
            return json.dumps({"orders": orders, "count": len(orders)})

        elif tool_name == "get_cart":
            # Get current user's cart
            user_id = args.get("user_id")
            if not user_id:
                return json.dumps({"error": "Authentication required", "cart": None})
            
            cart = db.execute(text("""
                SELECT c.id, c.total_amount, c.coupon_code, c.discount_amount
                FROM carts c
                WHERE c.user_id = :uid AND c.is_active = true
                ORDER BY c.updated_at DESC LIMIT 1
            """), {"uid": user_id}).fetchone()
            
            if not cart:
                return json.dumps({"cart": {"items": [], "total": 0, "count": 0}})
            
            items = db.execute(text("""
                SELECT ci.quantity, ci.price, p.name, p.id,
                       ci.size, ci.color,
                       (SELECT pi.image_url FROM product_images pi 
                        WHERE pi.product_id = p.id 
                        ORDER BY pi.is_primary DESC LIMIT 1) as image
                FROM cart_items ci
                JOIN products p ON p.id = ci.product_id
                WHERE ci.cart_id = :cid
            """), {"cid": cart[0]}).fetchall()
            
            cart_items = [
                {
                    "product_id": r[3],
                    "name": r[2],
                    "quantity": r[0],
                    "price": float(r[1] or 0),
                    "size": r[4],
                    "color": r[5],
                    "image": r[6]
                }
                for r in items
            ]
            
            return json.dumps({
                "cart": {
                    "id": cart[0],
                    "total": float(cart[1] or 0),
                    "coupon": cart[2],
                    "discount": float(cart[3] or 0),
                    "items": cart_items,
                    "count": len(cart_items)
                }
            })

        elif tool_name == "add_to_cart":
            # Add product to cart (simplified - returns success/failure)
            user_id = args.get("user_id")
            product_id = int(args.get("product_id", 0))
            quantity = int(args.get("quantity", 1))
            size = args.get("size")
            color = args.get("color")
            
            if not user_id:
                return json.dumps({"error": "Authentication required", "success": False})
            
            try:
                # Get or create cart
                cart = db.execute(text("""
                    SELECT id FROM carts 
                    WHERE user_id = :uid AND is_active = true 
                    ORDER BY updated_at DESC LIMIT 1
                """), {"uid": user_id}).fetchone()
                
                if not cart:
                    cart = db.execute(text("""
                        INSERT INTO carts (user_id, total_amount, is_active)
                        VALUES (:uid, 0, true) RETURNING id
                    """), {"uid": user_id}).fetchone()
                
                cart_id = cart[0]
                
                # Get product price
                product = db.execute(text("""
                    SELECT base_price FROM products WHERE id = :pid
                """), {"pid": product_id}).fetchone()
                
                if not product:
                    return json.dumps({"error": "Product not found", "success": False})
                
                price = float(product[0] or 0)
                
                # Add to cart items
                db.execute(text("""
                    INSERT INTO cart_items (cart_id, product_id, quantity, price, size, color)
                    VALUES (:cid, :pid, :qty, :price, :size, :color)
                    ON CONFLICT (cart_id, product_id, size, color) 
                    DO UPDATE SET quantity = cart_items.quantity + :qty
                """), {"cid": cart_id, "pid": product_id, "qty": quantity, 
                       "price": price, "size": size, "color": color})
                
                db.commit()
                return json.dumps({"success": True, "message": "Added to cart", "product_id": product_id})
            except Exception as e:
                db.rollback()
                logger.error(f"Add to cart error: {e}")
                return json.dumps({"error": str(e), "success": False})

        elif tool_name == "apply_coupon":
            # Validate and apply coupon
            user_id = args.get("user_id")
            code = args.get("code", "").strip().upper()
            
            if not user_id:
                return json.dumps({"error": "Authentication required", "valid": False})
            
            coupon = db.execute(text("""
                SELECT code, discount_type, discount_value, minimum_order, 
                       description, valid_until
                FROM promotions
                WHERE code = :code AND is_active = true
                  AND (valid_until IS NULL OR valid_until > NOW())
            """), {"code": code}).fetchone()
            
            if not coupon:
                return json.dumps({"valid": False, "error": "Invalid or expired coupon"})
            
            # Get cart total
            cart = db.execute(text("""
                SELECT id, total_amount FROM carts 
                WHERE user_id = :uid AND is_active = true 
                ORDER BY updated_at DESC LIMIT 1
            """), {"uid": user_id}).fetchone()
            
            if not cart:
                return json.dumps({"valid": False, "error": "Cart not found"})
            
            cart_total = float(cart[1] or 0)
            min_order = float(coupon[4] or 0)
            
            if cart_total < min_order:
                return json.dumps({
                    "valid": False, 
                    "error": f"Minimum order value ₹{min_order} required"
                })
            
            discount_value = float(coupon[3] or 0)
            discount_type = str(coupon[2])
            
            if discount_type == "percentage":
                discount = (cart_total * discount_value) / 100
            else:  # fixed
                discount = discount_value
            
            return json.dumps({
                "valid": True,
                "code": coupon[0],
                "description": coupon[4],
                "discount_type": discount_type,
                "discount_value": discount_value,
                "discount_amount": discount,
                "final_total": cart_total - discount
            })

        elif tool_name == "get_size_guide":
            # Get size guide for a product
            product_id = int(args.get("product_id", 0))
            measurements = args.get("measurements")
            
            product = db.execute(text("""
                SELECT p.name, c.name as category
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.id = :pid
            """), {"pid": product_id}).fetchone()
            
            if not product:
                return json.dumps({"error": "Product not found"})
            
            # Get available sizes from inventory
            sizes = db.execute(text("""
                SELECT DISTINCT size, quantity
                FROM inventory
                WHERE product_id = :pid AND size IS NOT NULL AND quantity > 0
                ORDER BY 
                    CASE size 
                        WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 
                        WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 
                        ELSE 7 
                    END
            """), {"pid": product_id}).fetchall()
            
            size_chart = {
                "XS": {"bust": "32-34", "waist": "24-26", "hips": "34-36"},
                "S": {"bust": "34-36", "waist": "26-28", "hips": "36-38"},
                "M": {"bust": "36-38", "waist": "28-30", "hips": "38-40"},
                "L": {"bust": "38-40", "waist": "30-32", "hips": "40-42"},
                "XL": {"bust": "40-42", "waist": "32-34", "hips": "42-44"},
                "XXL": {"bust": "42-44", "waist": "34-36", "hips": "44-46"},
            }
            
            recommendation = None
            if measurements:
                # Simple size recommendation logic
                try:
                    bust = float(measurements.split('bust')[1].split(':')[1].split(',')[0].strip()) if 'bust' in measurements else None
                    if bust:
                        if bust <= 34: recommendation = "S"
                        elif bust <= 36: recommendation = "M"
                        elif bust <= 38: recommendation = "L"
                        elif bust <= 40: recommendation = "XL"
                        else: recommendation = "XXL"
                except:
                    pass
            
            return json.dumps({
                "product": product[0],
                "category": product[1],
                "available_sizes": [r[0] for r in sizes],
                "size_chart": size_chart,
                "recommendation": recommendation,
                "note": "For best fit, compare your measurements with our size chart"
            })

        elif tool_name == "get_shipping_estimate":
            # Get shipping estimate for pincode
            pincode = args.get("pincode", "")
            
            # Simple pincode-based estimation logic
            # In production, integrate with shipping partner API
            metro_pincodes = ["110", "400", "560", "600", "700", "500", "380"]  # Major city prefixes
            is_metro = any(pincode.startswith(prefix) for prefix in metro_pincodes)
            
            if is_metro:
                delivery_days = "2-3 business days"
                shipping_cost = 0  # Free for metro
            else:
                delivery_days = "4-6 business days"
                shipping_cost = 99
            
            return json.dumps({
                "pincode": pincode,
                "estimated_delivery": delivery_days,
                "shipping_cost": shipping_cost,
                "is_metro": is_metro,
                "note": "Express delivery available for metro cities"
            })

        elif tool_name == "get_faq_answer":
            # Get FAQ answer
            question = args.get("question", "").lower()
            
            faq_database = {
                "shipping": {
                    "keywords": ["ship", "delivery", "deliver", "shipping", "post", "courier"],
                    "answer": "We offer free shipping on orders above ₹999. Metro cities: 2-3 days, Other cities: 4-6 days. You'll receive tracking details via email once shipped."
                },
                "return": {
                    "keywords": ["return", "exchange", "refund", "send back"],
                    "answer": "We offer 15-day easy returns. Items must be unused with tags intact. Free pickup available. Refund processed within 5-7 business days after quality check."
                },
                "payment": {
                    "keywords": ["pay", "payment", "razorpay", "card", "upi", "wallet"],
                    "answer": "We accept secure online payments via Razorpay: Credit/Debit Cards, UPI, Net Banking, and Digital Wallets. All transactions are 256-bit SSL encrypted for your security."
                },
                "size": {
                    "keywords": ["size", "fit", "measurement", "small", "large"],
                    "answer": "Check our detailed size chart on each product page. For traditional wear, we recommend ordering your usual size. For western wear, consider sizing up for a relaxed fit."
                },
                "order": {
                    "keywords": ["order", "track", "status", "where"],
                    "answer": "You can track your order using the order ID from your confirmation email. Login to your account to view order history and real-time tracking."
                },
                "cancel": {
                    "keywords": ["cancel", "cancellation"],
                    "answer": "Orders can be cancelled within 24 hours if not yet shipped. Contact support immediately with your order ID. Once shipped, you'll need to initiate a return after delivery."
                },
                "quality": {
                    "keywords": ["quality", "fabric", "material", "original", "genuine"],
                    "answer": "All our products are 100% genuine with quality assurance. We source directly from manufacturers. If you're not satisfied, we offer hassle-free returns within 15 days."
                }
            }
            
            best_match = None
            max_matches = 0
            
            for topic, data in faq_database.items():
                matches = sum(1 for keyword in data["keywords"] if keyword in question)
                if matches > max_matches:
                    max_matches = matches
                    best_match = topic
            
            if best_match and max_matches > 0:
                return json.dumps({
                    "topic": best_match,
                    "answer": faq_database[best_match]["answer"],
                    "matched": True
                })
            else:
                return json.dumps({
                    "topic": "general",
                    "answer": "For detailed assistance, please contact our customer support at support@aaryaclothing.com or call +91-XXX-XXX-XXXX. We're available Mon-Sat, 10 AM - 7 PM IST.",
                    "matched": False
                })

        elif tool_name == "get_product_recommendations":
            # Get personalized product recommendations
            style = args.get("style", "")
            occasion = args.get("occasion", "")
            budget = args.get("budget")
            limit = min(int(args.get("limit", 6)), 12)
            user_id = args.get("user_id")
            
            # Build query based on preferences
            conditions = ["p.is_active = true"]
            params: Dict[str, Any] = {"lim": limit}
            
            if budget:
                conditions.append("p.base_price <= :budget")
                params["budget"] = float(budget)
            
            if style:
                conditions.append("(p.name ILIKE :style OR p.description ILIKE :style OR p.tags ILIKE :style)")
                params["style"] = f"%{style}%"
            
            if occasion:
                conditions.append("(p.name ILIKE :occ OR p.description ILIKE :occ OR p.tags ILIKE :occ)")
                params["occ"] = f"%{occasion}%"
            
            where_clause = " AND ".join(conditions)
            
            rows = db.execute(text(f"""
                SELECT p.id, p.name, p.description, p.base_price,
                       (
                           SELECT pi.image_url
                           FROM product_images pi
                           WHERE pi.product_id = p.id
                           ORDER BY pi.is_primary DESC LIMIT 1
                       ) as primary_image,
                       c.name as category,
                       COALESCE(p.average_rating, 0) as rating,
                       p.is_new_arrival,
                       p.is_featured
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE {where_clause}
                ORDER BY 
                    (CASE WHEN p.is_featured THEN 1 ELSE 0 END) DESC,
                    (CASE WHEN p.is_new_arrival THEN 1 ELSE 0 END) DESC,
                    p.average_rating DESC,
                    p.updated_at DESC
                LIMIT :lim
            """), params).fetchall()
            
            products = [
                {
                    "id": r[0],
                    "name": r[1],
                    "description": (r[2] or "")[:120],
                    "price": float(r[3] or 0),
                    "image": r[4],
                    "category": r[5],
                    "rating": float(r[6] or 0),
                    "is_new": r[7],
                    "is_featured": r[8]
                }
                for r in rows
            ]
            
            return json.dumps({
                "products": products,
                "count": len(products),
                "style": style,
                "occasion": occasion,
                "budget": budget
            })

        elif tool_name == "get_customer_purchase_history":
            user_id = args.get("user_id")
            if not user_id:
                return json.dumps({"error": "Authentication required", "orders": [], "interests": []})
            limit = min(int(args.get("limit", 5)), 20)
            rows = db.execute(text("""
                SELECT o.id, o.total_amount, o.created_at, o.status,
                       STRING_AGG(DISTINCT c.name, ', ') FILTER (WHERE c.name IS NOT NULL) as categories,
                       STRING_AGG(DISTINCT oi.product_name, ', ') as products
                FROM orders o
                JOIN order_items oi ON oi.order_id = o.id
                LEFT JOIN products p ON p.id = oi.product_id
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE o.user_id = :uid AND o.status != 'cancelled'
                GROUP BY o.id
                ORDER BY o.created_at DESC LIMIT :lim
            """), {"uid": user_id, "lim": limit}).fetchall()
            orders = [{"id": r[0], "total": float(r[1] or 0), "date": str(r[2]),
                       "status": str(r[3]), "categories": r[4], "products": r[5]}
                      for r in rows]
            # Infer interests from category frequency
            cat_counts: Dict[str, int] = {}
            for o in orders:
                for cat in (o.get("categories") or "").split(", "):
                    c = cat.strip()
                    if c:
                        cat_counts[c] = cat_counts.get(c, 0) + 1
            interests = sorted(cat_counts, key=lambda x: -cat_counts[x])[:5]
            return json.dumps({"orders": orders, "count": len(orders), "interests": interests,
                               "total_spent": sum(o["total"] for o in orders)})

    except Exception as e:
        logger.error(f"Customer tool error [{tool_name}]: {e}")
        return json.dumps({"error": str(e)})

    return json.dumps({"error": "Unknown tool"})


# ── Admin tools ───────────────────────────────────────────────────────────────

def _admin_tools() -> List[Dict]:
    return [
        {
            "name": "get_orders",
            "description": "Get orders list with optional status/date filter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["confirmed", "shipped", "delivered", "cancelled"]},
                    "limit": {"type": "integer"},
                    "days": {"type": "integer", "description": "Orders from last N days"}
                }
            }
        },
        {
            "name": "get_order_details",
            "description": "Get full details of a specific order by ID.",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "integer"}},
                "required": ["order_id"]
            }
        },
        {
            "name": "get_revenue_summary",
            "description": "Get revenue analytics: total, daily average, top products, by period.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Period in days (default 30)"}
                }
            }
        },
        {
            "name": "get_inventory_alerts",
            "description": "Get low stock and out-of-stock inventory items.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "get_customer_stats",
            "description": "Get customer statistics: total, new this month, high-value customers.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "search_orders",
            "description": "Search orders by customer name, email, or order ID.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"]
            }
        },
        {
            "name": "get_ai_cost_summary",
            "description": "Get AI usage and cost summary for the store.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "Period in days (default 30)"}
                }
            }
        },
        {
            "name": "semantic_search_products",
            "description": "AI semantic product search using vector similarity. Use for intent-based queries or to find similar products.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language query"},
                    "limit": {"type": "integer", "description": "Number of results (default 10)"}
                },
                "required": ["query"]
            }
        }
    ]


def _execute_admin_tool(db: Session, tool_name: str, args: Dict) -> str:
    try:
        if tool_name == "get_orders":
            status = args.get("status")
            limit = min(int(args.get("limit", 20)), 100)
            days = args.get("days")
            where = "WHERE 1=1"
            params: Dict[str, Any] = {"lim": limit}
            if status:
                where += " AND o.status = :status"
                params["status"] = status
            if days:
                where += f" AND o.created_at >= NOW() - INTERVAL '{int(days)} days'"
            rows = db.execute(text(f"""
                SELECT o.id, o.status, o.total_amount, o.tracking_number,
                       o.created_at, u.email, u.username
                FROM orders o JOIN users u ON u.id = o.user_id
                {where}
                ORDER BY o.created_at DESC LIMIT :lim
            """), params).fetchall()
            return json.dumps({
                "orders": [
                    {"id": r[0], "status": str(r[1]), "total": float(r[2]),
                     "tracking": r[3], "created_at": str(r[4]),
                     "customer_email": r[5], "customer": r[6]}
                    for r in rows
                ],
                "count": len(rows)
            })

        elif tool_name == "get_order_details":
            oid = int(args["order_id"])
            row = db.execute(text("""
                SELECT o.id, o.status, o.total_amount, o.tracking_number, o.shipping_address,
                       o.created_at, o.shipped_at, o.delivered_at,
                       u.email, u.username,
                       o.payment_method, o.transaction_id, o.order_notes
                FROM orders o JOIN users u ON u.id = o.user_id
                WHERE o.id = :oid
            """), {"oid": oid}).fetchone()
            if not row:
                return json.dumps({"error": f"Order #{oid} not found"})
            items = db.execute(text("""
                SELECT product_name, quantity, unit_price, size, color
                FROM order_items WHERE order_id = :oid
            """), {"oid": oid}).fetchall()
            return json.dumps({
                "order": {
                    "id": row[0], "status": str(row[1]), "total": float(row[2]),
                    "tracking": row[3], "address": row[4],
                    "created_at": str(row[5]), "shipped_at": str(row[6]),
                    "delivered_at": str(row[7]),
                    "customer": row[9], "email": row[8],
                    "payment": row[10], "notes": row[12]
                },
                "items": [
                    {"product": r[0], "qty": r[1], "price": float(r[2]),
                     "size": r[3], "color": r[4]}
                    for r in items
                ]
            })

        elif tool_name == "get_revenue_summary":
            days = int(args.get("days", 30))
            stats = db.execute(text(f"""
                SELECT
                    COALESCE(SUM(total_amount), 0) as total_rev,
                    COUNT(*) as total_orders,
                    COALESCE(AVG(total_amount), 0) as avg_order,
                    COUNT(DISTINCT user_id) as unique_customers
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '{days} days'
                  AND status != 'cancelled'
            """)).fetchone()
            top_products = db.execute(text(f"""
                SELECT p.name, SUM(oi.quantity) as sold, SUM(oi.unit_price * oi.quantity) as revenue
                FROM order_items oi
                JOIN inventory i ON i.id = oi.inventory_id
                JOIN products p ON p.id = i.product_id
                JOIN orders o ON o.id = oi.order_id
                WHERE o.created_at >= NOW() - INTERVAL '{days} days'
                  AND o.status != 'cancelled'
                GROUP BY p.id, p.name
                ORDER BY revenue DESC LIMIT 5
            """)).fetchall()
            return json.dumps({
                "period_days": days,
                "total_revenue": float(stats[0]),
                "total_orders": stats[1],
                "avg_order_value": float(stats[2]),
                "unique_customers": stats[3],
                "daily_avg_revenue": float(stats[0]) / max(days, 1),
                "top_products": [
                    {"name": r[0], "units_sold": r[1], "revenue": float(r[2])}
                    for r in top_products
                ]
            })

        elif tool_name == "get_inventory_alerts":
            low = db.execute(text("""
                SELECT i.sku, p.name, i.quantity, i.low_stock_threshold
                FROM inventory i JOIN products p ON p.id = i.product_id
                WHERE i.quantity <= i.low_stock_threshold AND i.quantity > 0
                ORDER BY i.quantity ASC LIMIT 15
            """)).fetchall()
            oos = db.execute(text("""
                SELECT i.sku, p.name
                FROM inventory i JOIN products p ON p.id = i.product_id
                WHERE i.quantity = 0 LIMIT 15
            """)).fetchall()
            return json.dumps({
                "low_stock": [{"sku": r[0], "name": r[1], "qty": r[2], "threshold": r[3]} for r in low],
                "out_of_stock": [{"sku": r[0], "name": r[1]} for r in oos],
                "low_stock_count": len(low),
                "out_of_stock_count": len(oos)
            })

        elif tool_name == "get_customer_stats":
            stats = db.execute(text("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as new_this_month,
                    COUNT(*) FILTER (WHERE is_active = true) as active
                FROM users WHERE role = 'customer'
            """)).fetchone()
            return json.dumps({
                "total_customers": stats[0],
                "new_this_month": stats[1],
                "active_customers": stats[2]
            })

        elif tool_name == "search_orders":
            q = args.get("query", "")
            rows = db.execute(text("""
                SELECT o.id, o.status, o.total_amount, o.created_at, u.email, u.username
                FROM orders o JOIN users u ON u.id = o.user_id
                WHERE u.email ILIKE :q OR u.username ILIKE :q
                   OR CAST(o.id AS TEXT) = :exact
                ORDER BY o.created_at DESC LIMIT 10
            """), {"q": f"%{q}%", "exact": q.strip()}).fetchall()
            return json.dumps({
                "orders": [
                    {"id": r[0], "status": str(r[1]), "total": float(r[2]),
                     "created_at": str(r[3]), "email": r[4], "username": r[5]}
                    for r in rows
                ]
            })

        elif tool_name == "get_ai_cost_summary":
            days = int(args.get("days", 30))
            stats = db.execute(text(f"""
                SELECT
                    role,
                    COUNT(*) as sessions,
                    SUM(message_count) as messages,
                    SUM(total_tokens_in) as tokens_in,
                    SUM(total_tokens_out) as tokens_out,
                    SUM(total_cost) as cost
                FROM ai_sessions
                WHERE created_at >= NOW() - INTERVAL '{days} days'
                GROUP BY role
            """)).fetchall()
            return json.dumps({
                "period_days": days,
                "by_role": [
                    {"role": r[0], "sessions": r[1], "messages": r[2],
                     "tokens_in": r[3], "tokens_out": r[4],
                     "cost_usd": float(r[5] or 0)}
                    for r in stats
                ]
            })

        elif tool_name == "semantic_search_products":
            query = args.get("query", "")
            limit = min(int(args.get("limit", 10)), 50)
            try:
                api_key = _get_api_key()
                query_vec = _generate_embedding(query, api_key)
            except Exception:
                query_vec = None
            if query_vec is None:
                return json.dumps({"error": "Embedding generation failed. Use keyword search instead."})
            vec_literal = _vec_str(query_vec)
            rows = db.execute(text(f"""
                SELECT p.id, p.name, p.base_price, p.is_active,
                       COALESCE((
                           SELECT SUM(i.quantity - i.reserved_quantity)
                           FROM inventory i
                           WHERE i.product_id = p.id AND i.is_active = true
                       ), 0) as total_stock,
                       c.name as category,
                       1 - (p.embedding <=> '{vec_literal}'::vector) as similarity
                FROM products p
                LEFT JOIN collections c ON c.id = p.category_id
                WHERE p.embedding IS NOT NULL
                ORDER BY p.embedding <=> '{vec_literal}'::vector
                LIMIT :lim
            """), {"lim": limit}).fetchall()
            products = [
                {"id": r[0], "name": r[1], "price": float(r[2] or 0),
                 "active": r[3], "stock": r[4], "category": r[5],
                 "similarity": round(float(r[6] or 0), 3)}
                for r in rows
            ]
            embedded_count = db.execute(text(
                "SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL"
            )).scalar() or 0
            total_count = db.execute(text(
                "SELECT COUNT(*) FROM products"
            )).scalar() or 0
            return json.dumps({
                "products": products, "count": len(products), "query": query,
                "search_type": "semantic",
                "coverage": f"{embedded_count}/{total_count} products have embeddings"
            })

    except Exception as e:
        logger.error(f"Admin tool error [{tool_name}]: {e}")
        return json.dumps({"error": str(e)})

    return json.dumps({"error": "Unknown tool"})


# ── Admin WRITE tool definitions (create pending actions, never auto-execute) ─

def _admin_write_tool_definitions() -> List[Dict]:
    """Write tools that the AI can call to build pending actions for admin confirmation."""
    return [
        {
            "name": "ship_order",
            "description": "Prepare to mark an order as shipped with a POD/tracking number. Creates a PENDING ACTION that requires admin confirmation before execution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "integer", "description": "Order ID to ship"},
                    "tracking_number": {"type": "string", "description": "POD or tracking number"},
                    "carrier": {"type": "string", "description": "Carrier name (optional)"},
                },
                "required": ["order_id", "tracking_number"]
            }
        },
        {
            "name": "update_product_price",
            "description": "Prepare to update a product's price. Creates a PENDING ACTION requiring confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "integer"},
                    "new_price": {"type": "number", "description": "New price in INR"},
                    "reason": {"type": "string", "description": "Reason for change"},
                },
                "required": ["product_id", "new_price"]
            }
        },
        {
            "name": "bulk_update_category_prices",
            "description": "Prepare to bulk-update prices for all products in a category by a percentage. Creates a PENDING ACTION requiring confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category_name": {"type": "string"},
                    "percent_change": {"type": "number", "description": "+10 = increase 10%, -5 = reduce 5%"},
                },
                "required": ["category_name", "percent_change"]
            }
        },
        {
            "name": "adjust_stock",
            "description": "Prepare to adjust inventory quantity for a SKU. Creates a PENDING ACTION requiring confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string"},
                    "quantity_change": {"type": "integer", "description": "Positive to add, negative to reduce"},
                    "reason": {"type": "string"},
                },
                "required": ["sku", "quantity_change"]
            }
        },
        {
            "name": "create_product_draft",
            "description": "Prepare to create a new product draft. Creates a PENDING ACTION requiring confirmation. Product will be created as inactive.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "base_price": {"type": "number"},
                    "category_name": {"type": "string"},
                    "description": {"type": "string"},
                    "tags": {"type": "string", "description": "Comma-separated tags"},
                },
                "required": ["name", "base_price", "category_name"]
            }
        },
    ]


def _build_pending_action(db: Session, tool_name: str, args: Dict) -> Dict:
    """Build rich pending action context for admin confirmation. Never modifies DB."""
    try:
        if tool_name == "ship_order":
            oid = args.get("order_id")
            tracking = args.get("tracking_number", "")
            row = db.execute(text(
                "SELECT status FROM orders WHERE id = :oid"
            ), {"oid": oid}).fetchone()
            warning = None
            if row and str(row[0]) != "confirmed":
                warning = f"Order is currently '{row[0]}' — not 'confirmed'. Shipping may fail."
            return {
                "type": tool_name,
                "params": args,
                "description": f"Mark Order #{oid} as SHIPPED with tracking: {tracking}",
                "warning": warning,
            }

        elif tool_name == "update_product_price":
            pid = args.get("product_id")
            new_price = float(args.get("new_price", 0))
            row = db.execute(text(
                "SELECT name, base_price FROM products WHERE id = :pid"
            ), {"pid": pid}).fetchone()
            if row:
                return {
                    "type": tool_name, "params": args,
                    "description": f"Update price of '{row[0]}': ₹{float(row[1]):,.0f} → ₹{new_price:,.0f}",
                    "warning": None,
                }
            return {
                "type": tool_name, "params": args,
                "description": f"Update price for product #{pid} to ₹{new_price:,.0f}",
                "warning": f"Product #{pid} not found — please verify.",
            }

        elif tool_name == "bulk_update_category_prices":
            cat = args.get("category_name", "")
            pct = float(args.get("percent_change", 0))
            count = db.execute(text(
                "SELECT COUNT(*) FROM products p JOIN collections c ON c.id=p.category_id WHERE c.name ILIKE :c AND p.is_active=true"
            ), {"c": f"%{cat}%"}).scalar() or 0
            direction = "increase" if pct > 0 else "decrease"
            return {
                "type": tool_name, "params": args,
                "description": f"Bulk {direction} prices by {abs(pct):.1f}% for {count} active products in '{cat}'",
                "warning": f"Affects {count} products. Review carefully." if count > 5 else (None if count > 0 else f"No active products found in '{cat}'."),
            }

        elif tool_name == "adjust_stock":
            sku = args.get("sku", "")
            qty = int(args.get("quantity_change", 0))
            row = db.execute(text(
                "SELECT p.name, i.quantity FROM inventory i JOIN products p ON p.id=i.product_id WHERE i.sku=:sku"
            ), {"sku": sku}).fetchone()
            current = f" (current: {row[1]} units)" if row else " (SKU not found)"
            return {
                "type": tool_name, "params": args,
                "description": f"{'Add' if qty > 0 else 'Remove'} {abs(qty)} units for SKU '{sku}'{current}",
                "warning": None if row else f"SKU '{sku}' not found in inventory.",
            }

        elif tool_name == "create_product_draft":
            return {
                "type": tool_name, "params": args,
                "description": f"Create product draft: '{args.get('name')}' at ₹{float(args.get('base_price', 0)):,.0f} in '{args.get('category_name')}'",
                "warning": "Product will be saved as inactive (draft). Activate from Products page.",
            }

    except Exception as e:
        logger.error(f"_build_pending_action error [{tool_name}]: {e}")

    return {"type": tool_name, "params": args, "description": f"Execute: {tool_name}", "warning": None}


def execute_confirmed_action(db: Session, action_type: str, params: Dict, admin_user_id: int) -> Dict:
    """
    Execute a write action ONLY after explicit admin confirmation.
    This is the single entry point for all AI-triggered write operations.
    DELETE operations are intentionally absent and will never be added.
    """
    try:
        now = datetime.now(timezone.utc)

        if action_type == "ship_order":
            oid = int(params["order_id"])
            tracking = str(params["tracking_number"])
            result = db.execute(text("""
                UPDATE orders SET status = 'shipped', tracking_number = :trk, shipped_at = :now
                WHERE id = :oid AND status = 'confirmed'
            """), {"trk": tracking, "now": now, "oid": oid})
            db.commit()
            if result.rowcount == 0:
                return {"success": False, "message": f"Order #{oid} could not be shipped (already shipped or not confirmed)."}
            return {"success": True, "message": f"✓ Order #{oid} marked as shipped with tracking {tracking}"}

        elif action_type == "update_product_price":
            pid = int(params["product_id"])
            new_price = float(params["new_price"])
            if new_price <= 0:
                return {"success": False, "message": "Price must be greater than 0."}
            db.execute(text("UPDATE products SET base_price = :p, updated_at = :now WHERE id = :pid"),
                       {"p": new_price, "now": now, "pid": pid})
            db.commit()
            return {"success": True, "message": f"✓ Price updated to ₹{new_price:,.0f} for product #{pid}"}

        elif action_type == "bulk_update_category_prices":
            cat = params["category_name"]
            pct = float(params["percent_change"]) / 100.0
            multiplier = 1.0 + pct
            if multiplier <= 0:
                return {"success": False, "message": "Percent change would result in zero or negative prices."}
            result = db.execute(text("""
                UPDATE products SET base_price = ROUND(base_price * :m, 2), updated_at = :now
                WHERE category_id = (SELECT id FROM collections WHERE name ILIKE :cat LIMIT 1)
                  AND is_active = true
            """), {"m": multiplier, "now": now, "cat": f"%{cat}%"})
            db.commit()
            return {"success": True, "message": f"✓ Bulk price update: {result.rowcount} products updated by {pct*100:+.1f}%"}

        elif action_type == "adjust_stock":
            sku = params["sku"]
            qty = int(params["quantity_change"])
            reason = params.get("reason", "Admin AI adjustment")
            inv_row = db.execute(text("SELECT id, quantity FROM inventory WHERE sku = :sku"), {"sku": sku}).fetchone()
            if not inv_row:
                return {"success": False, "message": f"SKU '{sku}' not found in inventory."}
            new_qty = max(0, inv_row[1] + qty)
            db.execute(text("UPDATE inventory SET quantity = :q, updated_at = :now WHERE sku = :sku"),
                       {"q": new_qty, "now": now, "sku": sku})
            db.execute(text("""
                INSERT INTO inventory_movements (inventory_id, movement_type, quantity_change, reason, created_at, created_by)
                VALUES (:iid, 'adjustment', :qty, :reason, :now, :uid)
            """), {"iid": inv_row[0], "qty": qty, "reason": reason, "now": now, "uid": admin_user_id})
            db.commit()
            return {"success": True, "message": f"✓ Stock for '{sku}': {inv_row[1]} → {new_qty} ({qty:+d})"}

        elif action_type == "create_product_draft":
            cat_id = db.execute(text(
                "SELECT id FROM collections WHERE name ILIKE :n LIMIT 1"
            ), {"n": f"%{params['category_name']}%"}).scalar()
            if not cat_id:
                return {"success": False, "message": f"Category '{params['category_name']}' not found."}
            row = db.execute(text("""
                INSERT INTO products (name, base_price, category_id, description, is_active, created_at, updated_at)
                VALUES (:name, :price, :cat, :desc, false, :now, :now)
                RETURNING id
            """), {
                "name": params["name"], "price": float(params["base_price"]),
                "cat": cat_id, "desc": params.get("description", ""),
                "now": now
            }).fetchone()
            db.commit()
            return {"success": True, "message": f"✓ Product draft created (ID #{row[0]}). Activate it from the Products page.", "product_id": row[0]}

        return {"success": False, "message": f"Unknown action type: '{action_type}'. No changes made."}

    except Exception as e:
        db.rollback()
        logger.error(f"execute_confirmed_action error [{action_type}]: {e}")
        return {"success": False, "message": f"Action failed: {_friendly_error(e)}"}


# ── Main chat functions ───────────────────────────────────────────────────────

def _get_setting(db: Session, key: str, default: str = "") -> str:
    """Fetch a value from ai_settings table, fall back to default."""
    try:
        row = db.execute(
            text("SELECT value FROM ai_settings WHERE key = :k"), {"k": key}
        ).fetchone()
        return row[0] if row and row[0] is not None else default
    except Exception:
        return default


def _customer_chat_groq_fallback(
    db: Session,
    user_message: str,
    session_id: str,
    user_id: Optional[int],
    system_prompt: str,
    max_tokens: int,
) -> Dict[str, Any]:
    """Fallback to Groq (free Llama) when Gemini quota is exceeded."""
    if not OPENAI_AVAILABLE:
        raise RuntimeError("Groq fallback unavailable (openai package not installed)")
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise RuntimeError("GROQ_API_KEY not configured")
    model_name = "llama-3.3-70b-versatile"
    client = _OpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
    history = get_session_history(db, session_id, max_messages=6)
    messages: List[Dict] = [{"role": "system", "content": system_prompt}]
    messages += [{"role": m["role"], "content": m["parts"][0]} for m in history]
    messages.append({"role": "user", "content": user_message})
    resp = client.chat.completions.create(
        model=model_name, messages=messages,
        max_tokens=max_tokens, temperature=0.7,
    )
    reply = resp.choices[0].message.content or "I'm here to help! What would you like to see?"
    ti = resp.usage.prompt_tokens if resp.usage else 0
    to_ = resp.usage.completion_tokens if resp.usage else 0
    save_message(db, session_id, "assistant", reply, ti, to_, model_name)
    return {
        "session_id": session_id, "reply": reply,
        "tool_results": {}, "tokens_used": ti + to_,
        "cost_usd": 0.0, "provider": "groq_fallback",
    }


def customer_chat(
    db: Session,
    user_message: str,
    session_id: Optional[str],
    user_id: Optional[int],
    language: str = "auto",  # 'auto' | 'en' | 'hi'
    cart_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Customer AI Salesman chat with enhanced e-commerce capabilities.
    Supports Gemini Flash Lite (primary) with Groq Llama fallback on quota errors.
    Returns: { session_id, reply, tool_results, tokens_used, cost }
    """
    api_key = _get_api_key()  # rotates through all configured keys
    genai.configure(api_key=api_key)
    model_name = _get_setting(db, "CUSTOMER_MODEL", os.environ.get("AI_MODEL", GEMINI_FLASH_LITE))
    max_tokens = int(_get_setting(db, "CUSTOMER_MAX_TOKENS", os.environ.get("AI_CUSTOMER_MAX_TOKENS", "512")))
    max_history = int(_get_setting(db, "CUSTOMER_HISTORY", "8"))

    # Pick system prompt based on language setting
    lang = language or _get_setting(db, "CUSTOMER_LANGUAGE", "auto")
    if lang == "hi":
        system_prompt = CUSTOMER_SYSTEM_PROMPT_HI
    elif lang == "en":
        system_prompt = CUSTOMER_SYSTEM_PROMPT_EN
    else:
        system_prompt = CUSTOMER_SYSTEM_PROMPT_AUTO

    # Inject live cart context into system prompt if provided
    if cart_context and isinstance(cart_context, dict):
        items = cart_context.get("items", [])
        total = cart_context.get("total", 0)
        item_count = cart_context.get("item_count", len(items))
        if items:
            cart_lines = "\n".join(
                f"  - {it.get('name', 'Item')} x{it.get('quantity', 1)} @ ₹{it.get('price', 0):,.0f}"
                for it in items[:10]
            )
            cart_summary = f"\n\nUSER'S CURRENT CART ({item_count} item{'s' if item_count != 1 else ''}, total ₹{total:,.0f}):\n{cart_lines}\nUse this cart context to give proactive, personalised suggestions."
            system_prompt = system_prompt + cart_summary

    # Inject customer purchase history & interests for personalisation
    if user_id:
        try:
            history_data = json.loads(_execute_customer_tool(db, "get_customer_purchase_history",
                                                              {"user_id": user_id, "limit": 5}))
            past_orders = history_data.get("orders", [])
            interests = history_data.get("interests", [])
            total_spent = history_data.get("total_spent", 0)
            if past_orders or interests:
                lines = []
                if interests:
                    lines.append(f"  Favourite categories: {', '.join(interests)}")
                if past_orders:
                    last = past_orders[0]
                    lines.append(f"  Last order: #{last['id']} ({last['status']}) — {last['products']}")
                    lines.append(f"  Total orders: {len(past_orders)}, Total spent: ₹{total_spent:,.0f}")
                context_block = "\n\nCUSTOMER PROFILE (use to personalise your response):\n" + "\n".join(lines)
                context_block += "\nAddress them warmly, reference their taste when relevant."
                system_prompt = system_prompt + context_block
        except Exception:
            pass  # Non-critical — continue without history

    session_id = get_or_create_session(db, session_id or "", user_id, "customer")
    history = get_session_history(db, session_id, max_messages=max_history)

    tools = _customer_tools(db)
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
        tools=[{"function_declarations": tools}],
        generation_config={"max_output_tokens": max_tokens, "temperature": 0.7},
    )
    chat = model.start_chat(history=history)

    # Save user message (no tokens yet)
    save_message(db, session_id, "user", user_message, 0, 0, model_name)

    try:
        response = chat.send_message(user_message)
        tokens_in = response.usage_metadata.prompt_token_count or 0
        tokens_out = response.usage_metadata.candidates_token_count or 0

        # Handle tool calls if present
        tool_results = {}
        final_text = ""
        for part in response.parts:
            if hasattr(part, "function_call") and part.function_call:
                fc = part.function_call
                # Pass user_id to tool execution for auth-dependent tools
                args_dict = dict(fc.args)
                if user_id:
                    args_dict["user_id"] = user_id
                result = _execute_customer_tool(db, fc.name, args_dict)
                tool_results[fc.name] = result
                # Second pass with tool result
                follow_up = chat.send_message(
                    genai.protos.Content(parts=[
                        genai.protos.Part(function_response=genai.protos.FunctionResponse(
                            name=fc.name, response={"result": result}
                        ))
                    ])
                )
                tokens_in += follow_up.usage_metadata.prompt_token_count or 0
                tokens_out += follow_up.usage_metadata.candidates_token_count or 0
                final_text = follow_up.text or ""
            elif hasattr(part, "text"):
                final_text += part.text or ""

        final_text = final_text.strip()
        save_message(db, session_id, "assistant", final_text,
                     tokens_in, tokens_out, model_name,
                     tool_results=tool_results if tool_results else None)

        return {
            "session_id": session_id,
            "reply": final_text,
            "tool_results": tool_results,
            "tokens_used": tokens_in + tokens_out,
            "cost_usd": _calc_cost(model_name, tokens_in, tokens_out),
        }

    except Exception as e:
        logger.error(f"Customer chat error: {e}")
        msg = str(e).lower()
        # Try Groq fallback on quota/rate errors before giving up
        if ("quota" in msg or "rate" in msg or "429" in msg or "resource_exhausted" in msg):
            try:
                logger.info("Gemini quota hit — trying Groq fallback")
                return _customer_chat_groq_fallback(
                    db, user_message, session_id, user_id, system_prompt, max_tokens
                )
            except Exception as fallback_err:
                logger.error(f"Groq fallback also failed: {fallback_err}")
        if "api key" in msg or "authentication" in msg:
            friendly = "Our AI assistant is taking a short break. Please try again soon! 🙏"
        elif "quota" in msg or "rate" in msg or "429" in msg:
            friendly = "I'm a bit busy right now — please try again in a moment! 😊"
        else:
            friendly = "I'm having a little trouble right now. Please try again in a moment! 🌸"
        save_message(db, session_id, "assistant", friendly, 0, 0, model_name)
        return {
            "session_id": session_id,
            "reply": friendly,
            "error": "service_error",
            "tokens_used": 0,
            "cost_usd": 0.0,
        }


def _admin_chat_openai(
    db: Session, user_message: str, session_id: str, user_id: int,
    model_name: str, api_key: str, base_url: Optional[str], max_tokens: int, max_history: int,
) -> Dict[str, Any]:
    """Text-only admin chat via OpenAI-compatible API (OpenAI, Groq, Together, etc.)."""
    client = _OpenAI(api_key=api_key, base_url=base_url)
    history = get_session_history(db, session_id, max_messages=max_history)
    messages: List[Dict] = [{"role": "system", "content": ADMIN_SYSTEM_PROMPT}]
    messages += [{"role": m["role"], "content": m["parts"][0]} for m in history]
    messages.append({"role": "user", "content": user_message})

    save_message(db, session_id, "user", user_message, 0, 0, model_name)
    try:
        resp = client.chat.completions.create(
            model=model_name, messages=messages,
            max_tokens=max_tokens, temperature=0.4,
        )
        reply = resp.choices[0].message.content or ""
        ti = resp.usage.prompt_tokens if resp.usage else 0
        to = resp.usage.completion_tokens if resp.usage else 0
        save_message(db, session_id, "assistant", reply, ti, to, model_name)
        return {
            "session_id": session_id, "reply": reply,
            "tool_calls": [], "pending_actions": [],
            "tokens_used": ti + to,
            "cost_usd": _calc_cost(model_name, ti, to),
            "provider": "openai",
        }
    except Exception as e:
        logger.error(f"OpenAI admin chat error: {e}")
        friendly = _friendly_error(e)
        save_message(db, session_id, "assistant", friendly, 0, 0, model_name)
        return {"session_id": session_id, "reply": friendly, "error": "service_error",
                "tool_calls": [], "pending_actions": [], "tokens_used": 0, "cost_usd": 0.0}


def _admin_chat_anthropic(
    db: Session, user_message: str, session_id: str, user_id: int,
    model_name: str, api_key: str, max_tokens: int, max_history: int,
) -> Dict[str, Any]:
    """Text-only admin chat via Anthropic Claude."""
    client = _anthropic.Anthropic(api_key=api_key)
    history = get_session_history(db, session_id, max_messages=max_history)
    messages: List[Dict] = [{"role": m["role"], "content": m["parts"][0]} for m in history]
    messages.append({"role": "user", "content": user_message})

    save_message(db, session_id, "user", user_message, 0, 0, model_name)
    try:
        resp = client.messages.create(
            model=model_name, max_tokens=max_tokens,
            system=ADMIN_SYSTEM_PROMPT, messages=messages,
        )
        reply = resp.content[0].text if resp.content else ""
        ti = resp.usage.input_tokens if resp.usage else 0
        to = resp.usage.output_tokens if resp.usage else 0
        save_message(db, session_id, "assistant", reply, ti, to, model_name)
        return {
            "session_id": session_id, "reply": reply,
            "tool_calls": [], "pending_actions": [],
            "tokens_used": ti + to,
            "cost_usd": _calc_cost(model_name, ti, to),
            "provider": "anthropic",
        }
    except Exception as e:
        logger.error(f"Anthropic admin chat error: {e}")
        friendly = _friendly_error(e)
        save_message(db, session_id, "assistant", friendly, 0, 0, model_name)
        return {"session_id": session_id, "reply": friendly, "error": "service_error",
                "tool_calls": [], "pending_actions": [], "tokens_used": 0, "cost_usd": 0.0}


def admin_chat(
    db: Session,
    user_message: str,
    session_id: Optional[str],
    user_id: int,
    image_data: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Admin AI Assistant chat.
    Supports Gemini (full tools + pending actions), OpenAI, Anthropic, Groq.
    Write operations always return pending_actions — never auto-execute.
    Returns: { session_id, reply, tool_calls, pending_actions, tokens_used, cost_usd }
    """
    model_name = _get_setting(db, "ADMIN_MODEL", os.environ.get("AI_ADMIN_MODEL", GEMINI_FLASH))
    max_tokens = int(_get_setting(db, "ADMIN_MAX_TOKENS", os.environ.get("AI_ADMIN_MAX_TOKENS", "2048")))
    max_history = int(_get_setting(db, "ADMIN_HISTORY", "10"))
    provider = _get_setting(db, "AI_PROVIDER", "gemini").lower()

    session_id = get_or_create_session(db, session_id or "", user_id, "admin")

    # ── Route to non-Gemini providers (text-only, no tool calling) ───────────
    if provider == "openai" and OPENAI_AVAILABLE:
        api_key = _get_setting(db, "OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
        if not api_key:
            api_key = _get_api_key()  # fallback
        return _admin_chat_openai(db, user_message, session_id, user_id,
                                  model_name, api_key, None, max_tokens, max_history)

    if provider == "groq" and OPENAI_AVAILABLE:
        api_key = _get_setting(db, "GROQ_API_KEY", os.environ.get("GROQ_API_KEY", ""))
        return _admin_chat_openai(db, user_message, session_id, user_id,
                                  model_name, api_key, "https://api.groq.com/openai/v1",
                                  max_tokens, max_history)

    if provider == "anthropic" and ANTHROPIC_AVAILABLE:
        api_key = _get_setting(db, "ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY", ""))
        return _admin_chat_anthropic(db, user_message, session_id, user_id,
                                     model_name, api_key, max_tokens, max_history)

    # ── Default: Gemini with full tool support ────────────────────────────────
    api_key = _get_api_key()
    genai.configure(api_key=api_key)

    # Combine read-only + write tools
    all_tools = _admin_tools() + _admin_write_tool_definitions()
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=ADMIN_SYSTEM_PROMPT,
        tools=[{"function_declarations": all_tools}],
        generation_config={"max_output_tokens": max_tokens, "temperature": 0.4},
    )
    history = get_session_history(db, session_id, max_messages=max_history)
    chat = model.start_chat(history=history)

    parts: List[Any] = [user_message]
    if image_data:
        for img in image_data[:3]:
            parts.append({"mime_type": img["mime_type"], "data": img["data"]})

    save_message(db, session_id, "user", user_message, 0, 0, model_name,
                 image_urls=[img.get("url") for img in (image_data or [])])

    try:
        response = chat.send_message(parts)
        tokens_in = response.usage_metadata.prompt_token_count or 0
        tokens_out = response.usage_metadata.candidates_token_count or 0

        tool_calls_log: Dict = {}
        pending_actions: List[Dict] = []
        final_text = ""

        for part in response.parts:
            if hasattr(part, "function_call") and part.function_call:
                fc = part.function_call
                fc_name = fc.name
                fc_args = dict(fc.args)

                if fc_name in WRITE_TOOLS:
                    # Build pending action — DO NOT execute
                    pending = _build_pending_action(db, fc_name, fc_args)
                    pending_actions.append(pending)
                    tool_result = json.dumps({
                        "status": "pending_confirmation",
                        "message": "Action prepared for admin confirmation.",
                    })
                else:
                    tool_result = _execute_admin_tool(db, fc_name, fc_args)

                tool_calls_log[fc_name] = {"args": fc_args}

                follow_up = chat.send_message(
                    genai.protos.Content(parts=[
                        genai.protos.Part(function_response=genai.protos.FunctionResponse(
                            name=fc_name, response={"result": tool_result}
                        ))
                    ])
                )
                tokens_in += follow_up.usage_metadata.prompt_token_count or 0
                tokens_out += follow_up.usage_metadata.candidates_token_count or 0
                final_text = follow_up.text or ""

            elif hasattr(part, "text"):
                final_text += part.text or ""

        final_text = final_text.strip()
        save_message(db, session_id, "assistant", final_text,
                     tokens_in, tokens_out, model_name,
                     tool_calls=tool_calls_log if tool_calls_log else None)

        return {
            "session_id": session_id,
            "reply": final_text,
            "tool_calls": list(tool_calls_log.keys()),
            "pending_actions": pending_actions,
            "tokens_used": tokens_in + tokens_out,
            "cost_usd": _calc_cost(model_name, tokens_in, tokens_out),
            "provider": "gemini",
        }

    except Exception as e:
        logger.error(f"Admin chat error: {e}")
        friendly = _friendly_error(e)
        save_message(db, session_id, "assistant", friendly, 0, 0, model_name)
        return {
            "session_id": session_id,
            "reply": friendly,
            "error": "service_error",
            "tool_calls": [],
            "pending_actions": [],
            "tokens_used": 0,
            "cost_usd": 0.0,
        }


def generate_product_embeddings_batch(
    db: Session,
    product_ids: Optional[List[int]] = None,
    batch_size: int = 50,
) -> Dict[str, Any]:
    """
    Generate / refresh embeddings for products.
    If product_ids is None → regenerates all products without embeddings.
    Returns { updated, skipped, errors, total }.
    """
    try:
        api_key = _get_api_key()
    except ValueError as e:
        return {"success": False, "error": str(e), "updated": 0, "skipped": 0, "errors": 0}

    if product_ids:
        rows = db.execute(text("""
            SELECT p.id, p.name, p.description, c.name as category
            FROM products p
            LEFT JOIN collections c ON c.id = p.category_id
            WHERE p.id = ANY(:ids)
        """), {"ids": product_ids}).fetchall()
    else:
        rows = db.execute(text("""
            SELECT p.id, p.name, p.description, c.name as category
            FROM products p
            LEFT JOIN collections c ON c.id = p.category_id
            WHERE p.embedding IS NULL
            ORDER BY p.id
            LIMIT :bs
        """), {"bs": batch_size}).fetchall()

    updated = skipped = errors = 0
    for row in rows:
        pid, name, desc, cat = row[0], row[1], row[2] or "", row[3] or ""
        tags = ""
        embed_text = _product_embed_text(name, desc, cat, tags)
        vec = _generate_embedding(embed_text, api_key)
        if vec is None:
            errors += 1
            continue
        try:
            db.execute(text("""
                UPDATE products SET embedding = :vec::vector
                WHERE id = :pid
            """), {"vec": _vec_str(vec), "pid": pid})
            db.commit()
            updated += 1
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save embedding for product #{pid}: {e}")
            errors += 1

    total = db.execute(text(
        "SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL"
    )).scalar() or 0

    return {
        "success": True,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "total_with_embeddings": total,
        "message": f"Generated {updated} embeddings ({errors} errors). {total} products indexed total.",
    }


def generate_single_product_embedding(db: Session, product_id: int) -> Dict[str, Any]:
    """Generate or refresh embedding for a single product."""
    return generate_product_embeddings_batch(db, product_ids=[product_id], batch_size=1)


def get_ai_analytics(db: Session, days: int = 30) -> Dict[str, Any]:
    """Admin analytics for AI usage and cost."""
    by_role = db.execute(text(f"""
        SELECT role, COUNT(*) as sessions, SUM(message_count),
               SUM(total_tokens_in), SUM(total_tokens_out), SUM(total_cost)
        FROM ai_sessions
        WHERE created_at >= NOW() - INTERVAL '{days} days'
        GROUP BY role
    """)).fetchall()

    daily = db.execute(text(f"""
        SELECT DATE(last_activity) as day, role, COUNT(*) as sessions,
               SUM(total_cost) as daily_cost
        FROM ai_sessions
        WHERE created_at >= NOW() - INTERVAL '{days} days'
        GROUP BY DATE(last_activity), role
        ORDER BY day
    """)).fetchall()

    total_cost = db.execute(text(
        f"SELECT COALESCE(SUM(total_cost), 0) FROM ai_sessions WHERE created_at >= NOW() - INTERVAL '{days} days'"
    )).scalar() or 0

    return {
        "period_days": days,
        "total_cost_usd": float(total_cost),
        "by_role": [
            {
                "role": r[0], "sessions": r[1],
                "messages": r[2] or 0,
                "tokens_in": r[3] or 0, "tokens_out": r[4] or 0,
                "cost_usd": float(r[5] or 0)
            }
            for r in by_role
        ],
        "daily_breakdown": [
            {"date": str(r[0]), "role": r[1], "sessions": r[2], "cost_usd": float(r[3] or 0)}
            for r in daily
        ]
    }
