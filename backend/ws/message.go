package ws

// Message represents a WebSocket message between clients
type Message struct {
	Type    string                 `json:"type"`
	RoomID  string                 `json:"room_id,omitempty"`
	From    string                 `json:"from,omitempty"`
	Payload interface{}            `json:"payload,omitempty"` // ✅ For audio chunks, etc.
	Data    map[string]interface{} `json:"data,omitempty"`    // ✅ NEW: For chat, events, etc.
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