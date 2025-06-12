import { ToolFunction } from '@just-every/ensemble';
export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}
export declare function web_search(engine: string, query: string, numResults?: number): Promise<string>;
export declare function web_search(inject_agent_id: string | null, engine: string, query: string, numResults?: number): Promise<string>;
export declare function getSearchTools(): ToolFunction[];
//# sourceMappingURL=index.d.ts.map