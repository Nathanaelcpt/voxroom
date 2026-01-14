package ws

import (
	"voxroom/internal/room"
)

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
		Broadcast:  make(chan Message),
	}
}

func (h *Hub) Run() {
	for {
		select {

		// ===== REGISTER =====
		case client := <-h.Register:
			if h.Rooms[client.RoomID] == nil {
				h.Rooms[client.RoomID] = make(map[*Client]bool)
			}
			h.Rooms[client.RoomID][client] = true

			_ = room.SaveEvent(client.RoomID, client.UserID, "JOIN")

			// kirim ke diri sendiri
			client.Send <- Message{
				Type:   "USER_JOIN",
				UserID: client.UserID,
				RoomID: client.RoomID,
			}

			// broadcast ke user lain
			for c := range h.Rooms[client.RoomID] {
				if c != client {
					c.Send <- Message{
						Type:   "USER_JOIN",
						UserID: client.UserID,
						RoomID: client.RoomID,
					}
				}
			}

		// ===== UNREGISTER =====
		case client := <-h.Unregister:
			if _, ok := h.Rooms[client.RoomID][client]; ok {
				delete(h.Rooms[client.RoomID], client)

				_ = room.SaveEvent(client.RoomID, client.UserID, "LEAVE")

				for c := range h.Rooms[client.RoomID] {
					c.Send <- Message{
						Type:   "USER_LEAVE",
						UserID: client.UserID,
						RoomID: client.RoomID,
					}
				}
			}

		// ===== 🔥 BROADCAST (INI YANG WAJIB ADA) =====
		case msg := <-h.Broadcast:
			for c := range h.Rooms[msg.RoomID] {
				c.Send <- msg
			}
		}
	}
}
