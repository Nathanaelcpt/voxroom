package ws

import (
	"encoding/json"
	"net/http"

	"voxroom/internal/auth"

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

	if roomID == "" || token == "" {
		http.Error(w, "missing room_id or token", http.StatusBadRequest)
		return
	}

	userID, err := auth.VerifyToken(token)
	if err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

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

	go client.WritePump()
	hub.Register <- client

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

			// 🔥 SEMUA MESSAGE = SIGNALLING
			hub.Broadcast <- msg
		}
	}()
}
