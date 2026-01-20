package webrtc

import (
	"encoding/json"

	pion "github.com/pion/webrtc/v3"
)

type Signal struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

func HandleSignal(
	pc *pion.PeerConnection,
	signal Signal,
	send func(any),
) error {

	switch signal.Type {

	case "offer":
		var offer pion.SessionDescription
		if err := json.Unmarshal(signal.Data, &offer); err != nil {
			return err
		}

		if err := pc.SetRemoteDescription(offer); err != nil {
			return err
		}

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
