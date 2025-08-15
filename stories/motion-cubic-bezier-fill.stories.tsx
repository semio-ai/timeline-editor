import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMotionValue, animate } from "motion/react";
import { MotionCubicBezierFill, MotionCubicBezierLine } from "@semio/animation";

const meta = {
  title: "animation/MotionCubicBezierFill",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function BasicFillExample() {
  const startX = useMotionValue(0);
  const startY = useMotionValue(30);
  const endX = useMotionValue(100);
  const endY = useMotionValue(30);
  const cp1X = useMotionValue(25);
  const cp1Y = useMotionValue(60);
  const cp2X = useMotionValue(75);
  const cp2Y = useMotionValue(0);

  return (
    <MotionCubicBezierFill
      start={{ x: startX, y: startY }}
      end={{ x: endX, y: endY }}
      controlPoint1={{ x: cp1X, y: cp1Y }}
      controlPoint2={{ x: cp2X, y: cp2Y }}
      baseline={0}
      color="#ff6b6b"
      opacity={0.6}
      segments={32}
    />
  );
}

function FillWithLineExample() {
  const startX = useMotionValue(-50);
  const startY = useMotionValue(40);
  const endX = useMotionValue(50);
  const endY = useMotionValue(40);
  const cp1X = useMotionValue(-25);
  const cp1Y = useMotionValue(70);
  const cp2X = useMotionValue(25);
  const cp2Y = useMotionValue(10);

  return (
    <>
      <MotionCubicBezierFill
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        baseline={0}
        color="#4ecdc4"
        opacity={0.4}
        segments={50}
      />
      <MotionCubicBezierLine
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        color="#4ecdc4"
        lineWidth={3}
        segments={50}
      />
    </>
  );
}

function AnimatedFillExample() {
  const startX = useMotionValue(-60);
  const startY = useMotionValue(20);
  const endX = useMotionValue(60);
  const endY = useMotionValue(50);
  const cp1X = useMotionValue(-30);
  const cp1Y = useMotionValue(50);
  const cp2X = useMotionValue(30);
  const cp2Y = useMotionValue(20);

  useEffect(() => {
    const animateShape = async () => {
      while (true) {
        // Animate to first configuration
        await Promise.all([
          animate(startY, 60, { duration: 2 }),
          animate(endY, 20, { duration: 2 }),
          animate(cp1X, 30, { duration: 2 }),
          animate(cp1Y, 80, { duration: 2 }),
          animate(cp2X, -30, { duration: 2 }),
          animate(cp2Y, 10, { duration: 2 }),
        ]);

        // Animate to second configuration
        await Promise.all([
          animate(startY, 10, { duration: 2 }),
          animate(endY, 70, { duration: 2 }),
          animate(cp1X, -40, { duration: 2 }),
          animate(cp1Y, 30, { duration: 2 }),
          animate(cp2X, 40, { duration: 2 }),
          animate(cp2Y, 90, { duration: 2 }),
        ]);

        // Return to original
        await Promise.all([
          animate(startY, 20, { duration: 2 }),
          animate(endY, 50, { duration: 2 }),
          animate(cp1X, -30, { duration: 2 }),
          animate(cp1Y, 50, { duration: 2 }),
          animate(cp2X, 30, { duration: 2 }),
          animate(cp2Y, 20, { duration: 2 }),
        ]);
      }
    };

    animateShape();
  }, [startY, endY, cp1X, cp1Y, cp2X, cp2Y]);

  return (
    <MotionCubicBezierFill
      start={{ x: startX, y: startY }}
      end={{ x: endX, y: endY }}
      controlPoint1={{ x: cp1X, y: cp1Y }}
      controlPoint2={{ x: cp2X, y: cp2Y }}
      baseline={0}
      color="#f39c12"
      opacity={0.7}
      segments={64}
    />
  );
}

function MultipleFillsExample() {
  // Fill 1 - Top layer
  const fill1StartX = useMotionValue(-80);
  const fill1StartY = useMotionValue(60);
  const fill1EndX = useMotionValue(80);
  const fill1EndY = useMotionValue(60);
  const fill1Cp1X = useMotionValue(-40);
  const fill1Cp1Y = useMotionValue(80);
  const fill1Cp2X = useMotionValue(40);
  const fill1Cp2Y = useMotionValue(40);

  // Fill 2 - Middle layer
  const fill2StartX = useMotionValue(-80);
  const fill2StartY = useMotionValue(30);
  const fill2EndX = useMotionValue(80);
  const fill2EndY = useMotionValue(30);
  const fill2Cp1X = useMotionValue(-40);
  const fill2Cp1Y = useMotionValue(50);
  const fill2Cp2X = useMotionValue(40);
  const fill2Cp2Y = useMotionValue(10);

  // Fill 3 - Bottom layer
  const fill3StartX = useMotionValue(-80);
  const fill3StartY = useMotionValue(0);
  const fill3EndX = useMotionValue(80);
  const fill3EndY = useMotionValue(0);
  const fill3Cp1X = useMotionValue(-40);
  const fill3Cp1Y = useMotionValue(20);
  const fill3Cp2X = useMotionValue(40);
  const fill3Cp2Y = useMotionValue(-20);

  return (
    <>
      <MotionCubicBezierFill
        start={{ x: fill3StartX, y: fill3StartY }}
        end={{ x: fill3EndX, y: fill3EndY }}
        controlPoint1={{ x: fill3Cp1X, y: fill3Cp1Y }}
        controlPoint2={{ x: fill3Cp2X, y: fill3Cp2Y }}
        baseline={-40}
        color="#3498db"
        opacity={0.6}
        segments={40}
      />
      <MotionCubicBezierFill
        start={{ x: fill2StartX, y: fill2StartY }}
        end={{ x: fill2EndX, y: fill2EndY }}
        controlPoint1={{ x: fill2Cp1X, y: fill2Cp1Y }}
        controlPoint2={{ x: fill2Cp2X, y: fill2Cp2Y }}
        baseline={-40}
        color="#2ecc71"
        opacity={0.6}
        segments={40}
      />
      <MotionCubicBezierFill
        start={{ x: fill1StartX, y: fill1StartY }}
        end={{ x: fill1EndX, y: fill1EndY }}
        controlPoint1={{ x: fill1Cp1X, y: fill1Cp1Y }}
        controlPoint2={{ x: fill1Cp2X, y: fill1Cp2Y }}
        baseline={-40}
        color="#e74c3c"
        opacity={0.6}
        segments={40}
      />
    </>
  );
}

function InteractiveFillExample() {
  const startX = useMotionValue(-60);
  const startY = useMotionValue(30);
  const endX = useMotionValue(60);
  const endY = useMotionValue(30);
  const cp1X = useMotionValue(0);
  const cp1Y = useMotionValue(60);
  const cp2X = useMotionValue(0);
  const cp2Y = useMotionValue(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const time = Date.now() * 0.001;

      // Animate control points in a smooth pattern
      cp1X.set(Math.sin(time * 0.8) * 30);
      cp1Y.set(60 + Math.cos(time * 1.2) * 20);
      cp2X.set(Math.cos(time * 0.6) * 30);
      cp2Y.set(Math.sin(time * 1.1) * 20);

      // Slightly animate endpoints
      startY.set(30 + Math.sin(time * 0.5) * 10);
      endY.set(30 + Math.cos(time * 0.7) * 10);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [cp1X, cp1Y, cp2X, cp2Y, startY, endY]);

  return (
    <>
      <MotionCubicBezierFill
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        baseline={-20}
        color="#9b59b6"
        opacity={0.5}
        segments={80}
        onPointerOver={() => console.log("Fill hovered")}
        onClick={() => console.log("Fill clicked")}
      />
      <MotionCubicBezierLine
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        color="#9b59b6"
        lineWidth={2}
        segments={80}
      />
    </>
  );
}

function DifferentBaselinesExample() {
  // High baseline fill
  const highStartX = useMotionValue(-40);
  const highStartY = useMotionValue(60);
  const highEndX = useMotionValue(40);
  const highEndY = useMotionValue(60);
  const highCp1X = useMotionValue(-20);
  const highCp1Y = useMotionValue(80);
  const highCp2X = useMotionValue(20);
  const highCp2Y = useMotionValue(40);

  // Middle baseline fill
  const midStartX = useMotionValue(-40);
  const midStartY = useMotionValue(20);
  const midEndX = useMotionValue(40);
  const midEndY = useMotionValue(20);
  const midCp1X = useMotionValue(-20);
  const midCp1Y = useMotionValue(40);
  const midCp2X = useMotionValue(20);
  const midCp2Y = useMotionValue(0);

  // Low baseline fill
  const lowStartX = useMotionValue(-40);
  const lowStartY = useMotionValue(-20);
  const lowEndX = useMotionValue(40);
  const lowEndY = useMotionValue(-20);
  const lowCp1X = useMotionValue(-20);
  const lowCp1Y = useMotionValue(0);
  const lowCp2X = useMotionValue(20);
  const lowCp2Y = useMotionValue(-40);

  return (
    <>
      {/* High baseline at 40 */}
      <MotionCubicBezierFill
        start={{ x: highStartX, y: highStartY }}
        end={{ x: highEndX, y: highEndY }}
        controlPoint1={{ x: highCp1X, y: highCp1Y }}
        controlPoint2={{ x: highCp2X, y: highCp2Y }}
        baseline={40}
        color="#ff6b6b"
        opacity={0.5}
        segments={30}
      />

      {/* Middle baseline at 0 */}
      <MotionCubicBezierFill
        start={{ x: midStartX, y: midStartY }}
        end={{ x: midEndX, y: midEndY }}
        controlPoint1={{ x: midCp1X, y: midCp1Y }}
        controlPoint2={{ x: midCp2X, y: midCp2Y }}
        baseline={0}
        color="#4ecdc4"
        opacity={0.5}
        segments={30}
      />

      {/* Low baseline at -40 */}
      <MotionCubicBezierFill
        start={{ x: lowStartX, y: lowStartY }}
        end={{ x: lowEndX, y: lowEndY }}
        controlPoint1={{ x: lowCp1X, y: lowCp1Y }}
        controlPoint2={{ x: lowCp2X, y: lowCp2Y }}
        baseline={-60}
        color="#f39c12"
        opacity={0.5}
        segments={30}
      />
    </>
  );
}

function BaselineExtensionExample() {
  // Curve that needs extended baseline coverage
  const startX = useMotionValue(-50);
  const startY = useMotionValue(30);
  const endX = useMotionValue(50);
  const endY = useMotionValue(30);
  const cp1X = useMotionValue(-25);
  const cp1Y = useMotionValue(50);
  const cp2X = useMotionValue(25);
  const cp2Y = useMotionValue(10);

  return (
    <>
      {/* Fill without extension - may have gaps */}
      <group position={[-60, 0, 0]}>
        <MotionCubicBezierFill
          start={{ x: startX, y: startY }}
          end={{ x: endX, y: endY }}
          controlPoint1={{ x: cp1X, y: cp1Y }}
          controlPoint2={{ x: cp2X, y: cp2Y }}
          baseline={0}
          color="#e74c3c"
          opacity={0.6}
          segments={40}
        />
        <MotionCubicBezierLine
          start={{ x: startX, y: startY }}
          end={{ x: endX, y: endY }}
          controlPoint1={{ x: cp1X, y: cp1Y }}
          controlPoint2={{ x: cp2X, y: cp2Y }}
          color="#e74c3c"
          lineWidth={2}
          segments={40}
        />
      </group>

      {/* Fill with extension - complete coverage */}
      <group position={[60, 0, 0]}>
        <MotionCubicBezierFill
          start={{ x: startX, y: startY }}
          end={{ x: endX, y: endY }}
          controlPoint1={{ x: cp1X, y: cp1Y }}
          controlPoint2={{ x: cp2X, y: cp2Y }}
          baseline={0}
          baselineExtension={15}
          color="#2ecc71"
          opacity={0.6}
          segments={40}
        />
        <MotionCubicBezierLine
          start={{ x: startX, y: startY }}
          end={{ x: endX, y: endY }}
          controlPoint1={{ x: cp1X, y: cp1Y }}
          controlPoint2={{ x: cp2X, y: cp2Y }}
          color="#2ecc71"
          lineWidth={2}
          segments={40}
        />
      </group>
    </>
  );
}

export const Basic: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <BasicFillExample />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const FillWithLine: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <FillWithLineExample />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
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
        <AnimatedFillExample />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const MultipleFills: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <MultipleFillsExample />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
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
        <InteractiveFillExample />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const DifferentBaselines: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <DifferentBaselinesExample />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const BaselineExtension: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <BaselineExtensionExample />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
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

        <group position={[-150, 100, 0]}>
          <BasicFillExample />
        </group>

        <group position={[0, 100, 0]}>
          <FillWithLineExample />
        </group>

        <group position={[150, 100, 0]}>
          <AnimatedFillExample />
        </group>

        <group position={[-150, -50, 0]}>
          <MultipleFillsExample />
        </group>

        <group position={[0, -50, 0]}>
          <InteractiveFillExample />
        </group>

        <group position={[100, -50, 0]}>
          <DifferentBaselinesExample />
        </group>

        <group position={[-100, -150, 0]}>
          <BaselineExtensionExample />
        </group>

        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        <gridHelper args={[500, 25, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};
