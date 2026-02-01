import { Composition } from "remotion";
import { AskCodePromo } from "./Video";
import { VIDEO_CONFIG } from "./config/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AskCodePromo"
        component={AskCodePromo}
        durationInFrames={VIDEO_CONFIG.durationInFrames}
        fps={VIDEO_CONFIG.fps}
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
      />
    </>
  );
};
