import { ActionIcon, Group, Stack } from "@mantine/core";
import { type ReactNode } from "react";
import { IconCaretUpFilled, IconSettings } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { ParentSize } from "@visx/responsive";
import { Scrubber } from "./scrubber";
import { Editor } from "./editor";
import { Controls } from "./controls";

export function Sheet(): ReactNode {
  const [editorOpened, { toggle: openEditorToggle }] = useDisclosure();

  return (
    <Stack
      gap={0}
      style={{
        flex: 1,
        paddingTop: 0,
      }}
    >
      <div
        role="button"
        // ref={timelineBox}
        style={{
          display: "flex",
          justifyItems: "center",
          flex: 1,
          cursor: "pointer",
          // backgroundColor: alpha("var(--mantine-color-gray-6)", 0.25),
          // overflow: "hidden",
          padding: 0,
        }}
      >
        <ParentSize debounceTime={10}>
          {({ width }) => (
            <Stack gap={0}>
              <Editor opened={editorOpened} width={width} />
              <Group gap={0} justify="space-between">
                <ActionIcon
                  // disabled
                  color="grey"
                  onClick={openEditorToggle}
                  size="sm"
                  variant="transparent"
                >
                  <IconCaretUpFilled size={14} />
                </ActionIcon>

                <div
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <Scrubber editorOpened={editorOpened} width={width - 50} />
                </div>

                <ActionIcon size="sm" variant="transparent" color="grey">
                  <IconSettings size={14} />
                </ActionIcon>
              </Group>
            </Stack>
          )}
        </ParentSize>
      </div>
      <Controls />
    </Stack>
  );
}
