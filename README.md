# @just-every/web-search

Web search utility for the MAGI system. Provides a unified interface for searching the web using various search engines including Brave, Anthropic, OpenAI, Google, Perplexity, and X.AI.

## Installation

```bash
npm install @just-every/web-search
```

## Usage

### As a library

```typescript
import { web_search } from '@just-every/web-search';

// Basic usage (backward compatible)
const results = await web_search('brave', 'your search query', 5);

// With agent tracking (for MAGI system)
const results = await web_search('agent-id', 'brave', 'your search query', 5);
```

### CLI Usage

```bash
# Install globally
npm install -g @just-every/web-search

# Search with Brave (default)
web-search "your search query"

# Use a specific engine
web-search "your search query" -e anthropic

# Get more results
web-search "your search query" -n 10

# Output raw JSON
web-search "your search query" --json
```

## Available Search Engines

- `brave` - Privacy-first search using Brave's independent index
- `anthropic` - Deep multi-hop research with strong source citations (requires ANTHROPIC_API_KEY)
- `openai` - ChatGPT-grade contextual search (requires OPENAI_API_KEY)
- `google` - Fresh breaking-news facts via Gemini grounding (requires GOOGLE_API_KEY)
- `sonar` - Lightweight Perplexity search (requires OPENROUTER_API_KEY)
- `sonar-pro` - Advanced Perplexity search (requires OPENROUTER_API_KEY)
- `sonar-deep-research` - Expert-level Perplexity research (requires OPENROUTER_API_KEY)
- `xai` - Real-time web search via Grok (requires XAI_API_KEY)

## Environment Variables

Set the following environment variables for the search engines you want to use:

- `BRAVE_API_KEY` - For Brave search
- `ANTHROPIC_API_KEY` - For Anthropic search
- `OPENAI_API_KEY` - For OpenAI search
- `GOOGLE_API_KEY` - For Google search
- `OPENROUTER_API_KEY` - For Perplexity searches
- `XAI_API_KEY` - For X.AI search

## API

### `web_search(engine, query, numResults?)`
### `web_search(inject_agent_id, engine, query, numResults?)`

Performs a web search using the specified engine.

- `inject_agent_id` (optional) - Agent ID for tracking in MAGI system
- `engine` - Search engine to use
- `query` - Search query string
- `numResults` - Number of results to return (default: 5)

Returns a JSON string containing search results.

### `getSearchTools()`

Returns an array of ToolFunction definitions for use with the MAGI agent system.