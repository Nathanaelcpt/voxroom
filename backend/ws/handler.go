package ws

import (
	"log"
	"net/http"

	"voxroom/backend/auth"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: In production, validate origin properly
		return true
	},
}

// ServeWS handles WebSocket connections for real-time room communication
func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// 1. Validate room ID
	roomID := r.URL.Query().Get("roomId")
	if roomID == "" {
		log.Println("❌ WebSocket rejected: missing roomId")
		http.Error(w, "missing roomId parameter", http.StatusBadRequest)
		return
	}

	// 2. Get authenticated user ID
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		log.Println("❌ WebSocket rejected: unauthorized")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// 3. Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ WebSocket upgrade failed: %v", err)
		return
	}

	log.Printf("🔌 WebSocket connection established: user=%s, room=%s", userID, roomID)

	// 4. Create client
	client := &Client{
		Conn:   conn,
		Send:   make(chan Message, 16),
		UserID: userID,
		RoomID: roomID,
		// Role and CanSpeak will be set by Hub.Register
	}

	// 5. Register client to hub
	hub.Register <- client

	// 6. Start goroutines for read/write
	go client.WritePump()
	go client.ReadPump(hub)
}