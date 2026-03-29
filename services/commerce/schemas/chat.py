"""Chat schemas for commerce service."""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ChatMessageCreate(BaseModel):
    text: str
    sender: str = "customer" # Or 'admin'

class ChatMessageResponse(BaseModel):
    id: int
    session_id: str
    sender: str
    text: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatSessionCreate(BaseModel):
    id: str
    user_id: Optional[int] = None

class ChatSessionResponse(BaseModel):
    id: str
    user_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageResponse] = []
    
    class Config:
        from_attributes = True
