# RoleChoiceCards

RoleChoiceCards is the sign-up choice between Farmer, Individual buyer and Industrial buyer: three large radio cards.

Each card scopes `data-role` to its side, so the farmer card selects in khet green and the buyer cards in neel indigo. That way the color of the side is learned at the very first screen.

**Provide** `value` and `onChange`. Wrap in a fieldset with a visible legend ("I am a…").

## Props

```ts
export type AccountChoice = "farmer" | "individual" | "industrial";
export interface RoleChoiceCardsProps { value: AccountChoice | null; onChange(v: AccountChoice): void; className?: string; name?: string }
```
