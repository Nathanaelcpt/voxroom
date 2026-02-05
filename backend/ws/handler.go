// backend/ws/handler.go - FINAL (STABLE)
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
		// NOTE: produksi sebaiknya validasi origin
		return true
	},
}

// ServeWS handles WebSocket connections
func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	/* ================= VALIDATION ================= */

	roomID := r.URL.Query().Get("roomId")
	if roomID == "" {
		http.Error(w, "missing roomId", http.StatusBadRequest)
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	/* ================= AUTH ================= */

	user, err := auth.ValidateToken(r.Context(), token)
	if err != nil {
		log.Printf("❌ WS auth failed: %v", err)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	userID := user.ID

	/* ================= USERNAME ================= */

	username := getUsernameFromDB(userID)
	if username == "" {
		if user.Email != "" {
			username = strings.Split(user.Email, "@")[0]
		} else {
			username = "User"
		}
	}

	/* ================= UPGRADE ================= */

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ WS upgrade failed: %v", err)
		return
	}

	log.Printf("🔌 WS connected: user=%s (%s) room=%s",
		userID, username, roomID)

	/* ================= CLIENT ================= */

	client := &Client{
		Conn:     conn,
		Send:     make(chan Message, 16),
		UserID:   userID,
		Username: username,
		RoomID:   roomID,
		// Role & CanSpeak ditentukan di hub.handleRegister
	}

	/* ================= REGISTER ================= */

	hub.Register <- client

	go client.WritePump()
	go client.ReadPump(hub)
}

/* ================= HELPER ================= */

func getUsernameFromDB(userID string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var username, displayName, email string

	// coba public.users
	err := db.Pool.QueryRow(ctx, `
		SELECT 
			COALESCE(username, ''),
			COALESCE(display_name, ''),
			COALESCE(email, '')
		FROM public.users
		WHERE id = $1::uuid
		LIMIT 1
	`, userID).Scan(&username, &displayName, &email)

	if err != nil {
		log.Printf("⚠️ public.users lookup failed: %v", err)

		// fallback auth.users
		err = db.Pool.QueryRow(ctx, `
			SELECT 
				COALESCE(raw_user_meta_data->>'username', ''),
				COALESCE(raw_user_meta_data->>'full_name', ''),
				COALESCE(email, '')
			FROM auth.users
			WHERE id = $1::uuid
			LIMIT 1
		`, userID).Scan(&username, &displayName, &email)

		if err != nil {
			log.Printf("⚠️ auth.users lookup failed: %v", err)
			return ""
		}
	}

	if displayName != "" {
		return displayName
	}
	if username != "" {
		return username
	}
	if email != "" {
		return strings.Split(email, "@")[0]
	}

	return ""
}
