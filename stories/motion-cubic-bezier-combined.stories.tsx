import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMotionValue, animate } from "motion/react";
import { MotionCubicBezierLine, MotionCubicBezierFill } from "@semio/timeline-editor";

const meta = {
  title: "animation/MotionCubicBezierCombined",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// Simulating TransitionSegment Preview render mode
function PreviewModeExample() {
  const startX = useMotionValue(0);
  const startY = useMotionValue(20);
  const endX = useMotionValue(100);
  const endY = useMotionValue(60);
  const cp1X = useMotionValue(30);
  const cp1Y = useMotionValue(50);
  const cp2X = useMotionValue(70);
  const cp2Y = useMotionValue(30);

  const height = 80;
  const baseline = -height * 0.4; // Similar to TransitionSegment logic

  return (
    <>
      {/* Fill area (rendered behind the line) */}
      <MotionCubicBezierFill
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        baseline={baseline}
        color="#4ecdc4"
        opacity={0.5}
        segments={50}
        z={1}
      />
      {/* Line (rendered on top) */}
      <MotionCubicBezierLine
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        color="#4ecdc4"
        lineWidth={1.5}
        segments={50}
        z={2}
      />
    </>
  );
}

// Simulating TransitionSegment Transition render mode
function TransitionModeExample() {
  const startX = useMotionValue(0);
  const startY = useMotionValue(-15);
  const endX = useMotionValue(100);
  const endY = useMotionValue(15);
  const cp1X = useMotionValue(25);
  const cp1Y = useMotionValue(-5);
  const cp2X = useMotionValue(75);
  const cp2Y = useMotionValue(5);

  const height = 80;
  const baseline = -height * 0.4;

  return (
    <>
      {/* Fill area for transition */}
      <MotionCubicBezierFill
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        baseline={baseline}
        color="#f39c12"
        opacity={0.5}
        segments={50}
        z={1}
      />
      {/* Transition line */}
      <MotionCubicBezierLine
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        color="#f39c12"
        lineWidth={1.5}
        segments={50}
        z={2}
      />
    </>
  );
}

// Simulating TransitionSegment Key render mode (no fill)
function KeyModeExample() {
  const startX = useMotionValue(0);
  const startY = useMotionValue(0);
  const endX = useMotionValue(100);
  const endY = useMotionValue(0);
  const cp1X = useMotionValue(50);
  const cp1Y = useMotionValue(0);
  const cp2X = useMotionValue(50);
  const cp2Y = useMotionValue(0);

  return (
    <>
      {/* No fill for Key mode - only line */}
      <MotionCubicBezierLine
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        color="#e74c3c"
        lineWidth={4}
        segments={50}
        z={2}
      />
    </>
  );
}

// Buffer/Pseudo-region example (dashed line, no fill)
function BufferModeExample() {
  const startX = useMotionValue(0);
  const startY = useMotionValue(30);
  const endX = useMotionValue(100);
  const endY = useMotionValue(30);
  const cp1X = useMotionValue(25);
  const cp1Y = useMotionValue(50);
  const cp2X = useMotionValue(75);
  const cp2Y = useMotionValue(10);

  return (
    <>
      {/* No fill for buffer mode */}
      <MotionCubicBezierLine
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        color="#95a5a6"
        lineWidth={1.5}
        opacity={0.5}
        transparent
        dashed
        segments={50}
        z={2}
      />
    </>
  );
}

// Animated transition similar to actual usage
function AnimatedTransitionExample() {
  const startX = useMotionValue(0);
  const startY = useMotionValue(10);
  const endX = useMotionValue(120);
  const endY = useMotionValue(40);
  const cp1X = useMotionValue(30);
  const cp1Y = useMotionValue(20);
  const cp2X = useMotionValue(90);
  const cp2Y = useMotionValue(30);

  const height = 100;
  const baseline = -height * 0.4;

  useEffect(() => {
    let cancelled = false;
    const animateTransition = async () => {
      while (!cancelled) {
        // Animate curve shape
        await Promise.all([
          animate(startY, 50, { duration: 2, type: "spring", stiffness: 300, damping: 30 }),
          animate(endY, 20, { duration: 2, type: "spring", stiffness: 300, damping: 30 }),
          animate(cp1Y, 60, { duration: 2, type: "spring", stiffness: 300, damping: 30 }),
          animate(cp2Y, 10, { duration: 2, type: "spring", stiffness: 300, damping: 30 }),
        ]);

        // Animate back
        await Promise.all([
          animate(startY, 10, { duration: 2, type: "spring", stiffness: 300, damping: 30 }),
          animate(endY, 40, { duration: 2, type: "spring", stiffness: 300, damping: 30 }),
          animate(cp1Y, 20, { duration: 2, type: "spring", stiffness: 300, damping: 30 }),
          animate(cp2Y, 30, { duration: 2, type: "spring", stiffness: 300, damping: 30 }),
        ]);
      }
    };

    void animateTransition();
    return () => {
      cancelled = true;
    };
  }, [startY, endY, cp1Y, cp2Y]);

  return (
    <>
      <MotionCubicBezierFill
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        baseline={baseline}
        color="#9b59b6"
        opacity={0.5}
        segments={50}
        z={1}
      />
      <MotionCubicBezierLine
        start={{ x: startX, y: startY }}
        end={{ x: endX, y: endY }}
        controlPoint1={{ x: cp1X, y: cp1Y }}
        controlPoint2={{ x: cp2X, y: cp2Y }}
        color="#9b59b6"
        lineWidth={1.5}
        segments={50}
        z={2}
      />
    </>
  );
}

// Multiple tracks example
function MultipleTracksExample() {
  // Track 1
  const track1StartX = useMotionValue(0);
  const track1StartY = useMotionValue(60);
  const track1EndX = useMotionValue(120);
  const track1EndY = useMotionValue(60);
  const track1Cp1X = useMotionValue(30);
  const track1Cp1Y = useMotionValue(80);
  const track1Cp2X = useMotionValue(90);
  const track1Cp2Y = useMotionValue(40);

  // Track 2
  const track2StartX = useMotionValue(0);
  const track2StartY = useMotionValue(20);
  const track2EndX = useMotionValue(120);
  const track2EndY = useMotionValue(20);
  const track2Cp1X = useMotionValue(30);
  const track2Cp1Y = useMotionValue(40);
  const track2Cp2X = useMotionValue(90);
  const track2Cp2Y = useMotionValue(0);

  // Track 3
  const track3StartX = useMotionValue(0);
  const track3StartY = useMotionValue(-20);
  const track3EndX = useMotionValue(120);
  const track3EndY = useMotionValue(-20);
  const track3Cp1X = useMotionValue(30);
  const track3Cp1Y = useMotionValue(0);
  const track3Cp2X = useMotionValue(90);
  const track3Cp2Y = useMotionValue(-40);

  const height = 100;
  const baseline = -height * 0.4;

  return (
    <>
      {/* Track 1 - Preview mode */}
      <MotionCubicBezierFill
        start={{ x: track1StartX, y: track1StartY }}
        end={{ x: track1EndX, y: track1EndY }}
        controlPoint1={{ x: track1Cp1X, y: track1Cp1Y }}
        controlPoint2={{ x: track1Cp2X, y: track1Cp2Y }}
        baseline={baseline}
        color="#e74c3c"
        opacity={0.4}
        segments={40}
        z={1}
      />
      <MotionCubicBezierLine
        start={{ x: track1StartX, y: track1StartY }}
        end={{ x: track1EndX, y: track1EndY }}
        controlPoint1={{ x: track1Cp1X, y: track1Cp1Y }}
        controlPoint2={{ x: track1Cp2X, y: track1Cp2Y }}
        color="#e74c3c"
        lineWidth={1.5}
        segments={40}
        z={2}
      />

      {/* Track 2 - Preview mode */}
      <MotionCubicBezierFill
        start={{ x: track2StartX, y: track2StartY }}
        end={{ x: track2EndX, y: track2EndY }}
        controlPoint1={{ x: track2Cp1X, y: track2Cp1Y }}
        controlPoint2={{ x: track2Cp2X, y: track2Cp2Y }}
        baseline={baseline}
        color="#2ecc71"
        opacity={0.4}
        segments={40}
        z={1}
      />
      <MotionCubicBezierLine
        start={{ x: track2StartX, y: track2StartY }}
        end={{ x: track2EndX, y: track2EndY }}
        controlPoint1={{ x: track2Cp1X, y: track2Cp1Y }}
        controlPoint2={{ x: track2Cp2X, y: track2Cp2Y }}
        color="#2ecc71"
        lineWidth={1.5}
        segments={40}
        z={2}
      />

      {/* Track 3 - Key mode (no fill) */}
      <MotionCubicBezierLine
        start={{ x: track3StartX, y: track3StartY }}
        end={{ x: track3EndX, y: track3EndY }}
        controlPoint1={{ x: track3Cp1X, y: track3Cp1Y }}
        controlPoint2={{ x: track3Cp2X, y: track3Cp2Y }}
        color="#3498db"
        lineWidth={4}
        segments={40}
        z={2}
      />
    </>
  );
}

export const PreviewMode: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <PreviewModeExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const TransitionMode: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <TransitionModeExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const KeyMode: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <KeyModeExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const BufferMode: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <BufferModeExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const AnimatedTransition: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <AnimatedTransitionExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const MultipleTracks: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <MultipleTracksExample />
        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[300, 15, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};

export const AllModes: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#1a1a1a" }}>
      <Canvas camera={{ position: [0, 0, 200], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        {/* Top row */}
        <group position={[-120, 80, 0]}>
          <PreviewModeExample />
        </group>

        <group position={[0, 80, 0]}>
          <TransitionModeExample />
        </group>

        <group position={[120, 80, 0]}>
          <KeyModeExample />
        </group>

        {/* Bottom row */}
        <group position={[-120, -80, 0]}>
          <BufferModeExample />
        </group>

        <group position={[0, -80, 0]}>
          <AnimatedTransitionExample />
        </group>

        <group position={[120, -80, 0]}>
          <MultipleTracksExample />
        </group>

        <OrbitControls enablePan enableZoom enableRotate />
        <gridHelper args={[500, 25, "#333", "#333"]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </div>
  ),
};
