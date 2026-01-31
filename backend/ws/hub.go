package ws

import (
	"log"

	"voxroom/backend/room"
	"voxroom/backend/webrtc"
)

// Hub maintains active clients and broadcasts messages to them
type Hub struct {
	// Room ID -> Set of clients in that room
	Rooms map[string]map[*Client]bool

	// Channels for hub operations
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan Message

	// ✅ Audio handler for WebRTC streaming
	AudioHandler *webrtc.AudioHandler
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		Rooms:        make(map[string]map[*Client]bool),
		Register:     make(chan *Client),
		Unregister:   make(chan *Client),
		Broadcast:    make(chan Message),
		AudioHandler: webrtc.NewAudioHandler(), // ✅ Initialize audio handler
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
	c.Role = string(role)
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

	// 2. Close send channel
	select {
	case <-c.Send:
	default:
		close(c.Send)
	}

	log.Printf("🔌 Client unregistered: user=%s, room=%s, role=%s",
		c.UserID, c.RoomID, c.Role)

	// ✅ 3. Stop audio stream if user was streaming
	h.AudioHandler.HandleUserLeft(c.UserID)

	// 4. Broadcast updated listener count
	h.broadcastListenerCount(c.RoomID)

	// 5. Clean up empty room from hub memory only (not from DB)
	if len(roomClients) == 0 {
		delete(h.Rooms, c.RoomID)
		log.Printf("🧹 Room %s cleaned up from hub (no active WebSocket clients)", c.RoomID)
	}
}

// handleBroadcast processes message broadcasts to room participants
func (h *Hub) handleBroadcast(msg Message) {
	roomClients, exists := h.Rooms[msg.RoomID]
	if !exists {
		return
	}

	// ✅ Handle special message types with switch
	switch msg.Type {
	case MsgTypeAudio:
		h.handleAudioBroadcast(msg, roomClients)
		return

	case MsgTypeMicOn:
		h.AudioHandler.HandleMicOn(msg.From, msg.RoomID)

	case MsgTypeMicOff:
		h.AudioHandler.HandleMicOff(msg.From, msg.RoomID)
	}

	// Regular message broadcast
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

// ✅ handleAudioBroadcast broadcasts audio to all eligible clients
func (h *Hub) handleAudioBroadcast(msg Message, roomClients map[*Client]bool) {
	// Process audio chunk
	if payload, ok := msg.Payload.(map[string]interface{}); ok {
		if chunk, ok := payload["chunk"].(string); ok {
			// Validate and log audio chunk
			if err := h.AudioHandler.HandleAudioChunk(msg.From, msg.RoomID, chunk); err != nil {
				// Error logged in handler
				return
			}

			// Broadcast to all clients who should receive audio
			broadcastCount := 0
			for client := range roomClients {
				// Don't send back to sender
				if client.UserID == msg.From {
					continue
				}

				// ✅ All users can receive audio from speakers/host
				// Permission check happens in shouldReceiveMessage
				if h.shouldReceiveMessage(client, msg) {
					select {
					case client.Send <- msg:
						broadcastCount++
					default:
						// Skip if channel full (audio is real-time, don't block)
					}
				}
			}

			// Periodic logging (every 100 chunks to avoid spam)
			// You can remove this or adjust the frequency
			// if broadcastCount > 0 && msg.From != "" {
			// 	log.Printf("🔊 Audio broadcast: from=%s, to=%d listeners", msg.From[:8], broadcastCount)
			// }
		}
	}
}

// shouldReceiveMessage checks if a client should receive a message based on permissions
func (h *Hub) shouldReceiveMessage(c *Client, msg Message) bool {
	// ✅ Audio messages: everyone can receive audio from host/speakers
	if msg.Type == MsgTypeAudio {
		return true // Sender already filtered out in handleAudioBroadcast
	}

	// Mic control messages only for speakers
	micMessages := map[string]bool{
		MsgTypeMicOn:  true,
		MsgTypeMicOff: true,
	}

	if micMessages[msg.Type] {
		return c.CanSpeak
	}

	// All other messages are broadcast to everyone
	return true
}

// EndRoom closes a room and notifies all participants.
// Called only from EndRoomHandler via explicit POST /rooms/{id}/end.
func (h *Hub) EndRoom(roomID string) {
	roomClients, exists := h.Rooms[roomID]
	if !exists {
		log.Printf("ℹ️ EndRoom: no active WebSocket clients in room %s", roomID)
		return
	}

	// 1. Notify all clients that room ended
	for client := range roomClients {
		select {
		case client.Send <- Message{
			Type:   MsgTypeRoomEnded,
			RoomID: roomID,
		}:
		default:
		}
		close(client.Send)
		
		// ✅ Stop audio streams
		h.AudioHandler.HandleUserLeft(client.UserID)
	}

	// 2. Remove room from hub
	delete(h.Rooms, roomID)

	log.Printf("✅ Hub: broadcasted room_ended to all clients in room %s", roomID)
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
