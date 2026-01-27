package room

import (
	"context"
	"time"
	"voxroom/backend/db"
)

func EndRoom(roomID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db.Pool.Exec(ctx, `
		UPDATE rooms
		SET is_live = false,
		    ended_at = now(),
		    updated_at = now()
		WHERE id = $1
	`, roomID)

	db.Pool.Exec(ctx, `
		UPDATE room_participants
		SET left_at = now()
		WHERE room_id = $1 AND left_at IS NULL
	`, roomID)
}
