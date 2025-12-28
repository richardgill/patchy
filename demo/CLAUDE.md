# Demo Recording

## Regenerating the demo

```bash
cd demo
export DEMO_WORKDIR="$(pwd)/.workdir"
./setup.sh setup
mise exec -- vhs demo.tape
```

Or use the all-in-one script (also extracts frames):
```bash
cd demo
mise exec -- ./run-demo.sh
```

Or manually extract frames for review:
```bash
ffmpeg -i demo.webm -vf "fps=1" frames/frame-%04d.png
```

## Key files

- `demo.tape` - VHS script defining the recording
- `setup.sh` - Creates fresh workdir for demo
- `run-demo.sh` - All-in-one: setup → record → convert → extract frames
- `demo.webp` - Output animation (committed, used in README)
- `demo.webm` - Intermediate video (gitignored)
- `frames/` - Extracted PNGs for validation (gitignored)

## Dependencies

Managed via `.mise.toml` in project root:
- `vhs` - Terminal recording tool
- `ttyd` - Required by vhs

## Pacing guidelines

| Content type | Pause duration |
|--------------|----------------|
| Opening/orientation | 1.5s |
| Wizard prompt accepts | 800ms |
| Tree/simple output | 2s |
| Hero shots (diff, config) | 3s |
| Final payoff | 4s |
| Pre-enter typing pause | 300ms |

## WebP encoding

The webp is encoded at 6fps with quality 65 to stay under GitHub's 10MB limit:
```
ffmpeg -vf "fps=6" -c:v libwebp -quality 65 -compression_level 6 -loop 0
```

Size vs quality tradeoffs at 6fps:
- q50: ~1.5M (noticeable artifacts)
- q60: ~4M (good quality)
- q65: ~9M (high quality, current setting)
- q70: ~10M (exceeds GitHub limit)

Higher fps dramatically increases size (7fps jumps to 10M+).

## GitHub repo

Demo uses https://github.com/richardgill/patchy-demo-repo with tags v1.0.0 and v1.1.0.
