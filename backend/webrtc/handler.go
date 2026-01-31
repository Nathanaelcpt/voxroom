package webrtc

import (
	"log"
)

// AudioHandler processes audio-related WebSocket messages
type AudioHandler struct {
	streamManager *StreamManager
}

// NewAudioHandler creates a new audio handler
func NewAudioHandler() *AudioHandler {
	return &AudioHandler{
		streamManager: NewStreamManager(),
	}
}

// HandleAudioChunk processes an incoming audio chunk
func (h *AudioHandler) HandleAudioChunk(userID, roomID string, base64Data string) error {
	// Decode base64 audio data
	audioData, err := DecodeAudioChunk(base64Data)
	if err != nil {
		log.Printf("❌ Failed to decode audio chunk from user %s: %v", userID, err)
		return err
	}
	
	// Create audio chunk
	chunk := &AudioChunk{
		UserID:     userID,
		Codec:      CodecPCM,
		Data:       audioData,
		SampleRate: 48000,
		Channels:   1, // Mono
	}
	
	// Validate chunk
	if err := ValidateAudioChunk(chunk); err != nil {
		log.Printf("⚠️ Invalid audio chunk from user %s: %v", userID, err)
		return err
	}
	
	// Update stream stats
	h.streamManager.UpdateStream(userID, len(audioData))
	
	return nil
}

// HandleMicOn handles when a user unmutes
func (h *AudioHandler) HandleMicOn(userID, roomID string) {
	log.Printf("🎤 User %s unmuted in room %s", userID, roomID)
	
	// Check if stream exists
	_, exists := h.streamManager.GetStream(userID)
	if !exists {
		// Create new stream
		h.streamManager.StartStream(userID, roomID)
	} else {
		// Update existing stream state
		h.streamManager.SetState(userID, StateStreaming)
	}
}

// HandleMicOff handles when a user mutes
func (h *AudioHandler) HandleMicOff(userID, roomID string) {
	log.Printf("🔇 User %s muted in room %s", userID, roomID)
	
	// Update stream state to muted (don't delete stream)
	h.streamManager.SetState(userID, StateMuted)
}

// HandleUserLeft handles when a user leaves the room
func (h *AudioHandler) HandleUserLeft(userID string) {
	log.Printf("🔌 User %s left, stopping audio stream", userID)
	
	// Remove stream completely
	h.streamManager.StopStream(userID)
}

// GetStreamManager returns the stream manager
func (h *AudioHandler) GetStreamManager() *StreamManager {
	return h.streamManager
}

// ShouldBroadcastAudio determines if audio should be broadcast to a specific client
func ShouldBroadcastAudio(senderRole, receiverRole string, receiverCanSpeak bool) bool {
	// Don't send audio back to sender (handled in hub)
	
	// Everyone can receive audio from host/speakers
	if senderRole == "host" || senderRole == "speaker" {
		return true
	}
	
	// Listeners can't send audio, so this shouldn't happen
	// But if it does, don't broadcast
	return false
}
