import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GITHUB_URL } from "../config/constants";

export const Scene5CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance animation
  const entranceOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Logo pulse effect
  const pulseScale = 1 + Math.sin(frame * 0.15) * 0.03;

  // Logo entrance
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Text entrance
  const textOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // GitHub star animation
  const starFill = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Border draw animation
  const borderProgress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
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
        opacity: entranceOpacity,
      }}
    >
      {/* Logo with glow */}
      <div
        style={{
          position: "relative",
          transform: `scale(${logoScale * pulseScale})`,
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: "absolute",
            top: -30,
            left: -30,
            right: -30,
            bottom: -30,
            background: `radial-gradient(ellipse, ${COLORS.primary}30, transparent 70%)`,
            opacity: 0.5 + Math.sin(frame * 0.1) * 0.3,
            borderRadius: 20,
          }}
        />

        {/* Logo: Icon + Text */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* Logo icon - matches favicon.svg */}
          <svg width={140} height={140} viewBox="0 0 100 100">
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
            <text
              x="50"
              y="70"
              fontFamily="Georgia, serif"
              fontSize="58"
              fontWeight="bold"
              fill={COLORS.text}
              textAnchor="middle"
            >
              A
            </text>
          </svg>

          {/* Logo text */}
          <span
            style={{
              fontFamily: "Verdana, Geneva, sans-serif",
              fontSize: 88,
              fontWeight: 700,
              color: COLORS.text,
            }}
          >
            skCode
          </span>
        </div>
      </div>

      {/* Open Source badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: textOpacity,
        }}
      >
        <span
          style={{
            fontFamily: "Verdana, Geneva, sans-serif",
            fontSize: 42,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          Open Source
        </span>
        <span style={{ fontSize: 36, color: COLORS.textSecondary }}>•</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <GitHubStar fillProgress={starFill} />
          <span
            style={{
              fontFamily: "Verdana, Geneva, sans-serif",
              fontSize: 42,
              fontWeight: 600,
              color: COLORS.text,
            }}
          >
            Star on GitHub
          </span>
        </div>
      </div>

      {/* URL */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 36,
          color: COLORS.primary,
          opacity: textOpacity,
          padding: "16px 32px",
          backgroundColor: COLORS.white,
          borderRadius: 8,
          border: `2px solid ${COLORS.primary}`,
        }}
      >
        {GITHUB_URL}
      </div>
    </AbsoluteFill>
  );
};

// Animated GitHub star
const GitHubStar: React.FC<{ fillProgress: number }> = ({ fillProgress }) => {
  const size = 48;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {/* Star outline */}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="none"
        stroke={COLORS.primary}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Star fill (animated) */}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={COLORS.primary}
        opacity={fillProgress}
      />
    </svg>
  );
};
