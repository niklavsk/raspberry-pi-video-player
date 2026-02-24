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

	const currentVideo = videos[currentVideoIndex];

	// Load video files on initial render
	useEffect(() => {
		const loadVideoFiles = async () => {
			setLoading(true);

			try {
				const videoFolders = await window.electronAPI.getVideoFiles();
				console.log('Found video folders:', videoFolders);
				setFolders(videoFolders);

				if (videoFolders.length > 0) {
					setVideos(videoFolders[0].videos);
					if (videoFolders[0].videos.length > 0) {
						setCurrentVideoIndex(0);
					}
				}
			} catch (err) {
				console.error('Error loading video files:', err);
				setError(`Error loading video files: ${err.message}`);
			} finally {
				setLoading(false);
			}
		};

		loadVideoFiles();
	}, []);

	// Effect to play video when currentVideo changes
	useEffect(() => {
		if (currentVideo && videoRef.current) {
			videoRef.current.load();
			videoRef.current.play().catch(err => console.log('Autoplay prevented:', err));
		}
	}, [currentVideo]);

	// Effect for handling video end
	useEffect(() => {
		const videoElement = videoRef.current;
		if (!videoElement) return;

		const handleVideoEnd = () => {
			const nextIndex = (currentVideoIndex + 1) % videos.length;
			setCurrentVideoIndex(nextIndex);
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
				const newIndex = (currentFolderIndex + direction + folders.length) % folders.length;
				setCurrentFolderIndex(newIndex);
				setVideos(folders[newIndex].videos);
				setCurrentVideoIndex(0);
			};

			switch (e.key) {
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
