import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../config/constants";

interface CodeBlockProps {
  code: string;
  language?: string;
  startFrame?: number;
  animate?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "typescript",
  startFrame = 0,
  animate = true,
}) => {
  const frame = useCurrentFrame();
  const localFrame = Math.max(0, frame - startFrame);

  const lines = code.split("\n");

  return (
    <div
      style={{
        fontFamily: FONTS.code,
        fontSize: 16,
        backgroundColor: COLORS.codeBackground,
        padding: 20,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Language badge */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 12,
          fontSize: 12,
          color: COLORS.textSecondary,
          opacity: 0.6,
        }}
      >
        {language}
      </div>

      {/* Code lines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {lines.map((line, i) => {
          const lineDelay = animate ? i * 5 : 0;
          const opacity = animate
            ? interpolate(
                localFrame,
                [lineDelay, lineDelay + 10],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )
            : 1;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                opacity,
              }}
            >
              {/* Line number */}
              <span
                style={{
                  color: COLORS.textSecondary,
                  opacity: 0.5,
                  minWidth: 30,
                  textAlign: "right",
                }}
              >
                {i + 1}
              </span>
              {/* Code content with basic syntax highlighting */}
              <span style={{ color: COLORS.codeText }}>
                <HighlightedLine line={line} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Basic syntax highlighting
const HighlightedLine: React.FC<{ line: string }> = ({ line }) => {
  // Very basic highlighting for demo purposes
  const keywords = [
    "const",
    "let",
    "function",
    "return",
    "import",
    "export",
    "from",
    "if",
    "else",
    "async",
    "await",
  ];
  const keywordColor = "#c586c0";
  const stringColor = "#ce9178";
  const commentColor = "#6a9955";

  // Simple string detection
  if (line.includes("//")) {
    const [code, comment] = line.split("//");
    return (
      <>
        <HighlightedLine line={code} />
        <span style={{ color: commentColor }}>//{comment}</span>
      </>
    );
  }

  // Check for strings
  const stringMatch = line.match(/(["'`]).*?\1/);
  if (stringMatch) {
    const idx = line.indexOf(stringMatch[0]);
    return (
      <>
        <HighlightedLine line={line.slice(0, idx)} />
        <span style={{ color: stringColor }}>{stringMatch[0]}</span>
        <HighlightedLine line={line.slice(idx + stringMatch[0].length)} />
      </>
    );
  }

  // Check for keywords
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(line)) {
      const parts = line.split(regex);
      return (
        <>
          {parts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: keywordColor }}>{keyword}</span>}
              {part}
            </span>
          ))}
        </>
      );
    }
  }

  return <>{line}</>;
};
