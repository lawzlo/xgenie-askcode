import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../config/constants";

// HackerNews style features - pure text, no emojis
const FEATURES = [
  {
    title: "Plain English Q&A",
    desc: "Ask questions about your codebase in natural language. No technical jargon required.",
  },
  {
    title: "Team Access Control",
    desc: "Different access levels for developers, product managers, and support staff.",
  },
  {
    title: "Multi-Repository",
    desc: "Query across multiple repositories in a single project.",
  },
  {
    title: "Agentic Exploration",
    desc: "Claude autonomously reads files and explores your code to find answers.",
  },
];

export const Scene4Features: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance/exit
  const entranceOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [190, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(entranceOpacity, exitOpacity);

  // Title animation
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        display: "flex",
        flexDirection: "column",
        opacity,
      }}
    >
      {/* Header bar for consistency */}
      <div
        style={{
          backgroundColor: COLORS.primary,
          padding: "4px 8px",
        }}
      >
        <div
          style={{
            maxWidth: "85%",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              border: "1px solid white",
              padding: "2px 6px",
              fontWeight: "bold",
              color: COLORS.text,
              fontSize: 22,
              fontFamily: "Georgia, serif",
            }}
          >
            A
          </div>
          <span
            style={{
              fontWeight: "bold",
              color: COLORS.text,
              fontSize: 20,
              fontFamily: "Verdana, Geneva, sans-serif",
            }}
          >
            AskCode
          </span>
        </div>
      </div>

      {/* Main content - HN style */}
      <div
        style={{
          maxWidth: "85%",
          margin: "0 auto",
          padding: "40px 20px",
          width: "100%",
        }}
      >
        {/* Title */}
        <div
          style={{
            textAlign: "center",
            marginBottom: 50,
            transform: `scale(${titleScale})`,
          }}
        >
          <h1
            style={{
              fontFamily: "Verdana, Geneva, sans-serif",
              fontSize: 32,
              fontWeight: "bold",
              color: COLORS.text,
              margin: 0,
            }}
          >
            Why AskCode?
          </h1>
        </div>

        {/* Features - HN minimal style */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "50px 80px",
          }}
        >
          {FEATURES.map((feature, i) => {
            const delay = 20 + i * 15;
            const featureOpacity = interpolate(
              frame,
              [delay, delay + 15],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const slideY = interpolate(
              frame,
              [delay, delay + 15],
              [20, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <div
                key={feature.title}
                style={{
                  opacity: featureOpacity,
                  transform: `translateY(${slideY}px)`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "Verdana, Geneva, sans-serif",
                    fontSize: 24,
                    fontWeight: "bold",
                    color: COLORS.primary,
                    marginBottom: 12,
                  }}
                >
                  {feature.title}
                </div>
                <div
                  style={{
                    fontFamily: "Verdana, Geneva, sans-serif",
                    fontSize: 20,
                    color: "#666",
                    lineHeight: 1.5,
                  }}
                >
                  {feature.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* How it works - HN style */}
        <div
          style={{
            marginTop: 50,
            paddingTop: 40,
            borderTop: "1px solid #e0e0d8",
            textAlign: "center",
            opacity: interpolate(frame, [100, 120], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <h2
            style={{
              fontFamily: "Verdana, Geneva, sans-serif",
              fontSize: 28,
              fontWeight: "bold",
              color: COLORS.text,
              marginBottom: 35,
            }}
          >
            How it works
          </h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 30,
            }}
          >
            <Step num={1} text="Add your repo" frame={frame} delay={110} />
            <Arrow frame={frame} delay={120} />
            <Step num={2} text="Ask a question" frame={frame} delay={130} />
            <Arrow frame={frame} delay={140} />
            <Step num={3} text="Get answers" frame={frame} delay={150} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Step component
const Step: React.FC<{ num: number; text: string; frame: number; delay: number }> = ({
  num,
  text,
  frame,
  delay,
}) => {
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          backgroundColor: COLORS.primary,
          color: COLORS.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Verdana, Geneva, sans-serif",
          fontSize: 18,
          fontWeight: "bold",
        }}
      >
        {num}
      </div>
      <span
        style={{
          fontFamily: "Verdana, Geneva, sans-serif",
          fontSize: 20,
          color: COLORS.text,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// Arrow component
const Arrow: React.FC<{ frame: number; delay: number }> = ({ frame, delay }) => {
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        color: "#ccc",
        fontSize: 32,
        opacity,
      }}
    >
      →
    </span>
  );
};
