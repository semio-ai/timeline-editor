import { Instances } from "@react-three/drei";
import { useColors } from "../../../hooks";
import { useData } from "./data-context";
import { DataPoint } from "./data-point";
import { TrackBackground } from "./track-background";

export function DataPointsRenderer({
  height = 36,
  tracks = [],
  offset = 0,
  emphasis = false,
  onEmphasisChange = () => {},
}: {
  height?: number;
  tracks?: string[];
  offset?: number;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}) {
  const color = useColors(tracks);
  const allData = useData();

  if (emphasis) {
    console.log("emphasis", tracks);
  }

  return (
    <group
      position={[0, offset, 0]}
      onPointerEnter={() => onEmphasisChange(true)}
      onPointerLeave={() => onEmphasisChange(false)}
    >
      <Instances limit={1000} range={allData.length}>
        {/* Shared geometry and material for all instances */}
        <cylinderGeometry args={[5, 5, 1, 6]} />
        <meshBasicMaterial toneMapped={false} />

        {/* Individual instances */}
        {allData.map((point) => (
          <DataPoint key={point.id} id={point.id} x={point.x} y={point.y} color={color} />
        ))}
      </Instances>
      {tracks.length > 0 && <TrackBackground color={color} height={height} emphasis={emphasis} />}
    </group>
  );
}
