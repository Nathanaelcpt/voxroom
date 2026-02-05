// backend/social/friends.go - NEW FILE
package social

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"
)

// CheckIsFriend checks if a user is following another user (is friends with)
func CheckIsFriend(w http.ResponseWriter, r *http.Request) {
	// Get current user ID from context
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Get target user ID from URL
	path := r.URL.Path
	parts := strings.Split(strings.TrimPrefix(path, "/social/is-friend/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeJSONError(w, "target user id required", http.StatusBadRequest)
		return
	}

	targetUserID := parts[0]

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Check if current user follows target user
	var exists bool
	query := `
		SELECT EXISTS(
			SELECT 1 
			FROM public.follows 
			WHERE follower_id = $1::uuid 
			  AND following_id = $2::uuid
		)
	`

	err := db.Pool.QueryRow(ctx, query, userID, targetUserID).Scan(&exists)
	if err != nil {
		log.Printf("❌ Failed to check friend status: user=%s, target=%s, error=%v", 
			userID, targetUserID, err)
		writeJSONError(w, "failed to check friend status", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Friend check: user=%s, target=%s, is_friend=%v", 
		userID, targetUserID, exists)

	writeJSON(w, map[string]interface{}{
		"is_friend": exists,
		"user_id":   userID,
		"target_id": targetUserID,
	})
}
