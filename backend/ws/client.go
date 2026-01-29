package ws

import (
	"log"

	"github.com/gorilla/websocket"
)

// Client represents a WebSocket client in a room
type Client struct {
	Conn     *websocket.Conn
	Send     chan Message
	UserID   string
	RoomID   string
	Role     string // "host" | "speaker" | "listener"
	CanSpeak bool   // Derived from Role (host/speaker = true, listener = false)
}

// WritePump pumps messages from the hub to the websocket connection
func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
		log.Printf("🔌 WritePump closed for user %s in room %s", c.UserID, c.RoomID)
	}()

	for msg := range c.Send {
		if err := c.Conn.WriteJSON(msg); err != nil {
			log.Printf("❌ WriteJSON error for user %s: %v", c.UserID, err)
			return
		}
	}
}

// ReadPump pumps messages from the websocket connection to the hub
func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		hub.Unregister <- c
		c.Conn.Close()
		log.Printf("🔌 ReadPump closed for user %s in room %s", c.UserID, c.RoomID)
	}()

	for {
		var msg Message
		if err := c.Conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("⚠️ Unexpected close error: %v", err)
			}
			return
		}

		// Set metadata
		msg.RoomID = c.RoomID
		msg.From = c.UserID

		// Validate permissions
		if !c.validateMessagePermission(msg.Type) {
			log.Printf("⛔ User %s (%s) tried to send unauthorized message type: %s", 
				c.UserID, c.Role, msg.Type)
			continue
		}

		// Broadcast to hub
		hub.Broadcast <- msg
	}
}

// validateMessagePermission checks if client has permission to send this message type
func (c *Client) validateMessagePermission(msgType string) bool {
	// Audio messages require CanSpeak permission
	audioMessages := map[string]bool{
		"audio":    true,
		"mic_on":   true,
		"mic_off":  true,
		"speaking": true,
	}

	if audioMessages[msgType] {
		return c.CanSpeak
	}

	// All other messages are allowed
	return true
}