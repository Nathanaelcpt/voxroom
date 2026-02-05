// backend/ws/client.go - FINAL & STABLE
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
	Username string
	RoomID   string
	Role     string // "host" | "speaker" | "listener" (SET BY HUB)
	CanSpeak bool   // derived from Role (SET BY HUB)
}

/* ================= WRITE ================= */

// WritePump sends messages from hub to websocket
func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
		log.Printf("🔌 WritePump closed: user=%s room=%s", c.UserID, c.RoomID)
	}()

	for msg := range c.Send {
		if err := c.Conn.WriteJSON(msg); err != nil {
			log.Printf("❌ WriteJSON error: user=%s err=%v", c.UserID, err)
			return
		}
	}
}

/* ================= READ ================= */

// ReadPump reads messages from websocket and forwards to hub
func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		hub.Unregister <- c
		c.Conn.Close()
		log.Printf("🔌 ReadPump closed: user=%s room=%s", c.UserID, c.RoomID)
	}()

	for {
		var msg Message
		if err := c.Conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(
				err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {
				log.Printf("⚠️ WS close error: %v", err)
			}
			return
		}

		// 🔒 Always set server-controlled fields
		msg.RoomID = c.RoomID
		msg.From = c.UserID

		// Ensure Data map exists
		if msg.Data == nil {
			msg.Data = make(map[string]interface{})
		}

		/* ================= CHAT ================= */
		if msg.Type == "chat" {
			// Normalize content
			content, ok := msg.Data["content"].(string)
			if !ok || content == "" {
				// ignore empty / invalid chat
				continue
			}

			msg.Data = map[string]interface{}{
				"content":  content,
				"user_id":  c.UserID,
				"username": c.Username,
				// ⛔ role JANGAN dikirim dari client
				// role authoritative via hub (role_updated)
			}
		}

		/* ================= MIC / SPEAK ================= */
		if msg.Type == "mic_on" || msg.Type == "mic_off" || msg.Type == "speaking" {
			msg.Data = map[string]interface{}{
				"user_id":  c.UserID,
				"username": c.Username,
			}
		}

		/* ================= PERMISSION CHECK ================= */
		if !c.validateMessagePermission(msg.Type) {
			log.Printf(
				"⛔ Unauthorized message: user=%s role=%s type=%s",
				c.UserID, c.Role, msg.Type,
			)
			continue
		}

		// Send to hub
		hub.Broadcast <- msg
	}
}

/* ================= PERMISSIONS ================= */

func (c *Client) validateMessagePermission(msgType string) bool {
	audioMessages := map[string]bool{
		"audio":    true,
		"mic_on":   true,
		"mic_off":  true,
		"speaking": true,
	}

	if audioMessages[msgType] {
		return c.CanSpeak
	}

	// Everyone can chat
	if msgType == "chat" {
		return true
	}

	return true
}
