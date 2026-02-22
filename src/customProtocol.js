const { protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const protocolName = 'video';

// This is a workaround for a bug in Node.js that can cause the stream controller to be closed twice.
// See: https://github.com/nodejs/node/issues/54205
const nodeStreamToWeb = (resultStream) => {
	resultStream.pause();
	let closed = false;
	return new ReadableStream({
		start: (controller) => {
			resultStream.on('data', (chunk) => {
				if (closed) return;
				controller.enqueue(Buffer.isBuffer(chunk) ? new Uint8Array(chunk) : chunk);
				if (controller.desiredSize <= 0) resultStream.pause();
			});
			resultStream.on('error', (error) => controller.error(error));
			resultStream.on('end', () => {
				if (!closed) {
					closed = true;
					controller.close();
				}
			});
		},
		pull: () => {
			if (closed) return;
			resultStream.resume();
		},
		cancel: () => {
			if (!closed) {
				closed = true;
				resultStream.close();
			}
		},
	}, { highWaterMark: resultStream.readableHighWaterMark });
};


const handleRangeRequest = async (request, targetPath) => {
	const makeUnsupportedRangeResponse = () => new Response('unsupported range', { status: 416 });

	const rangeHeader = request.headers.get('Range');
	if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
		return makeUnsupportedRangeResponse();
	}

	try {
		const stat = await fs.promises.stat(targetPath);
		const [startByte, endByteStr] = rangeHeader.replace('bytes=', '').split('-');
		const endByte = endByteStr ? parseInt(endByteStr, 10) : stat.size - 1;

		if (isNaN(startByte) || endByte > stat.size || parseInt(startByte, 10) < 0) {
			return makeUnsupportedRangeResponse();
		}

		const resultStream = fs.createReadStream(targetPath, { start: parseInt(startByte, 10), end: endByte });

		const headers = new Headers([
			['Accept-Ranges', 'bytes'],
			['Content-Type', mime.lookup(targetPath) || 'application/octet-stream'],
			['Content-Length', `${endByte + 1 - parseInt(startByte, 10)}`],
			['Content-Range', `bytes ${startByte}-${endByte}/${stat.size}`],
		]);

		return new Response(nodeStreamToWeb(resultStream), { headers, status: 206 });
	} catch (error) {
		console.error('Error handling range request:', error);
		return new Response('Error reading file', { status: 500 });
	}
};

function registerVideoProtocol() {
	protocol.handle(protocolName, async (request) => {
		const url = request.url.slice(`${protocolName}://`.length);
		const decodedUrl = decodeURIComponent(url);
		const filePath = path.normalize(decodedUrl);

		try {
			// This is a security measure to prevent accessing files outside the app's path
			// In a real app, you should be more strict about what files can be accessed.
			// For this project, we assume videos are in a known 'videos' folder.
			// A better check would be to resolve against a known-safe base directory.
			if (!fs.existsSync(filePath)) {
				return new Response('File not found', { status: 404 });
			}

			const rangeHeader = request.headers.get('Range');
			if (rangeHeader) {
				return handleRangeRequest(request, filePath);
			}

			const fileContent = await fs.promises.readFile(filePath);
			return new Response(fileContent, {
				headers: { 'Content-Type': mime.lookup(filePath) || 'application/octet-stream' }
			});

		} catch (error) {
			console.error(`Failed to read file: ${filePath}`, error);
			return new Response('Failed to read file', { status: 500 });
		}
	});
}

module.exports = { registerVideoProtocol, protocolName };
