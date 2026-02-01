import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../config/constants";

export const Scene2Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance animation
  const entranceOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Exit animation
  const exitOpacity = interpolate(frame, [130, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = Math.min(entranceOpacity, exitOpacity);

  const line1Scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const line2Scale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        opacity,
      }}
    >
      {/* Code background pattern */}
      <CodeBackground />

      {/* Main text */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
        }}
      >
        <div
          style={{
            fontFamily: "Verdana, Geneva, sans-serif",
            fontSize: 84,
            fontWeight: 700,
            color: COLORS.text,
            transform: `scale(${line1Scale})`,
            textAlign: "center",
          }}
        >
          Your team asks.
        </div>

        <div
          style={{
            fontFamily: "Verdana, Geneva, sans-serif",
            fontSize: 84,
            fontWeight: 700,
            color: COLORS.primary,
            transform: `scale(${Math.max(0, line2Scale)})`,
            textAlign: "center",
          }}
        >
          Your codebase answers.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Decorative code background
const CodeBackground: React.FC = () => {
  const frame = useCurrentFrame();

  const codeLines = [
    "async function handleRequest(req) {",
    "  const user = await auth.verify(token);",
    "  if (!user) throw new Error('Unauthorized');",
    "  return await processRequest(req, user);",
    "}",
    "",
    "export const middleware = (req, res, next) => {",
    "  try {",
    "    validateToken(req.headers.authorization);",
    "    next();",
    "  } catch (err) {",
    "    res.status(401).json({ error: err.message });",
    "  }",
    "};",
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 100,
        opacity: 0.08,
      }}
    >
      {codeLines.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: FONTS.code,
            fontSize: 24,
            color: COLORS.text,
            whiteSpace: "pre",
            transform: `translateX(${Math.sin(frame * 0.02 + i) * 10}px)`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};
