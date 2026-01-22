package webrtc

import (
	"log"

	pion "github.com/pion/webrtc/v3"
)

type Peer struct {
	ID string
	PC *pion.PeerConnection
}

func RelayAudioTrack(
	room *Room,
	speakerID string,
	track *pion.TrackRemote,
) {

	for _, listener := range room.Listeners {

		localTrack, err := pion.NewTrackLocalStaticRTP(
			track.Codec().RTPCodecCapability,
			track.ID(),
			track.StreamID(),
		)
		if err != nil {
			continue
		}

		_, err = listener.PC.AddTrack(localTrack)
		if err != nil {
			continue
		}

		go func() {
			buf := make([]byte, 1500)
			for {
				n, _, err := track.Read(buf)
				if err != nil {
					log.Println("track read error:", err)
					return
				}
				localTrack.Write(buf[:n])
			}
		}()
	}
}
