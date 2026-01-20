package ws

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

		case client := <-h.Register:
			if h.Rooms[client.RoomID] == nil {
				h.Rooms[client.RoomID] = make(map[*Client]bool)
			}
			h.Rooms[client.RoomID][client] = true

		case client := <-h.Unregister:
			if h.Rooms[client.RoomID] != nil {
				delete(h.Rooms[client.RoomID], client)

				// optional: bersihkan room kosong
				if len(h.Rooms[client.RoomID]) == 0 {
					delete(h.Rooms, client.RoomID)
				}
			}

		case msg := <-h.Broadcast:
			for c := range h.Rooms {
				for client := range h.Rooms[c] {
					client.Send <- msg
				}
			}
		}
	}
}
