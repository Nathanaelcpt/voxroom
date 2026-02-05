// backend/ws/handler.go - FIXED
package ws

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"

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

	// 2. Get token from query parameter
	token := r.URL.Query().Get("token")
	if token == "" {
		log.Println("❌ WebSocket rejected: missing token")
		http.Error(w, "missing token parameter", http.StatusUnauthorized)
		return
	}

	// 3. Validate token
	user, err := auth.ValidateToken(r.Context(), token)
	if err != nil {
		log.Printf("❌ WebSocket auth failed: %v", err)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	userID := user.ID

	// ✅ 4. Get username from database
	username := getUsernameFromDB(userID)
	if username == "" {
		// Fallback to email
		username = user.Email
		if username == "" {
			username = "User"
		}
	}

	// 5. Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ WebSocket upgrade failed: %v", err)
		return
	}

	log.Printf("🔌 WebSocket connection established: user=%s, username=%s, room=%s",
		userID, username, roomID)

	// 6. Create client
	client := &Client{
		Conn:     conn,
		Send:     make(chan Message, 16),
		UserID:   userID,
		Username: username, // ✅ NEW: Set username
		RoomID:   roomID,
		// Role and CanSpeak will be set by Hub.Register
	}

	// 7. Register client to hub
	hub.Register <- client

	// 8. Start goroutines for read/write
	go client.WritePump()
	go client.ReadPump(hub)
}

// ✅ NEW: Get username from database
func getUsernameFromDB(userID string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var username string
	var displayName string
	var email string

	// Try to get from public.users first
	query := `
		SELECT 
			COALESCE(username, ''),
			COALESCE(display_name, ''),
			COALESCE(email, '')
		FROM public.users
		WHERE id = $1::uuid
		LIMIT 1
	`

	err := db.Pool.QueryRow(ctx, query, userID).Scan(&username, &displayName, &email)
	if err != nil {
		log.Printf("⚠️ Failed to get username from public.users: %v", err)

		// Fallback: try auth.users (if public.users doesn't have the user yet)
		fallbackQuery := `
			SELECT 
				COALESCE(raw_user_meta_data->>'username', ''),
				COALESCE(raw_user_meta_data->>'full_name', ''),
				COALESCE(email, '')
			FROM auth.users
			WHERE id = $1::uuid
			LIMIT 1
		`

		err = db.Pool.QueryRow(ctx, fallbackQuery, userID).Scan(&username, &displayName, &email)
		if err != nil {
			log.Printf("⚠️ Failed to get username from auth.users: %v", err)
			return ""
		}
	}

	// Priority: displayName > username > email prefix
	if displayName != "" {
		return displayName
	}
	if username != "" {
		return username
	}
	if email != "" {
		// ✅ FIXED: Extract username from email properly
		parts := strings.Split(email, "@")
		if len(parts) > 0 && parts[0] != "" {
			return parts[0]
		}
		return email
	}

	return ""
}
