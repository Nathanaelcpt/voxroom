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

type Message struct {
	Type   string `json:"type"`
	UserID string `json:"user_id"`
	RoomID string `json:"room_id"`
	Text   string `json:"text,omitempty"`
}

func (c *Client) WritePump() {
	defer c.Conn.Close()

	for msg := range c.Send {
		data, _ := json.Marshal(msg)
		c.Conn.WriteMessage(websocket.TextMessage, data)
	}
}
