# References

This folder holds the source material this project was recreated from:
the original workflow definition, exported as JSON.

- `n8n-1951-scrape-and-summarize-webpages-with-ai.json`
  — the original workflow (id 1951, 16 nodes): a manual trigger that
  fetches the Paul Graham articles list, extracts the essay links,
  limits to the first 3, fetches each essay, extracts the text, loads it
  through a Recursive Character Text Splitter (chunk size 6000) into a
  Summarization Chain (GPT-4o-mini, documentLoader mode), then cleans
  up each result (title + summary + URL) and merges them.

The JSON is a reference only. The bot in this repository is an original
Gramstax implementation — it does not use, depend on, or connect to the
original workflow tool.
