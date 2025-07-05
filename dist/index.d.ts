import { ToolFunction } from '@just-every/ensemble';
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
export declare function web_search(engine: string, query: string, numResults?: number): Promise<string>;
export declare function web_search(inject_agent_id: string | null, engine: string, query: string, numResults?: number): Promise<string>;
export declare function web_search_task(query: string, modelClass?: 'standard' | 'mini' | 'reasoning' | 'reasoning_mini' | 'monologue' | 'metacognition' | 'code' | 'writing' | 'summary' | 'vision' | 'vision_mini' | 'image_generation' | 'embedding' | 'voice'): Promise<string>;
export declare function getSearchTools(): ToolFunction[];
//# sourceMappingURL=index.d.ts.map