package webrtc

import (
	"encoding/base64"
	"fmt"
)

// AudioCodec represents supported audio codecs
type AudioCodec string

const (
	CodecPCM   AudioCodec = "pcm"   // Raw PCM audio (Int16)
	CodecOpus  AudioCodec = "opus"  // Opus codec (future)
)

// AudioChunk represents a chunk of audio data
type AudioChunk struct {
	UserID    string     `json:"user_id"`
	Codec     AudioCodec `json:"codec"`
	Data      []byte     `json:"data"`       // Raw audio bytes
	SampleRate int       `json:"sample_rate"` // e.g., 48000
	Channels   int       `json:"channels"`    // 1 = mono, 2 = stereo
}

// EncodeAudioChunk encodes audio bytes to base64 for WebSocket transmission
func EncodeAudioChunk(chunk *AudioChunk) (string, error) {
	if len(chunk.Data) == 0 {
		return "", fmt.Errorf("empty audio data")
	}
	
	return base64.StdEncoding.EncodeToString(chunk.Data), nil
}

// DecodeAudioChunk decodes base64 audio data back to bytes
func DecodeAudioChunk(base64Data string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64 audio: %w", err)
	}
	
	return data, nil
}

// ValidateAudioChunk validates audio chunk parameters
func ValidateAudioChunk(chunk *AudioChunk) error {
	if chunk.UserID == "" {
		return fmt.Errorf("user_id is required")
	}
	
	if len(chunk.Data) == 0 {
		return fmt.Errorf("audio data is empty")
	}
	
	// PCM validation
	if chunk.Codec == CodecPCM {
		if chunk.SampleRate != 48000 && chunk.SampleRate != 44100 {
			return fmt.Errorf("unsupported sample rate: %d (use 48000 or 44100)", chunk.SampleRate)
		}
		
		if chunk.Channels != 1 && chunk.Channels != 2 {
			return fmt.Errorf("unsupported channel count: %d (use 1 or 2)", chunk.Channels)
		}
		
		// PCM Int16 should be even number of bytes
		if len(chunk.Data)%2 != 0 {
			return fmt.Errorf("invalid PCM data length: %d (must be even)", len(chunk.Data))
		}
	}
	
	return nil
}

// ConvertPCMToMono converts stereo PCM to mono (if needed)
func ConvertPCMToMono(stereoData []byte) []byte {
	if len(stereoData)%4 != 0 {
		return stereoData // Invalid stereo data, return as-is
	}
	
	monoData := make([]byte, len(stereoData)/2)
	
	for i := 0; i < len(stereoData); i += 4 {
		// Average left and right channels (Int16LE)
		left := int16(stereoData[i]) | int16(stereoData[i+1])<<8
		right := int16(stereoData[i+2]) | int16(stereoData[i+3])<<8
		
		avg := (left + right) / 2
		
		monoData[i/2] = byte(avg)
		monoData[i/2+1] = byte(avg >> 8)
	}
	
	return monoData
}
