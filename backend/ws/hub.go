// backend/ws/hub.go - UPDATED with Chat Support
package ws

import (
	"context"
	"log"
	"time"

	"voxroom/backend/db"
	"voxroom/backend/room"
)

// Hub maintains the set of active clients and broadcasts messages to clients
type Hub struct {
	// Registered clients per room
	Rooms map[string]map[*Client]bool

	// Register requests from clients
	Register chan *Client

	// Unregister requests from clients
	Unregister chan *Client

	// Inbound messages from clients
	Broadcast chan Message
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		Rooms:      make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan Message, 256),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	cleanupTicker := time.NewTicker(30 * time.Second)
	defer cleanupTicker.Stop()

	for {
		select {
		case client := <-h.Register:
			h.handleRegister(client)

		case client := <-h.Unregister:
			h.handleUnregister(client)

		case message := <-h.Broadcast:
			h.handleBroadcast(message)

		case <-cleanupTicker.C:
			h.cleanupStaleConnections()
		}
	}
}

// handleRegister registers a new client
func (h *Hub) handleRegister(client *Client) {
	// Get user's role from database
	userRole, canSpeak := room.GetUserRoleInRoom(client.RoomID, client.UserID)
	client.Role = string(userRole)
	client.CanSpeak = canSpeak

	// Create room if doesn't exist
	if h.Rooms[client.RoomID] == nil {
		h.Rooms[client.RoomID] = make(map[*Client]bool)
		log.Printf("🏠 Created new room: %s", client.RoomID)
	}

	// Add client to room
	h.Rooms[client.RoomID][client] = true

	log.Printf("✅ Client registered: user=%s, room=%s, role=%s, can_speak=%v, total_in_room=%d",
		client.UserID, client.RoomID, client.Role, client.CanSpeak, len(h.Rooms[client.RoomID]))

	// Update user presence in database
	go h.updatePresence(client.UserID, "online", &client.RoomID)

	// ✅ Broadcast user joined event
	h.broadcastToRoom(client.RoomID, Message{
		Type:   "user_joined",
		RoomID: client.RoomID,
		From:   client.UserID,
		Data: map[string]interface{}{
			"user_id":  client.UserID,
			"username": client.Username, // Set from client
			"role":     client.Role,
			"can_speak": client.CanSpeak,
		},
	}, nil)

	// Send current room state to new client
	h.sendRoomState(client)

	// ✅ Update listener count
	h.broadcastListenerCount(client.RoomID)
}

// handleUnregister unregisters a client
func (h *Hub) handleUnregister(client *Client) {
	if clients, ok := h.Rooms[client.RoomID]; ok {
		if _, exists := clients[client]; exists {
			delete(clients, client)
			close(client.Send)

			log.Printf("🔌 Client unregistered: user=%s, room=%s, remaining=%d",
				client.UserID, client.RoomID, len(clients))

			// Update presence
			go h.updatePresence(client.UserID, "offline", nil)

			// ✅ Broadcast user left event
			h.broadcastToRoom(client.RoomID, Message{
				Type:   "user_left",
				RoomID: client.RoomID,
				From:   client.UserID,
				Data: map[string]interface{}{
					"user_id":  client.UserID,
					"username": client.Username,
					"role":     client.Role,
				},
			}, nil)

			// ✅ Update listener count
			h.broadcastListenerCount(client.RoomID)

			// Clean up empty room
			if len(clients) == 0 {
				delete(h.Rooms, client.RoomID)
				log.Printf("🗑️  Removed empty room: %s", client.RoomID)
			}
		}
	}
}

// handleBroadcast broadcasts a message to the appropriate recipients
func (h *Hub) handleBroadcast(message Message) {
	// Validate message has required fields
	if message.RoomID == "" {
		log.Printf("⚠️ Broadcast message missing room_id")
		return
	}

	// Get room clients
	clients, ok := h.Rooms[message.RoomID]
	if !ok {
		log.Printf("⚠️ Broadcast to non-existent room: %s", message.RoomID)
		return
	}

	// ✅ Handle different message types
	switch message.Type {
	case "chat":
		// Chat messages go to everyone
		h.broadcastToRoom(message.RoomID, message, nil)
		log.Printf("💬 Chat message: room=%s, from=%s", message.RoomID, message.From)

	case "audio":
		// Audio doesn't go back to sender
		for client := range clients {
			if client.UserID == message.From {
				continue
			}
			select {
			case client.Send <- message:
			default:
				close(client.Send)
				delete(clients, client)
			}
		}

	case "mic_on", "mic_off", "speaking":
		// Broadcast to all including sender (for UI updates)
		h.broadcastToRoom(message.RoomID, message, nil)

	default:
		// Default: broadcast to all
		h.broadcastToRoom(message.RoomID, message, nil)
	}
}

// broadcastToRoom sends a message to all clients in a room
func (h *Hub) broadcastToRoom(roomID string, message Message, excludeClient *Client) {
	clients, ok := h.Rooms[roomID]
	if !ok {
		return
	}

	for client := range clients {
		if excludeClient != nil && client == excludeClient {
			continue
		}

		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(clients, client)
		}
	}
}

// ✅ NEW: Broadcast listener count
func (h *Hub) broadcastListenerCount(roomID string) {
	clients, ok := h.Rooms[roomID]
	if !ok {
		return
	}

	count := len(clients)

	h.broadcastToRoom(roomID, Message{
		Type:   "listener_count",
		RoomID: roomID,
		Data: map[string]interface{}{
			"count": count,
		},
	}, nil)
}

// sendRoomState sends current room participants to a newly joined client
func (h *Hub) sendRoomState(client *Client) {
	clients, ok := h.Rooms[client.RoomID]
	if !ok {
		return
	}

	var participants []map[string]interface{}
	for c := range clients {
		if c.UserID == client.UserID {
			continue // Skip self
		}

		participants = append(participants, map[string]interface{}{
			"user_id":   c.UserID,
			"username":  c.Username,
			"role":      c.Role,
			"can_speak": c.CanSpeak,
		})
	}

	// Send room state to client
	select {
	case client.Send <- Message{
		Type:   "room_state",
		RoomID: client.RoomID,
		Data: map[string]interface{}{
			"participants": participants,
			"total":        len(clients),
		},
	}:
		log.Printf("📋 Sent room state to user %s: %d participants", client.UserID, len(participants))
	default:
		log.Printf("⚠️ Failed to send room state to user %s", client.UserID)
	}
}

// cleanupStaleConnections removes connections that haven't been active
func (h *Hub) cleanupStaleConnections() {
	// Placeholder for future ping/pong mechanism
}

// updatePresence updates user presence in database
func (h *Hub) updatePresence(userID, status string, roomID *string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO public.user_presence (user_id, status, current_room_id, last_seen, updated_at)
		VALUES ($1::uuid, $2, $3, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			status = EXCLUDED.status,
			current_room_id = EXCLUDED.current_room_id,
			last_seen = NOW(),
			updated_at = NOW()
	`, userID, status, roomID)

	if err != nil {
		log.Printf("⚠️ Failed to update presence for user %s: %v", userID, err)
	}
}

// GetRoomClientCount returns number of clients in a room
func (h *Hub) GetRoomClientCount(roomID string) int {
	if clients, ok := h.Rooms[roomID]; ok {
		return len(clients)
	}
	return 0
}

// GetTotalClients returns total number of connected clients
func (h *Hub) GetTotalClients() int {
	total := 0
	for _, clients := range h.Rooms {
		total += len(clients)
	}
	return total
}

// GetRoomList returns list of active room IDs
func (h *Hub) GetRoomList() []string {
	rooms := make([]string, 0, len(h.Rooms))
	for roomID := range h.Rooms {
		rooms = append(rooms, roomID)
	}
	return rooms
}
