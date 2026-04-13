'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Minus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { customerApi } from '@/lib/customerApi';
import { getCommerceBaseUrl } from '@/lib/baseApi';
import { useAuth } from '@/lib/authContext';
import { useAlertToast } from '@/lib/useAlertToast';
import logger from '@/lib/logger';
import { useIntroVideoOverlay } from '@/lib/introVideoOverlayContext';

export default function CustomerChatWidget() {
    const { user } = useAuth();
    const { showAlert } = useAlertToast();
    const pathname = usePathname();
    const { introOverlayActive } = useIntroVideoOverlay();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const [roomId, setRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [wsError, setWsError] = useState(null);

    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);  // Track reconnection attempts for backoff

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, isMinimized]);

    // Allow external triggers (e.g. Contact page) to open the chat
    useEffect(() => {
        const handleOpen = () => { setIsOpen(true); setIsMinimized(false); };
        window.addEventListener('openSupportChat', handleOpen);
        return () => window.removeEventListener('openSupportChat', handleOpen);
    }, []);

    // Load existing active room on mount (if authenticated)
    useEffect(() => {
        if (!user) return;

        const loadExistingRoom = async () => {
            try {
                const res = await customerApi.chat.getRooms();
                const activeRoom = res.rooms?.find(r => r.status === 'open' || r.status === 'assigned');
                if (activeRoom) {
                    setRoomId(activeRoom.id);
                    const msgs = await customerApi.chat.getMessages(activeRoom.id);
                    setMessages(msgs.messages || []);
                    connectWebSocket(activeRoom.id);
                }
            } catch (error) {
                logger.error("Failed to load chat rooms:", error);
            }
        };

        loadExistingRoom();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Guard AFTER all hooks — Rules of Hooks compliant
    if (pathname?.startsWith('/admin') || pathname?.startsWith('/staff')) {
        return null;
    }
    if (introOverlayActive) return null;

    const connectWebSocket = (rId) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const baseUrl = getCommerceBaseUrl().replace(/^http/, 'ws');

        setIsConnecting(true);
        setWsError(null);

        // Auth via HttpOnly cookie — browser sends cookies automatically with WS connections
        // to same origin. Token is NOT appended to URL to prevent access log leakage.
        const wsUrl = `${baseUrl}/api/v1/chat/ws/${rId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setIsConnecting(false);
            setWsError(null);
            reconnectAttemptsRef.current = 0;  // Reset on successful connection
            logger.info("WebSocket connected");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setMessages(prev => {
                    // Prevent duplicates if we already added it optimistically
                    if (prev.some(m => m.message === data.message && m.created_at === data.created_at)) {
                        return prev;
                    }
                    return [...prev, data];
                });
            } catch (err) {
                logger.error("Failed to parse WS message", err);
            }
        };

        ws.onclose = () => {
            setIsConnecting(false);
            // Auto-reconnect with exponential backoff (max 30 seconds)
            logger.info("WebSocket closed, attempting reconnect...");
            setWsError("Reconnecting...");
            const reconnectDelay = Math.min(30000, 3000 * (reconnectAttemptsRef.current + 1));
            reconnectAttemptsRef.current += 1;
            setTimeout(() => {
                if (isOpen && rId) {
                    connectWebSocket(rId);
                }
            }, reconnectDelay);
        };

        ws.onerror = (err) => {
            logger.error("WebSocket error:", err);
            setWsError("Connection lost. Reconnecting...");
            setIsConnecting(false);
        };

        wsRef.current = ws;
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;
        if (!user) {
            // Prompt login, or you could implement guest chat
            showAlert("Please log in to use chat support.");
            return;
        }

        const textPayload = inputMessage.trim();
        setInputMessage('');

        try {
            let currentRoomId = roomId;

            // 1. Create room if it doesn't exist
            if (!currentRoomId) {
                const res = await customerApi.chat.createRoom("Customer Support");
                currentRoomId = res.room_id;
                setRoomId(currentRoomId);

                // Fetch initial system greeting if any
                const initialMsgs = await customerApi.chat.getMessages(currentRoomId);
                setMessages(initialMsgs.messages || []);

                // Connect WS for the new room
                connectWebSocket(currentRoomId);
            }

            // 2. Send the message via WS if connected, otherwise via REST API fallback
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                // Optimistic UI update
                const optimisticMsg = {
                    room_id: currentRoomId,
                    sender_id: user.user_id,
                    sender_type: 'customer',
                    message: textPayload,
                    created_at: new Date().toISOString()
                };
                // Send as JSON string for proper parsing on server
                wsRef.current.send(JSON.stringify({
                    type: 'message',
                    message: textPayload
                }));
            } else {
                // Fallback to REST API
                await customerApi.chat.sendMessage(currentRoomId, textPayload);
                // Optimistic update for REST fallback
                setMessages(prev => [...prev, {
                    room_id: currentRoomId,
                    sender_id: user.user_id,
                    sender_type: 'customer',
                    message: textPayload,
                    created_at: new Date().toISOString()
                }]);
            }
        } catch (error) {
            logger.error("Failed to send message:", error);
            setWsError("Failed to send message. Please try again.");
        }
    };

    // If not open, just render the floating button
    if (!isOpen) {
        return (
            <button
                onClick={() => { setIsOpen(true); setIsMinimized(false); }}
                // Fixed z-index hierarchy:
                // - Bottom nav: z-[100]
                // - Chat button: z-[90] (below nav, above content)
                // - Chat window: z-[95] (below nav, above content)
                // - Cart drawer: z-[55] (below chat)
                className="fixed right-6 p-4 bg-black text-white rounded-full shadow-2xl hover:bg-gray-800 hover:scale-105 transition-all z-[90] bottom-nav-offset md:bottom-6 md:z-50 flex items-center justify-center group"
            >
                <MessageSquare className="w-6 h-6" />
                {/* Unread badge could go here */}
            </button>
        );
    }

    return (
        <div className={`fixed right-6 z-[95] transition-all duration-300 ease-in-out shadow-2xl rounded-2xl overflow-hidden bg-white border border-gray-200 flex flex-col bottom-nav-offset md:bottom-6 md:z-50 ${isMinimized ? 'w-72 h-14' : 'w-80 sm:w-96 h-[500px] max-h-[80vh]'}`}>

            {/* Header */}
            <div
                className="bg-black text-white p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-medium text-sm">Support Chat</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                        className="p-1 hover:bg-gray-800 rounded text-gray-300"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                        className="p-1 hover:bg-gray-800 rounded text-gray-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Body */}
            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3">
                        {!user ? (
                            <div className="text-center text-sm text-gray-500 mt-10">
                                Please log in to chat with our support team.
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center text-sm text-gray-500 mt-10">
                                Hi! How can we help you today?
                            </div>
                        ) : null}

                        {messages.map((msg, i) => {
                            const isCustomer = msg.sender_type === 'customer';
                            return (
                                <div key={i} className={`flex flex-col max-w-[85%] ${isCustomer ? 'self-end items-end' : 'self-start items-start'}`}>
                                    <div className={`px-4 py-2 rounded-2xl ${isCustomer ? 'bg-black text-white rounded-br-none' : 'bg-gray-200 text-black rounded-bl-none'}`}>
                                        <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                                    </div>
                                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Error Banner */}
                    {wsError && (
                        <div className="bg-red-50 text-red-500 text-xs py-1 px-4 text-center border-t border-red-100">
                            {wsError}
                        </div>
                    )}

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-3 bg-white border-t flex items-center gap-2">
                        <input
                            type="text"
                            placeholder={user ? "Type a message..." : "Log in to chat"}
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            disabled={!user || isConnecting}
                            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!user || !inputMessage.trim() || isConnecting}
                            className="p-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-black transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}
