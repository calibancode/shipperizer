# Shipperizer 💘

> **A visual and interactive take on shipping charts.**
>
> Click, drag, connect, and export. Relationship mapping made fun!

Live here → [calibancode.github.io/shipperizer/](https://calibancode.github.io/shipperizer/)

## Features

- Drag to arrange and auto-organize circular layout
- Click two characters to assign a relationship:
  - ❤️ Love
  - ♠️ Hatef*ck
  - ♦️ Friends
- Bidirectional relationships auto-merge into dual arrows
- Export to PNG or JSON (portable with embedded images)
- Upload your own headshot PNGs (or JPEG/WebP/etc)
- Tooltips on hover with names + relationships
- Mobile-friendly layout with large touch targets (mostly)

## Usage

#### Default Mode:

- Characters load from `assets/face_images/manifest.json`
- Portraits should be named like `Firstname.png` for clean tooltips

#### Custom Upload:
- Click **Upload**
- Select character portraits (preferably 128x128, any image format)
- Nodes will appear and snap into place alongside existing nodes
- Clear default nodes before uploading for a fully custom shipping chart

#### Relationship Mapping:
- Select two nodes to open the emoji selector
- Tap an emoji to assign a relationship
- Click a line to delete a relationship

#### Extras:
- **Organize** - Rearranges into a clean circle while preserving relative order
- **Export** - Saves a PNG of your chart
- **Save/Load JSON** - Save your chart state or reload it later
- **Undo/Redo** - Basic action history
- **Delete** - Select a node (yellow highlight) and press `Del` or `Backspace`

## How to Host
You can self-host via GitHub Pages or locally with:

```

python -m http.server

```

Just clone the repo and go ham!

## License
**GPLv3** — you can copy, modify, and redistribute, but derivative work _must stay open_. See [LICENSE](https://github.com/calibancode/shipperizer/blob/main/LICENSE) for more details.
