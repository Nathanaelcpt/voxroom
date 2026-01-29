package ws

// Message represents a WebSocket message between clients
type Message struct {
	Type    string      `json:"type"`              // Message type (e.g., "audio", "mic_on", "role_assigned")
	RoomID  string      `json:"room_id,omitempty"` // Target room ID
	From    string      `json:"from,omitempty"`    // Sender user ID
	Payload interface{} `json:"payload,omitempty"` // Message payload (flexible type)
}

// Common message types
const (
	MsgTypeAudio         = "audio"
	MsgTypeMicOn         = "mic_on"
	MsgTypeMicOff        = "mic_off"
	MsgTypeSpeaking      = "speaking"
	MsgTypeRoleAssigned  = "role_assigned"
	MsgTypeRoleUpdated   = "role_updated"
	MsgTypeListenerCount = "listener_count"
	MsgTypeRoomEnded     = "room_ended"
)