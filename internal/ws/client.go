package ws

import (
	"encoding/json"

	"github.com/gorilla/websocket"
)

type Client struct {
	Conn   *websocket.Conn
	Send   chan Message
	UserID string
	RoomID string
}

func (c *Client) WritePump() {
	defer c.Conn.Close()

	for msg := range c.Send {
		data, _ := json.Marshal(msg)
		c.Conn.WriteMessage(websocket.TextMessage, data)
	}
}
