import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../config/constants";

interface TypewriterTextProps {
  text: string;
  startFrame?: number;
  speed?: number; // chars per frame
  fontSize?: number;
  color?: string;
  showCursor?: boolean;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  startFrame = 0,
  speed = 0.8,
  fontSize = 24,
  color = COLORS.text,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);

  const charsToShow = Math.min(
    Math.floor(localFrame * speed),
    text.length
  );

  const cursorOpacity = Math.sin(frame * 0.3) > 0 ? 1 : 0;
  const isTypingComplete = charsToShow >= text.length;

  return (
    <div
      style={{
        fontFamily: FONTS.code,
        fontSize,
        color,
        display: "flex",
        alignItems: "center",
        whiteSpace: "pre-wrap",
      }}
    >
      <span>{text.slice(0, charsToShow)}</span>
      {showCursor && (
        <span
          style={{
            width: 3,
            height: fontSize * 1.2,
            backgroundColor: COLORS.primary,
            marginLeft: 2,
            opacity: isTypingComplete ? cursorOpacity : 1,
          }}
        />
      )}
    </div>
  );
};

// Multi-line typewriter for longer text blocks
interface MultiLineTypewriterProps {
  lines: string[];
  startFrame?: number;
  lineDelay?: number; // frames between lines
  speed?: number;
  fontSize?: number;
  color?: string;
}

export const MultiLineTypewriter: React.FC<MultiLineTypewriterProps> = ({
  lines,
  startFrame = 0,
  lineDelay = 20,
  speed = 1,
  fontSize = 20,
  color = COLORS.codeText,
}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {lines.map((line, i) => {
        const lineStart = startFrame + i * lineDelay;
        const opacity = interpolate(
          frame,
          [lineStart, lineStart + 5],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <div key={i} style={{ opacity }}>
            <TypewriterText
              text={line}
              startFrame={lineStart}
              speed={speed}
              fontSize={fontSize}
              color={color}
              showCursor={i === lines.length - 1}
            />
          </div>
        );
      })}
    </div>
  );
};
