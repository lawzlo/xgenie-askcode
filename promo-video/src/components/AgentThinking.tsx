import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS, DEMO_FILES } from "../config/constants";

interface AgentThinkingProps {
  startFrame?: number;
  duration?: number;
}

export const AgentThinking: React.FC<AgentThinkingProps> = ({
  startFrame = 0,
  duration = 120,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);

  if (localFrame < 0 || localFrame > duration) {
    return null;
  }

  const progress = localFrame / duration;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "16px 0",
      }}
    >
      {/* Thinking indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Spinner frame={localFrame} />
        <span
          style={{
            fontFamily: FONTS.code,
            fontSize: 18,
            color: COLORS.primary,
          }}
        >
          Agent exploring codebase...
        </span>
      </div>

      {/* File exploration animation */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginLeft: 36,
        }}
      >
        {DEMO_FILES.map((file, i) => {
          const fileStart = i * 20;
          const fileEnd = fileStart + 30;
          const isActive =
            localFrame >= fileStart && localFrame <= fileEnd;
          const opacity = interpolate(
            localFrame,
            [fileStart, fileStart + 5, fileEnd - 5, fileEnd],
            [0, 1, 1, 0.3],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={file}
              style={{
                fontFamily: FONTS.code,
                fontSize: 16,
                color: isActive ? COLORS.primary : COLORS.textSecondary,
                opacity,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: COLORS.textSecondary }}>{">"}</span>
              <span>reading {file}</span>
              {isActive && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: COLORS.primary,
                    animation: "pulse 0.5s infinite",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginLeft: 36,
          marginTop: 8,
          width: 300,
          height: 4,
          backgroundColor: "#333",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: COLORS.primary,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};

const Spinner: React.FC<{ frame: number }> = ({ frame }) => {
  const rotation = frame * 12; // 12 degrees per frame

  return (
    <div
      style={{
        width: 24,
        height: 24,
        position: "relative",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        style={{
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={COLORS.primary}
          strokeWidth="3"
          fill="none"
          strokeDasharray="31.4 31.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
