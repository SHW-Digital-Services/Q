import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createCore from '@ffmpeg/core';
import { compressionArguments, HELP_VIDEO_STORAGE_BYTES } from '../src/shared/videoCompression';
import { youtubeVideoId } from '../src/shared/youtube';

for (const url of ['https://www.youtube.com/watch?v=M7lc1UVf-VE', 'https://youtu.be/M7lc1UVf-VE?si=test', 'https://www.youtube.com/shorts/M7lc1UVf-VE', 'https://www.youtube.com/embed/M7lc1UVf-VE', 'https://www.youtube.com/live/M7lc1UVf-VE']) assert.equal(youtubeVideoId(url), 'M7lc1UVf-VE');
for (const url of ['https://youtube.com.attacker.test/watch?v=M7lc1UVf-VE', 'javascript:alert(1)', 'https://www.youtube.com/watch?v=invalid', 'https://user@youtube.com/watch?v=M7lc1UVf-VE']) assert.equal(youtubeVideoId(url), null);
// The exact browser encoder in a worker-compatible Node test context.
(globalThis as any).self = { location: { href: 'file:///ffmpeg-core.js' } };
const factory = typeof createCore === 'function' ? createCore : (createCore as any).default;
const core = await factory({ wasmBinary: await readFile('node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm') });
core.setLogger(() => {});
const input = await readFile('scripts/help-video-fixture.mp4');
const padded = new Uint8Array(51 * 1024 * 1024); padded.set(input);
core.FS.writeFile('input', padded);
core.ffprobe('-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', '-o', 'duration.txt', 'input');
assert.equal(core.ret, 0);
const duration = Number(new TextDecoder().decode(core.FS.readFile('duration.txt')));
core.reset();
core.exec('-y', '-i', 'input', ...compressionArguments(duration), 'output.mp4');
assert.equal(core.ret, 0);
const output = core.FS.readFile('output.mp4'); assert(output.length > 0 && output.length < HELP_VIDEO_STORAGE_BYTES);
core.reset(); core.ffprobe('-v', 'error', '-show_entries', 'stream=codec_type,codec_name', '-of', 'json', '-o', 'streams.json', 'output.mp4');
const streams = JSON.parse(new TextDecoder().decode(core.FS.readFile('streams.json'))).streams;
assert(streams.some((stream: any) => stream.codec_type === 'audio' && stream.codec_name === 'aac'));
assert(streams.some((stream: any) => stream.codec_type === 'video' && stream.codec_name === 'h264'));
console.log(`PASS: YouTube URL validation and real compression from ${padded.length} bytes to ${output.length} bytes with video and audio retained.`);
