## Goal

Aapki nayi website pe URL `/play.php?batch_id=...&video_url=...&...` open karne pe **wahi lecture play ho** jo vidcloud.eu.org pe hota hai — same query params, same content.

## Approach: Iframe embed (recommended)

Maine vidcloud ka player script (`video-script.js`) inspect kiya — pura heavily obfuscated hai aur DRM/ClearKey endpoints runtime pe encoded strings se derive hote hain. Us logic ko reverse-engineer karke apna player banana practical nahi hai (weeks ka kaam, aur unke script update karte hi tootega).

**Simple, reliable solution:** Naya `/play.php` route banao jo poore query string ko as-is `https://vidcloud.eu.org/play.php?...` ko forward kare ek full-screen iframe me. URL bilkul same rahega, player bilkul same chalega (kyunki actually vidcloud hi serve kar raha hai), aur jab bhi vidcloud update karega — apne aap kaam karega.

### Kya banega

1. **Route file** `src/routes/play.php.tsx` (TanStack file-routing me `[.]` escape zaroori):
   - Actual filename: `src/routes/play[.]php.tsx` → URL `/play.php`
   - `validateSearch` se saare query params (batch_id, subject_id, topic_id, video_id, video_url, video_name, video_img, video_type, play_type) pass-through
   - Component ek full-viewport `<iframe>` render karega jiska `src` = `https://vidcloud.eu.org/play.php?<same querystring>`
   - `allow="autoplay; fullscreen; encrypted-media; picture-in-picture"` (DRM ke liye `encrypted-media` critical)
   - `allowFullScreen` on
   - Mobile-friendly: `100dvh` height, no borders/margins
   - `head()` me minimal title (video_name se) aur `viewport` tags

2. **Home route** cleanup: current `src/routes/index.tsx` placeholder ko simple message se replace (e.g. "Player available at /play.php?...") — sirf ek line, main focus player pe.

### Test URL

Aapka diya hua exact URL naye site pe kaam karega:
```
https://<your-site>/play.php?batch_id=69bf9743a9f56b6c48c24ecc&subject_id=...&video_url=...
```

## Limitations (honest)

- **Ye technically vidcloud ka player embed karta hai**, apna standalone nahi. Agar vidcloud kabhi iframe-embedding block kare (X-Frame-Options / CSP `frame-ancestors`) to iframe blank aayega. Abhi unke response headers me aisa koi restriction nahi hai — check kiya.
- Video content, DRM decryption, aur bandwidth sab vidcloud ke server se hi serve hoga. Aap sirf UI wrapper de rahe ho.
- Agar aap **truly independent player** chahte ho (vidcloud offline ho tab bhi chale), to unke DRM key API ko reverse-engineer karna padega — obfuscated script decode karne me kaafi effort lagega aur guarantee nahi ki chalega. Ye alag/badi task hogi.

## Files touched

- `src/routes/play[.]php.tsx` — new (iframe player route)
- `src/routes/index.tsx` — small edit (remove placeholder)
- `src/routes/__root.tsx` — update default title/description ("Video Player")
