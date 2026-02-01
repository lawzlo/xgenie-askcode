import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Logo } from "../components/Logo";
import { COLORS } from "../config/constants";

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();

  // Fade out at the end
  const opacity = interpolate(frame, [100, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <Logo scale={2} showTagline={true} />
    </AbsoluteFill>
  );
};
