import { VIDEO_FOLDER } from '@/config';

const { protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

export const registerStreamProtocol = () => {
	protocol.handle('app', (req) => {
		const { host, pathname } = new URL(req.url);

		if (host === 'video') {
			const fileName = decodeURIComponent(pathname.substring(1));
			const videoPath = path.join(VIDEO_FOLDER, fileName);

			// Security: keep requests inside VIDEO_FOLDER
			const relativePath = path.relative(VIDEO_FOLDER, videoPath);
			const isSafe = relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
			if (!isSafe) {
				return new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain' } });
			}

			try {
				const stat = fs.statSync(videoPath);
				const fileSize = stat.size;
				const range = req.headers.get('range');

				if (range) {
					const parts = range.replace(/bytes=/, "").split("-");
					const start = parseInt(parts[0], 10);
					const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
					const chunksize = (end - start) + 1;
					const file = fs.createReadStream(videoPath, { start, end });
					const headers = {
						'Content-Range': `bytes ${start}-${end}/${fileSize}`,
						'Accept-Ranges': 'bytes',
						'Content-Length': chunksize,
						'Content-Type': 'video/mp4',
					};
					return new Response(file, { status: 206, headers });
				} else {
					const headers = {
						'Content-Length': fileSize,
						'Content-Type': 'video/mp4',
					};
					const file = fs.createReadStream(videoPath);
					return new Response(file, { status: 200, headers });
				}
			} catch (error) {
				console.error('Error handling video request:', error);
				return new Response('Internal Server Error', { status: 500, headers: { 'content-type': 'text/plain' } });
			}
		}

		return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } });
	});
}
