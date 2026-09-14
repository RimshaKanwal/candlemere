# The 3D mansion

The live game opens in a Three.js dollhouse view. Drag to orbit and scroll or
pinch to zoom. Overview, Top view, Find me, and Labels control the camera.
Click a room to inspect it; clicking a reachable room moves there. The
"Move to…" selector provides the same legal destinations using keyboard controls.
The illustrated 2D board remains available with the same game state.

`scenery.js` builds the furnished rooms and detective miniatures from local
geometry; no model downloads or external asset service is required. Static
furniture and architecture are merged by material to reduce draw calls.
`navigation.js` computes visual walking routes through corridor squares and
doorways, avoiding other players. Secret passages teleport between rooms.
The existing server still decides whether a move is legal; the 3D renderer
only visualizes accepted state updates.

`Mansion3D.jsx` owns renderer, camera, picking, movement animation, and disposal.
It responds to container size changes, respects reduced motion, pauses rendering
in hidden tabs, and offers a 2D fallback after WebGL initialization/context loss.
The renderer is lazy-loaded so visitors do not download Three.js at sign-in.

Run `npm run test:3d` and `npm run build` from `client`.
Browser validation should cover both 6- and 8-player boards, entering a room,
secret passages, camera orbit/zoom, repeated 2D/3D switching, and narrow screens.
