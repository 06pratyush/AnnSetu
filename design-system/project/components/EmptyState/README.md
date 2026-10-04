# EmptyState

EmptyState fills every list that has nothing in it yet: an icon, what's missing, one line of help, and one action.

**Provide** a lucide `icon`, `title`, optional `body` and `action`. Never leave a blank area where a list would be.

## Props

```ts
export interface EmptyStateProps { icon: React.ComponentType<{ className?: string }>; title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode }
```
