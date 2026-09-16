# Custom artwork

The game ships with emoji/colour placeholders. To use real images (your own,
or properly licensed art — do not bundle copyrighted commercial board-game
artwork), drop PNG files into these folders and flip `USE_CUSTOM_ART` to `true`
in `client/src/pages/Game.jsx`.

Files are matched by a lowercase, hyphenated slug of the card's name — so the
filenames below mirror Candlemere's own cast, weapons and rooms. The last two
of each set only appear in 7–8 player games. Any file that's missing falls
back to its emoji, so a partial set is fine.

```
public/art/
  suspects/
    miss-carmine.png       brigadier-ochre.png    dowager-ivory.png
    deacon-viridian.png    baroness-indigo.png    professor-mulberry.png
    doctor-cerise.png      monsieur-sepia.png
  weapons/
    candelabra.png         letter-opener.png      fire-poker.png
    duelling-pistol.png    silk-cord.png          marble-bust.png
    laudanum.png           antique-sabre.png
  rooms/
    scullery.png    salon.png         glasshouse.png    supper-room.png
    smoking-room.png reading-room.png parlour.png       foyer.png
    bureau.png      vaults.png        menagerie.png
```

- **suspects** render as round avatars (square images, ~square crop work best).
- **weapons** and **rooms** render inside cards/tiles (transparent PNGs look best).
