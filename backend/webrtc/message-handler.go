package webrtc

import (
	"encoding/json"
	"log"
)

// MessageType represents the type of WebSocket message
type MessageType string

const (
	TypeChat        MessageType = "chat"
	TypeAudio       MessageType = "audio"
	TypeMicOn       MessageType = "mic_on"
	TypeMicOff      MessageType = "mic_off"
	TypeRoomEnded   MessageType = "room_ended"
	TypeRoleUpdated MessageType = "role_updated"
	TypeUserJoined  MessageType = "user_joined"
	TypeUserLeft    MessageType = "user_left"
)

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type    MessageType            `json:"type"`
	Data    map[string]interface{} `json:"data,omitempty"`
	From    string                 `json:"from,omitempty"`
	Payload map[string]interface{} `json:"payload,omitempty"`
}

// MessageHandler handles all WebSocket messages
type MessageHandler struct {
	audioHandler *AudioHandler
}

// NewMessageHandler creates a new message handler
func NewMessageHandler() *MessageHandler {
	return &MessageHandler{
		audioHandler: NewAudioHandler(),
	}
}

// HandleMessage processes incoming WebSocket messages
func (h *MessageHandler) HandleMessage(client *Client, messageBytes []byte) {
	var message WSMessage
	if err := json.Unmarshal(messageBytes, &message); err != nil {
		log.Printf("❌ Error parsing message: %v", err)
		return
	}

	log.Printf("📥 Message received: type=%s, from=%s, room=%s", 
		message.Type, client.UserID, client.RoomID)

	switch message.Type {
	case TypeChat:
		h.handleChat(client, message)
	case TypeAudio:
		h.handleAudio(client, message)
	case TypeMicOn:
		h.handleMicOn(client)
	case TypeMicOff:
		h.handleMicOff(client)
	case TypeRoomEnded:
		h.handleRoomEnded(client)
	default:
		log.Printf("⚠️ Unknown message type: %s", message.Type)
	}
}

// ========================================
// CHAT HANDLER
// ========================================

func (h *MessageHandler) handleChat(client *Client, message WSMessage) {
	if message.Data == nil {
		log.Printf("❌ Chat message has no data")
		return
	}

	// Extract content
	content, ok := message.Data["content"].(string)
	if !ok || content == "" {
		log.Printf("❌ Chat message has no content")
		return
	}

	// Get username (prioritize from message, fallback to client)
	username := client.Username
	if usernameFromMsg, ok := message.Data["username"].(string); ok && usernameFromMsg != "" {
		username = usernameFromMsg
	}
	if username == "" {
		username = "User"
	}

	// Get role (prioritize from message, fallback to client)
	role := client.Role
	if roleFromMsg, ok := message.Data["role"].(string); ok && roleFromMsg != "" {
		role = roleFromMsg
	}
	if role == "" {
		role = "listener"
	}

	log.Printf("💬 Chat from %s (%s, %s): %s", username, client.UserID, role, content)

	// ✅ Prepare broadcast message
	broadcastMsg := WSMessage{
		Type: TypeChat,
		Data: map[string]interface{}{
			"content":  content,
			"username": username,
			"user_id":  client.UserID,
			"role":     role,
		},
	}

	// ✅ BROADCAST to ALL users in room (including sender for echo)
	client.Hub.BroadcastToRoom(client.RoomID, broadcastMsg, "")
	
	// Alternative: Exclude sender (no echo)
	// client.Hub.BroadcastToRoom(client.RoomID, broadcastMsg, client.ID)

	log.Printf("📢 Chat broadcasted to room: %s", client.RoomID)
}

// ========================================
// AUDIO HANDLER
// ========================================

func (h *MessageHandler) handleAudio(client *Client, message WSMessage) {
	if message.Payload == nil {
		log.Printf("❌ Audio message has no payload")
		return
	}

	chunk, ok := message.Payload["chunk"].(string)
	if !ok || chunk == "" {
		log.Printf("❌ Audio message has no chunk data")
		return
	}

	// Process audio chunk with existing handler
	if err := h.audioHandler.HandleAudioChunk(client.UserID, client.RoomID, chunk); err != nil {
		log.Printf("❌ Failed to process audio chunk: %v", err)
		return
	}

	// Check if should broadcast based on role
	if client.Role != "host" && client.Role != "speaker" {
		log.Printf("⚠️ User %s is not allowed to send audio (role: %s)", client.UserID, client.Role)
		return
	}

	// ✅ Broadcast audio to all users EXCEPT sender
	broadcastMsg := WSMessage{
		Type:    TypeAudio,
		From:    client.UserID,
		Payload: message.Payload,
	}

	client.Hub.BroadcastToRoom(client.RoomID, broadcastMsg, client.ID)
}

// ========================================
// MIC CONTROLS
// ========================================

func (h *MessageHandler) handleMicOn(client *Client) {
	log.Printf("🎤 Mic ON: user=%s, room=%s", client.UserID, client.RoomID)
	
	// Update audio handler
	h.audioHandler.HandleMicOn(client.UserID, client.RoomID)

	// Optional: Broadcast mic status to other users
	client.Hub.BroadcastToRoom(client.RoomID, WSMessage{
		Type: TypeMicOn,
		Data: map[string]interface{}{
			"user_id": client.UserID,
		},
	}, client.ID)
}

func (h *MessageHandler) handleMicOff(client *Client) {
	log.Printf("🔇 Mic OFF: user=%s, room=%s", client.UserID, client.RoomID)
	
	// Update audio handler
	h.audioHandler.HandleMicOff(client.UserID, client.RoomID)

	// Optional: Broadcast mic status to other users
	client.Hub.BroadcastToRoom(client.RoomID, WSMessage{
		Type: TypeMicOff,
		Data: map[string]interface{}{
			"user_id": client.UserID,
		},
	}, client.ID)
}

// ========================================
// ROOM ENDED HANDLER
// ========================================

func (h *MessageHandler) handleRoomEnded(client *Client) {
	// Only host can end room
	if client.Role != "host" {
		log.Printf("❌ Non-host tried to end room: user=%s, role=%s", client.UserID, client.Role)
		return
	}

	log.Printf("🔴 Room ended by host: room=%s, user=%s", client.RoomID, client.UserID)

	// ✅ Broadcast to ALL users in room
	client.Hub.BroadcastToRoom(client.RoomID, WSMessage{
		Type: TypeRoomEnded,
		Data: map[string]interface{}{
			"room_id": client.RoomID,
			"message": "Room has been ended by host",
		},
	}, "")

	// Note: Actual room cleanup (database, connections) 
	// should be done by the API endpoint handler
}

// GetAudioHandler returns the audio handler
func (h *MessageHandler) GetAudioHandler() *AudioHandler {
	return h.audioHandler
}
