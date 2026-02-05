// backend/ws/client.go - FIXED (Proper map initialization)
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
	Username string // Store username for chat
	RoomID   string
	Role     string // "host" | "speaker" | "listener"
	CanSpeak bool   // Derived from Role
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

		// ✅ FIXED: Initialize Data map if nil, then add username
		if msg.Type == "chat" {
			// Initialize map if it's nil
			if msg.Data == nil {
				msg.Data = make(map[string]interface{})
			}
			// Now we can safely add to it
			msg.Data["username"] = c.Username
			msg.Data["user_id"] = c.UserID
			msg.Data["role"] = c.Role
		}

		// ✅ FIXED: Same for speaking events
		if msg.Type == "mic_on" || msg.Type == "mic_off" || msg.Type == "speaking" {
			// Initialize map if it's nil
			if msg.Data == nil {
				msg.Data = make(map[string]interface{})
			}
			// Now we can safely add to it
			msg.Data["username"] = c.Username
			msg.Data["user_id"] = c.UserID
			msg.Data["role"] = c.Role
		}

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

	// Chat messages - everyone can send
	if msgType == "chat" {
		return true // Or restrict to canSpeak if you want only speakers to chat
	}

	// All other messages are allowed
	return true
}
