# Agent Communication Protocols

This document defines standardized communication protocols for AI agents to collaborate effectively using MCP tools.

## Grounding Rules

- Verify the underlying agent interfaces before assuming a method or capability exists.
- Treat the code examples in this document as illustrative unless confirmed by workspace code.
- Do not claim that memory, routing, or messaging APIs exist unless they are present in the actual project.
- If a communication pattern depends on missing infrastructure, mark it as a design suggestion.
- Re-check any edited document before reporting completion.

## Communication Architecture

The following examples describe a communication shape, not a verified implementation contract.

### 1. Message Bus System

```python
class AgentMessageBus:
    def __init__(self, memory_tool):
        self.memory = memory_tool
        self.message_queue = asyncio.Queue()
        self.subscription_manager = SubscriptionManager()
        self.message_router = MessageRouter()
    
    async def publish(self, message: AgentMessage):
        """Publish message to the bus"""
        # Store in memory for persistence
        await self.memory.store_message(message)
        
        # Route to subscribers
        subscribers = await self.subscription_manager.get_subscribers(message.topic)
        for subscriber in subscribers:
            await self.message_router.deliver(message, subscriber)
    
    async def subscribe(self, agent_id: str, topic: str, handler: callable):
        """Subscribe agent to topic"""
        await self.subscription_manager.subscribe(agent_id, topic, handler)
    
    async def create_channel(self, channel_name: str, channel_type: str):
        """Create communication channel"""
        channel = CommunicationChannel(channel_name, channel_type)
        await self.memory.store_channel(channel)
        return channel
```

### 2. Message Standards

```python
@dataclass
class AgentMessage:
    sender_id: str
    recipient_id: Optional[str]
    message_type: MessageType
    content: Dict[str, Any]
    priority: MessagePriority
    timestamp: datetime
    context: MessageContext
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AgentMessage':
        return cls(**data)

class MessageType(Enum):
    REQUEST = "request"
    RESPONSE = "response"
    NOTIFICATION = "notification"
    QUERY = "query"
    COMMAND = "command"
    STATUS_UPDATE = "status_update"
    ERROR = "error"
    COLLABORATION = "collaboration"

class MessagePriority(Enum):
    CRITICAL = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4

class MessageContext:
    def __init__(self, task_id: str, session_id: str, workflow_stage: str):
        self.task_id = task_id
        self.session_id = session_id
        self.workflow_stage = workflow_stage
        self.shared_state = {}
```

## Communication Patterns

### 1. Request-Response Pattern

```python
class RequestResponseHandler:
    def __init__(self, message_bus, timeout_manager):
        self.message_bus = message_bus
        self.timeout_manager = timeout_manager
        self.pending_requests = {}
    
    async def send_request(self, recipient_id: str, request_data: Dict, timeout: int = 30):
        """Send request and wait for response"""
        
        request_id = generate_request_id()
        message = AgentMessage(
            sender_id=self.agent_id,
            recipient_id=recipient_id,
            message_type=MessageType.REQUEST,
            content=request_data,
            priority=MessagePriority.NORMAL,
            timestamp=datetime.now(),
            context=self.current_context,
            metadata={'request_id': request_id}
        )
        
        # Set up response handler
        response_future = asyncio.Future()
        self.pending_requests[request_id] = response_future
        
        # Send request
        await self.message_bus.publish(message)
        
        # Wait for response with timeout
        try:
            response = await asyncio.wait_for(response_future, timeout=timeout)
            return response
        except asyncio.TimeoutError:
            del self.pending_requests[request_id]
            raise RequestTimeoutException(f"Request {request_id} timed out")
    
    async def handle_response(self, response_message: AgentMessage):
        """Handle incoming response"""
        request_id = response_message.metadata.get('request_id')
        if request_id in self.pending_requests:
            future = self.pending_requests[request_id]
            future.set_result(response_message)
            del self.pending_requests[request_id]
```

### 2. Publish-Subscribe Pattern

```python
class PublishSubscribeHandler:
    def __init__(self, message_bus, topic_manager):
        self.message_bus = message_bus
        self.topic_manager = topic_manager
        self.subscriptions = {}
    
    async def publish_to_topic(self, topic: str, content: Dict, priority: MessagePriority = MessagePriority.NORMAL):
        """Publish message to topic"""
        
        message = AgentMessage(
            sender_id=self.agent_id,
            recipient_id=None,  # Broadcast to all subscribers
            message_type=MessageType.NOTIFICATION,
            content=content,
            priority=priority,
            timestamp=datetime.now(),
            context=self.current_context,
            metadata={'topic': topic}
        )
        
        await self.message_bus.publish(message)
    
    async def subscribe_to_topic(self, topic: str, handler: callable):
        """Subscribe to topic with handler"""
        
        if topic not in self.subscriptions:
            self.subscriptions[topic] = []
        
        self.subscriptions[topic].append(handler)
        await self.message_bus.subscribe(self.agent_id, topic, handler)
    
    async def unsubscribe_from_topic(self, topic: str, handler: callable):
        """Unsubscribe from topic"""
        
        if topic in self.subscriptions:
            self.subscriptions[topic].remove(handler)
            if not self.subscriptions[topic]:
                del self.subscriptions[topic]
```

### 3. Collaboration Pattern

```python
class CollaborationHandler:
    def __init__(self, message_bus, collaboration_manager):
        self.message_bus = message_bus
        self.collaboration_manager = collaboration_manager
        self.active_collaborations = {}
    
    async def initiate_collaboration(self, participants: List[str], objective: str, collaboration_type: str):
        """Initiate multi-agent collaboration"""
        
        collaboration_id = generate_collaboration_id()
        collaboration = CollaborationSession(
            collaboration_id=collaboration_id,
            participants=participants,
            objective=objective,
            collaboration_type=collaboration_type,
            initiator=self.agent_id,
            status=CollaborationStatus.INITIATED
        )
        
        # Store collaboration session
        await self.collaboration_manager.store_session(collaboration)
        self.active_collaborations[collaboration_id] = collaboration
        
        # Invite participants
        for participant in participants:
            invitation = AgentMessage(
                sender_id=self.agent_id,
                recipient_id=participant,
                message_type=MessageType.COLLABORATION,
                content={
                    'action': 'invitation',
                    'collaboration_id': collaboration_id,
                    'objective': objective,
                    'collaboration_type': collaboration_type
                },
                priority=MessagePriority.HIGH,
                timestamp=datetime.now(),
                context=self.current_context,
                metadata={'collaboration_id': collaboration_id}
            )
            await self.message_bus.publish(invitation)
        
        return collaboration_id
    
    async def handle_collaboration_message(self, message: AgentMessage):
        """Handle collaboration-related messages"""
        
        collaboration_id = message.metadata.get('collaboration_id')
        action = message.content.get('action')
        
        if collaboration_id in self.active_collaborations:
            collaboration = self.active_collaborations[collaboration_id]
            
            if action == 'accept':
                await self.handle_participant_acceptance(collaboration, message.sender_id)
            elif action == 'decline':
                await self.handle_participant_decline(collaboration, message.sender_id)
            elif action == 'contribution':
                await self.handle_contribution(collaboration, message)
            elif action == 'status_update':
                await self.handle_status_update(collaboration, message)
```

## Context Management

### 1. Shared Context System

```python
class SharedContextManager:
    def __init__(self, memory_tool):
        self.memory = memory_tool
        self.context_versions = {}
        self.context_locks = {}
    
    async def create_shared_context(self, context_id: str, initial_data: Dict):
        """Create shared context for collaboration"""
        
        context = SharedContext(
            context_id=context_id,
            data=initial_data,
            version=1,
            created_at=datetime.now(),
            last_modified=datetime.now(),
            contributors=[self.agent_id]
        )
        
        await self.memory.store_context(context)
        self.context_versions[context_id] = context
        return context_id
    
    async def update_shared_context(self, context_id: str, updates: Dict, agent_id: str):
        """Update shared context with version control"""
        
        async with self.get_context_lock(context_id):
            current_context = await self.get_context(context_id)
            
            # Apply updates
            new_data = {**current_context.data, **updates}
            
            # Create new version
            new_version = current_context.version + 1
            updated_context = SharedContext(
                context_id=context_id,
                data=new_data,
                version=new_version,
                created_at=current_context.created_at,
                last_modified=datetime.now(),
                contributors=current_context.contributors + [agent_id]
            )
            
            # Store updated context
            await self.memory.store_context(updated_context)
            self.context_versions[context_id] = updated_context
            
            # Notify subscribers
            await self.notify_context_update(context_id, updated_context)
    
    async def resolve_context_conflicts(self, context_id: str, conflicting_updates: List[Dict]):
        """Resolve conflicts in shared context updates"""
        
        # Use sequentialthinking for logical conflict resolution
        resolution_strategy = await self.mcp_tools['sequentialthinking'].resolve_conflicts(
            context_id=context_id,
            conflicts=conflicting_updates
        )
        
        # Apply resolution
        await self.update_shared_context(
            context_id=context_id,
            updates=resolution_strategy.resolved_updates,
            agent_id='conflict_resolver'
        )
        
        return resolution_strategy
```

### 2. Context Propagation

```python
class ContextPropagator:
    def __init__(self, context_manager, message_bus):
        self.context_manager = context_manager
        self.message_bus = message_bus
        self.propagation_rules = {}
    
    async def propagate_context_update(self, context_id: str, update: Dict, propagation_scope: str):
        """Propagate context updates to relevant agents"""
        
        # Determine propagation targets
        targets = await self.determine_propagation_targets(context_id, propagation_scope)
        
        # Create context update message
        update_message = AgentMessage(
            sender_id=self.agent_id,
            recipient_id=None,  # Broadcast
            message_type=MessageType.NOTIFICATION,
            content={
                'type': 'context_update',
                'context_id': context_id,
                'update': update,
                'propagation_scope': propagation_scope
            },
            priority=MessagePriority.NORMAL,
            timestamp=datetime.now(),
            context=self.current_context,
            metadata={'context_id': context_id}
        )
        
        # Send to targets
        for target in targets:
            update_message.recipient_id = target
            await self.message_bus.publish(update_message)
    
    async def register_propagation_rule(self, rule: PropagationRule):
        """Register rule for context propagation"""
        
        self.propagation_rules[rule.rule_id] = rule
        await self.memory.store_propagation_rule(rule)
```

## Error Handling and Recovery

### 1. Communication Error Handler

```python
class CommunicationErrorHandler:
    def __init__(self, message_bus, retry_manager):
        self.message_bus = message_bus
        self.retry_manager = retry_manager
        self.error_log = []
    
    async def handle_communication_error(self, error: CommunicationError, message: AgentMessage):
        """Handle communication errors with recovery strategies"""
        
        # Log error
        await self.log_error(error, message)
        
        # Determine recovery strategy
        recovery_strategy = await self.determine_recovery_strategy(error, message)
        
        # Execute recovery
        if recovery_strategy.strategy_type == 'retry':
            await self.retry_manager.schedule_retry(message, recovery_strategy.retry_config)
        elif recovery_strategy.strategy_type == 'fallback':
            await self.execute_fallback_strategy(recovery_strategy.fallback_config)
        elif recovery_strategy.strategy_type == 'escalate':
            await self.escalate_error(error, message)
    
    async def retry_message(self, message: AgentMessage, retry_config: RetryConfig):
        """Retry message with configured strategy"""
        
        for attempt in range(retry_config.max_attempts):
            try:
                await self.message_bus.publish(message)
                return True  # Success
            except Exception as e:
                if attempt < retry_config.max_attempts - 1:
                    await asyncio.sleep(retry_config.backoff_strategy(attempt))
                else:
                    await self.handle_final_failure(message, e)
        
        return False
```

### 2. Network Resilience

```python
class NetworkResilienceManager:
    def __init__(self, connection_manager, health_checker):
        self.connection_manager = connection_manager
        self.health_checker = health_checker
        self.circuit_breakers = {}
    
    async def ensure_connection(self, target_agent_id: str):
        """Ensure connection to target agent"""
        
        circuit_breaker = self.get_circuit_breaker(target_agent_id)
        
        if circuit_breaker.is_open():
            raise CircuitBreakerOpenException(f"Circuit breaker open for {target_agent_id}")
        
        try:
            # Check connection health
            is_healthy = await self.health_checker.check_health(target_agent_id)
            
            if is_healthy:
                circuit_breaker.record_success()
                return True
            else:
                circuit_breaker.record_failure()
                await self.attempt_reconnection(target_agent_id)
                return False
                
        except Exception as e:
            circuit_breaker.record_failure()
            await self.handle_connection_error(target_agent_id, e)
            return False
    
    async def handle_connection_loss(self, agent_id: str):
        """Handle loss of connection to agent"""
        
        # Buffer messages for disconnected agent
        await self.message_bus.buffer_messages_for_agent(agent_id)
        
        # Attempt reconnection
        reconnection_task = asyncio.create_task(self.attempt_reconnection(agent_id))
        
        # Notify other agents
        await self.notify_connection_loss(agent_id)
        
        return reconnection_task
```

## Performance Optimization

### 1. Message Batching

```python
class MessageBatcher:
    def __init__(self, batch_size: int, flush_interval: float):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.message_batches = {}
        self.flush_tasks = {}
    
    async def add_message(self, message: AgentMessage):
        """Add message to batch"""
        
        recipient = message.recipient_id
        if recipient not in self.message_batches:
            self.message_batches[recipient] = []
            self.flush_tasks[recipient] = asyncio.create_task(
                self.flush_batch_timer(recipient)
            )
        
        self.message_batches[recipient].append(message)
        
        # Flush if batch is full
        if len(self.message_batches[recipient]) >= self.batch_size:
            await self.flush_batch(recipient)
    
    async def flush_batch(self, recipient_id: str):
        """Flush message batch for recipient"""
        
        if recipient_id in self.message_batches and self.message_batches[recipient_id]:
            batch = self.message_batches[recipient_id]
            self.message_batches[recipient_id] = []
            
            # Cancel flush timer
            if recipient_id in self.flush_tasks:
                self.flush_tasks[recipient_id].cancel()
                del self.flush_tasks[recipient_id]
            
            # Send batch
            await self.send_message_batch(batch)
```

### 2. Connection Pooling

```python
class ConnectionPool:
    def __init__(self, pool_size: int, connection_factory):
        self.pool_size = pool_size
        self.connection_factory = connection_factory
        self.available_connections = asyncio.Queue(maxsize=pool_size)
        self.active_connections = set()
        self.connection_stats = {}
    
    async def get_connection(self, agent_id: str) -> AgentConnection:
        """Get connection from pool"""
        
        # Try to get existing connection
        try:
            connection = self.available_connections.get_nowait()
            if await connection.is_healthy():
                self.active_connections.add(connection)
                return connection
            else:
                # Connection is unhealthy, create new one
                await connection.close()
        except asyncio.QueueEmpty:
            pass
        
        # Create new connection if pool not full
        if len(self.active_connections) < self.pool_size:
            connection = await self.connection_factory.create_connection(agent_id)
            self.active_connections.add(connection)
            return connection
        
        # Wait for available connection
        connection = await self.available_connections.get()
        self.active_connections.add(connection)
        return connection
    
    async def return_connection(self, connection: AgentConnection):
        """Return connection to pool"""
        
        if connection in self.active_connections:
            self.active_connections.remove(connection)
            
            if await connection.is_healthy():
                await self.available_connections.put(connection)
            else:
                await connection.close()
```

## Security and Authentication

### 1. Message Authentication

```python
class MessageAuthenticator:
    def __init__(self, crypto_manager, trust_store):
        self.crypto = crypto_manager
        self.trust_store = trust_store
    
    async def authenticate_message(self, message: AgentMessage) -> bool:
        """Authenticate message signature"""
        
        # Verify sender identity
        sender_public_key = await self.trust_store.get_public_key(message.sender_id)
        if not sender_public_key:
            return False
        
        # Verify signature
        signature = message.metadata.get('signature')
        if not signature:
            return False
        
        message_data = self.serialize_message_for_signing(message)
        is_valid = await self.crypto.verify_signature(
            message_data=message_data,
            signature=signature,
            public_key=sender_public_key
        )
        
        return is_valid
    
    async def sign_message(self, message: AgentMessage, private_key):
        """Sign message with private key"""
        
        message_data = self.serialize_message_for_signing(message)
        signature = await self.crypto.sign_message(message_data, private_key)
        
        message.metadata['signature'] = signature
        return message
```

### 2. Access Control

```python
class AccessController:
    def __init__(self, policy_manager, role_manager):
        self.policy_manager = policy_manager
        self.role_manager = role_manager
    
    async def check_access_permission(self, agent_id: str, resource: str, action: str) -> bool:
        """Check if agent has permission for action on resource"""
        
        # Get agent roles
        roles = await self.role_manager.get_agent_roles(agent_id)
        
        # Check policies for each role
        for role in roles:
            policies = await self.policy_manager.get_policies_for_role(role)
            
            for policy in policies:
                if await self.policy_matches(policy, resource, action):
                    return policy.allow
        
        return False  # Default deny
    
    async def enforce_message_filtering(self, message: AgentMessage) -> bool:
        """Enforce message filtering based on access policies"""
        
        # Check sender permission to send message type
        can_send = await self.check_access_permission(
            agent_id=message.sender_id,
            resource=f"message_type:{message.message_type.value}",
            action="send"
        )
        
        if not can_send:
            return False
        
        # Check recipient permission to receive message
        if message.recipient_id:
            can_receive = await self.check_access_permission(
                agent_id=message.recipient_id,
                resource=f"message_type:{message.message_type.value}",
                action="receive"
            )
            
            if not can_receive:
                return False
        
        return True
```

This communication protocol framework provides a robust, secure, and efficient foundation for AI agents to collaborate effectively while leveraging MCP tools for optimal performance.
