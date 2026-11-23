# Fieldwork captioned demo

The current demo is a silent, captioned screen recording: `outputs/walkthrough/fieldwork-full-demo.mp4`. There is no generated narration or audio track.

It shows a shopper signing in, buying a product with simulated payment, viewing analytics, asking a product-revenue question, inspecting returned query evidence, comparing control A with variant B, checking independent PostHog results, reviewing the funnel and guardrails, asking experiment and full-readout questions, editing a readout draft, and downloading an editable PowerPoint. The final chapter previews slides rendered from that actual downloaded file.

The footage is recorded in the local development preview using the configured live Supabase, PostHog and OpenAI connections. It is not footage of the hosted browser session. This provenance is labeled throughout. Customers and payments are fictional. The 2,000-visitor fixture has a planted effect and is explicitly labeled synthetic. The checkout saves an actual demo order. Long AI and slide-rendering waits are omitted between scenes; model answers and query results are never substituted.

## Actual AI questions

- Which products generate the most revenue? Use product evidence, state the dataset and date window, and give a concise explanation under 120 words.
- Does the evidence justify shipping variant B? Use experiment and source-reconciliation evidence. Explain the conversion difference and synthetic-data limitation in under 150 words.
- Draft a full experiment readout covering hypothesis, control A versus variant B, primary result, guardrails, source agreement, uncertainty, limitations, recommendation and next steps. Use experiment evidence. Keep it under 180 words.

The recorder requires successful `agent` responses, `answer_source: model`, and nonempty query evidence. Responses are saved under ignored `outputs/walkthrough/ai-evidence.json`. Keys, cookies and billing screens are excluded.

## PowerPoint and human review

In the analytics workspace, open Experiments, run an investigation, then choose **Create readout**. The draft retains the selected source, query time, date window, data and evidence. Edit its narrative, reviewer, follow-up owner and decision. Drafts are saved in the current browser; refreshing analytics does not replace them. Choose **New draft from current data** to explicitly rebuild a draft from fresh results.

**Download editable PowerPoint** creates a native `.pptx` with editable text, tables and charts (including embedded chart workbooks). Control and variant screenshots are source images. Full source queries and returned aggregates are included in speaker notes. **Download evidence JSON** retains the machine-readable snapshot, narrative and attached model responses. Both remain drafts for human review; editing a deck never updates the database.

## Reproduce

1. Configure the ignored server `.env`, run `npm run configure`, then start `npm run dev:store` and `npm run dev:analytics`.
2. Provide `playwright-core`, its FFmpeg recording helper, and Google Chrome. Set `PLAYWRIGHT_MODULE_PATH` or install the module normally. `CHROME_PATH`, `DEMO_STORE_URL` and `DEMO_ANALYTICS_URL` are optional overrides.
3. Provide Python `imageio-ffmpeg`, `Pillow` and `PyMuPDF`, plus LibreOffice for preview rendering. Set `DEMO_PYTHON_PATH` if these modules live in a separate Python package directory.
4. Run `node docs/demo/record-demo.mjs`. The supported starter local sign-in is used; production cookies are not extracted. Funded OpenAI access is required.
5. Run `python3 docs/demo/export-demo.py`. This exports a captioned 1080p H.264 MP4, WebVTT captions and chapter metadata with no audio stream.
6. Decode the full video, inspect representative frames and all rendered slides, and verify native editable PPTX objects before sharing.

Large recordings, downloaded decks, evidence and render intermediates stay under ignored `outputs/`. The earlier `prepare-narration.py` and `chapters.json` are legacy narration assets and are not used by the current export.
