package ws

import "voxroom/backend/room"

type Hub struct {
	Rooms      map[string]map[*Client]bool
	RoomHost  map[string]*Client
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan Message
}

func NewHub() *Hub {
	return &Hub{
		Rooms:      make(map[string]map[*Client]bool),
		RoomHost:   make(map[string]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan Message),
	}
}

func (h *Hub) Run() {
	for {
		select {

		// ================= REGISTER =================
		case c := <-h.Register:
			if h.Rooms[c.RoomID] == nil {
				h.Rooms[c.RoomID] = make(map[*Client]bool)
			}
			h.Rooms[c.RoomID][c] = true

			// FIRST JOINER = HOST
			if h.RoomHost[c.RoomID] == nil {
				c.Role = "host"
				c.CanSpeak = true
				h.RoomHost[c.RoomID] = c
			} else {
				c.Role = "listener"
				c.CanSpeak = false
			}

			// SEND ROLE
			c.Send <- Message{
				Type:   "role_assigned",
				RoomID: c.RoomID,
				Payload: map[string]string{
					"role": c.Role,
				},
			}

			h.broadcastCount(c.RoomID)

		// ================= UNREGISTER =================
		case c := <-h.Unregister:
			clients := h.Rooms[c.RoomID]
			delete(clients, c)
			close(c.Send)

			// HOST LEAVE = END ROOM
			if h.RoomHost[c.RoomID] == c {
				for client := range clients {
					client.Send <- Message{Type: "room_ended"}
					close(client.Send)
				}
				delete(h.Rooms, c.RoomID)
				delete(h.RoomHost, c.RoomID)

				go room.EndRoom(c.RoomID)
				continue
			}

			h.broadcastCount(c.RoomID)

			if len(clients) == 0 {
				delete(h.Rooms, c.RoomID)
			}

		// ================= BROADCAST =================
		case msg := <-h.Broadcast:
			clients := h.Rooms[msg.RoomID]
			for c := range clients {
				if c.UserID == msg.From {
					continue
				}

				// MIC AUTHORITY
				if msg.Type == "mic_on" || msg.Type == "mic_off" {
					if c.Role == "listener" {
						continue
					}
				}

				select {
				case c.Send <- msg:
				default:
					close(c.Send)
					delete(clients, c)
				}
			}
		}
	}
}

func (h *Hub) broadcastCount(roomID string) {
	clients := h.Rooms[roomID]
	count := len(clients)
	for c := range clients {
		c.Send <- Message{
			Type:   "listener_count",
			RoomID: roomID,
			Payload: map[string]int{
				"count": count,
			},
		}
	}
}
