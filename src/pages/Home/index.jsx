import React, { useState, useEffect, useRef } from 'react';
import { APP_MODE } from '@/config';
import Playlist from '@/pages/Home/playlist';
import { formatFileSize } from '@/helpers/format';

const Home = () => {
	const [videos, setVideos] = useState([]);
	const [currentVideo, setCurrentVideo] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const videoRef = useRef(null);

	// Load video files
	useEffect(() => {
		const loadVideoFiles = async () => {
			try {
				const videoFiles = await window.electronAPI.getVideoFiles();
				console.log('Found video files:', videoFiles);
				setVideos(videoFiles);

				if (videoFiles.length > 0) {
					setCurrentVideo(videoFiles[0]);
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
			const currentIndex = videos.findIndex(v => v.path === currentVideo.path);
			const nextIndex = (currentIndex + 1) % videos.length;
			setCurrentVideo(videos[nextIndex]);
		};

		videoElement.addEventListener('ended', handleVideoEnd);

		return () => {
			videoElement.removeEventListener('ended', handleVideoEnd);
		};
	}, [currentVideo, videos]);

	// Effect for keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!videoRef.current) return;

			const videoElement = videoRef.current;

			switch (e.key) {
				case 'ArrowRight':
					videoElement.currentTime += 5; // Seek forward 5 seconds
					break;
				case 'ArrowLeft':
					videoElement.currentTime -= 5; // Seek backward 5 seconds
					break;
				case ' ':
					if (videoElement.paused) {
						videoElement.play();
					} else {
						videoElement.pause();
					}
					e.preventDefault(); // Prevent space from scrolling
					break;
				case 'ArrowUp':
					if (videoElement.volume < 1) {
						videoElement.volume = Math.min(1, videoElement.volume + 0.1);
					}
					break;
				case 'ArrowDown':
					if (videoElement.volume > 0) {
						videoElement.volume = Math.max(0, videoElement.volume - 0.1);
					}
					break;
				case 'f':
					if (document.fullscreenElement) {
						document.exitFullscreen();
					} else {
						videoRef.current.requestFullscreen();
					}
					break;
				case 'm':
					videoElement.muted = !videoElement.muted;
					break;
				default:
					break;
			}
		};

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

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
				<p><strong>Video Source:</strong> <span id="currentVideoSource">{currentVideo?.name || 'No video selected'}</span></p>
				<p><strong>File Size:</strong> <span id="currentVideoSize">{currentVideo ? formatFileSize(currentVideo.size) : '-'}</span></p>
			</div>

			<Playlist videos={videos} currentVideo={currentVideo} setCurrentVideo={setCurrentVideo} loading={loading} error={error} />
		</div>
	);
};

export default Home;
