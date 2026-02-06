package room

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"
	"voxroom/backend/auth"
	"voxroom/backend/db"
	"voxroom/backend/webrtc"
)

func EndRoomHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract roomID from path
	path := strings.TrimPrefix(r.URL.Path, "/rooms/")
	roomID := strings.TrimSuffix(path, "/end")

	if roomID == "" || roomID == path {
		writeJSONError(w, "room id required", http.StatusBadRequest)
		return
	}

	log.Printf("🔴 User %s ending room %s", userID, roomID)

	// Verify user is host
	var isHost bool
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	
	err := db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM room_participants 
			WHERE room_id = $1 AND user_id = $2 AND role = 'host'
		)
	`, roomID, userID).Scan(&isHost)

	if err != nil || !isHost {
		writeJSONError(w, "only host can end room", http.StatusForbidden)
		return
	}

	// Broadcast "room_ended" to all participants
	if webrtc.GlobalHub != nil {
		webrtc.GlobalHub.BroadcastToRoom(roomID, webrtc.WSMessage{
			Type: webrtc.TypeRoomEnded,
			Data: map[string]interface{}{
				"room_id": roomID,
				"message": "Room has been ended by host",
			},
		}, "")
	}

	// End room in database (fungsi ini ada di handler.go)
	if err := EndRoom(roomID); err != nil {
		log.Printf("❌ Failed to end room: %v", err)
		writeJSONError(w, "failed to end room", http.StatusInternalServerError)
		return
	}

	// Close all WebSocket connections after delay
	if webrtc.GlobalHub != nil {
		go func() {
			time.Sleep(2 * time.Second)
			webrtc.GlobalHub.CloseRoom(roomID)
		}()
	}

	log.Printf("✅ Room ended successfully: %s", roomID)
	
	writeJSON(w, map[string]string{
		"message": "Room ended successfully",
		"room_id": roomID,
	})
}