# Migration Tracking: Stored Animation Normalization

Date: 2026-01-28

## Goal
- Introduce a dedicated `migrateAnimationData` utility that converts legacy stored animations
  (complex animatables + composite tracks) into the current scalar + grouped form.
- Require migration before data is set into the animation store, instead of normalizing
  inside store actions.

## Status
- [x] Tracking document created.
- [x] Migration utility implemented.
- [x] Store/actions updated to expect migrated data.
- [x] Fixtures/tests updated to use migration utility.
- [x] TypeScript + lint checks run for @semio/animation.

## Notes
- Group IDs for derived animatables should be deterministic and based on the base animatable id.
- Group metadata in animatables is used for initialization; track grouping may diverge later.
