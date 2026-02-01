// Video configuration
export const VIDEO_CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 900, // 30s × 30fps
};

// Brand colors - HackerNews inspired
export const COLORS = {
  primary: "#ff6600", // Orange
  logoBg: "#D2691E", // Brown
  background: "#f6f6ef", // HN beige
  text: "#000000",
  textSecondary: "#828282",
  codeBackground: "#1e1e1e",
  codeText: "#d4d4d4",
  success: "#00ff00",
  white: "#ffffff",
};

// Timeline in frames (30fps)
export const TIMELINE = {
  scene1: { start: 0, end: 120 }, // 0-4s (Hook)
  scene2: { start: 120, end: 270 }, // 4-9s (Problem)
  scene3: { start: 270, end: 570 }, // 9-19s (Demo)
  scene4: { start: 570, end: 780 }, // 19-26s (Features)
  scene5: { start: 780, end: 900 }, // 26-30s (CTA)
};

// Typography
export const FONTS = {
  code: "JetBrains Mono, Consolas, Monaco, monospace",
  heading: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
};

// Demo content
export const DEMO_QUESTION = "How does user authentication work?";

export const DEMO_FILES = [
  "auth.ts",
  "middleware.ts",
  "session.ts",
  "jwt.ts",
  "user.ts",
];

export const DEMO_ANSWER = `Authentication uses JWT tokens stored in HTTP-only cookies.

The flow is:
1. User submits credentials to /api/auth/login
2. Server validates against Supabase Auth
3. JWT token is generated and set as cookie
4. Subsequent requests include token automatically
5. Middleware validates token on protected routes`;

// Features
export const FEATURES = [
  {
    icon: "🔍",
    title: "AI-Powered Q&A",
    description: "Ask questions in plain English",
  },
  {
    icon: "🔒",
    title: "Access Control",
    description: "Team-based permissions",
  },
  {
    icon: "🔄",
    title: "Multi-Repo",
    description: "Query across repositories",
  },
  {
    icon: "⚡",
    title: "Agentic Loop",
    description: "Claude explores your code",
  },
];

// GitHub URL
export const GITHUB_URL = "github.com/lawzlo/xgenie-askcode";
