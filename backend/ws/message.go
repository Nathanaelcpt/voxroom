package ws

import "encoding/json"

type Message struct {
	Type    string          `json:"type"`
	RoomID  string          `json:"room_id,omitempty"`
	From    string          `json:"from,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}
