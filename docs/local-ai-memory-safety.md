# Local AI, Memory, and Safety

Last updated: 26 August 2026

## AI provider modes

Q offers two user-selectable inference modes:

| Mode | Processing location | Network behavior | Requirement |
| --- | --- | --- | --- |
| Private local AI | User's browser through WebLLM | Downloads model assets on first use; prompts are not sent to Q's AI server | WebGPU and sufficient device storage/memory |
| Hosted AI | Q Express server and configured OpenAI API | Sends PII-masked prompt context to `/api/q-ai/chat` | `OPENAI_API_KEY` |

Private local AI is the default. Q does not silently fall back to hosted AI when WebGPU is unavailable; the user must select hosted mode.

The current local model is `Llama-3.2-1B-Instruct-q4f16_1-MLC`. Its assets are cached by WebLLM after the initial download. Browser eviction policies may remove that cache, requiring another download.

## Memory flow

Memory is used only when `Allow Q context memory` is enabled.

1. User-authored context is stored in the Supabase `memory_entries` table.
2. RLS restricts every operation to `auth.uid() = user_id`.
3. The browser fetches that signed-in user's memories and ranks recent entries by query-term relevance.
4. A bounded set is inserted into the model prompt as untrusted factual context.
5. Assistant responses are not automatically written back as facts, preventing generated text from recursively becoming user memory.

This relevance step is currently lexical. The existing pgvector-backed vetted-knowledge search remains a separate hosted service and is used only in hosted mode.

## Crisis handling

Crisis detection runs before both WebLLM and hosted inference. When triggered, Q displays the static country-specific crisis directory immediately. The directory is bundled with the client so it remains available when the network or AI provider is unavailable.

Country selection follows this order:

1. supported two-letter country code from user settings;
2. browser locale region, processed locally;
3. international directory fallback.

No IP-geolocation request is made. Users can manually change the country in the crisis modal. Helpline availability can change, so entries should be reviewed regularly by the product owner.

## Discreet Notes mode

- **Discreet Notes:** the single visible safety control immediately replaces Q with a functional neutral notes interface. The Alt+M shortcut provides the same transition.
- **Cross-tab exit:** uses `BroadcastChannel`, with a `storage` event fallback, to redirect other Q tabs.
- **Navigation:** `window.location.replace()` opens a neutral destination without retaining the current Q entry as the immediately previous history item.
- **Session purge:** clears session storage, temporary Q keys, and Supabase browser auth tokens before redirecting.
- **Camouflage:** `Alt+M` masks Q as an editable notes application and persists across refreshes.
- **Protected reveal:** four quick clicks on the QuickNotes icon reveal an unlock prompt when an app PIN is configured.
- **Media and notifications:** entering camouflage pauses/mutes current media and sends a state message to registered service workers so notification implementations can suppress sensitive content.

Browser history predating the current entry, operating-system logs, DNS/network records, downloaded model files, and browser-managed caches are not erased by entering Notes mode.

## Local deletion

`Wipe Local Cache & Logs` deletes local profile memory, journals, chat history, mood logs, and session storage after confirmation. It preserves device security settings and does not delete cloud records from Supabase. Cloud memory entries can be removed through the memory controls.

## Deployment checklist

1. Apply all Supabase migrations, particularly `20260801000000_privacy_rls.sql`.
2. Confirm RLS is enabled on `memory_entries`, `journal_entries`, `daily_mood_logs`, and `chat_messages`.
3. Serve the application over HTTPS; WebGPU availability is browser- and secure-context-dependent.
4. Keep `OPENAI_API_KEY` server-side and omit it entirely for a local-only deployment.
5. Test first-load model progress, cached offline generation, unsupported-WebGPU messaging, and explicit hosted selection.
6. Test crisis interception with the hosted API unavailable.
7. Test Notes mode and its discreet return control on mobile and desktop.
