import axios from 'axios';
import { ToolFunction, createToolFunction, Agent, ResponseInput, ensembleRequest } from '@just-every/ensemble';

const DEFAULT_RESULTS_COUNT = 5;
const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const BRAVE_IMAGE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/images/search';

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export interface ImageSearchResult {
    title: string;
    url: string;
    thumbnail: string;
    source: string;
    width?: number;
    height?: number;
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

async function braveImageSearch(
    query: string,
    numResults: number = DEFAULT_RESULTS_COUNT
): Promise<string> {
    if (typeof query !== 'string') {
        return `Error: Search query must be a string, received ${typeof query}: ${JSON.stringify(query)}`;
    }

    console.log(`Performing Brave Image Search for: ${query}`);

    const braveApiKey = process.env.BRAVE_API_KEY;
    if (!braveApiKey) {
        return 'Error: Brave Search API key is not configured. Cannot perform image search.';
    }

    try {
        const response = await axios.get(BRAVE_IMAGE_SEARCH_ENDPOINT, {
            params: {
                q: query,
                count: numResults
            },
            headers: {
                Accept: 'application/json',
                'X-Subscription-Token': braveApiKey,
            },
        });

        if (response.data && response.data.results) {
            const results: ImageSearchResult[] = response.data.results.map((result: any) => ({
                title: result.title || 'Untitled',
                url: result.url,
                thumbnail: result.thumbnail?.src || result.url,
                source: result.source || 'Unknown',
                width: result.properties?.width,
                height: result.properties?.height
            }));

            return JSON.stringify(results);
        }
        console.error(
            'Invalid response structure from Brave Image Search API:',
            response.data
        );
        return 'Error: Received an invalid response structure from Brave Image Search API.';
    } catch (error) {
        console.error('Error during Brave Image Search:', error);
        
        // Log the specific error details if available
        if (error instanceof Error && 'response' in error) {
            const axiosError = error as any;
            if (axiosError.response?.data) {
                console.error('API Error Response:', axiosError.response.data);
            }
        }
        
        return `Error performing Brave image search: ${error instanceof Error ? error.message : String(error)}`;
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

function isImageQuery(query: string): boolean {
    const imageKeywords = [
        'image', 'images', 'photo', 'photos', 'picture', 'pictures', 'pic', 'pics',
        'logo', 'logos', 'icon', 'icons', 'screenshot', 'screenshots',
        'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp',
        'wallpaper', 'wallpapers', 'background', 'backgrounds',
        'thumbnail', 'thumbnails', 'avatar', 'avatars'
    ];
    
    const lowerQuery = query.toLowerCase();
    return imageKeywords.some(keyword => lowerQuery.includes(keyword));
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
        tools,
        parent_id,
    });

    // Don't modify historyThread - it causes issues with some providers

    const messages: ResponseInput = [
        { type: 'message', role: 'user', content: query }
    ];

    // Use ensemble's streaming API
    const stream = ensembleRequest(messages, agent);
    
    let fullResponse = '';
    let error = null;
    
    for await (const event of stream) {
        if (event.type === 'message_delta' && 'content' in event) {
            fullResponse += event.content;
        } else if (event.type === 'error' && 'error' in event) {
            error = event.error;
            break;
        }
    }
    
    if (error) {
        return `Error: ${error}`;
    }
    
    return fullResponse;
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
        case 'brave-images':
            if (!process.env.BRAVE_API_KEY) return 'Error: Brave API key not configured.';
            return await braveImageSearch(query, numResults);
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

export async function web_search_task(
    query: string,
    modelClass: 'standard' | 'mini' | 'reasoning' | 'reasoning_mini' | 'monologue' | 'metacognition' | 'code' | 'writing' | 'summary' | 'vision' | 'vision_mini' |  'image_generation' | 'embedding' | 'voice' = 'reasoning_mini'
): Promise<string> {
    // Import task functionality
    const { runTask } = await import('@just-every/task');
    const { Agent } = await import('@just-every/ensemble');
    
    // Track search executions
    const searchExecutions: Map<string, number> = new Map();
    
    // Create a wrapper for web_search that tracks progress
    async function web_search_with_tracking(
        engine: string,
        searchQuery: string,
        numResults?: number
    ): Promise<string> {
        const startTime = Date.now();
        const executionId = `${engine}-${Date.now()}`;
        
        console.log(`\n🔍 [Search Started] Engine: ${engine}`);
        console.log(`   Query: "${searchQuery}"`);
        console.log(`   Time: ${new Date().toLocaleTimeString()}`);
        
        try {
            const result = await web_search(engine, searchQuery, numResults);
            const duration = Date.now() - startTime;
            searchExecutions.set(executionId, duration);
            
            if (result.startsWith('Error:')) {
                console.log(`❌ [Search Failed] Engine: ${engine} (${duration}ms)`);
                console.log(`   Error: ${result}`);
            } else {
                console.log(`✅ [Search Complete] Engine: ${engine} (${duration}ms)`);
                const resultPreview = result.substring(0, 100);
                console.log(`   Result preview: ${resultPreview}...`);
            }
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`❌ [Search Exception] Engine: ${engine} (${duration}ms)`);
            console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    
    // Create search tools with tracking
    const searchTools = getSearchToolsWithTracking(web_search_with_tracking);
    
    if (searchTools.length === 0) {
        return 'Error: No search engines are configured. Please set API keys for at least one search provider.';
    }
    
    // Log available search engines
    const availableEngines = getAvailableEngines();
    console.log(`\n🚀 Starting comprehensive research with ${availableEngines.length} search engines available:`);
    availableEngines.forEach(engine => console.log(`   - ${engine}`));
    console.log(`\n📊 Model class: ${modelClass}`);
    console.log(`🔎 Research query: "${query}"\n`);
    
    const agent = new Agent({
        modelClass,
        name: 'ResearchAgent',
        description: 'Comprehensive web research agent',
        instructions: `You are a comprehensive research agent. Your goal is to conduct thorough research on the given topic by:

1. Breaking down the query into key aspects that need investigation
2. Using web_search tools to gather information from multiple sources
3. Running searches in PARALLEL when possible to maximize efficiency
4. Identifying gaps in the collected information and filling them with targeted searches
5. Cross-referencing information from different sources for accuracy
6. Synthesizing all findings into a comprehensive, well-structured report

IMPORTANT GUIDELINES:
- Use multiple search engines for diverse perspectives (if available)
- Run searches in parallel using multiple tool calls in a single message
- Be thorough - continue searching until all aspects are covered
- Verify contradictory information by searching for additional sources
- Include relevant quotes and citations in your final report
- Structure the report with clear sections and subsections
- End with a summary of key findings and any remaining open questions

Start by analyzing the query and planning your research approach.`,
        tools: searchTools
    });
    
    // Run the task with automatic meta-cognition and model rotation
    const stream = runTask(agent, `Research the following topic comprehensively: ${query}

Please provide a detailed report with multiple perspectives, citations, and a clear structure.`);
    
    // Collect the full response
    let fullResponse = '';
    let error = null;
    
    for await (const event of stream) {
        if (event.type === 'message_delta' && 'content' in event) {
            fullResponse += event.content;
        } else if (event.type === 'error' && 'error' in event) {
            error = event.error;
            break;
        }
    }
    
    if (error) {
        return `Error during research: ${error}`;
    }
    
    // Log summary
    console.log(`\n📈 Search Summary:`);
    console.log(`   Total searches executed: ${searchExecutions.size}`);
    if (searchExecutions.size > 0) {
        const totalTime = Array.from(searchExecutions.values()).reduce((a, b) => a + b, 0);
        console.log(`   Total search time: ${totalTime}ms`);
        console.log(`   Average search time: ${Math.round(totalTime / searchExecutions.size)}ms`);
    }
    console.log(`\n✨ Research complete!\n`);
    
    return fullResponse;
}

function getAvailableEngines(): string[] {
    const engines: string[] = [];
    if (process.env.ANTHROPIC_API_KEY) engines.push('anthropic');
    if (process.env.BRAVE_API_KEY) {
        engines.push('brave', 'brave-images');
    }
    if (process.env.OPENAI_API_KEY) engines.push('openai');
    if (process.env.GOOGLE_API_KEY) engines.push('google');
    if (process.env.XAI_API_KEY) engines.push('xai');
    if (process.env.OPENROUTER_API_KEY) {
        engines.push('sonar', 'sonar-pro', 'sonar-deep-research');
    }
    return engines;
}

function getSearchToolsWithTracking(
    searchFunction: (engine: string, query: string, numResults?: number) => Promise<string>
): ToolFunction[] {
    const availableEngines = getAvailableEngines();
    const engineDescriptions: string[] = [];
    
    if (availableEngines.includes('anthropic')) {
        engineDescriptions.push('- anthropic: deep multi-hop research, strong source citations');
    }
    if (availableEngines.includes('brave')) {
        engineDescriptions.push('- brave: privacy-first, independent index (good for niche/controversial)');
    }
    if (availableEngines.includes('brave-images')) {
        engineDescriptions.push('- brave-images: privacy-first image search with direct URLs to images');
    }
    if (availableEngines.includes('openai')) {
        engineDescriptions.push('- openai: ChatGPT-grade contextual search, cited results');
    }
    if (availableEngines.includes('google')) {
        engineDescriptions.push('- google: freshest breaking-news facts via Gemini grounding');
    }
    if (availableEngines.includes('xai')) {
        engineDescriptions.push('- xai: real-time web search via Grok');
    }
    if (availableEngines.includes('sonar')) {
        engineDescriptions.push('- sonar: (perplexity) lightweight, cost-effective search model with grounding');
        engineDescriptions.push('- sonar-pro: (perplexity) advanced search offering with grounding, supporting complex queries and follow-ups');
        engineDescriptions.push('- sonar-deep-research: (perplexity) expert-level research model conducting exhaustive searches and generating comprehensive reports');
    }
    
    if (availableEngines.length === 0) {
        return [];
    }
    
    return [
        createToolFunction(
            searchFunction,
            'Adaptive web search - pick the engines that best fit the query.',
            {
                engine: {
                    type: 'string',
                    description: `Engine to use:\n${engineDescriptions.join('\n')}`,
                    enum: availableEngines,
                },
                query: {
                    type: 'string',
                    description: 'Plain-language search query. Each engine has AI interpretation, so you can leave it up to the engine to decide how to search.',
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
        availableEngines.push('brave-images');
        engineDescriptions.push(
            '- brave-images: privacy-first image search with direct URLs to images'
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