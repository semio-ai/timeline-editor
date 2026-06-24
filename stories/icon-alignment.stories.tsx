import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContextMenu, Icon, IconProvider, KeyIcon, NestedItem, NestedLabel, NestedSeparator } from "@semio/ui";
import { animationIconRegistry } from "@semio/animation";

/**
 * Sandbox for icon alignment/size consistency inside list-item (`NestedItem`) `left`
 * slots — reproduces the animation track context menu, which mixes icon sets:
 *  - Solar (via animation registry): `color-picker`, `delete`, `cut`, `copy`, `paste`
 *  - Semio-vendored Solar (default registry): `eye-off`, `speaker-off`, `lock`
 *  - Semio native / Tabler: `playback-skip-forward`, `chevron-right`, `KeyIcon`
 *
 * All of these should render the SAME size and be horizontally/vertically aligned in the
 * left rail, regardless of which set they come from. Use this to verify slot/icon sizing
 * instead of round-tripping through Studio.
 */
const meta: Meta = {
  title: "ui/IconAlignment",
  decorators: [
    (Story) => (
      // Compose the animation registry over the default, mirroring the studio app.
      <IconProvider registry={animationIconRegistry}>
        <div className="grid h-full place-items-center p-6">
          <Story />
        </div>
      </IconProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj;

/** The rows that go inside the menu — a deliberate mix of icon sources. */
function MixedIconMenu() {
  return (
    <>
      <NestedLabel>Track Group</NestedLabel>
      <NestedItem left={<Icon name="color-picker" />}>Change Color</NestedItem>
      <NestedItem left={<Icon name="eye-off" />}>Hide All</NestedItem>
      <NestedItem left={<Icon name="speaker-off" />}>Mute All</NestedItem>
      <NestedItem left={<Icon name="lock" />}>Lock All</NestedItem>
      <NestedItem left={<Icon name="delete" />}>Remove Group</NestedItem>
      <NestedSeparator />
      <NestedLabel>Keys</NestedLabel>
      <NestedItem left={<KeyIcon center="plus" fillOpacity={0} />}>Add Keyframe</NestedItem>
      <NestedItem left={<KeyIcon center="minus" fillOpacity={0} />}>Remove Keyframe</NestedItem>
      <NestedSeparator />
      <NestedLabel>Navigate</NestedLabel>
      <NestedItem left={<Icon name="playback-skip-back" />}>Previous Keyframe</NestedItem>
      <NestedItem left={<Icon name="playback-skip-forward" />}>Next Keyframe</NestedItem>
      <NestedSeparator />
      <NestedLabel>Edit</NestedLabel>
      <NestedItem left={<Icon name="cut" />}>Cut</NestedItem>
      <NestedItem left={<Icon name="copy" />}>Copy</NestedItem>
      <NestedItem left={<Icon name="paste" />}>Paste</NestedItem>
      <NestedItem left={<Icon name="chevron-right" />}>Submenu (Tabler)</NestedItem>
    </>
  );
}

/**
 * Right-click the card to open the menu and inspect the left icon rail. Every icon
 * should sit at the same size and the same x-offset.
 */
export const TrackMenu: Story = {
  render: () => (
    <ContextMenu content={<MixedIconMenu />}>
      <div className="card grid h-40 w-80 place-items-center p-5 variant-static-text">
        Right-click for the mixed-icon menu
      </div>
    </ContextMenu>
  ),
};
