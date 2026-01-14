package ws

import (
	"encoding/json"
	"net/http"

	"voxroom/internal/auth"
	"voxroom/internal/room"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room_id")
	token := r.URL.Query().Get("token")

	// 🔒 VALIDASI PARAM
	if roomID == "" || token == "" {
		http.Error(w, "missing room_id or token", http.StatusBadRequest)
		return
	}

	// 🔒 VERIFY JWT
	userID, err := auth.VerifyToken(token)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	// 🔹 UPGRADE KE WEBSOCKET
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &Client{
		Conn:   conn,
		Send:   make(chan Message, 10),
		UserID: userID,
		RoomID: roomID,
	}

	// 1️⃣ WritePump dulu
	go client.WritePump()

	// 2️⃣ Register ke hub
	hub.Register <- client

	// 3️⃣ Read loop (TERIMA MESSAGE DARI CLIENT)
	go func() {
		defer func() {
			hub.Unregister <- client
			conn.Close()
		}()

		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}

			var msg Message
			if err := json.Unmarshal(data, &msg); err != nil {
				continue
			}

			// 🔴 HANDLE TRANSKRIP
			if msg.Type == "TRANSCRIPT" {
				msg.UserID = client.UserID
				msg.RoomID = client.RoomID

				// simpan ke DB (partition)
				_ = room.SaveTranscript(
					msg.RoomID,
					msg.UserID,
					msg.Text,
				)

				// broadcast ke room
				hub.Broadcast <- msg
			}
		}
	}()
}
