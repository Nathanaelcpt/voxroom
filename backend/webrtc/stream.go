package webrtc

import (
	"sync"
	"time"
)

// StreamState represents the current state of an audio stream
type StreamState string

const (
	StateIdle      StreamState = "idle"      // Not streaming
	StateStreaming StreamState = "streaming" // Actively streaming
	StateMuted     StreamState = "muted"     // Stream active but muted
)

// AudioStream represents an active audio stream from a user
type AudioStream struct {
	UserID       string
	RoomID       string
	State        StreamState
	LastChunkAt  time.Time
	ChunksReceived int64
	BytesReceived  int64
	
	mu sync.RWMutex
}

// StreamManager manages all active audio streams in a room
type StreamManager struct {
	streams map[string]*AudioStream // userID -> AudioStream
	mu      sync.RWMutex
}

// NewStreamManager creates a new stream manager
func NewStreamManager() *StreamManager {
	return &StreamManager{
		streams: make(map[string]*AudioStream),
	}
}

// StartStream registers a new audio stream
func (sm *StreamManager) StartStream(userID, roomID string) *AudioStream {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	stream := &AudioStream{
		UserID:      userID,
		RoomID:      roomID,
		State:       StateStreaming,
		LastChunkAt: time.Now(),
	}
	
	sm.streams[userID] = stream
	return stream
}

// StopStream removes an audio stream
func (sm *StreamManager) StopStream(userID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	delete(sm.streams, userID)
}

// GetStream retrieves a stream by user ID
func (sm *StreamManager) GetStream(userID string) (*AudioStream, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	stream, exists := sm.streams[userID]
	return stream, exists
}

// UpdateStream records a received audio chunk
func (sm *StreamManager) UpdateStream(userID string, chunkSize int) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	stream, exists := sm.streams[userID]
	if !exists {
		return
	}
	
	stream.mu.Lock()
	defer stream.mu.Unlock()
	
	stream.LastChunkAt = time.Now()
	stream.ChunksReceived++
	stream.BytesReceived += int64(chunkSize)
}

// SetState updates the stream state
func (sm *StreamManager) SetState(userID string, state StreamState) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	stream, exists := sm.streams[userID]
	if !exists {
		return
	}
	
	stream.mu.Lock()
	defer stream.mu.Unlock()
	
	stream.State = state
}

// GetActiveStreams returns all active (non-muted) streams in a room
func (sm *StreamManager) GetActiveStreams(roomID string) []*AudioStream {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	var active []*AudioStream
	
	for _, stream := range sm.streams {
		if stream.RoomID == roomID && stream.State == StateStreaming {
			active = append(active, stream)
		}
	}
	
	return active
}

// CleanStaleStreams removes streams that haven't sent data recently
func (sm *StreamManager) CleanStaleStreams(timeout time.Duration) []string {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	var staleUserIDs []string
	now := time.Now()
	
	for userID, stream := range sm.streams {
		stream.mu.RLock()
		timeSinceLastChunk := now.Sub(stream.LastChunkAt)
		stream.mu.RUnlock()
		
		if timeSinceLastChunk > timeout {
			staleUserIDs = append(staleUserIDs, userID)
			delete(sm.streams, userID)
		}
	}
	
	return staleUserIDs
}

// GetStreamStats returns statistics for a stream
func (s *AudioStream) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	return map[string]interface{}{
		"user_id":         s.UserID,
		"room_id":         s.RoomID,
		"state":           s.State,
		"chunks_received": s.ChunksReceived,
		"bytes_received":  s.BytesReceived,
		"last_chunk_at":   s.LastChunkAt,
		"uptime_seconds":  time.Since(s.LastChunkAt).Seconds(),
	}
}
