package ws

import (
	"net/http"

	"voxroom/backend/auth"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("roomId")
	if roomID == "" {
		http.Error(w, "missing roomId", http.StatusBadRequest)
		return
	}

	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &Client{
		Conn:   conn,
		Send:   make(chan Message, 16),
		UserID: userID,
		RoomID: roomID,
	}

	hub.Register <- client
	go client.WritePump()

	go func() {
		defer func() {
			hub.Unregister <- client
			conn.Close()
		}()

		for {
			var msg Message
			if err := conn.ReadJSON(&msg); err != nil {
				return
			}

			msg.RoomID = roomID
			msg.From = userID
			hub.Broadcast <- msg
		}
	}()
}
