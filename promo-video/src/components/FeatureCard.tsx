import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../config/constants";

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  delay?: number;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: 15,
      stiffness: 80,
    },
  });

  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateX = interpolate(slideIn, [0, 1], [100, 0]);

  return (
    <div
      style={{
        width: 380,
        padding: 24,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        border: `2px solid ${COLORS.primary}`,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        opacity,
        transform: `translateX(${translateX}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 36 }}>{icon}</span>
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 24,
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          {title}
        </span>
      </div>
      <p
        style={{
          fontFamily: FONTS.heading,
          fontSize: 18,
          color: COLORS.textSecondary,
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {description}
      </p>
    </div>
  );
};

// Feature grid for Scene 4
interface FeatureGridProps {
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
}

export const FeatureGrid: React.FC<FeatureGridProps> = ({ features }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 24,
        padding: 40,
      }}
    >
      {features.map((feature, i) => (
        <FeatureCard
          key={feature.title}
          icon={feature.icon}
          title={feature.title}
          description={feature.description}
          delay={i * 10} // 100ms stagger at 30fps
        />
      ))}
    </div>
  );
};
