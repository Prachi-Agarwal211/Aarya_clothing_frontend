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
} from 'lucide-react';
import { chatApi } from '@/lib/adminApi';
import { getAuthToken, getCommerceBaseUrl } from '@/lib/baseApi';
import logger from '@/lib/logger';

export default function ChatPage() {
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);
    }
  }, [selectedRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await chatApi.getRooms();
      setRooms(data.rooms || []);
    } catch (err) {
      logger.error('Error fetching rooms:', err);
      setError('Failed to load chat rooms. Please try again.');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId) => {
    try {
      setError(null);
      const data = await chatApi.getMessages(roomId);
      setMessages(data.messages || []);
    } catch (err) {
      logger.error('Error fetching messages:', err);
      setMessages([]);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedRoom) return;

    const messageText = newMessage; // Store before clearing
    const message = {
      id: messages.length + 1,
      room_id: selectedRoom.id,
      sender_id: 1,
      sender_type: 'admin',
      message: messageText,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(messageText);
      } else {
        await chatApi.sendMessage(selectedRoom.id, messageText, 'admin');
      }
    } catch (err) {
      // Revert message on failure
      setMessages(prev => prev.filter(m => m.id !== message.id));
      logger.error('Failed to send message:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newMessage, selectedRoom]);

  // WebSocket connection when a room is selected
  useEffect(() => {
    if (!selectedRoom) return;

    // Initial fetch
    fetchMessages(selectedRoom.id);

    const token = getAuthToken();
    if (!token) return;

    const baseUrl = getCommerceBaseUrl().replace(/^http/, 'ws');
    const wsUrl = `${baseUrl}/api/v1/chat/ws/${selectedRoom.id}?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => {
          // Avoid duplicate messages if optimistic update already added it
          if (prev.some(m => m.message === data.message && new Date(m.created_at).getTime() === new Date(data.created_at).getTime())) {
            return prev;
          }
          return [...prev, data];
        });
      } catch (err) {
        logger.error("Failed to parse WS message", err);
      }
    };

    ws.onerror = (err) => {
      logger.error("WebSocket error:", err);
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom]);

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

  const filteredRooms = rooms.filter(room =>
    room.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Chat Rooms Sidebar */}
      <div className="w-80 flex-shrink-0 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#B76E79]/15">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-lg font-semibold text-[#F2C29A]"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              Conversations
            </h2>
            <button
              onClick={fetchRooms}
              className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-[#EAE0D5]/70 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#EAE0D5]/40" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-full pl-9 pr-3 py-2
                bg-[#0B0608]/60 border border-[#B76E79]/20
                rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40
                focus:outline-none focus:border-[#B76E79]/40
                transition-colors text-sm
              "
            />
          </div>
        </div>

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`
                w-full p-4 text-left border-b border-[#B76E79]/10
                hover:bg-[#B76E79]/5 transition-colors
                ${selectedRoom?.id === room.id ? 'bg-[#7A2F57]/20' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-[#7A2F57]/30 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#B76E79]" />
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0B0608] ${getStatusColor(room.status)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-[#EAE0D5] truncate">{room.user_name}</p>
                    {room.unread > 0 && (
                      <span className="px-2 py-0.5 bg-[#B76E79] text-white text-xs rounded-full">
                        {room.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#EAE0D5]/50 mt-0.5">
                    {formatDate(room.updated_at)} {formatTime(room.updated_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {filteredRooms.length === 0 && (
            <div className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-[#B76E79]/30 mx-auto mb-3" />
              <p className="text-[#EAE0D5]/50">No conversations found</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-[#B76E79]/15 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-[#7A2F57]/30 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#B76E79]" />
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0B0608] ${getStatusColor(selectedRoom.status)}`} />
                </div>
                <div>
                  <p className="font-medium text-[#EAE0D5]">{selectedRoom.user_name}</p>
                  <p className="text-xs text-[#EAE0D5]/50 capitalize">{selectedRoom.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors">
                  <Phone className="w-4 h-4 text-[#EAE0D5]/70" />
                </button>
                <button className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors">
                  <Mail className="w-4 h-4 text-[#EAE0D5]/70" />
                </button>
                <button className="p-2 rounded-lg hover:bg-[#B76E79]/10 transition-colors">
                  <MoreVertical className="w-4 h-4 text-[#EAE0D5]/70" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[70%] px-4 py-2.5 rounded-2xl
                      ${msg.sender_type === 'admin'
                        ? 'bg-[#7A2F57]/30 text-[#EAE0D5] rounded-br-md'
                        : 'bg-[#0B0608]/60 border border-[#B76E79]/20 text-[#EAE0D5] rounded-bl-md'
                      }
                    `}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-xs mt-1 ${msg.sender_type === 'admin' ? 'text-[#EAE0D5]/50' : 'text-[#EAE0D5]/40'}`}>
                      {formatTime(msg.created_at)}
                      {msg.sender_type === 'admin' && (
                        <CheckCheck className="w-3 h-3 inline ml-1" />
                      )}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-[#B76E79]/15">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="
                    flex-1 px-4 py-2.5
                    bg-[#0B0608]/60 border border-[#B76E79]/20
                    rounded-xl text-[#EAE0D5] placeholder-[#EAE0D5]/40
                    focus:outline-none focus:border-[#B76E79]/40
                    transition-colors
                  "
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/40 transition-colors disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-[#B76E79]/30 mx-auto mb-4" />
              <p className="text-[#EAE0D5]/70">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
