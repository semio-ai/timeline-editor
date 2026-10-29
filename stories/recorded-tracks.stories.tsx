import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, type ReactNode } from "react";
import { Recorder, type RecordedTrack } from "@semio/animation";
import { Text, TextRole } from "@semio/ui";
import type { AroraValue, StateChange } from "@semio/data";
import capture from "./fixtures/recorded-entity-devices.json";

/**
 * One entity bound to two devices, an emulated device in the World and a real
 * `arora` device over a Studio Bridge session, given the same direct writes:
 * a sine on one joint's target, one write per 50 ms frame. The drains are the
 * World's, captured by `packages/studio-arora/tests/e2e/record-entity-devices.mjs`
 * against a local router and the device runner; the story replays them into a
 * `Recorder`, as `startRecording` feeds one, and draws each device's input
 * (`k.target_position`, what reached it) and feedback (`k.position`, what it
 * did) on that device's own clock.
 */
const meta = {
  title: "animation/RecordedTracks",
  component: RecordedDevices,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RecordedDevices>;

export default meta;
type Story = StoryObj<typeof meta>;

interface Capture {
  devices: { emulated: string; real: string };
  key: string;
  drains: [key: string, value: AroraValue | null][][];
}

/** The captured drains, replayed into one recorder of both devices' input and feedback. */
function record({ devices, key, drains }: Capture): RecordedTrack[] {
  const recorder = new Recorder(
    [devices.emulated, devices.real].flatMap((device) => [
      { device, key: `${key}.target_position` },
      { device, key: `${key}.position` },
    ]),
  );
  for (const drain of drains) {
    const change: StateChange = { set: new Map(), unset: new Set() };
    for (const [storeKey, value] of drain) {
      if (value === null) (change.unset as Set<string>).add(storeKey);
      else (change.set as Map<string, AroraValue>).set(storeKey, value);
    }
    recorder.capture(change);
  }
  return recorder.tracks();
}

const WIDTH = 640;
const HEIGHT = 180;
const PADDING = 12;

/** A number track as a step line: each value holds until the next point. */
function stepPath(
  track: RecordedTrack,
  x: (stamp: number) => number,
  y: (value: number) => number,
): string {
  return track.points
    .map(({ stamp, value }, i) => {
      const [px, py] = [x(stamp).toFixed(1), y(value as number).toFixed(1)];
      return i === 0 ? `M${px},${py}` : `H${px}V${py}`;
    })
    .join("");
}

function DeviceChart({
  title,
  input,
  feedback,
}: {
  title: string;
  input: RecordedTrack;
  feedback: RecordedTrack;
}): ReactNode {
  const stamps = [...input.points, ...feedback.points].map(({ stamp }) => stamp);
  const start = Math.min(...stamps);
  const end = Math.max(...stamps);
  const x = (stamp: number) =>
    PADDING + ((stamp - start) / Math.max(end - start, 1)) * (WIDTH - 2 * PADDING);
  const y = (value: number) => HEIGHT / 2 - value * (HEIGHT / 2 - PADDING);
  return (
    <figure style={{ margin: "0 0 24px" }} data-testid={`device-${input.device}`}>
      <Text role={TextRole.Label}>{title}</Text>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${title}: input and feedback of ${input.key.split(".")[0]}`}
      >
        <line
          x1={PADDING}
          x2={WIDTH - PADDING}
          y1={HEIGHT / 2}
          y2={HEIGHT / 2}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
        <path
          d={stepPath(input, x, y)}
          fill="none"
          stroke="#4f7cff"
          strokeWidth={4}
          strokeOpacity={0.45}
          data-testid="input"
        />
        <path
          d={stepPath(feedback, x, y)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          data-testid="feedback"
        />
      </svg>
      <figcaption>
        <Text role={TextRole.Note}>
          {input.key} (wide, blue): {input.points.length} points; {feedback.key} (thin):{" "}
          {feedback.points.length} points; {((end - start) / 1000).toFixed(2)} s of the
          device&apos;s clock, from {(start / 1000).toFixed(3)} s.
        </Text>
      </figcaption>
    </figure>
  );
}

function RecordedDevices(): ReactNode {
  const tracks = useMemo(() => record(capture as unknown as Capture), []);
  const [simInput, simFeedback, realInput, realFeedback] = tracks;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <DeviceChart title="Emulated device" input={simInput} feedback={simFeedback} />
      <DeviceChart title="Real device" input={realInput} feedback={realFeedback} />
    </div>
  );
}

/** Both devices' recorded input and feedback, each on its own device's clock. */
export const EmulatedAndRealDevice: Story = {};
