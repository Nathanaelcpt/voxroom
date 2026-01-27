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
			clients, ok := h.Rooms[c.RoomID]
			if ok {
				if _, exists := clients[c]; exists {
					delete(clients, c)
					close(c.Send)
				}
				if len(clients) == 0 {
					delete(h.Rooms, c.RoomID)
				}
			}

		case msg := <-h.Broadcast:
			clients, ok := h.Rooms[msg.RoomID]
			if !ok {
				continue
			}

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
		}
	}
}
