package room

import (
	"context"
	"log"
	"time"

	"voxroom/backend/db"
)

// EndRoom marks a room as ended and updates all participants
func EndRoom(roomID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	log.Printf("🔴 Ending room: %s", roomID)

	// Use transaction for consistency
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("❌ EndRoom: failed to begin transaction for room %s: %v", roomID, err)
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Update room status
	result, err := tx.Exec(ctx, `
		UPDATE rooms
		SET is_live = false,
		    ended_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1 AND is_live = true
	`, roomID)

	if err != nil {
		log.Printf("❌ EndRoom: failed to update room %s: %v", roomID, err)
		return err
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		log.Printf("⚠️ EndRoom: room %s was already ended or doesn't exist", roomID)
		// Not an error, just log it
	}

	// 2. Update all active participants
	result, err = tx.Exec(ctx, `
		UPDATE room_participants
		SET left_at = NOW()
		WHERE room_id = $1 AND left_at IS NULL
	`, roomID)

	if err != nil {
		log.Printf("❌ EndRoom: failed to update participants for room %s: %v", roomID, err)
		return err
	}

	participantsUpdated := result.RowsAffected()

	// 3. Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("❌ EndRoom: failed to commit transaction for room %s: %v", roomID, err)
		return err
	}

	log.Printf("✅ Room ended successfully: room=%s, participants_updated=%d", 
		roomID, participantsUpdated)

	return nil
}