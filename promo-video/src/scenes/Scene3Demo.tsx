import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS, DEMO_QUESTION, DEMO_ANSWER } from "../config/constants";

export const Scene3Demo: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase timing
  const questionPhase = { start: 0, end: 60 };
  const thinkingPhase = { start: 60, end: 180 };
  const answerPhase = { start: 180, end: 300 };

  // Entrance/exit
  const entranceOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [280, 300], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(entranceOpacity, exitOpacity);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        display: "flex",
        flexDirection: "column",
        opacity,
      }}
    >
      {/* Header bar */}
      <HNHeader />

      {/* Main content */}
      <div
        style={{
          maxWidth: "90%",
          margin: "0 auto",
          padding: "30px 0",
          width: "100%",
        }}
      >
        {/* Project title */}
        <div
          style={{
            borderTop: `1px solid ${COLORS.primary}`,
            paddingTop: 15,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 20,
              color: COLORS.primary,
              fontWeight: "bold",
            }}
          >
            my-awesome-project
          </span>
        </div>

        {/* Chat messages */}
        <div style={{ marginBottom: 20 }}>
          {/* User question */}
          <QuestionMessage frame={frame} startFrame={questionPhase.start} />

          {/* AI thinking/answer */}
          {frame >= thinkingPhase.start && (
            <AIResponse
              frame={frame}
              thinkingStart={thinkingPhase.start}
              thinkingEnd={thinkingPhase.end}
              answerStart={answerPhase.start}
            />
          )}
        </div>

        {/* Question input */}
        <QuestionInput frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

// HackerNews style header
const HNHeader: React.FC = () => {
  return (
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
        {/* Logo */}
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
        <span style={{ color: COLORS.text, fontSize: 18 }}>|</span>
        <span style={{ color: COLORS.text, fontSize: 18 }}>add project</span>
        <span style={{ color: COLORS.text, fontSize: 18 }}>|</span>
        <span style={{ color: COLORS.text, fontSize: 18 }}>providers</span>
        <div style={{ marginLeft: "auto", color: COLORS.text, fontSize: 18 }}>
          user@example.com
        </div>
      </div>
    </div>
  );
};

// User question message
const QuestionMessage: React.FC<{ frame: number; startFrame: number }> = ({
  frame,
  startFrame,
}) => {
  const localFrame = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(
    Math.floor(localFrame * 0.8),
    DEMO_QUESTION.length
  );

  const opacity = interpolate(frame, [startFrame, startFrame + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        marginBottom: 15,
        padding: 16,
        backgroundColor: "#ffffee",
        border: "1px solid #e0e0d0",
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: COLORS.textSecondary,
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <strong style={{ color: COLORS.primary }}>You</strong>
        <span>just now</span>
      </div>
      <div
        style={{
          fontFamily: "Verdana, Geneva, sans-serif",
          fontSize: 20,
          color: COLORS.text,
          lineHeight: 1.6,
        }}
      >
        {DEMO_QUESTION.slice(0, charsToShow)}
        {charsToShow < DEMO_QUESTION.length && (
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: 20,
              backgroundColor: COLORS.primary,
              marginLeft: 2,
              verticalAlign: "text-bottom",
            }}
          />
        )}
      </div>
    </div>
  );
};

// AI response with thinking and answer
const AIResponse: React.FC<{
  frame: number;
  thinkingStart: number;
  thinkingEnd: number;
  answerStart: number;
}> = ({ frame, thinkingStart, thinkingEnd, answerStart }) => {
  const isThinking = frame < answerStart;
  const thinkingProgress = interpolate(
    frame,
    [thinkingStart, thinkingEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = interpolate(frame, [thinkingStart, thinkingStart + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (isThinking) {
    // Loading state
    return (
      <div
        style={{
          padding: 16,
          backgroundColor: COLORS.white,
          border: "1px solid #e0e0d8",
          opacity,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: COLORS.textSecondary,
            fontSize: 18,
          }}
        >
          <LoadingSpinner frame={frame} />
          <span>AI is exploring the codebase...</span>
        </div>
        {/* Files being read */}
        <div style={{ marginTop: 12, marginLeft: 30 }}>
          <FileReadingAnimation frame={frame} startFrame={thinkingStart} />
        </div>
        {/* Progress bar */}
        <div
          style={{
            marginTop: 16,
            marginLeft: 30,
            width: 300,
            height: 4,
            backgroundColor: "#e0e0d8",
            borderRadius: 2,
          }}
        >
          <div
            style={{
              width: `${thinkingProgress * 100}%`,
              height: "100%",
              backgroundColor: COLORS.primary,
              borderRadius: 2,
            }}
          />
        </div>
      </div>
    );
  }

  // Answer state
  const answerLocalFrame = frame - answerStart;
  const answerLines = DEMO_ANSWER.split("\n");

  return (
    <div
      style={{
        padding: 16,
        backgroundColor: COLORS.white,
        border: "1px solid #e0e0d8",
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: COLORS.textSecondary,
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <strong style={{ color: COLORS.primary }}>AI</strong>
        <span>5 files read</span>
      </div>
      <div
        style={{
          fontFamily: "Verdana, Geneva, sans-serif",
          fontSize: 18,
          color: COLORS.text,
          lineHeight: 1.8,
        }}
      >
        {answerLines.map((line, i) => {
          const lineDelay = i * 8;
          const lineOpacity = interpolate(
            answerLocalFrame,
            [lineDelay, lineDelay + 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div key={i} style={{ opacity: lineOpacity, minHeight: line ? "auto" : 12 }}>
              {line}
            </div>
          );
        })}
      </div>
      {/* Share button */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid #e0e0d8",
          opacity: interpolate(answerLocalFrame, [80, 100], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <button
          style={{
            fontFamily: "inherit",
            fontSize: 16,
            padding: "6px 16px",
            backgroundColor: COLORS.white,
            border: `1px solid ${COLORS.primary}`,
            color: COLORS.primary,
            cursor: "pointer",
          }}
        >
          share
        </button>
      </div>
    </div>
  );
};

// Loading spinner
const LoadingSpinner: React.FC<{ frame: number }> = ({ frame }) => {
  const rotation = frame * 12;
  return (
    <div
      style={{
        width: 20,
        height: 20,
        border: `2px solid ${COLORS.primary}`,
        borderTopColor: "transparent",
        borderRadius: "50%",
        transform: `rotate(${rotation}deg)`,
      }}
    />
  );
};

// File reading animation
const FileReadingAnimation: React.FC<{ frame: number; startFrame: number }> = ({
  frame,
  startFrame,
}) => {
  const files = ["auth.ts", "middleware.ts", "session.ts", "jwt.ts", "user.ts"];
  const localFrame = frame - startFrame;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {files.map((file, i) => {
        const fileStart = i * 20;
        const fileEnd = fileStart + 30;
        const isActive = localFrame >= fileStart && localFrame <= fileEnd;
        const opacity = interpolate(
          localFrame,
          [fileStart, fileStart + 5, fileEnd - 5, fileEnd],
          [0, 1, 1, 0.4],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <div
            key={file}
            style={{
              fontFamily: FONTS.code,
              fontSize: 14,
              color: isActive ? COLORS.primary : COLORS.textSecondary,
              opacity,
            }}
          >
            → reading {file}
            {isActive && (
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: COLORS.primary,
                  marginLeft: 6,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// Question input at bottom
const QuestionInput: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity }}>
      <textarea
        style={{
          width: "100%",
          fontFamily: "monospace",
          fontSize: 16,
          padding: 10,
          border: `1px solid ${COLORS.textSecondary}`,
          backgroundColor: COLORS.white,
          minHeight: 60,
          resize: "none",
        }}
        placeholder="Ask a question... (Shift+Enter to submit)"
        readOnly
      />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 8,
        }}
      >
        <button
          style={{
            fontFamily: "inherit",
            fontSize: 16,
            padding: "4px 16px",
            backgroundColor: COLORS.background,
            border: `1px solid ${COLORS.textSecondary}`,
            cursor: "pointer",
          }}
        >
          ask
        </button>
      </div>
    </div>
  );
};
