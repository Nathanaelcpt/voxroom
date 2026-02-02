// social/presence.go - Presence tracking handlers

package social

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"
)

/* =======================
   UPDATE PRESENCE - ONLINE
======================= */

func SetPresenceOnline(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		RoomID *string `json:"room_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, "invalid request", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Upsert presence
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO user_presence (user_id, status, current_room_id, last_seen, updated_at)
		VALUES ($1::uuid, 'online', $2, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			status = 'online',
			current_room_id = EXCLUDED.current_room_id,
			last_seen = NOW(),
			updated_at = NOW()
	`, userID, req.RoomID)

	if err != nil {
		log.Printf("❌ Failed to update presence: %v", err)
		writeJSONError(w, "failed to update presence", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Presence online: user=%s, room=%v", userID, req.RoomID)
	writeJSON(w, map[string]string{"status": "online"})
}

/* =======================
   UPDATE PRESENCE - OFFLINE
======================= */

func SetPresenceOffline(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		UPDATE user_presence
		SET status = 'offline',
		    current_room_id = NULL,
		    last_seen = NOW(),
		    updated_at = NOW()
		WHERE user_id = $1::uuid
	`, userID)

	if err != nil {
		log.Printf("❌ Failed to update presence: %v", err)
		writeJSONError(w, "failed to update presence", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Presence offline: user=%s", userID)
	writeJSON(w, map[string]string{"status": "offline"})
}
