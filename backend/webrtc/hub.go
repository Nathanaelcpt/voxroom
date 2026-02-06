package webrtc

import (
	"log"
	"sync"
)

// Global hub instance
var GlobalHub *Hub

// Hub maintains active clients and broadcasts messages
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from clients
	broadcast chan WSMessage

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe operations
	mu sync.RWMutex
}

// NewHub creates a new Hub
func NewHub() *Hub {
	hub := &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan WSMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
	
	// Set as global
	GlobalHub = hub
	
	return hub
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			
			log.Printf("✅ Client registered: id=%s, user=%s, room=%s", 
				client.ID, client.UserID, client.RoomID)

			// Notify other users in room
			h.BroadcastToRoom(client.RoomID, WSMessage{
				Type: TypeUserJoined,
				Data: map[string]interface{}{
					"user_id":  client.UserID,
					"username": client.Username,
					"role":     client.Role,
				},
			}, client.ID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				
				log.Printf("❌ Client unregistered: id=%s, user=%s, room=%s", 
					client.ID, client.UserID, client.RoomID)
				
				// Notify other users in room
				go h.BroadcastToRoom(client.RoomID, WSMessage{
					Type: TypeUserLeft,
					Data: map[string]interface{}{
						"user_id":  client.UserID,
						"username": client.Username,
					},
				}, client.ID)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			// Global broadcast (not used, kept for compatibility)
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastToRoom broadcasts a message to all clients in a specific room
func (h *Hub) BroadcastToRoom(roomID string, message WSMessage, excludeClientID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if roomID == "" {
		log.Printf("⚠️ BroadcastToRoom: empty roomID")
		return
	}

	count := 0
	failed := 0

	for client := range h.clients {
		// Skip if not in same room
		if client.RoomID != roomID {
			continue
		}

		// Skip if client is excluded (e.g., sender for audio)
		if excludeClientID != "" && client.ID == excludeClientID {
			continue
		}

		// Send message to client
		select {
		case client.send <- message:
			count++
		default:
			// Client buffer full, close connection
			log.Printf("⚠️ Client buffer full, closing: id=%s, user=%s", 
				client.ID, client.UserID)
			go func(c *Client) {
				close(c.send)
				h.mu.Lock()
				delete(h.clients, c)
				h.mu.Unlock()
			}(client)
			failed++
		}
	}

	if count > 0 || failed > 0 {
		log.Printf("📢 Broadcast to room %s: type=%s, sent=%d, failed=%d, excluded=%s", 
			roomID, message.Type, count, failed, excludeClientID)
	}
}

// BroadcastToUser broadcasts a message to a specific user
func (h *Hub) BroadcastToUser(userID string, message WSMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	count := 0
	for client := range h.clients {
		if client.UserID == userID {
			select {
			case client.send <- message:
				count++
			default:
				log.Printf("⚠️ Failed to send to user: %s", userID)
			}
		}
	}

	if count > 0 {
		log.Printf("📤 Sent to user %s: type=%s, clients=%d", userID, message.Type, count)
	}
}

// CloseRoom closes all connections in a room
func (h *Hub) CloseRoom(roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	count := 0
	for client := range h.clients {
		if client.RoomID == roomID {
			close(client.send)
			delete(h.clients, client)
			count++
		}
	}

	log.Printf("🔴 Closed %d connections in room %s", count, roomID)
}

// GetRoomClients returns all clients in a room
func (h *Hub) GetRoomClients(roomID string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var clients []*Client
	for client := range h.clients {
		if client.RoomID == roomID {
			clients = append(clients, client)
		}
	}

	return clients
}

// GetClientCount returns the total number of connected clients
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	return len(h.clients)
}

// GetRoomClientCount returns the number of clients in a specific room
func (h *Hub) GetRoomClientCount(roomID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	count := 0
	for client := range h.clients {
		if client.RoomID == roomID {
			count++
		}
	}

	return count
}
