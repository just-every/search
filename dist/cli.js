#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { web_search } from './index.js';
const argv = yargs(hideBin(process.argv))
    .command('$0 <query>', 'Search the web using various search engines', (yargs) => {
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
        choices: ['brave', 'anthropic', 'openai', 'google', 'sonar', 'sonar-pro', 'sonar-deep-research', 'xai'],
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
}, async (argv) => {
    try {
        // CLI doesn't use inject_agent_id, so we use the backward-compatible signature
        const result = await web_search(argv.engine, argv.query, argv.results);
        if (argv.json) {
            console.log(result);
        }
        else {
            if (result.startsWith('Error:')) {
                console.error(result);
                process.exit(1);
            }
            try {
                const results = JSON.parse(result);
                console.log(`\nSearch results for: "${argv.query}"\n`);
                results.forEach((item, index) => {
                    console.log(`${index + 1}. ${item.title}`);
                    console.log(`   ${item.url}`);
                    console.log(`   ${item.snippet}\n`);
                });
            }
            catch (e) {
                console.log(result);
            }
        }
    }
    catch (error) {
        console.error('Search failed:', error);
        process.exit(1);
    }
})
    .help()
    .parseSync();
//# sourceMappingURL=cli.js.map