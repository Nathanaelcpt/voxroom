package room

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
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

type CreateRoomRequest struct {
	Title string `json:"title"`
}

type CreateRoomResponse struct {
	RoomID string `json:"room_id"`
}

type Room struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	IsLive    bool   `json:"is_live"`
	Listeners int    `json:"listeners"`
}

type RoomDetail struct {
	Room
	Participants []Participant `json:"participants"`
}

type Participant struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

/* =======================
   CREATE ROOM
======================= */

func CreateRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		writeJSONError(w, "invalid body", http.StatusBadRequest)
		return
	}

	log.Printf("📝 Creating room: %s by user: %s", req.Title, userID)

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var roomID string

	err := db.ExecuteWithRetry(ctx, 3, func(ctx context.Context) error {
		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			log.Printf("❌ Failed to begin transaction: %v", err)
			return err
		}
		defer tx.Rollback(ctx)

		// ✅ Step 1: Insert room
		if err := tx.QueryRow(ctx, `
			INSERT INTO rooms (title, host_id, is_live)
			VALUES ($1, $2, true)
			RETURNING id
		`, req.Title, userID).Scan(&roomID); err != nil {
			log.Printf("❌ Failed to insert room: %v", err)
			return err
		}

		log.Printf("✅ Room inserted to DB: roomID=%s", roomID)

		// ✅ Step 2: Insert host participant with detailed logging
		result, err := tx.Exec(ctx, `
			INSERT INTO room_participants (room_id, user_id, role)
			VALUES ($1, $2, 'host')
		`, roomID, userID)

		if err != nil {
			log.Printf("❌ Failed to insert host participant: error=%v, room=%s, user=%s", err, roomID, userID)
			return err
		}

		rowsAffected := result.RowsAffected()
		log.Printf("✅ Host participant INSERT executed: room=%s, user=%s, rows_affected=%d", roomID, userID, rowsAffected)

		if rowsAffected == 0 {
			log.Printf("⚠️ CRITICAL: Host participant INSERT returned 0 rows affected!")
			return fmt.Errorf("host participant insert returned 0 rows")
		}

		// ✅ Step 3: Verify the insert
		var verifyCount int
		err = tx.QueryRow(ctx, `
			SELECT COUNT(*) FROM room_participants
			WHERE room_id = $1 AND user_id = $2
		`, roomID, userID).Scan(&verifyCount)

		if err != nil {
			log.Printf("❌ Failed to verify participant insert: %v", err)
			return err
		}

		log.Printf("✅ Verification query: count=%d for room=%s, user=%s", verifyCount, roomID, userID)

		if verifyCount == 0 {
			log.Printf("⚠️ CRITICAL: Verification failed - host not in database!")
			return fmt.Errorf("host participant not found after insert")
		}

		// ✅ Step 4: Commit transaction
		if err := tx.Commit(ctx); err != nil {
			log.Printf("❌ Failed to commit transaction: %v", err)
			return err
		}

		log.Printf("✅ Transaction committed successfully for room %s", roomID)
		return nil
	})

	if err != nil {
		log.Printf("❌ CreateRoom FAILED after retries: %v", err)
		writeJSONError(w, "failed to create room", http.StatusInternalServerError)
		return
	}

	// ✅ Final verification outside transaction
	var finalCount int
	db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM room_participants
		WHERE room_id = $1 AND user_id = $2
	`, roomID, userID).Scan(&finalCount)

	log.Printf("✅ FINAL CHECK: Host in DB? count=%d, room=%s, user=%s", finalCount, roomID, userID)

	log.Printf("✅ Room created successfully: roomID=%s", roomID)
	writeJSON(w, CreateRoomResponse{RoomID: roomID})
}

/* =======================
   GET ACTIVE ROOMS
======================= */

func GetActiveRooms(w http.ResponseWriter, r *http.Request) {
	log.Println("📋 Fetching active rooms")

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// ✅ Fix: Add DISTINCT and filter ended_at IS NULL
	rows, err := db.Pool.Query(ctx, `
		SELECT 
			r.id,
			r.title,
			r.is_live,
			COUNT(DISTINCT rp.user_id) FILTER (WHERE rp.left_at IS NULL) AS listeners
		FROM rooms r
		LEFT JOIN room_participants rp ON rp.room_id = r.id
		WHERE r.is_live = true AND r.ended_at IS NULL
		GROUP BY r.id
		ORDER BY r.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		log.Printf("❌ GetActiveRooms query error: %v", err)
		writeJSONError(w, "failed to fetch rooms", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rooms []Room

	for rows.Next() {
		var r Room
		if err := rows.Scan(&r.ID, &r.Title, &r.IsLive, &r.Listeners); err == nil {
			rooms = append(rooms, r)
		}
	}

	if rooms == nil {
		rooms = []Room{}
	}

	log.Printf("✅ Found %d active rooms", len(rooms))
	writeJSON(w, rooms)
}

/* =======================
   GET ROOM DETAILS
======================= */

func GetRoomDetails(w http.ResponseWriter, r *http.Request) {
	// Extract roomID from path
	roomID := strings.TrimPrefix(r.URL.Path, "/rooms/")
	if roomID == "" || strings.Contains(roomID, "/") {
		writeJSONError(w, "room id required", http.StatusBadRequest)
		return
	}

	log.Printf("🔍 Fetching room details: %s", roomID)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var room Room
	err := db.Pool.QueryRow(ctx, `
		SELECT id, title, is_live
		FROM rooms
		WHERE id = $1
	`, roomID).Scan(&room.ID, &room.Title, &room.IsLive)

	if err != nil {
		log.Printf("❌ Room not found: %s", roomID)
		writeJSONError(w, "room not found", http.StatusNotFound)
		return
	}

	// Get participants
	rows, err := db.Pool.Query(ctx, `
		SELECT user_id, role
		FROM room_participants
		WHERE room_id = $1 AND left_at IS NULL
	`, roomID)

	var participants []Participant
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p Participant
			if rows.Scan(&p.UserID, &p.Role) == nil {
				participants = append(participants, p)
			}
		}
	}

	if participants == nil {
		participants = []Participant{}
	}

	room.Listeners = len(participants)

	log.Printf("✅ Room details: %s (%d participants)", room.Title, len(participants))
	writeJSON(w, RoomDetail{
		Room:         room,
		Participants: participants,
	})
}

/* =======================
   JOIN ROOM
======================= */

func JoinRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract roomID from path: /rooms/{id}/join
	path := strings.TrimPrefix(r.URL.Path, "/rooms/")
	roomID := strings.TrimSuffix(path, "/join")

	if roomID == "" || roomID == path {
		writeJSONError(w, "room id required", http.StatusBadRequest)
		return
	}

	log.Printf("👋 User %s joining room %s", userID, roomID)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Check if room exists and is live
	var isLive bool
	err := db.Pool.QueryRow(ctx,
		`SELECT is_live FROM rooms WHERE id = $1 AND ended_at IS NULL`, roomID,
	).Scan(&isLive)

	if err != nil {
		log.Printf("❌ Room not found: %s", roomID)
		writeJSONError(w, "room not found", http.StatusNotFound)
		return
	}

	if !isLive {
		writeJSONError(w, "room is not live", http.StatusForbidden)
		return
	}

	// ✅ Check if user already in room
	var existingRole string
	err = db.Pool.QueryRow(ctx, `
		SELECT role FROM room_participants 
		WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
	`, roomID, userID).Scan(&existingRole)

	if err == nil {
		// User already in room
		log.Printf("ℹ️ User %s already in room %s as %s", userID, roomID, existingRole)
		writeJSON(w, map[string]string{
			"status":  "already_joined",
			"room_id": roomID,
			"role":    existingRole,
		})
		return
	}

	// ✅ Add user as listener with proper conflict handling
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO room_participants (room_id, user_id, role)
		VALUES ($1, $2, 'listener')
		ON CONFLICT (room_id, user_id) 
		DO UPDATE SET left_at = NULL, role = EXCLUDED.role
	`, roomID, userID)

	if err != nil {
		log.Printf("❌ Failed to join room: %v", err)
		writeJSONError(w, "failed to join room", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ User %s joined room %s as listener", userID, roomID)
	writeJSON(w, map[string]string{
		"status":  "joined",
		"room_id": roomID,
	})
}

/* =======================
   END ROOM (HTTP Handler)
======================= */

func EndRoomHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract roomID from path: /rooms/{id}/end
	path := strings.TrimPrefix(r.URL.Path, "/rooms/")
	roomID := strings.TrimSuffix(path, "/end")

	if roomID == "" || roomID == path {
		writeJSONError(w, "room id required", http.StatusBadRequest)
		return
	}

	log.Printf("🔴 User %s ending room %s", userID, roomID)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Verify user is host
	var isHost bool
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

	// End the room
	if err := EndRoom(roomID); err != nil {
		writeJSONError(w, "failed to end room", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{
		"status":  "ended",
		"room_id": roomID,
	})
}

/* =======================
   INVITE SPEAKER
======================= */

func InviteSpeaker(w http.ResponseWriter, r *http.Request) {
	hostID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || hostID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract roomID from path: /rooms/{id}/invite-speaker
	path := strings.TrimPrefix(r.URL.Path, "/rooms/")
	roomID := strings.TrimSuffix(path, "/invite-speaker")

	if roomID == "" || roomID == path {
		writeJSONError(w, "room id required", http.StatusBadRequest)
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		writeJSONError(w, "invalid body", http.StatusBadRequest)
		return
	}

	// ❌ HAPUS BARIS INI (tidak terpakai):
	// ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	// defer cancel()

	log.Printf("👥 Host %s inviting user %s to be speaker in room %s", hostID, req.UserID, roomID)

	// Verify requester is host
	hostRole, _ := GetUserRoleInRoom(roomID, hostID)
	if hostRole != RoleHost {
		writeJSONError(w, "only host can invite speakers", http.StatusForbidden)
		return
	}

	// Upgrade user to speaker
	if err := SetUserRole(roomID, req.UserID, RoleSpeaker, hostID); err != nil {
		writeJSONError(w, "failed to invite speaker", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ User %s promoted to speaker in room %s", req.UserID, roomID)

	writeJSON(w, map[string]string{
		"status":  "invited",
		"user_id": req.UserID,
		"role":    string(RoleSpeaker),
	})
}

/* =======================
   REMOVE SPEAKER
======================= */

func RemoveSpeaker(w http.ResponseWriter, r *http.Request) {
	hostID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || hostID == "" {
		writeJSONError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract roomID from path: /rooms/{id}/remove-speaker
	path := strings.TrimPrefix(r.URL.Path, "/rooms/")
	roomID := strings.TrimSuffix(path, "/remove-speaker")

	if roomID == "" || roomID == path {
		writeJSONError(w, "room id required", http.StatusBadRequest)
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		writeJSONError(w, "invalid body", http.StatusBadRequest)
		return
	}

	// ❌ HAPUS BARIS INI (tidak terpakai):
	// ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	// defer cancel()

	log.Printf("👥 Host %s removing speaker %s in room %s", hostID, req.UserID, roomID)

	// Verify requester is host
	hostRole, _ := GetUserRoleInRoom(roomID, hostID)
	if hostRole != RoleHost {
		writeJSONError(w, "only host can remove speakers", http.StatusForbidden)
		return
	}

	// Downgrade to listener
	if err := SetUserRole(roomID, req.UserID, RoleListener, ""); err != nil {
		writeJSONError(w, "failed to remove speaker", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ User %s demoted to listener in room %s", req.UserID, roomID)

	writeJSON(w, map[string]string{
		"status":  "removed",
		"user_id": req.UserID,
		"role":    string(RoleListener),
	})
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
	json.NewEncoder(w).Encode(map[string]string{
		"error": msg,
	})
}

func GetParticipantsWithProfilesHandler(w http.ResponseWriter, r *http.Request) {
	// Extract roomID from path: /rooms/{id}/participants-with-profiles
	path := strings.TrimPrefix(r.URL.Path, "/rooms/")
	roomID := strings.TrimSuffix(path, "/participants-with-profiles")

	if roomID == "" || roomID == path {
		writeJSONError(w, "room id required", http.StatusBadRequest)
		return
	}

	participants, err := GetParticipantsWithProfiles(roomID)
	if err != nil {
		log.Printf("❌ Failed to get participants with profiles: %v", err)
		writeJSONError(w, "failed to get participants", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"participants": participants,
	})
}

// ===== FIX GetParticipantsWithProfiles =====
func GetParticipantsWithProfiles(roomID string) ([]ParticipantWithProfile, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT 
			rp.user_id,
			rp.role,
			u.email,
			u.raw_user_meta_data->>'full_name' as full_name,
			u.raw_user_meta_data->>'avatar_url' as avatar_url
		FROM room_participants rp
		LEFT JOIN auth.users u ON rp.user_id = u.id
		WHERE rp.room_id = $1::uuid AND rp.left_at IS NULL
		ORDER BY 
			CASE rp.role 
				WHEN 'host' THEN 1
				WHEN 'speaker' THEN 2
				WHEN 'listener' THEN 3
			END
	`
	
	rows, err := db.Pool.Query(ctx, query, roomID)
	if err != nil {
		log.Printf("❌ GetParticipantsWithProfiles query error: %v", err)
		return nil, err
	}
	defer rows.Close()
	
	var participants []ParticipantWithProfile
	
	for rows.Next() {
		var p ParticipantWithProfile
		var email, fullName, avatarURL sql.NullString
		
		err := rows.Scan(&p.UserID, &p.Role, &email, &fullName, &avatarURL)
		if err != nil {
			log.Printf("⚠️ Error scanning participant: %v", err)
			continue
		}
		
		if email.Valid {
			p.Email = email.String
			// Extract username from email
			p.Username = strings.Split(email.String, "@")[0]
		}
		
		if fullName.Valid {
			p.FullName = fullName.String
		}
		
		if avatarURL.Valid {
			p.AvatarURL = avatarURL.String
		}
		
		participants = append(participants, p)
	}
	
	if participants == nil {
		participants = []ParticipantWithProfile{}
	}
	
	return participants, nil
}

type ParticipantWithProfile struct {
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	Email     string `json:"email,omitempty"`
	Username  string `json:"username,omitempty"`
	FullName  string `json:"full_name,omitempty"`
	AvatarURL string `json:"avatar_url,omitempty"`
}