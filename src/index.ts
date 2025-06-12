import axios from 'axios';
import { ToolFunction, createToolFunction, Agent, ResponseInput, ensembleRequest, ensembleResult } from '@just-every/ensemble';

const DEFAULT_RESULTS_COUNT = 5;
const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

async function braveSearch(
    query: string,
    numResults: number = DEFAULT_RESULTS_COUNT
): Promise<string> {
    if (typeof query !== 'string') {
        return `Error: Search query must be a string, received ${typeof query}: ${JSON.stringify(query)}`;
    }

    console.log(`Performing Brave API search for: ${query}`);

    const braveApiKey = process.env.BRAVE_API_KEY;
    if (!braveApiKey) {
        return 'Error: Brave Search API key is not configured. Cannot perform search.';
    }

    try {
        const response = await axios.get(BRAVE_SEARCH_ENDPOINT, {
            params: {
                q: query,
                count: numResults,
            },
            headers: {
                Accept: 'application/json',
                'X-Subscription-Token': braveApiKey,
            },
        });

        if (response.data && response.data.web && response.data.web.results) {
            const results: SearchResult[] = response.data.web.results.map((result: any) => ({
                title: result.title,
                url: result.url,
                snippet: result.description,
            }));

            return JSON.stringify(results);
        }
        console.error(
            'Invalid response structure from Brave Search API:',
            response.data
        );
        return 'Error: Received an invalid response structure from Brave Search API.';
    } catch (error) {
        console.error('Error during Brave API search:', error);
        return `Error performing Brave search: ${error instanceof Error ? error.message : String(error)}`;
    }
}

function signalToolFunction(name: string): ToolFunction {
    return {
        function: () => '',
        definition: {
            type: 'function',
            function: {
                name,
                description: '',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: [],
                },
            },
        },
    };
}

async function llmWebSearch(
    query: string,
    model: string,
    name: string,
    instructions: string,
    tools?: ToolFunction[],
    parent_id?: string
): Promise<string> {
    const agent = new Agent({
        model,
        name,
        description: 'Search the web',
        instructions,
        modelSettings: {
            max_tokens: 1024,
        },
        tools,
        parent_id,
    });

    agent.historyThread = [];

    const messages: ResponseInput = [
        { type: 'message', role: 'user', content: query }
    ];

    // Use ensemble's streaming API with ensembleResult
    const stream = ensembleRequest(messages, agent);
    const result = await ensembleResult(stream);
    
    // Return the message content, or error if one occurred
    if (result.error) {
        return `Error: ${result.error}`;
    }
    
    return result.message || '';
}

// Overload signatures for backward compatibility
export async function web_search(
    engine: string,
    query: string,
    numResults?: number
): Promise<string>;
export async function web_search(
    inject_agent_id: string | null,
    engine: string,
    query: string,
    numResults?: number
): Promise<string>;

// Implementation
export async function web_search(
    engineOrInjectId: string | null,
    queryOrEngine?: string,
    numResultsOrQuery?: string | number,
    numResultsParam?: number
): Promise<string> {
    // Handle overloaded parameters
    let inject_agent_id: string | null;
    let engine: string;
    let query: string;
    let numResults: number;
    
    if (typeof queryOrEngine === 'string' && typeof numResultsOrQuery === 'string') {
        // Called with inject_agent_id
        inject_agent_id = engineOrInjectId;
        engine = queryOrEngine;
        query = numResultsOrQuery;
        numResults = numResultsParam ?? DEFAULT_RESULTS_COUNT;
    } else {
        // Called without inject_agent_id (backward compatibility)
        inject_agent_id = null;
        engine = engineOrInjectId as string;
        query = queryOrEngine as string;
        numResults = (numResultsOrQuery as number) ?? DEFAULT_RESULTS_COUNT;
    }
    switch (engine) {
        case 'brave':
            if (!process.env.BRAVE_API_KEY) return 'Error: Brave API key not configured.';
            return await braveSearch(query, numResults);
        case 'anthropic':
            if (!process.env.ANTHROPIC_API_KEY)
                return 'Error: Anthropic API key not configured.';
            return await llmWebSearch(
                query,
                'claude-3-7-sonnet-latest',
                'ClaudeSearch',
                'Please search the web for this query.',
                [signalToolFunction('claude_web_search')],
                inject_agent_id || undefined
            );
        case 'openai':
            if (!process.env.OPENAI_API_KEY) return 'Error: OpenAI API key not configured.';
            return await llmWebSearch(
                query,
                'gpt-4.1',
                'OpenAISearch',
                'Please search the web for this query.',
                [signalToolFunction('openai_web_search')],
                inject_agent_id || undefined
            );
        case 'google':
            if (!process.env.GOOGLE_API_KEY) return 'Error: Google API key not configured.';
            return await llmWebSearch(
                query,
                'gemini-2.5-flash-preview-04-17',
                'GoogleSearch',
                'Please answer this using search grounding.',
                [signalToolFunction('google_web_search')],
                inject_agent_id || undefined
            );
        case 'sonar':
        case 'sonar-pro':
        case 'sonar-deep-research':
            if (!process.env.OPENROUTER_API_KEY)
                return 'Error: OpenRouter API key not configured.';
            return await llmWebSearch(
                query,
                `perplexity/${engine === 'sonar-deep-research' ? engine : engine === 'sonar-pro' ? 'sonar-reasoning-pro' : 'sonar-reasoning'}`,
                `Perplexity${engine === 'sonar-deep-research' ? 'Research' : engine === 'sonar-pro' ? 'ProSearch' : 'Search'}`,
                'Please answer this using the latest information available.',
                undefined,
                inject_agent_id || undefined
            );
        case 'xai':
            if (!process.env.XAI_API_KEY) return 'Error: X.AI API key not configured.';
            return await llmWebSearch(
                query,
                'grok-3-latest',
                'GrokSearch',
                'Please search the web for this query.',
                [signalToolFunction('grok_web_search')],
                inject_agent_id || undefined
            );
        default:
            return `Error: Invalid or unsupported search engine ${engine}`;
    }
}

export function getSearchTools(): ToolFunction[] {
    const availableEngines: string[] = [];
    const engineDescriptions: string[] = [];

    if (process.env.ANTHROPIC_API_KEY) {
        availableEngines.push('anthropic');
        engineDescriptions.push(
            '- anthropic: deep multi-hop research, strong source citations'
        );
    }
    if (process.env.BRAVE_API_KEY) {
        availableEngines.push('brave');
        engineDescriptions.push(
            '- brave: privacy-first, independent index (good for niche/controversial)'
        );
    }
    if (process.env.OPENAI_API_KEY) {
        availableEngines.push('openai');
        engineDescriptions.push(
            '- openai: ChatGPT-grade contextual search, cited results'
        );
    }
    if (process.env.GOOGLE_API_KEY) {
        availableEngines.push('google');
        engineDescriptions.push(
            '- google: freshest breaking-news facts via Gemini grounding'
        );
    }
    if (process.env.XAI_API_KEY) {
        availableEngines.push('xai');
        engineDescriptions.push('- xai: real-time web search via Grok');
    }
    if (process.env.OPENROUTER_API_KEY) {
        availableEngines.push('sonar');
        engineDescriptions.push(
            '- sonar: (perplexity) lightweight, cost-effective search model with grounding'
        );
        availableEngines.push('sonar-pro');
        engineDescriptions.push(
            '- sonar-pro: (perplexity) advanced search offering with grounding, supporting complex queries and follow-ups'
        );
        availableEngines.push('sonar-deep-research');
        engineDescriptions.push(
            '- sonar-deep-research: (perplexity) expert-level research model conducting exhaustive searches and generating comprehensive reports'
        );
    }

    if (availableEngines.length === 0) {
        return [];
    }

    return [
        createToolFunction(
            web_search,
            'Adaptive web search - pick the engines that best fit the query.',
            {
                engine: {
                    type: 'string',
                    description: `Engine to use:\n${engineDescriptions.join('\n')}`,
                    enum: availableEngines,
                },
                query: {
                    type: 'string',
                    description:
                        'Plain-language search query. Each engine has AI interpretation, so you can leave it up to the engine to decide how to search.',
                },
                numResults: {
                    type: 'number',
                    description: 'Max results to return (default = 5).',
                    optional: true,
                },
            }
        ),
    ];
}