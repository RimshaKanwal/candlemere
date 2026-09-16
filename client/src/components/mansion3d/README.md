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

## Character controls

Top view looks directly down at the selected room or mansion. 3D view restores
an angled overview. Walk returns to your detective and follows the character.
Click the scene to focus controls, then use arrows or WASD; touch users can hold
the direction buttons. Inside your current room this is free walking with wall bounds and furniture ray
checks. The browser sends changed poses at up to 12.5 Hz; the server validates
seat ownership, room bounds, finite coordinates, update frequency, and movement
speed before relaying them to the other players. Remote avatars interpolate
between updates. Positions are held only in memory and included in state
snapshots for reconnecting viewers; they are discarded on room exit or match end.
Board moves, cards, and turn state are unaffected.

In corridors, holding arrows or WASD moves the detective itself between legal
squares while the camera follows. Walk mode has no destination marker. Cross a
reachable doorway with an arrow key, press Enter beside it, or use its Enter
button to commit the room move. Enter elsewhere (or Finish in corridor) commits
the corridor destination and ends movement. Intermediate corridor travel stays
local until that commitment, preserving the server's one-destination-per-roll rule.
Rolling enables Walk mode; arriving in a room keeps it active and focuses the
controls so room walking and suggestions are immediately available. My location
cancels uncommitted corridor travel.
Keyboard controls ignore dialogs and text fields and release on loss of focus.
Mouse-wheel deltas ease into a wider zoom range; right-drag pans in overview.
Rooms opens a collapsible side browser. Camera buttons sit at the scene edge.

## Interactive atmosphere

Explore details lists the focused room's interactive props. Objects can also be
clicked directly, or activated with E when nearby in Walk mode. Drawers animate,
portraits reveal fictional mansion memories, and the ballroom piano plays a short
synthesized melody. Portrait inspections provide local atmosphere. Drawer and piano interactions are
server-authorized and shared with the room; they never reveal evidence.
Doors open as avatars approach; footsteps vary between hard floors and wood.
Sound mix provides independent effects, ambience, and music sliders; the existing
speaker toggle mutes every channel. Transitions respect reduced motion.

Private suggestion results use a sealed-card reveal delivered only to the
suggester. Public accusation results and the final solution use separate effects.
Secret passages retain server-authorized travel and add a brief visual transition.

Server checks: `npm test` in `server`. Client navigation/camera checks:
`npm run test:3d` in `client`.

## Shared props and room atmosphere

Drawer state and piano events use stable room/kind identifiers. Only a detective
physically inside the room can use them. The server serializes drawer toggles,
limits repeated requests, and broadcasts accepted events to every player including
the actor. Snapshots restore drawer state after reconnecting without replaying old
piano audio. The state is match memory only. Automatic door animation follows the
same shared avatar positions. Nearby detectives hear the piano with attenuation.

Glasshouse rain uses animated glass streaks and filtered noise; the bureau has a
pendulum clock and ticking; fireplaces flicker with lounge crackle; the ballroom
has a quiet periodic melody. Ambient playback waits for a user gesture, pauses
scheduling in background tabs, and is disposed with the 3D engine. Moving decor
becomes static under reduced-motion preferences. Volume preferences are local.
