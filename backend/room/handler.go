package room

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"
)

type CreateRoomRequest struct {
	Title string `json:"title"`
}

type CreateRoomResponse struct {
	RoomID string `json:"room_id"`
}

func CreateRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "db begin error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var roomID string

	// 1️⃣ create room
	err = tx.QueryRow(ctx, `
		insert into rooms (title, host_id, is_live)
		values ($1, $2, true)
		returning id
	`, req.Title, userID).Scan(&roomID)

	if err != nil {
		http.Error(w, "failed create room", http.StatusInternalServerError)
		return
	}

	// 2️⃣ host auto join
	_, err = tx.Exec(ctx, `
		insert into room_participants (room_id, user_id, role)
		values ($1, $2, 'host')
	`, roomID, userID)

	if err != nil {
		http.Error(w, "failed join host", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	res := CreateRoomResponse{
		RoomID: roomID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
