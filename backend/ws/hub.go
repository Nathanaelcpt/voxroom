// backend/ws/hub.go - FINAL
package ws

import (
	"context"
	"log"
	"time"

	"voxroom/backend/db"
	"voxroom/backend/room"
)

// Hub manages active websocket clients per room
type Hub struct {
	Rooms      map[string]map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan Message
}

func NewHub() *Hub {
	return &Hub{
		Rooms:      make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan Message, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.handleRegister(client)

		case client := <-h.Unregister:
			h.handleUnregister(client)

		case msg := <-h.Broadcast:
			h.handleBroadcast(msg)
		}
	}
}

/* ================= REGISTER ================= */

func (h *Hub) handleRegister(client *Client) {
	// 🔑 ROLE SOURCE OF TRUTH
	role, canSpeak := room.GetUserRoleInRoom(client.RoomID, client.UserID)
	client.Role = string(role)
	client.CanSpeak = canSpeak

	if h.Rooms[client.RoomID] == nil {
		h.Rooms[client.RoomID] = make(map[*Client]bool)
		log.Printf("🏠 Room created: %s", client.RoomID)
	}

	h.Rooms[client.RoomID][client] = true

	log.Printf("✅ WS join: user=%s role=%s room=%s total=%d",
		client.UserID,
		client.Role,
		client.RoomID,
		len(h.Rooms[client.RoomID]),
	)

	// Presence online
	go h.updatePresence(client.UserID, "online", &client.RoomID)

	// 🔔 USER JOINED EVENT
	h.broadcastToRoom(client.RoomID, Message{
		Type:   "user_joined",
		RoomID: client.RoomID,
		From:   client.UserID,
		Data: map[string]interface{}{
			"user_id":  client.UserID,
			"username": client.Username,
			"role":     client.Role,
			"can_speak": client.CanSpeak,
		},
	}, nil)

	// Kirim state room ke client baru
	h.sendRoomState(client)

	// Update listener count
	h.broadcastListenerCount(client.RoomID)
}

/* ================= UNREGISTER ================= */

func (h *Hub) handleUnregister(client *Client) {
	clients, ok := h.Rooms[client.RoomID]
	if !ok {
		return
	}

	if _, exists := clients[client]; !exists {
		return
	}

	delete(clients, client)
	close(client.Send)

	log.Printf("❌ WS leave: user=%s room=%s remaining=%d",
		client.UserID,
		client.RoomID,
		len(clients),
	)

	go h.updatePresence(client.UserID, "offline", nil)

	// 🔔 USER LEFT EVENT
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

	h.broadcastListenerCount(client.RoomID)

	if len(clients) == 0 {
		delete(h.Rooms, client.RoomID)
		log.Printf("🗑️ Room removed: %s", client.RoomID)
	}
}

/* ================= BROADCAST ================= */

func (h *Hub) handleBroadcast(msg Message) {
	if msg.RoomID == "" {
		log.Println("⚠️ WS broadcast missing room_id")
		return
	}

	clients, ok := h.Rooms[msg.RoomID]
	if !ok {
		return
	}

	switch msg.Type {

	// 💬 CHAT (pakai Data)
	case "chat":
		h.broadcastToRoom(msg.RoomID, msg, nil)
		log.Printf("💬 Chat: room=%s from=%s", msg.RoomID, msg.From)

	// 🔊 AUDIO (pakai Payload)
	case "audio":
		for c := range clients {
			if c.UserID == msg.From {
				continue
			}
			select {
			case c.Send <- msg:
			default:
				close(c.Send)
				delete(clients, c)
			}
		}

	// 🎙️ MIC / SPEAKING
	case "mic_on", "mic_off", "speaking":
		h.broadcastToRoom(msg.RoomID, msg, nil)

	// 🔁 ROLE UPDATED (trigger dari REST API)
	case "role_updated":
		h.handleRoleUpdated(msg)

	default:
		h.broadcastToRoom(msg.RoomID, msg, nil)
	}
}

/* ================= ROLE UPDATE ================= */

func (h *Hub) handleRoleUpdated(msg Message) {
	roomID := msg.RoomID

	clients, ok := h.Rooms[roomID]
	if !ok {
		return
	}

	userID, _ := msg.Data["user_id"].(string)
	newRole, _ := msg.Data["role"].(string)

	for c := range clients {
		if c.UserID == userID {
			c.Role = newRole
			c.CanSpeak = newRole == "host" || newRole == "speaker"
		}
	}

	h.broadcastToRoom(roomID, msg, nil)
}

/* ================= HELPERS ================= */

func (h *Hub) broadcastToRoom(roomID string, msg Message, exclude *Client) {
	clients := h.Rooms[roomID]

	for c := range clients {
		if exclude != nil && c == exclude {
			continue
		}
		select {
		case c.Send <- msg:
		default:
			close(c.Send)
			delete(clients, c)
		}
	}
}

func (h *Hub) broadcastListenerCount(roomID string) {
	clients := h.Rooms[roomID]
	count := len(clients)

	h.broadcastToRoom(roomID, Message{
		Type:   "listener_count",
		RoomID: roomID,
		Data: map[string]interface{}{
			"count": count,
		},
	}, nil)
}

func (h *Hub) sendRoomState(client *Client) {
	clients := h.Rooms[client.RoomID]

	var list []map[string]interface{}
	for c := range clients {
		if c.UserID == client.UserID {
			continue
		}
		list = append(list, map[string]interface{}{
			"user_id":   c.UserID,
			"username":  c.Username,
			"role":      c.Role,
			"can_speak": c.CanSpeak,
		})
	}

	client.Send <- Message{
		Type:   "room_state",
		RoomID: client.RoomID,
		Data: map[string]interface{}{
			"participants": list,
			"total":        len(clients),
		},
	}
}

/* ================= PRESENCE ================= */

func (h *Hub) updatePresence(userID, status string, roomID *string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO public.user_presence
			(user_id, status, current_room_id, last_seen, updated_at)
		VALUES
			($1::uuid, $2, $3, NOW(), NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET
			status = EXCLUDED.status,
			current_room_id = EXCLUDED.current_room_id,
			last_seen = NOW(),
			updated_at = NOW()
	`, userID, status, roomID)

	if err != nil {
		log.Printf("⚠️ Presence update failed: %v", err)
	}
}
