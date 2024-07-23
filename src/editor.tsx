import type { ReactNode } from "react";
import { animated, useSpring } from "@react-spring/web";

export interface EditorProps {
  width: number;
  opened: boolean;
}

export function Editor({ width, opened }: EditorProps): ReactNode {
  const styles = useSpring({
    height: opened ? 300 : 0,
    config: {
      duration: 100,
    },
  });

  return (
    <animated.svg
      style={styles}
      // animate={opened ? "visible" : "hidden"}
      // initial="hidden"
      // variants={{
      //   visible: { height: 300 },
      //   hidden: { height: 0 },
      // }}
      width={width}
    />
  );
}
