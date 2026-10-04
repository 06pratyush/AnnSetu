# LanguageToggle

LanguageToggle switches the whole interface between English and Hindi. Each option is labelled in its own language (EN, हिं) so a reader can always find theirs.

It lives in every header. The choice is remembered on the device and, when signed in, saved to the profile. The `html` element's `lang` follows it, so Hindi gets its Devanagari line height and no letter-spacing.

## Props

```ts
export interface LanguageToggleProps { className?: string; onChange?(lang: "en" | "hi"): void }
```
