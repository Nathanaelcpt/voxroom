package ws

type Message struct {
	Type    string      `json:"type"`
	RoomID  string      `json:"room_id,omitempty"`
	From    string      `json:"from,omitempty"`
	Payload interface{} `json:"payload,omitempty"`
}
