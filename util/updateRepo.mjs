import fs from 'fs';
import { parse as parseMeta } from 'userscript-meta';
import path from 'path';
import simpleGit from 'simple-git';

import { GAMES } from './games.mjs';

import updateResources from './updateResources.mjs';
import { forEachFile, GITHUB, ROOT_PATH } from './shared.mjs';

const HEADER_REGEX = /^\/\/ ==UserScript==.*?\/\/ ==\/UserScript==/s;

const git = simpleGit();

/**
 * @typedef {import('./shared.mjs').Script} Script
 */

/** @type {Script[]} */
const scriptOverview = [];

/**
 * Gets a Version from current Date
 * @param {number | string | Date} [time]
 * @returns {`${string}.${string}.${string}+${string}${string}`}
 */
const getVersion = time => {
    const date = time ? new Date(time) : new Date();
    const offset =
        new Date(date.toLocaleString('en-US', { timeZone: 'UTC' })).getTime() -
        new Date(
            date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' })
        ).getTime();
    const [year, month, day, hour, minute] = new Date(Date.now() - offset)
        .toISOString()
        .split(/[-T:]/gu);
    return `${year}.${month}.${day}+${hour}${minute}`;
};

// Delete all symbolic links to userscripts in root directory
fs.readdirSync(ROOT_PATH, { withFileTypes: true }).forEach(dirent => {
    if (!dirent.isSymbolicLink() || !dirent.name.endsWith('.user.js')) return;
    fs.unlinkSync(path.resolve(ROOT_PATH, dirent.name));
});

/** @type {Map<string, string>} */
const langFlagMap = new Map();
langFlagMap.set('', '');

await forEachFile(
    async ({ comment, fileName, filePath, tags, getTag, getTags }) => {
        const updateURL = `${GITHUB}/raw/master/src/${fileName}`;

        const oldNames = getTags('old');

        // get paths to execute on
        const localesAvailable = getTags('locale');
        const pathMatches = getTags('match', '/*').map(({ tag, content }) => ({
            tag,
            content: content.replace(/\*\\\//g, '*/'),
        }));
        const subdomain = getTag('subdomain', 'www').content;

        const matches = Object.keys(GAMES)
            .filter(
                game =>
                    localesAvailable.length === 0 ||
                    localesAvailable.some(({ content }) => content === game)
            )
            .flatMap(game => {
                const { shortURL, police } = GAMES[game];
                const matches = [];
                if (shortURL) {
                    pathMatches.forEach(({ content: path }) =>
                        matches.push({
                            tag: 'match',
                            content: `https://${subdomain}.${shortURL}${path}`,
                        })
                    );
                    if (police && subdomain === 'www') {
                        pathMatches.forEach(({ content: path }) =>
                            matches.push({
                                tag: 'match',
                                content: `https://${police}.${shortURL}${path}`,
                            })
                        );
                    }
                }
                return matches;
            });

        const scriptName = `[LSS] ${comment.longname.trim()}`;
        const localeScriptNames = tags
            .filter(tag => tag.title.startsWith('name:'))
            .map(({ title, value }) => ({
                tag: title,
                content: `[${
                    Object.entries(GAMES).find(([lang]) =>
                        lang.startsWith(title.split(':')[1])
                    )?.[1].abbr ?? 'LSS'
                }] ${value}`,
            }));
        const localeDescriptions = getTags('description');

        /** @type {Object.<string, ScriptLocale>} */
        const localeTranslations = {};

        localeScriptNames.forEach(({ tag, content }) => {
            const locale = tag.split(':')[1];
            const game = Object.entries(GAMES).find(([lang]) =>
                lang.startsWith(locale)
            );
            if (!game) return;

            localeTranslations[locale] = {
                flag: game[1].flag,
                name: content,
                description: comment.description,
            };
        });
        localeDescriptions.forEach(({ tag, content }) => {
            const locale = tag.split(':')[1];
            const game = Object.entries(GAMES).find(([lang]) =>
                lang.startsWith(locale)
            );
            if (!game) return;

            langFlagMap.set(locale, game[1].flag);

            if (localeTranslations[locale]) {
                localeTranslations[locale].description = content;
            } else {
                localeTranslations[locale] = {
                    flag: game[1].flag,
                    name: scriptName,
                    description: content,
                };
            }
        });

        const versionTag = {
            tag: 'version',
            content:
                comment.version ??
                parseMeta(
                    fs
                        .readFileSync(filePath, 'utf8')
                        .match(HEADER_REGEX)?.[0] ?? ''
                ).version ??
                getVersion(),
        };

        const forumTag = getTag('forum', '');

        const resources = await updateResources(fileName, getTags('resource'));

        // resources have been updated? new Version!
        if (resources.updated) versionTag.content = getVersion();

        const resourceTags = resources.resources.map(content => ({
            tag: 'resource',
            content,
        }));

        const snippetTags = getTags('snippet').map(({ content }) => ({
            tag: 'require',
            content: `${GITHUB}/raw/master/snippets/${content}.js`,
        }));

        // list of tags to add to the userscript
        const userscriptHeaderInformation = [
            {
                tag: 'name',
                content: scriptName,
            },
            ...localeScriptNames,
            {
                tag: 'namespace',
                content: 'https://jxn.lss-manager.de',
            },
            versionTag,
            {
                tag: 'author',
                content: comment.author?.join(' & ') ?? 'Jan (jxn_30)',
            },
            {
                tag: 'description',
                content: comment.description,
            },
            ...localeDescriptions,
            {
                tag: 'homepage',
                content: GITHUB,
            },
            {
                tag: 'homepageURL',
                content: GITHUB,
            },
            ...getTags('icon', 'https://www.leitstellenspiel.de/favicon.ico'),
            {
                tag: 'updateURL',
                content: updateURL,
            },
            {
                tag: 'downloadURL',
                content: updateURL,
            },
            {
                tag: 'supportURL',
                content: forumTag.content || GITHUB,
            },
            ...matches,
            ...snippetTags,
            ...resourceTags,
            ...getTags('run-at', 'document-idle'),
            ...getTags('grant'),
        ];

        // check if we need to bump version
        // has the file been updated within this run (prettier, eslint)?
        await git.diffSummary(['--numstat', filePath]).then(diff => {
            if (diff.changed) versionTag.content = getVersion();
        });
        // has the file been updated in the last commit and the committer is not the GH Action?
        await git.log({ file: filePath }).then(({ latest }) => {
            if (
                latest &&
                latest.author_email !==
                    'github-actions[bot]@users.noreply.github.com'
            ) {
                versionTag.content = getVersion(latest.date);
            }
        });

        const longestTagLength = Math.max(
            ...userscriptHeaderInformation.map(({ tag }) => tag.length)
        );

        const userscriptTags = userscriptHeaderInformation
            .map(
                ({ tag, content }) =>
                    `// @${tag.padEnd(longestTagLength, ' ')}  ${content}`
            )
            .join('\n');

        // write Header to userscript
        fs.writeFileSync(
            filePath,
            fs.readFileSync(filePath, 'utf8').replace(
                HEADER_REGEX,
                `
// ==UserScript==
${userscriptTags}
// ==/UserScript==
`.trim()
            )
        );

        // add script for README file
        scriptOverview.push({
            filename: fileName,
            name: scriptName,
            description: comment.description,
            version: versionTag.content,
            alias: oldNames.map(({ content }) => content),
            url: updateURL,
            flagsAvailable:
                localesAvailable.length === 0 ?
                    []
                :   Object.keys(GAMES)
                        .filter(game =>
                            localesAvailable.some(
                                ({ content }) => content === game
                            )
                        )
                        .map(game => GAMES[game].flag),
            locales: localeTranslations,
            forum: forumTag.content,
        });

        // add hardlinks
        // unfortunately, hardlinks are required because GitHub doesn't support symbolic links
        oldNames.forEach(({ content }) => {
            const linkPath = path.resolve(ROOT_PATH, `${content}.user.js`);
            if (fs.existsSync(linkPath)) fs.rmSync(linkPath);
            fs.linkSync(filePath, linkPath);
        });
    }
);

const centerString = (string, length) => {
    const half = Math.floor((length - string.length) / 2);
    return string.padStart(half + string.length, ' ').padEnd(length, ' ');
};

/** @type {Map<string, Script[]>} */
const sortedScriptsLocalized = new Map();
langFlagMap.forEach((flag, lang) => {
    const getName = script => script.locales[lang]?.name ?? script.name;
    sortedScriptsLocalized.set(
        lang,
        scriptOverview.toSorted((a, b) =>
            getName(a).toLowerCase().localeCompare(getName(b).toLowerCase())
        )
    );
});

const tocTitles = {
    '': ['Table of Contents', 'Click to expand / collapse'],
    'de': ['Inhaltsverzeichnis', 'Klicken zum Ein- / Ausklappen'],
};

const getScriptAnchor = name =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

const getFullTOC = () =>
    sortedScriptsLocalized
        .get('')
        .flatMap(({ name, version, flagsAvailable, locales, filename }) => [
            `- [${name}](#${getScriptAnchor(name)})&nbsp;\`${version}\`&nbsp;${
                flagsAvailable.length ?
                    `(${flagsAvailable.map(flag => `\`${flag}\``).join(', ')})`
                :   ''
            } &nbsp; [📥️:&nbsp;${filename}][${filename}:download]<br/>`.trim(),
            ...Object.values(locales).map(
                ({ flag, name }) => `&nbsp;&nbsp;${flag}: ${name}`
            ),
        ])
        .join('\n');

const getTOC = lang =>
    sortedScriptsLocalized
        .get(lang)
        .flatMap(({ name, version, locales, filename }) => [
            `- [${locales[lang]?.name ?? name}](#${getScriptAnchor(name)})&nbsp;\`${version}\`&nbsp;&nbsp;[📥️:&nbsp;${filename}][${filename}:download]`.trim(),
        ])
        .join('\n');

const scriptTOCLocalizedMarkdown = Object.entries(tocTitles)
    .map(([lang, [title, collapse]]) =>
        `
<details>
    <summary>${langFlagMap.get(lang)} <b>${title}</b> <em>${collapse}</em></summary>
    
${lang ? getTOC(lang) : getFullTOC()}
    
</details>
`.trim()
    )
    .join('\n\n');

const scriptOverviewMarkdown = sortedScriptsLocalized
    .get('')
    .map(script => {
        const headerRow = ['Version'];
        const contentRow = [script.version];
        if (script.flagsAvailable.length) {
            headerRow.push('Available in');
            contentRow.push(
                script.flagsAvailable.map(flag => `\`${flag}\``).join(', ')
            );
        }
        if (script.alias.length) {
            headerRow.push('Alias / Old names');
            contentRow.push(
                script.alias.map(alias => `\`${alias}\``).join(', ')
            );
        }
        headerRow.push('Download');
        contentRow.push(`[${script.filename}][${script.filename}:download]`);
        if (script.forum) {
            headerRow.push('Links');
            contentRow.push(`[Forum][${script.filename}:forum]`);
        }

        /** @type {string[][]} */
        const rows = [headerRow, contentRow];

        const cellWidths = rows[0].map((_, i) =>
            Math.max(...rows.map(row => row[i].length))
        );
        rows.splice(
            1,
            0,
            cellWidths.map(width => `:${'-'.repeat(width)}:`)
        );
        return `
### ${script.name}

> ${script.description}

${rows
    .map(
        row =>
            `|${row
                .map((cell, i) => centerString(cell, cellWidths[i] + 2))
                .join('|')}|`
    )
    .join('\n')}

${Object.values(script.locales)
    .map(({ flag, name, description }) =>
        `
<details>
    <summary>${flag} ${name}</summary>
    ${description}
</details>

<p align="center"><sub><a href="#scripts" title="Back to top / Zurück nach oben">⬆️ Back to top / Zurück nach oben ⬆️</a></sub></p>
`.trim()
    )
    .join('\n')}

[${script.filename}:download]: ${script.url}
${script.forum ? `[${script.filename}:forum]: ${script.forum}` : ''}
`.trim();
    })
    .join('\n\n');

const readmePath = path.resolve(ROOT_PATH, 'README.md');

const escapeStringRegexp = string =>
    string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');

const startComment =
    '<!-- prettier-ignore-start -->\n<!-- == BEGIN SCRIPT-OVERVIEW == -->';
const endComment =
    '<!-- ## END SCRIPT-OVERVIEW ## -->\n<!-- prettier-ignore-end -->';

fs.writeFileSync(
    readmePath,
    fs.readFileSync(readmePath, 'utf8').replace(
        new RegExp(
            `${escapeStringRegexp(startComment)}.*?${escapeStringRegexp(
                endComment
            )}`,
            'su'
        ),
        `
${startComment}
*Total: ${sortedScriptsLocalized.get('').length} userscripts*
${scriptTOCLocalizedMarkdown}

${scriptOverviewMarkdown}
${endComment}
`.trim()
    )
);
