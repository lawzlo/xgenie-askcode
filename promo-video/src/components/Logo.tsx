import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../config/constants";

interface LogoProps {
  scale?: number;
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ scale = 1, showTagline = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance animation
  const logoScale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
    },
  });

  // Border draw animation
  const borderProgress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24 * scale,
        transform: `scale(${logoScale * scale})`,
      }}
    >
      {/* Logo: Icon + Text */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12 * scale,
        }}
      >
        {/* Logo icon - matches favicon.svg */}
        <div
          style={{
            position: "relative",
            width: 80 * scale,
            height: 80 * scale,
          }}
        >
          <svg
            width={80 * scale}
            height={80 * scale}
            viewBox="0 0 100 100"
          >
            {/* White border with draw animation */}
            <rect
              x="4"
              y="4"
              width="92"
              height="92"
              fill={COLORS.logoBg}
              stroke={COLORS.white}
              strokeWidth="4"
              strokeDasharray={`${borderProgress * 368} 368`}
            />
            {/* Black A in serif font */}
            <text
              x="50"
              y="70"
              fontFamily="Georgia, serif"
              fontSize="58"
              fontWeight="bold"
              fill={COLORS.text}
              textAnchor="middle"
              style={{
                opacity: interpolate(frame, [15, 30], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              A
            </text>
          </svg>
        </div>

        {/* Logo text "skCode" */}
        <LogoText scale={scale} />
      </div>

      {/* Tagline */}
      {showTagline && (
        <div
          style={{
            opacity: interpolate(frame, [40, 60], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [40, 60], [20, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          <TypewriterTagline startFrame={50} />
        </div>
      )}
    </div>
  );
};

// Logo text with staggered animation
const LogoText: React.FC<{ scale: number }> = ({ scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = "skCode".split("");

  return (
    <div style={{ display: "flex" }}>
      {letters.map((letter, i) => {
        const letterScale = spring({
          frame: frame - 10 - i * 3,
          fps,
          config: {
            damping: 10,
            stiffness: 150,
          },
        });

        return (
          <span
            key={i}
            style={{
              fontFamily: "Verdana, Geneva, sans-serif",
              fontSize: 56 * scale,
              fontWeight: 700,
              color: COLORS.text,
              transform: `scale(${Math.max(0, letterScale)})`,
              display: "inline-block",
            }}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
};

const TypewriterTagline: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const text = "Talk to your code";
  const localFrame = frame - startFrame;

  const charsToShow = Math.min(
    Math.floor(interpolate(localFrame, [0, 30], [0, text.length], {
      extrapolateRight: "clamp",
    })),
    text.length
  );

  const cursorOpacity = Math.sin(frame * 0.3) > 0 ? 1 : 0;

  return (
    <div
      style={{
        fontFamily: FONTS.code,
        fontSize: 48,
        color: COLORS.textSecondary,
        display: "flex",
        alignItems: "center",
      }}
    >
      <span>{text.slice(0, charsToShow)}</span>
      <span
        style={{
          width: 4,
          height: 52,
          backgroundColor: COLORS.primary,
          marginLeft: 4,
          opacity: cursorOpacity,
        }}
      />
    </div>
  );
};
