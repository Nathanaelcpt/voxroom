// backend/room/join_with_role.go - UPDATED JOIN HANDLER
package room

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"
)

// JoinRoomWithRole allows user to join with preferred role (speaker/listener)
func JoinRoomWithRole(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Get room ID from URL
	roomID := extractRoomID(r.URL.Path)
	if roomID == "" {
		writeJSONError(w, "room id required", http.StatusBadRequest)
		return
	}

	// Parse request body for role preference
	var req struct {
		PreferredRole string `json:"preferred_role"` // "speaker" or "listener"
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// If no body, default to listener
		req.PreferredRole = "listener"
	}

	// Validate preferred role
	if req.PreferredRole != "speaker" && req.PreferredRole != "listener" {
		req.PreferredRole = "listener"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	log.Printf("🚪 User joining room: user=%s, room=%s, preferred_role=%s", 
		userID, roomID, req.PreferredRole)

	// Start transaction
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("❌ Failed to begin transaction: %v", err)
		writeJSONError(w, "failed to join room", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// 1. Check if room exists and is live
	var isLive bool
	var hostID string
	err = tx.QueryRow(ctx, `
		SELECT is_live, host_id 
		FROM public.rooms 
		WHERE id = $1::uuid
	`, roomID).Scan(&isLive, &hostID)

	if err != nil {
		log.Printf("❌ Room not found: %v", err)
		writeJSONError(w, "room not found", http.StatusNotFound)
		return
	}

	if !isLive {
		log.Printf("⚠️ Room is not live: %s", roomID)
		writeJSONError(w, "room is not live", http.StatusBadRequest)
		return
	}

	// 2. Check if user is already in room
	var existingRole string
	err = tx.QueryRow(ctx, `
		SELECT role::text 
		FROM public.room_participants 
		WHERE room_id = $1::uuid 
		  AND user_id = $2::uuid 
		  AND left_at IS NULL
	`, roomID, userID).Scan(&existingRole)

	if err == nil {
		// User already in room
		log.Printf("⚠️ User already in room: user=%s, room=%s, current_role=%s", 
			userID, roomID, existingRole)
		
		// Return current status
		writeJSON(w, map[string]interface{}{
			"message": "already in room",
			"role":    existingRole,
		})
		return
	}

	// 3. Determine actual role to assign
	actualRole := "listener" // Default

	if req.PreferredRole == "speaker" {
		// Check if user is friend of host (following the host)
		var isFriend bool
		err = tx.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 
				FROM public.follows 
				WHERE follower_id = $1::uuid 
				  AND following_id = $2::uuid
			)
		`, userID, hostID).Scan(&isFriend)

		if err != nil {
			log.Printf("⚠️ Failed to check friend status: %v", err)
			// Continue with listener role
		} else if isFriend {
			// Friend of host can join as speaker
			actualRole = "speaker"
			log.Printf("✅ User is friend of host, joining as speaker: user=%s", userID)
		} else {
			log.Printf("⚠️ User requested speaker but not friend of host, joining as listener: user=%s", userID)
		}
	}

	// 4. Insert participant with determined role
	_, err = tx.Exec(ctx, `
		INSERT INTO public.room_participants (
			room_id, 
			user_id, 
			role, 
			joined_at,
			invited_by,
			invited_at
		) VALUES (
			$1::uuid, 
			$2::uuid, 
			$3::room_role, 
			NOW(),
			CASE WHEN $3::room_role = 'speaker' THEN $4::uuid ELSE NULL END,
			CASE WHEN $3::room_role = 'speaker' THEN NOW() ELSE NULL END
		)
	`, roomID, userID, actualRole, hostID)

	if err != nil {
		log.Printf("❌ Failed to insert participant: %v", err)
		writeJSONError(w, "failed to join room", http.StatusInternalServerError)
		return
	}

	// 5. Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("❌ Failed to commit transaction: %v", err)
		writeJSONError(w, "failed to join room", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ User joined room: user=%s, room=%s, role=%s", userID, roomID, actualRole)

	writeJSON(w, map[string]interface{}{
		"message": "joined room successfully",
		"role":    actualRole,
		"room_id": roomID,
	})
}

// Helper to extract room ID from URL path
func extractRoomID(path string) string {
	parts := strings.Split(strings.TrimPrefix(path, "/rooms/"), "/")
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
}
