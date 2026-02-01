# AskCode Promo Video

A 30-second promotional video for AskCode built with [Remotion](https://remotion.dev).

## Quick Start

```bash
npm install
npm run dev      # Open studio at http://localhost:3000
npm run build    # Render to out/promo.mp4
```

## Video Structure

| Scene | Duration | Content |
|-------|----------|---------|
| Hook | 0-4s | Logo + "Talk to your code" |
| Problem | 4-9s | "Your team asks. Your codebase answers." |
| Demo | 9-19s | Terminal Q&A with agent thinking animation |
| Features | 19-26s | 4 feature cards |
| CTA | 26-30s | "Star on GitHub" + URL |

## Output

- Resolution: 1920x1080 (1080p)
- FPS: 30
- Duration: 30 seconds
- Format: MP4

## Project Structure

```
src/
├── Root.tsx           # Remotion entry
├── Video.tsx          # Main composition
├── config/constants.ts # Brand colors, timeline
├── components/        # Reusable animations
│   ├── Logo.tsx
│   ├── TypewriterText.tsx
│   ├── Terminal.tsx
│   ├── AgentThinking.tsx
│   └── FeatureCard.tsx
└── scenes/            # Video scenes
    ├── Scene1Hook.tsx
    ├── Scene2Problem.tsx
    ├── Scene3Demo.tsx
    ├── Scene4Features.tsx
    └── Scene5CTA.tsx
```
