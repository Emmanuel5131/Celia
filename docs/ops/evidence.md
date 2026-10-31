# Evidence files on IPFS

Staff add evidence to a case beside the platform's statements: off chain (video, picture, document, link) and on chain (wallet,
transaction). Files go to IPFS through Pinata. Nothing of a file is stored in our database: only its CID.

## How an upload works

1. The browser asks the server (`startEvidenceUpload`, staff only) for a one-minute Pinata upload address. It only accepts PNG, JPEG,
   WebP, MP4, WebM and PDF, up to 50 MB.
2. The browser sends the file straight to Pinata. It never passes through our server.
3. The form sends Pinata's file id. The server reads the file back from Pinata (`getPinnedFile`) and keeps the CID, size and type
   Pinata reports, not what the browser says. A wrong type or size is unpinned and refused.
4. Removing the evidence deletes the row and unpins the file. Copies others took cannot be recalled.

## Setup

Set `PINATA_JWT` in `.env.local` or the host's secret store, never in a tracked env file (`EnvFiles.test.ts` refuses it). Optionally
set `PINATA_GATEWAY` to a dedicated gateway host; without it files open through `gateway.pinata.cloud`. Without the JWT, uploads show
"File uploads are not set up".

## Rules

- Public material only. A pinned file is public and permanent; a claimant's own screenshots and videos are private and never go in.
- Staff tick that the material is public and lawful to show. The audit records the type and CID, never the title.
- File evidence is reviewed by staff. Only statements and the chain go to the Sandworm notebook.
