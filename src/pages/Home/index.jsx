import React, { useState, useEffect, useRef } from 'react';
import { APP_MODE } from '@/config';
import Playlist from '@/pages/Home/playlist';
import { formatFileSize } from '@/helpers/format';

const Home = () => {
	const [folders, setFolders] = useState([]);
	const [currentFolderIndex, setCurrentFolderIndex] = useState(0);
	const [videos, setVideos] = useState([]);
	const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const videoRef = useRef(null);
	const startTimeRef = useRef(Date.now());
	const isSwitchingFolders = useRef(false);

	const currentVideo = videos[currentVideoIndex];

	const calculateSeekTime = (folder) => {
		if (!folder) return 0;

		const elapsedTime = (Date.now() - startTimeRef.current) / 1000; // in seconds
		const loopCount = Math.floor(elapsedTime / folder.totalDuration);
		const timeInPlaylist = elapsedTime - (loopCount * folder.totalDuration);

		let accumulatedDuration = 0;
		for (let i = 0; i < folder.videos.length; i++) {
			const video = folder.videos[i];
			if (accumulatedDuration + video.duration >= timeInPlaylist) {
				const seekTime = timeInPlaylist - accumulatedDuration;
				setCurrentVideoIndex(i);
				return seekTime;
			}
			accumulatedDuration += video.duration;
		}

		// Fallback to the start of the playlist
		setCurrentVideoIndex(0);
		return 0;
	};

	// Load video files on initial render
	useEffect(() => {
		const loadAllDurations = async (videoFolders) => {
			const allVideos = videoFolders.flatMap(f => f.videos);
			const durationPromises = allVideos.map(video =>
				new Promise((resolve) => {
					const videoEl = document.createElement('video');
					videoEl.preload = 'metadata';
					videoEl.onloadedmetadata = () => {
						resolve({ path: video.path, duration: videoEl.duration });
					};
					videoEl.onerror = (e) => {
						console.error(`Error loading metadata for ${video.path}:`, e);
						// Resolve with 0 duration on error to not block the process
						resolve({ path: video.path, duration: 0 });
					};
					videoEl.src = video.url;
				})
			);

			try {
				const durations = await Promise.all(durationPromises);
				const durationMap = durations.reduce((acc, { path, duration }) => {
					acc[path] = duration;
					return acc;
				}, {});

				return videoFolders.map(folder => {
					let totalDuration = 0;
					const videosWithDuration = folder.videos.map(video => {
						const duration = durationMap[video.path] || 0;
						totalDuration += duration;
						return { ...video, duration };
					});
					return { ...folder, videos: videosWithDuration, totalDuration };
				});
			} catch (err) {
				console.error('Error loading video durations:', err);
				setError(`Error loading video durations: ${err.message}`);
				return videoFolders; // Return original folders on error
			}
		};

		const loadVideoFiles = async () => {
			setLoading(true);
			setError(null);

			try {
				const videoFolders = await window.electronAPI.getVideoFiles();

				if (videoFolders.length > 0) {
					const foldersWithDurations = await loadAllDurations(videoFolders);
					setFolders(foldersWithDurations);

					const initialFolder = foldersWithDurations[0];
					setVideos(initialFolder.videos);

					if (initialFolder.videos.length > 0) {
						calculateSeekTime(initialFolder);
					}
				} else {
					setFolders([]);
					setVideos([]);
				}
			} catch (err) {
				console.error('Error loading video files:', err);
				setError(`Error loading video files: ${err.message}`);
			} finally {
				setLoading(false);
			}
		};

		loadVideoFiles();

		// Expose loadVideoFiles to be called from a button
		window.loadVideoFiles = loadVideoFiles;
	}, []);

	// Effect to play video when currentVideo changes
	useEffect(() => {
		if (currentVideo && videoRef.current) {
			const videoElement = videoRef.current;
			
			const onLoadedMetadata = () => {
				if (isSwitchingFolders.current) {
					const seekTime = calculateSeekTime(folders[currentFolderIndex]);
					videoElement.currentTime = seekTime;
					isSwitchingFolders.current = false; // Reset after seeking
				}
				videoElement.play().catch(err => console.log('Autoplay prevented:', err));
			};

			videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
			videoElement.load();

			return () => {
				videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
			};
		}
	}, [currentVideo]);

	// Effect for handling video end
	useEffect(() => {
		const videoElement = videoRef.current;
		if (!videoElement) return;

		const handleVideoEnd = () => {
			const nextIndex = (currentVideoIndex + 1) % videos.length;
			setCurrentVideoIndex(nextIndex);
			// When the video ends, we don't want to seek, just play the next one.
			if (videoElement) {
				videoElement.currentTime = 0;
				videoElement.play().catch(err => console.log('Autoplay prevented on loop:', err));
			}
		};

		videoElement.addEventListener('ended', handleVideoEnd);

		return () => {
			videoElement.removeEventListener('ended', handleVideoEnd);
		};
	}, [currentVideoIndex, videos]);

	// Effect for keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!videoRef.current) return;

			const changeFolder = (direction) => {
				isSwitchingFolders.current = true;
				const newIndex = (currentFolderIndex + direction + folders.length) % folders.length;
				setCurrentFolderIndex(newIndex);
				const newFolder = folders[newIndex];
				setVideos(newFolder.videos);
				calculateSeekTime(newFolder);
			};

			switch (e.key) {
				// case 'f':
				// 	if (document.fullscreenElement) {
				// 		document.exitFullscreen();
				// 	} else {
				// 		videoRef.current.requestFullscreen();
				// 	}
				// 	break;
					
				case 'n':
					changeFolder(1);
					break;
				case 'p':
					changeFolder(-1);
					break;
				default:
					break;
			}
		};

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [currentFolderIndex, folders]);

	if (videos.length === 0) {
		return (
			<div className="container">
				<h1>🎬 Electron Video Player</h1>
				{loading ? (
					<p>Loading videos...</p>
				) : (
					<div>
						<p>No videos found.</p>
						<button onClick={() => window.loadVideoFiles()}>Select Folder</button>
					</div>
				)}
				{error && <p>Error: {error}</p>}
			</div>
		);
	}

	if (APP_MODE === 'prod') {
		return (
			<video ref={videoRef} id="videoPlayer" src={currentVideo?.url} style={{ width: '100vw', height: '100vh', objectFit: 'cover' }}>
				Your browser does not support the video tag.
			</video>
		);
	}

	return (
		<div className="container">
			<h1>🎬 Electron Video Player</h1>

			<div className="video-wrapper">
				<video ref={videoRef} id="videoPlayer" controls src={currentVideo?.url}>
					Your browser does not support the video tag.
				</video>
			</div>

			<div className="info" id="videoInfo">
				<p><strong>Protocol:</strong> Custom app:// protocol</p>
				<p><strong>Current Folder:</strong> <span id="currentVideoSource">{folders[currentFolderIndex]?.name || 'No folder selected'}. Index: {currentFolderIndex}</span></p>
				<p><strong>Video Source:</strong> <span id="currentVideoSource">{currentVideo?.name || 'No video selected'}. Index: {currentVideoIndex}</span></p>
				<p><strong>File Size:</strong> <span id="currentVideoSize">{currentVideo ? formatFileSize(currentVideo.size) : '-'}</span></p>
			</div>

			<Playlist videos={videos} currentVideoIndex={currentVideoIndex} setCurrentVideoIndex={setCurrentVideoIndex} loading={loading} error={error} />
		</div>
	);
};

export default Home;
