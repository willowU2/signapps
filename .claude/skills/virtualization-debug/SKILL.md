---
name: virtualization-debug
description: Use when a virtualized list (chat, mail, storage list mode, notifications popover) exhibits scroll jump, misaligned items, wrong aria-rowcount, screen-reader not announcing, or `useVirtualizer` crashes. Covers `estimateSize` tuning, scroll-to-bottom UX, a11y contract, and the table-layout incompatibility.
---

# virtualization-debug

## Architecture

`client/src/components/common/virtual-list.tsx` wraps `@tanstack/react-virtual`. Applied during P3 Wave X to:
- Chat messages (`chat-window.tsx` — flattened VirtualRow union for date separators + messages).
- Mail inbox (`components/mail/mail-list.tsx`).
- Storage files (`storage-file-grid.tsx`, list mode only — grid and tree modes retain CSS grid/tree).
- Notifications popover (`notification-center.tsx`, above 30 items).

Contract:
- Container: `role="list"`, `aria-rowcount={items.length}`.
- Items: `role="listitem"`, `aria-rowindex={index + 1}`.
- `contain: strict` on container.

## Known incompatibility

**Do NOT wrap `<table>`/`<TableBody>` iterations in `<VirtualList>`.** The wrapper inserts `<div role="list"><div role="listitem">` which is semantically incompatible inside a table. Contacts (`contacts-list-client.tsx` 2146 LoC) and NotificationHistory use full `<Table>` layouts and were intentionally skipped. A future table→flex refactor is needed to unblock.

## Common issues

- **Scroll jump on resize**: `estimateSize` too far from reality. Tune to observed average.
- **Items overlap**: CSS on the item sets `position: relative`. Remove it — absolute positioning is applied by the wrapper.
- **Chat auto-scroll breaks**: verify `onScroll` callback passed to VirtualList, and `scrollToBottom={atBottom && !activeThreadMsgId}` flips correctly.
- **Screen reader silent**: if outer component overrides `role`, use `role="feed"` if appropriate.

## Commands

```bash
rtk grep "<VirtualList" client/src/components
rtk grep "aria-rowcount\|aria-rowindex" client/src/components/common/virtual-list.tsx
```

## Related

- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-p3-polish-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p3-polish.md`
- TanStack Virtual: https://tanstack.com/virtual/latest
