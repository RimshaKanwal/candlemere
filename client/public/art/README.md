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
    miss-ruby.png          captain-gold.png       lady-pearl.png
    mr-jade.png            mrs-blue.png           professor-violet.png
    doctor-rose.png        baron-bronze.png
  weapons/
    candlestick.png        letter-opener.png      fire-poker.png
    pistol.png             silk-scarf.png         stone-statue.png
    poison.png             sword.png
  rooms/
    kitchen.png       music-room.png    greenhouse.png    dining-room.png
    game-room.png     library.png       sitting-room.png  entrance-hall.png
    office.png        wine-cellar.png   trophy-room.png
```

- **suspects** render as round avatars (square images, ~square crop work best).
- **weapons** and **rooms** render inside cards/tiles (transparent PNGs look best).
