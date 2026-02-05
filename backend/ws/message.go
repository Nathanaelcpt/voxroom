package ws

// Message represents a WebSocket message
type Message struct {
	Type   string                 `json:"type"`
	RoomID string                 `json:"room_id,omitempty"`
	From   string                 `json:"from,omitempty"`
	
	// ✅ KHUSUS AUDIO / BINARY
	Payload interface{}            `json:"payload,omitempty"`

	// ✅ KHUSUS CHAT / EVENT
	Data    map[string]interface{} `json:"data,omitempty"`
}

// Message types
const (
	MsgChat         = "chat"
	MsgAudio        = "audio"
	MsgMicOn        = "mic_on"
	MsgMicOff       = "mic_off"
	MsgSpeaking     = "speaking"
	MsgRoleAssigned = "role_assigned"
	MsgRoleUpdated  = "role_updated"
	MsgListenerCnt  = "listener_count"
	MsgRoomEnded    = "room_ended"
)
