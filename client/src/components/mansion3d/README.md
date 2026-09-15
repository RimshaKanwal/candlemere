# The 3D mansion

The live game opens in an interactive mansion map or your current room.
Choose a room to inspect its furnished interior; inspection never moves a player.
Confirm with Enter or Walk here to send a legal destination to the server.
Accepted moves animate through corridors and doorways before opening the room.

Drag gently to orbit, pinch or scroll to zoom, or use the camera buttons.
Camera limits and automatic framing keep the scene within reach on narrow screens.
Reset view, My location, and Mansion map provide quick ways back. Room thumbnails
and previous/next buttons let spectators explore too. Expanded mode keeps turn
actions available; Escape or Evidence & notes returns to the complete game layout.
Room and player labels use screen-sized DOM text for readability at every zoom.
The illustrated 2D board remains available with the same game state.

`scenery.js` builds the furnished rooms and detective miniatures from local
geometry; no model downloads or external asset service is required. Static
furniture and architecture are merged by material to reduce draw calls.
`navigation.js` computes visual walking routes through corridor squares and
doorways, avoiding other players. Secret passages teleport between rooms.
The existing server still decides whether a move is legal; the 3D renderer
only visualizes accepted state updates.

`engine.js` owns renderer, picking, movement animation, and disposal;
`camera.js` handles framing and eased camera controls.
It responds to container size changes, respects reduced motion, pauses rendering
in hidden tabs, and offers a 2D fallback after WebGL initialization/context loss.
The renderer is lazy-loaded so visitors do not download Three.js at sign-in.

Run `npm run test:3d` and `npm run build` from `client`.
Browser validation should cover both 6- and 8-player boards, entering a room,
secret passages, camera orbit/zoom, repeated 2D/3D switching, and narrow screens.
