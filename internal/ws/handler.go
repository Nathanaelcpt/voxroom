package ws

import (
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
		Send:   make(chan Message, 10), // buffer WAJIB
		UserID: userID,
		RoomID: roomID,
	}

	// 🔴 1. WritePump dulu (hindari race)
	go client.WritePump()

	// 🔴 2. Register ke hub
	hub.Register <- client

	// 🔴 3. Read loop (biar WS hidup)
	go func() {
		defer func() {
			hub.Unregister <- client
			conn.Close()
		}()

		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
}
