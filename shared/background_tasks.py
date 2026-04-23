"""
Background task utilities for async processing.
Provides task queue, scheduling, and execution management.
"""
import asyncio
import logging
from typing import Callable, Any, Dict, List, Optional, Union
from datetime import datetime, timedelta

from shared.time_utils import now_ist
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod
import json

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRY = "retry"
    CANCELLED = "cancelled"


class TaskPriority(int, Enum):
    """Task priority levels."""
    LOW = 1
    NORMAL = 5
    HIGH = 10
    CRITICAL = 20


@dataclass
class TaskResult:
    """Result of a task execution."""
    task_id: str
    status: TaskStatus
    result: Any = None
    error: str = None
    started_at: datetime = None
    completed_at: datetime = None
    duration_ms: int = None
    retries: int = 0


@dataclass
class Task:
    """
    Task definition for background processing.
    
    Attributes:
        task_id: Unique task identifier
        name: Task name
        func: Function to execute
        args: Positional arguments
        kwargs: Keyword arguments
        priority: Task priority
        max_retries: Maximum retry attempts
        retry_delay: Delay between retries in seconds
        timeout: Task timeout in seconds
        scheduled_at: When to execute the task
        created_at: When the task was created
    """
    task_id: str
    name: str
    func: Callable
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    priority: int = TaskPriority.NORMAL
    max_retries: int = 3
    retry_delay: float = 1.0
    timeout: float = 300.0
    scheduled_at: datetime = None
    created_at: datetime = field(default_factory=now_ist)
    
    def __lt__(self, other):
        """Compare tasks by priority for queue ordering."""
        return self.priority > other.priority


class TaskBackend(ABC):
    """Abstract base class for task backends."""
    
    @abstractmethod
    async def enqueue(self, task: Task) -> str:
        """Add a task to the queue."""
        pass
    
    @abstractmethod
    async def dequeue(self) -> Optional[Task]:
        """Get the next task from the queue."""
        pass
    
    @abstractmethod
    async def get_status(self, task_id: str) -> Optional[TaskResult]:
        """Get the status of a task."""
        pass
    
    @abstractmethod
    async def update_status(self, result: TaskResult) -> None:
        """Update task status."""
        pass


class InMemoryTaskBackend(TaskBackend):
    """In-memory task backend for development and testing."""
    
    def __init__(self):
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._results: Dict[str, TaskResult] = {}
        self._task_counter = 0
    
    async def enqueue(self, task: Task) -> str:
        """Add a task to the queue."""
        self._task_counter += 1
        task.task_id = f"task_{self._task_counter}"
        await self._queue.put(task)
        
        # Initialize result
        self._results[task.task_id] = TaskResult(
            task_id=task.task_id,
            status=TaskStatus.PENDING
        )
        
        return task.task_id
    
    async def dequeue(self) -> Optional[Task]:
        """Get the next task from the queue."""
        try:
            return await asyncio.wait_for(self._queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            return None
    
    async def get_status(self, task_id: str) -> Optional[TaskResult]:
        """Get the status of a task."""
        return self._results.get(task_id)
    
    async def update_status(self, result: TaskResult) -> None:
        """Update task status."""
        self._results[result.task_id] = result


class RedisTaskBackend(TaskBackend):
    """Redis-backed task backend for production."""
    
    def __init__(self, redis_client, prefix: str = "tasks"):
        self.redis = redis_client
        self.prefix = prefix
        self._task_counter = 0
    
    def _queue_key(self) -> str:
        return f"{self.prefix}:queue"
    
    def _result_key(self, task_id: str) -> str:
        return f"{self.prefix}:result:{task_id}"
    
    def _task_key(self, task_id: str) -> str:
        return f"{self.prefix}:task:{task_id}"
    
    async def enqueue(self, task: Task) -> str:
        """Add a task to the queue."""
        import uuid
        task.task_id = str(uuid.uuid4())
        
        # Store task data
        task_data = {
            "task_id": task.task_id,
            "name": task.name,
            "args": task.args,
            "kwargs": task.kwargs,
            "priority": task.priority,
            "max_retries": task.max_retries,
            "retry_delay": task.retry_delay,
            "timeout": task.timeout,
            "scheduled_at": task.scheduled_at.isoformat() if task.scheduled_at else None,
            "created_at": task.created_at.isoformat()
        }
        
        # Add to queue (using sorted set for priority)
        score = -task.priority  # Negative for descending order
        self.redis.client.zadd(
            self._queue_key(),
            {json.dumps(task_data): score}
        )
        
        # Initialize result
        result = TaskResult(
            task_id=task.task_id,
            status=TaskStatus.PENDING
        )
        await self.update_status(result)
        
        return task.task_id
    
    async def dequeue(self) -> Optional[Task]:
        """Get the next task from the queue."""
        # Get highest priority task
        result = self.redis.client.zpopmax(self._queue_key())
        
        if not result:
            return None
        
        task_data = json.loads(result[0][0])
        
        # Reconstruct task (without func - needs to be registered)
        from functools import partial
        task = Task(
            task_id=task_data["task_id"],
            name=task_data["name"],
            func=partial(lambda: None),  # Placeholder
            args=tuple(task_data.get("args", [])),
            kwargs=task_data.get("kwargs", {}),
            priority=task_data.get("priority", TaskPriority.NORMAL),
            max_retries=task_data.get("max_retries", 3),
            retry_delay=task_data.get("retry_delay", 1.0),
            timeout=task_data.get("timeout", 300.0),
            scheduled_at=datetime.fromisoformat(task_data["scheduled_at"]) if task_data.get("scheduled_at") else None,
            created_at=datetime.fromisoformat(task_data["created_at"])
        )
        
        return task
    
    async def get_status(self, task_id: str) -> Optional[TaskResult]:
        """Get the status of a task."""
        data = self.redis.client.get(self._result_key(task_id))
        if data:
            result_dict = json.loads(data)
            return TaskResult(**result_dict)
        return None
    
    async def update_status(self, result: TaskResult) -> None:
        """Update task status."""
        result_data = {
            "task_id": result.task_id,
            "status": result.status.value,
            "result": result.result,
            "error": result.error,
            "started_at": result.started_at.isoformat() if result.started_at else None,
            "completed_at": result.completed_at.isoformat() if result.completed_at else None,
            "duration_ms": result.duration_ms,
            "retries": result.retries
        }
        self.redis.client.setex(
            self._result_key(result.task_id),
            86400,  # 24 hours TTL
            json.dumps(result_data)
        )


class TaskWorker:
    """
    Worker for processing background tasks.
    
    Features:
    - Concurrent task execution
    - Retry with exponential backoff
    - Timeout handling
    - Task registration
    """
    
    def __init__(
        self,
        backend: TaskBackend,
        max_concurrent: int = 10,
        poll_interval: float = 1.0
    ):
        self.backend = backend
        self.max_concurrent = max_concurrent
        self.poll_interval = poll_interval
        self._registered_tasks: Dict[str, Callable] = {}
        self._running = False
        self._active_tasks: Dict[str, asyncio.Task] = {}
    
    def register(self, name: str, func: Callable) -> None:
        """Register a task function."""
        self._registered_tasks[name] = func
        logger.info(f"Registered task: {name}")
    
    def task(self, name: str = None):
        """
        Decorator to register a task function.
        
        Example:
            @worker.task("send_email")
            async def send_email(to: str, subject: str, body: str):
                ...
        """
        def decorator(func: Callable) -> Callable:
            task_name = name or func.__name__
            self.register(task_name, func)
            return func
        return decorator
    
    async def start(self) -> None:
        """Start the worker."""
        self._running = True
        logger.info(f"Task worker started (max_concurrent={self.max_concurrent})")
        
        while self._running:
            try:
                # Check if we can accept more tasks
                if len(self._active_tasks) < self.max_concurrent:
                    task = await self.backend.dequeue()
                    
                    if task:
                        # Create async task for execution
                        async_task = asyncio.create_task(self._execute_task(task))
                        self._active_tasks[task.task_id] = async_task
                
                # Clean up completed tasks
                done_task_ids = [
                    tid for tid, t in self._active_tasks.items() 
                    if t.done()
                ]
                for tid in done_task_ids:
                    del self._active_tasks[tid]
                
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(self.poll_interval)
    
    async def stop(self) -> None:
        """Stop the worker gracefully."""
        self._running = False
        
        # Wait for active tasks to complete
        if self._active_tasks:
            logger.info(f"Waiting for {len(self._active_tasks)} active tasks...")
            await asyncio.gather(*self._active_tasks.values(), return_exceptions=True)
        
        logger.info("Task worker stopped")
    
    async def _execute_task(self, task: Task) -> TaskResult:
        """Execute a task with retry logic."""
        func = self._registered_tasks.get(task.name)
        
        if not func:
            return TaskResult(
                task_id=task.task_id,
                status=TaskStatus.FAILED,
                error=f"Task '{task.name}' not registered"
            )
        
        result = TaskResult(
            task_id=task.task_id,
            status=TaskStatus.RUNNING,
            started_at=now_ist()
        )
        
        await self.backend.update_status(result)
        
        for attempt in range(task.max_retries + 1):
            try:
                # Execute with timeout
                if asyncio.iscoroutinefunction(func):
                    task_result = await asyncio.wait_for(
                        func(*task.args, **task.kwargs),
                        timeout=task.timeout
                    )
                else:
                    # Run sync function in executor
                    loop = asyncio.get_event_loop()
                    task_result = await asyncio.wait_for(
                        loop.run_in_executor(
                            None, 
                            lambda: func(*task.args, **task.kwargs)
                        ),
                        timeout=task.timeout
                    )
                
                # Success
                result.status = TaskStatus.COMPLETED
                result.result = task_result
                result.completed_at = now_ist()
                result.duration_ms = int(
                    (result.completed_at - result.started_at).total_seconds() * 1000
                )
                
                await self.backend.update_status(result)
                logger.info(f"Task {task.task_id} completed in {result.duration_ms}ms")
                return result
                
            except asyncio.TimeoutError:
                error_msg = f"Task timed out after {task.timeout}s"
                logger.warning(f"Task {task.task_id} timeout (attempt {attempt + 1})")
                
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Task {task.task_id} error (attempt {attempt + 1}): {e}")
            
            # Retry logic
            if attempt < task.max_retries:
                result.retries = attempt + 1
                result.status = TaskStatus.RETRY
                await self.backend.update_status(result)
                
                # Exponential backoff
                delay = task.retry_delay * (2 ** attempt)
                await asyncio.sleep(delay)
        
        # All retries exhausted
        result.status = TaskStatus.FAILED
        result.error = error_msg
        result.completed_at = now_ist()
        result.duration_ms = int(
            (result.completed_at - result.started_at).total_seconds() * 1000
        )
        
        await self.backend.update_status(result)
        logger.error(f"Task {task.task_id} failed after {task.max_retries} retries")
        return result


class TaskQueue:
    """
    High-level task queue for enqueuing tasks.
    
    Example:
        queue = TaskQueue(backend)
        
        # Enqueue task
        task_id = await queue.enqueue("send_email", to="user@example.com", subject="Welcome")
        
        # Check status
        result = await queue.get_status(task_id)
    """
    
    def __init__(self, backend: TaskBackend):
        self.backend = backend
        self._task_counter = 0
    
    async def enqueue(
        self,
        name: str,
        *args,
        priority: int = TaskPriority.NORMAL,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        timeout: float = 300.0,
        scheduled_at: datetime = None,
        **kwargs
    ) -> str:
        """
        Enqueue a task for execution.
        
        Args:
            name: Task name (must be registered with worker)
            *args: Positional arguments for the task
            priority: Task priority
            max_retries: Maximum retry attempts
            retry_delay: Base delay between retries
            timeout: Task timeout in seconds
            scheduled_at: When to execute the task
            **kwargs: Keyword arguments for the task
            
        Returns:
            Task ID
        """
        self._task_counter += 1
        
        task = Task(
            task_id=f"task_{self._task_counter}",
            name=name,
            func=lambda: None,  # Placeholder
            args=args,
            kwargs=kwargs,
            priority=priority,
            max_retries=max_retries,
            retry_delay=retry_delay,
            timeout=timeout,
            scheduled_at=scheduled_at
        )
        
        return await self.backend.enqueue(task)
    
    async def get_status(self, task_id: str) -> Optional[TaskResult]:
        """Get the status of a task."""
        return await self.backend.get_status(task_id)
    
    async def schedule(
        self,
        name: str,
        scheduled_at: datetime,
        *args,
        **kwargs
    ) -> str:
        """
        Schedule a task for future execution.
        
        Args:
            name: Task name
            scheduled_at: When to execute the task
            *args: Positional arguments
            **kwargs: Keyword arguments
            
        Returns:
            Task ID
        """
        return await self.enqueue(
            name,
            *args,
            scheduled_at=scheduled_at,
            **kwargs
        )


# ==================== Common Background Tasks ====================

def register_common_tasks(worker: TaskWorker):
    """Register common background tasks."""
    
    @worker.task("send_email")
    async def send_email(to: str, subject: str, body: str, **kwargs):
        """Send an email (placeholder - integrate with email service)."""
        logger.info(f"Sending email to {to}: {subject}")
        # Integrate with email service
        return {"to": to, "subject": subject, "sent": True}
    
    @worker.task("send_sms")
    async def send_sms(phone: str, message: str, **kwargs):
        """Send an SMS (placeholder - integrate with SMS service)."""
        logger.info(f"Sending SMS to {phone}: {message[:50]}...")
        return {"phone": phone, "sent": True}
    
    @worker.task("update_search_index")
    async def update_search_index(product_id: int, **kwargs):
        """Update search index for a product."""
        logger.info(f"Updating search index for product {product_id}")
        # Integrate with Meilisearch
        return {"product_id": product_id, "indexed": True}
    
    @worker.task("generate_thumbnail")
    async def generate_thumbnail(image_url: str, **kwargs):
        """Generate thumbnail for an image."""
        logger.info(f"Generating thumbnail for {image_url}")
        return {"thumbnail_url": image_url.replace("/original/", "/thumbnail/")}
    
    @worker.task("cleanup_expired_sessions")
    async def cleanup_expired_sessions(**kwargs):
        """Clean up expired sessions from Redis."""
        logger.info("Cleaning up expired sessions")
        # Integrate with Redis
        return {"cleaned": 0}
    
    @worker.task("send_order_notification")
    async def send_order_notification(order_id: int, user_id: int, event: str, **kwargs):
        """Send order notification to user."""
        logger.info(f"Sending order notification: order={order_id}, user={user_id}, event={event}")
        # Integrate with notification service
        return {"order_id": order_id, "notified": True}


# ==================== Global Task Queue Instance ====================

_task_queue: Optional[TaskQueue] = None
_task_worker: Optional[TaskWorker] = None


def get_task_queue() -> TaskQueue:
    """Get the global task queue instance."""
    global _task_queue
    if _task_queue is None:
        backend = InMemoryTaskBackend()
        _task_queue = TaskQueue(backend)
    return _task_queue


def init_task_queue(redis_client=None) -> TaskQueue:
    """Initialize the global task queue."""
    global _task_queue, _task_worker
    
    if redis_client:
        backend = RedisTaskBackend(redis_client)
    else:
        backend = InMemoryTaskBackend()
    
    _task_queue = TaskQueue(backend)
    _task_worker = TaskWorker(backend)
    register_common_tasks(_task_worker)
    
    return _task_queue


async def start_task_worker() -> None:
    """Start the global task worker."""
    global _task_worker
    if _task_worker:
        await _task_worker.start()


async def stop_task_worker() -> None:
    """Stop the global task worker."""
    global _task_worker
    if _task_worker:
        await _task_worker.stop()
