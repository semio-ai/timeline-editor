export interface Control {
  // @prop id: string - a unique identifier for the control.
  id: string;
  // @prop readId: string - the id of the animatable that this control reads from.
  readId: string;
  // @prop writeId: string - the id of the track that this control writes to.
  writeId: string;
  // @prop settings: object - the settings for the control.
  settings: {
    color?: string;
  };
}

export interface Graph {
  id: string;
  name: string;
  nodes: string[];
  instances: Record<string, null>;
}

export interface StoredGraph extends Omit<Graph, "instances" | "nodes"> {
  nodes: ProcessNode[];
  controls: Control[];
}

export interface ProcessNode {
  id: string;
  inId: string;
  outId: string;
  type: ProcessType.Identity;
}

export enum ProcessType {
  Identity = "identity",
}
