// backend/ws/hub.go - FINAL STABLE
package ws

import (
	"context"
	"log"
	"time"

	"voxroom/backend/db"
	"voxroom/backend/room"
)

/* ================= HUB ================= */

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

/* ================= RUN ================= */

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
	// Ambil role dari DB (authoritative)
	role, canSpeak := room.GetUserRoleInRoom(client.RoomID, client.UserID)
	client.Role = string(role)
	client.CanSpeak = canSpeak

	if h.Rooms[client.RoomID] == nil {
		h.Rooms[client.RoomID] = make(map[*Client]bool)
		log.Printf("🏠 Room created: %s", client.RoomID)
	}

	h.Rooms[client.RoomID][client] = true

	log.Printf(
		"✅ Client joined room=%s user=%s role=%s",
		client.RoomID,
		client.UserID,
		client.Role,
	)

	// Presence online
	go h.updatePresence(client.UserID, "online", &client.RoomID)

	// 🔔 user_joined
	h.broadcastToRoom(client.RoomID, Message{
		Type:   "user_joined",
		RoomID: client.RoomID,
		Data: map[string]interface{}{
			"user_id":  client.UserID,
			"username": client.Username,
			"role":     client.Role,
		},
	}, nil)

	// Kirim state awal ke client
	h.sendRoomState(client)

	// Update count
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

	log.Printf("👋 Client left room=%s user=%s", client.RoomID, client.UserID)

	go h.updatePresence(client.UserID, "offline", nil)

	// 🔔 user_left
	h.broadcastToRoom(client.RoomID, Message{
		Type:   "user_left",
		RoomID: client.RoomID,
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
	clients, ok := h.Rooms[msg.RoomID]
	if !ok {
		return
	}

	switch msg.Type {

	// 💬 CHAT → ke semua (TERMASUK sender)
	case "chat":
		for c := range clients {
			select {
			case c.Send <- msg:
			default:
				close(c.Send)
				delete(clients, c)
			}
		}

	// 🔊 AUDIO → ke semua KECUALI sender
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

	// 🔔 EVENT / ROLE / MIC
	default:
		for c := range clients {
			select {
			case c.Send <- msg:
			default:
				close(c.Send)
				delete(clients, c)
			}
		}
	}
}

/* ================= HELPERS ================= */

func (h *Hub) broadcastToRoom(roomID string, msg Message, exclude *Client) {
	clients, ok := h.Rooms[roomID]
	if !ok {
		return
	}

	for c := range clients {
		if exclude != nil && c == exclude {
			continue
		}
		c.Send <- msg
	}
}

func (h *Hub) broadcastListenerCount(roomID string) {
	clients, ok := h.Rooms[roomID]
	if !ok {
		return
	}

	h.broadcastToRoom(roomID, Message{
		Type:   "listener_count",
		RoomID: roomID,
		Data: map[string]interface{}{
			"count": len(clients),
		},
	}, nil)
}

func (h *Hub) sendRoomState(client *Client) {
	clients, ok := h.Rooms[client.RoomID]
	if !ok {
		return
	}

	var participants []map[string]interface{}
	for c := range clients {
		if c.UserID == client.UserID {
			continue
		}
		participants = append(participants, map[string]interface{}{
			"user_id":  c.UserID,
			"username": c.Username,
			"role":     c.Role,
			"can_speak": c.CanSpeak,
		})
	}

	client.Send <- Message{
		Type:   "room_state",
		RoomID: client.RoomID,
		Data: map[string]interface{}{
			"participants": participants,
			"total":        len(clients),
		},
	}
}

/* ================= PRESENCE ================= */

func (h *Hub) updatePresence(userID, status string, roomID *string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO public.user_presence (user_id, status, current_room_id, updated_at)
		VALUES ($1::uuid, $2, $3, NOW())
		ON CONFLICT (user_id)
		DO UPDATE SET
			status = EXCLUDED.status,
			current_room_id = EXCLUDED.current_room_id,
			updated_at = NOW()
	`, userID, status, roomID)

	if err != nil {
		log.Printf("⚠️ Presence update failed user=%s err=%v", userID, err)
	}
}
