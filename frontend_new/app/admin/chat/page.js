'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  MessageCircle,
  User,
  Clock,
  CheckCheck,
  Send,
  MoreVertical,
  Phone,
  Mail,
  Wifi,
  WifiOff,
  AlertCircle,
  Check,
  X,
  ArrowLeft
} from 'lucide-react';
import { chatApi } from '@/lib/adminApi';
import { getCommerceBaseUrl } from '@/lib/baseApi';
import logger from '@/lib/logger';
import { getErrorMessage, logError } from '@/lib/errorHandlers';

export default function ChatPage() {
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isSending, setIsSending] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [sendingMessageId, setSendingMessageId] = useState(null);
  const [showMobileRooms, setShowMobileRooms] = useState(true);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const messageIdCounter = useRef(1);

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms();
  }, []);

  // Auto-refresh rooms list every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRooms(false);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Setup WebSocket when room is selected
  useEffect(() => {
    if (!selectedRoom) {
      cleanupWebSocket();
      return;
    }

    fetchMessages(selectedRoom.id);

    if (unreadMap[selectedRoom.id] > 0) {
      setUnreadMap(prev => ({ ...prev, [selectedRoom.id]: 0 }));
    }

    setupWebSocket();

    return () => cleanupWebSocket();
  }, [selectedRoom?.id]);

  const cleanupWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  const setupWebSocket = () => {
    cleanupWebSocket();
    setConnectionStatus('connecting');

    try {
      const baseUrl = getCommerceBaseUrl().replace(/^http/, 'ws');
      const wsUrl = `${baseUrl}/api/v1/admin/chat/ws/${selectedRoom.id}`;

      logger.info('[Chat] Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        logger.info('[Chat] WebSocket connected');
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.info('[Chat] WebSocket message received:', data);

          setMessages(prev => {
            if (data.id && prev.some(m => m.id === data.id)) return prev;

            return [...prev, {
              id: data.id || messageIdCounter.current++,
              room_id: data.room_id || selectedRoom.id,
              sender_id: data.sender_id,
              sender_type: data.sender_type,
              message: data.message,
              created_at: data.created_at || new Date().toISOString(),
              is_read: data.is_read || false,
            }];
          });

          if (data.sender_type !== 'admin' && selectedRoom?.id !== data.room_id) {
            setUnreadMap(prev => ({
              ...prev,
              [data.room_id]: (prev[data.room_id] || 0) + 1
            }));
          }
        } catch (err) {
          logger.error('[Chat] Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        logger.error('[Chat] WebSocket error:', err);
        setConnectionStatus('error');
      };

      ws.onclose = (e) => {
        logger.info('[Chat] WebSocket closed:', e.code, e.reason);
        setConnectionStatus('disconnected');

        if (selectedRoom && e.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (selectedRoom) {
              setupWebSocket();
            }
          }, 3000);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      logger.error('[Chat] Failed to setup WebSocket:', err);
      setConnectionStatus('error');
    }
  };

  const fetchRooms = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const data = await chatApi.getRooms();
      const roomsData = data.rooms || [];
      setRooms(roomsData);

      const unreadCounts = {};
      roomsData.forEach(room => {
        unreadCounts[room.id] = room.unread || 0;
      });
      setUnreadMap(unreadCounts);
    } catch (err) {
      logError('AdminChat', 'loading chat rooms', err, { 
        endpoint: '/api/v1/admin/chat/rooms'
      });
      
      setError(getErrorMessage(err, 'load chat rooms', {
        authMsg: 'Your session has expired. Please log in again.',
        permissionMsg: 'You do not have permission to view chat rooms.',
        notFoundMsg: 'No chat rooms found.',
        networkMsg: 'Cannot connect to server. Please check your connection.'
      }));
      setRooms([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchMessages = async (roomId) => {
    try {
      setError(null);
      const data = await chatApi.getMessages(roomId);
      setMessages(data.messages || []);
    } catch (err) {
      logError('AdminChat', 'loading messages', err, { 
        endpoint: `/api/v1/admin/chat/rooms/${roomId}/messages`,
        roomId
      });
      setMessages([]);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedRoom || isSending) return;

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      id: tempId,
      room_id: selectedRoom.id,
      sender_id: 'admin',
      sender_type: 'admin',
      message: messageText,
      created_at: new Date().toISOString(),
      is_read: true,
      pending: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setIsSending(true);
    setSendingMessageId(tempId);

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          message: messageText,
          room_id: selectedRoom.id,
          sender_type: 'admin'
        }));

        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, pending: false } : m
        ));
      } else {
        const result = await chatApi.sendMessage(selectedRoom.id, messageText, 'admin');

        setMessages(prev => prev.map(m =>
          m.id === tempId ? {
            ...m,
            id: result.id || tempId,
            pending: false
          } : m
        ));
      }
    } catch (err) {
      logger.error('Failed to send message:', err);

      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, failed: true } : m
      ));

      setNewMessage(messageText);
    } finally {
      setIsSending(false);
      setSendingMessageId(null);
    }
  }, [newMessage, selectedRoom, isSending]);

  const retryMessage = (msg) => {
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    setNewMessage(msg.message);
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'waiting': return 'bg-yellow-500';
      case 'assigned': return 'bg-blue-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'connecting':
        return <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = Object.values(unreadMap).reduce((sum, count) => sum + count, 0);

  // Handle room selection on mobile
  const handleRoomSelect = (room) => {
    setSelectedRoom(room);
    setShowMobileRooms(false);
  };

  // Handle back to rooms list on mobile
  const handleBackToRooms = () => {
    setShowMobileRooms(true);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 relative">
      {/* Chat Rooms Sidebar - Responsive */}
      <div className={cn(
        'flex-shrink-0 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl flex flex-col',
        'transition-all duration-300',
        'w-full md:w-80 lg:w-80',
        'absolute md:relative inset-0 z-10',
        showMobileRooms ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        !showMobileRooms && 'md:static'
      )}>
        {/* Header */}
        <div className="p-4 border-b border-[#B76E79]/15">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-lg font-semibold text-[#F2C29A]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Conversations
              {totalUnread > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-[#B76E79] text-white text-xs rounded-full">
                  {totalUnread}
                </span>
              )}
            </h2>
            <button
              onClick={() => fetchRooms(false)}
              className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] touch-target"
              title="Refresh"
              aria-label="Refresh conversations"
            >
              <RefreshCw className={cn('w-4 h-4 text-[#EAE0D5]/70', loading ? 'animate-spin' : '')} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-9 pr-3 py-2',
                'bg-[#0B0608]/60 border border-[#B76E79]/20',
                'rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40',
                'focus:outline-none focus:border-[#B76E79]/40',
                'transition-colors text-sm',
                'min-h-[44px] touch-target'
              )}
              aria-label="Search conversations"
            />
          </div>
        </div>

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-[#B76E79]/30 mx-auto mb-3 animate-spin" />
              <p className="text-[#EAE0D5]/50 text-sm">Loading...</p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-[#B76E79]/30 mx-auto mb-3" aria-hidden="true" />
              <p className="text-[#EAE0D5]/50">No conversations found</p>
            </div>
          ) : (
            <ul role="listbox" aria-label="Chat conversations">
              {filteredRooms.map(room => {
                const unread = unreadMap[room.id] || 0;
                return (
                  <li key={room.id}>
                    <button
                      onClick={() => handleRoomSelect(room)}
                      className={cn(
                        'w-full p-4 text-left border-b border-[#B76E79]/10',
                        'hover:bg-[#B76E79]/5 transition-colors',
                        selectedRoom?.id === room.id ? 'bg-[#7A2F57]/20' : '',
                        'min-h-[44px] touch-target'
                      )}
                      role="option"
                      aria-selected={selectedRoom?.id === room.id}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-[#7A2F57]/30 flex items-center justify-center" aria-hidden="true">
                            <User className="w-5 h-5 text-[#B76E79]" />
                          </div>
                          <span className={cn('absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0B0608]', getStatusColor(room.status))} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-[#EAE0D5] truncate">{room.user_name}</p>
                            {unread > 0 && (
                              <span className="px-2 py-0.5 bg-[#B76E79] text-white text-xs rounded-full flex-shrink-0" aria-label={`${unread} unread messages`}>
                                {unread}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#EAE0D5]/50 mt-0.5 truncate">
                            {room.last_message || 'No messages yet'}
                          </p>
                          <p className="text-[10px] text-[#EAE0D5]/30 mt-0.5">
                            {formatDate(room.updated_at)} {formatTime(room.updated_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Window - Responsive */}
      <div className={cn(
        'flex-1 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl flex flex-col',
        'absolute md:relative inset-0 z-20',
        showMobileRooms ? 'translate-x-full md:translate-x-0' : 'translate-x-0',
        !showMobileRooms && 'md:static'
      )}>
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-[#B76E79]/15 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile back button */}
                <button
                  onClick={handleBackToRooms}
                  className="md:hidden p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors min-w-[44px] min-h-[44px] touch-target"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5 text-[#EAE0D5]/70" />
                </button>

                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-[#7A2F57]/30 flex items-center justify-center" aria-hidden="true">
                    <User className="w-5 h-5 text-[#B76E79]" />
                  </div>
                  <span className={cn('absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0B0608]', getStatusColor(selectedRoom.status))} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-[#EAE0D5]">{selectedRoom.user_name}</p>
                  <p className="text-xs text-[#EAE0D5]/50 capitalize flex items-center gap-1">
                    {selectedRoom.status}
                    <span className="text-[#EAE0D5]/30" aria-hidden="true">•</span>
                    {getConnectionIcon()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors min-w-[44px] min-h-[44px] touch-target" title="Call" aria-label="Call user">
                  <Phone className="w-4 h-4 text-[#EAE0D5]/70" />
                </button>
                <button className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors min-w-[44px] min-h-[44px] touch-target" title="Email" aria-label="Email user">
                  <Mail className="w-4 h-4 text-[#EAE0D5]/70" />
                </button>
                <button className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors min-w-[44px] min-h-[44px] touch-target" title="More options" aria-label="More options">
                  <MoreVertical className="w-4 h-4 text-[#EAE0D5]/70" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              role="log"
              aria-label="Chat messages"
              aria-live="polite"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.sender_type === 'admin' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[70%] px-4 py-2.5 rounded-2xl relative group',
                      msg.sender_type === 'admin'
                        ? 'bg-[#7A2F57]/30 text-[#EAE0D5] rounded-br-md'
                        : 'bg-[#0B0608]/60 border border-[#B76E79]/20 text-[#EAE0D5] rounded-bl-md',
                      msg.pending ? 'opacity-60' : '',
                      msg.failed ? 'border-red-500/50' : ''
                    )}
                  >
                    {msg.failed && (
                      <div className="absolute -top-6 right-0 flex items-center gap-1">
                        <span className="text-xs text-red-400">Failed to send</span>
                        <button
                          onClick={() => retryMessage(msg)}
                          className="p-1 bg-red-500/20 rounded hover:bg-red-500/30 flex items-center justify-center min-w-[44px] min-h-[44px] touch-target"
                          title="Retry"
                          aria-label="Retry sending message"
                        >
                          <RefreshCw className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    )}

                    <p className="text-sm">{msg.message}</p>
                    <div className={cn('flex items-center gap-1 mt-1', msg.sender_type === 'admin' ? 'justify-end' : 'justify-start')}>
                      <span className={cn('text-xs', msg.sender_type === 'admin' ? 'text-[#EAE0D5]/50' : 'text-[#EAE0D5]/40')}>
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.sender_type === 'admin' && (
                        <>
                          {msg.pending ? (
                            <Clock className="w-3 h-3 text-[#EAE0D5]/30" aria-label="Sending" />
                          ) : msg.failed ? (
                            <X className="w-3 h-3 text-red-400" aria-label="Failed" />
                          ) : (
                            <CheckCheck className="w-3 h-3 text-[#B76E79]" aria-label="Read" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {connectionStatus === 'connected' && messages.length > 0 && (
                <div className="text-center py-2">
                  <span className="text-xs text-[#EAE0D5]/30">Connected</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-[#B76E79]/15">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type your message..."
                  disabled={selectedRoom.status === 'closed'}
                  className={cn(
                    'flex-1 px-4 py-2.5',
                    'bg-[#0B0608]/60 border border-[#B76E79]/20',
                    'rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40',
                    'focus:outline-none focus:border-[#B76E79]/40',
                    'transition-colors',
                    'disabled:opacity-50',
                    'min-h-[44px] touch-target'
                  )}
                  aria-label="Type a message"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isSending || selectedRoom.status === 'closed'}
                  className={cn(
                    'p-2.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors',
                    'disabled:opacity-50',
                    'min-w-[44px] min-h-[44px] touch-target'
                  )}
                  aria-label="Send message"
                >
                  {isSending ? (
                    <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* Connection status */}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getConnectionIcon()}
                  <span className={cn(
                    'text-xs',
                    connectionStatus === 'connected' ? 'text-green-400' :
                    connectionStatus === 'connecting' ? 'text-yellow-400' :
                    connectionStatus === 'error' ? 'text-red-400' :
                    'text-gray-400'
                  )}>
                    {connectionStatus === 'connected' ? 'Connected - Real-time' :
                     connectionStatus === 'connecting' ? 'Connecting...' :
                     connectionStatus === 'error' ? 'Connection error - Using REST' :
                     'Disconnected'}
                  </span>
                </div>
                {selectedRoom.status === 'closed' && (
                  <span className="text-xs text-gray-400">This conversation is closed</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" aria-hidden="true" />
              <p className="text-[#EAE0D5]/70 mb-2">Select a conversation to start chatting</p>
              <p className="text-[#EAE0D5]/40 text-sm">Messages appear in real-time when connected</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
