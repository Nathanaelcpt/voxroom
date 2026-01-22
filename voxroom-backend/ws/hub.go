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

		case c := <-h.Register:
			if h.Rooms[c.RoomID] == nil {
				h.Rooms[c.RoomID] = make(map[*Client]bool)
			}
			h.Rooms[c.RoomID][c] = true

		case c := <-h.Unregister:
			delete(h.Rooms[c.RoomID], c)

		case msg := <-h.Broadcast:
			for c := range h.Rooms[msg.RoomID] {
				// relay ke semua kecuali pengirim
				if c.UserID != msg.From {
					c.Send <- msg
				}
			}
		}
	}
}
