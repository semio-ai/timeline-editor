/**
 * React Three Fiber JSX type augmentation for React 19.
 *
 * R3F v9 exports ThreeElements (mesh, group, boxGeometry, etc.) but does not
 * automatically register them in React's JSX.IntrinsicElements. In React 18
 * this was handled via the global JSX namespace, but React 19 moved
 * IntrinsicElements under React.JSX. This declaration merges ThreeElements
 * into React.JSX.IntrinsicElements so that TSX files can use Three.js
 * elements (e.g. <mesh>, <group>) without type errors.
 *
 * Each package that consumes R3F components needs its own copy because
 * TypeScript declaration merging is scoped to the compilation unit.
 */
import { ThreeElements } from "@react-three/fiber";

declare global {
  namespace React {
    namespace JSX {
      // eslint-disable-next-line @typescript-eslint/no-empty-interface -- global augmentation requires empty interface body
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}
