// Shared ICE configuration for all WebRTC (1:1 calls + live streaming).
// STUN handles same-network peers; TURN relays media when peers are on different
// networks / behind strict NAT. The self-hosted coturn box is preferred; the public
// relay is a last-resort fallback so cross-network calls still have a chance if
// coturn isn't running.
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Self-hosted coturn on the emazao VPS (install/run coturn to activate)
    { urls: 'turn:45.79.206.183:3478', username: 'emazao', credential: 'MazaoTurn2024!' },
    { urls: 'turn:45.79.206.183:3478?transport=tcp', username: 'emazao', credential: 'MazaoTurn2024!' },
    // Public fallback relay
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
}
