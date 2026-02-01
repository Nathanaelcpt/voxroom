package room

import (
	"context"
	"fmt"
	"log"
	"time"

	"voxroom/backend/db"
)

// Role represents a user's role in a room
type Role string

const (
	RoleListener Role = "listener" // Default role, can only listen
	RoleSpeaker  Role = "speaker"  // Can speak (invited by host)
	RoleHost     Role = "host"     // Room creator, full permissions
)

// IsValid checks if the role is valid
func (r Role) IsValid() bool {
	return r == RoleListener || r == RoleSpeaker || r == RoleHost
}

// CanSpeak returns true if the role has speaking permission
func (r Role) CanSpeak() bool {
	return r == RoleHost || r == RoleSpeaker
}

// CanInviteSpeaker returns true if the role can invite speakers
func (r Role) CanInviteSpeaker() bool {
	return r == RoleHost
}

// CanEndRoom returns true if the role can end the room
func (r Role) CanEndRoom() bool {
	return r == RoleHost
}

// String implements fmt.Stringer
func (r Role) String() string {
	return string(r)
}

// GetUserRoleInRoom fetches a user's role in a specific room from database
func GetUserRoleInRoom(roomID, userID string) (Role, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var roleStr string
	err := db.Pool.QueryRow(ctx, `
		SELECT role 
		FROM room_participants 
		WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
	`, roomID, userID).Scan(&roleStr)

	if err != nil {
		log.Printf("⚠️ GetUserRoleInRoom: user=%s, room=%s, error=%v (defaulting to listener)", 
			userID, roomID, err)
		return RoleListener, false
	}

	role := Role(roleStr)
	if !role.IsValid() {
		log.Printf("⚠️ Invalid role '%s' for user %s in room %s, defaulting to listener", 
			roleStr, userID, roomID)
		return RoleListener, false
	}

	canSpeak := role.CanSpeak()
	log.Printf("✅ GetUserRoleInRoom: user=%s, room=%s, role=%s, can_speak=%v", 
		userID, roomID, role, canSpeak)

	return role, canSpeak  // ✅ Returns room.Role, not string
}

// SetUserRole updates a user's role in a room
func SetUserRole(roomID, userID string, newRole Role, invitedBy string) error {
	if !newRole.IsValid() {
		return fmt.Errorf("invalid role: %s", newRole)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Handle NULL for empty invitedBy
	var invitedByParam interface{}
	if invitedBy != "" {
		invitedByParam = invitedBy
	} else {
		invitedByParam = nil
	}

	// ✅ ULTIMATE FIX: Cast $1 to TEXT in the CASE statement
	query := `
		UPDATE room_participants 
		SET role = $1::text, 
		    invited_by = $2, 
		    invited_at = CASE WHEN $1::text = 'speaker' THEN NOW() ELSE NULL END
		WHERE room_id = $3::uuid AND user_id = $4::uuid
	`

	result, err := db.Pool.Exec(ctx, query, string(newRole), invitedByParam, roomID, userID)
	if err != nil {
		log.Printf("❌ SetUserRole failed: room=%s, user=%s, role=%s, error=%v",
			roomID, userID, newRole, err)
		return err
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		log.Printf("⚠️ SetUserRole: no rows affected")
		return fmt.Errorf("user %s not found in room %s", userID, roomID)
	}

	log.Printf("✅ SetUserRole success: room=%s, user=%s, role=%s, rows_affected=%d",
		roomID, userID, newRole, rowsAffected)

	return nil
}