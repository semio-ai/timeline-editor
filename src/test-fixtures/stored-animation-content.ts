import {
  StandardTransitionType,
  TransitionDirective,
  TransitionPairing,
} from "../types/data/keypoint";

/** Independent raw documents for storage-boundary tests; no production writer participates. */
export const nanosecondDocument = () => ({
  formatVersion: 3,
  id: "a",
  name: "A",
  defaultViewportExtentNs: 2_345_123_456,
  groups: [{ id: "g", name: "G", children: ["t", { id: "nested", name: "N", children: [] }] }],
  tracks: [
    {
      id: "t",
      name: "T",
      animatableId: "joint",
      inputKey: "speaker/gain",
      groupName: "Joints",
      settings: { color: "red" },
      points: [
        {
          id: "p",
          timeNs: -1,
          value: 0,
          transitions: {
            in: { dtNs: -123, dv: 0.25 },
            out: StandardTransitionType.Sine,
            pairing: TransitionPairing.Paired,
          },
        },
      ],
    },
  ],
});

const invalidAt = (path: (string | number)[], value: unknown, remove = false): unknown => {
  const doc = nanosecondDocument();
  let target = doc as unknown as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) target = target[key] as typeof target;
  const key = path[path.length - 1];
  if (remove) delete target[key];
  else target[key] = value;
  return doc;
};

const required = [
  ["id"],
  ["name"],
  ["groups"],
  ["tracks"],
  ["groups", 0, "id"],
  ["groups", 0, "name"],
  ["groups", 0, "children"],
  ["tracks", 0, "id"],
  ["tracks", 0, "name"],
  ["tracks", 0, "animatableId"],
  ["tracks", 0, "points"],
  ["tracks", 0, "points", 0, "id"],
  ["tracks", 0, "points", 0, "timeNs"],
  ["tracks", 0, "points", 0, "value"],
  ["tracks", 0, "points", 0, "transitions", "in", "dtNs"],
  ["tracks", 0, "points", 0, "transitions", "in", "dv"],
];
export const malformedAnimationCases: [string, unknown][] = required.flatMap((path) => [
  [`missing ${path.join(".")}`, invalidAt(path, undefined, true)],
  [`wrong type for ${path.join(".")}`, invalidAt(path, null)],
]);
const add = (name: string, path: (string | number)[], values: unknown[]) => {
  for (const value of values) {
    const label =
      typeof value === "number" && !Number.isFinite(value)
        ? String(value)
        : (JSON.stringify(value) ?? String(value));
    malformedAnimationCases.push([`${name}: ${label}`, invalidAt(path, value)]);
  }
};
add(
  "unsafe or fractional timeNs",
  ["tracks", 0, "points", 0, "timeNs"],
  [0.5, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, NaN, Infinity, "1"],
);
add(
  "unsafe or fractional dtNs",
  ["tracks", 0, "points", 0, "transitions", "in", "dtNs"],
  [0.5, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, NaN, Infinity, "1"],
);
add(
  "non-finite dv",
  ["tracks", 0, "points", 0, "transitions", "in", "dv"],
  [NaN, Infinity, -Infinity, "1"],
);
add("non-scalar value", ["tracks", 0, "points", 0, "value"], [{ x: 1 }, NaN, Infinity]);
for (const field of ["inputKey", "groupName"])
  add(`invalid ${field}`, ["tracks", 0, field], [1, null]);
add("invalid settings", ["tracks", 0, "settings"], [null, [], "red"]);
add("invalid color", ["tracks", 0, "settings", "color"], [1, null]);
add("invalid transitions", ["tracks", 0, "points", 0, "transitions"], [null, [], 1]);
add("invalid pairing", ["tracks", 0, "points", 0, "transitions", "pairing"], ["unknown", null, 1]);
for (const side of ["in", "out"]) {
  add(
    `invalid ${side} transition`,
    ["tracks", 0, "points", 0, "transitions", side],
    [null, "unknown", 1, {}, { x: 1, y: 2 }, { dtNs: 1, dv: 2, x: 1 }, { dtNs: 1, dv: 2, y: 1 }],
  );
}
add("v3 stamp", ["tracks", 0, "points", 0, "stamp"], [0, undefined]);
add(
  "invalid viewport ns",
  ["defaultViewportExtentNs"],
  [0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1", null],
);
add("invalid nested group", ["groups", 0, "children"], [[null], [{ id: "g", name: "G" }]]);
malformedAnimationCases.push([
  "mixed scalar kinds",
  invalidAt(
    ["tracks", 0, "points"],
    [
      { id: "p", timeNs: 0, value: 1 },
      { id: "q", timeNs: 1, value: true },
    ],
  ),
]);
malformedAnimationCases.push([
  "v2 timeNs",
  {
    ...nanosecondDocument(),
    formatVersion: 2,
    tracks: [
      {
        id: "t",
        name: "T",
        animatableId: "x",
        points: [{ id: "p", stamp: 1, timeNs: 1, value: 0 }],
      },
    ],
  },
]);

export const millisecondDocument = () => ({
  formatVersion: 2 as const,
  id: "v2",
  name: "Every field",
  duration: 7500,
  defaultViewportExtent: 8000,
  groups: [{ id: "g", name: "G", children: ["t"] }],
  tracks: [
    {
      id: "t",
      name: "T",
      animatableId: "joint",
      inputKey: "speaker/gain",
      groupName: "Joints",
      settings: { color: "red" },
      points: [
        {
          id: "handle",
          stamp: -250,
          value: 0,
          transitions: {
            in: { x: -12.123456789, y: 0.5 },
            out: { x: 11.987654321, y: -2 },
            pairing: TransitionPairing.Paired,
          },
        },
        ...[...Object.values(StandardTransitionType), ...Object.values(TransitionDirective)].map(
          (kind, index) => ({
            id: kind,
            stamp: (index + 1) * 100,
            value: index,
            transitions: { in: kind, out: kind, pairing: TransitionPairing.Free },
          }),
        ),
      ],
    },
  ],
});

for (const formatVersion of [undefined, 1, 2, 3]) {
  const content = formatVersion === 3 ? nanosecondDocument() : millisecondDocument();
  malformedAnimationCases.push([
    `duplicate track id in format ${formatVersion ?? "absent"}`,
    {
      ...content,
      formatVersion,
      tracks: [...content.tracks, { ...content.tracks[0], name: "Another track" }],
    },
  ]);
}

for (const formatVersion of [undefined, 1, 2]) {
  const content = millisecondDocument();
  for (const inputKey of [1, null]) {
    malformedAnimationCases.push([
      `invalid inputKey in format ${formatVersion ?? "absent"}: ${JSON.stringify(inputKey)}`,
      {
        ...content,
        formatVersion,
        tracks: [{ ...content.tracks[0], inputKey }],
      },
    ]);
  }
  const withPoint = (point: unknown) => ({
    ...millisecondDocument(),
    formatVersion,
    tracks: [{ ...millisecondDocument().tracks[0], points: [point] }],
  });
  for (const point of [
    { id: "p", stamp: 0 },
    { id: "p", stamp: 0, value: undefined },
  ]) {
    malformedAnimationCases.push([
      `missing legacy value in format ${formatVersion ?? "absent"}: ${"value" in point ? "undefined" : "absent"}`,
      withPoint(point),
    ]);
  }
  for (const side of ["in", "out"]) {
    for (const transition of [
      { dtNs: 1, dv: 2 },
      { x: 1, y: 2, dtNs: 1, dv: 2 },
      { x: 1 },
      { y: 2 },
      { x: Infinity, y: 2 },
      { x: 1, y: NaN },
      { x: "1", y: 2 },
      {},
      [],
      1,
      "unknown",
    ]) {
      malformedAnimationCases.push([
        `invalid legacy ${side} in format ${formatVersion ?? "absent"}: ${JSON.stringify(transition)}`,
        withPoint({ id: "p", stamp: 0, value: 1, transitions: { [side]: transition } }),
      ]);
    }
  }
}

/** Legacy metadata and composite values are retained without imposing format-3 schemas. */
export const legacyCompatibilityCases = [undefined, 1, 2].flatMap((formatVersion) =>
  [
    { x: 1, y: 2 },
    { x: 1, y: 2, z: 3 },
    { r: 0.1, p: 0.2, y: 0.3 },
    { h: 10, s: 0.5, l: 0.5 },
    null,
  ].flatMap((value) =>
    [undefined, null, {}, { in: null, out: null, pairing: "custom" }].map((transitions) => ({
      ...millisecondDocument(),
      formatVersion,
      duration: null,
      tracks: [
        {
          ...millisecondDocument().tracks[0],
          inputKey: undefined,
          settings: { color: null },
          points: [{ id: "p", stamp: 0.5, value, transitions }],
        },
      ],
    })),
  ),
);
