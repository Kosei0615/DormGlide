// DormGlide Chat Service
// Provides Supabase-backed messaging with localStorage fallback
(() => {
    const CHAT_CONVERSATIONS_KEY = 'dormglide_chat_conversations';
    const CHAT_MESSAGES_KEY = 'dormglide_chat_messages';

    const conversationMessageListeners = new Map(); // conversationId -> Set<callback>
    const conversationUpdateListeners = new Set(); // Set<callback(payload)>

    let realtimeChannel = null;
    let realtimeSubscriberCount = 0;

    let supabaseChatAvailable = true;

    const getSupabaseClient = () => window.SupabaseClient || null;
    const markSupabaseUnavailable = (error) => {
        supabaseChatAvailable = false;
        console.warn('[DormGlide] Supabase chat disabled for this session, falling back to local storage.', error);
    };
    const isSupabaseEnabled = () => Boolean(getSupabaseClient()) && supabaseChatAvailable;

    const readLocal = (key, fallback) => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (error) {
            console.warn(`[DormGlide] Chat local read failed for ${key}:`, error);
            return fallback;
        }
    };

    const writeLocal = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`[DormGlide] Chat local write failed for ${key}:`, error);
        }
    };

    const generateLocalId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const sortParticipants = (userA, userB) => {
        const [a, b] = [userA, userB].map((id) => String(id));
        return a < b ? [a, b] : [b, a];
    };

    const normalizeConversation = (record = {}) => {
        const participantA = record.participant_a || record.participantA || null;
        const participantB = record.participant_b || record.participantB || null;
        const normalized = {
            id: record.id,
            productId: record.product_id ?? record.productId ?? null,
            participantA,
            participantB,
            participants: [participantA, participantB].filter(Boolean),
            lastMessage: record.last_message ?? record.lastMessage ?? null,
            lastMessageAt: record.last_message_at ?? record.lastMessageAt ?? record.updated_at ?? record.created_at ?? null,
            createdAt: record.created_at ?? record.createdAt ?? new Date().toISOString()
        };
        return normalized;
    };

    const normalizeMessage = (record = {}) => ({
        id: record.id || generateLocalId(),
        conversationId: record.conversation_id ?? record.conversationId ?? null,
        senderId: record.sender_id ?? record.senderId ?? null,
        receiverId: record.receiver_id ?? record.receiverId ?? null,
        body: record.body ?? record.message ?? '',
        productId: record.product_id ?? record.productId ?? null,
        createdAt: record.created_at ?? record.timestamp ?? new Date().toISOString()
    });

    const emitMessage = (conversationId, message) => {
        if (!conversationId || !message) return;
        const listeners = conversationMessageListeners.get(conversationId);
        if (listeners) {
            listeners.forEach((listener) => {
                try {
                    listener(message);
                } catch (error) {
                    console.warn('[DormGlide] Chat listener error:', error);
                }
            });
        }
        emitConversationUpdate({
            conversationId,
            participants: [message.senderId, message.receiverId],
            message
        });
    };

    const emitConversationUpdate = (payload) => {
        if (!payload) return;
        conversationUpdateListeners.forEach((listener) => {
            try {
                listener(payload);
            } catch (error) {
                console.warn('[DormGlide] Conversation listener error:', error);
            }
        });
    };

    const ensureRealtimeChannel = () => {
        if (!isSupabaseEnabled()) return null;
        const client = getSupabaseClient();
        if (!client) return null;

        if (!realtimeChannel) {
            realtimeChannel = client.channel('dormglide-chat-global');

            realtimeChannel.on('postgres_changes', {
                schema: 'public',
                table: 'messages',
                event: 'INSERT'
            }, async (payload) => {
                try {
                    const message = normalizeMessage(payload.new);
                    if (!message.conversationId) return;
                    emitMessage(message.conversationId, message);

                    // Attempt to hydrate conversation participants for listeners
                    try {
                        const conversation = await supabaseAdapter.getConversationById(message.conversationId);
                        if (conversation) {
                            emitConversationUpdate({
                                conversationId: conversation.id,
                                conversation,
                                participants: conversation.participants
                            });
                        }
                    } catch (error) {
                        console.warn('[DormGlide] Failed to refresh conversation metadata:', error);
                    }
                } catch (error) {
                    console.error('[DormGlide] Realtime message handling failed:', error);
                }
            });

            realtimeChannel.on('postgres_changes', {
                schema: 'public',
                table: 'conversations',
                event: 'UPDATE'
            }, (payload) => {
                const conversation = normalizeConversation(payload.new);
                emitConversationUpdate({
                    conversationId: conversation.id,
                    conversation,
                    participants: conversation.participants
                });
            });

            realtimeChannel.subscribe();
        }

        realtimeSubscriberCount += 1;
        return () => {
            realtimeSubscriberCount = Math.max(0, realtimeSubscriberCount - 1);
            if (realtimeSubscriberCount === 0 && realtimeChannel) {
                try {
                    client.removeChannel(realtimeChannel);
                } catch (error) {
                    console.warn('[DormGlide] Failed to remove chat realtime channel:', error);
                }
                realtimeChannel = null;
            }
        };
    };

    const localAdapter = {
        async getOrCreateConversation({ productId, participantA, participantB }) {
            const [a, b] = sortParticipants(participantA, participantB);
            const conversations = readLocal(CHAT_CONVERSATIONS_KEY, []);
            let record = conversations.find((item) =>
                item.participant_a === a &&
                item.participant_b === b &&
                (item.product_id || null) === (productId || null)
            );

            if (!record) {
                record = {
                    id: generateLocalId(),
                    participant_a: a,
                    participant_b: b,
                    product_id: productId || null,
                    last_message: null,
                    last_message_at: null,
                    created_at: new Date().toISOString()
                };
                conversations.push(record);
                writeLocal(CHAT_CONVERSATIONS_KEY, conversations);
            }

            return normalizeConversation(record);
        },
        async getConversationById(conversationId) {
            const conversations = readLocal(CHAT_CONVERSATIONS_KEY, []);
            const record = conversations.find((item) => item.id === conversationId);
            return record ? normalizeConversation(record) : null;
        },
        async fetchMessages(conversationId) {
            const messages = readLocal(CHAT_MESSAGES_KEY, []);
            return messages
                .filter((item) => item.conversation_id === conversationId)
                .map(normalizeMessage)
                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        },
        async fetchConversationsForUser(userId) {
            const conversations = readLocal(CHAT_CONVERSATIONS_KEY, []);
            return conversations
                .filter((item) => item.participant_a === userId || item.participant_b === userId)
                .map(normalizeConversation)
                .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt));
        },
        async sendMessage({ conversation, senderId, receiverId, productId, body, timestamp }) {
            const messages = readLocal(CHAT_MESSAGES_KEY, []);
            const messageRecord = {
                id: generateLocalId(),
                conversation_id: conversation.id,
                sender_id: senderId,
                receiver_id: receiverId,
                product_id: productId || null,
                body,
                created_at: timestamp
            };
            messages.push(messageRecord);
            writeLocal(CHAT_MESSAGES_KEY, messages);

            const conversations = readLocal(CHAT_CONVERSATIONS_KEY, []);
            const idx = conversations.findIndex((item) => item.id === conversation.id);
            if (idx !== -1) {
                conversations[idx].last_message = body;
                conversations[idx].last_message_at = timestamp;
                writeLocal(CHAT_CONVERSATIONS_KEY, conversations);
            }

            return normalizeMessage(messageRecord);
        }
    };

    const supabaseAdapter = {
        async getOrCreateConversation({ productId, participantA, participantB }) {
            const client = getSupabaseClient();
            const [a, b] = sortParticipants(participantA, participantB);
            const match = {
                participant_a: a,
                participant_b: b,
                product_id: productId || null
            };

            let query = client
                .from('conversations')
                .select('*')
                .eq('participant_a', match.participant_a)
                .eq('participant_b', match.participant_b);

            if (match.product_id === null) {
                query = query.is('product_id', null);
            } else {
                query = query.eq('product_id', match.product_id);
            }

            const { data, error } = await query.maybeSingle();
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            if (data) {
                return normalizeConversation(data);
            }

            const insertPayload = {
                participant_a: match.participant_a,
                participant_b: match.participant_b,
                product_id: match.product_id,
                last_message: null,
                last_message_at: new Date().toISOString()
            };

            const { data: inserted, error: insertError } = await client
                .from('conversations')
                .insert(insertPayload)
                .select('*')
                .single();

            if (insertError) throw insertError;
            return normalizeConversation(inserted);
        },
        async getConversationById(conversationId) {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('conversations')
                .select('*')
                .eq('id', conversationId)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            return data ? normalizeConversation(data) : null;
        },
        async fetchMessages(conversationId) {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(normalizeMessage);
        },
        async fetchConversationsForUser(userId) {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('conversations')
                .select('*')
                .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
                .order('last_message_at', { ascending: false, nullsLast: true });
            if (error) throw error;
            return (data || []).map(normalizeConversation);
        },
        async sendMessage({ conversation, senderId, receiverId, productId, body, timestamp }) {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('messages')
                .insert({
                    conversation_id: conversation.id,
                    sender_id: senderId,
                    receiver_id: receiverId,
                    product_id: productId || null,
                    body,
                    created_at: timestamp
                })
                .select('*')
                .single();
            if (error) throw error;

            const { error: updateError } = await client
                .from('conversations')
                .update({
                    last_message: body,
                    last_message_at: timestamp
                })
                .eq('id', conversation.id);
            if (updateError) throw updateError;

            return normalizeMessage(data);
        }
    };

    const fetchWithFallback = async (supabaseFn, localFn) => {
        if (isSupabaseEnabled()) {
            try {
                return await supabaseFn();
            } catch (error) {
                console.warn('[DormGlide] Supabase chat operation failed, using local fallback:', error);
                markSupabaseUnavailable(error);
            }
        }
        return localFn();
    };

    const ChatService = {
        getStatus() {
            return {
                backend: isSupabaseEnabled() ? 'supabase' : 'local',
                supabaseConfigured: Boolean(getSupabaseClient()),
                supabaseAvailable: supabaseChatAvailable
            };
        },
        async getOrCreateConversation({ productId = null, participantA, participantB }) {
            return fetchWithFallback(
                () => supabaseAdapter.getOrCreateConversation({ productId, participantA, participantB }),
                () => localAdapter.getOrCreateConversation({ productId, participantA, participantB })
            );
        },
        async fetchMessages(conversationId) {
            if (!conversationId) return [];
            return fetchWithFallback(
                () => supabaseAdapter.fetchMessages(conversationId),
                () => localAdapter.fetchMessages(conversationId)
            );
        },
        async fetchConversations(userId) {
            if (!userId) return [];
            const conversations = await fetchWithFallback(
                () => supabaseAdapter.fetchConversationsForUser(userId),
                () => localAdapter.fetchConversationsForUser(userId)
            );
            return conversations.map((conversation) => ({
                ...conversation,
                otherUserId: conversation.participantA === userId ? conversation.participantB : conversation.participantA
            }));
        },
        async sendMessage({ conversationId = null, productId = null, senderId, receiverId, body, productTitle = '' }) {
            if (!senderId || !receiverId || !body) {
                throw new Error('Missing chat message data');
            }
            const timestamp = new Date().toISOString();

            // Prefer Supabase when available, but fully fall back to local if any Supabase step fails.
            if (isSupabaseEnabled()) {
                try {
                    const conversation = conversationId
                        ? await supabaseAdapter.getConversationById(conversationId)
                        : await supabaseAdapter.getOrCreateConversation({ productId, participantA: senderId, participantB: receiverId });

                    if (!conversation) {
                        throw new Error('Unable to resolve conversation');
                    }

                    const message = await supabaseAdapter.sendMessage({
                        conversation,
                        senderId,
                        receiverId,
                        productId,
                        body,
                        timestamp
                    });

                    emitMessage(conversation.id, message);
                    emitConversationUpdate({
                        conversationId: conversation.id,
                        conversation,
                        participants: conversation.participants
                    });

                    if (typeof window.DormGlideAuth?.recordMessageActivity === 'function') {
                        window.DormGlideAuth.recordMessageActivity({
                            senderId,
                            receiverId,
                            productId,
                            productTitle,
                            body,
                            timestamp,
                            conversationId: conversation.id
                        });
                    }

                    return { conversation, message };
                } catch (error) {
                    console.warn('[DormGlide] Supabase sendMessage failed, falling back to local chat:', error);
                    markSupabaseUnavailable(error);
                }
            }

            const conversation = await localAdapter.getOrCreateConversation({
                productId,
                participantA: senderId,
                participantB: receiverId
            });

            const message = await localAdapter.sendMessage({
                conversation,
                senderId,
                receiverId,
                productId,
                body,
                timestamp
            });

            emitMessage(conversation.id, message);
            emitConversationUpdate({
                conversationId: conversation.id,
                conversation,
                participants: conversation.participants
            });

            if (typeof window.DormGlideAuth?.recordMessageActivity === 'function') {
                window.DormGlideAuth.recordMessageActivity({
                    senderId,
                    receiverId,
                    productId,
                    productTitle,
                    body,
                    timestamp,
                    conversationId: conversation.id
                });
            }

            return { conversation, message };
        },
        subscribeToConversation(conversationId, callback) {
            if (!conversationId || typeof callback !== 'function') return () => {};
            let releaseRealtime = null;
            if (isSupabaseEnabled()) {
                releaseRealtime = ensureRealtimeChannel();
            }
            let listeners = conversationMessageListeners.get(conversationId);
            if (!listeners) {
                listeners = new Set();
                conversationMessageListeners.set(conversationId, listeners);
            }
            listeners.add(callback);
            return () => {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    conversationMessageListeners.delete(conversationId);
                }
                if (releaseRealtime) releaseRealtime();
            };
        },
        subscribeToConversationUpdates(userId, callback) {
            if (!userId || typeof callback !== 'function') return () => {};
            let releaseRealtime = null;
            if (isSupabaseEnabled()) {
                releaseRealtime = ensureRealtimeChannel();
            }
            const listener = (payload) => {
                if (!payload) return;
                const participants = payload.participants || [];
                if (participants.length === 0 || participants.includes(userId)) {
                    callback(payload);
                }
            };
            conversationUpdateListeners.add(listener);
            return () => {
                conversationUpdateListeners.delete(listener);
                if (releaseRealtime) releaseRealtime();
            };
        }
    };

    window.DormGlideChat = ChatService;
})();
