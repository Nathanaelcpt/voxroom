package ws

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	Conn     *websocket.Conn
	Send     chan Message
	UserID   string
	Username string
	RoomID   string
	Role     string
	CanSpeak bool
}

/* ================= WRITE ================= */

func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
		log.Printf("🔌 WritePump closed user=%s", c.UserID)
	}()

	for msg := range c.Send {
		if err := c.Conn.WriteJSON(msg); err != nil {
			log.Printf("❌ Write error user=%s err=%v", c.UserID, err)
			return
		}
	}
}

/* ================= READ ================= */

func (c *Client) ReadPump(hub *Hub) {
	defer func() {
		hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		var msg Message
		if err := c.Conn.ReadJSON(&msg); err != nil {
			return
		}

		// 🔒 server authoritative
		msg.RoomID = c.RoomID
		msg.From = c.UserID

		if msg.Data == nil {
			msg.Data = map[string]interface{}{}
		}

		/* ===== CHAT ===== */
		if msg.Type == "chat" {
			content, ok := msg.Data["content"].(string)
			if !ok || content == "" {
				continue
			}

			log.Printf("💬 Chat from user=%s (%s): %s", c.Username, c.Role, content)

			msg.Data = map[string]interface{}{
				"content":   content,
				"user_id":   c.UserID,
				"username":  c.Username,
				"role":      c.Role,        // ✅ TAMBAHKAN INI
				"timestamp": time.Now().UnixMilli(),
			}
			
			log.Printf("📤 Broadcasting chat to room %s", c.RoomID)
		}

		/* ===== MIC ===== */
		if msg.Type == "mic_on" || msg.Type == "mic_off" || msg.Type == "speaking" {
			msg.Data = map[string]interface{}{
				"user_id":  c.UserID,
				"username": c.Username,
			}
		}

		if !c.validatePermission(msg.Type) {
			continue
		}

		hub.Broadcast <- msg
	}
}

func (c *Client) validatePermission(t string) bool {
	if t == "audio" || t == "mic_on" || t == "mic_off" || t == "speaking" {
		return c.CanSpeak
	}
	return true
}
