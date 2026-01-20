package ws

import "encoding/json"

// Generic signalling message
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}
