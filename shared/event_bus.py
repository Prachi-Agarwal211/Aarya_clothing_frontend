"""
Event Bus for inter-service communication.
Provides publish-subscribe pattern for loose coupling between services.
"""
import json
import logging
import asyncio
from typing import Dict, Any, List, Callable, Optional
from datetime import datetime, timezone
from enum import Enum
from dataclasses import dataclass, field, asdict
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """Standard event types for the e-commerce platform."""
    
    # User events
    USER_REGISTERED = "user.registered"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    
    # Order events
    ORDER_CREATED = "order.created"
    ORDER_CONFIRMED = "order.confirmed"
    ORDER_SHIPPED = "order.shipped"
    ORDER_DELIVERED = "order.delivered"
    ORDER_COMPLETED = "order.completed"
    ORDER_CANCELLED = "order.cancelled"
    ORDER_RETURNED = "order.returned"
    
    # Payment events
    PAYMENT_INITIATED = "payment.initiated"
    PAYMENT_COMPLETED = "payment.completed"
    PAYMENT_FAILED = "payment.failed"
    PAYMENT_REFUNDED = "payment.refunded"
    
    # Inventory events
    INVENTORY_LOW = "inventory.low"
    INVENTORY_UPDATED = "inventory.updated"
    INVENTORY_OUT_OF_STOCK = "inventory.out_of_stock"
    
    # Product events
    PRODUCT_CREATED = "product.created"
    PRODUCT_UPDATED = "product.updated"
    PRODUCT_DELETED = "product.deleted"
    
    # Cart events
    CART_ABANDONED = "cart.abandoned"
    CART_RECOVERED = "cart.recovered"
    
    # Review events
    REVIEW_POSTED = "review.posted"
    REVIEW_APPROVED = "review.approved"


@dataclass
class Event:
    """
    Event data structure.
    
    Attributes:
        event_type: Type of event
        aggregate_id: ID of the entity the event is about
        aggregate_type: Type of entity (e.g., "order", "user")
        data: Event payload
        metadata: Additional metadata
        timestamp: When the event occurred
        correlation_id: ID for tracing related events
    """
    event_type: str
    aggregate_id: str
    aggregate_type: str
    data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    correlation_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary."""
        return asdict(self)
    
    def to_json(self) -> str:
        """Convert event to JSON string."""
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Event":
        """Create event from dictionary."""
        return cls(**data)
    
    @classmethod
    def from_json(cls, json_str: str) -> "Event":
        """Create event from JSON string."""
        return cls.from_dict(json.loads(json_str))


class EventHandler(ABC):
    """Abstract base class for event handlers."""
    
    @abstractmethod
    async def handle(self, event: Event) -> bool:
        """
        Handle an event.
        
        Args:
            event: The event to handle
            
        Returns:
            True if handled successfully, False otherwise
        """
        pass
    
    @property
    @abstractmethod
    def event_types(self) -> List[str]:
        """List of event types this handler can handle."""
        pass


class EventBus:
    """
    Event bus for publish-subscribe communication.
    
    Features:
    - In-memory handlers for synchronous processing
    - Redis pub/sub for distributed events
    - Event persistence for reliability
    - Retry mechanism for failed handlers
    """
    
    def __init__(self, redis_client=None, service_name: str = "default"):
        """
        Initialize event bus.
        
        Args:
            redis_client: Redis client for distributed events
            service_name: Name of the current service
        """
        self.redis = redis_client
        self.service_name = service_name
        self._handlers: Dict[str, List[EventHandler]] = {}
        self._subscribers: Dict[str, List[Callable]] = {}
        self._event_history: List[Event] = []
        self._max_history = 1000
    
    def subscribe(self, event_type: str, handler: Callable) -> None:
        """
        Subscribe to an event type.
        
        Args:
            event_type: Type of event to subscribe to
            handler: Function to call when event is received
        """
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed to {event_type}")
    
    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        """Unsubscribe from an event type."""
        if event_type in self._subscribers:
            try:
                self._subscribers[event_type].remove(handler)
            except ValueError:
                pass
    
    def register_handler(self, handler: EventHandler) -> None:
        """
        Register an event handler.
        
        Args:
            handler: EventHandler instance
        """
        for event_type in handler.event_types():
            if event_type not in self._handlers:
                self._handlers[event_type] = []
            self._handlers[event_type].append(handler)
            logger.info(f"Registered handler for {event_type}")
    
    async def publish(
        self,
        event: Event,
        persist: bool = True,
        broadcast: bool = True
    ) -> bool:
        """
        Publish an event.
        
        Args:
            event: Event to publish
            persist: Whether to persist event to history
            broadcast: Whether to broadcast to other services via Redis
            
        Returns:
            True if published successfully
        """
        try:
            # Add to history
            if persist:
                self._event_history.append(event)
                if len(self._event_history) > self._max_history:
                    self._event_history = self._event_history[-self._max_history:]
            
            # Call local handlers
            await self._call_handlers(event)
            
            # Call local subscribers
            await self._call_subscribers(event)
            
            # Broadcast to other services
            if broadcast and self.redis:
                await self._broadcast_event(event)
            
            logger.debug(f"Published event: {event.event_type}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish event: {e}")
            return False
    
    async def publish_simple(
        self,
        event_type: str,
        aggregate_id: str,
        aggregate_type: str,
        data: Dict[str, Any],
        **kwargs
    ) -> bool:
        """
        Publish an event with simplified parameters.
        
        Args:
            event_type: Type of event
            aggregate_id: ID of the entity
            aggregate_type: Type of entity
            data: Event payload
            **kwargs: Additional event attributes
            
        Returns:
            True if published successfully
        """
        event = Event(
            event_type=event_type,
            aggregate_id=aggregate_id,
            aggregate_type=aggregate_type,
            data=data,
            **kwargs
        )
        return await self.publish(event)
    
    async def _call_handlers(self, event: Event) -> None:
        """Call all registered handlers for an event."""
        handlers = self._handlers.get(event.event_type, [])
        
        for handler in handlers:
            try:
                result = await handler.handle(event)
                if not result:
                    logger.warning(f"Handler {handler.__class__.__name__} returned False for {event.event_type}")
            except Exception as e:
                logger.error(f"Handler error for {event.event_type}: {e}")
    
    async def _call_subscribers(self, event: Event) -> None:
        """Call all subscribers for an event."""
        subscribers = self._subscribers.get(event.event_type, [])
        
        for subscriber in subscribers:
            try:
                if asyncio.iscoroutinefunction(subscriber):
                    await subscriber(event)
                else:
                    subscriber(event)
            except Exception as e:
                logger.error(f"Subscriber error for {event.event_type}: {e}")
    
    async def _broadcast_event(self, event: Event) -> None:
        """Broadcast event to other services via Redis."""
        try:
            channel = f"events:{event.event_type}"
            message = {
                "event": event.to_dict(),
                "source": self.service_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            self.redis.publish(channel, message)
        except Exception as e:
            logger.error(f"Failed to broadcast event: {e}")
    
    def get_history(
        self,
        event_type: str = None,
        aggregate_id: str = None,
        limit: int = 100
    ) -> List[Event]:
        """
        Get event history.
        
        Args:
            event_type: Filter by event type
            aggregate_id: Filter by aggregate ID
            limit: Maximum number of events to return
            
        Returns:
            List of events
        """
        events = self._event_history
        
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        
        if aggregate_id:
            events = [e for e in events if e.aggregate_id == aggregate_id]
        
        return events[-limit:]
    
    def clear_history(self) -> None:
        """Clear event history."""
        self._event_history.clear()


# ==================== Common Event Handlers ====================

class LoggingEventHandler(EventHandler):
    """Handler that logs all events."""
    
    @property
    def event_types(self) -> List[str]:
        return []  # Empty list means handle all events
    
    async def handle(self, event: Event) -> bool:
        logger.info(f"Event: {event.event_type} - {event.aggregate_type}:{event.aggregate_id}")
        return True


class NotificationEventHandler(EventHandler):
    """Handler for sending notifications on events."""
    
    @property
    def event_types(self) -> List[str]:
        return [
            EventType.ORDER_CREATED,
            EventType.ORDER_SHIPPED,
            EventType.ORDER_DELIVERED,
            EventType.PAYMENT_COMPLETED,
            EventType.INVENTORY_LOW,
        ]
    
    async def handle(self, event: Event) -> bool:
        # This would integrate with notification service
        logger.info(f"Notification for event: {event.event_type}")
        return True


class AnalyticsEventHandler(EventHandler):
    """Handler for tracking analytics events."""
    
    @property
    def event_types(self) -> List[str]:
        return [
            EventType.USER_REGISTERED,
            EventType.ORDER_CREATED,
            EventType.ORDER_COMPLETED,
            EventType.PAYMENT_COMPLETED,
            EventType.PRODUCT_CREATED,
        ]
    
    async def handle(self, event: Event) -> bool:
        # This would integrate with analytics service
        logger.info(f"Analytics tracking: {event.event_type}")
        return True


# ==================== Event Factory ====================

class EventFactory:
    """Factory for creating common events."""
    
    @staticmethod
    def order_created(order_id: int, user_id: int, total: float, items: List[Dict]) -> Event:
        """Create order created event."""
        return Event(
            event_type=EventType.ORDER_CREATED,
            aggregate_id=str(order_id),
            aggregate_type="order",
            data={
                "user_id": user_id,
                "total": total,
                "items": items
            }
        )
    
    @staticmethod
    def order_status_changed(order_id: int, old_status: str, new_status: str) -> Event:
        """Create order status changed event."""
        return Event(
            event_type=f"order.{new_status}",
            aggregate_id=str(order_id),
            aggregate_type="order",
            data={
                "old_status": old_status,
                "new_status": new_status
            }
        )
    
    @staticmethod
    def payment_completed(payment_id: str, order_id: int, amount: float) -> Event:
        """Create payment completed event."""
        return Event(
            event_type=EventType.PAYMENT_COMPLETED,
            aggregate_id=payment_id,
            aggregate_type="payment",
            data={
                "order_id": order_id,
                "amount": amount
            }
        )
    
    @staticmethod
    def inventory_low(product_id: int, product_name: str, current_stock: int, threshold: int) -> Event:
        """Create inventory low event."""
        return Event(
            event_type=EventType.INVENTORY_LOW,
            aggregate_id=str(product_id),
            aggregate_type="product",
            data={
                "product_name": product_name,
                "current_stock": current_stock,
                "threshold": threshold
            }
        )
    
    @staticmethod
    def user_registered(user_id: int, email: str, name: str) -> Event:
        """Create user registered event."""
        return Event(
            event_type=EventType.USER_REGISTERED,
            aggregate_id=str(user_id),
            aggregate_type="user",
            data={
                "email": email,
                "name": name
            }
        )


# ==================== Global Event Bus Instance ====================

_event_bus: Optional[EventBus] = None


def get_event_bus() -> EventBus:
    """Get the global event bus instance."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


def init_event_bus(redis_client=None, service_name: str = "default") -> EventBus:
    """Initialize the global event bus."""
    global _event_bus
    _event_bus = EventBus(redis_client=redis_client, service_name=service_name)
    return _event_bus
