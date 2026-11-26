import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const run = promisify(execFile);
const cache = process.argv[2] ?? '.data-cache';
const output = 'app/src/main/assets';
const wiki = 'https://zh.wikisource.org';
const reference = 'https://www.zhouyi.cc';
const unihan = 'https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip';
const kangxi = 'https://raw.githubusercontent.com/breezyreeds/kangxi-strokecount/778d23d0566066ab19906557755b882818ec0a06';
const opencc = 'https://raw.githubusercontent.com/BYVoid/OpenCC/ver.1.1.9';

async function download(name, url) {
    const path = join(cache, name);
    try {
        await readFile(path);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const temporary = `${path}.download`;
        await run('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--max-time', '45', '--user-agent', 'YiShuDataImporter/1.0 (offline classical text attribution)', '--output', temporary, url]);
        await rename(temporary, path);
    }
    return path;
}

async function read(name, url) {
    return readFile(await download(name, url), 'utf8');
}

function clean(html) {
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return html.replace(/<(small|sup|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<span class="variant-tooltip"[^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/<[^>]+>/g, '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (value, entity) => {
            if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
            if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
            return entities[entity] ?? value;
        }).replace(/\s+/g, ' ').trim();
}

const chars = '地天泽火雷风水山';
const signs = '坤乾兑离震巽坎艮';
const traditionalSigns = '坤乾兌離震巽坎艮';
const trigramBits = [0, 7, 3, 5, 1, 6, 2, 4];

function extractEntry(html, number, name, detail, title) {
    const revision = html.match(/\boldid=(\d+)/)?.[1];
    const classic = html.match(/>易經[：:]<[^\n]*([\s\S]+?)>彖曰[：:]/)?.[1];
    if (!classic || !revision) throw Error(`${number} ${name}: classic or revision missing`);
    const items = [...classic.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/g)].map(match => clean(match[1]));
    const matchImage = html.match(/>象曰[：:]<\/b>\s*<ul>\s*<li[^>]*>([\s\S]*?)<\/li>/)?.[1];
    const pure = title[1] === '为';
    const upper = pure ? signs.indexOf(title[0]) : chars.indexOf(title[0]);
    const lower = pure ? upper : chars.indexOf(title[1]);
    const bits = trigramBits[lower] | (trigramBits[upper] << 3);
    const captions = ['初', '二', '三', '四', '五', '上'];
    const lines = items.filter(item => /^(初[六九]|[六九][二三四五]|上[六九])[：:，]/.test(item));
    if (upper < 0 || lower < 0 || !items[0] || !matchImage || lines.length !== 6) {
        throw Error(`${number} ${name}: unexpected structure ${JSON.stringify({items, matchImage, title})}`);
    }
    lines.forEach((line, index) => {
        const polarity = bits & (1 << index) ? '九' : '六';
        const label = index === 0 || index === 5 ? captions[index] + polarity : polarity + captions[index];
        if (!line.startsWith(label)) throw Error(`${number} ${name}: expected ${label} in ${line}`);
    });
    const figure = html.match(/alt="(?:alr=)?([\u4dc0-\u4dff])"[^\n]*?([坤乾兌離震巽坎艮])下\s*([坤乾兌離震巽坎艮])上/);
    if (!figure || figure[1].codePointAt(0) !== 0x4dbf + number ||
        traditionalSigns.indexOf(figure[2]) !== lower || traditionalSigns.indexOf(figure[3]) !== upper) {
        throw Error(`${number} ${name}: independent trigram check failed (${figure?.slice(1)})`);
    }
    return {
        number, name, title, upper, lower, bits,
        judgment: items[0], image: clean(matchImage), lines,
        extra: items.find(item => /^用[六九][：:]/.test(item)) ?? null,
        source: `${wiki}/wiki/Special:PermanentLink/${revision}`,
        revision, reference: `${reference}${detail}`,
    };
}

await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });
await mkdir('docs', { recursive: true });
const [index, crossCheck] = await Promise.all([
    read('wiki-index.html', `${wiki}/wiki/%E5%91%A8%E6%98%93`),
    read('zhouyi.html', `${reference}/zhouyi/yijing64/`),
]);
const wikiEntries = [...index.matchAll(/<li(?: value="\d+")?><a href="(\/wiki\/[^"#]+)" title="周易\/([^"/<]+)">([^<>]+)<\/a><\/li>/g)]
    .filter((row, index, rows) => rows.findIndex(other => row[1] === other[1]) === index).slice(0, 64);
const refEntries = [...crossCheck.matchAll(/<a href="(\/zhouyi\/yijing64\/\d+\.html)"[^>]*>(\d+)、([^<]+)<\/a>/g)];
if (wikiEntries.length !== 64 || refEntries.length !== 64) throw Error('Expected both indexes to contain 64 hexagrams');
const pinnedPath = 'docs/hexagram-revisions.json';
const pinned = JSON.parse(await readFile(pinnedPath, 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return '{}';
}));
const entries = [];
for (let start = 0; start < 64; start += 4) {
    const batch = await Promise.allSettled(wikiEntries.slice(start, start + 4).map(async (row, offset) => {
        const number = start + offset + 1;
        const [, path, , name] = row;
        const [, detail, ordinal, title] = refEntries[number - 1];
        if (Number(ordinal) !== number) throw Error(`Reference index out of order: ${ordinal}`);
        const revision = pinned[number];
        const cached = await readFile(join(cache, `hexagram-${number}.html`), 'utf8').catch(error => {
            if (error.code !== 'ENOENT') throw error;
            return null;
        });
        const matchingCache = cached && (!revision || cached.match(/\boldid=(\d+)/)?.[1] === revision);
        const url = revision ? `/w/index.php?title=${path.slice(6)}&oldid=${revision}` : path;
        const html = matchingCache ? cached : await read(`hexagram-${number}${revision ? `-${revision}` : ''}.html`, wiki + url);
        const entry = extractEntry(html, number, name, detail, title);
        if (revision && entry.revision !== revision) throw Error(`${number}: unexpected revision ${entry.revision}`);
        return entry;
    }));
    for (const entry of batch) {
        if (entry.status === 'fulfilled') entries.push(entry.value);
        else console.error(entry.reason.message);
    }
}
if (entries.length !== 64 || new Set(entries.map(entry => entry.bits)).size !== 64) throw Error('Hexagram set is incomplete');
await writeFile(join(output, 'hexagrams.json'), `${JSON.stringify(entries, null, 2)}\n`);
await writeFile(pinnedPath, `${JSON.stringify(Object.fromEntries(entries.map(row => [row.number, row.revision])), null, 2)}\n`);

const archive = await download('Unihan.zip', unihan);
const modern = new Map();
const variants = new Map();
for (const file of ['Unihan_IRGSources.txt', 'Unihan_Variants.txt']) {
    const extraction = { maxBuffer: 20_000_000 };
    const { stdout } = await run('tar', ['-xOf', archive, file], extraction)
        .catch(() => run('unzip', ['-p', archive, file], extraction));
    for (const line of stdout.split(/\r?\n/)) {
        const [code, key, value] = line.split('\t');
        if (!/^U\+[\dA-F]+$/.test(code) || !value) continue;
        if (key === 'kTotalStrokes') {
            if (!/^\d+$/.test(value) || Number(value) <= 0) throw Error(`Invalid Unihan count for ${code}: ${value}`);
            modern.set(code.slice(2), value);
        }
        if (key === 'kTraditionalVariant' || key === 'kSimplifiedVariant') {
            const existing = variants.get(code.slice(2)) ?? new Set();
            for (const match of value.matchAll(/U\+([\dA-F]+)/g)) {
                if (match[1] !== code.slice(2)) existing.add(match[1]);
            }
            variants.set(code.slice(2), existing);
        }
    }
}
const old = new Map();
for (const line of (await read('kangxi.csv', `${kangxi}/kangxi-strokecount.csv`)).split(/\r?\n/)) {
    const row = line.match(/^U\+([0-9A-F]+),(\d+),([^,]+),(\d+)$/);
    if (!row) continue;
    const [, code, decimal, glyph, strokes] = row;
    if (Number(decimal) !== parseInt(code, 16) || Number(decimal) !== glyph.codePointAt(0) || Number(strokes) <= 0) {
        throw Error(`Invalid Kangxi row ${line}`);
    }
    if (!old.has(code)) old.set(code, new Set());
    old.get(code).add(strokes);
}
if (modern.size !== 102_998 || old.size !== 63_696 || variants.size !== 12_972) throw Error('Unexpected stroke or variant coverage for the pinned datasets');
const ordered = [...new Set([...modern.keys(), ...old.keys(), ...variants.keys()])]
    .sort((a, b) => parseInt(a, 16) - parseInt(b, 16));
const rows = ordered.map(code => [code, modern.get(code) ?? '', [...(old.get(code) ?? [])].join(','), [...(variants.get(code) ?? [])].join(',')].join('\t'));
await writeFile(join(output, 'strokes.tsv'), `${rows.join('\n')}\n`);

for (const name of ['STCharacters', 'TSCharacters', 'TSPhrases']) {
    const data = await read(`${name}.txt`, `${opencc}/data/dictionary/${name}.txt`);
    await writeFile(join(output, `${name}.txt`), data);
}
for (const [name, url] of Object.entries({
    'unicode-license.txt': 'https://www.unicode.org/license.txt',
    'kangxi-license.txt': `${kangxi}/LICENSE`,
    'opencc-license.txt': `${opencc}/LICENSE`,
})) {
    await writeFile(join(output, name), await read(name, url));
}
const licensePage = await read('cc-by-sa-4.0.txt', 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt');
await writeFile(join(output, 'cc-by-sa-4.0.txt'), licensePage);
const hashes = Object.fromEntries(await Promise.all(['hexagrams.json', 'strokes.tsv', 'STCharacters.txt', 'TSCharacters.txt', 'TSPhrases.txt'].map(async name => [name, createHash('sha256').update(await readFile(join(output, name))).digest('hex')])));
const kangxiUnique = [...old.values()].filter(values => values.size === 1).length;
const summary = {
    hexagrams: entries.length, lines: entries.length * 6, modern: modern.size,
    kangxiUnique, kangxiAmbiguous: old.size - kangxiUnique, variants: variants.size,
    checks: {
        hexagrams: 'Cross-checked order, source trigram captions, all 64 bit patterns and all 384 line polarities',
        strokes: 'Validated TSV/CSV structure, numeric values and code points against the pinned upstream data',
    },
    hashes,
};
await writeFile('docs/data-manifest.json', `${JSON.stringify(summary, null, 2)}\n`);
console.log(summary);
