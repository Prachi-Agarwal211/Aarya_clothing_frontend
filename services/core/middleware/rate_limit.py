"""
Rate Limiting Middleware for High Traffic Protection
Prevents brute force attacks and API abuse
"""
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer
from starlette.middleware.base import BaseHTTPMiddleware
import redis
import time
from datetime import datetime, timedelta

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_url="redis://redis:6379"):
        super().__init__(app)
        self.redis = redis.StrictRedis.from_url(redis_url, decode_responses=True)
        
        # Rate limits per endpoint
        self.rate_limits = {
            '/api/v1/auth/register': {'limit': 10, 'window': 60},      # 10/minute
            '/api/v1/auth/login': {'limit': 20, 'window': 60},         # 20/minute
            '/api/v1/auth/verify-otp': {'limit': 5, 'window': 60},      # 5/minute
            '/api/v1/auth/resend-otp': {'limit': 3, 'window': 3600},     # 3/hour
            '/api/v1/auth/forgot-password': {'limit': 3, 'window': 3600}, # 3/hour
        }

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and internal endpoints
        if request.url.path in ['/health', '/metrics']:
            return await call_next(request)
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        
        # Check if this path has rate limiting
        if path not in self.rate_limits:
            return await call_next(request)
        
        limit_config = self.rate_limits[path]
        limit = limit_config['limit']
        window = limit_config['window']
        
        # Create rate limit key
        key = f"ratelimit:{client_ip}:{path}"
        
        # Check current count
        current = self.redis.get(key)
        if current and int(current) >= limit:
            # Get time remaining
            ttl = self.redis.ttl(key)
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Try again in {ttl} seconds."
            )
        
        # Increment counter
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        pipe.execute()
        
        # Add headers
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(limit - (int(self.redis.get(key) or 0)))
        response.headers["X-RateLimit-Reset"] = str(self.redis.ttl(key))
        
        return response
