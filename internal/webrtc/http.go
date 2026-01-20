package webrtc

import (
	"encoding/json"
	"net/http"
	"sync"

	pion "github.com/pion/webrtc/v3"
)

// Peer registry (sementara, in-memory)
var (
	peers   = make(map[string]*pion.PeerConnection)
	peersMu sync.Mutex
)

// HTTP payload
type HTTPSignal struct {
	UserID string `json:"user_id"`
	Signal Signal `json:"signal"`
}

// 🔥 HandleHTTP = WebRTC signalling endpoint
func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload HTTPSignal
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	peersMu.Lock()
	pc, ok := peers[payload.UserID]
	if !ok {
		var err error
		pc, err = NewPeerConnection()
		if err != nil {
			peersMu.Unlock()
			http.Error(w, "failed to create peer", http.StatusInternalServerError)
			return
		}
		peers[payload.UserID] = pc
	}
	peersMu.Unlock()

	// Kirim balik response ke client
	send := func(msg any) {
		json.NewEncoder(w).Encode(msg)
	}

	if err := HandleSignal(pc, payload.Signal, send); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}
