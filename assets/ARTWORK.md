# Original artwork for Support Hub 3.28.0

Generated using the built-in imagegen tool. Original PNG files are bundled locally; the application does not need an image API or external image host at runtime. Game outcomes are not painted into artwork: symbols, scores and runner positions are controlled by existing game state.

## Prompt set

- `casino/slot-vault.png`: Premium illustrated landscape background for an original casino slot machine. Midnight navy and teal, engraved antique gold columns at the side margins, emerald crystals, warm rim lighting. The center is an empty dark recessed stage for live reels; no text, logos or painted controls.
- `casino/symbol-atlas.png`: Six columns by four rows of polished dimensional slot icons, centered with cell padding. Rows: seven/cherries/bell/diamond/star/lemon; seven/bananas/pineapple/mango/watermelon/grapes; seven/lightning/temple/eagle/crown/shield; seven/retriever/poodle/shepherd/bone/doghouse. Gold bevels, consistent upper-left light, no labels. Transparency requested. The UI crops individual symbols from the returned grid.
- `casino/race-arena.png`: Landscape hand-painted rooster racing arena at golden hour. Timber stands, pennants and green hills in the upper quarter; broad empty terracotta track in the lower three quarters for live lanes and animated runners. No characters, text or controls. Roosters and lane overlays are drawn by `casino-art.js`.
- `support2/forest-floor.png`: Seamless overhead diffuse ground material for a dark fantasy MOBA. Moss, fine grass, weathered slate, leaves, roots and damp earth; restrained olive, charcoal and sage palette. Even lighting, no paths, buildings or text. Used as terrain detail and bump texture.

Support2 character geometry, forest, architecture, particles and spell silhouettes are original procedural graphics in `support2-world.js` and `support2-effects.js`. They are not Dota 2 assets and do not reproduce its full graphical fidelity or complete mechanics. Existing CC0 assets remain for other units.
