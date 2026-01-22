package webrtc

import (
	"encoding/json"
	"net/http"
	"sync"

	pion "github.com/pion/webrtc/v3"
)

// ===== GLOBAL STATE (MVP) =====

// default room (nanti diganti room per WS)
var defaultRoom = NewRoom("default")

var (
	peers   = make(map[string]*Peer)
	peersMu sync.Mutex
)

// ===== HTTP PAYLOAD =====

type HTTPSignal struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"` // "speaker" | "listener"
	Signal Signal `json:"signal"`
}

// ===== HANDLER =====

func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	defer r.Body.Close()

	var payload HTTPSignal
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	// ===== GET / CREATE PEER =====
	peersMu.Lock()
	peer, ok := peers[payload.UserID]
	if !ok {
		pc, err := NewPeerConnection()
		if err != nil {
			peersMu.Unlock()
			http.Error(w, "failed to create peer", http.StatusInternalServerError)
			return
		}

		peer = &Peer{
			ID: payload.UserID,
			PC: pc,
		}

		// 🔥 ON TRACK = RELAY AUDIO
		pc.OnTrack(func(track *pion.TrackRemote, _ *pion.RTPReceiver) {
			RelayAudioTrack(defaultRoom, payload.UserID, track)
		})

		// register peer to room
		if payload.Role == "speaker" {
			defaultRoom.AddSpeaker(payload.UserID, peer)
		} else {
			defaultRoom.AddListener(payload.UserID, peer)
		}

		peers[payload.UserID] = peer
	}
	peersMu.Unlock()

	// ===== HANDLE SIGNAL =====
	var response any
	send := func(msg any) {
		response = msg
	}

	if err := HandleSignal(peer.PC, payload.Signal, send); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// ===== RESPOND ONCE =====
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
