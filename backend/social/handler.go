package social

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"
)

/* =======================
   TYPES
======================= */

type UserProfile struct {
	UserID    string  `json:"user_id"`
	Username  string  `json:"username,omitempty"`
	FullName  string  `json:"full_name,omitempty"`
	AvatarURL string  `json:"avatar_url,omitempty"`
	Email     string  `json:"email,omitempty"`
	Bio       string  `json:"bio,omitempty"`
	IsOnline  bool    `json:"is_online"`
	InRoom    *string `json:"in_room,omitempty"`
}

type FollowStats struct {
	Followers  int  `json:"followers"`
	Following  int  `json:"following"`
	IsFollower bool `json:"is_follower"` // Does this user follow me?
	IsFollowing bool `json:"is_following"` // Do I follow this user?
}

type RoomInvitation struct {
	ID          string    `json:"id"`
	RoomID      string    `json:"room_id"`
	RoomTitle   string    `json:"room_title"`
	InvitedBy   string    `json:"invited_by"`
	InviterName string    `json:"inviter_name"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

/* =======================
   FOLLOW USER
======================= */

func FollowUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		writeJSONError(w, "invalid request", http.StatusBadRequest)
		return
	}

	if userID == req.UserID {
		writeJSONError(w, "cannot follow yourself", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO follows (follower_id, following_id)
		VALUES ($1::uuid, $2::uuid)
		ON CONFLICT DO NOTHING
	`, userID, req.UserID)

	if err != nil {
		log.Printf("❌ Follow error: %v", err)
		writeJSONError(w, "failed to follow user", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ %s followed %s", userID, req.UserID)
	writeJSON(w, map[string]string{"status": "following"})
}

/* =======================
   UNFOLLOW USER
======================= */

func UnfollowUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		writeJSONError(w, "invalid request", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	result, err := db.Pool.Exec(ctx, `
		DELETE FROM follows
		WHERE follower_id = $1::uuid AND following_id = $2::uuid
	`, userID, req.UserID)

	if err != nil {
		log.Printf("❌ Unfollow error: %v", err)
		writeJSONError(w, "failed to unfollow user", http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		writeJSONError(w, "not following this user", http.StatusNotFound)
		return
	}

	log.Printf("✅ %s unfollowed %s", userID, req.UserID)
	writeJSON(w, map[string]string{"status": "unfollowed"})
}

/* =======================
   GET FOLLOWERS
======================= */

func GetFollowers(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from path: /social/{id}/followers
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/social/"), "/")
	if len(parts) < 2 {
		writeJSONError(w, "invalid path", http.StatusBadRequest)
		return
	}
	targetUserID := parts[0]

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT 
			u.id,
			u.email,
			u.raw_user_meta_data->>'username' as username,
			u.raw_user_meta_data->>'full_name' as full_name,
			u.raw_user_meta_data->>'avatar_url' as avatar_url,
			COALESCE(up.status = 'online', false) as is_online
		FROM follows f
		JOIN auth.users u ON f.follower_id = u.id
		LEFT JOIN user_presence up ON u.id = up.user_id
		WHERE f.following_id = $1::uuid
		ORDER BY f.created_at DESC
		LIMIT 100
	`, targetUserID)

	if err != nil {
		log.Printf("❌ Get followers error: %v", err)
		writeJSONError(w, "failed to get followers", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	followers := []UserProfile{}
	for rows.Next() {
		var p UserProfile
		var username, fullName, avatarURL sql.NullString

		err := rows.Scan(&p.UserID, &p.Email, &username, &fullName, &avatarURL, &p.IsOnline)
		if err != nil {
			continue
		}

		if username.Valid {
			p.Username = username.String
		}
		if fullName.Valid {
			p.FullName = fullName.String
		}
		if avatarURL.Valid {
			p.AvatarURL = avatarURL.String
		}

		followers = append(followers, p)
	}

	writeJSON(w, map[string]interface{}{
		"followers": followers,
		"count":     len(followers),
	})
}

/* =======================
   GET FOLLOWING
======================= */

func GetFollowing(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from path: /social/{id}/following
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/social/"), "/")
	if len(parts) < 2 {
		writeJSONError(w, "invalid path", http.StatusBadRequest)
		return
	}
	targetUserID := parts[0]

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT 
			u.id,
			u.email,
			u.raw_user_meta_data->>'username' as username,
			u.raw_user_meta_data->>'full_name' as full_name,
			u.raw_user_meta_data->>'avatar_url' as avatar_url,
			COALESCE(up.status = 'online', false) as is_online,
			up.current_room_id
		FROM follows f
		JOIN auth.users u ON f.following_id = u.id
		LEFT JOIN user_presence up ON u.id = up.user_id
		WHERE f.follower_id = $1::uuid
		ORDER BY f.created_at DESC
		LIMIT 100
	`, targetUserID)

	if err != nil {
		log.Printf("❌ Get following error: %v", err)
		writeJSONError(w, "failed to get following", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	following := []UserProfile{}
	for rows.Next() {
		var p UserProfile
		var username, fullName, avatarURL, roomID sql.NullString

		err := rows.Scan(&p.UserID, &p.Email, &username, &fullName, &avatarURL, &p.IsOnline, &roomID)
		if err != nil {
			continue
		}

		if username.Valid {
			p.Username = username.String
		}
		if fullName.Valid {
			p.FullName = fullName.String
		}
		if avatarURL.Valid {
			p.AvatarURL = avatarURL.String
		}
		if roomID.Valid {
			p.InRoom = &roomID.String
		}

		following = append(following, p)
	}

	writeJSON(w, map[string]interface{}{
		"following": following,
		"count":     len(following),
	})
}

/* =======================
   GET ONLINE FRIENDS
======================= */

func GetOnlineFriends(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT 
			u.id,
			u.raw_user_meta_data->>'username' as username,
			u.raw_user_meta_data->>'full_name' as full_name,
			u.raw_user_meta_data->>'avatar_url' as avatar_url,
			up.current_room_id
		FROM follows f
		JOIN auth.users u ON f.following_id = u.id
		JOIN user_presence up ON u.id = up.user_id
		WHERE f.follower_id = $1::uuid 
		  AND up.status = 'online'
		  AND up.last_seen > NOW() - INTERVAL '5 minutes'
		ORDER BY up.last_seen DESC
	`, userID)

	if err != nil {
		log.Printf("❌ Get online friends error: %v", err)
		writeJSONError(w, "failed to get online friends", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	friends := []UserProfile{}
	for rows.Next() {
		var p UserProfile
		var username, fullName, avatarURL, roomID sql.NullString

		err := rows.Scan(&p.UserID, &username, &fullName, &avatarURL, &roomID)
		if err != nil {
			continue
		}

		p.IsOnline = true
		if username.Valid {
			p.Username = username.String
		}
		if fullName.Valid {
			p.FullName = fullName.String
		}
		if avatarURL.Valid {
			p.AvatarURL = avatarURL.String
		}
		if roomID.Valid {
			p.InRoom = &roomID.String
		}

		friends = append(friends, p)
	}

	writeJSON(w, map[string]interface{}{
		"online_friends": friends,
		"count":          len(friends),
	})
}

/* =======================
   UPDATE PRESENCE
======================= */

func UpdatePresence(userID, status string, roomID *string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO user_presence (user_id, status, current_room_id, last_seen, updated_at)
		VALUES ($1::uuid, $2, $3, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			status = EXCLUDED.status,
			current_room_id = EXCLUDED.current_room_id,
			last_seen = EXCLUDED.last_seen,
			updated_at = EXCLUDED.updated_at
	`, userID, status, roomID)

	return err
}

/* =======================
   HELPERS
======================= */

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func writeJSONError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

/* =======================
   SEARCH USERS
======================= */

func SearchUsers(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		writeJSONError(w, "query parameter required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Search by username or email (case-insensitive)
	rows, err := db.Pool.Query(ctx, `
		SELECT 
			u.id,
			u.email,
			u.raw_user_meta_data->>'username' as username,
			u.raw_user_meta_data->>'full_name' as full_name,
			u.raw_user_meta_data->>'avatar_url' as avatar_url,
			EXISTS(
				SELECT 1 FROM follows 
				WHERE follower_id = $1::uuid AND following_id = u.id
			) as is_following
		FROM auth.users u
		WHERE u.id != $1::uuid  -- Exclude current user
		  AND (
			LOWER(u.email) LIKE LOWER($2) OR
			LOWER(u.raw_user_meta_data->>'username') LIKE LOWER($2) OR
			LOWER(u.raw_user_meta_data->>'full_name') LIKE LOWER($2)
		  )
		ORDER BY 
			-- Prioritize exact matches
			CASE 
				WHEN LOWER(u.raw_user_meta_data->>'username') = LOWER($3) THEN 1
				WHEN LOWER(u.email) = LOWER($3) THEN 2
				ELSE 3
			END,
			u.created_at DESC
		LIMIT 20
	`, userID, "%"+query+"%", query)

	if err != nil {
		log.Printf("❌ Search users error: %v", err)
		writeJSONError(w, "search failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var (
			id, email                            string
			username, fullName, avatarURL        sql.NullString
			isFollowing                          bool
		)

		err := rows.Scan(&id, &email, &username, &fullName, &avatarURL, &isFollowing)
		if err != nil {
			continue
		}

		user := map[string]interface{}{
			"user_id":      id,
			"email":        email,
			"is_following": isFollowing,
		}

		if username.Valid {
			user["username"] = username.String
		}
		if fullName.Valid {
			user["full_name"] = fullName.String
		}
		if avatarURL.Valid {
			user["avatar_url"] = avatarURL.String
		}

		users = append(users, user)
	}

	if users == nil {
		users = []map[string]interface{}{}
	}

	log.Printf("🔍 User search: query=%s, found=%d", query, len(users))

	writeJSON(w, map[string]interface{}{
		"users": users,
		"count": len(users),
		"query": query,
	})
}