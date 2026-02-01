import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../config/constants";

interface TerminalProps {
  children: React.ReactNode;
  title?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  children,
  title = "askcode",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
    },
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1200,
        backgroundColor: COLORS.codeBackground,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 40,
          backgroundColor: "#2d2d2d",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 8,
        }}
      >
        {/* Traffic lights */}
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#ff5f57",
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#febc2e",
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#28c840",
          }}
        />
        <span
          style={{
            marginLeft: "auto",
            marginRight: "auto",
            fontFamily: FONTS.code,
            fontSize: 14,
            color: "#888",
          }}
        >
          {title}
        </span>
      </div>

      {/* Terminal content */}
      <div
        style={{
          padding: 24,
          minHeight: 300,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// Terminal prompt line
interface PromptLineProps {
  command: string;
  startFrame?: number;
}

export const PromptLine: React.FC<PromptLineProps> = ({
  command,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);

  const charsToShow = Math.min(
    Math.floor(localFrame * 0.8),
    command.length
  );

  const cursorOpacity = Math.sin(frame * 0.3) > 0 ? 1 : 0;

  return (
    <div
      style={{
        fontFamily: FONTS.code,
        fontSize: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ color: COLORS.success }}>$</span>
      <span style={{ color: COLORS.codeText }}>
        {command.slice(0, charsToShow)}
      </span>
      <span
        style={{
          width: 10,
          height: 24,
          backgroundColor: COLORS.codeText,
          opacity: cursorOpacity,
        }}
      />
    </div>
  );
};
