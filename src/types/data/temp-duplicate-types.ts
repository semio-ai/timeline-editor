/**
 * Control
 * Links the animatable to the track.
 * @param id - a unique identifier for the control.
 * @param readId - the id of the animatable that this control reads from.
 * @param writeId - the id of the track that this control writes to.
 * @param settings - the settings for the control.
 */
export interface Control {
  id: string;
  readId: string;
  writeId: string;
  settings: {
    color?: string;
  };
}

/**
 * Graph
 * A collection of nodes that are connected together to form a process graph.
 * @param id - a unique identifier for the graph.
 * @param name - the name of the graph, defined by the user.
 * @param nodes - a collection of node ids that exist in this graph.
 * @param instances - a collection of instance ids that exist in this graph, creating a set of namespaces.
 */
export interface Graph {
  id: string;
  name: string;
  nodes: string[];
  instances: Record<string, null>;
}

/**
 * StoredGraph
 * A collection of nodes that are connected together to form a process graph, reconfigured for storage.
 * @param id - a unique identifier for the graph.
 * @param name - the name of the graph, defined by the user.
 * @param nodes - a collection of node objects that exist in this graph.
 * @param controls - a collection of control objects that exist in this graph.
 */
export interface StoredGraph extends Omit<Graph, "instances" | "nodes"> {
  nodes: ProcessNode[];
  controls: Control[];
}

/**
 * ProcessNode
 * A node in the process graph that represents a process.
 * @param id - a unique identifier for the node.
 * @param inId - the id of the input node.
 * @param outId - the id of the output node.
 * @param type - the type of process ({@link ProcessType}).
 */
export interface ProcessNode {
  id: string;
  inId: string;
  outId: string;
  type: ProcessType.Identity;
}

/**
ProcessType
The type of process that the node represents.
@param Identity - a process that does nothing to the input and returns it as the output.
*/
export enum ProcessType {
  Identity = "identity",
}
