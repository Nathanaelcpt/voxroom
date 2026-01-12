package webrtcx

import (
	"encoding/json"

	"github.com/pion/webrtc/v3"
)

type Signal struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

func HandleSignal(
	pc *webrtc.PeerConnection,
	signal Signal,
	send func(any),
) error {

	switch signal.Type {

	case "offer":
		var offer webrtc.SessionDescription
		json.Unmarshal(signal.Data, &offer)

		pc.SetRemoteDescription(offer)
		answer, _ := pc.CreateAnswer(nil)
		pc.SetLocalDescription(answer)

		send(map[string]any{
			"type": "answer",
			"data": answer,
		})

	case "answer":
		var answer webrtc.SessionDescription
		json.Unmarshal(signal.Data, &answer)
		pc.SetRemoteDescription(answer)

	case "candidate":
		var candidate webrtc.ICECandidateInit
		json.Unmarshal(signal.Data, &candidate)
		pc.AddICECandidate(candidate)
	}

	return nil
}
