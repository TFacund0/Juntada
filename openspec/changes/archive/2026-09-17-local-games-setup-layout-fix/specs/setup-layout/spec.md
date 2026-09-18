# Spec: Local Games Setup Layout

## Scope

Clean layout hierarchy and responsive containment for player roster setup and configuration screens across local game modes.

## Requirements

1. **No Nested Cards**: `AddPlayerForm` contains its own `T.card`. It MUST NOT be rendered as a child of another `T.card` element.
2. **Flex Containment**: Any flex container with an input or text block alongside action buttons MUST apply `min-w-0` to the expanding child so that content shrinks gracefully rather than forcing the container or card to overflow horizontally on small screens.
3. **Consistent Spacing**: Sibling cards in local setup screens maintain standard `mb-3.5` separation without margin collision.
