import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMotionValue, animate } from "motion/react";
import { MotionCubicBezierLine } from "@semio/timeline-editor";

const meta = {
  title: "animation/MotionCubicBezierLine",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function BasicExample() {
  const startX = useMotionValue(0);
  const startY = useMotionValue(0);
  const endX = useMotionValue(100);
  const endY = useMotionValue(0);
  const cp1X = useMotionValue(25);
  const cp1Y = useMotionValue(-50);
  const cp2X = useMotionValue(75);
  const cp2Y = useMotionValue(50);

  return (
    <MotionCubicBezierLine
      start={{ x: startX, y: startY }}
      end={{ x: endX, y: endY }}
      controlPoint1={{ x: cp1X, y: cp1Y }}
      controlPoint2={{ x: cp2X, y: cp2Y }}
      color="#ff6b6b"
      lineWidth={2}
      segments={32}
    />
  );
}

function AnimatedExample() {
  const startX = useMotionValue(-50);
  const startY = useMotionValue(-50);
  const endX = useMotionValue(50);
  const endY = useMotionValue(50);
  const cp1X = useMotionValue(-25);
  const cp1Y = useMotionValue(25);
  const cp2X = useMotionValue(25);
  const cp2Y = useMotionValue(-25);

  useEffect(() => {
    let cancelled = false;
    const animateControlPoints = async () => {
      while (!cancelled) {
        // Animate to first configuration
        await Promise.all([
          animate(cp1X, 25, { duration: 2 }),
          animate(cp1Y, -75, { duration: 2 }),
          animate(cp2X, -25, { duration: 2 }),
          animate(cp2Y, 75, { duration: 2 }),
        ]);

        // Animate to second configuration
        await Promise.all([
          animate(cp1X, -75, { duration: 2 }),
          animate(cp1Y, -25, { duration: 2 }),
          animate(cp2X, 75, { duration: 2 }),
          animate(cp2Y, 25, { duration: 2 }),
        ]);

        // Return to original
        await Promise.all([
          animate(cp1X, -25, { duration: 2 }),
          animate(cp1Y, 25, { duration: 2 }),
          animate(cp2X, 25, { duration: 2 }),
          animate(cp2Y, -25, { duration: 2 }),
        ]);
      }
    };

    void animateControlPoints();
    return () => {
      cancelled = true;
    };
  }, [cp1X, cp1Y, cp2X, cp2Y]);

  return (
    <MotionCubicBezierLine
      start={{ x: startX, y: startY }}
      end={{ x: endX, y: endY }}
      controlPoint1={{ x: cp1X, y: cp1Y }}
      controlPoint2={{ x: cp2X, y: cp2Y }}
      color="#4ecdc4"
      lineWidth={3}
      segments={64}
      opacity={0.8}
      transparent
    />
  );
}

function MultipleStylesExample() {
  // Create motion values for curve 1
  const curve1StartX = useMotionValue(-80);
  const curve1StartY = useMotionValue(30);
  const curve1EndX = useMotionValue(80);
  const curve1EndY = useMotionValue(30);
  const curve1Cp1X = useMotionValue(-40);
  const curve1Cp1Y = useMotionValue(60);
  const curve1Cp2X = useMotionValue(40);
  const curve1Cp2Y = useMotionValue(0);

  // Create motion values for curve 2
  const curve2StartX = useMotionValue(-80);
  const curve2StartY = useMotionValue(0);
  const curve2EndX = useMotionValue(80);
  const curve2EndY = useMotionValue(0);
  const curve2Cp1X = useMotionValue(-40);
  const curve2Cp1Y = useMotionValue(30);
  const curve2Cp2X = useMotionValue(40);
  const curve2Cp2Y = useMotionValue(-30);

  // Create motion values for curve 3
  const curve3StartX = useMotionValue(-80);
  const curve3StartY = useMotionValue(-30);
  const curve3EndX = useMotionValue(80);
  const curve3EndY = useMotionValue(-30);
  const curve3Cp1X = useMotionValue(-40);
  const curve3Cp1Y = useMotionValue(0);
  const curve3Cp2X = useMotionValue(40);
  const curve3Cp2Y = useMotionValue(-60);

  return (
    <>
      <MotionCubicBezierLine
        start={{ x: curve1StartX, y: curve1StartY }}
        end={{ x: curve1EndX, y: curve1EndY }}
        controlPoint1={{ x: curve1Cp1X, y: curve1Cp1Y }}
        controlPoint2={{ x: curve1Cp2X, y: curve1Cp2Y }}
        color="#ff6b6b"
        lineWidth={4}
        segments={40}
      />
      <MotionCubicBezierLine
        start={{ x: curve2StartX, y: curve2StartY }}
        end={{ x: curve2EndX, y: curve2EndY }}
        controlPoint1={{ x: curve2Cp1X, y: curve2Cp1Y }}
        controlPoint2={{ x: curve2Cp2X, y: curve2Cp2Y }}
        color="#4ecdc4"
        lineWidth={2}
        segments={40}
        opacity={0.7}
        transparent
        dashed
      />
      <MotionCubicBezierLine
        start={{ x: curve3StartX, y: curve3StartY }}
        end={{ x: curve3EndX, y: curve3EndY }}
        controlPoint1={{ x: curve3Cp1X, y: curve3Cp1Y }}
        controlPoint2={{ x: curve3Cp2X, y: curve3Cp2Y }}
        color="#45b7d1"
        lineWidth={3}
        segments={40}
        opacity={0.9}
        transparent
      />
    </>
  );
}

function InteractiveExample() {
  const startX = useMotionValue(-60);
  const startY = useMotionValue(-60);
  const endX = useMotionValue(60);
  const endY = useMotionValue(60);
  const cp1X = useMotionValue(0);
  const cp1Y = useMotionValue(-80);
  const cp2X = useMotionValue(0);
  const cp2Y = useMotionValue(80);

  useEffect(() => {
    const interval = setInterval(() => {
      const time = Date.now() * 0.001;
      cp1X.set(Math.sin(time) * 40);
      cp1Y.set(-80 + Math.cos(time * 1.3) * 20);
      cp2X.set(Math.cos(time * 0.7) * 40);
      cp2Y.set(80 + Math.sin(time * 1.1) * 20);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [cp1X, cp1Y, cp2X, cp2Y]);

  return (
    <MotionCubicBezierLine
      start={{ x: startX, y: startY }}
      end={{ x: endX, y: endY }}
      controlPoint1={{ x: cp1X, y: cp1Y }}
      controlPoint2={{ x: cp2X, y: cp2Y }}
      color="#f39c12"
      lineWidth={5}
      segments={80}
      onPointerOver={() => console.log("Curve hovered")}
      onClick={() => console.log("Curve clicked")}
    />
  );
}

export const Basic: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <BasicExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const Animated: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <AnimatedExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const MultipleStyles: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <MultipleStylesExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <InteractiveExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const Showcase: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        <group position={[0, 80, 0]}>
          <BasicExample />
        </group>

        <group position={[0, 0, 0]}>
          <AnimatedExample />
        </group>

        <group position={[0, -100, 0]}>
          <MultipleStylesExample />
        </group>

        <group position={[150, 0, 0]}>
          <InteractiveExample />
        </group>

        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[400, 20, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};
