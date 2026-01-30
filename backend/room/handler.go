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
			return err
		}
		defer tx.Rollback(ctx)

		if err := tx.QueryRow(ctx, `
			INSERT INTO rooms (title, host_id, is_live)
			VALUES ($1, $2, true)
			RETURNING id
		`, req.Title, userID).Scan(&roomID); err != nil {
			return err
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO room_participants (room_id, user_id, role)
			VALUES ($1, $2, 'host')
		`, roomID, userID)

		if err != nil {
			return err
		}

		return tx.Commit(ctx)
	})

	if err != nil {
		log.Printf("❌ CreateRoom failed: %v", err)
		writeJSONError(w, "failed to create room", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Room created: %s", roomID)
	writeJSON(w, CreateRoomResponse{RoomID: roomID})
}

/* =======================
   GET ACTIVE ROOMS
======================= */

func GetActiveRooms(w http.ResponseWriter, r *http.Request) {
	log.Println("📋 Fetching active rooms")

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
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