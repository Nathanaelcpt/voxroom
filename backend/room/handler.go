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
		log.Println("❌ CreateRoom:", err)
		writeJSONError(w, "failed to create room", http.StatusInternalServerError)
		return
	}

	writeJSON(w, CreateRoomResponse{RoomID: roomID})
}

/* =======================
   GET ACTIVE ROOMS
======================= */

func GetActiveRooms(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT 
			r.id,
			r.title,
			r.is_live,
			COUNT(rp.user_id) AS listeners
		FROM rooms r
		LEFT JOIN room_participants rp ON rp.room_id = r.id
		WHERE r.is_live = true
		GROUP BY r.id
		ORDER BY r.id DESC
	`)
	if err != nil {
		log.Println("❌ GetActiveRooms:", err)
		writeJSONError(w, "failed to fetch rooms", 500)
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

	writeJSON(w, rooms)
}

/* =======================
   GET ROOM DETAILS
======================= */

func GetRoomDetails(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimPrefix(r.URL.Path, "/rooms/")
	if roomID == "" || strings.Contains(roomID, "/") {
		writeJSONError(w, "room id required", 400)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var room Room
	err := db.Pool.QueryRow(ctx, `
		SELECT id, title, is_live
		FROM rooms
		WHERE id = $1
	`, roomID).Scan(&room.ID, &room.Title, &room.IsLive)

	if err != nil {
		writeJSONError(w, "room not found", 404)
		return
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT user_id, role
		FROM room_participants
		WHERE room_id = $1
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

	room.Listeners = len(participants)

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
		writeJSONError(w, "unauthorized", 401)
		return
	}

	roomID := strings.TrimSuffix(
		strings.TrimPrefix(r.URL.Path, "/rooms/"),
		"/join",
	)

	if roomID == "" {
		writeJSONError(w, "room id required", 400)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var isLive bool
	err := db.Pool.QueryRow(ctx,
		`SELECT is_live FROM rooms WHERE id = $1`, roomID,
	).Scan(&isLive)

	if err != nil {
		writeJSONError(w, "room not found", 404)
		return
	}

	if !isLive {
		writeJSONError(w, "room is not live", 403)
		return
	}

	_, err = db.Pool.Exec(ctx, `
		INSERT INTO room_participants (room_id, user_id, role)
		VALUES ($1, $2, 'listener')
		ON CONFLICT DO NOTHING
	`, roomID, userID)

	if err != nil {
		writeJSONError(w, "failed to join room", 500)
		return
	}

	writeJSON(w, map[string]string{
		"status":  "joined",
		"room_id": roomID,
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
