package ws

import (
	"log"

	"voxroom/backend/room"
)

// Hub maintains active clients and broadcasts messages to them
type Hub struct {
	// Room ID -> Set of clients in that room
	Rooms map[string]map[*Client]bool

	// Channels for hub operations
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan Message
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		Rooms:      make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan Message),
	}
}

// Run starts the hub's main event loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.handleRegister(client)

		case client := <-h.Unregister:
			h.handleUnregister(client)

		case message := <-h.Broadcast:
			h.handleBroadcast(message)
		}
	}
}

// handleRegister processes new client registrations
func (h *Hub) handleRegister(c *Client) {
	// 1. Create room if not exists
	if h.Rooms[c.RoomID] == nil {
		h.Rooms[c.RoomID] = make(map[*Client]bool)
	}

	// 2. Add client to room
	h.Rooms[c.RoomID][c] = true

	// 3. Get role from database
	role, canSpeak := room.GetUserRoleInRoom(c.RoomID, c.UserID)
	c.Role = string(role)  // ✅ Convert to string
	c.CanSpeak = canSpeak

	log.Printf("✅ Client registered: user=%s, room=%s, role=%s, can_speak=%v",
		c.UserID, c.RoomID, c.Role, c.CanSpeak)

	// 4. Send role info to client
	c.Send <- Message{
		Type:   MsgTypeRoleAssigned,
		RoomID: c.RoomID,
		Payload: map[string]interface{}{
			"role":      c.Role,
			"can_speak": c.CanSpeak,
		},
	}

	// 5. Broadcast updated listener count
	h.broadcastListenerCount(c.RoomID)
}

// handleUnregister processes client disconnections
func (h *Hub) handleUnregister(c *Client) {
	roomClients, exists := h.Rooms[c.RoomID]
	if !exists {
		return
	}

	// 1. Remove client from room
	delete(roomClients, c)
	
	// 2. Close send channel (safe to call multiple times)
	select {
	case <-c.Send:
		// Already closed
	default:
		close(c.Send)
	}

	log.Printf("🔌 Client unregistered: user=%s, room=%s, role=%s",
		c.UserID, c.RoomID, c.Role)

	// 3. If host left, end the entire room
	if c.Role == "host" {
		log.Printf("🔴 Host left room %s - ending room for all participants", c.RoomID)
		h.endRoom(c.RoomID, roomClients)
		return
	}

	// 4. Broadcast updated listener count
	h.broadcastListenerCount(c.RoomID)

	// 5. Clean up empty room
	if len(roomClients) == 0 {
		delete(h.Rooms, c.RoomID)
		log.Printf("🧹 Room %s cleaned up (no clients remaining)", c.RoomID)
	}
}

// handleBroadcast processes message broadcasts to room participants
func (h *Hub) handleBroadcast(msg Message) {
	roomClients, exists := h.Rooms[msg.RoomID]
	if !exists {
		return
	}

	for client := range roomClients {
		// Don't send message back to sender
		if client.UserID == msg.From {
			continue
		}

		// Filter messages based on permissions
		if !h.shouldReceiveMessage(client, msg) {
			continue
		}

		// Try to send, remove client if channel is full
		select {
		case client.Send <- msg:
			// Message sent successfully
		default:
			// Channel full, remove client
			log.Printf("⚠️ Client %s send channel full, removing", client.UserID)
			close(client.Send)
			delete(roomClients, client)
		}
	}
}

// shouldReceiveMessage checks if a client should receive a message based on permissions
func (h *Hub) shouldReceiveMessage(c *Client, msg Message) bool {
	// Audio messages only for clients who can speak
	audioMessages := map[string]bool{
		MsgTypeAudio:    true,
		MsgTypeMicOn:    true,
		MsgTypeMicOff:   true,
		MsgTypeSpeaking: true,
	}

	if audioMessages[msg.Type] {
		// Listeners don't receive audio messages
		return c.CanSpeak
	}

	// All other messages are broadcast to everyone
	return true
}

// endRoom closes a room and notifies all participants
func (h *Hub) endRoom(roomID string, clients map[*Client]bool) {
	// 1. Notify all clients that room ended
	for client := range clients {
		client.Send <- Message{
			Type:   MsgTypeRoomEnded,
			RoomID: roomID,
		}
		close(client.Send)
	}

	// 2. Remove room from hub
	delete(h.Rooms, roomID)

	// 3. Update database
	go func() {
		if err := room.EndRoom(roomID); err != nil {
			log.Printf("❌ Failed to end room %s in database: %v", roomID, err)
		}
	}()

	log.Printf("✅ Room %s ended successfully", roomID)
}

// broadcastListenerCount sends updated listener count to all clients in a room
func (h *Hub) broadcastListenerCount(roomID string) {
	roomClients, exists := h.Rooms[roomID]
	if !exists {
		return
	}

	count := len(roomClients)
	msg := Message{
		Type:   MsgTypeListenerCount,
		RoomID: roomID,
		Payload: map[string]int{
			"count": count,
		},
	}

	for client := range roomClients {
		select {
		case client.Send <- msg:
			// Sent successfully
		default:
			// Skip if channel full
			log.Printf("⚠️ Skipped listener count update for user %s (channel full)", client.UserID)
		}
	}

	log.Printf("📊 Broadcasted listener count: room=%s, count=%d", roomID, count)
}