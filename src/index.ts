import fetch from 'node-fetch';
import { DateTime } from 'luxon';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface Segment {
    url: string;
    startTime: DateTime;
    duration: number;
}

async function fetchPlaylist(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch playlist: ${response.statusText}`);
    return response.text();
}

function parsePlaylist(content: string, playlistUrl: string): Segment[] {
    const lines = content.split('\n');
    const segments: Segment[] = [];
    let currentTime: DateTime | null = null;
    let duration: number | null = null;

    for (const line of lines) {
        if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
            let timeStr = line.replace('#EXT-X-PROGRAM-DATE-TIME:', '').trim();
            timeStr = timeStr.replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3');
            currentTime = DateTime.fromISO(timeStr);
            if (!currentTime.isValid) {
                console.warn(`Invalid timestamp: ${timeStr}`);
                currentTime = null;
            }
        } else if (line.startsWith('#EXTINF:')) {
            const match = line.match(/#EXTINF:([\d.]+),?/);
            duration = match ? parseFloat(match[1]) : null;
            if (duration === null || isNaN(duration)) {
                console.warn(`Invalid duration: ${line}`);
            }
        } else if (line.trim() && !line.startsWith('#')) {
            const segmentUrl = new URL(line.trim(), playlistUrl).href;
            if (currentTime?.isValid && duration !== null && !isNaN(duration)) {
                segments.push({ url: segmentUrl, startTime: currentTime, duration });
                console.log(`Added segment: ${segmentUrl}, Start: ${currentTime.toISO()}, Duration: ${duration}`);
                currentTime = null;
                duration = null;
            } else {
                console.warn(`Skipped segment: ${segmentUrl}, Time: ${currentTime?.toISO() || 'null'}, Duration: ${duration}`);
            }
        } else if (line.startsWith('#EXTINF:') || line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
            if (currentTime || duration) {
                console.log(`Incomplete segment detected: Time: ${currentTime?.toISO() || 'null'}, Duration: ${duration || 'null'}`);
            }
        }
    }
    return segments;
}

async function downloadSegment(url: string, localPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download segment: ${response.statusText}`);
    const buffer = await response.buffer();
    const tempDir = path.dirname(localPath);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(localPath, buffer);
}

async function trimAndSave(segments: Segment[], providedTime: DateTime, trimDuration: number, outputFile: string) {
    if (segments.length < 1) {
        throw new Error('No segments provided');
    }

    const selectedSegments = segments.slice(-3);
    let localPaths: string[] = [];
    let totalDuration = 0;

    for (const segment of selectedSegments.reverse()) {
        const localPath = path.join('temp', path.basename(segment.url));
        console.log(`Downloading segment: ${segment.url} to ${localPath}`);
        await downloadSegment(segment.url, localPath);
        localPaths.push(localPath);
        totalDuration += segment.duration;
    }

    localPaths = localPaths.reverse();

    const earliestSegment = selectedSegments[0];
    const trimEndTime = providedTime;
    const trimStartTime = trimEndTime.minus({ seconds: trimDuration });
    const trimStart = Math.max(0, (trimStartTime.toMillis() - earliestSegment.startTime.toMillis()) / 1000);

    if (totalDuration < trimDuration) {
        console.warn(`Total duration (${totalDuration}s) is too short for ${trimDuration}s trim`);
    }

    const absolutePaths = localPaths.map(p => path.resolve(p));
    const concatList = absolutePaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    const concatFile = path.join('temp', 'concat_list.txt');
    fs.writeFileSync(concatFile, concatList);
    console.log(`Created concat list: ${concatFile}`);

    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
    }

    const cmd = `ffmpeg -f concat -safe 0 -i "${concatFile}" -ss ${trimStart} -t ${trimDuration} -c:v libx264 -an -preset fast -f mpegts "${outputFile}" -y`;
    await execAsync(cmd);

    localPaths.forEach(p => {
        try {
            fs.unlinkSync(p);
            console.log(`Deleted segment: ${p}`);
        } catch (err) {
            console.warn(`Failed to delete segment: ${p}`, err);
        }
    });
    try {
        fs.unlinkSync(concatFile);
        console.log(`Deleted concat list: ${concatFile}`);
    } catch (err) {
        console.warn(`Failed to delete concat list: ${concatFile}`, err);
    }
}

async function main() {
    const playlistUrl = 'http://localhost:8000/stream.m3u8';
    const providedTime = DateTime.fromISO('2025-06-03T08:03:33.000+05:30', { zone: 'Asia/Kolkata' });
    console.log(`Provided time: ${providedTime.toISO()}`);

    if (!fs.existsSync('temp')) {
        fs.mkdirSync('temp', { recursive: true });
    }

    if (!fs.existsSync('output')) {
        fs.mkdirSync('output', { recursive: true });
        console.log('Created output directory: output');
    }

    const playlistContent = await fetchPlaylist(playlistUrl);
    console.log('Playlist content:\n', playlistContent);
    const segments = parsePlaylist(playlistContent, playlistUrl);
    console.log(`Found ${segments.length} segments in the playlist.`);

    if (segments.length === 0) {
        console.error('No valid segments parsed from the playlist');
        return;
    }

    // BEFORE VIDEO (10s ending at providedTime)
    const beforeSegments = segments.filter(segment => {
        const segmentEnd = segment.startTime.plus({ seconds: segment.duration });
        const trimStartTime = providedTime.minus({ seconds: 10 });
        return segment.startTime <= providedTime && segmentEnd >= trimStartTime;
    }).slice(-3);

    const beforeOutputFile = path.join('output', 'before_video.ts');
    if (beforeSegments.length === 0) {
        console.error('No segments cover the provided time for before video; using latest segments');
        await trimAndSave(segments.slice(-3), providedTime, 10, beforeOutputFile);
    } else {
        await trimAndSave(beforeSegments, providedTime, 10, beforeOutputFile);
    }
    console.log(`Generated: '${beforeOutputFile}' (10s ending at ${providedTime.toFormat('HH:mm:ss')})`);

    // AFTER VIDEO (10s starting at providedTime, inclusive)
    const afterTrimStart = providedTime;
    const afterTrimEnd = providedTime.plus({ seconds: 10 });
    const afterSegments = segments.filter(segment => {
        const segmentEnd = segment.startTime.plus({ seconds: segment.duration });
        // Segment overlaps with [afterTrimStart, afterTrimEnd)
        return segmentEnd > afterTrimStart && segment.startTime < afterTrimEnd;
    }).slice(0, 3);

    const afterOutputFile = path.join('output', 'after_video.ts');
    if (afterSegments.length === 0) {
        console.error('No segments cover the provided time for after video; using earliest segments');
        await trimAndSave(segments.slice(0, 3), afterTrimStart, 10, afterOutputFile);
    } else {
        await trimAndSave(afterSegments, afterTrimStart, 10, afterOutputFile);
    }
    console.log(`Generated: '${afterOutputFile}' (10s starting at ${providedTime.toFormat('HH:mm:ss')})`);
}

main().catch(console.error);