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

			// 🔴 SIMPAN EVENT
			_ = room.SaveEvent(client.RoomID, client.UserID, "JOIN")

			// 🔴 KIRIM KE DIRI SENDIRI (INI YANG HILANG)
			client.Send <- Message{
				Type:   "USER_JOIN",
				UserID: client.UserID,
				RoomID: client.RoomID,
			}

			// 🔴 BROADCAST KE ORANG LAIN
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
		}
	}
}
