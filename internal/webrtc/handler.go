package webrtc

import (
	"encoding/json"
	"sync"

	pion "github.com/pion/webrtc/v3"
)

// ===== SIGNAL =====
type Signal struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// ===== AUDIO REGISTRY (POC) =====
var (
	audioTracks   []*pion.TrackLocalStaticRTP
	audioTracksMu sync.Mutex
)
func HandleSignal(
	pc *pion.PeerConnection,
	signal Signal,
	send func(any),
) error {

	// 🔴 Tangkap audio dari SPEAKER
	pc.OnTrack(func(track *pion.TrackRemote, receiver *pion.RTPReceiver) {
		if track.Kind() != pion.RTPCodecTypeAudio {
			return
		}

		// Buat local track untuk relay
		localTrack, err := pion.NewTrackLocalStaticRTP(
			track.Codec().RTPCodecCapability,
			"audio",
			"voxroom",
		)
		if err != nil {
			return
		}

		audioTracksMu.Lock()
		audioTracks = append(audioTracks, localTrack)
		audioTracksMu.Unlock()

		// Relay RTP
		go func() {
			for {
				pkt, _, err := track.ReadRTP()
				if err != nil {
					return
				}
				_ = localTrack.WriteRTP(pkt)
			}
		}()
	})

	switch signal.Type {

	case "offer":
		var offer pion.SessionDescription
		if err := json.Unmarshal(signal.Data, &offer); err != nil {
			return err
		}

		if err := pc.SetRemoteDescription(offer); err != nil {
			return err
		}

		// 🔥 KIRIM AUDIO KE LISTENER
		audioTracksMu.Lock()
		for _, t := range audioTracks {
			_, _ = pc.AddTrack(t)
		}
		audioTracksMu.Unlock()

		answer, err := pc.CreateAnswer(nil)
		if err != nil {
			return err
		}

		if err := pc.SetLocalDescription(answer); err != nil {
			return err
		}

		send(map[string]any{
			"type": "answer",
			"data": answer,
		})

	case "answer":
		var answer pion.SessionDescription
		if err := json.Unmarshal(signal.Data, &answer); err != nil {
			return err
		}
		return pc.SetRemoteDescription(answer)

	case "candidate":
		var c pion.ICECandidateInit
		if err := json.Unmarshal(signal.Data, &c); err != nil {
			return err
		}
		return pc.AddICECandidate(c)
	}

	return nil
}
