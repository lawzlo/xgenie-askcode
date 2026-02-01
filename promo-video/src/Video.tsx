import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, TIMELINE } from "./config/constants";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Problem } from "./scenes/Scene2Problem";
import { Scene3Demo } from "./scenes/Scene3Demo";
import { Scene4Features } from "./scenes/Scene4Features";
import { Scene5CTA } from "./scenes/Scene5CTA";

export const AskCodePromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Scene 1: Hook (0-4s) */}
      <Sequence from={TIMELINE.scene1.start} durationInFrames={TIMELINE.scene1.end - TIMELINE.scene1.start}>
        <Scene1Hook />
      </Sequence>

      {/* Scene 2: Problem (4-9s) */}
      <Sequence from={TIMELINE.scene2.start} durationInFrames={TIMELINE.scene2.end - TIMELINE.scene2.start}>
        <Scene2Problem />
      </Sequence>

      {/* Scene 3: Demo (9-19s) */}
      <Sequence from={TIMELINE.scene3.start} durationInFrames={TIMELINE.scene3.end - TIMELINE.scene3.start}>
        <Scene3Demo />
      </Sequence>

      {/* Scene 4: Features (19-26s) */}
      <Sequence from={TIMELINE.scene4.start} durationInFrames={TIMELINE.scene4.end - TIMELINE.scene4.start}>
        <Scene4Features />
      </Sequence>

      {/* Scene 5: CTA (26-30s) */}
      <Sequence from={TIMELINE.scene5.start} durationInFrames={TIMELINE.scene5.end - TIMELINE.scene5.start}>
        <Scene5CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
