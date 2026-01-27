package ws

import "github.com/gorilla/websocket"

type Client struct {
	Conn     *websocket.Conn
	Send     chan Message
	UserID   string
	RoomID   string
	Role     string // host | speaker | listener
	CanSpeak bool
}

func (c *Client) WritePump() {
	defer c.Conn.Close()
	for msg := range c.Send {
		if err := c.Conn.WriteJSON(msg); err != nil {
			return
		}
	}
}
