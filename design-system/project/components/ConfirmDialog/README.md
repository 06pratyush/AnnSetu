# ConfirmDialog

ConfirmDialog asks before anything destructive or hard to undo: rejecting or cancelling an order, archiving a listing.

The title is the question ("Reject this order?"), the body says the consequence ("the reserved stock goes back on sale"), the confirm button repeats the verb, and the cancel button keeps things as they are ("Keep order"). For other dialogs, `DialogContent` is a bottom sheet on phones and centered on desktop.

## Props

```ts
export interface ConfirmDialogProps {
  open: boolean; onOpenChange(open: boolean): void;
  title: React.ReactNode; body?: React.ReactNode;
  confirmLabel: string; cancelLabel: string;
  tone?: "danger" | "primary"; loading?: boolean;
  onConfirm(): void;
}
```
