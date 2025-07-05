#!/usr/bin/env node

import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { web_search, web_search_task } from './index.js';

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

const argv = yargs(hideBin(process.argv))
    .command(
        '$0 <query>',
        'Search the web using various search engines',
        (yargs) => {
            return yargs
                .positional('query', {
                    describe: 'The search query',
                    type: 'string',
                    demandOption: true,
                })
                .option('engine', {
                    alias: 'e',
                    describe: 'Search engine to use',
                    type: 'string',
                    choices: ['brave', 'brave-images', 'anthropic', 'openai', 'google', 'sonar', 'sonar-pro', 'sonar-deep-research', 'xai'],
                    default: 'brave',
                })
                .option('results', {
                    alias: 'n',
                    describe: 'Number of results to return',
                    type: 'number',
                    default: 5,
                })
                .option('json', {
                    alias: 'j',
                    describe: 'Output raw JSON',
                    type: 'boolean',
                    default: false,
                });
        },
        async (argv) => {
            try {
                let engine = argv.engine as string;
                
                // Auto-detect image queries and suggest brave-images if using brave
                if (engine === 'brave' && isImageQuery(argv.query as string)) {
                    console.log(`🔍 Detected image query. Consider using --engine brave-images for better results.\n`);
                }
                
                // CLI doesn't use inject_agent_id, so we use the backward-compatible signature
                const result = await web_search(
                    engine,
                    argv.query as string,
                    argv.results as number
                );

                if (argv.json) {
                    console.log(result);
                } else {
                    if (result.startsWith('Error:')) {
                        console.error(result);
                        process.exit(1);
                    }

                    try {
                        const results = JSON.parse(result);
                        console.log(`\nSearch results for: "${argv.query}"\n`);
                        results.forEach((item: any, index: number) => {
                            console.log(`${index + 1}. ${item.title}`);
                            console.log(`   ${item.url}`);
                            
                            // Handle image results
                            if (item.thumbnail && item.source) {
                                console.log(`   Source: ${item.source}`);
                                console.log(`   Thumbnail: ${item.thumbnail}`);
                                if (item.width && item.height) {
                                    console.log(`   Dimensions: ${item.width}x${item.height}`);
                                }
                            } else if (item.snippet) {
                                console.log(`   ${item.snippet}`);
                            }
                            console.log();
                        });
                    } catch (e) {
                        console.log(result);
                    }
                }
            } catch (error) {
                console.error('Search failed:', error);
                process.exit(1);
            }
        }
    )
    .command(
        'task <query>',
        'Run comprehensive research using web_search_task',
        (yargs) => {
            return yargs
                .positional('query', {
                    describe: 'The research query',
                    type: 'string',
                    demandOption: true,
                })
                .option('model-class', {
                    alias: 'm',
                    describe: 'Model class to use',
                    type: 'string',
                    choices: ['standard', 'mini', 'reasoning', 'reasoning_mini', 'monologue', 'metacognition', 'code', 'writing', 'summary', 'vision', 'vision_mini',  'image_generation', 'embedding', 'voice'],
                    default: 'reasoning_mini',
                });
        },
        async (argv) => {
            try {
                console.log(`Running comprehensive research on: "${argv.query}"\n`);
                console.log(`Using model class: ${argv.modelClass}\n`);
                
                const result = await web_search_task(
                    argv.query as string,
                    argv.modelClass as any
                );

                if (result.startsWith('Error:')) {
                    console.error(result);
                    process.exit(1);
                }

                console.log(result);
            } catch (error) {
                console.error('Research task failed:', error);
                process.exit(1);
            }
        }
    )
    .help()
    .parse();