MOONLIT / SUNSET PARALLAX LAYER PACK
=====================================

Includes 12 aligned transparent SVG layers (6 sunset + 6 night):
- sky-clouds: full-canvas sky, clouds and sun/moon
- distant-mountains: distant mountain ridge, with terrain fill beneath it
- mid-mountains-forest: middle ridges and distant treeline
- fog: transparent fog bands
- village-river-bridge: river, highlights, bridge, village and warm lights
- foreground-trees-ground: foreground pines and dark ground silhouettes

All SVGs use the same 1600 x 900 viewBox, so they stack without coordinate drift.
The mountain layers intentionally extend to the bottom of the canvas to fill the area behind them and avoid transparent holes when shifting layers.

Important: these are purpose-built stylized vector layers inspired by the reference, not automatic pixel-perfect cutouts of the painting. For best visual quality, use all layers from one variant together. Do not stack them over the earlier full-image background; that will duplicate scenery.

Suggested stacking order (back to front):
1. sunset/night-sky-clouds
2. sunset/night-distant-mountains
3. sunset/night-mid-mountains-forest
4. sunset/night-village-river-bridge
5. sunset/night-fog
6. sunset/night-foreground-trees-ground

Suggested parallax intensity:
sky/clouds 0.10x; distant mountains 0.18x; mid mountains 0.32x; village/river 0.42x; fog 0.55x; foreground 0.75x.

Use CSS object-fit: cover and transform: translate3d(...) on each aligned layer. Keep a little overscan (e.g. width: 108%; left: -4%) for layers that move horizontally, so edges never show.
