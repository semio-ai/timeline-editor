import { ThreeElements } from "@react-three/fiber";

declare global {
  namespace React {
    namespace JSX {
      // eslint-disable-next-line @typescript-eslint/no-empty-interface -- global augmentation requires empty interface body
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}
