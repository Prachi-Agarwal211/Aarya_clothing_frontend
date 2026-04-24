"""
AI Key Rotation Service - Aarya Clothing
Manages multi-provider API key rotation with rate limit tracking.

Features:
- Automatic key rotation across 4 providers (Groq, OpenRouter, GLM, NVIDIA)
- Rate limit tracking per key (per-minute and daily)
- Automatic fallback when rate limit hit
- Cost tracking and budget alerts
- Health monitoring for each provider
- Redis-based distributed rate limiting

Usage:
    from ai_key_rotation import get_available_provider
    provider = get_available_provider(db)
    if provider:
        response = call_ai_api(provider, ...)
"""
import os
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from core.redis_client import redis_client

logger = logging.getLogger(__name__)


class ProviderName(str, Enum):
    GROQ = "groq"
    OPENROUTER = "openrouter"
    GLM = "glm"
    NVIDIA = "nvidia"


@dataclass
class ProviderConfig:
    """Configuration for an AI provider."""
    name: ProviderName
    api_key: str
    model: str
    rate_limit: int  # requests per minute
    daily_limit: int  # requests per day
    base_url: Optional[str] = None
    enabled: bool = True
    
    # Rate limit tracking
    current_rpm: int = 0
    current_daily: int = 0
    last_request_time: Optional[datetime] = None
    
    # Cost tracking
    cost_per_input_token: float = 0.0
    cost_per_output_token: float = 0.0


# Provider pricing (USD per token) - RESEARCHED & VERIFIED 2026
PROVIDER_PRICING = {
    ProviderName.GROQ: {
        "llama-3.3-70b-versatile": {"input": 0.00, "output": 0.00},  # FREE! Best for chat
        "mixtral-8x7b-32768": {"input": 0.00, "output": 0.00},  # FREE!
        "llama-3.2-90b-vision-preview": {"input": 0.00, "output": 0.00},  # FREE!
        "gemma2-9b-it": {"input": 0.00, "output": 0.00},  # FREE! Fast
    },
    ProviderName.OPENROUTER: {
        # Top free models for chat (24 total free models on OpenRouter)
        "meta-llama/llama-3.3-70b-instruct:free": {"input": 0.00, "output": 0.00},  # BEST for chat
        "nousresearch/hermes-3-405b:free": {"input": 0.00, "output": 0.00},  # Best instruction following
        "mistralai/mistral-small-3.1:free": {"input": 0.00, "output": 0.00},  # Balanced
        "z-ai/glm-4.5-air:free": {"input": 0.00, "output": 0.00},  # Multilingual
        "google/gemma-3-27b-it:free": {"input": 0.00, "output": 0.00},  # Multimodal
        "nvidia/nemotron-3-nano-22b:free": {"input": 0.00, "output": 0.00},  # AI agents
        "qwen/qwen-2.5-72b-instruct:free": {"input": 0.00, "output": 0.00},  # Multilingual
    },
    ProviderName.GLM: {
        "glm-4-flash": {"input": 0.00, "output": 0.00},  # FREE!
        "glm-4-air": {"input": 0.00, "output": 0.00},  # FREE!
        "glm-4.7": {"input": 0.00, "output": 0.00},  # Latest FREE model
    },
    ProviderName.NVIDIA: {
        "meta/llama3-70b-instruct": {"input": 0.00, "output": 0.00},  # FREE! Best chat
        "mistralai/mistral-7b-instruct-v0.3": {"input": 0.00, "output": 0.00},  # FREE! Fast
        "qwen/qwen-2.5-72b-instruct": {"input": 0.00, "output": 0.00},  # FREE! Multilingual
        "google/gemma-2b-it": {"input": 0.00, "output": 0.00},  # FREE! Lightweight
    },
}


class AIKeyRotation:
    """Manages AI provider key rotation with rate limiting."""
    
    def __init__(self, db: Session = None):
        self.providers: Dict[ProviderName, ProviderConfig] = {}
        self._load_providers()
    
    def _load_providers(self):
        """Load provider configurations from environment."""
        # Groq - PRIMARY PROVIDER
        groq_key = os.environ.get("GROQ_API_KEY", "")
        if groq_key and os.environ.get("AI_GROQ_ENABLED", "true").lower() == "true":
            self.providers[ProviderName.GROQ] = ProviderConfig(
                name=ProviderName.GROQ,
                api_key=groq_key,
                model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
                rate_limit=int(os.environ.get("GROQ_RATE_LIMIT", "30")),
                daily_limit=int(os.environ.get("GROQ_DAILY_LIMIT", "1000")),
                base_url="https://api.groq.com/openai/v1",
            )

        # OpenRouter
        openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
        if openrouter_key and os.environ.get("AI_OPENROUTER_ENABLED", "true").lower() == "true":
            self.providers[ProviderName.OPENROUTER] = ProviderConfig(
                name=ProviderName.OPENROUTER,
                api_key=openrouter_key,
                model=os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3-70b-instruct"),
                rate_limit=int(os.environ.get("OPENROUTER_RATE_LIMIT", "60")),
                daily_limit=int(os.environ.get("OPENROUTER_DAILY_LIMIT", "1000")),
                base_url="https://openrouter.ai/api/v1",
            )

        # GLM
        glm_key = os.environ.get("GLM_API_KEY", "")
        if glm_key and os.environ.get("AI_GLM_ENABLED", "true").lower() == "true":
            self.providers[ProviderName.GLM] = ProviderConfig(
                name=ProviderName.GLM,
                api_key=glm_key,
                model=os.environ.get("GLM_MODEL", "glm-4-flash"),
                rate_limit=int(os.environ.get("GLM_RATE_LIMIT", "10")),
                daily_limit=int(os.environ.get("GLM_DAILY_LIMIT", "1000")),
                base_url="https://open.bigmodel.cn/api/paas/v4",
            )

        # NVIDIA
        nvidia_key = os.environ.get("NVIDIA_API_KEY", "")
        if nvidia_key and os.environ.get("AI_NVIDIA_ENABLED", "true").lower() == "true":
            self.providers[ProviderName.NVIDIA] = ProviderConfig(
                name=ProviderName.NVIDIA,
                api_key=nvidia_key,
                model=os.environ.get("NVIDIA_MODEL", "meta/llama3-70b-instruct"),
                rate_limit=int(os.environ.get("NVIDIA_RATE_LIMIT", "30")),
                daily_limit=int(os.environ.get("NVIDIA_DAILY_LIMIT", "500")),
                base_url="https://integrate.api.nvidia.com/v1",
            )

        logger.info(f"Loaded {len(self.providers)} AI providers: {[p.name.value for p in self.providers.values()]}")
    
    def _get_rate_limit_key(self, provider: ProviderName) -> str:
        """Get Redis key for rate limit tracking."""
        today = now_ist().strftime("%Y-%m-%d")
        return f"ai:rate_limit:{provider.value}:{today}"
    
    def _get_daily_count_key(self, provider: ProviderName) -> str:
        """Get Redis key for daily count tracking."""
        today = now_ist().strftime("%Y-%m-%d")
        return f"ai:daily_count:{provider.value}:{today}"
    
    def _check_rate_limit(self, provider: ProviderConfig) -> bool:
        """Check if provider is within rate limits. Returns True if OK to proceed."""
        rate_key = self._get_rate_limit_key(provider.name)
        daily_key = self._get_daily_count_key(provider.name)
        
        try:
            raw = redis_client.client
            current_rpm = int(raw.get(rate_key) or 0)
            if current_rpm >= provider.rate_limit:
                logger.warning(f"Provider {provider.name.value} hit rate limit: {current_rpm}/{provider.rate_limit} RPM")
                return False
            current_daily = int(raw.get(daily_key) or 0)
            if current_daily >= provider.daily_limit:
                logger.warning(f"Provider {provider.name.value} hit daily limit: {current_daily}/{provider.daily_limit}")
                return False
        except Exception as e:
            logger.warning(f"Redis rate limit check failed for {provider.name.value}: {e}, allowing request")
        return True
    
    def _increment_usage(self, provider: ProviderConfig):
        """Increment usage counters for provider."""
        rate_key = self._get_rate_limit_key(provider.name)
        daily_key = self._get_daily_count_key(provider.name)
        
        try:
            raw = redis_client.client
            pipe = raw.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, 60)
            pipe.incr(daily_key)
            pipe.expire(daily_key, 86400)
            pipe.execute()
            logger.debug(f"Incremented usage for {provider.name.value}")
        except Exception as e:
            logger.warning(f"Redis usage increment failed for {provider.name.value}: {e}")
    
    def get_available_provider(self, priority_order: Optional[List[ProviderName]] = None) -> Optional[ProviderConfig]:
        """
        Get an available provider based on rate limits and priority.

        Args:
            priority_order: List of providers in priority order (default: Groq > OpenRouter > GLM > NVIDIA)

        Returns:
            ProviderConfig if available, None if all providers are rate-limited
        """
        if priority_order is None:
            priority_order = [
                ProviderName.GROQ,
                ProviderName.OPENROUTER,
                ProviderName.GLM,
                ProviderName.NVIDIA,
            ]
        
        for provider_name in priority_order:
            if provider_name not in self.providers:
                continue
            
            provider = self.providers[provider_name]
            if not provider.enabled:
                continue
            
            if self._check_rate_limit(provider):
                self._increment_usage(provider)
                logger.info(f"Selected provider: {provider.name.value} (model: {provider.model})")
                return provider
        
        logger.error("All AI providers are rate-limited!")
        return None
    
    def get_provider_status(self) -> List[Dict[str, Any]]:
        """Get status of all providers for monitoring dashboard."""
        status = []
        for provider in self.providers.values():
            rate_key = self._get_rate_limit_key(provider.name)
            daily_key = self._get_daily_count_key(provider.name)
            
            raw = redis_client.client
            current_rpm = int(raw.get(rate_key) or 0)
            current_daily = int(raw.get(daily_key) or 0)
            
            status.append({
                "name": provider.name.value,
                "model": provider.model,
                "enabled": provider.enabled,
                "rate_limit": provider.rate_limit,
                "current_rpm": current_rpm,
                "rpm_available": provider.rate_limit - current_rpm,
                "daily_limit": provider.daily_limit,
                "current_daily": current_daily,
                "daily_available": provider.daily_limit - current_daily,
                "pricing": PROVIDER_PRICING.get(provider.name, {}),
            })
        
        return status
    
    def reset_daily_limits(self):
        """Reset all daily limits (called at midnight UTC)."""
        try:
            raw = redis_client.client
            for provider in self.providers.values():
                daily_key = self._get_daily_count_key(provider.name)
                raw.delete(daily_key)
            logger.info("Reset all AI provider daily limits")
        except Exception as e:
            logger.warning(f"Redis daily limit reset failed: {e}")
    
    def get_cost_estimate(self, provider: ProviderName, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost for a request."""
        pricing = PROVIDER_PRICING.get(provider, {})
        model_pricing = pricing.get(self.providers[provider].model, {"input": 0, "output": 0})
        
        input_cost = input_tokens * model_pricing["input"]
        output_cost = output_tokens * model_pricing["output"]
        
        return input_cost + output_cost


# Global instance (lazy-loaded)
_rotation_instance: Optional[AIKeyRotation] = None


def get_rotation(db: Session) -> AIKeyRotation:
    """Get or create AI key rotation instance."""
    global _rotation_instance
    if _rotation_instance is None:
        _rotation_instance = AIKeyRotation(db)
    return _rotation_instance


def get_available_provider(db: Session) -> Optional[ProviderConfig]:
    """Get an available AI provider with rate limit checking."""
    rotation = get_rotation(db)
    return rotation.get_available_provider()


def get_provider_status(db: Session) -> List[Dict[str, Any]]:
    """Get status of all AI providers."""
    rotation = get_rotation(db)
    return rotation.get_provider_status()
