# PhotoUploader

PhotoUploader adds up to four listing photos from the camera or gallery, previews them 4:3, and lets each be removed.

Photos are shrunk on the device to about 150 KB WebP before upload, so listings load on 3G and the free storage lasts. **Provide** `items` and `onChange`; the parent uploads files on save.

## Props

```ts
export interface PhotoItem { key: string; url: string; file?: File }
export interface PhotoUploaderProps { items: PhotoItem[]; onChange(items: PhotoItem[]): void; max?: number; disabled?: boolean }
```
